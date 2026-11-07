# Guía de deploy

## Servicios

| Servicio | Proveedor | Cómo se deploya |
|----------|-----------|-----------------|
| API y web — **staging** | Railway, entorno `staging` | Automático en cada merge a `main` (espera el CI) |
| API y web — **prod** | Railway, entorno `production` | Desde la branch `production`, con el workflow "Promover a producción" |
| App mobile (binario, alternativa nativa) | EAS Build | Manual, solo cuando cambia código nativo |
| App mobile (JS, alternativa nativa) | EAS Update | En cada push a `main` (OTA) |

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

### 2. EAS — App mobile (solo si se hace la app nativa)

✅ Hecho: proyecto vinculado a la org `kachingga` en expo.dev, `eas.json` creado y EAS Update configurado (`expo-updates`, `runtimeVersion` con política `fingerprint`).

Cada miembro solo necesita estar invitado a la org de Expo y loguearse:

```bash
cd apps/mobile
bunx eas-cli login
```

Perfiles de `eas.json`:
- `development` — development build para desarrollar (canal `development`). Requiere agregar `expo-dev-client` la primera vez que se use.
- `preview` — instalación interna, APK en Android, canal `main`, variables `production`. **Es el que instalan los Android del grupo.**
- `production` — build para las stores, canal `main`, variables `production`. **Es el que va a TestFlight para los iPhone del grupo.** Al publicar en las stores (`docs/decisiones/lanzamiento.md` → "Fase 2") probablemente convenga separarle un canal propio.

> Todo el grupo (iPhone y Android) está en el canal `main`: un update OTA les llega a todos.

> `runtimeVersion` usa la política `fingerprint`: EAS calcula un hash del código nativo. Si cambia (librería nativa nueva, plugin, SDK), los builds viejos dejan de recibir updates y hay que hacer un build nuevo.

### 3. Instalar la app nativa en cada teléfono (solo si se hace la app nativa)

Contexto en `docs/decisiones/lanzamiento.md` → "Fase 1" (issues #12 y #6). **Los builds solo se lanzan cuando alguien lo pide explícitamente.**

**Android (APK):**
```bash
cd apps/mobile
bunx eas-cli build --profile preview --platform android
```
Genera un APK; cada uno lo instala desde el link/QR que da EAS (aceptando "instalar apps de fuentes desconocidas").

**iPhone (TestFlight)** — requiere la cuenta de Apple Developer ([#12](https://github.com/kachingga/kachingga/issues/12)):
```bash
cd apps/mobile
bunx eas-cli build --profile production --platform ios   # la primera vez pide loguearse en Apple y genera certificados
bunx eas-cli submit --platform ios --latest               # lo sube a App Store Connect
```
Después, en App Store Connect → la app → TestFlight → *Internal Testing*: agregar a cada amigo (tienen que estar como usuarios del equipo en App Store Connect con su Apple ID). Instalan la app **TestFlight** del App Store y desde ahí Kachingga. No pasa por la revisión de Apple.

> **Expo Go no sirve para usar la app**: carga el proyecto desde la compu de alguien que esté corriendo `expo start` (si se apaga, deja de andar) y no está documentado que abra updates publicados. Sirve para **desarrollar** (`bun run mobile` + escanear el QR).

---

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

### Cambios en la app nativa (solo JS/TS/assets) — automático

Al mergear un PR que toca `apps/mobile/**` (o `apps/api/src/schemas.ts`, o `bun.lock`), el workflow `.github/workflows/eas-update.yml` publica un update OTA al canal `main` con las variables del entorno **production** de EAS. Todos reciben la versión nueva la próxima vez que abren la app.

> **Hoy está inactivo:** solo publica si existe el secret `EXPO_TOKEN` en GitHub. Ver "Activar EAS Update automático" abajo.

A mano (solo si hace falta, ej. un hotfix sin PR — que con `main` protegido no debería pasar):
```bash
cd apps/mobile
bunx eas-cli update --channel main --environment production --message "fix(mobile): ..."
```

### Cambios en la app nativa con código nativo

Si se agrega una librería nativa, se cambia `app.json`/plugins o se sube el SDK de Expo, cambia el **fingerprint** (`runtimeVersion` con política `fingerprint`, se calcula solo): los builds instalados **ignoran** los updates nuevos hasta que se haga un **nuevo build** y cada uno lo reinstale. El workflow igual publica el update, pero solo le llega a builds con el mismo fingerprint.

### Activar EAS Update automático

Recién tiene sentido cuando haya algo que reciba los updates. En orden:

1. **API en Railway** deployada (ver "Setup inicial" → Railway).
2. **Variables de prod en EAS**, entorno `production` (las usan el build `preview` y los updates): `EXPO_PUBLIC_API_URL` (`https://api.kachingga.com`), `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de prod (valores en `apps/mobile/.env.prod`). Desde expo.dev → proyecto → Environment variables, o `bunx eas-cli env:create --environment production`.
3. **Primer build `preview`** instalado en los teléfonos (solo cuando alguien lo pida).
4. **Token:** expo.dev → org `kachingga` → Settings → Access tokens (idealmente de un *robot user*) → guardarlo como secret de GitHub: `gh secret set EXPO_TOKEN --repo kachingga/kachingga`.
5. Probar con Actions → "EAS Update" → *Run workflow*, y después cerrar el issue #6.

---

## Rollback

- **API y web:** Railway guarda el historial de cada servicio y entorno — *Redeploy* de un deploy anterior desde el dashboard. Si el problema ya está en `main`, revertirlo con un PR (`revert`) y volver a promover.
- **App (OTA):** `bunx eas-cli update:republish` de un update anterior, o `eas update:rollback`.
- **Base de datos:** las migraciones son append-only. Si una rompe algo, se arregla con otra migración.
