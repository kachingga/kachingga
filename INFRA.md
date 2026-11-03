# Referencia de infraestructura

## Hosting

| Servicio | Proveedor | Dashboard | Dominio / ID |
|----------|-----------|-----------|--------------|
| API | Railway | railway.app/dashboard | Por definir después del primer deploy |
| Base de datos (PostgreSQL) | Supabase | supabase.com/dashboard/project/czrkjokurbmbbvobvmxd | `https://czrkjokurbmbbvobvmxd.supabase.co` (ref `czrkjokurbmbbvobvmxd`) |
| Auth | Supabase Auth | supabase.com/dashboard → Authentication | — |
| Builds mobile | EAS (Expo) | expo.dev/accounts/kachingga/projects/kachingga | Org `kachingga`, project ID `49f7728b-7782-46e5-8a8a-491bb590bfe1` |
| Updates OTA | EAS Update | expo.dev | — |
| Cotización dólar blue | DolarApi (público, sin clave) | dolarapi.com | `https://dolarapi.com/v1/dolares/blue` |
| Repo | GitHub | github.com/kachingga/kachingga | — |

Actualizar este archivo con los valores reales después de cada setup.

---

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
| _(v2)_ `LLM_API_KEY` | API key del proveedor del agente |
| _(v2)_ `MP_ACCESS_TOKEN` | Access token de Mercado Pago |
| _(v2)_ `MP_WEBHOOK_SECRET` | Secreto para validar webhooks de Mercado Pago |

### EAS / Expo (mobile — `apps/mobile`)

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | URL de la API en Railway |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave **publishable** de Supabase (`sb_publishable_...`) — pública, solo para auth |

> Todo lo que empieza con `EXPO_PUBLIC_` queda embebido en la app y es **público**. Nunca poner secretos ahí.

### Archivos locales (gitignoreados, nunca commitear)

- `apps/api/.env` — variables de desarrollo de la API
- `apps/api/.env.prod` — variables de prod, solo para correr `db:migrate:prod` desde local
- `apps/mobile/.env.local` — variables de desarrollo de la app

---

## Supabase

- **Auth:** email + password. Habilitar el provider "Email" en Authentication → Providers. Decidir si se deja abierto el signup o se crean los usuarios a mano desde el dashboard.
- **Base de datos:** el schema se maneja solo con migraciones de Prisma — nunca modificarlo a mano desde el SQL editor.
- **Claves:** usar las claves nuevas (`sb_publishable_...` / `sb_secret_...`), no las JWT legacy (`anon` / `service_role`).

---

## Accesos

Todos los miembros de Kachingga deberían tener acceso a: org de GitHub, proyecto de Railway, org de Supabase, org de Expo y (para iOS) el equipo de Apple Developer.
