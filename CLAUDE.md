# Kachingga — App para dividir gastos en grupo

Referencia principal del proyecto. Antes de tocar lógica de dominio o agregar una feature, leé este archivo y el documento de la versión correspondiente. Los `CLAUDE.md` de cada workspace cubren solo detalles de implementación.

Proyecto de **Kachingga**, una organización de amigos (repo: `github.com/kachingga/kachingga`). Es para uso propio del grupo: cada uno tiene la app instalada en su teléfono y usa siempre la última versión.

---

## Mapa de documentos

| Archivo | Qué tiene |
|---------|-----------|
| `CLAUDE.md` | Este archivo: overview, stack, estructura, comandos, notas técnicas, conflictos y reglas de commits |
| `.claude/CLAUDE.md` | Guías de comportamiento para Claude (pensar antes de codear, simplicidad, cambios quirúrgicos) |
| `.claude/settings.json` | Config compartida de Claude Code (plugin de Expo). Lo personal va en `.claude/settings.local.json` / `CLAUDE.local.md` (gitignoreados) |
| `README.md` | Qué es la app y onboarding de cada miembro (accesos, herramientas, setup) |
| `V1.md` | Alcance de la v1: grupos, gastos, saldos, filtros, multimoneda. **Lo que se construye ahora** |
| `V2.md` | Alcance de la v2: agente de gastos con IA e integración con Mercado Pago. **No implementar hasta cerrar v1** |
| `INFRA.md` | Servicios, dashboards, variables de entorno, secretos |
| `DEPLOY.md` | Cómo deployar la API (Railway) y distribuir la app (EAS Build / EAS Update) |
| `IMPROVEMENTS.md` | Mejoras de infraestructura pendientes (CI, staging, backups) |
| `apps/mobile/CLAUDE.md` | Reglas de Expo / React Native para la app mobile |
| `apps/api/CLAUDE.md` | Reglas de la API: Hono + tRPC + Prisma, comandos de DB y migraciones |

> **Alcance:** si una tarea toca algo de `V2.md` (agente o Mercado Pago), frená y preguntá antes de implementarlo. Todo lo demás es v1.

---

## Idioma

- UI en **español**.
- Código (variables, funciones, tipos, comentarios) en **inglés**.
- Documentación del repo y mensajes de commit en español (el `type(scope)` va en inglés, ver abajo).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime / package manager | Bun (monorepo con workspaces) |
| Mobile | React Native con Expo (SDK 58) + Expo Router |
| Distribución mobile | EAS Build (instalación interna) + EAS Update (OTA) |
| Backend | Hono + TypeScript sobre Bun |
| API (contrato app ↔ backend) | tRPC sobre Hono (`@hono/trpc-server`) + Zod |
| Data fetching en la app | `@trpc/tanstack-react-query` + TanStack Query |
| Hosting backend | Railway |
| Base de datos | PostgreSQL en Supabase |
| ORM | Prisma |
| Auth | Supabase Auth — email + password |
| Agente (v2) | API de LLM con tool calling sobre los datos del grupo |
| Pagos (v2) | API de Mercado Pago |

---

## Auth

Login simple con **email + password** usando **Supabase Auth**.

- **App:** usa `@supabase/supabase-js` solo para auth (login, logout, sesión persistida y refresh del token). Con la clave **publishable** de Supabase (es pública, se puede embeber en la app).
- **API:** cada request lleva `Authorization: Bearer <access_token>`. El `createContext` de tRPC valida el token contra Supabase y deja el usuario en el contexto. Todo usa `protectedProcedure` (falla con `UNAUTHORIZED` si no hay usuario) salvo lo que se marque explícitamente como `publicProcedure`.
- **Datos:** la app **nunca** lee ni escribe la base directo — todo pasa por la API. La API es la que decide qué grupos/gastos puede ver cada usuario.
- **Usuarios:** al ser un grupo de amigos, alcanza con signup por email + password (o crear los usuarios desde el dashboard de Supabase). Sin login social ni magic link en v1.
- La clave **secret** de Supabase (`sb_secret_...`) vive solo en Railway.

---

## tRPC — tipado de punta a punta

