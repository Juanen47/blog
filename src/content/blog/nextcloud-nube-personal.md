---
pubDate: "2026-10-21"
title: 'Nextcloud — mi propia nube en el homelab en lugar de pagar más iCloud'
tags: ["homelab", "nextcloud", "proxmox", "backups", "wireguard", "seguridad"]
description: "Cómo he montado Nextcloud en un LXC con ProxMenux, con los datos en un SSD externo, accesible solo desde casa y por WireGuard, con 2FA y backups diarios. Y los errores que cometí por el camino."
---

Uso iCloud en el iPhone y en el PC. Funciona bien, pero el plan gratuito se queda corto en
cuanto guardas fotos y documentos, y la alternativa es pagar una suscripción mensual para siempre.
Tenía un SSD externo SanDisk de 2 TB en un cajón y un homelab funcionando, así que la pregunta
era obvia: ¿por qué no tener mi propia nube?

La respuesta es **Nextcloud**: una plataforma de código abierto para sincronizar archivos,
con apps para iPhone, Windows, macOS y Linux, subida automática de fotos y todo lo que
esperas de Drive o iCloud, pero en tu hardware.

## El punto de partida: primero los backups

Antes de meter datos importantes en el homelab tenía que resolver algo incómodo:
**no tenía ningún backup** de los contenedores. Todo vivía en el único SSD del NUC.
Montar una nube personal sobre eso habría sido construir la casa por el tejado.

Así que el SanDisk hace dos trabajos:

- `/mnt/usb2tb/vzdump`: almacenamiento de Proxmox para backups.
- `/mnt/usb2tb/nextcloud`: los datos de Nextcloud.

El disco se formatea en ext4 y se monta por UUID con `nofail`, para que el host arranque
aunque el USB no esté conectado. En Proxmox se añade como almacenamiento con `is_mountpoint`:

```bash
pvesm add dir usb-backup --path /mnt/usb2tb/vzdump --content backup \
  --is_mountpoint /mnt/usb2tb \
  --prune-backups keep-daily=7,keep-weekly=4,keep-monthly=3
```

Ese `--is_mountpoint` es importante: si el disco no está montado, Proxmox marca el almacenamiento
como no disponible en lugar de escribir los backups en el SSD interno sin avisar.

Después, un trabajo diario a las 03:00 para todos los contenedores, incluidos los que cree en el futuro:

```bash
pvesh create /cluster/backup --id daily-lxc --schedule "03:00" --storage usb-backup \
  --all 1 --mode snapshot --compress zstd --enabled 1 --notes-template "{{guestname}}"
```

Y para enterarme de si algo falla, las notificaciones de Proxmox van a Gmail por SMTP con
una contraseña de aplicación. Con un alias `+homelab` en el destinatario, un filtro de Gmail
mete todos esos correos en su propia etiqueta.

## Instalación con ProxMenux

Igual que WireGuard, Nextcloud se instala con **ProxMenux**. Usé su opción de **NextcloudPi**,
una distribución de Nextcloud ya preparada (Apache, PHP, base de datos, caché y un panel
de administración propio).

| Parámetro | Valor |
|---|---|
| **LXC ID** | 107 |
| **IP** | 192.168.1.107 |
| **Tipo** | Unprivileged |
| **CPU / RAM** | 2 vCPU / 4 GB |
| **Disco del sistema** | 16 GB en `local-lvm` |
| **Datos** | SSD externo, como punto de montaje |

El asistente inicial de NextcloudPi ofrece abrir puertos, pedir certificado de Let's Encrypt
y configurar un DDNS. **Me lo salté entero**: no quiero Nextcloud expuesto a Internet.

## Los datos en el SSD externo

El sistema del contenedor va en el SSD interno, pero los archivos van al SanDisk.
Se monta la carpeta del host dentro del LXC:

```bash
pct set 107 -mp0 /mnt/usb2tb/nextcloud,mp=/mnt/ncdata,backup=0
```

Al ser un contenedor **unprivileged**, los UID de dentro están desplazados 100000 respecto al host.
El usuario `www-data` (UID 33 dentro) es el **UID 100033** en el host, así que la carpeta
tiene que pertenecerle:

```bash
chown -R 100033:100033 /mnt/usb2tb/nextcloud
```

Luego, desde el panel de NextcloudPi, la opción `nc-datadir` mueve el directorio de datos
a `/mnt/ncdata`. Para comprobar que los archivos acaban de verdad en el SanDisk y no en el
disco del contenedor, basta con un `du -sh` en la carpeta del host. Ojo: **el nombre de
usuario distingue mayúsculas**, y la carpeta se llama exactamente como el usuario. Mi primer `du`
falló por escribirlo en minúsculas.

El `backup=0` excluye el punto de montaje del vzdump diario. Es intencionado: no tiene
sentido copiar el SSD externo sobre sí mismo. Pero también significa que **los datos de
Nextcloud necesitan su propia copia fuera de casa**. Lo explico al final.

## Acceso: solo LAN y WireGuard

