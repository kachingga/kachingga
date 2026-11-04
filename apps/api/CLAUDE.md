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
bun run db:seed                  # datos de prueba en DEV (ver "Datos de prueba")
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
- El CI ("Migraciones al día con el schema") aplica todas las migraciones en un Postgres vacío y falla si cambiaste `models/*.prisma` sin generar la migración.

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
SEED_USER_PASSWORD=...    # solo dev: contraseña de los usuarios de prueba (db:seed)
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
│   ├── summary.ts        # summarizeExpenses: totales por filtro (puro)
│   ├── rates.ts          # cotizaciones de DolarApi (getQuote) + resolveExchangeRate
│   ├── inviteCode.ts
│   └── supabase.ts       # cliente lazy
└── __tests__/            # bun:test
scripts/new-migration.ts  # implementación de db:migrate:new
scripts/seed.ts           # implementación de db:seed
```

### Dónde vive cada regla de negocio
| Regla (ver raíz) | Código |
|------------------|--------|
| Acceso a grupos, grupos archivados | `lib/access.ts` (`requireMembership` lectura, `requireActiveGroup` escritura) |
| División y redondeo | `lib/splits.ts` (el reparto de centavos, `distributeCents`, vive en `schemas.ts` para que la web muestre lo mismo) |
| Multimoneda (qué saldo, qué tipo de cambio) | `lib/balances.ts` (`balanceCurrency`) + `lib/rates.ts` (`resolveExchangeRate`) |
| Saldos y transferencias mínimas | `lib/balances.ts` |
| Filtros | `buildExpenseWhere` en `routers/expenses.ts` |
| Exportar (formato de cada fila, CSV) | `lib/exportExpenses.ts` (`toExportRows`, `toCsv`, mismas reglas de moneda y redondeo que los saldos) |
| Totales por filtro | `lib/summary.ts` (`summarizeExpenses`, mismas reglas de moneda y redondeo que los saldos) |
| Unirse / reclamar participante | `routers/groups.ts` (`preview`, `join`) |
| Alias para cobrar (cuál vale en cada grupo) | `lib/paymentAlias.ts` (`resolvePaymentAliases`); formato en `schemas.ts` (`paymentAlias`) |

---

## Modelo de datos

Schema en `src/db/models/*.prisma`.

| Modelo | Campos clave |
|--------|--------------|
| `Group` | `name`, `baseCurrency`, `inviteCode` (único), `createdById`, `archivedAt` |
| `Participant` | `groupId`, `name`, `userId?` (Supabase; `null` = sin cuenta), `paymentAlias?` (alias propio del grupo). Único `(groupId, userId)` |
| `UserProfile` | `userId` (id de Supabase, clave), `paymentAlias?` (alias de la cuenta, para todos los grupos) |
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
- **`date` de `Expense` y `Settlement` es un día del calendario**, no un instante: se guarda a las **12:00 UTC** de ese día y se lee siempre en UTC (`toISOString().slice(0, 10)`, como el export). Así todos ven el mismo día, estén en la zona horaria que estén. Los filtros por fecha van de 00:00 a 23:59:59.999 UTC. (Lo cargado antes al mediodía de Argentina, 15:00 UTC, cae en el mismo día.)
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
| `groups.get` | query | Grupo + participantes (`isMe`, `hasAccount`, `paymentAlias`, `paymentAliasSource`: `'group'` / `'account'` / `null`) + `myParticipantId` |
| `groups.create` | mutation | Crea grupo + mi participante (`myName`) |
| `groups.rename` | mutation | Cambia el nombre |
| `groups.setArchived` | mutation | Archiva / desarchiva |
| `groups.regenerateInviteCode` | mutation | Nuevo código |
| `groups.preview` | query | Por código: nombre, moneda, `unclaimedParticipants`, `alreadyMember` |
| `groups.join` | mutation | Por código: `{ participantId }` (reclamar) o `{ name }` (nuevo) |
| `participants.add` / `rename` / `remove` | mutation | ABM de participantes |
| `participants.setPaymentAlias` | mutation | `{ participantId, paymentAlias \| null }`: alias propio del grupo. Con cuenta, solo esa persona (`FORBIDDEN` si no); sin cuenta, cualquier miembro. `null` = volver al de la cuenta |
| `profile.get` / `profile.update` | query / mutation | Alias de la cuenta del usuario logueado (`{ paymentAlias \| null }`) |
| `expenses.list` | query | `{ groupId, filters, cursor }` → `{ items, nextCursor }` (páginas de 50) |
| `expenses.export` | query | `{ groupId, filters, format: 'csv' \| 'json' }` → `{ filename, mimeType, content }`: **todos** los gastos que coinciden (sin paginar), del más viejo al más nuevo, con mi parte |
| `expenses.summary` | query | `{ groupId, filters }` (mismos filtros que `list`) → `[{ currency, count, totalCents, myShareCents, myPaidCents, byCategory: [{ category, totalCents }] }]`, base primero |
| `expenses.get` / `create` / `update` / `delete` | query / mutation | `update` reemplaza el gasto y sus partes; `delete` es lógico |
| `settlements.list` / `create` / `delete` | query / mutation | Pagos manuales |
| `balances.get` | query | `[{ currency, balances: [{ participantId, amountCents }], transfers: [{ fromId, toId, amountCents }] }]`, base primero |
| `savedFilters.list` / `create` / `delete` | query / mutation | Solo los del usuario |
| `rates.get` | query | `{ currency (no ARS), source?: 'blue' \| 'oficial' }` → `{ buy, sell, mid, updatedAt, source }`: 1 unidad en ARS, para precargar el tipo de cambio. Sin `source`: blue para USD, oficial para el resto. `blue` con otra moneda → `BAD_REQUEST` |

**`expenseFilters`:** `paidById`, `splitParticipantId`, `involvedParticipantId` (pagó **o** participa), `categories[]`, `dateFrom`, `dateTo`, `minAmountCents`, `maxAmountCents`, `search`.

Si agregás o cambiás un procedure, actualizá esta tabla.

### Convenciones de routers
- Un archivo por dominio en `src/trpc/routers/`, registrado en `router.ts`.
- Al principio de cada procedure: `requireMembership` (lectura) o `requireActiveGroup` (escritura). Si recibe ids de participantes: `assertParticipantsInGroup`. Si no es miembro → `NOT_FOUND` (no revelar que existe).
- Input siempre validado con Zod. Schemas reusables por la app → `schemas.ts`.
- Prisma directo desde el procedure; a `lib/` solo lo que se reusa o es lógica pura testeable.
- Errores con `TRPCError` y mensaje **en español** (la app lo muestra tal cual). P2002 / P2025 de Prisma ya se traducen a `CONFLICT` / `NOT_FOUND` en `init.ts`.

---

## Seguridad

Las reglas generales están en el `CLAUDE.md` raíz → "Seguridad". Acá, cómo está implementado en la API.

### Modelo
| Capa | Cómo | Dónde |
|------|------|-------|
| **Autenticación** | Cada pedido trae `Authorization: Bearer <token de Supabase>`; `createContext` lo valida con Supabase. Sin token válido: `ctx.user = null` | `trpc/context.ts` |
| **Login obligatorio** | Todo es `protectedProcedure` (→ `UNAUTHORIZED`) salvo `health.ping` | `trpc/init.ts` |
| **Autorización por grupo** | `requireMembership` (leer) / `requireActiveGroup` (escribir) al principio de cada procedure; `assertParticipantsInGroup` para ids que vienen en el input. No miembro → `NOT_FOUND` (no revela que el grupo existe) | `lib/access.ts` |
| **Datos personales** | Perfil, alias de una persona con cuenta y filtros guardados: siempre filtrados por `ctx.user.id` | routers `profile`, `participants`, `savedFilters` |
| **Validación** | Todo input con Zod (tipos, largos, montos, formato del alias) | `schemas.ts` |
| **Límite de pedidos por IP** | Global 300/min; códigos de invitación (`groups.preview` / `join`) 20 cada 10 min; `expenses.export` 20/min. Excedido → `TOO_MANY_REQUESTS`. Corre **antes** del chequeo de login | `lib/rateLimit.ts`, middleware en `trpc/init.ts` |
| **Base de datos** | RLS sin políticas en todas las tablas: la API REST de Supabase no ve nada con la clave pública. La API entra como `postgres` | migraciones |
| **CORS** | Solo los orígenes de `CORS_ORIGINS` (el front web) | `index.ts` |
| **Errores** | Mensajes en español sin datos internos; `NODE_ENV=production` en Railway para no devolver stack traces | `trpc/init.ts`, Railway |
| **Secretos** | Solo en `.env` / `.env.prod` (gitignoreados) y en Railway. GitHub tiene escaneo de secretos y bloquea el push si detecta uno | repo |

### Checklist para cada procedure nuevo o cambiado
1. `protectedProcedure` (público solo con una razón explícita).
2. Si toca un grupo: `requireMembership` / `requireActiveGroup` **antes** de leer o escribir nada. Si recibe un id de gasto, pago o participante, buscarlo y chequear su `groupId` (nunca confiar en un `groupId` del input para un recurso que ya existe).
3. Ids de participantes en el input → `assertParticipantsInGroup`.
4. Datos de una persona → filtrar por `ctx.user.id`.
5. Input validado con Zod, con límites de largo y de montos.
6. **Agregarlo a `src/__tests__/integration/authorization.test.ts`**: en `attacks` si toca un grupo, o en `notGroupScoped` con el motivo. Si no, ese test falla (compara contra todos los procedures del router).
7. Si es caro o se presta a fuerza bruta, sumarle un límite en `PROCEDURE_RULES` (`lib/rateLimit.ts`).

### Límites del rate limiting
- Es **en memoria**: sirve con **una sola instancia** de la API (Railway Hobby). Con varias instancias hace falta un store compartido (ej. Redis).
- La IP sale del **último** valor de `X-Forwarded-For` (el que agrega el proxy de Railway; los anteriores los puede inventar el cliente). **Verificar en el primer deploy** que Railway lo setea así (ver `DEPLOY.md`).
- Se reinicia al reiniciar la API (aceptable).

## Datos de prueba (`db:seed`)

`bun run db:seed` (desde `apps/api/`) llena la base de **dev** con usuarios y grupos de prueba para ver el front con datos reales. Usa los procedures tRPC de verdad (mismas reglas de negocio que la app).

- **Usuarios** (contraseña = `SEED_USER_PASSWORD` del `.env`, se la pide a Galo): `juan.demo@example.com` (el principal), `tuke.demo@example.com`, `roman.demo@example.com`.
- **Grupos de Juan:**
  - **Viaje a Florianópolis:** todos los casos de moneda (ARS, USD convertido con el blue automático, BRL con tipo de cambio manual, USD y BRL mantenidos → 3 saldos) y las 3 formas de dividir. También: quien paga fuera de la división, alguien sin cuenta (Sofi), alias de la cuenta y por grupo, Román sin alias, pagos y un gasto borrado.
  - **Depto Palermo:** 6 meses de alquiler, servicios y súper (más de 50 gastos, para el scroll infinito) y 3 filtros guardados.
  - **Asado del sábado:** saldado (todos a mano).
  - **Bariloche 2025:** archivado.
  - **Cumple de Román:** vacío.
- **Correrlo de nuevo** borra los grupos donde participa algún usuario de prueba y los vuelve a crear. Las fechas son relativas a hoy, así que "este mes" siempre tiene datos. Si te uniste con tu cuenta a un grupo de prueba, eso también se borra.
- **Solo corre contra dev:** frena si `SUPABASE_URL` o `DATABASE_URL` no son de `kachingga-dev`. Nunca adaptarlo para prod.
- Si cambia una regla de negocio o un procedure que usa, actualizarlo (si no, falla al correrlo).

## Notas técnicas — no romper

- **Prisma fijado en `7.10.1`** (sin `^`), CLI y cliente iguales. El tag `latest` de `prisma` en npm apuntaba a una `8.0.0-rc`: no actualizar con `bun add prisma` a secas.
- `prisma generate` corre en `postinstall`; el cliente generado está gitignoreado.
- `prisma.config.ts` usa `process.env.DIRECT_URL ?? ''` y **no** `env('DIRECT_URL')`: con `env()` el `postinstall` falla sin `.env` (clones nuevos, Railway).
- `prisma.config.ts` carga el archivo de `PRISMA_ENV_FILE` (default `.env`) con `override: true`: así `db:migrate:prod` siempre usa `.env.prod` aunque haya variables de dev exportadas en la terminal.
- **Solo TypeScript "borrable"** (`erasableSyntaxOnly` de la web): nada de `enum`, `namespace` ni parámetros de constructor con `private`/`public`. La web typechequea los archivos de la API y los rechaza.
- **Imports relativos sin extensión `.ts`** (`from './init'`): la app typechequea estos archivos (vía `AppRouter`) con su `tsconfig`, que no acepta `.ts`.
- El cliente de Supabase es **lazy** (`getSupabase()`) y Prisma no se conecta al importar: importar el router en tests o desde la app no puede requerir variables de entorno.
- `router.ts` es el entry del paquete y `schemas.ts` el de `./schemas` (`exports` en `package.json`). `schemas.ts` no puede importar nada del server (Prisma, Supabase, `process.env`).
- **RLS en todas las tablas, sin políticas.** Supabase expone `public` por su API REST y la clave publishable está en la app; RLS sin políticas bloquea esa API. Nuestra API entra como `postgres` y no le afecta. Verificado: la REST devuelve `[]` aunque haya datos.
- **`DIRECT_URL` usa el session pooler** (`aws-0-us-east-1.pooler.supabase.com:5432`), no la conexión directa `db.<ref>.supabase.co`: es solo IPv6 y no anda en la mayoría de las redes ni en Railway.
- Cotizaciones: DolarApi (`/v1/dolares/{blue,oficial}` para USD, `/v1/cotizaciones/{eur,brl,uyu,clp}` para el resto, que solo tienen oficial), cache de 10 min en memoria por cada una. Si falla, la API responde pidiendo el tipo de cambio manual.
- Sin `exchangeRate` en el input, la API usa la cotización por defecto (blue para USD, oficial para el resto) si el par es ARS ↔ otra moneda; entre dos extranjeras responde pidiendo el tipo de cambio a mano. El oficial del dólar o uno manual los manda la app como `exchangeRate`; en la base se guarda solo el número, no de dónde salió.
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
| HTTP | `src/__tests__/http.test.ts` | El servidor real (`index.ts`) por HTTP sin red: Hono + adaptador tRPC + superjson, 401 sin token, 404 |
| **Integración** | `src/__tests__/integration/*.test.ts` | Routers reales + Prisma contra **PGlite** (Postgres en memoria) armado con las **migraciones reales**. `routers.test.ts` = reglas por router; `scenarios.test.ts` = casos reales del grupo (pagarle a un tercero, quién pagó / entre quiénes, "mis gastos", totales del mes) |

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
