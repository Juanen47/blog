---
pubDate: 2026-06-01
title: 'AdGuard Home — DNS interno y bloqueo de publicidad'
tags: ["homelab", "adguard", "dns", "privacidad"]
description: "Cómo funciona AdGuard Home en el homelab, qué hace exactamente y por qué es una de las piezas más útiles de la infraestructura."
---

Si tuviera que elegir un único servicio del homelab que más impacto tiene en el día a día, 
probablemente sería AdGuard Home. No es el más vistoso ni el más complejo, pero actúa 
silenciosamente en toda la red desde el momento en que arranca.

## Qué es AdGuard Home

AdGuard Home es un servidor DNS con capacidad de bloqueo de publicidad y rastreadores 
a nivel de red. Funciona interceptando todas las consultas DNS de los dispositivos 
conectados y filtrando las que apuntan a dominios conocidos de publicidad, telemetría 
o contenido malicioso.

La diferencia respecto a un bloqueador de navegador como uBlock Origin es el alcance: 
AdGuard Home protege todos los dispositivos de la red — móviles, Smart TVs, consolas, 
cualquier cosa conectada al WiFi — sin instalar nada en cada uno de ellos.

## Instalación con ProxMenux

Como el resto de servicios del homelab, la instalación se hizo con **ProxMenux**. 
Un script automatizado que despliega AdGuard Home en un LXC dedicado (LXC 102, 
IP 192.168.1.102) en pocos minutos. Sin configurar dependencias, sin tocar ficheros 
de configuración a mano.

Una vez instalado, el siguiente paso fue apuntar el DNS del router a la IP del LXC 
para que todos los dispositivos de la red lo usen automáticamente.

## Listas de bloqueo

AdGuard Home funciona con listas de dominios conocidos que se actualizan periódicamente. 
Las que tengo activas:

| Lista | Descripción | Reglas aprox. |
|---|---|---|
| **Steven Black Unified** | Publicidad, malware y rastreadores | ~100.000 |
| **OISD Big** | Lista amplia de dominios maliciosos | ~300.000 |

Con estas dos listas la mayoría de publicidad y rastreo queda bloqueado en toda la red 
sin configuración adicional por dispositivo.

## Reescrituras DNS internas

Una de las funciones más útiles para el homelab es la posibilidad de definir reescrituras 
DNS — básicamente, decirle a AdGuard que un dominio concreto resuelva a una IP local 
en lugar de salir a Internet.

Esto permite acceder a los servicios internos por nombre en lugar de por IP:

| Dominio | Resuelve a | Servicio |
|---|---|---|
| `wg.jelopez.link` | 192.168.1.103 | WireGuard Dashboard via NPMplus |
| `status.jelopez.link` | 192.168.1.103 | Uptime Kuma via NPMplus |
| `auth.jelopez.link` | 192.168.1.105 | Authelia |

Cuando un dispositivo de la LAN accede a `wg.jelopez.link`, AdGuard devuelve la IP 
de NPMplus directamente — el tráfico nunca sale a Internet, va directo al servicio local.

## Ajuste fino por dispositivo

AdGuard Home permite configurar reglas individuales por cliente. Útil cuando las listas 
de bloqueo son demasiado agresivas para algún dispositivo concreto — se puede desactivar 
el filtrado para una IP específica sin afectar al resto de la red.

## Acceso

AdGuard Home no está expuesto a Internet ni detrás de un proxy — se accede directamente 
por IP desde la LAN: `http://192.168.1.102:3000`. Para administración interna es 
más que suficiente.

