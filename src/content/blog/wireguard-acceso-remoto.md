---
pubDate: "2026-06-01"
title: 'WireGuard — acceso remoto seguro a la LAN'
tags: ["homelab", "wireguard", "vpn", "proxmox"]
description: "Qué es WireGuard, cómo está instalado en el homelab y para qué lo uso realmente."
---

Tener servicios en casa está muy bien, pero tarde o temprano necesitas acceder a ellos
desde fuera. Para eso está WireGuard — una VPN moderna, rápida y sorprendentemente simple
de configurar comparada con alternativas clásicas como OpenVPN.

## Qué es WireGuard

WireGuard es un protocolo VPN de código abierto que destaca por tres cosas: velocidad,
simplicidad y seguridad. Su código base es considerablemente más pequeño que el de OpenVPN
o IPSec, lo que facilita su auditoría y reduce la superficie de ataque.

A diferencia de una VPN comercial que enruta todo tu tráfico por un servidor externo,
aquí WireGuard hace algo diferente — te mete dentro de tu propia red local como si
estuvieras en casa. Acceso completo a cualquier IP, cualquier puerto, cualquier servicio
de la LAN.

## Para qué lo uso

El caso de uso es claro: acceder a la infraestructura del homelab desde cualquier sitio.

Cuando estoy fuera y necesito entrar a Proxmox, a AdGuard, hacer SSH a un LXC o
administrar cualquier servicio interno, activo WireGuard en el móvil o en el portátil
y en segundos estoy dentro de la LAN como si estuviera en casa. Sin exponer nada
a Internet, sin port forwarding innecesario.

Es también la razón por la que el único puerto abierto en el router es el **UDP 51820** —
todo lo demás va por Cloudflare Tunnel o por WireGuard. Superficie de ataque mínima.

Otro caso de uso interesante es el acceso a servicios que limitan el uso fuera
de la red doméstica. Algunas plataformas de streaming como Movistar+ restringen
el número de dispositivos que pueden conectarse desde fuera del hogar.
Con WireGuard activo, el tráfico sale desde tu propia red — para esas plataformas
sigues estando en casa.

## Instalación con ProxMenux

La instalación se hizo mediante **ProxMenux**, una colección de scripts de la comunidad
para Proxmox que automatiza el despliegue de servicios en contenedores LXC. En lugar
de configurar WireGuard a mano — generar claves, editar ficheros de configuración,
gestionar dependencias — el script lo hace todo en pocos minutos.

El resultado es un LXC dedicado (LXC 100, IP 192.168.1.100) con WireGuard corriendo
como servicio y el dashboard de gestión accesible internamente.

## WG Dashboard

WireGuard por sí solo se gestiona por línea de comandos o editando ficheros de
configuración. **WG Dashboard** es una interfaz web que simplifica esa gestión —
añadir y revocar clientes, ver conexiones activas, gestionar la configuración
sin tocar la terminal.

Accesible internamente via IP directa `http://192.168.1.100:10086` — el acceso por
`wg.jelopez.link` se eliminó porque el registro A de ese subdominio lo usa el DDNS
para el endpoint externo de WireGuard, y tenerlo también como reescritura DNS interna
generaba conflictos.

## IP dinámica y DDNS

El acceso externo por WireGuard depende de que el cliente sepa a qué IP conectarse.
El problema es que la IP pública de una conexión doméstica es dinámica — puede cambiar
en cualquier momento.

La solución es un script DDNS que actualiza automáticamente el registro A de
`wg.jelopez.link` en Cloudflare cada vez que la IP cambia. El script corre en el
propio LXC de WireGuard (LXC 100) y usa la API de Cloudflare:

```bash
#!/bin/bash
API_TOKEN="tu_api_token"
ZONE_ID="5c1dbd9e63b53be8648f249a55f778f9"
RECORD_NAME="wg.jelopez.link"

IP=$(curl -s https://ifconfig.me)
RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=A&name=$RECORD_NAME" \
  -H "Authorization: Bearer $API_TOKEN" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"$RECORD_NAME\",\"content\":\"$IP\",\"ttl\":60,\"proxied\":false}"
```

El script se instala en `/usr/local/bin/ddns-cloudflare.sh` y se ejecuta cada 5 minutos
mediante cron:

```bash
*/5 * * * * /usr/local/bin/ddns-cloudflare.sh
```

Algunos detalles importantes:

- El registro A en Cloudflare debe estar en modo **DNS only** (nube gris, no proxied) —
  WireGuard usa UDP y Cloudflare solo hace proxy de HTTP/HTTPS. Con el proxy activado
  el túnel no funciona.
- El TTL se configura a 60 segundos para que los cambios de IP propaguen lo más rápido posible.
- El token de API se crea desde **My Profile → API Tokens** con la plantilla
  **Edit zone DNS** limitado a `jelopez.link`. No usar el Global API Key.

## El flujo completo

Cuando me conecto desde fuera:

1. Activo WireGuard en el dispositivo
2. El cliente resuelve `wg.jelopez.link` — DDNS garantiza que siempre apunta a la IP actual
3. El cliente conecta al router por UDP 51820
4. El router reenvía al LXC de WireGuard (192.168.1.100)
5. Obtengo una IP dentro de la LAN — acceso completo a 192.168.1.0/24
6. Puedo acceder a Proxmox, AdGuard, SSH a cualquier LXC, lo que necesite

Sin VPN activa, desde Internet no hay forma de llegar a nada de eso.