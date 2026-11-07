# Referencia de infraestructura

## Hosting

| Servicio | Proveedor | Dashboard | Dominio / ID |
|----------|-----------|-----------|--------------|
| API | Railway (proyecto `kachingga`, servicio `api`) | railway.com/dashboard | Prod `https://api.kachingga.com` · staging `https://api-staging.kachingga.com` |
| **Web (front principal)** | Railway (proyecto `kachingga`, servicio `web`) | railway.com/dashboard | Prod `https://kachingga.com` · staging `https://staging.kachingga.com` |
| Dominio y DNS | Cloudflare (Registrar + DNS) | dash.cloudflare.com | `kachingga.com`, con renovación automática |
| Base de datos **PROD** | Supabase (`kachingga`) | supabase.com/dashboard/project/czrkjokurbmbbvobvmxd | `https://czrkjokurbmbbvobvmxd.supabase.co` (ref `czrkjokurbmbbvobvmxd`) |
| Base de datos **DEV** | Supabase (`staging-kachingga`) | supabase.com/dashboard/project/nraoqdaplvvsakvtlcam | `https://nraoqdaplvvsakvtlcam.supabase.co` (ref `nraoqdaplvvsakvtlcam`) |
| Auth | Supabase Auth | supabase.com/dashboard → Authentication | — |
| Builds mobile (alternativa nativa) | EAS (Expo) | expo.dev/accounts/kachingga/projects/kachingga | Org `kachingga`, project ID `49f7728b-7782-46e5-8a8a-491bb590bfe1` |
| Updates OTA | EAS Update (canal `main`) | expo.dev | Automático al mergear a `main` (`.github/workflows/eas-update.yml`), inactivo hasta configurar `EXPO_TOKEN` |
| CI | GitHub Actions | github.com/kachingga/kachingga/actions | `ci.yml` (checks obligatorios), `promote.yml` ("Promover a producción", a mano), `e2e.yml` (Playwright en la web, a demanda) y `eas-update.yml` |
| Cotizaciones (dólar blue y oficial, oficial de EUR, BRL, UYU y CLP) | DolarApi (público, sin clave) | dolarapi.com | `https://dolarapi.com/v1/dolares/{blue,oficial}` y `/v1/cotizaciones/{eur,brl,uyu,clp}` |
| Repo | GitHub | github.com/kachingga/kachingga | — |

Actualizar este archivo con los valores reales después de cada setup.

---

## Entornos

| Entorno | Supabase | API | Web | Se deploya desde |
|---------|----------|-----|-----|------------------|
| **DEV** (local) | `staging-kachingga` (nraoqdaplvvsakvtlcam) | `bun run api` con `apps/api/.env` | `bun run web` con `apps/web/.env` | — |
| **STAGING** | `staging-kachingga` (la misma que DEV) | Railway, entorno `staging` (variables = `apps/api/.env`, salvo `CORS_ORIGINS`) | Railway, entorno `staging` | `main`, en cada merge |
| **PROD** | `kachingga` (czrkjokurbmbbvobvmxd) | Railway, entorno `production` (variables = `apps/api/.env.prod`) | Railway, entorno `production` | branch `production` (workflow "Promover a producción") |

- Cada base tiene **sus propios usuarios**: para probar en dev o staging hay que registrarse ahí (las cuentas de dev sirven en staging, no en prod).
- **Staging y dev comparten base:** lo que se carga en local aparece en staging y al revés, y una migración aplicada en dev (`db:migrate:deploy`) ya está en staging.
- Los `.env` no se suben con el build (están gitignoreados): las variables de prod de la app se cargan en EAS, entorno **`production`** (expo.dev → proyecto → Environment variables) antes del primer build. El perfil `preview` de `eas.json` y el workflow de EAS Update usan ese entorno.

### Plan de Supabase
- Hoy la org `kachingga` está en **Pro** (los dos proyectos se cobran por uso de cómputo).
- Plan: pasar la org `dear-cred` a Pro y la org `kachingga` a **Free**. El límite gratis es de 2 proyectos activos por persona (sumando todas las orgs Free donde sos Owner/Admin), justo `kachingga` + `staging-kachingga`.
- En Free, un proyecto **se pausa solo tras ~1 semana sin uso**; se reactiva desde el dashboard. Si prod se pausa, la app deja de funcionar hasta reactivarlo.

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
| _(v2)_ `LLM_API_KEY` | API key del proveedor del agente |

