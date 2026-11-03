# Referencia de infraestructura

## Hosting

| Servicio | Proveedor | Dashboard | Dominio / ID |
|----------|-----------|-----------|--------------|
| API | Railway | railway.app/dashboard | Por definir después del primer deploy |
| Base de datos **PROD** | Supabase (`kachingga`) | supabase.com/dashboard/project/czrkjokurbmbbvobvmxd | `https://czrkjokurbmbbvobvmxd.supabase.co` (ref `czrkjokurbmbbvobvmxd`) |
| Base de datos **DEV** | Supabase (`kachingga-dev`) | supabase.com/dashboard/project/nraoqdaplvvsakvtlcam | `https://nraoqdaplvvsakvtlcam.supabase.co` (ref `nraoqdaplvvsakvtlcam`) |
| Auth | Supabase Auth | supabase.com/dashboard → Authentication | — |
| Builds mobile | EAS (Expo) | expo.dev/accounts/kachingga/projects/kachingga | Org `kachingga`, project ID `49f7728b-7782-46e5-8a8a-491bb590bfe1` |
| Updates OTA | EAS Update | expo.dev | — |
| Cotización dólar blue | DolarApi (público, sin clave) | dolarapi.com | `https://dolarapi.com/v1/dolares/blue` |
| Repo | GitHub | github.com/kachingga/kachingga | — |

Actualizar este archivo con los valores reales después de cada setup.

---

## Entornos

| Entorno | Supabase | API | App |
|---------|----------|-----|-----|
| **DEV** | `kachingga-dev` (nraoqdaplvvsakvtlcam) | local (`bun run dev`) con `apps/api/.env` | Expo local con `apps/mobile/.env` |
| **PROD** | `kachingga` (czrkjokurbmbbvobvmxd) | Railway (variables = `apps/api/.env.prod`) | builds de EAS (variables de EAS = `apps/mobile/.env.prod`) |

- Cada base tiene **sus propios usuarios**: para probar en dev hay que registrarse en dev.
- Los `.env` de EAS no se suben con el build (están gitignoreados): las variables de prod de la app se cargan en EAS (expo.dev → proyecto → Environment variables) antes del primer build.

### Plan de Supabase
- Hoy la org `kachingga` está en **Pro** (los dos proyectos se cobran por uso de cómputo).
- Plan: pasar la org `dear-cred` a Pro y la org `kachingga` a **Free**. El límite gratis es de 2 proyectos activos por persona (sumando todas las orgs Free donde sos Owner/Admin), justo `kachingga` + `kachingga-dev`.
- En Free, un proyecto **se pausa solo tras ~1 semana sin uso**; se reactiva desde el dashboard. Si prod se pausa, la app deja de funcionar hasta reactivarlo.

## Variables de entorno

### Railway (API — `apps/api`)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL del pooler de Supabase (puerto 6543) — para queries |
| `DIRECT_URL` | Session pooler de Supabase (puerto 5432) — para migraciones. No usar la conexión directa: es solo IPv6 |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Clave **secret** de Supabase (`sb_secret_...`) — solo en el server. Se usa para validar los tokens de los usuarios |
| `PORT` | Lo setea Railway automáticamente — no pisarlo |
| `NODE_ENV` | `production` — evita que tRPC devuelva stack traces en los errores |
| _(v2)_ `MP_ACCESS_TOKEN` | Access token de Mercado Pago |
| _(v2)_ `MP_WEBHOOK_SECRET` | Secreto para validar webhooks de Mercado Pago |
| _(v3)_ `LLM_API_KEY` | API key del proveedor del agente |

### EAS / Expo (mobile — `apps/mobile`)

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | URL de la API en Railway |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave **publishable** de Supabase (`sb_publishable_...`) — pública, solo para auth |

> Todo lo que empieza con `EXPO_PUBLIC_` queda embebido en la app y es **público**. Nunca poner secretos ahí.

### Archivos locales (gitignoreados, nunca commitear)

- `apps/api/.env` — variables de desarrollo de la API
- `apps/api/.env` / `apps/mobile/.env` — **DEV** (`kachingga-dev`). Lo que usa todo lo local
- `apps/api/.env.prod` / `apps/mobile/.env.prod` — **PROD** (`kachingga`). Solo para `db:migrate:prod` y como referencia de las variables de Railway y EAS
- `apps/mobile/.env.local` — variables de desarrollo de la app

---

## Supabase

- **Auth:** email + password. Habilitar el provider "Email" en Authentication → Providers. Decidir si se deja abierto el signup o se crean los usuarios a mano desde el dashboard.
- **Base de datos:** el schema se maneja solo con migraciones de Prisma — nunca modificarlo a mano desde el SQL editor.
- **Claves:** usar las claves nuevas (`sb_publishable_...` / `sb_secret_...`), no las JWT legacy (`anon` / `service_role`). Se ven en Project Settings → API Keys (o con `supabase projects api-keys --project-ref <ref> --reveal`; sin `--reveal` la secret sale enmascarada).
- **Contraseñas de las bases:** Supabase solo las muestra al crear el proyecto; después **no se pueden ver**, solo resetear. Las tiene Galo y se pasan por privado / gestor de contraseñas. **Nunca resetearlas** sin avisar: rompe el `.env` de todos y, en prod, Railway.

---

## Accesos

Todos los miembros de Kachingga deberían tener acceso a: org de GitHub, proyecto de Railway, org de Supabase, org de Expo y (para iOS) el equipo de Apple Developer.
