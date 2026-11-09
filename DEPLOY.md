# Guía de deploy

## Servicios

| Servicio | Proveedor | Cómo se deploya |
|----------|-----------|-----------------|
| API y web — **staging** | Railway, entorno `staging` | Automático en cada merge a `main` (espera el CI) |
| API y web — **prod** | Railway, entorno `production` | Desde la branch `production`, con el workflow "Promover a producción" |

URLs, variables y bases de cada entorno: `INFRA.md`.

---

## Setup inicial (una vez)

### 1. Railway — proyecto, entornos y servicios

1. Proyecto `kachingga` en Railway (cuenta de Galo, plan Hobby) con dos entornos: **`production`** y **`staging`**.
2. Dos servicios conectados a `kachingga/kachingga`, **`api`** y **`web`**. En cada uno:
   - **Root Directory:** vacío (raíz del repo), así se usa el `bun.lock` del monorepo (la web necesita los tipos de la API y el cliente de Prisma generado).
   - **Settings** (iguales en los dos entornos; región **US East**, cerca de la base de Supabase; restart *On failure*):

     | | `api` | `web` |
     |---|---|---|
     | Build command | — (el `bun install` ya genera Prisma) | `bun run --cwd apps/web build` |
     | Start command | `bun run --cwd apps/api start` | `bun apps/web/server.ts` |
     | Healthcheck | `/health` | `/` |
     | Watch paths | `apps/api/**`, `bun.lock`, `package.json` | `apps/web/**`, `apps/api/src/**`, `bun.lock`, `package.json` |

     > Están en el dashboard, no en el repo: Railway deprecó los `railway.json` (*Config as Code*) y no los acepta en servicios nuevos. Su reemplazo es `.railway/railway.ts` (*Infrastructure as Code*); si algún día se quiere la config en el repo, es por ahí.
   - **GitHub:** la app de Railway instalada en la org `kachingga` con acceso al repo (si no, Railway no puede deployar solo en cada push).
   - **Ojo al conectar el repo a un servicio:** Railway crea el trigger de deploy en **todos** los entornos, también `production`, con la branch que hayas elegido. Después revisar en cada entorno que la branch sea la correcta (`main` en staging, `production` en prod) y que "Wait for CI" esté activado.
   - **Versión de Bun:** Railway (Railpack) usa la última que encuentra (hoy 1.4.x); el CI usa la fijada en `.github/workflows/ci.yml` (1.3.12). Si algo anda en el CI y no en Railway (o al revés), empezar por ahí.
   - **Branch:** `main` en `staging`, `production` en `production`, con **"Wait for CI"** activado.
3. **Variables** de cada servicio y entorno: `INFRA.md` → "Variables de entorno". Staging usa la base `staging-kachingga` (valores de `apps/api/.env` / `apps/web/.env`, salvo las URLs); prod, la base `kachingga` (`apps/api/.env.prod`). En la API, `NODE_ENV=production` en los dos.
4. **Dominios:** en cada servicio y entorno, *Settings → Networking → Custom Domain* (`kachingga.com`, `api.kachingga.com`, `staging.kachingga.com`, `api-staging.kachingga.com`). Railway da un CNAME por dominio: cargarlo en Cloudflare → DNS en modo **"DNS only"** (nube gris), así Railway emite el certificado.
5. **URLs de auth en Supabase** (Site URL y Redirect URLs de cada base): `INFRA.md` → "Supabase".
6. **Límite de pedidos por IP** ✅ verificado en staging (nov 2026): la API toma el **último** valor de `X-Forwarded-For`, que en Railway es la IP real del cliente. Un `X-Forwarded-For` falso no esquiva el límite (25 pedidos a `groups.preview`, cada uno con otro valor, cortan en 429). Si Railway cambia cómo arma el header, ajustar `clientIp` en `apps/api/src/lib/rateLimit.ts`.
7. **Branch `production`** creada desde `main`, con protección contra force-push y borrado.
8. Comprobar: `GET /health` de cada API responde, y en cada web se puede registrar, loguear y cargar un gasto.

> La web se sirve con `apps/web/server.ts` (Bun): archivos de `apps/web/dist`, todas las rutas a `index.html` (las resuelve React Router) y cache largo en `/assets/*` (tienen hash en el nombre). Las `VITE_*` se leen al buildear: si se cambian en Railway, hay que redeployar `web`.

## Deploys habituales

### Staging — automático

Mergear un PR a `main` → Railway espera el CI y deploya en **staging** solo lo que cambió (watch paths de cada servicio). Se prueba en `https://staging.kachingga.com`.

### Pasar a prod — "Promover a producción"

