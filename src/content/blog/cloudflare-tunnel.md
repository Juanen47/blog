---
pubDate: 2026-06-01
title: 'Cloudflare Tunnel — exposición segura sin abrir puertos'
tags: ["homelab", "cloudflare", "tunnel", "seguridad", "networking"]
description: "Por qué migré a Cloudflare y cómo el túnel Cloudflared permite exponer servicios a Internet sin abrir un solo puerto en el router."
---

Cuando monté el homelab por primera vez, el acceso externo funcionaba como en la mayoría 
de casos: puerto 443 y 80 abiertos en el router, NPMplus recibiendo el tráfico y 
enrutándolo internamente. Funciona, pero tiene un problema evidente — estás exponiendo 
tu IP pública directamente a Internet con puertos abiertos permanentemente.

La solución fue migrar a Cloudflare y usar su servicio de túneles.

## Por qué Cloudflare

La decisión de registrar el dominio `jelopez.link` en Cloudflare en lugar de otro 
registrador fue por varias razones:

- **Precio** — Cloudflare vende dominios a precio de coste, sin margen. Un `.link` 
  sale por unos 7$ al año.
- **Servicios integrados** — DNS, CDN, protección DDoS, túneles, Workers, Pages... 
  todo en el mismo sitio.
- **Seguridad** — la IP pública queda oculta detrás de los servidores de Cloudflare. 
  Nadie sabe que hay un servidor doméstico detrás.
- **Gestión DNS** — el panel de Cloudflare es cómodo y la propagación es casi instantánea.

## Qué es Cloudflare Tunnel

Cloudflare Tunnel es un servicio que permite exponer servicios locales a Internet 
sin abrir puertos en el router. El mecanismo es el opuesto al modelo tradicional:

- **Modelo tradicional**: abres puertos en el router → Internet entra a tu red
- **Cloudflare Tunnel**: tu red establece una conexión saliente hacia Cloudflare → 
  Cloudflare enruta el tráfico por esa conexión

El resultado es que desde Internet solo ves los servidores de Cloudflare. 
Tu IP real nunca aparece, y no hay ningún puerto abierto que atacar.

## Instalación

El túnel se gestiona desde **Cloudflare Zero Trust** → Networks → Tunnels. 
Se crea el túnel, se le da un nombre (en este caso `Homelab`) y Cloudflare 
genera un token único para el conector.

El conector es `cloudflared` — un daemon que corre en un LXC dedicado 
(LXC 104, IP 192.168.1.104) y mantiene la conexión saliente hacia Cloudflare. 
La instalación en Debian 12 se hace añadiendo el repositorio oficial de Cloudflare:

```bash
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | tee /etc/apt/sources.list.d/cloudflared.list
apt-get update && apt-get install cloudflared
cloudflared service install <TOKEN>
systemctl start cloudflared
```

Un detalle importante: hay que instalar `curl` antes de ejecutar el comando 
de la GPG key — en un LXC Debian limpio no viene instalado por defecto y el 
comando falla silenciosamente sin él.

## Rutas publicadas

Una vez el conector está activo y aparece como **Healthy** en el dashboard, 
se configuran las rutas — qué subdominio apunta a qué servicio interno:

| Subdominio | Servicio interno | Notas |
|---|---|---|
| `auth.jelopez.link` | 192.168.1.105:9091 | Authelia — portal de autenticación |

Cloudflare crea automáticamente el registro DNS para cada ruta configurada. 
Sin tocar el panel de DNS manualmente.

## El resultado

Con el túnel activo, los puertos 80 y 443 del router están cerrados. 
El único puerto abierto es el **UDP 51820** de WireGuard, que es inevitable 
para la VPN. Todo el tráfico web externo entra por el túnel — sin IP expuesta, 
sin superficie de ataque innecesaria.

Cualquier servicio que quiera publicar en el futuro solo requiere añadir 
una ruta nueva en el dashboard de Cloudflare. Sin tocar el router, sin abrir puertos.

## Una advertencia importante

El token de `cloudflared` es una credencial sensible. Quien lo tenga puede 
conectar un conector al túnel y enrutar tráfico. Hay que tratarlo como una contraseña — 
no compartirlo, no pegarlo en chats, y si se expone accidentalmente, 
eliminarlo inmediatamente desde el dashboard de Cloudflare y generar uno nuevo.

