# Guía de deploy

## Servicios

| Servicio | Proveedor | Cómo se deploya |
|----------|-----------|-----------------|
| API y web — **staging** | Railway, entorno `staging` | Automático en cada merge a `main` (espera el CI) |
| API y web — **prod** | Railway, entorno `production` | Desde la branch `production`, con `bun run promote` |

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

> La web se sirve con `apps/web/server.ts` (Bun): archivos de `apps/web/dist`, todas las rutas a `index.html` (las resuelve React Router), cache largo en `/assets/*` (tienen hash en el nombre) y los headers de seguridad. La CSP va como Report-Only hasta cargar `CSP_ENFORCE=true` en el servicio `web` (cuándo y cómo: `docs/claude/web/servidor-y-headers.md`). Las `VITE_*` se leen al buildear: si se cambian en Railway, hay que redeployar `web`.

## Deploys habituales

### Staging — automático

Mergear un PR a `main` → Railway espera el CI y deploya en **staging** solo lo que cambió (watch paths de cada servicio). Se prueba en `https://staging.kachingga.com`.

### Pasar a prod — `bun run promote`

1. Probar en staging.
2. Si hay **migraciones nuevas**: `bun run --cwd apps/api db:migrate:prod` (prod antes que el código nuevo: el código espera el schema nuevo).
3. **`bun run promote`** desde la raíz (`scripts/promote.ts`): hace avanzar `production` hasta `origin/main` (solo fast-forward: nunca reescribe historia), muestra qué va a prod y Railway deploya. Si hay migraciones nuevas sin aplicar, frena: aplicarlas en prod y correr `bun run promote --migrated`.
   - **Se corre desde la máquina de un miembro, no desde GitHub Actions:** si el push lo hace un bot (`github-actions[bot]`), Railway deja los deploys de prod en *Needs approval* (pasó con el workflow que había antes). Si igual aparece, se aprueban en Railway → `kachingga` → `production` → cada servicio → *Approve*.
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
4. Antes de promover: aplicarla en **prod** y recién ahí `bun run promote --migrated`:
   ```bash
   bun run db:migrate:prod           # prod (.env.prod)
   ```

Nunca usar `prisma migrate reset` ni `prisma db push` contra ninguna base.

## Backups

**Qué:** todos los días a las 06:00 UTC (03:00 en Argentina), `.github/workflows/backup.yml` hace un `pg_dump` de la base de **prod** (schemas `public` = los datos de la app, y `auth` = las cuentas de Supabase), formato custom (`-Fc`). **Dónde:** como artifact del run en GitHub Actions (`kachingga-prod-AAAA-MM-DD`), **90 días** (~90 backups). Si falla, GitHub le manda un mail a quien tocó el cron por última vez.

**Además mide el tamaño de la base de prod** (último paso, después de subir el backup) y falla si pasa los **350 MB**: ver "Monitoreo" → "Tamaño de la base". Ese aviso no frena el backup, y un backup que falla no saltea el aviso.

**Siempre cifrado:** el repo es público y cualquiera logueado en GitHub puede bajar los artifacts. El dump pasa directo a `gpg` (AES256) con `BACKUP_PASSPHRASE`: nunca queda un archivo sin cifrar. **Sin la passphrase los backups no se abren**: está en `apps/api/.env.prod` y tiene que estar también en el gestor de contraseñas de Galo.

**Sin sesiones vivas:** de `auth.sessions`, `auth.refresh_tokens`, `auth.one_time_tokens`, `auth.mfa_amr_claims` (cuelga de las sesiones) y `auth.flow_state` (el login con Google en curso) se guarda la estructura pero no los datos (`--exclude-table-data`): con un backup filtrado nadie puede usar una sesión. Al restaurar, todos tienen que volver a loguearse.

**Los secrets solo los ve `main`:** el job corre en el **environment `backup`**, restringido a `main`, y los dos secrets están ahí (no en los del repo). Así, un workflow de otra branch o de un PR no puede leer la credencial de prod.

