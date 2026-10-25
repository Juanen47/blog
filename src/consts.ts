export const SITE = {
  url: 'https://blog.jelopez.link',
  name: 'blog.jelopez.link',
  author: 'Juan Enrique López Monteagudo',
  email: 'juanenlopez1459@gmail.com',
  web: 'https://jelopez.link',
  github: 'https://github.com/Juanen47',
  linkedin: 'https://www.linkedin.com/in/juanen-lopez-monteagudo/',
};

export const SITE_TITLE = 'Blog de homelab, Proxmox y ciberseguridad · Juan Enrique López';
export const SITE_DESCRIPTION =
  'Guías prácticas de un administrador de sistemas: Proxmox, redes, Cloudflare Tunnel, WireGuard, servicios self-hosted y hardening, con la configuración real de mi homelab.';

// Autor para JSON-LD: el mismo Person que publica jelopez.link.
export const AUTHOR_LD = {
  '@type': 'Person',
  '@id': `${SITE.web}/#person`,
  name: SITE.author,
  url: SITE.web,
  jobTitle: 'Administrador de Sistemas y Redes',
  sameAs: [SITE.github, SITE.linkedin],
};
