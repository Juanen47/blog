---
pubDate: 2026-05-31T21:03:37+02:00
title: 'Homelab Arquitectura'
tags: ["homelab", "proxmox", "cloudflare"]
description: "Cómo monté mi homelab desde cero con Proxmox, Cloudflare Tunnel y Authelia."
---

Este es el primer post del blog, donde describo la arquitectura del homelab que estoy montando.

## Qué tenemos montado

- **Proxmox VE** como hipervisor con contenedores LXC
- **WireGuard** para acceso VPN remoto
- **AdGuard Home** como DNS interno con listas de bloqueo
- **NPMplus** como reverse proxy con SSL interno
- **Cloudflare Tunnel** para exponer servicios sin abrir puertos
- **Authelia** para autenticación MFA en servicios externos
- **Uptime Kuma** para monitorización con alertas a Telegram

## Próximamente

Iré documentando cada componente en detalle con el proceso de instalación y configuración.