La app y la API se comunican **solo por tRPC**. No hay endpoints REST a mano para features de la app ni tipos de respuesta duplicados.

- **API (`apps/api`):** Hono monta tRPC en `/trpc/*` con `@hono/trpc-server`. Los routers viven en `src/trpc/routers/` (uno por dominio: `groups`, `expenses`, `balances`, …) y se juntan en `appRouter`. El archivo exporta **solo el tipo**: `export type AppRouter = typeof appRouter`.
- **Validación:** todo input se valida con Zod en `.input(...)`. Los schemas que la app también necesite (ej. formularios) se exportan desde la API y se importan en la app.
- **App (`apps/mobile`):** importa `AppRouter` con `import type` desde `@kachingga/api` — **nunca** código de runtime de la API (Prisma, secrets, etc. no pueden terminar en el bundle). Cliente con `httpBatchLink` apuntando a `EXPO_PUBLIC_API_URL/trpc`, que agrega el `Authorization` con el token de Supabase.
- **Tipos derivados:** para tipos de inputs/outputs usar `inferRouterInputs<AppRouter>` / `inferRouterOutputs<AppRouter>`. No redefinir a mano tipos que ya salen del router.
- **Errores:** tirar `TRPCError` con el `code` correcto (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`, …). Mapear errores de Prisma conocidos (P2002 → `CONFLICT`, P2025 → `NOT_FOUND`) en un solo lugar.
- **Transformer:** `superjson`, así `Date` y similares viajan con su tipo.
- **Fuera de tRPC:** solo lo que llama un tercero y no la app — `GET /health` y, en v2, el webhook de Mercado Pago. Esas sí son rutas Hono normales.

---

## Estructura del monorepo

```
kachingga/
├── .claude/
│   ├── CLAUDE.md            # guías de comportamiento
│   └── settings.json        # config compartida de Claude Code
├── .husky/
│   ├── commit-msg           # valida el formato de commits
│   └── pre-commit           # corre `bun run check` (typecheck + tests + lint)
├── apps/
│   ├── mobile/              # app Expo (@kachingga/mobile, ver apps/mobile/CLAUDE.md)
│   │   └── src/
│   │       ├── app/         # rutas de Expo Router
│   │       └── lib/trpc.ts  # cliente tRPC tipado con AppRouter
│   └── api/                 # API Hono + tRPC (@kachingga/api, ver apps/api/CLAUDE.md)
│       └── src/
│           ├── index.ts     # servidor Hono: /health y /trpc/*
│           ├── trpc/        # init, context, router.ts (AppRouter), routers/
│           └── db/          # schema Prisma (models/*.prisma), migrations, cliente
├── CLAUDE.md
├── V1.md / V2.md
├── INFRA.md / DEPLOY.md / IMPROVEMENTS.md
└── package.json             # workspaces: apps/*
```

> **Dependencias:** nunca agregar paquetes al `package.json` raíz (única excepción: tooling del repo como `husky`). Siempre `cd` al workspace y desde ahí `bun add` (en mobile: `bunx expo install <paquete>`).

---

## Comandos

Desde la raíz (corren en todos los workspaces con `bun --filter`):

```bash
bun install          # instala todo, activa husky y genera el cliente de Prisma
bun run dev          # levanta la API (:3000) y Expo a la vez
bun run api          # solo la API
bun run mobile       # solo Expo
bun run typecheck    # tsc en api y mobile
bun run test         # tests (bun test en api)
bun run lint         # expo lint en mobile
bun run check        # typecheck + test + lint — lo mismo que corre el pre-commit
```

**Antes de dar una tarea por terminada, correr `bun run check`.** El hook de pre-commit de husky lo corre en cada commit y lo rechaza si algo falla.

> Los builds de EAS (`eas build`) solo se lanzan cuando alguien lo pide explícitamente — no son parte del flujo normal. Ver `DEPLOY.md`.

### Variables de entorno

Cada app tiene un `.env.sample` commiteado que dice qué variables hacen falta y de dónde sale cada valor:

- `apps/api/.env.sample` → copiar a `apps/api/.env` (y a `.env.prod` solo para migrar producción)
- `apps/mobile/.env.sample` → copiar a `apps/mobile/.env`

Los `.env` reales están gitignoreados. Si agregás una variable nueva, **agregala también al `.env.sample`** (con un comentario de dónde sale) y a `INFRA.md`.

---

## Notas técnicas — no romper

Decisiones de setup que no son obvias leyendo el código. Si algo de esto molesta, se cambia a propósito y se actualiza esta sección; no se "arregla" de pasada.

### Monorepo y tooling
- **Husky** (`.husky/`) se activa con el script `prepare` en `bun install`. `pre-commit` corre `bun run check`; `commit-msg` valida Conventional Commits y deja pasar `Merge`, `Revert`, `fixup!`, `squash!` y `amend!` (los usa git en merges y rebases).
- `husky` es la única dependencia en el `package.json` raíz. Todo lo demás va en su workspace.
- `bunfig.toml` usa `linker = "hoisted"` (todo en el `node_modules` raíz). Viene así desde el setup inicial de Expo; no cambiarlo sin probar que Metro siga resolviendo los paquetes.
- `bun --filter '*' <script>` corre el script solo en los workspaces que lo tienen (por eso `test` hoy solo corre en la API y `lint` solo en mobile).

### API
- **Prisma fijado en `7.10.1`** (sin `^`), CLI y cliente en la misma versión. El tag `latest` de `prisma` en npm apuntaba a una `8.0.0-rc`; no actualizar con `bun add prisma` a secas.
- `prisma generate` corre en `postinstall`. El cliente generado (`src/db/generated/`) está gitignoreado.
- `prisma.config.ts` usa `process.env.DIRECT_URL ?? ''` y **no** `env('DIRECT_URL')`: con `env()` el `postinstall` falla en cualquier máquina sin `.env` (clones nuevos, Railway en build).
- **Imports relativos sin extensión `.ts`** (`from './init'`): mobile typechequea los archivos de la API (vía el tipo `AppRouter`) con su propio `tsconfig`, que no acepta `.ts` en los imports.
- El cliente de Supabase es **lazy** (`getSupabase()`): importar el router en tests o desde mobile no puede requerir variables de entorno.
- `router.ts` es el entry del paquete (`exports` en `package.json`). Lo que importe no puede arrastrar dependencias que mobile no pueda resolver a nivel de tipos.
- En Railway, `NODE_ENV=production` para que tRPC no devuelva stack traces.

### Mobile
- **TypeScript `~6.0.3`** en mobile y api (la versión que trae el SDK 58 de Expo). No subir a TS 7 en un solo workspace.
- El script `typecheck` crea `expo-env.d.ts` si no existe (lo genera `expo start` y está gitignoreado). Sin ese archivo, `tsc` falla con los imports de CSS.
- `src/components/app-tabs.web.tsx` tiene un cast `props as PressableProps` y `src/hooks/use-color-scheme.web.ts` un `eslint-disable` puntual: son workarounds de tipos/lint del template de Expo. No sacarlos sin correr `bun run check`.
- `src/app/_layout.tsx` envuelve todo en `<ApiProvider>` (tRPC + TanStack Query). Cualquier layout nuevo tiene que quedar **adentro** de ese provider.
- `@kachingga/api` es devDependency de mobile (`workspace:*`) y se importa **solo con `import type`**.
- En desarrollo la URL de la API sale de `Constants.expoConfig.hostUri` (la IP de la máquina que corre Expo) + puerto 3000, salvo que `EXPO_PUBLIC_API_URL` esté definida.
- `app.json`: `owner: "kachingga"`, `extra.eas.projectId`, `updates.url` y `runtimeVersion: { policy: "fingerprint" }` vinculan la app al proyecto de EAS. **No borrarlos ni cambiarlos** — si se pierden, los teléfonos dejan de recibir updates.
- Nombres fijos: `slug`/`scheme` `kachingga`, bundle id iOS y package Android `com.kachingga.app`. Cambiarlos después del primer build obliga a reinstalar en todos los teléfonos.
- Paquetes nuevos en mobile: siempre `bunx expo install`, no `bun add`.

---

## Trabajo en paralelo y conflictos

Somos varios trabajando a la vez. Para no romper el setup de arriba:

### Antes de empezar y antes de pushear
```bash
git pull --rebase origin main
bun install          # por si cambiaron dependencias, hooks o el schema de Prisma
bun run check
```

### Si tenés trabajo local viejo (de antes de este setup)
1. Commitealo en una branch (`git switch -c feat/<lo-que-sea>` + commit). Si el hook rechaza el mensaje, usá el formato `type(scope): ...`.
2. `git rebase origin/main` (o `git merge origin/main`) y resolvé los conflictos como se indica abajo.
3. `bun install && bun run check` antes de pushear.

### Cómo resolver conflictos por archivo
- **`bun.lock`:** nunca resolverlo a mano. Quedarse con la versión de `main` (`git checkout --theirs bun.lock` durante un merge, `--ours` durante un rebase), después `bun install` para que se regenere con los cambios de ambos lados, y `git add bun.lock`.
- **`package.json` (cualquiera):** combinar las dos listas de dependencias y scripts — no descartar las de ningún lado. En mobile, si quedan versiones raras, `bunx expo install --fix`. Después `bun install`.
- **`apps/mobile/app.json`:** combinar a mano. Siempre conservar `owner`, `extra.eas.projectId`, `updates.url`, `runtimeVersion`, `slug`, `scheme`, `ios.bundleIdentifier` y `android.package` tal como están en `main`.
- **`apps/mobile/src/app/_layout.tsx`:** conservar el `<ApiProvider>` envolviendo todo y sumar los cambios del otro lado adentro.
- **`apps/mobile/eas.json`:** conservar los perfiles y canales de `main` (`preview` → canal `main`).
- **`apps/api/src/trpc/router.ts`:** si los dos agregaron routers, quedarse con ambos en el `appRouter`.
- **Schema de Prisma / migraciones:** nunca editar ni borrar una migración que ya está en `main`. Si los dos crearon migraciones, rebasear, borrar **la tuya** (no pusheada), volver a correr `bun run db:migrate:dev` para regenerarla encima de la de `main`, y avisar.
- **Docs (`CLAUDE.md`, `V1.md`, etc.):** combinar ambos textos.

Después de cualquier conflicto: `bun install && bun run check`. Si `check` falla, se arregla antes de commitear — **nunca** `--no-verify`.

---

## Commits — formato obligatorio

Todos los commits usan [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope opcional>): <descripción en minúscula, sin punto final>
```

**Types permitidos:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `build`, `ci`, `revert`

**Scopes sugeridos:** `mobile`, `api`, `db`, `infra`, `deps`, `agent` (v2), `mp` (v2)

Ejemplos:
```
feat(api): agregar endpoint para crear grupos
fix(mobile): corregir cálculo de saldos con decimales
chore: actualizar bun.lock
docs: agregar V1.md y V2.md
refactor(api)!: cambiar formato de respuesta de gastos   # ! = breaking change
```

Reglas para Claude:
- **Nunca** crear un commit que no respete este formato. Si el usuario pide un mensaje que no lo cumple, adaptarlo y avisar.
- Un commit = un cambio lógico. No mezclar `feat` con `chore` no relacionado.
- Los hooks de husky (`.husky/commit-msg` y `.husky/pre-commit`) rechazan mensajes inválidos y código que no pasa `bun run check` — **nunca** usar `--no-verify` para saltearlos. Si un hook falla, arreglar la causa.
- Branches: `feat/<descripcion-corta>`, `fix/<descripcion-corta>`, `chore/<...>`. No commitear directo a `main` salvo que el usuario lo pida.

---

## Decisiones (antes de arrancar la v1)

- [x] Base de datos: PostgreSQL en Supabase.
- [x] Auth: Supabase Auth con email + password.
- [x] Nombre: `Kachingga` (slug/scheme `kachingga`, bundle id iOS y package Android `com.kachingga.app`, org de Expo `kachingga`).
- [x] ORM: Prisma.

Cuando se decida algo, actualizar esta sección, la tabla de stack y `INFRA.md`.
