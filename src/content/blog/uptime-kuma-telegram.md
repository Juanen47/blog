---
pubDate: 2026-06-01
title: 'Uptime Kuma — monitorización con alertas a Telegram'
tags: ["homelab", "uptime-kuma", "monitoring", "telegram"]
description: "Cómo funciona Uptime Kuma en el homelab y cómo configurar las alertas a Telegram para saber en tiempo real si algo se cae."
---

De poco sirve tener servicios bien montados si no sabes cuándo se caen. 
Uptime Kuma resuelve eso — monitorización sencilla, visual y con notificaciones 
instantáneas cuando algo deja de responder.

## Qué es Uptime Kuma

Uptime Kuma es una herramienta de monitorización de código abierto con interfaz web. 
Permite crear monitores de diferentes tipos — ping, HTTP, HTTPS, certificados SSL — 
y configurar notificaciones cuando un servicio cae o se recupera.

Es ligero, fácil de configurar y tiene una interfaz limpia que muestra el estado 
de todos los servicios de un vistazo.

## Instalación

Como el resto de servicios, la instalación se hizo con ProxMenux en un LXC dedicado 
(LXC 101, IP 192.168.1.101).

## Monitores configurados

La estrategia de monitorización es simple: **ping** para verificar que cada LXC 
está vivo, y **HTTP(s) con palabra clave** para Nextcloud, que es el servicio que 
más me importa que funcione de verdad (no solo que el contenedor esté encendido).

| Monitor | Tipo | Host |
|---|---|---|
| AdGuard | Ping | 192.168.1.102 |
| NPMplus | Ping | 192.168.1.103 |
| Cloudflared | Ping | 192.168.1.104 |
| WireGuard | Ping | 192.168.1.100 |
| Nextcloud (web) | HTTP(s) - Palabra clave | `https://nube.jelopez.link/status.php` |
| Nextcloud (backend 107) | HTTP(s) - Palabra clave | `https://192.168.1.107/status.php` |

Los dos monitores de Nextcloud buscan `"maintenance":false` en la respuesta de 
`status.php`, así que también avisan si Nextcloud se queda en modo mantenimiento. 
Tener uno a través del proxy y otro directo al contenedor permite saber de un 
vistazo si el fallo está en NPMplus/DNS/certificado o en el propio Nextcloud.

Proxmox y el propio Uptime Kuma no se monitorizan — si Proxmox cae, todo cae 
con él, y Uptime Kuma no puede hacerse ping a sí mismo de forma útil.

## Notificaciones con Telegram

Uptime Kuma soporta decenas de métodos de notificación. El elegido fue Telegram 
por su inmediatez — llega al móvil al instante, sin depender de email ni de 
servicios de terceros de pago.

La configuración requiere un bot de Telegram y tu Chat ID:

**Crear el bot** — busca `@BotFather` en Telegram, envía `/newbot` y sigue 
los pasos. BotFather te dará un token.

**Obtener el Chat ID** — busca `@userinfobot`, envíale cualquier mensaje 
y te responde con tu ID numérico.

**Configurar en Uptime Kuma** — Settings → Notifications → Telegram, 
introduce el token y el Chat ID, y pulsa Test.

### El error más habitual

Al buscar el bot que acabas de crear en Telegram, es fácil confundirse con bots 
de nombre similar que no son el tuyo. Telegram tiene muchos bots con nombres 
parecidos y si envías el primer mensaje al bot equivocado, el tuyo nunca recibe 
ese mensaje inicial.

El resultado es un error `Bad Request: chat not found` al hacer el Test en 
Uptime Kuma — el bot no puede iniciar conversación con alguien que no le ha 
escrito primero. La solución es asegurarse de escribir al bot correcto 
(el que creaste tú con BotFather) antes de configurar nada.

### Un detalle importante

Cada monitor tiene que tener la notificación activada explícitamente. 
Existe la opción **Habilitado por defecto** en la configuración de la notificación — 
activarla hace que todos los monitores nuevos la hereden automáticamente, 
y **Aplicar en todos los monitores existentes** la aplica a los que ya tienes.

## El resultado

Con todo configurado, cualquier caída de servicio llega al móvil en segundos 
via Telegram. Sin tener que entrar a revisar el dashboard manualmente, 
sin enterarse por casualidad de que algo lleva horas caído.

