---
pubDate: "2026-06-06"
title: 'Netdata — monitorización en tiempo real integrada con Uptime Kuma'
tags: ["homelab", "netdata", "monitoring", "uptime-kuma", "proxmox"]
description: "Cómo instalar Netdata en modo parent-child para monitorizar el host Proxmox y todos los LXCs desde un único dashboard, con alertas integradas en Uptime Kuma via webhook."
---

Uptime Kuma es perfecto para saber si un servicio responde o no, pero no dice nada sobre por qué está fallando. Netdata cubre esa brecha — monitorización en tiempo real con granularidad de 1 segundo para CPU, RAM, disco, red y procesos.

## Arquitectura

La configuración usa el modelo **parent-child** de Netdata:

- **LXC 107 (parent)** — recibe y centraliza todas las métricas, sirve el dashboard
- **Host Proxmox (child)** — envía métricas al parent en tiempo real

Desde el host Proxmox, Netdata tiene acceso a los cgroups de todos los LXCs, por lo que un único agente en el host es suficiente para ver el estado de toda la infraestructura.

## Instalación del parent — LXC 107

El LXC se crea con Proxmox o ProxMenux:

| Parámetro | Valor |
|---|---|
| **LXC ID** | 107 |
| **IP** | 192.168.1.107 |
| **OS** | Debian 13 |
| **RAM** | 512 MB |
| **Disco** | 8 GB |

Una vez dentro del LXC, instalar Netdata con el script oficial:

```bash
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh
```

Cuando pregunte si conectar a Netdata Cloud, omitir — usamos Netdata en local.

### Configurar el parent para recibir streams

Crear el `stream.conf` en el LXC 107:

```bash
cat > /etc/netdata/stream.conf << 'EOF'
[f47ac10b-58cc-4372-a567-0e02b2c3d479]
    enabled = yes
    allow from = *
EOF

systemctl restart netdata
```

El UUID entre corchetes es la API key — debe coincidir exactamente con la que configure el child.

## Instalación del child — host Proxmox

Instalar Netdata en el host sin arrancarlo todavía:

```bash
wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh
sh /tmp/netdata-kickstart.sh --dont-start-it
```

Crear el `stream.conf` antes de arrancar:

```bash
cat > /etc/netdata/stream.conf << 'EOF'
[stream]
    enabled = yes
    destination = 192.168.1.107:19999
    api key = f47ac10b-58cc-4372-a567-0e02b2c3d479
EOF
```

Arrancar Netdata:

```bash
systemctl start netdata
```

El host empezará a enviar métricas al LXC 107 inmediatamente. En el dashboard de Netdata (`http://192.168.1.107:19999`) aparecerán dos nodos: `netdata` y `pve`.

## Acceso con DNS interno y SSL

Para acceder via `https://netdata.jelopez.link` el proceso es el mismo que con el resto de servicios internos:

1. **AdGuard Home** → Filtros → Reescrituras DNS → añadir `netdata.jelopez.link` → `192.168.1.103`
2. **NPMplus** → nuevo proxy host → `netdata.jelopez.link` → `http://192.168.1.107:19999` → certificado via Cloudflare DNS Challenge

## Integración con Uptime Kuma

La integración usa un monitor tipo **Push** en Uptime Kuma — en lugar de que Uptime Kuma compruebe si Netdata responde, es Netdata quien notifica activamente cuando algo falla.

### Crear el monitor Push en Uptime Kuma

En Uptime Kuma → **Añadir monitor** → tipo **Push** → nombre `Netdata Alertas`. Uptime Kuma genera una URL del tipo:

```
http://192.168.1.101:3001/api/push/XXXXXXXXXX?status=up&msg=OK&ping=
```

### Configurar las notificaciones en Netdata

En cada nodo que queremos que envíe alertas, crear el fichero de notificaciones:

```bash
cat > /etc/netdata/health_alarm_notify.conf << 'EOF'
SEND_CUSTOM=YES
DEFAULT_RECIPIENT_CUSTOM="http://192.168.1.101:3001/api/push/XXXXXXXXXX?status=up&msg=OK&ping="

custom_sender() {
    local status="${1}"
    local alarm="${2}"
    local info="${3}"

    if [ "${status}" = "CRITICAL" ] || [ "${status}" = "WARNING" ]; then
        curl -s "http://192.168.1.101:3001/api/push/XXXXXXXXXX?status=down&msg=${alarm}&ping=" > /dev/null
    else
        curl -s "http://192.168.1.101:3001/api/push/XXXXXXXXXX?status=up&msg=OK&ping=" > /dev/null
    fi
}
EOF

systemctl restart netdata
```

Sustituir `XXXXXXXXXX` por el token real generado por Uptime Kuma.

### Instalar curl si no está disponible

En un LXC Debian limpio curl puede no estar instalado:

```bash
apt install curl -y
systemctl restart netdata
```

### Configurar el heartbeat periódico

El monitor Push de Uptime Kuma espera recibir señales periódicas. Sin ellas marca el servicio como caído. Configurar un cron que envíe el heartbeat cada minuto:

```bash
echo "* * * * * root curl -s 'http://192.168.1.101:3001/api/push/XXXXXXXXXX?status=up&msg=OK&ping=' > /dev/null" >> /etc/crontab
```

### Probar la integración

Para verificar que todo funciona, forzar una alerta de prueba:

```bash
/usr/libexec/netdata/plugins.d/alarm-notify.sh test
```

Si la configuración es correcta, llegará una notificación a Telegram via Uptime Kuma.

## El resultado

Con esta configuración:

- **Netdata** monitoriza el host Proxmox y todos los LXCs con métricas en tiempo real
- **Uptime Kuma** recibe las alertas de Netdata via webhook
- **Telegram** notifica inmediatamente cuando algo supera los umbrales

La diferencia respecto a tener solo Uptime Kuma es que ahora no solo sabemos que un servicio ha caído — sabemos si fue por CPU al 100%, RAM llena o disco agotado antes de que ocurriera.