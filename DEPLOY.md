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
2. **Root Directory:** `apps/api`
3. **Start Command:** `bun src/index.ts`
4. Agregar las variables de entorno (ver `INFRA.md`)
5. Deploy y copiar el dominio a `INFRA.md`

### 2. EAS — App mobile

✅ Hecho: proyecto vinculado a la org `kachingga` en expo.dev, `eas.json` creado y EAS Update configurado (`expo-updates`, `runtimeVersion` con política `fingerprint`).

Cada miembro solo necesita estar invitado a la org de Expo y loguearse:

```bash
cd apps/mobile
bunx eas-cli login
```

Perfiles de `eas.json`:
- `development` — development build para desarrollar (canal `development`). Requiere agregar `expo-dev-client` la primera vez que se use.
- `preview` — instalación interna, APK en Android, canal `main`. **Es el que instala cada uno en su teléfono.**
- `production` — para stores, si algún día hace falta (canal `production`).

> `runtimeVersion` usa la política `fingerprint`: EAS calcula un hash del código nativo. Si cambia (librería nativa nueva, plugin, SDK), los builds viejos dejan de recibir updates y hay que hacer un build nuevo.

### 3. Instalar la app en cada teléfono

- **Android:** `bunx eas-cli build --profile preview --platform android` → genera un APK; se instala desde el link/QR que da EAS.
- **iOS:** requiere cuenta de Apple Developer. Registrar cada iPhone con `bunx eas-cli device:create` (antes del build), después `bunx eas-cli build --profile preview --platform ios`. Alternativa: TestFlight con `eas submit`.

---

## Deploys habituales

### Cambios en la API (sin cambios de schema)

Push a `main` → Railway deploya solo.

### Cambios en la API (con cambios de schema)

**Siempre migrar prod antes de pushear el código nuevo.** El código nuevo espera el schema nuevo.

1. Hacer y probar los cambios de schema en local
2. Aplicar la migración en prod desde local:
   ```bash
   cd apps/api
   bun run db:migrate:prod   # prisma migrate deploy con .env.prod (DIRECT_URL de Supabase)
   ```
3. Pushear a `main` → Railway deploya el código nuevo con el schema ya actualizado

Nunca usar `prisma migrate reset` ni `prisma db push` contra prod.

### Cambios en la app (solo JS/TS/assets)

```bash
cd apps/mobile
bunx eas-cli update --channel main --message "feat(mobile): ..."
```

Todos reciben la versión nueva la próxima vez que abren la app (idealmente automatizado con GitHub Actions, ver `IMPROVEMENTS.md`).

### Cambios en la app con código nativo

Si se agrega una librería nativa, se cambia `app.json`/plugins o se sube el SDK de Expo: hay que subir el `runtimeVersion`, hacer un **nuevo build** y que cada uno lo reinstale. Un update OTA no alcanza.

---

## Rollback

- **API:** Railway guarda el historial — rollback desde el dashboard.
- **App (OTA):** `bunx eas-cli update:republish` de un update anterior, o `eas update:rollback`.
- **Base de datos:** las migraciones son append-only. Si una rompe algo, se arregla con otra migración.
