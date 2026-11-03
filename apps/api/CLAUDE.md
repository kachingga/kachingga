# CLAUDE.md — apps/api

> **Reglas de negocio → `CLAUDE.md` raíz** (grupos, participantes, gastos, multimoneda, saldos, pagos, filtros). Leelas antes de implementar o cambiar lógica de dominio. Este archivo es solo lo **técnico** de la API: si cambia una regla de negocio se actualiza la raíz; si cambia un detalle de implementación, acá.

API en Hono + tRPC sobre Bun, con Prisma contra PostgreSQL en Supabase. Paquete `@kachingga/api`: la app importa **solo el tipo** `AppRouter` (y los schemas Zod de `@kachingga/api/schemas`).

---

## Comandos

```bash
bun run dev               # servidor con hot reload en :3000
bun test                  # tests
bun test <path>           # un archivo de tests
bun run typecheck         # tsc --noEmit

# Base de datos (desde apps/api/)
bun run db:generate              # regenerar el cliente de Prisma (también corre en postinstall)
bun run db:migrate:new <nombre>  # genera el SQL (base actual → schema) + RLS para tablas nuevas. No toca la base
bun run db:migrate:status        # qué migraciones faltan aplicar
bun run db:migrate:deploy        # aplica las pendientes en DEV (.env)
bun run db:migrate:prod          # aplica las pendientes en PROD (.env.prod)
bun run db:studio                # Prisma Studio
```

### Migraciones — reglas
- Nunca correr `prisma db push`, `prisma migrate reset`, `prisma migrate dev` ni `prisma db execute` contra la base.
- Nunca tocar a mano la tabla `_prisma_migrations` ni el schema desde el SQL editor de Supabase.
- **Dos bases:** `kachingga-dev` (`.env`) para todo lo local y `kachingga` (`.env.prod`) para producción. Todo comando de DB sin `:prod` va contra **dev**.
- No existe `db:migrate:dev` a propósito: `prisma migrate dev` puede pedir resetear la base.
- Flujo: cambiar `src/db/models/*.prisma` → `db:migrate:new <nombre>` (diff contra dev) → **revisar el SQL** → `db:migrate:deploy` (dev) → probar → `db:migrate:prod` → push (ver `DEPLOY.md`).
- **Nunca correr `db:migrate:prod` sin que la migración esté probada en dev**, y nunca sin que el usuario lo pida explícitamente.
- Toda tabla nueva lleva `ENABLE ROW LEVEL SECURITY` (lo agrega `db:migrate:new`; si escribís SQL a mano, agregalo vos).
- Nunca editar ni borrar una migración que ya está en `main`.

---

## Env

- **`.env` → DEV** (`kachingga-dev`, ref `nraoqdaplvvsakvtlcam`): lo usan `bun run dev`, los scripts de DB y Prisma Studio. El sample tiene estos valores.
- **`.env.prod` → PROD** (`kachingga`, ref `czrkjokurbmbbvobvmxd`): solo para `db:migrate:prod` y como referencia de las variables de Railway.
- Ambos gitignoreados; cada línea del sample dice de dónde sale el valor. Bun carga `.env` solo; `.env.prod` no lo carga nadie salvo `prisma.config.ts` cuando `PRISMA_ENV_FILE=.env.prod`.

```
DATABASE_URL=...          # Supabase transaction pooler (6543) — queries en runtime
DIRECT_URL=...            # Supabase session pooler (5432) — migraciones
SUPABASE_URL=https://nraoqdaplvvsakvtlcam.supabase.co   # dev
SUPABASE_SECRET_KEY=sb_secret_...
PORT=3000
```

---

## Arquitectura

```
src/
├── index.ts              # Hono: GET /health + tRPC montado en /trpc/*
├── schemas.ts            # Zod compartidos con la app (@kachingga/api/schemas) — sin imports del server
├── trpc/
│   ├── init.ts           # initTRPC (superjson), middleware de errores Prisma, publicProcedure, protectedProcedure
│   ├── context.ts        # createContext: valida el Bearer token con Supabase → ctx.user
│   ├── router.ts         # appRouter + `export type AppRouter` (entry del paquete)
│   └── routers/          # un router por dominio
├── db/
│   ├── schema.prisma     # generator + datasource
│   ├── models/*.prisma   # un archivo por dominio
│   ├── migrations/
│   ├── generated/        # cliente de Prisma (gitignoreado, lo genera postinstall)
│   └── index.ts          # `prisma` (PrismaClient con @prisma/adapter-pg)
├── lib/
│   ├── access.ts         # requireMembership / requireActiveGroup / assertParticipantsInGroup
│   ├── splits.ts         # resolveSplits: EQUAL / AMOUNT / PERCENTAGE → centavos exactos
│   ├── balances.ts       # computeBalances + minimizeTransfers (puro)
│   ├── rates.ts          # blue de DolarApi + resolveExchangeRate
│   ├── inviteCode.ts
│   └── supabase.ts       # cliente lazy
└── __tests__/            # bun:test
scripts/new-migration.ts  # implementación de db:migrate:new
```

