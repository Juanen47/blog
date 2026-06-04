---
pubDate: 2026-05-31
title: 'Arquitectura de red del homelab — WAN y LAN'
tags: ["homelab", "cloudflare", "wireguard", "networking", "proxmox"]
description: "Cómo evolucionó el acceso externo del homelab: del port forwarding clásico con NPMplus a un túnel Cloudflare sin puertos abiertos, y cómo fluye el tráfico interno en la LAN."
---

Una de las partes más importantes de cualquier homelab es entender cómo fluye el tráfico — tanto desde Internet hacia tus servicios, como dentro de tu propia red local. En este post explico la arquitectura actual del mío y cómo llegué hasta aquí.

## El setup inicial — NPMplus y port forwarding

Al principio el acceso externo funcionaba como en la mayoría de homelabs: abrir puertos en el router y usar un reverse proxy (NPMplus) que recibía el tráfico y lo enrutaba al servicio correcto.

El flujo era el siguiente:

1. El usuario accede a `wg.juanenlopez.es` desde Internet
2. El DNS resuelve a la IP pública del router
3. El router reenvía los puertos 443 y 80 a NPMplus (192.168.1.103)
4. NPMplus termina el SSL y reenvía al servicio interno

Funcionaba, pero tenía dos problemas claros: la IP pública es dinámica (si cambia, el servicio deja de funcionar hasta actualizar el DNS) y los puertos 80 y 443 estaban abiertos permanentemente en el router, exponiendo la infraestructura directamente a Internet.

## El setup actual — Cloudflare Tunnel

La solución fue migrar a un túnel de Cloudflare. La diferencia fundamental es que ahora **no hay ningún puerto abierto en el router** para el tráfico web. En su lugar, un contenedor LXC dedicado (`cloudflared`) mantiene una conexión saliente permanente hacia Cloudflare.

El nuevo flujo es:

1. El usuario accede a cualquier subdominio de `jelopez.link`
2. Cloudflare recibe el tráfico en su red global
3. Lo enruta por el túnel hasta el contenedor `cloudflared` de la LAN
4. `cloudflared` lo pasa al servicio correspondiente

Ventajas respecto al setup anterior:
- Sin puertos abiertos — la IP pública queda completamente oculta
- Sin problema de IP dinámica — el túnel no depende de la IP del router
- SSL gestionado automáticamente por Cloudflare — sin certbot ni APIs de IONOS
- Authelia delante de cualquier servicio expuesto — MFA obligatorio

## WireGuard — acceso completo a la LAN

Para administrar la infraestructura de forma remota (Proxmox, SSH a los LXC, servicios no expuestos por el túnel) uso WireGuard VPN. Este sí requiere un puerto abierto en el router (UDP 51820), pero es el único.

La diferencia con el túnel de Cloudflare es el alcance: el túnel solo da acceso a los servicios que explícitamente publicas. WireGuard te mete dentro de la LAN como si estuvieras en casa — acceso total a cualquier IP y puerto.

## El flujo interno — AdGuard y NPMplus

Desde dentro de la LAN el tráfico funciona de forma diferente. Los dispositivos de la red usan AdGuard Home como DNS, que tiene reescrituras para los subdominios internos:

- `wg.jelopez.link` → 192.168.1.103 (NPMplus)
- `status.jelopez.link` → 192.168.1.103 (NPMplus)
- `auth.jelopez.link` → 192.168.1.106 (Authelia directo)

Así el tráfico interno nunca sale a Internet — va directamente a NPMplus, que termina el SSL y reenvía al servicio. Para los servicios de administración (Proxmox, AdGuard, NPMplus) el acceso es directamente por IP y puerto, sin pasar por ningún proxy.

## El diagrama completo

