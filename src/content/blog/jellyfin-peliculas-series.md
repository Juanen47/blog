---
pubDate: "2026-10-26"
title: 'Jellyfin — películas y series en el homelab, compartiendo carpeta con Nextcloud'
tags: ["homelab", "jellyfin", "nextcloud", "proxmox", "lxc"]
description: "Cómo he montado Jellyfin en un LXC con la gráfica del NUC, leyendo la misma carpeta del SSD externo que Nextcloud usa para subir los archivos, cómo he repartido el disco y los tres tropiezos del camino."
---

Tenía algunas películas y capítulos sueltos repartidos entre el PC y discos viejos, y quería
tenerlos en un sitio y poder verlos desde el móvil o la tele sin andar copiando archivos. El
homelab ya tenía [Nextcloud](/blog/nextcloud-nube-personal/) y un SSD externo de 2 TB casi
vacío, así que había dos opciones:

1. **Una carpeta en Nextcloud**. Sencillo, pero Nextcloud es una nube de archivos, no un
   reproductor: sin carátulas, sin «seguir viendo» y sin transcodificar si el móvil no
   soporta el formato.
2. **Jellyfin**, un servidor multimedia de código abierto (como Plex, pero sin cuentas
   externas ni suscripciones), en su propio contenedor.

Al final, las dos a la vez: **una sola carpeta en el SSD** que Nextcloud usa para subir los
archivos y Jellyfin para reproducirlos.

## Primero, repartir el disco

El SanDisk ya hacía dos trabajos: los backups diarios de Proxmox y los datos de Nextcloud.
Meter películas ahí sin pensar es la forma más rápida de acabar con un backup fallido por falta
de sitio. Así que, antes de nada, un reparto de los 1,8 TB útiles:

| Uso | Reserva |
|---|---|
| Backups (vzdump) | 300 GB |
| Nextcloud | 500 GB |
| Películas y series | 800 GB |
| Colchón libre | 200 GB |

