# Referencia de infraestructura

## Hosting

| Servicio | Proveedor | Dashboard | Dominio / ID |
|----------|-----------|-----------|--------------|
| API | Railway (proyecto `kachingga`, servicio `api`) | railway.com/dashboard | Prod `https://api.kachingga.com` · staging `https://api-staging.kachingga.com` |
| **Web** | Railway (proyecto `kachingga`, servicio `web`) | railway.com/dashboard | Prod `https://kachingga.com` · staging `https://staging.kachingga.com` |
| Dominio y DNS | Cloudflare (Registrar + DNS) | dash.cloudflare.com | `kachingga.com`, con renovación automática |
| Base de datos **PROD** | Supabase (`kachingga`) | supabase.com/dashboard/project/czrkjokurbmbbvobvmxd | `https://czrkjokurbmbbvobvmxd.supabase.co` (ref `czrkjokurbmbbvobvmxd`) |
| Base de datos **DEV** | Supabase (`staging-kachingga`) | supabase.com/dashboard/project/nraoqdaplvvsakvtlcam | `https://nraoqdaplvvsakvtlcam.supabase.co` (ref `nraoqdaplvvsakvtlcam`) |
| Auth | Supabase Auth (email + password y Google) | supabase.com/dashboard → Authentication | Ver "Supabase" (abajo) |
| Login con Google (OAuth) | Google Cloud (proyecto `Kachingga` de Galo) | console.cloud.google.com → Google Auth Platform | Cliente OAuth *Web application* "Kachingga web", app publicada (*In production*). Detalle en "Supabase" |
| CI | GitHub Actions | github.com/kachingga/kachingga/actions | `ci.yml` (checks obligatorios), `e2e.yml` (Playwright en la web, a demanda) y `backup.yml` (backup semanal cifrado de prod, ver `DEPLOY.md` → "Backups") |
| Errores (monitoreo) | Sentry (plan gratis, org `kachingga` de Galo) | sentry.io/organizations/kachingga | Proyectos `kachingga-web` (React) y `kachingga-api` (Bun); cada uno con `environment` `staging` / `production`. Cómo está hecho: `docs/claude/repo/monitoreo.md` |
| Caídas (uptime) | UptimeRobot (plan gratis, cuenta de Galo) | uptimerobot.com | HTTP(s) a `kachingga.com` y `staging.kachingga.com`; Keyword (`"ok":true`) a `api.kachingga.com/health` y `api-staging.kachingga.com/health` (ver `DEPLOY.md` → "Monitoreo") |
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
- En Free, un proyecto **se pausa solo tras ~1 semana sin actividad** y se reactiva desde el dashboard. Si prod se pausa, la app deja de andar hasta reactivarlo: UptimeRobot lo detecta (la API de `/health` responde, pero los pedidos con datos fallan y Sentry los reporta). El uso diario del grupo y el backup semanal (`backup.yml`) hacen actividad en prod; staging sí puede pausarse si nadie la usa.

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
| `SENTRY_AUTH_TOKEN` | **Secreto, solo para el build** (no es `VITE_*`): *Organization Token* de la org `kachingga` (Sentry → Settings → Developer Settings → Organization Tokens; solo se crean desde la web) para que el build suba los source maps. Opcional: sin él los errores se ven con el código minificado |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Slug de la org de Sentry y `kachingga-web`. Los usa el build junto con `SENTRY_AUTH_TOKEN` |
| `PORT` | Lo setea Railway — no pisarlo (lo lee `server.ts`) |

> Todo lo `VITE_*` queda dentro del JavaScript que baja el navegador: es **público**. Nunca secretos. Vite las lee **al buildear**: si cambian, hay que redeployar el servicio `web`.

### GitHub (secrets del repo)

| Secret | Descripción |
|--------|-------------|
| `BACKUP_DATABASE_URL` | `DIRECT_URL` de prod (session pooler, puerto 5432). Lo usa `backup.yml` para el `pg_dump` semanal |
| `BACKUP_PASSPHRASE` | Passphrase con la que `backup.yml` cifra cada backup. Copia en `apps/api/.env.prod` y en el gestor de contraseñas de Galo: **sin ella no se pueden abrir los backups** |
| `E2E_DATABASE_URL` | `DATABASE_URL` de **dev** (`staging-kachingga`, pooler 6543). La usa la API que levanta `e2e.yml` para los recorridos con datos (`docs/claude/web/testing.md`) |
| `E2E_SUPABASE_URL` | `SUPABASE_URL` de dev (la API y la web de los E2E) |
| `E2E_SUPABASE_SECRET_KEY` | `SUPABASE_SECRET_KEY` de dev (solo la API de los E2E). Si se rota la de dev, actualizar este secret también |
| `E2E_SUPABASE_PUBLISHABLE_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` de dev (la web de los E2E; es pública, pero se guarda junto a las otras) |