{{< rawhtml >}}
<svg width="100%" viewBox="0 0 680 820" role="img" xmlns="http://www.w3.org/2000/svg">
  <title>Arquitectura de red del homelab</title>
  <desc>Diagrama comparativo del setup anterior con NPMplus y port forwarding, y el setup actual con Cloudflare Tunnel, mostrando los flujos de tráfico WAN y LAN.</desc>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <style>
      .box-gray { fill: #e8e6df; stroke: #888780; }
      .box-blue { fill: #ddeef9; stroke: #378add; }
      .box-teal { fill: #d0f0e4; stroke: #1d9e75; }
      .box-amber { fill: #faeeda; stroke: #ba7517; }
      .box-coral { fill: #faecea; stroke: #d85a30; }
      .box-purple { fill: #eeedfe; stroke: #7f77dd; }
      .label { font-family: sans-serif; font-size: 13px; font-weight: 600; fill: #2c2c2a; }
      .sublabel { font-family: sans-serif; font-size: 11px; fill: #5f5e5a; }
      .section-label { font-family: sans-serif; font-size: 11px; fill: #888780; font-weight: 500; }
      .warn { font-family: sans-serif; font-size: 11px; fill: #d85a30; }
      .ok { font-family: sans-serif; font-size: 11px; fill: #0f6e56; }
      .arr { stroke: #888780; stroke-width: 1; fill: none; }
      .arr-orange { stroke: #ba7517; stroke-width: 1.5; fill: none; }
      .arr-red { stroke: #d85a30; stroke-width: 1; fill: none; }
      .zone { fill: none; stroke: #d3d1c7; stroke-width: 0.5; stroke-dasharray: 5 3; }
    </style>
  </defs>

  <!-- SETUP ANTERIOR -->
  <rect x="40" y="20" width="280" height="30" rx="6" class="box-coral" stroke-width="0.5"/>
  <text class="label" x="180" y="40" text-anchor="middle">Setup anterior — IONOS + port forwarding</text>

  <rect x="40" y="62" width="280" height="110" rx="10" class="zone"/>
  <text class="section-label" x="52" y="78">WAN</text>

  <rect x="60" y="84" width="100" height="40" rx="6" class="box-gray" stroke-width="0.5"/>
  <text class="label" x="110" y="108" text-anchor="middle">Internet</text>

  <line x1="160" y1="104" x2="193" y2="104" class="arr-red" marker-end="url(#arrow)"/>
  <text class="warn" x="176" y="98" text-anchor="middle">443/80</text>

  <rect x="196" y="84" width="108" height="40" rx="6" class="box-coral" stroke-width="0.5"/>
  <text class="label" x="250" y="100" text-anchor="middle">Router</text>
  <text class="sublabel" x="250" y="116" text-anchor="middle">443 + 80 abiertos</text>

  <text class="warn" x="180" y="152">⚠ Puertos expuestos a Internet</text>

  <rect x="40" y="182" width="280" height="160" rx="10" class="zone"/>
  <text class="section-label" x="52" y="198">LAN — 192.168.1.0/24</text>

  <rect x="60" y="204" width="110" height="44" rx="6" class="box-blue" stroke-width="0.5"/>
  <text class="label" x="115" y="222" text-anchor="middle">NPMplus</text>
  <text class="sublabel" x="115" y="238" text-anchor="middle">192.168.1.103</text>

  <line x1="170" y1="226" x2="203" y2="226" class="arr" marker-end="url(#arrow)"/>

  <rect x="206" y="204" width="104" height="44" rx="6" class="box-teal" stroke-width="0.5"/>
  <text class="label" x="258" y="222" text-anchor="middle">WG Dashboard</text>
  <text class="sublabel" x="258" y="238" text-anchor="middle">:10086</text>

  <path d="M250 124 L250 196 L170 196 L170 204" class="arr" marker-end="url(#arrow)"/>

  <rect x="60" y="268" width="110" height="44" rx="6" class="box-purple" stroke-width="0.5"/>
  <text class="label" x="115" y="286" text-anchor="middle">AdGuard</text>
  <text class="sublabel" x="115" y="302" text-anchor="middle">DNS interno</text>

  <rect x="206" y="268" width="104" height="44" rx="6" fill="none" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="3 2"/>
  <text class="sublabel" x="258" y="286" text-anchor="middle">SSL via IONOS</text>
  <text class="sublabel" x="258" y="302" text-anchor="middle">API + certbot</text>

  <!-- SETUP ACTUAL -->
  <rect x="360" y="20" width="280" height="30" rx="6" class="box-teal" stroke-width="0.5"/>
  <text class="label" x="500" y="40" text-anchor="middle">Setup actual — Cloudflare Tunnel</text>

  <rect x="360" y="62" width="280" height="110" rx="10" class="zone"/>
  <text class="section-label" x="372" y="78">WAN</text>

  <rect x="376" y="84" width="100" height="40" rx="6" class="box-gray" stroke-width="0.5"/>
  <text class="label" x="426" y="108" text-anchor="middle">Internet</text>

  <line x1="476" y1="104" x2="500" y2="104" class="arr-orange" marker-end="url(#arrow)"/>

  <rect x="503" y="84" width="120" height="40" rx="6" class="box-amber" stroke-width="0.5"/>
  <text class="label" x="563" y="100" text-anchor="middle">Cloudflare Edge</text>
  <text class="sublabel" x="563" y="116" text-anchor="middle">jelopez.link</text>

  <text class="ok" x="408" y="152">✓ Sin puertos abiertos en el router</text>

  <rect x="360" y="182" width="280" height="160" rx="10" class="zone"/>
  <text class="section-label" x="372" y="198">LAN — 192.168.1.0/24</text>

  <rect x="376" y="204" width="120" height="44" rx="6" class="box-amber" stroke-width="0.5"/>
  <text class="label" x="436" y="222" text-anchor="middle">cloudflared</text>
  <text class="sublabel" x="436" y="238" text-anchor="middle">192.168.1.105</text>

  <line x1="496" y1="226" x2="522" y2="226" class="arr" marker-end="url(#arrow)"/>

  <rect x="525" y="204" width="100" height="44" rx="6" class="box-teal" stroke-width="0.5"/>
  <text class="label" x="575" y="222" text-anchor="middle">Authelia MFA</text>
  <text class="sublabel" x="575" y="238" text-anchor="middle">:9091</text>

  <path d="M563 124 L563 180 L436 180 L436 204" class="arr-orange" marker-end="url(#arrow)"/>
  <text class="sublabel" x="510" y="175" text-anchor="middle" fill="#ba7517">túnel saliente</text>

  <rect x="376" y="268" width="120" height="44" rx="6" class="box-purple" stroke-width="0.5"/>
  <text class="label" x="436" y="286" text-anchor="middle">AdGuard</text>
  <text class="sublabel" x="436" y="302" text-anchor="middle">DNS interno</text>

  <rect x="525" y="268" width="100" height="44" rx="6" fill="none" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="3 2"/>
  <text class="sublabel" x="575" y="286" text-anchor="middle">SSL automático</text>
  <text class="sublabel" x="575" y="302" text-anchor="middle">Cloudflare gestiona</text>

  <!-- SEPARADOR -->
  <line x1="40" y1="360" x2="640" y2="360" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="4 4"/>
  <text class="section-label" x="340" y="374" text-anchor="middle">Mayo 2026 — migración a Cloudflare Tunnel</text>

  <!-- WIREGUARD -->
  <rect x="40" y="390" width="600" height="80" rx="10" class="zone"/>
  <text class="section-label" x="52" y="406">WireGuard VPN — único puerto abierto (UDP 51820)</text>

  <rect x="60" y="416" width="140" height="40" rx="6" class="box-blue" stroke-width="0.5"/>
  <text class="label" x="130" y="432" text-anchor="middle">Cliente VPN</text>
  <text class="sublabel" x="130" y="448" text-anchor="middle">(exterior)</text>

  <line x1="200" y1="436" x2="240" y2="436" class="arr" marker-end="url(#arrow)"/>
  <text class="sublabel" x="220" y="430" text-anchor="middle">UDP 51820</text>

  <rect x="243" y="416" width="140" height="40" rx="6" class="box-blue" stroke-width="0.5"/>
  <text class="label" x="313" y="432" text-anchor="middle">Router (NAT)</text>
  <text class="sublabel" x="313" y="448" text-anchor="middle">único puerto abierto</text>

  <line x1="383" y1="436" x2="418" y2="436" class="arr" marker-end="url(#arrow)"/>

  <rect x="421" y="416" width="200" height="40" rx="6" class="box-blue" stroke-width="0.5"/>
  <text class="label" x="521" y="432" text-anchor="middle">WireGuard LXC</text>
  <text class="sublabel" x="521" y="448" text-anchor="middle">192.168.1.101 → acceso completo LAN</text>

  <!-- FLUJO LAN -->
  <rect x="40" y="488" width="600" height="110" rx="10" class="zone"/>
  <text class="section-label" x="52" y="504">Flujo interno LAN — dispositivos en casa</text>

  <rect x="60" y="514" width="100" height="44" rx="6" class="box-gray" stroke-width="0.5"/>
  <text class="label" x="110" y="532" text-anchor="middle">Dispositivo</text>
  <text class="sublabel" x="110" y="548" text-anchor="middle">en LAN</text>

  <line x1="160" y1="536" x2="193" y2="536" class="arr" marker-end="url(#arrow)"/>

  <rect x="196" y="514" width="120" height="44" rx="6" class="box-purple" stroke-width="0.5"/>
  <text class="label" x="256" y="532" text-anchor="middle">AdGuard DNS</text>
  <text class="sublabel" x="256" y="548" text-anchor="middle">resuelve a NPMplus</text>

  <line x1="316" y1="536" x2="346" y2="536" class="arr" marker-end="url(#arrow)"/>

  <rect x="349" y="514" width="110" height="44" rx="6" class="box-blue" stroke-width="0.5"/>
  <text class="label" x="404" y="532" text-anchor="middle">NPMplus</text>
  <text class="sublabel" x="404" y="548" text-anchor="middle">SSL + proxy</text>

  <line x1="459" y1="536" x2="489" y2="536" class="arr" marker-end="url(#arrow)"/>

  <rect x="492" y="514" width="130" height="44" rx="6" class="box-teal" stroke-width="0.5"/>
  <text class="label" x="557" y="532" text-anchor="middle">Servicio</text>
  <text class="sublabel" x="557" y="548" text-anchor="middle">wg / status / auth</text>

  <!-- LEYENDA -->
  <rect x="40" y="616" width="600" height="60" rx="8" fill="none" stroke="#d3d1c7" stroke-width="0.5"/>
  <text class="section-label" x="56" y="634" style="font-weight:600">Leyenda</text>
  <rect x="56" y="644" width="12" height="12" rx="2" fill="#faecea" stroke="#d85a30" stroke-width="0.5"/>
  <text class="sublabel" x="74" y="654">Setup anterior</text>
  <rect x="186" y="644" width="12" height="12" rx="2" fill="#d0f0e4" stroke="#1d9e75" stroke-width="0.5"/>
  <text class="sublabel" x="204" y="654">Setup actual</text>
  <rect x="316" y="644" width="12" height="12" rx="2" fill="#ddeef9" stroke="#378add" stroke-width="0.5"/>
  <text class="sublabel" x="334" y="654">Común a ambos</text>
  <rect x="466" y="644" width="12" height="12" rx="2" fill="#faeeda" stroke="#ba7517" stroke-width="0.5"/>
  <text class="sublabel" x="484" y="654">Cloudflare</text>
</svg>
{{< /rawhtml >}}

## Conclusión

El cambio más importante fue el túnel de Cloudflare. Pasar de tener puertos abiertos en el router a una arquitectura donde todo el tráfico web sale desde dentro — sin exponer nada — es una mejora de seguridad significativa. WireGuard sigue siendo imprescindible para la administración remota, y NPMplus + AdGuard cubren el acceso interno cómodo desde la LAN.

En próximos posts iré detallando la configuración de cada componente.