### Dónde vive cada regla de negocio
| Regla (ver raíz) | Código |
|------------------|--------|
| Acceso a grupos, grupos archivados | `lib/access.ts` (`requireMembership` lectura, `requireActiveGroup` escritura) |
| División y redondeo | `lib/splits.ts` |
| Multimoneda (qué saldo, qué tipo de cambio) | `lib/balances.ts` (`balanceCurrency`) + `lib/rates.ts` (`resolveExchangeRate`) |
| Saldos y transferencias mínimas | `lib/balances.ts` |
| Filtros | `buildExpenseWhere` en `routers/expenses.ts` |
| Unirse / reclamar participante | `routers/groups.ts` (`preview`, `join`) |

---

## Modelo de datos

Schema en `src/db/models/*.prisma`.

| Modelo | Campos clave |
|--------|--------------|
| `Group` | `name`, `baseCurrency`, `inviteCode` (único), `createdById`, `archivedAt` |
| `Participant` | `groupId`, `name`, `userId?` (Supabase; `null` = sin cuenta). Único `(groupId, userId)` |
| `Expense` | `description`, `category`, `date`, `amountCents`, `currency`, `exchangeRate?`, `splitType`, `paidById`, `createdById`, `deletedAt?` |
| `ExpenseSplit` | `expenseId`, `participantId`, `amountCents` (parte ya resuelta), `percentage?` (solo `PERCENTAGE`). Único `(expenseId, participantId)`, cascade al borrar el gasto |
| `Settlement` | `fromId`, `toId`, `amountCents`, `currency`, `exchangeRate?`, `date`, `note?`, `createdById`, `deletedAt?` |
| `SavedFilter` | `groupId`, `userId`, `name`, `filters` (JSON con la forma de `expenseFilters`) |

- **Plata en centavos enteros** (`amountCents: Int`), nunca `Float`. Límite int4: ~21,4 millones por gasto en su moneda (validado en Zod). Los tipos de cambio sí son `Float`.
- **Codificación de la moneda** (`Expense` y `Settlement`):
  - `currency == group.baseCurrency` → `exchangeRate = null`, cuenta en la base
  - `currency != base` y `exchangeRate != null` → convertido (1 unidad = `exchangeRate` de la base)
  - `currency != base` y `exchangeRate == null` → "mantener moneda", saldo propio
- En el input de la API eso se expresa con `currency`, `exchangeRate?` y `keepCurrency` (`resolveExchangeRate` decide qué se guarda; si falta el rate y no es `keepCurrency`, busca el blue).
- `userId` / `createdById` son ids de Supabase Auth (no hay tabla de usuarios propia).
- Borrados lógicos con `deletedAt` en `Expense` y `Settlement`: **toda query de gastos/pagos filtra `deletedAt: null`**.

---

## Procedures tRPC

Todos con `protectedProcedure` salvo `health.ping`. Inputs en `src/schemas.ts`.

| Procedure | Tipo | Qué hace |
|-----------|------|----------|
| `health.ping` | query | Público. Chequeo de vida |
| `health.me` | query | Usuario logueado (id, email) |
| `groups.list` | query | Mis grupos (`includeArchived?`), con `_count.participants` |
| `groups.get` | query | Grupo + participantes (`isMe`, `hasAccount`) + `myParticipantId` |
| `groups.create` | mutation | Crea grupo + mi participante (`myName`) |
| `groups.rename` | mutation | Cambia el nombre |
| `groups.setArchived` | mutation | Archiva / desarchiva |
| `groups.regenerateInviteCode` | mutation | Nuevo código |
| `groups.preview` | query | Por código: nombre, moneda, `unclaimedParticipants`, `alreadyMember` |
| `groups.join` | mutation | Por código: `{ participantId }` (reclamar) o `{ name }` (nuevo) |
| `participants.add` / `rename` / `remove` | mutation | ABM de participantes |
| `expenses.list` | query | `{ groupId, filters, cursor }` → `{ items, nextCursor }` (páginas de 50) |
| `expenses.get` / `create` / `update` / `delete` | query / mutation | `update` reemplaza el gasto y sus partes; `delete` es lógico |
| `settlements.list` / `create` / `delete` | query / mutation | Pagos manuales |
| `balances.get` | query | `[{ currency, balances: [{ participantId, amountCents }], transfers: [{ fromId, toId, amountCents }] }]`, base primero |
| `savedFilters.list` / `create` / `delete` | query / mutation | Solo los del usuario |
| `rates.blue` | query | `{ buy, sell, mid, updatedAt }` para precargar el tipo de cambio |

**`expenseFilters`:** `paidById`, `splitParticipantId`, `categories[]`, `dateFrom`, `dateTo`, `minAmountCents`, `maxAmountCents`, `search`.

Si agregás o cambiás un procedure, actualizá esta tabla.

