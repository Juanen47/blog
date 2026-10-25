---
pubDate: "2026-06-05"
title: 'Homarr — dashboard central del homelab'
tags: ["homelab", "homarr", "dashboard", "proxmox"]
description: "Qué es Homarr, cómo está instalado y cómo centraliza el acceso a todos los servicios del homelab desde un único panel."
---

> **Actualización (25/10/2026):** Homarr ya no forma parte del homelab. Lo he sustituido por un
> panel propio hecho en Python, que además de los accesos muestra datos detallados, lanza tareas y
> enseña los registros. Lo cuento en [Un panel propio para el homelab](/blog/panel-homelab-propio/).

Tener varios servicios corriendo en el homelab está bien, pero acceder a cada uno por IP y puerto es incómodo. Homarr resuelve eso — un dashboard centralizado desde el que acceder a todos los servicios, con integración nativa con Proxmox para ver el estado del servidor en tiempo real.

## Qué es Homarr

Homarr es un dashboard de código abierto diseñado para homelabs. Permite organizar los servicios en secciones, añadir enlaces con iconos y ver métricas del sistema directamente en la pantalla principal. Es ligero, fácil de configurar y tiene una interfaz limpia.

La diferencia respecto a simplemente guardar marcadores en el navegador es la integración — Homarr puede conectarse a Proxmox, mostrar el estado de los servicios en tiempo real y centralizar todo en un único punto de acceso.

## Instalación con ProxMenux

Como el resto de servicios del homelab, la instalación se hizo con **ProxMenux**, que despliega Homarr en un LXC dedicado en pocos minutos.

Una vez instalado, el dashboard es accesible directamente en un puerto del propio LXC.

## Acceso interno con DNS y SSL

Homarr está accesible internamente por un nombre propio con HTTPS (aquí, `panel.midominio.com` como ejemplo) — el mismo esquema que el resto de servicios internos:

1. **AdGuard Home** resuelve ese nombre a NPMplus
2. **NPMplus** termina el SSL con certificado Let's Encrypt via Cloudflare DNS Challenge y reenvía al LXC de Homarr

Sin estar expuesto a Internet — solo accesible desde la LAN o via WireGuard.

## Integración con Proxmox

Una de las funciones más útiles es la integración nativa con Proxmox. Desde **Configuración → Integraciones → Proxmox** se introduce la URL del nodo y las credenciales (mejor un usuario de solo lectura), y Homarr muestra en tiempo real:

- Estado del nodo (`pve`) con CPU y RAM actuales
- Lista de VMs y LXCs con su estado

En el dashboard actual se ve el nodo `pve` con CPU al 1.4% y RAM al 21.8% — útil para tener de un vistazo si el servidor está bajo carga antes de lanzar algo nuevo.

## Organización del dashboard

El dashboard está organizado en cuatro secciones:

**Infraestructura** — los servicios base de la red:
- PVE (Proxmox) → panel web del nodo
- NPMplus → panel de administración
- Router → panel del router
- Cloudflare → `https://dash.cloudflare.com`

**Seguridad & Red** — servicios de seguridad y acceso:
- AdGuard Home → panel de AdGuard
- WireGuard Dashboard → panel de WireGuard

**Monitorización** — servicios de seguimiento:
- Uptime Kuma → su nombre interno con HTTPS

**Nube & Datos** — servicios de uso personal:
- Nextcloud → su nombre interno con HTTPS

## El resultado

Con Homarr como punto de entrada, no hay que recordar IPs ni puertos. Un marcador en el navegador que apunta a Homarr da acceso a toda la infraestructura del homelab desde cualquier dispositivo de la LAN o via WireGuard desde fuera.