# Guía de deploy

## Servicios

| Servicio | Proveedor | Cómo se deploya |
|----------|-----------|-----------------|
| API | Railway | Auto-deploy en push a `main` |
| **Web (front principal)** | Vercel | Auto-deploy en push a `main`; preview por cada PR |
| App mobile (binario, alternativa nativa) | EAS Build | Manual, solo cuando cambia código nativo |
| App mobile (JS, alternativa nativa) | EAS Update | En cada push a `main` (OTA) |

---

## Setup inicial (una vez)

### 1. Railway — API

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → `kachingga/kachingga`
2. **Root Directory:** vacío (raíz del repo) — así Railway usa el `bun.lock` del monorepo
3. **Start Command:** `bun run --cwd apps/api start` (el `bun install` ya corre `prisma generate` por el postinstall)
4. **Watch Paths:** `apps/api/**` y `bun.lock` — para no redeployar la API por cambios solo de la app
5. **Healthcheck Path:** `/health`
   - **Verificar el límite de pedidos por IP:** la API toma la IP del **último** valor de `X-Forwarded-For`. En el primer deploy, confirmar que Railway lo setea así (ej. loguear temporalmente el header en un pedido y comparar con tu IP pública). Si no, ajustar `clientIp` en `apps/api/src/lib/rateLimit.ts`.
6. Agregar las variables de entorno (ver `INFRA.md`), incluida `CORS_ORIGINS` con la URL de Vercel (se completa después del paso 2)
7. Deploy y copiar el dominio a `INFRA.md`

### 2. Vercel — Web

> Todavía no se deployó nunca: el `vercel.json` está armado pero sin probar contra Vercel. Verificarlo en el primer deploy.

1. [vercel.com](https://vercel.com) → Add New → Project → importar `kachingga/kachingga`.
2. **Root Directory:** vacío (raíz del repo). Toma la configuración del `vercel.json` de la raíz: instala el monorepo con Bun (la web necesita los tipos de la API y el cliente de Prisma generado), buildea `apps/web` y sirve `apps/web/dist`, mandando todas las rutas a `index.html` (las resuelve React Router).
3. **Variables de entorno** (Production): `VITE_API_URL` (URL de Railway), `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` **de prod** (ver `INFRA.md`).
4. Deploy y copiar el dominio a `INFRA.md`.
5. En Railway, poner ese dominio en `CORS_ORIGINS` (si no, el navegador bloquea los pedidos a la API).
6. En cada PR, Vercel publica un *preview* con su propia URL: para que funcione contra la API habría que sumarla a `CORS_ORIGINS` (o no usar los previews contra prod).

### 3. EAS — App mobile (solo si se hace la app nativa)

✅ Hecho: proyecto vinculado a la org `kachingga` en expo.dev, `eas.json` creado y EAS Update configurado (`expo-updates`, `runtimeVersion` con política `fingerprint`).

Cada miembro solo necesita estar invitado a la org de Expo y loguearse:

```bash
cd apps/mobile
bunx eas-cli login
```

Perfiles de `eas.json`:
- `development` — development build para desarrollar (canal `development`). Requiere agregar `expo-dev-client` la primera vez que se use.
- `preview` — instalación interna, APK en Android, canal `main`, variables `production`. **Es el que instalan los Android del grupo.**
- `production` — build para las stores, canal `main`, variables `production`. **Es el que va a TestFlight para los iPhone del grupo.** Al publicar en las stores (`PENDIENTES.md` → Lanzamiento → Fase 2) probablemente convenga separarle un canal propio.

> Todo el grupo (iPhone y Android) está en el canal `main`: un update OTA les llega a todos.

> `runtimeVersion` usa la política `fingerprint`: EAS calcula un hash del código nativo. Si cambia (librería nativa nueva, plugin, SDK), los builds viejos dejan de recibir updates y hay que hacer un build nuevo.

### 4. Instalar la app nativa en cada teléfono (solo si se hace la app nativa)

Checklist completo en `PENDIENTES.md` → Lanzamiento → Fase 1. **Los builds solo se lanzan cuando alguien lo pide explícitamente.**

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

### Cambios en la API (sin cambios de schema)

Push a `main` → Railway deploya solo.

### Cambios en la API (con cambios de schema)

**Siempre migrar prod antes de pushear el código nuevo.** El código nuevo espera el schema nuevo.

1. Cambiar el schema (`apps/api/src/db/models/*.prisma`) y generar la migración contra **dev**:
   ```bash
   cd apps/api
   bun run db:migrate:new <nombre>   # genera el SQL sin tocar la base
   ```
2. Revisar el SQL, aplicarlo en **dev** y probar:
   ```bash
   bun run db:migrate:deploy         # dev (.env)
   ```
3. Aplicarlo en **prod**:
   ```bash
   bun run db:migrate:prod           # prod (.env.prod)
   ```
4. Pushear a `main` → Railway deploya el código nuevo con el schema ya actualizado

Nunca usar `prisma migrate reset` ni `prisma db push` contra prod.

### Cambios en la web — automático

Mergear a `main` → Vercel deploya solo. Todos ven la versión nueva al recargar (o al volver a abrir la app desde la pantalla de inicio).

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

1. **API en Railway** deployada (ver "Setup inicial" → Railway) y su URL en `INFRA.md`.
2. **Variables de prod en EAS**, entorno `production` (las usan el build `preview` y los updates): `EXPO_PUBLIC_API_URL` (URL de Railway), `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de prod (valores en `apps/mobile/.env.prod`). Desde expo.dev → proyecto → Environment variables, o `bunx eas-cli env:create --environment production`.
3. **Primer build `preview`** instalado en los teléfonos (solo cuando alguien lo pida).
4. **Token:** expo.dev → org `kachingga` → Settings → Access tokens (idealmente de un *robot user*) → guardarlo como secret de GitHub: `gh secret set EXPO_TOKEN --repo kachingga/kachingga`.
5. Probar con Actions → "EAS Update" → *Run workflow*, y después sacar este ítem de `PENDIENTES.md` y cerrar el issue #6.

---

## Rollback

- **API:** Railway guarda el historial — rollback desde el dashboard.
- **App (OTA):** `bunx eas-cli update:republish` de un update anterior, o `eas update:rollback`.
- **Base de datos:** las migraciones son append-only. Si una rompe algo, se arregla con otra migración.