**Setup (una vez):**

1. GitHub → repo → *Settings → Environments → New environment* → `backup`. En *Deployment branches and tags*: *Selected branches and tags* → agregar `main`. Sin reviewers (el cron tiene que correr solo).
2. Si todavía no hay passphrase (primera vez): `echo "BACKUP_PASSPHRASE=$(openssl rand -base64 32)" >> apps/api/.env.prod` y guardarla en el gestor de contraseñas.
3. Cargar los dos secrets en el environment sin mostrarlos (desde la raíz del repo):

   ```bash
   grep '^DIRECT_URL=' apps/api/.env.prod | cut -d= -f2- | tr -d '"' | gh secret set BACKUP_DATABASE_URL --env backup --repo kachingga/kachingga
   grep '^BACKUP_PASSPHRASE=' apps/api/.env.prod | cut -d= -f2- | tr -d '"' | gh secret set BACKUP_PASSPHRASE --env backup --repo kachingga/kachingga
   ```

4. Correrlo una vez a mano desde `main` (abajo) y comprobar que el run pasa y deja el artifact.
5. Si quedaron copias en los secrets del repo (de antes del environment), borrarlas: si no, cualquier workflow las sigue pudiendo leer. `gh secret delete BACKUP_DATABASE_URL --repo kachingga/kachingga` y lo mismo con `BACKUP_PASSPHRASE`.

**Imagen de Postgres fijada por digest** (`postgres:17@sha256:…` en `backup.yml`): Dependabot no la actualiza. Cada tanto, o si Supabase pasa la base a una versión mayor (el `pg_dump` tiene que ser de la misma versión o más nueva), tomar el digest nuevo con `docker buildx imagetools inspect postgres:17` (la línea `Digest:` de arriba) y actualizarlo junto con la versión del comentario.

**Correrlo a mano:** `gh workflow run backup.yml` (o Actions → "Backup diario de prod" → *Run workflow*).

**Restaurar** (necesita `gpg` y el cliente de Postgres 17: `brew install gnupg libpq`):

```bash
gh run list --workflow backup.yml                 # elegir el run
gh run download <run-id> --dir backup             # baja backup/<nombre>/<nombre>.dump.gpg
gpg -d -o kachingga.dump backup/*/*.dump.gpg      # pide la passphrase
pg_restore --list kachingga.dump | less           # ver qué tiene
```

