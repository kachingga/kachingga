# CLAUDE.md — apps/api

> **Reglas de negocio → `CLAUDE.md` raíz.** Leelas antes de implementar o cambiar lógica de dominio. Este archivo es lo **técnico** de la API: reglas cortas que valen siempre + un índice de docs para leer **antes de tocar** cada tema. Si cambia una regla de negocio se actualiza la raíz; si cambia un detalle de implementación, acá o en su doc.

API en Hono + tRPC sobre Bun, con Prisma contra PostgreSQL en Supabase. Paquete `@kachingga/api`: la web importa **solo el tipo** `AppRouter` y los schemas Zod / helpers puros de `@kachingga/api/schemas`.

## Antes de tocar… → leé (y actualizalo si cambiás cómo funciona)

| Antes de tocar… | Leé |
|-----------------|-----|
| Un procedure, un router, un modelo o un schema (agregar, cambiar, o usarlo desde la web) | `docs/claude/api/contrato.md` (modelo, tabla de procedures, dónde vive cada regla, convenciones) |
| Autenticación, acceso a grupos, rate limiting, CORS, RLS | `docs/claude/api/seguridad.md` |
| Errores inesperados y Sentry (`src/lib/monitoring.ts`, el `onError` de tRPC / Hono) | `docs/claude/repo/monitoreo.md` |
| Tests de la API | `docs/claude/api/tests.md` |
| El seed o los usuarios de prueba | `docs/claude/api/datos-de-prueba.md` |

## Reglas que valen siempre

- **Toda regla de negocio se aplica acá**, no en la web. Saldos, divisiones, redondeo y monedas: en `lib/` (dónde vive cada una: `docs/claude/api/contrato.md`).
- **Plata en centavos enteros** (`Int`), nunca `Float`. La suma de las partes es exactamente el total (`distributeCents`).
- **La fecha de un gasto o pago es un día del calendario**: 12:00 UTC, se lee en UTC.
- **Toda query de gastos / pagos filtra `deletedAt: null`** (borrados lógicos).
- Errores con `TRPCError` y mensaje **en español**, sin datos internos.
- `schemas.ts` se comparte con la web: **sin imports del server** (Prisma, Supabase, `process.env`).
- Si agregás o cambiás un procedure o modelo, actualizá `docs/claude/api/contrato.md`.

### Checklist de seguridad para cada procedure nuevo o cambiado
1. `protectedProcedure` (público solo con una razón explícita).
2. Si toca un grupo: `requireMembership` / `requireActiveGroup` **antes** de leer o escribir nada. Si recibe un id de gasto, pago o participante, buscarlo y chequear su `groupId` (nunca confiar en un `groupId` del input para un recurso que ya existe).
3. Ids de participantes en el input → `assertParticipantsInGroup`.
4. Datos de una persona → filtrar por `ctx.user.id`.
5. Input validado con Zod, **con tope en todo**: largo de los textos, montos, ids con `id` de `schemas.ts` (nunca `z.string()` suelto) y `.max()` en todo array. Sin tope, un solo pedido puede llenar la base.
6. **Agregarlo a `src/__tests__/integration/authorization.test.ts`**: en `attacks` si toca un grupo, o en `notGroupScoped` con el motivo. Si es una mutation, además en `archivedWrites` (se rechaza en un grupo archivado) o en `writableWhenArchived` con el motivo. Si no, ese test falla.
7. Si es caro o se presta a fuerza bruta, sumarle un límite en `PROCEDURE_RULES` (`lib/rateLimit.ts`). Si crea filas que crecen con el uso, ¿necesita un cupo? (`lib/quotas.ts`, y la regla en el `CLAUDE.md` raíz).
8. Tests de integración: sin login, no miembro, grupo archivado si escribe, caso feliz y cada regla de negocio (`docs/claude/api/tests.md`).

## Comandos

```bash
bun run dev               # servidor con hot reload en :3000
bun test                  # tests (o `bun test <path>`)
bun run typecheck         # tsc --noEmit

# Base de datos (desde apps/api/)
bun run db:generate              # regenerar el cliente de Prisma (también corre en postinstall)
bun run db:migrate:new <nombre>  # genera el SQL (base actual → schema) + RLS para tablas nuevas. No toca la base
bun run db:migrate:status        # qué migraciones faltan aplicar
bun run db:migrate:deploy        # aplica las pendientes en DEV (.env)
bun run db:migrate:prod          # aplica las pendientes en PROD (.env.prod)
bun run db:studio                # Prisma Studio
bun run db:seed                  # datos de prueba en DEV
```

### Migraciones — reglas
- Nunca correr `prisma db push`, `prisma migrate reset`, `prisma migrate dev` ni `prisma db execute` contra la base. No existe `db:migrate:dev` a propósito (puede pedir resetear la base).
- Nunca tocar a mano la tabla `_prisma_migrations` ni el schema desde el SQL editor de Supabase.
- **Dos bases:** `stg` (`.env`) para todo lo local **y para staging**, y `prod` (`.env.prod`) para producción. Todo comando de DB sin `:prod` va contra **dev**.
- Flujo: cambiar `src/db/models/*.prisma` → `db:migrate:new <nombre>` → **revisar el SQL** → `db:migrate:deploy` (dev, que es también staging) → probar → mergear (deploya a staging) → `db:migrate:prod` → promover a producción (ver `DEPLOY.md`).
- **Nunca correr `db:migrate:prod` sin que la migración esté probada en dev**, y nunca sin que el usuario lo pida explícitamente.
- Toda tabla nueva lleva `ENABLE ROW LEVEL SECURITY` (lo agrega `db:migrate:new`; si escribís SQL a mano, agregalo vos).
- Nunca editar ni borrar una migración que ya está en `main`.
- El CI ("Migraciones al día con el schema") falla si cambiaste `models/*.prisma` sin generar la migración.

