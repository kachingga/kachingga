# Contrato de la API: modelo de datos y procedures

> **Aplica a:** `apps/api/src/db/models/`, `apps/api/src/trpc/routers/`, `apps/api/src/schemas.ts`, y a la web cuando necesita saber qué procedure llamar o qué devuelve. **Si agregás o cambiás un procedure o un modelo, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/api/CLAUDE.md`.

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
- En el input de la API eso se expresa con `currency`, `exchangeRate?` y `keepCurrency` (`resolveExchangeRate` decide qué se guarda). Sin `exchangeRate`, usa la cotización por defecto (blue para USD, oficial para el resto) si el par es ARS ↔ otra moneda; entre dos extranjeras responde pidiéndolo a mano. El oficial del dólar o uno manual los manda la app; en la base se guarda solo el número, no de dónde salió.
- **`date` de `Expense` y `Settlement` es un día del calendario**, no un instante: se guarda a las **12:00 UTC** de ese día y se lee siempre en UTC (`toISOString().slice(0, 10)`, como el export). Así todos ven el mismo día, estén en la zona horaria que estén. Los filtros por fecha van de 00:00 a 23:59:59.999 UTC. (Lo cargado antes al mediodía de Argentina, 15:00 UTC, cae en el mismo día.)
- `userId` / `createdById` son ids de Supabase Auth (no hay tabla de usuarios propia).
- Borrados lógicos con `deletedAt` en `Expense` y `Settlement`: **toda query de gastos / pagos filtra `deletedAt: null`**.

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
| `expenses.list` | query | `{ groupId, filters, cursor }` → `{ items, nextCursor }` (páginas de 50, más nuevo primero). Cada item tiene la misma forma que `expenses.get` |
| `expenses.export` | query | `{ groupId, filters, format: 'csv' \| 'json' }` → `{ filename, mimeType, content }`: **todos** los gastos que coinciden (sin paginar), del más viejo al más nuevo, con mi parte |
| `expenses.summary` | query | `{ groupId, filters }` (mismos filtros que `list`) → `[{ currency, count, totalCents, myShareCents, myPaidCents, byCategory: [{ category, totalCents }] }]`, base primero |
| `expenses.get` / `create` / `update` / `delete` | query / mutation | `update` reemplaza el gasto y sus partes; `delete` es lógico |
| `settlements.list` / `create` / `delete` | query / mutation | Pagos manuales (más nuevo primero) |
| `balances.get` | query | `[{ currency, balances: [{ participantId, amountCents }], transfers: [{ fromId, toId, amountCents }] }]`, base primero |
| `savedFilters.list` / `create` / `delete` | query / mutation | Solo los del usuario |
| `rates.get` | query | `{ currency (no ARS), source?: 'blue' \| 'oficial' }` → `{ buy, sell, mid, updatedAt, source }`: 1 unidad en ARS, para precargar el tipo de cambio. Sin `source`: blue para USD, oficial para el resto. `blue` con otra moneda → `BAD_REQUEST` |

**`expenseFilters`:** `paidById`, `splitParticipantId`, `involvedParticipantId` (pagó **o** participa), `categories[]`, `dateFrom`, `dateTo`, `minAmountCents`, `maxAmountCents`, `search`.

## Dónde vive cada regla de negocio

| Regla (ver `CLAUDE.md` raíz) | Código (`apps/api/src/`) |
|------------------------------|--------------------------|
| Acceso a grupos, grupos archivados | `lib/access.ts` (`requireMembership` lectura, `requireActiveGroup` escritura) |
| División y redondeo | `lib/splits.ts` (`resolveSplits`: EQUAL / AMOUNT / PERCENTAGE → centavos exactos); el reparto de centavos (`distributeCents`) vive en `schemas.ts` para que la web muestre lo mismo |
| Multimoneda (qué saldo, qué tipo de cambio) | `lib/balances.ts` (`balanceCurrency`) + `lib/rates.ts` (`getQuote` de DolarApi, `resolveExchangeRate`) |
| Saldos y transferencias mínimas | `lib/balances.ts` (`computeBalances` + `minimizeTransfers`, puros) |
| Filtros | `buildExpenseWhere` en `routers/expenses.ts` |
| Exportar (formato de cada fila, CSV) | `lib/exportExpenses.ts` (`toExportRows`, `toCsv`; mismas reglas de moneda y redondeo que los saldos) |
| Totales por filtro | `lib/summary.ts` (`summarizeExpenses`, puro; mismas reglas de moneda y redondeo que los saldos) |
| Unirse / reclamar participante | `routers/groups.ts` (`preview`, `join`) |
| Alias para cobrar (cuál vale en cada grupo) | `lib/paymentAlias.ts`; formato en `schemas.ts` (`paymentAlias`) |

## Convenciones de routers

- Un archivo por dominio en `src/trpc/routers/`, registrado en `router.ts`.
- Al principio de cada procedure: `requireMembership` (lectura) o `requireActiveGroup` (escritura). Si recibe ids de participantes: `assertParticipantsInGroup`. Si no es miembro → `NOT_FOUND` (no revelar que existe).
- Input siempre validado con Zod. Schemas reusables por la app → `schemas.ts`.
- Prisma directo desde el procedure; a `lib/` solo lo que se reusa o es lógica pura testeable.
- Errores con `TRPCError` y mensaje **en español** (la app lo muestra tal cual). P2002 / P2025 de Prisma ya se traducen a `CONFLICT` / `NOT_FOUND` en `init.ts`.
