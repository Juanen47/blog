---
pubDate: "2026-11-02"
title: 'Copia fuera de casa — restic cifrado en Cloudflare R2, por 0 €'
tags: ["homelab", "backup", "restic", "cloudflare", "proxmox", "nextcloud"]
description: "Cómo he sacado de casa los datos de Nextcloud y las copias de los contenedores: restic cifrado en Cloudflare R2 dentro del plan gratuito, con retención, verificación mensual, avisos y una restauración probada."
series: "El homelab desde cero"
seriesOrder: 12
---

Hasta hoy, el homelab tenía un fallo de base que llevaba arrastrando desde que monté
[Nextcloud](/blog/nextcloud-nube-personal/): **todo estaba en el mismo SSD externo, en la misma
casa**. Los backups diarios de Proxmox, los datos de Nextcloud y las películas. Si el disco se
moría, o pasaba algo en casa, no quedaba nada. Por eso no había cancelado iCloud.

La regla clásica es la **3-2-1**: tres copias, en dos soportes distintos, una fuera de casa.
Me faltaba la última, y además quería que no costara dinero.

## Qué hay que sacar de casa (y qué no)

Antes de elegir proveedor, medir. No todo merece salir:

| Qué | ¿Sale de casa? | Por qué |
|---|---|---|
| Archivos de Nextcloud | Sí, a diario | Es lo único que no se puede reponer |
| Base de datos y configuración de Nextcloud | Sí, a diario | Sin ellas, los archivos son una carpeta suelta |
| Configuración del host (`/etc`, `/root`) | Sí, a diario | Ocupa poco y ahorra horas si hay que reinstalar |
| Copia completa de cada contenedor | Sí, una vez por semana | Ya hay 7 diarias en casa; fuera basta con la última |
| Miniaturas de Nextcloud | No | Se regeneran solas |
| Películas y series | No | Son reemplazables y ocupan cientos de GB |

Con eso, todo cabía en **unos pocos GB**. Y eso cambia por completo la elección de proveedor.

## Dónde: R2 frente a B2 y Hetzner

| Opción | Coste para pocos GB | Notas |
|---|---|---|
| Cloudflare R2 | **0 €** hasta 10 GB | Descargar para restaurar también es gratis. Ya usaba Cloudflare para el dominio |
| Backblaze B2 | 0 € hasta 10 GB | Luego ~6 $/TB al mes; la descarga tiene límites |
| Hetzner Storage Box | ~4 €/mes fijos | 1 TB; compensa con muchos datos (fotos, por ejemplo) |

Me quedé con **R2**, en un bucket con **jurisdicción UE** y sin acceso público. El token que
usa el servidor solo puede leer y escribir objetos en ese bucket: si alguien lo roba, no puede
tocar nada más de la cuenta. Y si algún día paso de 10 GB, cambiar de destino es cambiar una
línea.

> ⚠ Un detalle que me habría costado un rato: con jurisdicción UE, el endpoint S3 lleva
> `.eu.` (`<cuenta>.eu.r2.cloudflarestorage.com`). Con el endpoint normal, el bucket «no existe».

## Por qué restic

[restic](https://restic.net) cifra **en el servidor, antes de subir nada**: Cloudflare solo ve
bloques cifrados con nombres aleatorios. Además deduplica (lo que no cambia no se vuelve a
subir), comprime, habla S3 de serie y está en los repositorios de Debian, así que en el host de
Proxmox es un `apt install restic`.

La parte importante: **la contraseña del repositorio vive en el servidor y en mi gestor de
contraseñas**. Si se pierde, la copia es basura cifrada. Por eso el script de instalación la
genera, la muestra una sola vez y no sigue hasta que la guardas.

## La copia de cada noche

Un script en el host, lanzado por cron a las 05:30, cuando ya ha terminado el backup diario de
Proxmox (y si no ha terminado, espera). Resumido:

```bash
# 1. Volcado coherente de la base de datos de Nextcloud
pct exec <ct-nextcloud> -- mysqldump --single-transaction nextcloud > /var/backups/offsite/nextcloud-db.sql

# 2. Datos de cada día, sin miniaturas
restic backup --tag datos \
  --exclude '/mnt/usb2tb/nextcloud/ncdata/data/appdata_*/preview' \
  /mnt/usb2tb/nextcloud /var/backups/offsite /etc /root

# 3. Los domingos, la copia más reciente de cada contenedor
restic backup --tag cts /mnt/usb2tb/vzdump/dump/<la última de cada CT>.tar.zst

# 4. Retención y limpieza
restic forget --tag datos --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune
restic forget --tag cts   --keep-last 2 --prune
```

¿Por qué las copias de los contenedores solo los domingos? Porque Proxmox las guarda ya
**comprimidas con zstd**, y un fichero comprimido cambia entero de un día a otro: restic no
puede deduplicarlo. Subirlas a diario llenaría los 10 GB en una semana. Una por semana, y solo
las dos últimas, es suficiente para reconstruir el servidor; para los archivos de Nextcloud,
que sí deduplican bien, hay historial diario.

## Que avise si algo va mal

Una copia que falla en silencio es peor que no tener copia, porque te da falsa tranquilidad.
El script avisa a [Healthchecks.io](https://healthchecks.io), igual que el backup de Proxmox:

- Al empezar envía `start`, y al terminar `OK` o `fail`, **con la salida completa en el
  cuerpo**: si algo falla, el motivo llega en el propio aviso.
- Si un día no llega ningún ping (el servidor apagado, el cron roto…), Healthchecks avisa igual
  a las 3 horas.
- Si lo ocupado en R2 pasa de **9 GB**, lo marca como fallo antes de salir del plan gratuito.
- El día 1 de cada mes, `restic check --read-data-subset=10%` descarga y verifica una parte de
  lo subido. Como la descarga en R2 es gratis, no cuesta nada.

## Probar la restauración

Un backup que nunca has restaurado no es un backup. El script de instalación termina
descargando de R2 un par de ficheros (uno del sistema y el volcado de la base de datos) y los
compara byte a byte con los originales:

```bash
restic restore latest --tag datos --target /tmp/prueba-restore \
  --include /etc/hostname --include /var/backups/offsite/nextcloud-db.sql
cmp /etc/hostname /tmp/prueba-restore/etc/hostname && echo "RESTAURACIÓN OK"
```

Salió `RESTAURACIÓN OK` a la primera. Si un día pierdo el servidor entero, me basta con un
Debian cualquiera, `restic`, las claves del token y la contraseña: listo las copias, restauro
los archivos de Nextcloud y las copias de los contenedores, y con `pct restore` vuelven a
arrancar.

> ℹ Curiosidad: nada más subir la primera copia, el panel de R2 marca el bucket con **0 B**.
> No es que falle: las métricas de almacenamiento tardan unas horas en actualizarse. La cifra
> real te la da `restic stats`.

## Coste final

| Concepto | Coste |
|---|---|
| Almacenamiento R2 (por debajo de 10 GB) | 0 € |
| Operaciones (cientos al día de 1 millón al mes) | 0 € |
| Descargas para restaurar | 0 € |
| restic y Healthchecks.io | 0 € |

Ahora sí: tres copias (el original, el backup diario en el SSD externo y la copia en R2), en
dos soportes, una fuera de casa. Lo siguiente es vigilar la salud de los discos para enterarme
**antes** de que fallen, no después.
