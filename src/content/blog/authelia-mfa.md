---
pubDate: 2026-06-01
title: 'Authelia — autenticación MFA para servicios externos'
tags: ["homelab", "authelia", "mfa", "seguridad", "cloudflare"]
description: "Cómo funciona Authelia, cómo está instalado y cómo protegerá cualquier servicio que exponga a Internet con usuario, contraseña y TOTP."
---

Tener servicios accesibles desde Internet sin ningún tipo de autenticación es 
una mala idea. Aunque Cloudflare Tunnel oculta la IP y cierra los puertos, 
cualquiera que conozca la URL puede intentar acceder al servicio. 
Authelia añade una capa de autenticación centralizada delante de todo.

## Qué es Authelia

Authelia es un portal de autenticación de código abierto que actúa como intermediario 
entre el usuario y el servicio. Antes de llegar a cualquier aplicación protegida, 
el usuario tiene que autenticarse con usuario, contraseña y un segundo factor — 
en este caso TOTP (los códigos de 6 dígitos de una app de autenticación móvil).

Una vez autenticado, Authelia guarda la sesión durante un tiempo configurable. 
No hace falta volver a autenticarse en cada visita — solo cuando la sesión caduca 
o desde un dispositivo nuevo.

## Instalación con ProxMenux

La instalación se hizo con ProxMenux, que despliega Authelia en un LXC dedicado 
(LXC 105, IP 192.168.1.105) con la configuración base lista. Durante el proceso 
el script pide el dominio — hay que introducir `jelopez.link`, no `auth.jelopez.link`.

## Ajustes post-instalación

El script de ProxMenux hace un buen trabajo, pero dejó un par de cosas que corregir.

**Bug en la URL de Authelia** — la configuración generada tenía un error: 
la `authelia_url` apuntaba a `https://auth.auth.jelopez.link` con el subdominio 
duplicado. Un `sed` lo arregla:

```bash
sed -i 's|authelia_url: "https://auth.auth.jelopez.link"|authelia_url: "https://auth.jelopez.link"|' /etc/authelia/configuration.yml
```

**Política por defecto** — el script configura `one_factor` por defecto, 
lo que significa solo usuario y contraseña sin segundo factor. Para forzar MFA 
en todos los servicios:

```bash
sed -i 's/default_policy: one_factor/default_policy: two_factor/' /etc/authelia/configuration.yml
```

**Dominio de cookie** — también había que corregir el dominio para que las cookies 
funcionen correctamente en todos los subdominios de `jelopez.link`:

```bash
sed -i 's/domain: "auth.jelopez.link"/domain: "jelopez.link"/' /etc/authelia/configuration.yml
```

Tras los cambios, reiniciar el servicio:

```bash
systemctl restart authelia
```

## Configuración de usuarios

Los usuarios se definen en `/etc/authelia/users.yml`. Las contraseñas se almacenan 
como hash Argon2 — nunca en texto plano. Para generar el hash de una contraseña:

```bash
authelia crypto hash generate argon2 --password 'tucontraseña'
```

El fichero de usuarios tiene esta estructura:

```yaml
users:
  juanen:
    disabled: false
    displayname: "Juanen"
    password: "$argon2id$v=19$..."
    email: "tucorreo@gmail.com"
    groups:
      - admins
```

## Configurar el TOTP

La primera vez que inicias sesión, Authelia detecta que no tienes segundo factor 
configurado y te redirige a registrar un dispositivo. Escaneas el QR con cualquier 
app de autenticación (Aegis, Google Authenticator, Authy) y listo.

Un detalle: Authelia envía el enlace de verificación por email, pero en esta 
configuración el notificador está configurado como fichero local — no envía emails reales. 
El enlace se guarda en `/etc/authelia/emails.txt` en el servidor:

```bash
cat /etc/authelia/emails.txt
```

## Integración con Cloudflare Tunnel

Authelia se integra con Cloudflare Tunnel mediante **forward auth** — cada petición 
que llega a un servicio protegido pasa primero por Authelia antes de llegar al servicio.

El flujo es:

1. Usuario accede a `app.jelopez.link`
2. Cloudflare Tunnel consulta a Authelia: `https://auth.jelopez.link/api/authz/forward-auth`
3. Si no hay sesión válida → Authelia redirige al portal de login
4. Usuario introduce usuario, contraseña y código TOTP
5. Authelia valida y devuelve 200 OK
6. Cloudflare pasa el tráfico al servicio

Esta integración se configura en **Origin request settings** de cada ruta del túnel 
en Cloudflare Zero Trust. De momento no hay servicios expuestos más allá del propio 
`auth.jelopez.link`, pero cualquier servicio nuevo que se publique llevará Authelia 
delante desde el primer momento.

## Acceso

El portal de Authelia está accesible en `https://auth.jelopez.link` — tanto desde 
dentro de la LAN (via AdGuard + NPMplus) como desde Internet (via Cloudflare Tunnel). 
Es el único servicio expuesto externamente de forma permanente, ya que es el que 
gestiona la autenticación del resto.