### Convenciones de routers
- Un archivo por dominio en `src/trpc/routers/`, registrado en `router.ts`.
- Al principio de cada procedure: `requireMembership` (lectura) o `requireActiveGroup` (escritura). Si recibe ids de participantes: `assertParticipantsInGroup`. Si no es miembro → `NOT_FOUND` (no revelar que existe).
- Input siempre validado con Zod. Schemas reusables por la app → `schemas.ts`.
- Prisma directo desde el procedure; a `lib/` solo lo que se reusa o es lógica pura testeable.
- Errores con `TRPCError` y mensaje **en español** (la app lo muestra tal cual). P2002 / P2025 de Prisma ya se traducen a `CONFLICT` / `NOT_FOUND` en `init.ts`.

---

## Notas técnicas — no romper

- **Prisma fijado en `7.10.1`** (sin `^`), CLI y cliente iguales. El tag `latest` de `prisma` en npm apuntaba a una `8.0.0-rc`: no actualizar con `bun add prisma` a secas.
- `prisma generate` corre en `postinstall`; el cliente generado está gitignoreado.
- `prisma.config.ts` usa `process.env.DIRECT_URL ?? ''` y **no** `env('DIRECT_URL')`: con `env()` el `postinstall` falla sin `.env` (clones nuevos, Railway).
- `prisma.config.ts` carga el archivo de `PRISMA_ENV_FILE` (default `.env`) con `override: true`: así `db:migrate:prod` siempre usa `.env.prod` aunque haya variables de dev exportadas en la terminal.
- **Imports relativos sin extensión `.ts`** (`from './init'`): la app typechequea estos archivos (vía `AppRouter`) con su `tsconfig`, que no acepta `.ts`.
- El cliente de Supabase es **lazy** (`getSupabase()`) y Prisma no se conecta al importar: importar el router en tests o desde la app no puede requerir variables de entorno.
- `router.ts` es el entry del paquete y `schemas.ts` el de `./schemas` (`exports` en `package.json`). `schemas.ts` no puede importar nada del server (Prisma, Supabase, `process.env`).
- **RLS en todas las tablas, sin políticas.** Supabase expone `public` por su API REST y la clave publishable está en la app; RLS sin políticas bloquea esa API. Nuestra API entra como `postgres` y no le afecta. Verificado: la REST devuelve `[]` aunque haya datos.
- **`DIRECT_URL` usa el session pooler** (`aws-0-us-east-1.pooler.supabase.com:5432`), no la conexión directa `db.<ref>.supabase.co`: es solo IPv6 y no anda en la mayoría de las redes ni en Railway.
- Cotización: DolarApi (`dolarapi.com/v1/dolares/blue`), cache de 10 min en memoria. Si falla, la API responde pidiendo el tipo de cambio manual.
- En Railway, `NODE_ENV=production` para que tRPC no devuelva stack traces.
- CLI de Supabase: deja `supabase/.temp/` donde se corra (gitignoreado). `supabase projects api-keys` muestra la secret key **enmascarada**; la completa requiere `--reveal`.

---

## Conflictos (API)

- **`src/trpc/router.ts`:** si los dos agregaron routers, quedarse con ambos.
- **`src/schemas.ts` / routers:** combinar; después `bun run check`.
- **`src/db/models/*.prisma` y migraciones:** nunca editar ni borrar una migración que ya está en `main`. Si los dos crearon migraciones: rebasear, borrar **la tuya** (no pusheada), regenerarla con `bun run db:migrate:new <nombre>` sobre la de `main`, revisar el SQL y avisar al grupo.

---

## Tests

`bun:test` en `src/__tests__/`. Corren en el pre-commit de todos, así que **no pueden depender de `.env`, red ni Supabase**.

| Tipo | Dónde | Qué |
|------|-------|-----|
| Unit | `src/__tests__/*.test.ts` | Lógica pura (`lib/`, `buildExpenseWhere`) |
| **Integración** | `src/__tests__/integration/*.test.ts` | Routers reales + Prisma contra **PGlite** (Postgres en memoria) armado con las **migraciones reales** |

### Integración (`setupTestApi`)
```ts
const { caller, anonymous } = await setupTestApi()   // al principio del archivo
stubBlueRate()                                       // si el test dispara el blue automático (fetch falso)
const ana = caller('ana-1')                          // caller autenticado como un usuario fake
await ana.groups.create({ ... })
```
- `setupTestApi` reemplaza `../../db` por un Prisma sobre PGlite (`mock.module`). Cada archivo arranca con una base vacía y con todas las migraciones aplicadas: si una migración nueva rompe, estos tests fallan.
- Usar usuarios distintos por test (ver `users()` en `routers.test.ts`) para que los tests no dependan entre sí.
- **Cada procedure nuevo o cambiado lleva tests de integración** que cubran: sin login (`UNAUTHORIZED`), no miembro (`NOT_FOUND`), grupo archivado si escribe, el caso feliz y cada regla de negocio que valide (con el mensaje en español).
- Lógica nueva en `lib/` → test unit además.