Nextcloud **no pasa por Cloudflare Tunnel**. Para una nube personal no necesito acceso
público: en casa estoy en la LAN, y fuera tengo WireGuard.

Para tener un nombre con certificado válido en lugar de `https://192.168.1.107` con avisos
del navegador, reutilizo el mismo patrón que el resto de servicios internos:

1. **AdGuard Home**: reescritura DNS `nube.jelopez.link` → `192.168.1.103` (NPMplus).
2. **NPMplus**: proxy host `nube.jelopez.link` → `https://192.168.1.107:443`, con websockets
   y certificado de Let's Encrypt por DNS challenge de Cloudflare. Funciona aunque el nombre
   no exista en DNS público.
3. **Nextcloud**: aceptar el nombre y confiar en el proxy.

En la pestaña *Advanced* del proxy host, para que no se corten las subidas grandes ni las
sincronizaciones largas:

```nginx
client_max_body_size 0;
proxy_request_buffering off;
proxy_read_timeout 3600s;
```

Y dentro del contenedor:

```bash
cd /var/www/nextcloud
sudo -u www-data php occ config:system:set trusted_domains 5 --value=nube.jelopez.link
sudo -u www-data php occ config:system:set trusted_proxies 0 --value=192.168.1.103
sudo -u www-data php occ config:system:set overwriteprotocol --value=https
sudo -u www-data php occ config:system:set overwrite.cli.url --value=https://nube.jelopez.link
```

### El 400 Bad Request

Mi primer intento devolvió esto:

> Your browser sent a request that this server could not understand.
> Reason: You're speaking plain HTTP to an SSL-enabled server port.

En el [post de NPMplus](/blog/npmplus-reverse-proxy/) digo que el scheme hacia el servicio
interno debe ser siempre http. NextcloudPi es la excepción: solo escucha en HTTPS, así que
el proxy host tiene que usar **https** hacia el 443. Cambiar el scheme y listo.

## Seguridad de la cuenta

- La cuenta `ncp` que crea NextcloudPi es de administración. Para el día a día uso un usuario
  personal sin privilegios de administrador.
- **2FA con TOTP obligatorio** para todos los usuarios, con códigos de respaldo guardados
  en el gestor de contraseñas.
- Sin exposición a Internet: para llegar al login hay que estar en la LAN o dentro de la VPN.

## Los clientes

- **PC**: Nextcloud Desktop, con `https://nube.jelopez.link` como servidor.
- **iPhone**: la app de Nextcloud, con **subida automática** de fotos y vídeos. La primera
  subida, mejor en WiFi y con el móvil cargando.

Para que funcione fuera de casa sin acordarme de nada, en la app de WireGuard del iPhone:

- **Activación bajo demanda** en datos móviles y WiFi, **excepto las redes de casa**.
  El túnel se levanta solo al salir.
- **DNS = la IP de AdGuard**. `nube.jelopez.link` solo existe en mi AdGuard; con `1.1.1.1`
  fuera de casa no resuelve. Y no pongas un DNS público como secundario: iOS los usa
  indistintamente y fallaría de forma intermitente.
- **IPs permitidas = la LAN** (`192.168.1.0/24`). Solo el tráfico hacia casa y el DNS
  van por el túnel; el resto sale directo. De regalo, el filtrado de AdGuard también
  funciona fuera.

## Lo que aprendí subiendo mis archivos

La primera carga la hice copiando una carpeta de iCloud y mi carpeta de proyectos. Dos sustos:

**Subí secretos sin darme cuenta.** Dentro de la carpeta de proyectos había un directorio con
claves SSH y un `.env` con un token. Los borré de la copia, **vacié la papelera del servidor**
(lo borrado en Nextcloud sigue ahí hasta entonces) y añadí exclusiones en
*Ajustes → General → Editar archivos ignorados* del cliente de escritorio:

```text
node_modules
dist
.astro
.secrets
.env
```

`node_modules` y `dist`, además, eran más de 20.000 archivos que se regeneran con `npm install`.
Para el código, la copia buena sigue siendo Git.

**Certificados digitales.** Entre los documentos había certificados `.p12` de la FNMT. Con ellos
se firma ante la Administración en tu nombre, así que los metí en un **7z cifrado con AES-256**,
con la contraseña en el gestor de contraseñas. Dos trucos: un `.zip` creado con las opciones
por defecto **no lleva contraseña**, y hacer doble clic en un `.p12` en Windows no lo abre:
**lo instala** en tu almacén de certificados.

## Lo que falta

- **Copia offsite.** Ahora mismo los datos de Nextcloud están en un único disco. Hasta tener
  una copia cifrada fuera de casa (restic o rclone contra algún almacenamiento externo),
  **no cancelo iCloud**. Tres copias, dos soportes, una fuera de casa.
- **Probar la restauración.** Un backup que nunca has restaurado no es un backup. Toca
  restaurar uno de los contenedores como CT nuevo, sin red, y comprobar que arranca.

Cuando lo tenga, lo contaré aquí.
