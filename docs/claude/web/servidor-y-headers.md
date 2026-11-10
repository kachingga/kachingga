# Servidor de la web y headers de seguridad — web

> **Aplica a:** `apps/web/server.ts` (lo que sirve en Railway y sus headers), la **Content-Security-Policy** (CSP) y cualquier cosa que sume algo externo a la web: un script, un iframe, una imagen, una fuente o una conexión a otro dominio. También `apps/web/public/theme.js` y `src/lib/zod-config.ts`, que existen por la CSP. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`. Variables: `INFRA.md`; deploy: `DEPLOY.md`.

## Qué hace `server.ts`

Sirve el build de Vite (`apps/web/dist`) en Railway: los archivos que existen, `index.html` para las rutas de la app (las resuelve React Router), 404 para un archivo que no existe (ej. un `/assets/x.js` viejo), cache largo en `/assets/*` (tienen hash) y `no-cache` en el resto, gzip, y **los headers de seguridad en todas las respuestas**. En local `bun run dev` y `bun run preview` son de Vite y **no** pasan por acá (no hay CSP en local ni en los E2E).

## Headers

| Header | Valor | Para qué |
|--------|-------|----------|
| `Content-Security-Policy-Report-Only` (o `Content-Security-Policy`, ver abajo) | La CSP (abajo) | Qué puede cargar la página y a dónde se puede conectar: si alguien logra meter un script, no corre ni puede mandar datos a otro lado |
| `Strict-Transport-Security` | `max-age=86400` | Solo HTTPS (el navegador ni intenta HTTP). Arranca en un día: ver "Subir el HSTS" |
| `X-Frame-Options` | `DENY` | Nadie puede mostrar la app adentro de un iframe (clickjacking). Lo mismo que `frame-ancestors 'none'`, para navegadores viejos y mientras la CSP es Report-Only (ahí `frame-ancestors` no aplica) |
| `X-Content-Type-Options` | `nosniff` | El navegador respeta el `Content-Type` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | A otros sitios solo les llega el dominio, nunca la ruta (que puede tener el código de invitación o filtros) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | Apaga lo que la app no usa. **No** apaga el portapapeles (copiar alias y monto) ni compartir (invitaciones): quedan con el default, permitidos en la app |
| `Cross-Origin-Opener-Policy` | `same-origin` | Ningún otro sitio que abra la app (o que la app abra) se queda con una referencia a la ventana. No rompe Google: el login es una redirección de toda la página (`signInWithOAuth`), no un popup |

## La CSP

```
default-src 'self'
script-src 'self' https://challenges.cloudflare.com
style-src 'self' 'unsafe-inline'
img-src 'self' data:
font-src 'self' data:
connect-src 'self' <API> <Supabase> <Sentry>
frame-src https://challenges.cloudflare.com
worker-src 'self'; manifest-src 'self'
frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'
```

- **`connect-src` sale de las variables del servicio `web` de cada entorno:** el origen de `VITE_API_URL`, de `VITE_SUPABASE_URL` y el host de ingesta de `VITE_SENTRY_DSN` (ej. `https://o123.ingest.us.sentry.io`). Son las mismas que lee Vite al buildear; Railway se las da también al proceso, así que `server.ts` las lee al arrancar y staging y prod tienen cada uno las suyas. Si una falta (local, Sentry apagado), no se suma.
- **Scripts: solo los de la app y los de Turnstile** (el captcha de las pantallas de login y registro, `challenges.cloudflare.com`, con su iframe en `frame-src`). **Nada inline ni `eval`:**
  - El script que pone el tema y la paleta antes del primer pintado es un archivo, **`public/theme.js`**, cargado sin `defer` en el `<head>` de `index.html` (corre antes de pintar, como cuando era inline). Misma lógica y claves que `src/lib/theme.ts` (lo verifican `theme.test.ts` y `palettes.test.ts`). El service worker lo guarda como al resto.
  - **Zod sin `new Function`** (`src/lib/zod-config.ts`, el primer import de `main.tsx`): Zod prueba `new Function` al definir cada schema (al importar `@kachingga/api/schemas`) para compilar los parsers; con la CSP eso era una violación en cada carga. La web casi no valida (lo hace la API), así que va sin compilar (`jitless`).
- **Estilos con `'unsafe-inline'`:** el splash de `index.html` (`<style>` y `style=""` en el SVG) y lo que inyectan los toasts (Sonner) y los diálogos (Radix). Un estilo inyectado no ejecuta código; los scripts siguen cerrados.
- **`data:`** en imágenes y fuentes: Vite mete como `data:` las fuentes más chicas (subconjuntos de Manrope y Bricolage).
- Lo que no gobierna la CSP y la app usa: ir a Google (navegación de toda la página) y descargar el export (`<a download>` con un `blob:`).

### Sumar algo externo

Un script, iframe, imagen, fuente o API de otro dominio **no anda con la CSP obligatoria hasta sumarlo a `contentSecurityPolicy` en `server.ts`** (y a su test en `server.test.ts`), con un comentario de qué es. Nunca `'unsafe-eval'` ni `'unsafe-inline'` en `script-src`: si una librería lo pide, buscar cómo apagarlo (como Zod) o hablarlo antes.

## Report-Only → obligatoria

Hoy la CSP va como **`Content-Security-Policy-Report-Only`**: el navegador avisa en la consola lo que bloquearía, pero no bloquea nada. Así un olvido no rompe la app en el celu de nadie. **No hay endpoint de reportes** (los avisos quedan solo en la consola de cada navegador; Safari además avisa que una Report-Only sin `report-to` "no tiene efecto": es eso, no un error).

**Cómo se pasa a obligatoria:** variable **`CSP_ENFORCE=true`** en el servicio `web` (`INFRA.md`) y redeployar. Sin la variable (o con otro valor) es Report-Only.

1. **Staging, con la Report-Only:** `curl -sI https://staging.kachingga.com | grep -i content-security` tiene que mostrar en `connect-src` la API, Supabase y Sentry de staging (si faltan, Railway no le está pasando esas variables al proceso: cargarlas y redeployar). Después abrir `https://staging.kachingga.com` con la consola abierta (en la compu; en el iPhone, Safari → Desarrollo con el Mac) y recorrer: login con email y con **Google**, registro (con el captcha), "¿Olvidaste tu contraseña?", un grupo, cargar un gasto, copiar alias, compartir la invitación, exportar, Mi cuenta, cerrar sesión, y la app instalada sin conexión. No tiene que aparecer ningún `[Report Only] Refused to…` ni `Content Security Policy`. Si aparece algo legítimo, sumarlo a la CSP (arriba).
2. `CSP_ENFORCE=true` en **staging**, redeployar, repetir el recorrido y usarla unos días.
3. Recién ahí `CSP_ENFORCE=true` en **prod** y redeployar.
4. Comprobar: `curl -sI https://app.kachingga.com | grep -i content-security` muestra `Content-Security-Policy:` (sin `-Report-Only`) y el `connect-src` con la API, Supabase y Sentry de ese entorno.

**Verificado (nov 2026, local con el build de producción y `server.ts`, Chromium y WebKit con el perfil de iPhone):** con la Report-Only y con `CSP_ENFORCE=true`, sin violaciones en login, registro, recuperar y nueva contraseña, el captcha (con la *site key* de prueba de Cloudflare: carga el iframe y llega el token), ir a Google, Mis grupos, Mi cuenta, cerrar sesión, sin conexión y un error mandado a Sentry. Falta probarlo en staging (con la API y el Supabase de verdad: cargar un gasto, exportar, compartir) y en un iPhone de verdad.

## Subir el HSTS

Arranca en un día (`max-age=86400`) para que un problema con el certificado no deje a nadie afuera mucho tiempo. Cuando lleve unas semanas sin problemas en prod, subirlo a un año (`max-age=31536000`) en `securityHeaders` (`server.ts`) y su test. `includeSubDomains` solo si todos los subdominios de `kachingga.com` son HTTPS (hoy `staging`, `api` y `api-staging` lo son); `preload` no: es difícil de deshacer.

## Tests

`apps/web/server.test.ts`: qué archivo responde cada URL, la CSP exacta con las variables de un entorno y sin ellas, Report-Only hasta `CSP_ENFORCE=true`, y que todas las respuestas (200, 404, 405) llevan los headers.
