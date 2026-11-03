# Guía de deploy

## Servicios

| Servicio | Proveedor | Cómo se deploya |
|----------|-----------|-----------------|
| API | Railway | Auto-deploy en push a `main` |
| App mobile (binario) | EAS Build | Manual, solo cuando cambia código nativo |
| App mobile (JS) | EAS Update | En cada push a `main` (OTA) |

---

## Setup inicial (una vez)

### 1. Railway — API

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → `kachingga/kachingga`
2. **Root Directory:** vacío (raíz del repo) — así Railway usa el `bun.lock` del monorepo
3. **Start Command:** `bun run --cwd apps/api start` (el `bun install` ya corre `prisma generate` por el postinstall)
4. **Watch Paths:** `apps/api/**` y `bun.lock` — para no redeployar la API por cambios solo de la app
5. **Healthcheck Path:** `/health`
6. Agregar las variables de entorno (ver `INFRA.md`)
7. Deploy y copiar el dominio a `INFRA.md`

### 2. EAS — App mobile

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

### 3. Instalar la app en cada teléfono

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

### Cambios en la app (solo JS/TS/assets) — automático

Al mergear un PR que toca `apps/mobile/**` (o `apps/api/src/schemas.ts`, o `bun.lock`), el workflow `.github/workflows/eas-update.yml` publica un update OTA al canal `main` con las variables del entorno **production** de EAS. Todos reciben la versión nueva la próxima vez que abren la app.

> **Hoy está inactivo:** solo publica si existe el secret `EXPO_TOKEN` en GitHub. Ver "Activar EAS Update automático" abajo.

A mano (solo si hace falta, ej. un hotfix sin PR — que con `main` protegido no debería pasar):
```bash
cd apps/mobile
bunx eas-cli update --channel main --environment production --message "fix(mobile): ..."
```

### Cambios en la app con código nativo

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