- **Lo normal es restaurar `public` (los datos de la app) en una base nueva o vacía**, nunca encima de prod sin pensarlo: `pg_restore --schema=public --no-owner --no-privileges -d "<DIRECT_URL de la base destino>" kachingga.dump`. Después `bun run --cwd apps/api db:migrate:status` contra esa base para confirmar que el schema coincide con las migraciones.
- Si `pg_restore` avisa `schema "public" already exists` (el dump incluye el `CREATE SCHEMA`), es esperable: restaura igual lo demás.
- **`auth` es de Supabase:** las tablas ya existen en cualquier proyecto y Supabase las maneja. No restaurar el schema entero; si hace falta recuperar cuentas, restaurar solo los datos de `auth.users` / `auth.identities` (`pg_restore --data-only --table=...`) en un proyecto **nuevo**, y probarlo antes. Sin las cuentas, los participantes quedan sin dueño (sus gastos y saldos no se pierden).
- Antes de restaurar algo en prod, hacer un backup a mano de cómo está.
- **Probado el 10/11/2026** (#109) con el backup del día, en un Postgres 17 local descartable (Docker, la misma imagen que el backup): descifrado al vuelo (`gpg -d … | docker exec -i <contenedor> pg_restore …`, así el dump sin cifrar no queda en disco), `public` restaurado sin errores, `db:migrate:status` al día con las migraciones de `main`, RLS en todas las tablas, y en `auth` solo datos de usuarios e identidades (ninguna sesión). Después se borró todo. Repetirlo de vez en cuando (ej. cada unos meses o al cambiar `backup.yml`).

---

## Monitoreo

- **Errores:** Sentry, proyectos `kachingga-web` y `kachingga-api`. Solo errores inesperados, sin datos de los grupos (cómo: `docs/claude/repo/monitoreo.md`). Para prenderlo en un entorno, cargar las variables de Sentry de `INFRA.md` en los servicios `api` y `web` de ese entorno y redeployar. Alertas: Sentry → Alerts → mail a Galo en errores nuevos y en picos.
- **Caídas:** UptimeRobot (plan gratis, cuenta de Galo), cada 5 minutos con aviso por mail a Galo:
  - **Webs** — monitor *HTTP(s)* (avisa si no responde 200): `https://kachingga.com` y `https://staging.kachingga.com`.
  - **APIs** — monitor *Keyword* con `"ok":true` y *alert when keyword not exists*, a **`/health/db`**: `https://api.kachingga.com/health/db` y `https://api-staging.kachingga.com/health/db`. A diferencia de `/health` (que usa Railway para los deploys y solo dice que el proceso está vivo), `/health/db` hace un `SELECT 1` contra la base: avisa si la base está caída o pausada, y el ping cada 5 minutos mantiene activos los proyectos de Supabase (plan Free). Tiene el mismo límite por IP que el resto de la API.
- **Tamaño de la base:** el backup diario (`backup.yml`, paso "Check database size") mide `pg_database_size` de la base de prod y **falla con "La base de prod ocupa N MB…"** si pasa los **350 MB** (`ALERT_MB` en el paso). GitHub manda el mail como cualquier falla del backup. El tamaño de cada día queda en el log del paso. Supabase Free da **500 MB para toda la org, sumando prod y staging** (detalle: `INFRA.md` → "Plan de Supabase"); 350 MB de prod deja lugar para staging y para lo que Supabase ya ocupa en cada proyecto. **Si salta:**
  1. **Ver qué crece:** en Supabase, la página *Usage* de la org (el tamaño que cuenta para la cuota) y, en el SQL editor de prod, solo consultas de lectura: las tablas más grandes (`select schemaname, relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_statio_user_tables order by pg_total_relation_size(relid) desc limit 10;`) y los grupos con más gastos (`select "groupId", count(*) from "Expense" group by 1 order by 2 desc limit 10;`; lo mismo con `"Settlement"`). Mirar también staging: cuenta para los 500 MB.
  2. **Si es basura** (alguien cargando gastos falsos, datos de prueba o de los E2E en staging): decidirlo con el grupo, hacer antes un backup a mano (`gh workflow run backup.yml`) y borrar esas filas de verdad (las borradas con borrado lógico siguen ocupando lugar). Después de borrar mucho, Supabase recomienda correr un `VACUUM`. Si vino de una cuenta, ver si hay que bajar los cupos (`lib/quotas.ts`) o el límite de escrituras (`lib/rateLimit.ts`).
  3. **Si es uso real:** pasar la org a **Supabase Pro** (pago; precios en supabase.com/pricing). Es una decisión de costos: issue + `docs/decisiones/costos-y-alternativas.md`. Subir `ALERT_MB` solo si cambió el plan.
- Los avisos van a un mail personal, no a `devops@`: si el reenvío del dominio falla, igual llegan.
- **Probarlo después de prenderlo:** un error forzado (ej. desde la consola del navegador en staging: `setTimeout(() => { throw new Error('prueba sentry') })`) tiene que aparecer en Sentry con el `environment` correcto y sin datos personales.

---

## Rollback

- **API y web:** Railway guarda el historial de cada servicio y entorno — *Redeploy* de un deploy anterior desde el dashboard. Si el problema ya está en `main`, revertirlo con un PR (`revert`) y volver a promover.
- **Base de datos:** las migraciones son append-only. Si una rompe algo, se arregla con otra migración.
