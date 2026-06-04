---
pubDate: 2026-06-01
title: 'El hardware del homelab y por qué elegí Proxmox'
tags: ["homelab", "proxmox", "hardware", "virtualizacion"]
description: "Qué máquina corre el homelab, cómo está organizada y por qué elegí Proxmox frente a un Debian con Docker directo."
---

Todo homelab empieza con una decisión de hardware. En mi caso la prioridad era clara: 
bajo consumo, silencioso y que cupiera en cualquier sitio. La elección fue un **Intel NUC** 
con procesador N150, 16 GB de RAM y 512 GB de almacenamiento. Compacto, eficiente y más 
que suficiente para lo que necesito.

## El hardware

| Componente | Detalle |
|---|---|
| **Equipo** | Intel NUC |
| **Procesador** | Intel N150 |
| **RAM** | 16 GB |
| **Almacenamiento** | 512 GB |

Un NUC es ideal para homelab doméstico — consume poco, no hace ruido y no ocupa espacio. 
Con 16 GB de RAM hay margen de sobra para correr varios servicios simultáneamente sin 
que el sistema se resienta.

## La red

El homelab corre sobre la conexión de fibra del hogar, con un router Movistar 
**Askey RTF8225VW** como punto de entrada. Es un router doméstico estándar — 
sin grandes alardes, pero cumple para lo que necesitamos.

La gestión del tráfico externo no depende del router más allá de un único puerto 
abierto: **UDP 51820** para WireGuard VPN. El acceso web a los servicios va por 
Cloudflare Tunnel, que establece una conexión saliente desde la LAN sin necesidad 
de abrir puertos adicionales.

Para el DNS interno uso AdGuard Home, que intercepta todas las consultas DNS 
de la red y resuelve los subdominios internos directamente sin salir a Internet.

## Proxmox vs Debian + Docker

La alternativa más habitual cuando montas un homelab es instalar Debian directamente 
y levantar los servicios con Docker. Funciona, pero yo opté por Proxmox por varias razones.

### Organización visual

Proxmox tiene una interfaz web desde la que gestionas toda la infraestructura — contenedores, 
máquinas virtuales, almacenamiento, red. De un vistazo ves qué está corriendo, cuántos 
recursos consume cada servicio y el estado general del sistema. Con Docker en Debian tienes 
que tirar de comandos o instalar herramientas adicionales para tener esa visibilidad.

### Snapshots y seguridad ante errores

Antes de tocar algo crítico, hago un snapshot. Si algo sale mal, restauro en segundos. 
Con Docker en Debian los snapshots no son tan inmediatos ni tan limpios — 
puedes hacer backups de volúmenes, pero no es lo mismo que congelar el estado completo 
de un contenedor LXC o una VM con un clic.

### LXC y VMs en el mismo sitio

Proxmox permite correr tanto contenedores LXC como máquinas virtuales completas. 
Los LXC son ligeros y perfectos para servicios como los que tengo montados. 
Las VMs permiten correr cualquier sistema operativo de forma aislada cuando lo necesitas. 
Con Debian + Docker solo tienes contenedores — si necesitas una VM tienes que añadir 
otra capa encima.

### Experiencia previa y confianza

No es un factor menor. En el trabajo ya hemos desplegado Proxmox para varios clientes, 
así que el entorno me es familiar. Montar el homelab con la misma herramienta me permite 
seguir ganando experiencia en algo que uso profesionalmente — cada cosa que aprendo 
en casa es aplicable en producción.

### Los scripts de la comunidad

ProxMenux es una colección de scripts de la comunidad que automatiza la instalación 
de servicios en Proxmox. En lugar de configurar cada LXC a mano, ejecutas un script 
y en minutos tienes el servicio listo. Ha sido clave para montar la infraestructura 
actual de forma rápida y limpia.

## Conclusión

Debian + Docker es una opción válida y muy extendida. Pero Proxmox ofrece más control, 
mejor organización y más flexibilidad sin añadir demasiada complejidad. 
Para un homelab que quieres mantener, escalar y del que quieres aprender, 
merece la pena el paso extra.

