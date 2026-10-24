---
pubDate: 2026-06-01
title: 'NPMplus — reverse proxy con SSL interno'
tags: ["homelab", "npmplus", "nginx", "ssl", "proxy"]
description: "Qué es NPMplus, cómo está instalado en el homelab y cómo gestiona el SSL interno para los servicios de la LAN."
---

Con AdGuard Home resolviendo los dominios internos a una IP local, faltaba la otra 
mitad de la ecuación: algo que reciba esas peticiones HTTPS y las enrute al servicio 
correcto con un certificado SSL válido. Ese es el trabajo de NPMplus.

## Qué es NPMplus

NPMplus es un fork avanzado de Nginx Proxy Manager — una interfaz web para gestionar 
un reverse proxy Nginx sin tocar ficheros de configuración. Permite crear proxy hosts, 
gestionar certificados SSL con Let's Encrypt y configurar redirecciones, todo desde 
un panel visual.

La diferencia respecto al NPM original es que NPMplus incluye mejoras de rendimiento, 
soporte para más proveedores de DNS Challenge y actualizaciones más frecuentes.

## Para qué lo uso

En el homelab NPMplus tiene un rol concreto: **acceso interno LAN con SSL válido**.

Cuando accedo a la página de estado (por ejemplo `https://status.midominio.com`) desde dentro de casa, AdGuard resuelve 
el dominio a NPMplus, que termina el SSL y reenvía la petición 
al servicio real — en este caso Uptime Kuma.

Esto permite tener URLs limpias con candado verde para los servicios internos, 
sin que estén expuestos a Internet. El acceso externo va por Cloudflare Tunnel, 
completamente independiente de NPMplus.

## Instalación

La instalación se hizo con el script de la comunidad de Proxmox. En este caso 
la opción dentro de ProxMenux no funcionó correctamente, así que tiré directamente 
del script oficial:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/npmplus.sh)"
```

Este tipo de cosas pasan — los scripts de comunidad a veces tienen problemas 
puntuales con ciertas versiones o configuraciones. La solución suele ser ejecutar 
el script directamente en lugar de hacerlo a través del menú.

El resultado es un LXC dedicado con NPMplus y su panel web de administración.

## Certificados SSL con DNS Challenge

Para emitir certificados SSL válidos sin tener los puertos 80/443 abiertos en el router, 
NPMplus usa el método **DNS Challenge** de Let's Encrypt — en lugar de verificar 
el dominio por HTTP, verifica añadiendo un registro TXT temporal en el DNS.

Esto requiere un token de API del proveedor DNS. En este caso Cloudflare, 
ya que el dominio `jelopez.link` está registrado ahí. NPMplus instala automáticamente 
el plugin `certbot-dns-cloudflare` y gestiona la renovación cada 90 días sin intervención manual.

## Certificados en servicios externos

Para los servicios expuestos a Internet via Cloudflare Tunnel el SSL es diferente — 
Cloudflare lo gestiona automáticamente en su edge. No interviene NPMplus ni Let's Encrypt 
para esos servicios. El certificado que ve el usuario final lo emite Cloudflare, 
y la conexión entre Cloudflare y el servicio interno va por el túnel sin necesidad 
de certificado adicional.

En resumen: NPMplus gestiona el SSL interno (LAN), Cloudflare gestiona el SSL externo (Internet).

## Proxy hosts activos

| Servicio | Reenvía a | SSL |
|---|---|---|
| Uptime Kuma | LXC de Uptime Kuma (http) | Let's Encrypt / Cloudflare DNS |
| Homarr | LXC de Homarr (http) | Let's Encrypt / Cloudflare DNS |
| Nextcloud | LXC de Nextcloud (https, 443) | Let's Encrypt / Cloudflare DNS |

El WireGuard Dashboard ya no pasa por NPMplus: se accede por IP directa, 
porque el subdominio que usaba es ahora el endpoint de la VPN (DDNS).

## Una regla importante

Al configurar un proxy host en NPMplus, el scheme hacia el servicio interno 
debe ser siempre **http://**, nunca https://. NPMplus termina el TLS externamente 
y reenvía en claro internamente. Parece obvio pero es un error habitual que hace 
que el proxy no funcione.

La excepción es un servicio que solo escucha en HTTPS, como NextcloudPi: ahí el scheme 
tiene que ser **https://** hacia el puerto 443. Si lo dejas en http, el Apache de 
Nextcloud responde con un `400 Bad Request` porque le están hablando HTTP plano a 
su puerto TLS. Lo cuento en el post de [Nextcloud](/blog/nextcloud-nube-personal/).

## Acceso

NPMplus se administra directamente por IP desde la LAN. 
No está detrás de ningún proxy — intentarlo genera un bucle de redirecciones 
que impide acceder. IP directa y listo.

