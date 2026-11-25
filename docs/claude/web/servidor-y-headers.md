# Servidor de la web y headers de seguridad — web

> **Aplica a:** `apps/web/server.ts` (lo que sirve en Railway y sus headers), la **Content-Security-Policy** (CSP) y cualquier cosa que sume algo externo a la web: un script, un iframe, una imagen, una fuente o una conexión a otro dominio. También `apps/web/public/theme.js` y `src/lib/zod-config.ts`, que existen por la CSP. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`. Variables: `INFRA.md`; deploy: `DEPLOY.md`.

## Qué hace `server.ts`

Sirve el build de Vite (`apps/web/dist`) en Railway: los archivos que existen, `index.html` para las rutas de la app (las resuelve React Router), 404 para un archivo que no existe (ej. un `/assets/x.js` viejo), cache largo en `/assets/*` (tienen hash) y `no-cache` en el resto, gzip, y **los headers de seguridad en todas las respuestas**. En local `bun run dev` y `bun run preview` son de Vite y **no** pasan por acá (no hay CSP en local ni en los E2E).

## Headers

| Header | Valor | Para qué |
|--------|-------|----------|
| `Content-Security-Policy-Report-Only` (o `Content-Security-Policy`, ver abajo) | La CSP (abajo) | Qué puede cargar la página y a dónde se puede conectar: si alguien logra meter un script, no corre ni puede mandar datos a otro lado |
| `Strict-Transport-Security` | `max-age=31536000` | Solo HTTPS (el navegador ni intenta HTTP), por un año: ver "HSTS" |
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
img-src 'self' data: <fotos>
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
- **`<fotos>` en `img-src`:** el origen del bucket de R2 de las fotos (`PHOTOS_ORIGIN`, ej. `https://<account>.r2.cloudflarestorage.com`): las fotos de perfil y de grupo se ven con links firmados a ese bucket. Solo imágenes: ni scripts ni conexiones. Sin la variable no se suma.
- **`data:`** en imágenes y fuentes: Vite mete como `data:` las fuentes más chicas (subconjuntos de Manrope y Bricolage).
- Lo que no gobierna la CSP y la app usa: ir a Google (navegación de toda la página) y descargar el export (`<a download>` con un `blob:`).

### Sumar algo externo

Un script, iframe, imagen, fuente o API de otro dominio **no anda con la CSP obligatoria hasta sumarlo a `contentSecurityPolicy` en `server.ts`** (y a su test en `server.test.ts`), con un comentario de qué es. Nunca `'unsafe-eval'` ni `'unsafe-inline'` en `script-src`: si una librería lo pide, buscar cómo apagarlo (como Zod) o hablarlo antes.

## CSP obligatoria

**Desde el 24/11/2026 la CSP es obligatoria en staging y en prod** (`CSP_ENFORCE=true` en el servicio `web` de los dos, #131): el navegador bloquea lo que no está en la política. Sin la variable (o con otro valor) vuelve a **`Content-Security-Policy-Report-Only`**: solo avisa en la consola. Es la forma de volver atrás si algo se rompe (sacar la variable y redeployar). **No hay endpoint de reportes:** lo bloqueado se ve solo en la consola de cada navegador.

**Cómo se verificó** (sirve para repetirlo al sumar algo externo):
1. `curl -sI https://<entorno> | grep -i content-security` muestra `Content-Security-Policy:` (sin `-Report-Only`) y en `connect-src` la API, Supabase y Sentry de ese entorno (si faltan, Railway no le pasa esas variables al proceso: cargarlas y redeployar).
2. **Staging**, con la Report-Only y después obligatoria: una recorrida automática (Playwright) por **60 pantallas** en Chrome y Safari del celu y Chrome de la compu, con y sin sesión: login, registro y "¿Olvidaste tu contraseña?" con el captcha, Mis grupos, un grupo (gastos, saldos, un gasto, el formulario, pagos, participantes, categorías, filtros y exportar), Notificaciones, Mi cuenta, borrar la cuenta (sin borrarla), crear y unirse. **Sin violaciones.** También subir y ver una foto (R2).
3. **Prod**, obligatoria: login, registro y "¿Olvidaste tu contraseña?" (lo que se ve sin sesión). Nuestra política no bloquea nada. El captcha real de Cloudflare (en staging se usa el de prueba) escribe en la consola avisos de **su propia** CSP, la de adentro de su iframe (`connect-src … challenges.cloudflare.com`, al intentar `data:,`): no son de la nuestra, no se pueden cambiar desde acá y no afectan al captcha.

Antes de esto se había verificado en local (build de producción con `server.ts`, Chromium y WebKit con el perfil de iPhone): login, registro, recuperar y nueva contraseña, el captcha, ir a Google, Mis grupos, Mi cuenta, cerrar sesión, sin conexión y un error mandado a Sentry. Falta mirarlo en un iPhone de verdad con la consola (Safari → Desarrollo con el Mac).

## HSTS

Arrancó en un día (`max-age=86400`, 10/11/2026) para que un problema con el certificado no dejara a nadie afuera mucho tiempo, y pasó a **un año** (`max-age=31536000`) a las dos semanas sin problemas (#131). La landing (`kachingga.com`, en Lovable) ya manda un año con `includeSubDomains`, que alcanza a todos los subdominios (todos son HTTPS: `app`, `staging`, `api`, `api-staging`); la API manda lo mismo (`docs/claude/api/seguridad.md`). `preload` no: es difícil de deshacer.

## Tests

`apps/web/server.test.ts`: qué archivo responde cada URL, la CSP exacta con las variables de un entorno y sin ellas, Report-Only hasta `CSP_ENFORCE=true`, y que todas las respuestas (200, 404, 405) llevan los headers.