### Railway — servicio `web` (`apps/web`)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | La API de su entorno: `https://api.kachingga.com` (prod) o `https://api-staging.kachingga.com` (staging). En local va vacía (Vite reenvía `/trpc` a la API) |
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` de la base de su entorno |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave **publishable** de esa base — pública, solo para auth |
| `PORT` | Lo setea Railway — no pisarlo (lo lee `server.ts`) |

> Todo lo `VITE_*` queda dentro del JavaScript que baja el navegador: es **público**. Nunca secretos. Vite las lee **al buildear**: si cambian, hay que redeployar el servicio `web`.

### EAS / Expo (mobile — `apps/mobile`, alternativa nativa)

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | URL de la API en Railway |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave **publishable** de Supabase (`sb_publishable_...`) — pública, solo para auth |

> Todo lo que empieza con `EXPO_PUBLIC_` queda embebido en la app y es **público**. Nunca poner secretos ahí.

### GitHub (secrets del repo)

| Secret | Descripción |
|--------|-------------|
| `EXPO_TOKEN` | Token de acceso de Expo (org `kachingga`) para que `eas-update.yml` publique updates. **Todavía no creado** — ver `DEPLOY.md` → "Activar EAS Update automático" |

### Archivos locales (gitignoreados, nunca commitear)

- `apps/api/.env` — variables de desarrollo de la API
- `apps/api/.env` / `apps/web/.env` / `apps/mobile/.env` — **DEV** (`staging-kachingga`). Lo que usa todo lo local
- `apps/api/.env.prod` / `apps/mobile/.env.prod` — **PROD** (`kachingga`). Solo para `db:migrate:prod` y como referencia de las variables de Railway y EAS
- `apps/mobile/.env.local` — variables de desarrollo de la app

---

## Supabase

- **Auth:** email + password. Habilitar el provider "Email" en Authentication → Providers. Decidir si se deja abierto el signup o se crean los usuarios a mano desde el dashboard.
- **URLs de auth** (Authentication → URL Configuration), para que los links de los mails (confirmar, recuperar contraseña) vuelvan a la web correcta: en `kachingga`, *Site URL* `https://kachingga.com`; en `staging-kachingga`, *Site URL* `http://localhost:5173` y `https://staging.kachingga.com` en *Redirect URLs*.
- **Base de datos:** el schema se maneja solo con migraciones de Prisma — nunca modificarlo a mano desde el SQL editor.
- **Claves:** usar las claves nuevas (`sb_publishable_...` / `sb_secret_...`), no las JWT legacy (`anon` / `service_role`). Se ven en Project Settings → API Keys (o con `supabase projects api-keys --project-ref <ref> --reveal`; sin `--reveal` la secret sale enmascarada).
- **Contraseñas de las bases:** Supabase solo las muestra al crear el proyecto; después **no se pueden ver**, solo resetear. Las tiene Galo y se pasan por privado / gestor de contraseñas. **Nunca resetearlas** sin avisar: rompe el `.env` de todos y, en prod, Railway.

---

## Seguridad del repo

- **Escaneo de secretos de GitHub + protección de push: activos.** Si un push trae una clave (Supabase, tokens, etc.), GitHub lo rechaza. No saltear el bloqueo: sacar el secreto del commit.
- **Alertas de vulnerabilidades de dependencias (Dependabot alerts): activas.** Dependabot además abre PRs mensuales para las GitHub Actions.
- El repo es **público**: cualquier secreto que llegue a un commit hay que rotarlo, aunque se borre después.

## Accesos

Las cuentas están **a nombre de Galo**: org de GitHub `kachingga`, proyecto `kachingga` de Railway (en su cuenta personal, plan Hobby compartido con otros proyectos suyos), Cloudflare (dominio y DNS) y org `kachingga` de Supabase. Al resto del grupo se lo suma si lo necesita: org de GitHub, org de Supabase, proyecto de Railway (Hobby admite pocos miembros por proyecto: verificar el límite al invitar) y, si se trabaja en la app nativa, org de Expo.
