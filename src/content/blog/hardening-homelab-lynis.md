---
title: "Hardening del homelab: auditando y securizando servicios expuestos a internet con Lynis"
date: 2026-08-19
description: "Cómo audité con Lynis los LXCs expuestos de mi homelab en Proxmox, qué medidas apliqué en cada uno y cuánto mejoró el índice de seguridad. Guía práctica con comandos reales."
tags: ["seguridad", "proxmox", "lynis", "hardening", "linux", "homelab"]
draft: false
---

Tener servicios en casa expuestos a internet es cómodo — pero también es una superficie de ataque real. WireGuard, Cloudflare Tunnel, Authelia, el dashboard de Homarr y el propio Proxmox VE son los puntos donde el exterior puede rozar mi red interna. Hasta ahora los tenía funcionando, pero sin haber aplicado ninguna medida de hardening sistemática más allá de la configuración básica de cada servicio.

Este post documenta la auditoría que hice con **Lynis** sobre los cinco sistemas expuestos y las medidas que apliqué en cada uno. Incluye comandos reales, las particularidades de cada entorno y los resultados antes y después.

## ¿Por qué Lynis?

[Lynis](https://cisofy.com/lynis/) es una herramienta de auditoría de seguridad para sistemas Linux. Analiza el sistema en busca de configuraciones débiles, opciones de kernel sin endurecer, servicios innecesarios, permisos incorrectos y docenas de puntos más. Al final produce un **Hardening Index** entre 0 y 100 que sirve como referencia para comparar antes y después de aplicar mejoras.

No es una bala de plata — no detecta vulnerabilidades de aplicación ni revisa el código — pero sí es extraordinariamente útil para auditar la configuración del sistema operativo de forma rápida y repetible.

Instalación en cualquier LXC o en el host PVE:

```bash
apt install -y lynis
lynis audit system --quick
```

El flag `--quick` omite las pausas interactivas. Al final del output aparece la línea que más importa:

```
Hardening index : 69 [##############      ]
```

## Los cinco sistemas auditados

Mi homelab corre sobre **Proxmox VE 9.2** en un único servidor. Los servicios expuestos a internet son cuatro LXCs y el propio host PVE:

| Sistema | LXC/Host | IP | Exposición |
|---|---|---|---|
| WireGuard VPN | LXC 100 | 192.168.1.100 | Puerto 51820 UDP abierto en router |
| Cloudflared | LXC 104 | 192.168.1.104 | Cloudflare Tunnel (sin puertos abiertos) |
| Authelia | LXC 105 | 192.168.1.105 | Cloudflare Tunnel vía auth.jelopez.link |
| Homarr | LXC 106 | 192.168.1.106 | Cloudflare Tunnel vía hmrr.jelopez.link |
| Proxmox VE | Host PVE | 192.168.1.254 | Acceso SSH + gestión interna |

WireGuard es el más expuesto porque tiene un puerto UDP abierto en el router. Los demás llegan a internet únicamente a través de Cloudflare Tunnel, que no requiere abrir ningún puerto — pero siguen siendo puntos donde un compromiso tendría consecuencias graves.

## Resultados: antes y después

| Sistema | Índice antes | Índice después | Mejora |
|---|---|---|---|
| PVE host | 62 | 72 | +10 |
| LXC 100 — WireGuard | 66 | 77 | +11 |
| LXC 104 — Cloudflared | 68 | 77 | +9 |
| LXC 105 — Authelia | 69 | 78 | +9 |
| LXC 106 — Homarr | 69 | 76 | +7 |

El PVE partía más bajo (62) porque su configuración por defecto es más permisiva. Los LXCs estaban en el rango 66-69. Después del hardening todos quedaron por encima de 72, con Authelia alcanzando el 78.

## Medidas aplicadas

Las medidas son en su mayoría comunes a todos los sistemas, con algunas excepciones importantes según el servicio que corre en cada uno.

### Kernel hardening — sysctl

Creé `/etc/sysctl.d/99-hardening.conf` con los siguientes parámetros:

```ini
fs.protected_fifos = 2
kernel.kptr_restrict = 2
kernel.sysrq = 0
kernel.unprivileged_bpf_disabled = 1
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.conf.all.rp_filter = 1
```

**Qué hace cada uno:**

- `fs.protected_fifos = 2` — Impide que procesos sin privilegios creen FIFOs en directorios world-writable (como `/tmp`). Previene ataques de escritura en pipes de otros procesos.
- `kernel.kptr_restrict = 2` — Oculta las direcciones del kernel en `/proc/kallsyms` y similares. Sin esto, un atacante con acceso local puede usar esas direcciones para bypass de ASLR.
- `kernel.sysrq = 0` — Deshabilita la tecla mágica SysRq. En servidores sin acceso físico es innecesaria y puede usarse para reboots o volcados de memoria.
- `kernel.unprivileged_bpf_disabled = 1` — Restringe el uso de eBPF a root. eBPF tiene vectores de explotación conocidos cuando está disponible para usuarios sin privilegios.
- `net.ipv4.conf.all.log_martians` — Registra en syslog los paquetes con IPs fuente imposibles (martians). Útil para detectar spoofing.
- `net.ipv4.conf.all.rp_filter = 1` — Valida que la ruta de retorno de un paquete entrante coincide con la interfaz por la que llegó. Mitiga el IP spoofing.

**Excepciones importantes:**

- En **LXC 106 (Homarr/Docker)** omití `rp_filter` porque Docker crea rutas asimétricas entre la interfaz del host y los bridges de los contenedores. Activarlo rompe la red de los contenedores.
- En **LXC 100 (WireGuard)** y el **host PVE** no toqué `net.ipv4.ip_forward` — lo necesitan para enrutar tráfico VPN y red de VMs/LXCs respectivamente.

Aplicar los cambios sin reiniciar:

```bash
sysctl --system
```

### Deshabilitar protocolos de red no usados

```bash
cat > /etc/modprobe.d/disable-protocols.conf << 'EOF'
install dccp /bin/false
install sctp /bin/false
install rds /bin/false
install tipc /bin/false
install usb-storage /bin/false
install firewire-ohci /bin/false
EOF
```

DCCP, SCTP, RDS y TIPC son protocolos que no uso en ninguno de estos sistemas pero que el kernel cargaría bajo demanda si algo los solicitara. Al redirigir su instalación a `/bin/false` se impide que se carguen, reduciendo la superficie de ataque del kernel.

`usb-storage` y `firewire-ohci` los deshabilité en los LXCs (en el PVE solo los de red) porque no tienen hardware físico que los necesite y su carga accidental no aporta nada.

### SSH hardening

El error más común al endurecer SSH es usar `echo "Opción valor" >> /etc/ssh/sshd_config`. El problema: **SSH solo lee la primera ocurrencia de cada directiva**. Si la opción ya existía (comentada o no) más arriba en el fichero, el append no tiene efecto. La forma correcta es `sed -i` para reemplazar en lugar de añadir:

```bash
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config
sed -i 's/^#*AllowTcpForwarding.*/AllowTcpForwarding no/' /etc/ssh/sshd_config
sed -i 's/^#*AllowAgentForwarding.*/AllowAgentForwarding no/' /etc/ssh/sshd_config
sed -i 's/^#*X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config
sed -i 's/^#*LogLevel.*/LogLevel VERBOSE/' /etc/ssh/sshd_config
sed -i 's/^#*ClientAliveCountMax.*/ClientAliveCountMax 2/' /etc/ssh/sshd_config
sed -i 's/^#*TCPKeepAlive.*/TCPKeepAlive no/' /etc/ssh/sshd_config

# Verificar sintaxis antes de reiniciar
sshd -t && systemctl restart ssh
```

Siempre `sshd -t` antes de reiniciar el servicio. Un error de sintaxis con SSH reiniciado puede dejarte sin acceso.

**Nota sobre el PVE:** En el host Proxmox usé `PermitRootLogin prohibit-password` en lugar de `no`. Root es el usuario de gestión del hipervisor y necesito poder entrar con clave. Para esto configuré previamente un par de claves **ed25519** generado en mi PC y la clave pública instalada en `/root/.ssh/authorized_keys` del PVE antes de deshabilitar el acceso por contraseña.

### fail2ban

```bash
apt install -y fail2ban
systemctl enable --now fail2ban
```

fail2ban monitoriza los logs de SSH (y otros servicios configurables) y bloquea temporalmente las IPs que acumulan intentos de autenticación fallidos. Con la configuración por defecto bloquea una IP tras 5 intentos fallidos en 10 minutos durante otros 10 minutos. Es especialmente relevante en WireGuard (puerto expuesto directamente) y en el PVE.

### unattended-upgrades

```bash
apt install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

Mantiene el sistema actualizado automáticamente en parches de seguridad. Imprescindible en sistemas que no revisas a diario.

### ufw — firewall

En cada LXC configura solo los puertos estrictamente necesarios para su función:

```bash
# Ejemplo para WireGuard (LXC 100)
ufw default deny incoming
ufw allow 51820/udp   # WireGuard
ufw allow 22/tcp      # SSH (solo desde LAN)
ufw enable
```

Cada LXC tiene su propio perfil mínimo. No hay reglas genéricas — si un servicio no necesita un puerto, ese puerto no está abierto.

## Consideraciones específicas por sistema

### WireGuard (LXC 100)

La advertencia más llamativa de Lynis en este LXC fue que `net.ipv4.conf.all.forwarding` estaba en `1`, marcado como `DIFFERENT` (diferente del valor recomendado `0`). **No lo cambié.** WireGuard necesita IP forwarding para enrutar el tráfico de los clientes VPN hacia la LAN. Desactivarlo rompería la VPN por completo. Es un falso positivo de Lynis para este caso de uso.

### Homarr con Docker (LXC 106)

Docker gestiona sus propios bridges de red y necesita `ip_forward` activo. Además, `rp_filter` en modo estricto (`1`) rechaza paquetes cuya ruta de retorno no coincide con la interfaz de entrada — algo que pasa constantemente en el tráfico entre el host y los contenedores. Omití ambos parámetros en el `sysctl.d` de este LXC.

### Proxmox VE (host)

El PVE tiene sus propias particularidades:

- La interfaz `vmbr0` (bridge de red de las VMs) aparece en modo promiscuo. Lynis lo marca como `WARNING`. Es un falso positivo — los bridges de Proxmox deben estar en promiscuo para pasar tráfico a las VMs y LXCs.
- Los repositorios venían con `pve-enterprise` deshabilitado (`Enabled: false`) y `pve-no-subscription` activo. Correcto para uso personal sin suscripción.
- Aproveché para actualizar el kernel de `7.0.12` a `7.0.14` que ya estaba instalado pero no activo. Bastó con un reboot.

## Lo que Lynis no cubre (y qué hacer con ello)

El índice de Lynis mide la configuración del sistema operativo, no la seguridad de las aplicaciones que corren encima. Un índice de 78 en el LXC de Authelia no dice nada sobre si Authelia está bien configurada — eso es otra auditoría.

Lo que queda fuera del scope de esta campaña:
- Revisión de configuración de cada servicio (Authelia, WireGuard, Homarr)
- Auditoría de los Cloudflare Access policies
- Rotación de secretos y tokens

Son los siguientes pasos en el backlog.

## Resumen

El hardening con Lynis no es difícil ni lleva mucho tiempo — la mayor parte de los cambios son configuraciones de sysctl, SSH y la instalación de un par de paquetes. El valor está en hacerlo de forma sistemática sobre todos los sistemas expuestos, entender por qué cada medida existe y documentar las excepciones (como el `ip_forward` de WireGuard) para no romperte la cabeza la próxima vez que revises los logs de Lynis.

El homelab es un entorno de aprendizaje, pero también tiene acceso a mi red doméstica. Tratarlo con el mismo criterio de seguridad que un servidor en producción tiene sentido.