## Env

- **`.env` → DEV** (`stg`, ref `nraoqdaplvvsakvtlcam`): lo usan `bun run dev`, los scripts de DB y Prisma Studio.
- **`.env.prod` → PROD** (`prod`, ref `czrkjokurbmbbvobvmxd`): solo para `db:migrate:prod` y como referencia de las variables de Railway. `.env.prod` no lo carga nadie salvo `prisma.config.ts` cuando `PRISMA_ENV_FILE=.env.prod`.
- Ambos gitignoreados; cada línea del `.env.sample` dice de dónde sale el valor. Bun carga `.env` solo. Variables: `DATABASE_URL` (transaction pooler, 6543), `DIRECT_URL` (session pooler, 5432, migraciones), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `PORT`, `CORS_ORIGINS`, `SENTRY_DSN` / `SENTRY_ENVIRONMENT` (vacías = Sentry apagado), `SEED_USER_PASSWORD` (solo dev).

## Arquitectura

```
src/
├── index.ts              # Hono: GET /health, GET /health/db (monitoreo) + tRPC en /trpc/* (antes: límite por IP y de 1 MB)
├── schemas.ts            # Zod + helpers puros compartidos con la web (@kachingga/api/schemas)
├── trpc/                 # init.ts (superjson, errorFormatter, errores Prisma, límite de escrituras, procedures base), context.ts
│                         # (token de Supabase → ctx.user), router.ts (AppRouter), routers/ (uno por dominio)
├── db/                   # schema.prisma (generator + datasource), models/*.prisma (uno por dominio), migrations/,
│                         # index.ts (`prisma`: PrismaClient con @prisma/adapter-pg), generated/ (gitignoreado)
├── lib/                  # access, splits, balances, summary, rates, exportExpenses, paymentAlias, rateLimit, quotas…
└── __tests__/            # bun:test (unit, HTTP, integración con PGlite)
scripts/                  # new-migration.ts (db:migrate:new), seed.ts (db:seed)
```

## Notas técnicas — no romper

- **Prisma fijado en `7.10.1`** (sin `^`), CLI y cliente iguales. El tag `latest` de `prisma` en npm apuntaba a una `8.0.0-rc`: no actualizar con `bun add prisma` a secas.
- `prisma generate` corre en `postinstall`; el cliente generado está gitignoreado.
- `prisma.config.ts` usa `process.env.DIRECT_URL ?? ''` y **no** `env('DIRECT_URL')`: con `env()` el `postinstall` falla sin `.env` (clones nuevos, Railway). Carga el archivo de `PRISMA_ENV_FILE` (default `.env`) con `override: true`: así `db:migrate:prod` siempre usa `.env.prod`.
- **Solo TypeScript "borrable"** (`erasableSyntaxOnly` de la web): nada de `enum`, `namespace` ni parámetros de constructor con `private`/`public`. La web typechequea los archivos de la API y los rechaza.
- **Imports relativos sin extensión `.ts`** (`from './init'`): la web typechequea estos archivos con su `tsconfig`, que no acepta `.ts`.
- El cliente de Supabase es **lazy** (`getSupabase()`) y Prisma no se conecta al importar: importar el router en tests o desde la web no puede requerir variables de entorno.
- `router.ts` es el entry del paquete y `schemas.ts` el de `./schemas` (`exports` en `package.json`).
- **`DIRECT_URL` usa el session pooler** (`aws-0-us-east-1.pooler.supabase.com:5432`), no `db.<ref>.supabase.co`: esa es solo IPv6 y no anda en la mayoría de las redes ni en Railway.
- Cotizaciones: DolarApi (`/v1/dolares/{blue,oficial}` para USD, `/v1/cotizaciones/{eur,brl,uyu,clp}` para el resto, que solo tienen oficial), cache de 10 min en memoria. Si falla, la API responde pidiendo el tipo de cambio manual.
- En Railway, `NODE_ENV=production` para que tRPC no devuelva stack traces.
- CLI de Supabase: deja `supabase/.temp/` donde se corra (gitignoreado). `supabase projects api-keys` muestra la secret key **enmascarada**; la completa requiere `--reveal`.

## Conflictos (API)

- **`src/trpc/router.ts`:** si los dos agregaron routers, quedarse con ambos.
- **`src/schemas.ts` / routers:** combinar; después `bun run check`.
- **`src/db/models/*.prisma` y migraciones:** nunca editar ni borrar una migración que ya está en `main`. Si los dos crearon migraciones: rebasear, borrar **la tuya** (no pusheada), regenerarla con `bun run db:migrate:new <nombre>` sobre la de `main`, revisar el SQL y avisar al grupo.
