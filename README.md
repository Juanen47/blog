# blog.jelopez.link

Blog técnico del homelab de Juan Enrique López Monteagudo: Proxmox, redes, servicios self-hosted y seguridad.

- **Stack:** Astro 6 + MDX, sitemap y RSS. Sin frameworks de CSS: estilos en `src/styles/global.css` y en cada componente.
- **Despliegue:** Cloudflare Pages, automático en cada push a `master`.
- **Fuentes:** servidas desde el propio dominio con Fontsource (`src/styles/fonts.css`), sin Google Fonts.
- **Comentarios:** Giscus (GitHub Discussions de este repo), cargado solo cuando el lector pulsa «Cargar comentarios».
- **Cabeceras:** CSP, HSTS y caché en `public/_headers`. Los scripts nunca se incrustan en el HTML (`assetsInlineLimit: 0`) porque la CSP no permite scripts inline.

## Publicar un artículo

Crea `src/content/blog/<slug>.md` (o `.mdx`). La URL será `/blog/<slug>/`.

```yaml
---
title: 'Título del artículo'
description: 'Una o dos frases: es lo que sale en Google y al compartir el enlace.'
pubDate: 2026-10-20
updatedDate: 2026-10-25   # opcional
tags: ["homelab", "proxmox"]
heroImage: ../../assets/mi-imagen.jpg   # opcional, también se usa al compartir
draft: true               # opcional: no se publica hasta quitarlo
---
```

Las etiquetas generan sus páginas en `/etiquetas/<etiqueta>/`. Reutiliza las existentes (`homelab`, `seguridad`, `proxmox`, `networking`...) para que se agrupen.

## Comandos

| Comando           | Acción                                      |
| :---------------- | :------------------------------------------ |
| `npm install`     | Instala las dependencias                    |
| `npm run dev`     | Servidor local en `localhost:4321`          |
| `npm run build`   | Genera el sitio en `./dist/`                |
| `npm run preview` | Sirve `./dist/` para revisarlo antes de subir |

Si añades un servicio externo (analítica, un iframe, un script), amplía la CSP en `public/_headers` y menciónalo en `src/pages/privacidad.astro`.