1. Probar en staging.
2. Si hay **migraciones nuevas**: `bun run --cwd apps/api db:migrate:prod` (prod antes que el código nuevo: el código espera el schema nuevo).
3. GitHub → Actions → **"Promover a producción"** → *Run workflow* (o `gh workflow run promote.yml`). Hace avanzar `production` hasta `main` (solo fast-forward: nunca reescribe historia) y Railway deploya prod.
4. Comprobar `https://api.kachingga.com/health` y abrir `https://kachingga.com`. Todos ven la versión nueva al recargar (o al volver a abrir la app desde la pantalla de inicio).

### Cambios de schema

1. Cambiar el schema (`apps/api/src/db/models/*.prisma`) y generar la migración contra **dev**:
   ```bash
   cd apps/api
   bun run db:migrate:new <nombre>   # genera el SQL sin tocar la base
   ```
2. Revisar el SQL, aplicarlo en **dev** (que es también la base de staging) y probar:
   ```bash
   bun run db:migrate:deploy         # dev / staging (.env)
   ```
   Hacerlo **antes de mergear** el PR que la usa, así staging arranca con el schema nuevo.
3. Mergear → staging.
4. Antes de promover: aplicarla en **prod** y recién ahí "Promover a producción":
   ```bash
   bun run db:migrate:prod           # prod (.env.prod)
   ```

Nunca usar `prisma migrate reset` ni `prisma db push` contra ninguna base.

## Backups

**Qué:** cada lunes a las 06:00 UTC, `.github/workflows/backup.yml` hace un `pg_dump` de la base de **prod** (schemas `public` = los datos de la app, y `auth` = las cuentas de Supabase), formato custom (`-Fc`). **Dónde:** como artifact del run en GitHub Actions (`kachingga-prod-AAAA-MM-DD`), **90 días** (~12 backups). Si falla, GitHub le manda un mail a quien tocó el cron por última vez.

**Siempre cifrado:** el repo es público y cualquiera logueado en GitHub puede bajar los artifacts. El dump pasa directo a `gpg` (AES256) con `BACKUP_PASSPHRASE`: nunca queda un archivo sin cifrar. **Sin la passphrase los backups no se abren**: está en `apps/api/.env.prod` y tiene que estar también en el gestor de contraseñas de Galo.

**Setup (una vez, desde la raíz del repo):** carga los dos secrets del repo (`INFRA.md` → "GitHub") sin mostrarlos:

```bash
grep '^DIRECT_URL=' apps/api/.env.prod | cut -d= -f2- | tr -d '"' | gh secret set BACKUP_DATABASE_URL --repo kachingga/kachingga
p=$(openssl rand -base64 32); echo "BACKUP_PASSPHRASE=$p" >> apps/api/.env.prod; printf %s "$p" | gh secret set BACKUP_PASSPHRASE --repo kachingga/kachingga; unset p
```

Después, guardar la passphrase en el gestor de contraseñas y correrlo una vez a mano para probarlo.

**Correrlo a mano:** `gh workflow run backup.yml` (o Actions → "Backup semanal de prod" → *Run workflow*).

**Restaurar** (necesita `gpg` y el cliente de Postgres 17: `brew install gnupg libpq`):

```bash
gh run list --workflow backup.yml                 # elegir el run
gh run download <run-id> --dir backup             # baja backup/<nombre>/<nombre>.dump.gpg
gpg -d -o kachingga.dump backup/*/*.dump.gpg      # pide la passphrase
pg_restore --list kachingga.dump | less           # ver qué tiene
```

- **Lo normal es restaurar `public` (los datos de la app) en una base nueva o vacía**, nunca encima de prod sin pensarlo: `pg_restore --schema=public --no-owner --no-privileges -d "<DIRECT_URL de la base destino>" kachingga.dump`. Después `bun run --cwd apps/api db:migrate:status` contra esa base para confirmar que el schema coincide con las migraciones.
- **`auth` es de Supabase:** las tablas ya existen en cualquier proyecto y Supabase las maneja. No restaurar el schema entero; si hace falta recuperar cuentas, restaurar solo los datos de `auth.users` / `auth.identities` (`pg_restore --data-only --table=...`) en un proyecto **nuevo**, y probarlo antes. Sin las cuentas, los participantes quedan sin dueño (sus gastos y saldos no se pierden).
- Antes de restaurar algo en prod, hacer un backup a mano de cómo está.

---

## Rollback

- **API y web:** Railway guarda el historial de cada servicio y entorno — *Redeploy* de un deploy anterior desde el dashboard. Si el problema ya está en `main`, revertirlo con un PR (`revert`) y volver a promover.
- **Base de datos:** las migraciones son append-only. Si una rompe algo, se arregla con otra migración.
