---
pubDate: "2026-06-05"
title: 'Homarr — dashboard central del homelab'
tags: ["homelab", "homarr", "dashboard", "proxmox"]
description: "Qué es Homarr, cómo está instalado y cómo centraliza el acceso a todos los servicios del homelab desde un único panel."
---

Tener varios servicios corriendo en el homelab está bien, pero acceder a cada uno por IP y puerto es incómodo. Homarr resuelve eso — un dashboard centralizado desde el que acceder a todos los servicios, con integración nativa con Proxmox para ver el estado del servidor en tiempo real.

## Qué es Homarr

Homarr es un dashboard de código abierto diseñado para homelabs. Permite organizar los servicios en secciones, añadir enlaces con iconos y ver métricas del sistema directamente en la pantalla principal. Es ligero, fácil de configurar y tiene una interfaz limpia.

La diferencia respecto a simplemente guardar marcadores en el navegador es la integración — Homarr puede conectarse a Proxmox, mostrar el estado de los servicios en tiempo real y centralizar todo en un único punto de acceso.

## Instalación con ProxMenux

Como el resto de servicios del homelab, la instalación se hizo con **ProxMenux**, que despliega Homarr en un LXC dedicado (LXC 106, IP 192.168.1.106) en pocos minutos.

Una vez instalado, el dashboard es accesible en el puerto 7575 del LXC.

## Acceso interno con DNS y SSL

Homarr está accesible internamente via `https://hmrr.jelopez.link` — el mismo esquema que el resto de servicios internos:

1. **AdGuard Home** resuelve `hmrr.jelopez.link` a NPMplus (192.168.1.103)
2. **NPMplus** termina el SSL con certificado Let's Encrypt via Cloudflare DNS Challenge y reenvía al LXC de Homarr (192.168.1.106:7575)

Sin estar expuesto a Internet — solo accesible desde la LAN o via WireGuard.

## Integración con Proxmox

Una de las funciones más útiles es la integración nativa con Proxmox. Desde **Configuración → Integraciones → Proxmox** se introduce la URL del nodo (`https://192.168.1.100:8006`) y las credenciales, y Homarr muestra en tiempo real:

- Estado del nodo (`pve`) con CPU y RAM actuales
- Lista de VMs y LXCs con su estado

En el dashboard actual se ve el nodo `pve` con CPU al 1.4% y RAM al 21.8% — útil para tener de un vistazo si el servidor está bajo carga antes de lanzar algo nuevo.

## Organización del dashboard

El dashboard está organizado en tres secciones:

**Infraestructura** — los servicios base de la red:
- PVE (Proxmox) → `https://192.168.1.100:8006`
- NPMplus → `http://192.168.1.103:81`
- Router → IP del router
- Cloudflare → `https://dash.cloudflare.com`

**Seguridad & Red** — servicios de seguridad y acceso:
- Authelia → `https://auth.jelopez.link`
- AdGuard Home → `http://192.168.1.102:3000`
- WireGuard Dashboard → `http://192.168.1.100:10086`

**Monitorización** — servicios de seguimiento:
- Uptime Kuma → `https://status.jelopez.link`

## El resultado

Con Homarr como punto de entrada, no hay que recordar IPs ni puertos. Un marcador en el navegador que apunta a `hmrr.jelopez.link` da acceso a toda la infraestructura del homelab desde cualquier dispositivo de la LAN o via WireGuard desde fuera.