Sin los `E2E_*`, `e2e.yml` corre igual pero solo los specs que no necesitan la API.

### Archivos locales (gitignoreados, nunca commitear)

- `apps/api/.env` / `apps/web/.env` — **DEV** (`staging-kachingga`). Lo que usa todo lo local
- `apps/web/.env.prod` — solo `SENTRY_AUTH_TOKEN` (el Organization Token de Sentry), como copia local para cargarlo en Railway.
- `apps/api/.env.prod` — **PROD** (`kachingga`). Solo para `db:migrate:prod` y como referencia de las variables de Railway (las `VITE_*` de prod de la web salen del dashboard de Supabase → `kachingga` → API Keys)

---

## Supabase

- **Auth:** registro abierto (#40), **email + password sin confirmar el email** (#41: *Confirm email* apagado) y **Google**, en los dos proyectos (Authentication → Sign In / Providers).
- **Google:** un cliente OAuth tipo *Web application* en Google Cloud (proyecto de Galo) con los dos *Authorized redirect URIs* de Supabase: `https://czrkjokurbmbbvobvmxd.supabase.co/auth/v1/callback` (prod) y `https://nraoqdaplvvsakvtlcam.supabase.co/auth/v1/callback` (staging). Su client ID y secret se cargan en el provider Google de cada proyecto de Supabase (el secret solo ahí, nunca en el repo).
- **URLs de auth** (Authentication → URL Configuration): adónde puede volver el login con Google (y los links de los mails). En `kachingga`, *Site URL* `https://kachingga.com` y *Redirect URLs* `https://kachingga.com/**`; en `staging-kachingga`, *Site URL* `http://localhost:5173` y *Redirect URLs* `https://staging.kachingga.com/**` y `http://localhost:5173/**`.
- **Base de datos:** el schema se maneja solo con migraciones de Prisma — nunca modificarlo a mano desde el SQL editor.
- **Claves:** usar las claves nuevas (`sb_publishable_...` / `sb_secret_...`), no las JWT legacy (`anon` / `service_role`). Se ven en Project Settings → API Keys (o con `supabase projects api-keys --project-ref <ref> --reveal`; sin `--reveal` la secret sale enmascarada).
- **Contraseñas de las bases:** Supabase solo las muestra al crear el proyecto; después **no se pueden ver**, solo resetear. Las tiene Galo y se pasan por privado / gestor de contraseñas. **Nunca resetearlas** sin avisar: rompe el `.env` de todos y, en prod, Railway.

---

## Seguridad del repo

- **Escaneo de secretos de GitHub + protección de push: activos.** Si un push trae una clave (Supabase, tokens, etc.), GitHub lo rechaza. No saltear el bloqueo: sacar el secreto del commit.
- **Alertas de vulnerabilidades de dependencias (Dependabot alerts): activas.** Dependabot además abre PRs mensuales para las GitHub Actions.
- El repo es **público**: cualquier secreto que llegue a un commit hay que rotarlo, aunque se borre después.
- **Branches protegidas:** `main` (todo por PR con el CI en verde: "Typecheck, tests y lint", "Migraciones al día con el schema" y "Formato de commits y título del PR"; solo squash) y `production` (sin force-push ni borrado; avanza con `bun run promote`).

## Accesos

Las cuentas están **a nombre de Galo**: org de GitHub `kachingga`, proyecto `kachingga` de Railway (en su cuenta personal, plan Hobby compartido con otros proyectos suyos), Cloudflare (dominio y DNS), org `kachingga` de Supabase, org `kachingga` de Sentry, UptimeRobot y el proyecto `Kachingga` de Google Cloud (OAuth). Las credenciales y el 2FA, en su gestor de contraseñas; nunca en el repo. Al resto del grupo se lo suma si lo necesita: org de GitHub, org de Supabase, proyecto de Railway (Hobby admite pocos miembros por proyecto: verificar el límite al invitar).
