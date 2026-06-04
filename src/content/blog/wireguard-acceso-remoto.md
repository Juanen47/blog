---
pubDate: 2026-06-01
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

El resultado es un LXC dedicado (LXC 100, IP 192.168.1.101) con WireGuard corriendo 
como servicio y el dashboard de gestión accesible internamente.

## WG Dashboard

WireGuard por sí solo se gestiona por línea de comandos o editando ficheros de 
configuración. **WG Dashboard** es una interfaz web que simplifica esa gestión — 
añadir y revocar clientes, ver conexiones activas, gestionar la configuración 
sin tocar la terminal.

Accesible en la LAN via `https://wg.jelopez.link` — protegido por NPMplus con 
certificado SSL válido, sin estar expuesto a Internet.

## El flujo completo

Cuando me conecto desde fuera:

1. Activo WireGuard en el dispositivo
2. El cliente conecta al router por UDP 51820
3. El router reenvía al LXC de WireGuard (192.168.1.101)
4. Obtengo una IP dentro de la LAN — acceso completo a 192.168.1.0/24
5. Puedo acceder a Proxmox, AdGuard, SSH a cualquier LXC, lo que necesite

Sin VPN activa, desde Internet no hay forma de llegar a nada de eso.