El colchón no es capricho: ext4 empieza a ir peor por encima del 90 % y así un backup nunca
se queda sin sitio. Las cuotas por carpeta en ext4 obligan a desmontar el disco, así que en
lugar de un límite duro hay un **aviso**: un script diario en el host que hace ping a
[Healthchecks.io](https://healthchecks.io) y lo marca en fallo si el disco pasa del 75 % o la
carpeta de películas de 800 GB.

Y una decisión consciente: **las películas no entran en los backups** ni entrarán en la futura
copia fuera de casa. Si el SSD muere, se pierden, pero son reemplazables. Lo que no se puede
reponer son las copias y los archivos de Nextcloud.

## La carpeta compartida

En el host, una carpeta propia fuera de los datos de Nextcloud:

```bash
mkdir -p /mnt/usb2tb/media/{Peliculas,Series}
chown -R 100033:100033 /mnt/usb2tb/media
chmod 755 /mnt/usb2tb/media /mnt/usb2tb/media/*
```

Pertenece al UID 100033, que es el `www-data` de Nextcloud visto desde el host (los
contenedores *unprivileged* desplazan los UID 100000). Con permisos 755, cualquier otro
contenedor puede leerla pero solo Nextcloud puede escribir.

## Jellyfin en un LXC

Un contenedor Debian 13 *unprivileged* pequeño: 2 vCPU, 2 GB de RAM y 8 GB de disco, que solo
guarda la configuración y los metadatos. La carpeta se monta **en solo lectura**:

```bash
pct set <ID> -mp0 /mnt/usb2tb/media,mp=/media,ro=1,backup=0
```

Jellyfin no necesita escribir en las películas, así que no le doy la opción. Se instala desde
su repositorio oficial para Debian, y el SSH del contenedor queda desactivado, como en el
resto: se entra con `pct enter`.

### La gráfica del NUC

El NUC tiene gráfica integrada de Intel, y Jellyfin puede usarla con **Quick Sync** para
convertir el vídeo al vuelo cuando el dispositivo no soporta el formato original. Sin ella, una
sola conversión a 1080p se come la CPU. En un contenedor *unprivileged* basta con pasarle el
dispositivo de render con el grupo correcto:

```bash
GID=$(pct exec <ID> -- getent group render | cut -d: -f3)
pct exec <ID> -- usermod -aG render jellyfin
pct set <ID> --dev0 /dev/dri/renderD128,gid=$GID
```

Después, en Jellyfin, *Panel de control → Reproducción → Transcodificación*: aceleración
**Intel QuickSync (QSV)** y decodificación por hardware para H264, HEVC y VP9. Ojo, que está en
el panel de control del servidor, no en los ajustes de reproducción del usuario. Yo empecé
buscándolo en el sitio equivocado.

## Nextcloud: la misma carpeta como almacenamiento externo

Para subir archivos, la misma carpeta se monta también en el contenedor de Nextcloud:

```bash
pct set <ID de Nextcloud> -mp1 /mnt/usb2tb/media,mp=/mnt/media,backup=0
```

Y se añade como **almacenamiento externo local** (app `files_external`), visible solo para mi
usuario:

```bash
occ() { sudo -u www-data php /var/www/nextcloud/occ "$@"; }
occ app:enable files_external
occ files_external:create /Multimedia local null::null -c datadir=/mnt/media
occ files_external:applicable --add-user=<usuario> <id del montaje>
occ files_external:option <id del montaje> filesystem_check_changes 1
```

La última línea hace que Nextcloud compruebe cambios en cada acceso, porque la carpeta también
existe fuera de él.

Ahora subo una película desde el navegador, el iPhone o el PC a *Multimedia/Peliculas*, y
Jellyfin la encuentra en unos minutos con su carátula y su ficha.

### Cómo nombrar los archivos

Jellyfin identifica las cosas por el nombre, así que merece la pena seguir su convención desde
el principio:

```text
Peliculas/Origen (2010)/Origen (2010).mkv
Peliculas/Origen (2010)/Origen (2010).es.srt
Series/Breaking Bad (2008)/Season 01/Breaking Bad S01E01.mkv
```

Una carpeta por película con el año, `Season 01` en las series y `SxxEyy` en cada capítulo.

## Acceso: igual que el resto

Jellyfin **no se publica en Internet**: en casa estoy en la LAN y fuera tengo
[WireGuard](/blog/wireguard-acceso-remoto/). Para tener un nombre con certificado válido,
el mismo patrón de siempre:

1. **AdGuard Home**: reescritura `cine.midominio.com` → IP de NPMplus (el nombre es de ejemplo).
2. **NPMplus**: proxy host hacia `http://<IP de Jellyfin>:<puerto de Jellyfin>`, con certificado de
   Let's Encrypt por DNS challenge de Cloudflare. En *Advanced*, `proxy_buffering off;` para
   que el vídeo no se trabe. NPMplus no tiene interruptor de websockets: van siempre activos.
3. **Jellyfin**: en *Panel de control → Redes*, la IP de NPMplus en «Proxies conocidos», para
   que vea la IP real de cada dispositivo.

Y en el [panel del homelab](/blog/panel-homelab-propio/), una tarjeta nueva con el número de
películas, series y capítulos y quién está viendo qué en ese momento (y si se está
transcodificando).

## Los tropiezos

Nada salió a la primera, y los tres errores son de los que se repiten:

**La plantilla equivocada.** El script buscaba la plantilla `debian-13-standard` más reciente
y cogió la de **arm64**. El contenedor se creó, pero no arrancó (`Failed to spawn container`).
Hay que filtrar por arquitectura: `debian-13-standard_.*_amd64`.

**El comando que no estaba.** NextcloudPi tiene un atajo `ncc` para `occ`, pero no existe al
entrar con `pct exec`. Llamar a `occ` directamente con el usuario `www-data` funciona
siempre.

**El 502 de un dígito.** El proxy devolvía 502, y Jellyfin respondía bien desde el host y
desde el propio NPMplus. El log del contenedor de NPMplus lo dejó claro:

> connect() failed (111: Connection refused) while connecting to upstream,
> upstream: "http://<IP de Jellyfin>:<puerto equivocado>/"

Había bailado **un dígito del puerto** en el proxy host. Igual que con el error de los 8.192 bytes de
Nextcloud, la respuesta estaba en el log del servidor.

Y un detalle del cliente de escritorio de Nextcloud: **no sincroniza un almacenamiento externo
nuevo hasta que se lo confirmas**. La carpeta *Multimedia* no aparecía en el Explorador de
Windows hasta aceptar el aviso del cliente (o marcarla en «Elegir qué sincronizar»). Con los
archivos virtuales activados, aparece sin ocupar espacio, y tras subir algo, «Liberar espacio»
lo quita del portátil.

## Resultado

- Una carpeta, dos usos: Nextcloud para subir y Jellyfin para ver.
- Transcodificación por hardware con la gráfica del NUC.
- Solo LAN y VPN, con certificado válido y sin cuentas de terceros.
- Un reparto del disco que protege los backups y un aviso antes de que haga falta.
