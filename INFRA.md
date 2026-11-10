# Referencia de infraestructura

## Hosting

| Servicio | Proveedor | Dashboard | Dominio / ID |
|----------|-----------|-----------|--------------|
| API | Railway (proyecto `kachingga`, servicio `api`) | railway.com/dashboard | Prod `https://api.kachingga.com` · staging `https://api-staging.kachingga.com` |
| **Web** | Railway (proyecto `kachingga`, servicio `web`) | railway.com/dashboard | Prod `https://kachingga.com` · staging `https://staging.kachingga.com` |
| Dominio y DNS | Cloudflare (Registrar + DNS) | dash.cloudflare.com | `kachingga.com`, con renovación automática |
| Mails de la app (SMTP) | Resend (plan gratis, cuenta de Galo) | resend.com | Dominio `kachingga.com` verificado (registros DNS en Cloudflare). Supabase manda por acá los mails de auth (ver "Supabase"). 100 mails por día |
| Captcha | Cloudflare Turnstile | dash.cloudflare.com → Turnstile | Widget "Kachingga" (prod). Dev usa las claves de prueba (ver "Supabase") |
| Mails del dominio | Cloudflare Email Routing (solo recibe, no manda) | dash.cloudflare.com → Email → Email Routing | `hola@kachingga.com`: contacto público (landing y política de privacidad, #100). `devops@kachingga.com`: dueño de cuentas de servicios (#50). Reenvían a mails personales (no se anotan acá) |
| Search Console | Google Search Console (cuenta de Galo) | search.google.com/search-console | Propiedad de dominio `kachingga.com`, verificada con un registro TXT en Cloudflare. **No borrar ese TXT:** Google lo usa para verificar la marca del login con Google (#96) |
| Base de datos **PROD** | Supabase (`kachingga`) | supabase.com/dashboard/project/czrkjokurbmbbvobvmxd | `https://czrkjokurbmbbvobvmxd.supabase.co` (ref `czrkjokurbmbbvobvmxd`) |
| Base de datos **DEV** | Supabase (`staging-kachingga`) | supabase.com/dashboard/project/nraoqdaplvvsakvtlcam | `https://nraoqdaplvvsakvtlcam.supabase.co` (ref `nraoqdaplvvsakvtlcam`) |
| Auth | Supabase Auth (email + password y Google) | supabase.com/dashboard → Authentication | Ver "Supabase" (abajo) |
| Login con Google (OAuth) | Google Cloud (proyecto `Kachingga` de Galo) | console.cloud.google.com → Google Auth Platform | Cliente OAuth *Web application* "Kachingga web", app publicada (*In production*). Detalle en "Supabase" |
| CI | GitHub Actions | github.com/kachingga/kachingga/actions | `ci.yml` (checks obligatorios), `e2e.yml` (Playwright en la web, a demanda) y `backup.yml` (backup diario cifrado de prod y alerta de tamaño de la base, ver `DEPLOY.md` → "Backups") |
| Errores (monitoreo) | Sentry (plan gratis, org `kachingga` de Galo) | sentry.io/organizations/kachingga | Proyectos `kachingga-web` (React) y `kachingga-api` (Bun); cada uno con `environment` `staging` / `production`. Cómo está hecho: `docs/claude/repo/monitoreo.md` |
| Caídas (uptime) | UptimeRobot (plan gratis, cuenta de Galo) | uptimerobot.com | HTTP(s) a `kachingga.com` y `staging.kachingga.com`; Keyword (`"ok":true`) a `api.kachingga.com/health/db` y `api-staging.kachingga.com/health/db` (ver `DEPLOY.md` → "Monitoreo") |
| Cotizaciones (dólar blue y oficial, oficial de EUR, BRL, UYU y CLP) | DolarApi (público, sin clave) | dolarapi.com | `https://dolarapi.com/v1/dolares/{blue,oficial}` y `/v1/cotizaciones/{eur,brl,uyu,clp}` |
| Repo | GitHub | github.com/kachingga/kachingga | — |

Actualizar este archivo con los valores reales después de cada setup.

---

## Entornos

| Entorno | Supabase | API | Web | Se deploya desde |
|---------|----------|-----|-----|------------------|
| **DEV** (local) | `staging-kachingga` (nraoqdaplvvsakvtlcam) | `bun run api` con `apps/api/.env` | `bun run web` con `apps/web/.env` | — |
| **STAGING** | `staging-kachingga` (la misma que DEV) | Railway, entorno `staging` (variables = `apps/api/.env`, salvo `CORS_ORIGINS`) | Railway, entorno `staging` | `main`, en cada merge |
| **PROD** | `kachingga` (czrkjokurbmbbvobvmxd) | Railway, entorno `production` (variables = `apps/api/.env.prod`) | Railway, entorno `production` | branch `production` (`bun run promote`) |

- Cada base tiene **sus propios usuarios**: para probar en dev o staging hay que registrarse ahí (las cuentas de dev sirven en staging, no en prod).
- **Staging y dev comparten base:** lo que se carga en local aparece en staging y al revés, y una migración aplicada en dev (`db:migrate:deploy`) ya está en staging.
- Los `.env` no se suben con el build (están gitignoreados): las variables de cada entorno se cargan en Railway (ver abajo).

### Plan de Supabase
- La org `kachingga` está en **Free** (desde nov 2026): 2 proyectos activos por persona (sumando las orgs Free donde sos Owner/Admin), justo `kachingga` + `staging-kachingga`.
- En Free, un proyecto **se pausa solo tras ~1 semana sin actividad** y se reactiva desde el dashboard. Si prod se pausa, la app deja de andar hasta reactivarlo: UptimeRobot lo detecta (`/health/db` deja de responder `"ok":true`). El ping de UptimeRobot a `/health/db` cada 5 minutos cuenta como actividad, así que ni prod ni staging deberían pausarse.
- **Base de hasta 500 MB para toda la org**, sumando `kachingga` y `staging-kachingga`, medida como el **promedio diario** del período de facturación (no el tamaño del momento). Cada proyecto arranca ocupando ~40–60 MB. Si se pasa, Supabase restringe la org (los pedidos dan error 402: la app deja de andar para todos) hasta pasar a Pro o hasta el período siguiente; achicar la base no lo destraba enseguida. Aparte, el disco de cada proyecto (2 GB) pasa a **solo lectura** al llegar al 95%. El backup diario avisa antes: `DEPLOY.md` → "Monitoreo" → "Tamaño de la base".

## Variables de entorno

### Railway — servicio `api` (`apps/api`)

Mismas variables en los dos entornos, con los valores de su base (staging = `apps/api/.env`, prod = `apps/api/.env.prod`).

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL del pooler de Supabase (puerto 6543) — para queries |
| `DIRECT_URL` | Session pooler de Supabase (puerto 5432) — para migraciones. No usar la conexión directa: es solo IPv6 |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Clave **secret** de Supabase (`sb_secret_...`) — solo en el server. Se usa para validar los tokens de los usuarios |
| `PORT` | Lo setea Railway automáticamente — no pisarlo |
| `NODE_ENV` | `production` — evita que tRPC devuelva stack traces en los errores |
| `CORS_ORIGINS` | Orígenes del front web que pueden llamar a la API, separados por coma. Prod: `https://kachingga.com`. Staging: `https://staging.kachingga.com`. Local (default): `http://localhost:5173,http://localhost:4173` |
| `SEED_USER_PASSWORD` | **Solo `apps/api/.env` (dev).** Contraseña de los usuarios de prueba de `bun run db:seed`. No va en Railway ni en `.env.prod` |
| `SENTRY_DSN` | DSN del proyecto `kachingga-api` de Sentry (Settings → Client Keys). Sin él no se reporta nada (local, tests, CI) |
| `SENTRY_ENVIRONMENT` | `production` o `staging` |
| _(v2)_ `LLM_API_KEY` | API key del proveedor del agente |

### Railway — servicio `web` (`apps/web`)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | La API de su entorno: `https://api.kachingga.com` (prod) o `https://api-staging.kachingga.com` (staging). En local va vacía (Vite reenvía `/trpc` a la API) |
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` de la base de su entorno |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave **publishable** de esa base — pública, solo para auth |
| `VITE_SENTRY_DSN` | DSN del proyecto `kachingga-web` de Sentry. **Público por diseño** (solo permite mandar eventos, no leerlos). Sin él no se reporta nada |
| `VITE_SENTRY_ENVIRONMENT` | `production` o `staging` |
| `VITE_TURNSTILE_SITE_KEY` | *Site key* del widget de Cloudflare Turnstile (captcha del login, registro y "¿Olvidaste tu contraseña?"). **Pública por diseño**; la *secret key* va solo en Supabase. Vacía = sin captcha. Prod: la del widget real; staging: la de prueba de Cloudflare, `1x00000000000000000000AA`. Ver "Supabase" (abajo) |
| `SENTRY_AUTH_TOKEN` | **Secreto, solo para el build** (no es `VITE_*`): *Organization Token* de la org `kachingga` (Sentry → Settings → Developer Settings → Organization Tokens; solo se crean desde la web) para que el build suba los source maps. Opcional: sin él los errores se ven con el código minificado |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Slug de la org de Sentry y `kachingga-web`. Los usa el build junto con `SENTRY_AUTH_TOKEN` |
| `CSP_ENFORCE` | `true` = la Content-Security-Policy bloquea; sin la variable (u otro valor) va como **Report-Only** (solo avisa en la consola). La lee `server.ts` al arrancar. Cuándo y cómo pasarla: `docs/claude/web/servidor-y-headers.md` |
| `PORT` | Lo setea Railway — no pisarlo (lo lee `server.ts`) |

> Todo lo `VITE_*` queda dentro del JavaScript que baja el navegador: es **público**. Nunca secretos. Vite las lee **al buildear**: si cambian, hay que redeployar el servicio `web`. `server.ts` además lee `VITE_API_URL`, `VITE_SUPABASE_URL` y `VITE_SENTRY_DSN` al arrancar, para armar el `connect-src` de la CSP de su entorno.

### GitHub (secrets)

Los de prod (`BACKUP_*`) están en el **environment `backup`** (Settings → Environments), que solo puede usar `main`: un workflow de otra branch o de un PR no los ve. Los `E2E_*` (base de dev) son secrets del repo.

| Secret | Dónde | Descripción |
|--------|-------|-------------|
| `BACKUP_DATABASE_URL` | Environment `backup` | `DIRECT_URL` de prod (session pooler, puerto 5432). Lo usa `backup.yml` para el `pg_dump` diario y para medir el tamaño de la base |
| `BACKUP_PASSPHRASE` | Environment `backup` | Passphrase con la que `backup.yml` cifra cada backup. Copia en `apps/api/.env.prod` y en el gestor de contraseñas de Galo: **sin ella no se pueden abrir los backups** |
| `E2E_DATABASE_URL` | Repo | `DATABASE_URL` de **dev** (`staging-kachingga`, pooler 6543). La usa la API que levanta `e2e.yml` para los recorridos con datos (`docs/claude/web/testing.md`) |
| `E2E_SUPABASE_URL` | Repo | `SUPABASE_URL` de dev (la API y la web de los E2E) |
| `E2E_SUPABASE_SECRET_KEY` | Repo | `SUPABASE_SECRET_KEY` de dev: la API de los E2E y los tests, que crean sus cuentas ya confirmadas con la API de admin (`apps/web/e2e/accounts.ts`; nunca llega al navegador). Si se rota la de dev, actualizar este secret también |
| `E2E_SUPABASE_PUBLISHABLE_KEY` | Repo | `VITE_SUPABASE_PUBLISHABLE_KEY` de dev (la web de los E2E; es pública, pero se guarda junto a las otras) |

Sin los `E2E_*`, `e2e.yml` corre igual pero solo los specs que no necesitan la API.

### Archivos locales (gitignoreados, nunca commitear)

- `apps/api/.env` / `apps/web/.env` — **DEV** (`staging-kachingga`). Lo que usa todo lo local
- `apps/web/.env.prod` — solo `SENTRY_AUTH_TOKEN` (el Organization Token de Sentry), como copia local para cargarlo en Railway.
- `apps/api/.env.prod` — **PROD** (`kachingga`). Solo para `db:migrate:prod` y como referencia de las variables de Railway (las `VITE_*` de prod de la web salen del dashboard de Supabase → `kachingga` → API Keys)

---

## Supabase

- **Auth:** registro abierto (#40), **email + password con el email confirmado** (*Confirm email* prendido, #98) y **Google**, en los dos proyectos (Authentication → Sign In / Providers). Captcha (Cloudflare Turnstile) en el login con email, el registro y "¿Olvidaste tu contraseña?". También en los dos: *Secure email change* prendido, *Manual linking* y *Anonymous sign-ins* apagados, contraseña de al menos 8 caracteres.
- **Google:** un cliente OAuth tipo *Web application* en Google Cloud (proyecto de Galo) con los dos *Authorized redirect URIs* de Supabase: `https://czrkjokurbmbbvobvmxd.supabase.co/auth/v1/callback` (prod) y `https://nraoqdaplvvsakvtlcam.supabase.co/auth/v1/callback` (staging). Su client ID y secret se cargan en el provider Google de cada proyecto de Supabase (el secret solo ahí, nunca en el repo).
- **URLs de auth** (Authentication → URL Configuration): adónde puede volver el login con Google (y los links de los mails). En `kachingga`, *Site URL* `https://kachingga.com` y *Redirect URLs* `https://kachingga.com/**`; en `staging-kachingga`, *Site URL* `http://localhost:5173` y *Redirect URLs* `https://staging.kachingga.com/**` y `http://localhost:5173/**`.
- **Mails (#98):** Supabase manda los mails (confirmar el email, recuperar la contraseña, cambiar el email) por el **SMTP de Resend** (Authentication → Emails → SMTP Settings, en los dos proyectos): host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = una API key de Resend (solo ahí y en el gestor de contraseñas), remitente `no-responder@kachingga.com` con nombre `Kachingga`. **Límite de mails por hora** (Authentication → Rate Limits): **30 en prod y 10 en dev**. El tope real es el de Resend gratis, **100 mails por día para toda la cuenta**, compartidos por prod, dev y los E2E (si no alcanza: Resend Pro). El resto de los límites, como vienen.
- **Plantillas de los mails** (Authentication → Emails → Templates, en español, en los dos proyectos): *Confirm signup*, *Reset password* y *Change email address* usan el link **`{{ .RedirectTo }}#token_hash={{ .TokenHash }}`**, que la web canjea (el link por defecto, `{{ .ConfirmationURL }}`, no anda si el mail se abre en otro navegador, ej. Safari con la app instalada: `docs/claude/web/usar-la-api.md` → "Login"). Los textos están en las descripciones de los PRs #113 y #125.
- **Captcha en prod:** widget "Kachingga" de Cloudflare Turnstile (dash.cloudflare.com → Turnstile) con los dominios de prod (`kachingga.com`, `app.kachingga.com`). Su *site key* va en `VITE_TURNSTILE_SITE_KEY` del servicio `web` de prod; su *secret key*, **solo** en Supabase `kachingga` (Authentication → Attack Protection → Turnstile).
- **Si hay que rearmar un proyecto, este orden** (si se prende algo antes, nadie puede entrar): 1) la web con las pantallas de #98 deployada; 2) SMTP; 3) plantillas; 4) la *site key* del captcha en el servicio `web` (redeploy); 5) recién ahí, *Confirm email* y el captcha en Supabase.
- **Cambiar el email (Mi cuenta):** *Secure email change* prendido en los dos proyectos (Sign In / Providers → Email): Supabase manda la plantilla *Change email address* **dos veces**, a la dirección actual y a la nueva, cada una con su token, y cambia el email cuando se abrieron los dos (con *Confirm email* apagado, con el primero). Esa plantilla tiene que usar **`{{ .RedirectTo }}#token_hash={{ .TokenHash }}`** como las otras (el link vuelve a `/cambiar-email`, ya cubierto por las *Redirect URLs* `…/**`). Detalle: `docs/claude/web/usar-la-api.md` → "Login".
- **Dev igual que prod, con claves de prueba (#114):** en `staging-kachingga` (que usan lo local, staging y los E2E con API) se prenden también *Confirm email* y el captcha, para probarlos antes que en prod. El captcha usa las **claves de prueba de Cloudflare Turnstile**, que siempre pasan y son públicas (están en la doc de Cloudflare): *site key* `1x00000000000000000000AA` (en el `apps/web/.env` de cada uno, en `VITE_TURNSTILE_SITE_KEY` del servicio `web` de staging y en `e2e.yml`) y *secret key* `1x0000000000000000000000000000000AA` (solo en Supabase de dev, Attack Protection). En dev no hace falta un widget de Cloudflare: el paso 4 es poner esa *site key* en staging (redeploy) y avisar al grupo que la copie a su `.env` (sin ella, el login con email local falla). **Prod (`kachingga`) usa las claves reales** del widget de Cloudflare (que rechazan el token de prueba). Los E2E con API están preparados: crean sus cuentas confirmadas por admin y el registro por pantalla se confirma con un link generado por admin (`docs/claude/web/testing.md` → "E2E"); el registro manda un mail por corrida a una dirección de prueba de Resend, así que dev también necesita el SMTP (paso 2) antes de prender *Confirm email*.
- **Base de datos:** el schema se maneja solo con migraciones de Prisma — nunca modificarlo a mano desde el SQL editor.
- **Claves:** usar las claves nuevas (`sb_publishable_...` / `sb_secret_...`), no las JWT legacy (`anon` / `service_role`). Se ven en Project Settings → API Keys (o con `supabase projects api-keys --project-ref <ref> --reveal`; sin `--reveal` la secret sale enmascarada).
- **Contraseñas de las bases:** Supabase solo las muestra al crear el proyecto; después **no se pueden ver**, solo resetear. Las tiene Galo y se pasan por privado / gestor de contraseñas. **Nunca resetearlas** sin avisar: rompe el `.env` de todos y, en prod, Railway.

---

## Seguridad del repo

- **Escaneo de secretos de GitHub + protección de push: activos.** Si un push trae una clave (Supabase, tokens, etc.), GitHub lo rechaza. No saltear el bloqueo: sacar el secreto del commit.
- **Alertas de vulnerabilidades de dependencias (Dependabot alerts): activas.** Dependabot además abre PRs mensuales para las GitHub Actions.
- **Solo se pueden usar las actions de GitHub y `oven-sh/setup-bun`** (Settings → Actions → General → *Allow select actions*). Sumar otra: agregarla ahí antes de usarla en un workflow.
- **Actions fijadas por SHA** (las de GitHub y `oven-sh/setup-bun`), con la versión en un comentario: un tag movido no cambia lo que corre. Dependabot actualiza SHA y comentario. Cómo agregar una: `docs/claude/repo/git-prs-y-conflictos.md`.
- **El secret de prod solo lo lee el backup desde `main`:** environment `backup` (ver "GitHub (secrets)").
- **Artifacts públicos** (cualquiera logueado en GitHub los baja): los backups van cifrados y sin los tokens de sesión (`DEPLOY.md` → "Backups"); el reporte de Playwright dura 3 días y, contra la API, va sin traces.
- **RLS:** el CI falla si una tabla de `public` no tiene RLS (job "Migraciones al día con el schema").
- **`.env*` gitignoreados en todo el repo**, salvo los `.env.sample`.
- El repo es **público**: cualquier secreto que llegue a un commit hay que rotarlo, aunque se borre después.
- **Branches protegidas:** `main` (todo por PR con el CI en verde: "Typecheck, tests y lint", "Migraciones al día con el schema" y "Formato de commits y título del PR"; solo squash) y `production` (exige "Typecheck, tests y lint" y "Migraciones al día con el schema" en el commit que se sube, sin "strict"; vale para admins; sin force-push ni borrado; avanza con `bun run promote`: si el CI de ese commit de `main` todavía corre, el push se rechaza hasta que termine). "Formato de commits…" no se exige ahí porque solo corre en los PRs.
- **La org exige 2FA** a todos sus miembros.

## Accesos

Las cuentas están **a nombre de Galo**: org de GitHub `kachingga`, proyecto `kachingga` de Railway (en su cuenta personal, plan Hobby compartido con otros proyectos suyos), Cloudflare (dominio y DNS), org `kachingga` de Supabase, org `kachingga` de Sentry, UptimeRobot, Resend, Google Search Console y el proyecto `Kachingga` de Google Cloud (OAuth). Las credenciales y el 2FA, en su gestor de contraseñas; nunca en el repo. Al resto del grupo se lo suma si lo necesita: org de GitHub, org de Supabase, proyecto de Railway (Hobby admite pocos miembros por proyecto: verificar el límite al invitar).
