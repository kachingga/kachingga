# Contrato de la API: modelo de datos y procedures

> **Aplica a:** `apps/api/src/db/models/`, `apps/api/src/trpc/routers/`, `apps/api/src/schemas.ts`, y a la web cuando necesita saber qué procedure llamar o qué devuelve. **Si agregás o cambiás un procedure o un modelo, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/api/CLAUDE.md`.

## Modelo de datos

Schema en `src/db/models/*.prisma`.

| Modelo | Campos clave |
|--------|--------------|
| `Group` | `name`, `baseCurrency`, `inviteCode` (único), `createdById`, `archivedAt` |
| `Participant` | `groupId`, `name`, `userId?` (Supabase; `null` = sin cuenta), `paymentAlias?` (alias propio del grupo), `notificationsMuted` (el que tiene cuenta silenció el grupo: no le llegan sus notificaciones al dispositivo). Único `(groupId, userId)` |
| `UserProfile` | `userId` (id de Supabase, clave), `paymentAlias?` (alias de la cuenta, para todos los grupos) |
| `Category` | `groupId`, `name`, `icon` (uno de `categoryIcons`), `color` (uno de `categoryColors`: 12 nombres de la paleta de categorías, `tomato` … `cocoa`, nunca hex; la migración `colores_de_categorias` pasó los nombres viejos a estos), `defaultKey?` (`FOOD`…`OTHER` en las 8 que trae cada grupo; `null` = creada por alguien), `archivedAt?`. Nombre único entre las activas del grupo, sin distinguir mayúsculas: lo chequea la API y lo asegura el índice parcial `Category_active_name_key` (solo en la migración `nombre_de_categoria_unico`: Prisma no lo puede expresar) |
| `Expense` | `description`, `categoryId` (del mismo grupo), `date`, `amountCents`, `currency`, `exchangeRate?`, `splitType`, `paidById`, `createdById`, `deletedAt?` |
| `ExpenseSplit` | `expenseId`, `participantId`, `amountCents` (parte ya resuelta), `percentage?` (solo `PERCENTAGE`). Único `(expenseId, participantId)`, cascade al borrar el gasto |
| `Settlement` | `fromId`, `toId`, `amountCents`, `currency`, `exchangeRate?`, `date`, `note?`, `createdById`, `deletedAt?` |
| `SavedFilter` | `groupId`, `userId`, `name`, `filters` (JSON con la forma de `expenseFilters`) |
| `Notification` | Una novedad para una persona: `userId` (quien la recibe), `groupId`, `actorId?` (participante que hizo el cambio; `null` si después lo quitaron del grupo), `kind` (`EXPENSE_CREATED` / `UPDATED` / `DELETED`, `SETTLEMENT_CREATED` / `DELETED`), `expenseId?` o `settlementId?`, `createdAt` (cuándo fue el último cambio), `readAt?`. No guarda textos ni montos: se leen del gasto o pago (que nunca se borran de verdad) |
| `PushSubscription` | Un dispositivo (navegador) donde alguien activó las notificaciones: `userId`, `endpoint` (único: la URL del servicio de push de ese navegador, solo de los conocidos), `p256dh` y `auth` (claves para cifrarle el mensaje), `createdAt` (también cuándo se volvió a activar) |

- **Plata en centavos enteros** (`amountCents: Int`), nunca `Float`. Límite int4: ~21,4 millones por gasto en su moneda (validado en Zod). Los tipos de cambio sí son `Float`.
- **Codificación de la moneda** (`Expense` y `Settlement`):
  - `currency == group.baseCurrency` → `exchangeRate = null`, cuenta en la base
  - `currency != base` y `exchangeRate != null` → convertido (1 unidad = `exchangeRate` de la base)
  - `currency != base` y `exchangeRate == null` → "mantener moneda", saldo propio
- En el input de la API eso se expresa con `currency`, `exchangeRate?` y `keepCurrency` (`resolveExchangeRate` decide qué se guarda). Sin `exchangeRate`, usa la cotización por defecto (blue para USD, oficial para el resto) si el par es ARS ↔ otra moneda; entre dos extranjeras responde pidiéndolo a mano. El oficial del dólar o uno manual los manda la app; en la base se guarda solo el número, no de dónde salió. Un `exchangeRate` manual tiene tope (`MAX_EXCHANGE_RATE` = 1.000.000 en `schemas.ts`): más arriba, monto × tipo de cambio deja de ser exacto y un valor infinito colgaba el cálculo de transferencias.
- **`date` de `Expense` y `Settlement` es un día del calendario**, no un instante: se guarda a las **12:00 UTC** de ese día y se lee siempre en UTC (`toISOString().slice(0, 10)`, como el export). Así todos ven el mismo día, estén en la zona horaria que estén. Los filtros por fecha van de 00:00 a 23:59:59.999 UTC. Toda fecha del input (gasto, pago, filtros) va de 2000 a 2100. (Lo cargado antes al mediodía de Argentina, 15:00 UTC, cae en el mismo día.)
- `userId` / `createdById` son ids de Supabase Auth (no hay tabla de usuarios propia). Al borrar una cuenta, los `createdById` no se tocan (historial de quién cargó qué).
- Borrados lógicos con `deletedAt` en `Expense` y `Settlement`: **toda query de gastos / pagos filtra `deletedAt: null`**.

## Procedures tRPC

Todos con `protectedProcedure` salvo `health.ping`. Inputs en `src/schemas.ts`, con topes (ids ≤ 40, listas ≤ 100: `docs/claude/api/seguridad.md` → "Límites contra abuso"). Los que crean algo con cupo (`groups.create`, `participants.add`, `groups.join` como nuevo, `categories.create`, `savedFilters.create`, `expenses.create`, `settlements.create`) responden `BAD_REQUEST` con el mensaje al llegar al cupo (`lib/quotas.ts`). Esos mismos (`CREATING_PROCEDURES`, con `groups.join` siempre) tienen un tope diario por usuario (`TOO_MANY_REQUESTS`) y, con `MAX_DB_MB`, se rechazan mientras la base esté llena (`SERVICE_UNAVAILABLE`): `docs/claude/api/seguridad.md` → "Límites contra abuso".

| Procedure | Tipo | Qué hace |
|-----------|------|----------|
| `health.ping` | query | Público. Chequeo de vida |
| `health.me` | query | Usuario logueado (id, email) |
| `groups.list` | query | Mis grupos (`includeArchived?`), con `_count.participants`, `participants` (id y nombre de cada uno, del más viejo al más nuevo: las caritas de la lista), `myName` (mi nombre en el grupo), `myBalanceCents` (mi saldo en la moneda base: positivo = me deben; lo mantenido en otras monedas no cuenta) y `myBalances` (`[{ currency, amountCents }]`: mis saldos distintos de cero en cada moneda, base primero; lo usa la confirmación de "Borrar mi cuenta"). 2 queries en total, no una por grupo: los saldos se suman en SQL (`myBalancesByGroup`, `lib/aggregates.ts`), sin traer cada parte |
| `groups.get` | query | Grupo + participantes (`isMe`, `hasAccount`, `paymentAlias`, `paymentAliasSource`: `'group'` / `'account'` / `null`; sin cuenta, siempre `null`) + `myParticipantId` + `notificationsMuted` (si yo lo silencié) |
| `groups.create` | mutation | Crea grupo + mi participante (`myName`) + sus 8 categorías por defecto |
| `groups.rename` | mutation | Cambia el nombre |
| `groups.setArchived` | mutation | Archiva / desarchiva |
| `groups.regenerateInviteCode` | mutation | Nuevo código |
| `groups.preview` | query | Por código: nombre, moneda, `unclaimedParticipants`, `alreadyMember` |
| `groups.join` | mutation | Por código: `{ participantId }` (reclamar; arranca sin alias del grupo) o `{ name }` (nuevo) |
| `participants.add` / `rename` / `remove` | mutation | ABM de participantes |
| `participants.setPaymentAlias` | mutation | `{ participantId, paymentAlias \| null }`: alias propio del grupo. **Solo el propio participante** (`FORBIDDEN` con cualquier otro, tenga cuenta o no). `null` = volver al de la cuenta |
| `profile.get` / `profile.update` | query / mutation | Alias de la cuenta del usuario logueado (`{ paymentAlias \| null }`) |
| `profile.deleteAccount` | mutation | Sin input: borra **la cuenta del que llama**. **Solo si volvió a identificarse hace poco:** la sesión tiene que haberse iniciado con la contraseña o con Google hace 5 minutos o menos (`ctx.signedInAt`, del `amr` del token; ver `seguridad.md` → "Volver a identificarse"); si no, `FORBIDDEN` "Para borrar tu cuenta, primero confirmá que sos vos." sin tocar nada. En una transacción desvincula todos sus participantes (`userId` y `paymentAlias` en `null`: quedan sin cuenta, con sus gastos, pagos y saldos) (y `notificationsMuted` en `false`) y borra su `UserProfile`, sus `SavedFilter`, sus `Notification` y sus `PushSubscription`; después, borrado lógico en Supabase Auth (`auth.admin.deleteUser(id, true)`). Primero la base y después Supabase: nunca queda una cuenta borrada vinculada a un grupo, y como la parte de la base se puede repetir, si Supabase falla (`INTERNAL_SERVER_ERROR`, "Intentá de nuevo") reintentar termina el trabajo. Los `createdById` quedan como historial. Límite propio de 5 cada 10 min por IP |
| `categories.list` | query | `{ groupId }` → todas las categorías del grupo en orden (las 8 por defecto primero), con `archived` y `expenseCount` (gastos activos que la usan) |
| `categories.create` / `update` | mutation | `{ groupId, name, icon, color }` / `{ categoryId, name?, icon?, color? }`. Cualquier miembro; grupo archivado = solo lectura. `CONFLICT` si el nombre ya está entre las activas |
| `categories.suggest` | query | `{ groupId, description }` → `{ categoryId, source: 'history' \| 'keyword' }` o `null`: categoría sugerida para un gasto nuevo (historial del grupo, si no palabras clave → la por defecto con ese `defaultKey`). Solo activas del grupo. Lectura: anda en grupos archivados. Límite propio de 60/min por IP |
| `categories.archive` / `unarchive` | mutation | `{ categoryId }`. Archivada: los gastos la conservan, no se puede elegir para gastos nuevos. No se puede archivar la última activa; desarchivar choca si ya hay una activa con ese nombre |
| `expenses.list` | query | `{ groupId, filters, cursor }` → `{ items, nextCursor }` (páginas de 50, más nuevo primero). Cada item tiene la misma forma que `expenses.get` |
| `expenses.export` | query | `{ groupId, filters, format: 'csv' \| 'json' }` → `{ filename, mimeType, content }`: **todos** los gastos que coinciden (sin paginar), del más viejo al más nuevo, con mi parte. Se arma leyendo de a 500 gastos (`EXPORT_BATCH`). El JSON: lo exportado (grupo, moneda, fecha, filtros) con sangría y un gasto por línea |
| `expenses.summary` | query | `{ groupId, filters }` (mismos filtros que `list`) → `[{ currency, count, totalCents, myShareCents, myPaidCents, byCategory: [{ categoryId, name, totalCents }] }]`, base primero. Prisma elige los gastos (los filtros de `buildExpenseWhere`, solo los ids) y la base los suma (`expenseCategoryTotals`) |
| `expenses.get` / `create` / `update` / `delete` | query / mutation | Cada gasto trae `category` (`{ id, name, icon, color }`). `categoryId` del input tiene que ser del grupo y activa (al editar se puede dejar la que ya tenía aunque esté archivada); sin `categoryId` → "Otros" del grupo. `update` reemplaza el gasto y sus partes; `delete` es lógico |
| `settlements.list` / `create` / `delete` | query / mutation | Pagos manuales (más nuevo primero) |
| `balances.get` | query | `[{ currency, balances: [{ participantId, amountCents }], transfers: [{ fromId, toId, amountCents }] }]`, base primero. La base suma el total de cada persona (`groupBalanceTotals`) y las transferencias se calculan en JS (`currencyBalances`) |
| `savedFilters.list` / `create` / `delete` | query / mutation | Solo los del usuario; andan también en grupos archivados (son personales). `create` guarda lo que parseó `expenseFilters`, no el JSON que llegó |
| `notifications.list` | query | Sin input: mis novedades (las de grupos en los que sigo), de la más nueva a la más vieja (son 50 como mucho). Cada una: `kind`, `createdAt`, `readAt`, `group` (`{ id, name }`), `actor` (`{ id, name }` o `null`), y `expense` (`{ id, description, amountCents, currency, deletedAt, category: { icon, color } }`) o `settlement` (`{ id, amountCents, currency, deletedAt, from, to }`, con `isMe` en `from` y `to`) |
| `notifications.unreadCount` | query | Sin input: cuántas tengo sin leer (la campanita) |
| `notifications.markAllRead` | mutation | Sin input: marca como leídas todas las mías (al abrir "Novedades"). Anda con grupos archivados (son personales) |
| `notifications.pushConfig` | query | Sin input: `{ publicKey }`, la clave VAPID pública con la que se suscriben los navegadores; `null` = la API no manda notificaciones al dispositivo (sin `VAPID_*`) |
| `notifications.deviceStatus` | query | `{ endpoint }` → `{ subscribed }`: si ese navegador recibe **mis** notificaciones (el navegador puede tener una suscripción que la API ya no tiene) |
| `notifications.subscribeDevice` | mutation | `{ endpoint, keys: { p256dh, auth } }` (lo que da `PushSubscription.toJSON()`): activa las notificaciones en ese navegador. Solo URLs de los servicios de push conocidos (`isPushServiceUrl`; si no, `BAD_REQUEST` "Este navegador no puede recibir notificaciones"). El mismo navegador es una sola fila: otra cuenta que las activa ahí se la queda. Cada persona guarda sus últimos 10 (`MAX_DEVICES_PER_USER`, se borra el más viejo). Sin `VAPID_*`, `BAD_REQUEST`. Está en `CREATING_PROCEDURES` |
| `notifications.unsubscribeDevice` | mutation | `{ endpoint }`: las desactiva en ese navegador (solo si es mío) |
| `notifications.setGroupMuted` | mutation | `{ groupId, muted }` → `{ muted }`: silencia (o no) las notificaciones del grupo en mis dispositivos. Miembro (`requireMembership`); anda en grupos archivados (es personal) |
| `rates.get` | query | `{ currency (no ARS), source?: 'blue' \| 'oficial' }` → `{ buy, sell, mid, updatedAt, source }`: 1 unidad en ARS, para precargar el tipo de cambio. Sin `source`: blue para USD, oficial para el resto. `blue` con otra moneda → `BAD_REQUEST` |

**`expenseFilters`:** `paidById`, `splitParticipantId`, `involvedParticipantId` (pagó **o** participa), `categoryIds[]` (ids de categorías del grupo), `dateFrom`, `dateTo`, `minAmountCents`, `maxAmountCents`, `search`.

## Dónde vive cada regla de negocio

| Regla (ver `CLAUDE.md` raíz) | Código (`apps/api/src/`) |
|------------------------------|--------------------------|
| Acceso a grupos, grupos archivados | `lib/access.ts` (`requireMembership` lectura, `requireActiveGroup` escritura) |
| División y redondeo | `lib/splits.ts` (`resolveSplits`: EQUAL / AMOUNT / PERCENTAGE → centavos exactos); el reparto de centavos (`distributeCents`) vive en `schemas.ts` para que la web muestre lo mismo |
| Multimoneda (qué saldo, qué tipo de cambio) | `lib/balances.ts` (`balanceCurrency`) + `lib/rates.ts` (`getQuote` de DolarApi, `resolveExchangeRate`) |
| Saldos y transferencias mínimas | `lib/balances.ts`: `computeBalances` (las reglas en JS, pura: la referencia), `currencyBalances` (arma cada moneda, base primero, con las transferencias) y `minimizeTransfers`. **Las sumas las hace la base:** `lib/aggregates.ts` (`myBalancesByGroup` para `groups.list`, `groupBalanceTotals` para `balances.get`), con las mismas reglas; si cambia una regla de saldos, cambian las dos (`aggregates.test.ts` las compara) |
| Filtros | `buildExpenseWhere` en `routers/expenses.ts` |
| Exportar (formato de cada fila, CSV, JSON) | `lib/exportExpenses.ts` (`toExportRows`, `csvRows`, `toJson`; mismas reglas de moneda y redondeo que los saldos) |
| Totales por filtro | `lib/summary.ts`: `summarizeExpenses` (las reglas en JS, pura: la referencia; mismas reglas de moneda y redondeo que los saldos) y `summaryFromTotals` (arma cada moneda, base primero; categorías de mayor a menor y, a igual total, por nombre). **Las sumas las hace la base:** `expenseCategoryTotals` en `lib/aggregates.ts` (`aggregates.test.ts` compara las dos) |
| Unirse / reclamar participante | `routers/groups.ts` (`preview`, `join`) |
| Categoría automática (historial, palabras clave) | `lib/categorySuggestion.ts` (`suggestFromHistory`, `suggestDefaultKey`, puros; la lista de palabras clave está ahí) + `categories.suggest` en `routers/categories.ts` (últimos 500 gastos activos con categoría activa) |
| Categorías por grupo (las por defecto, cuál usa un gasto, nombres únicos) | `lib/categories.ts` (`defaultCategoryRows`, `resolveExpenseCategory`, `assertCategoryNameFree`) + `routers/categories.ts`; las 8 por defecto, íconos y colores válidos en `schemas.ts` (`defaultCategories`, `categoryIcons`, `categoryColors`) |
| Alias para cobrar (cuál vale en cada grupo) | `lib/paymentAlias.ts`; formato en `schemas.ts` (`paymentAlias`) |
| Borrar mi cuenta (desvincular, no sacar de los grupos) | `profile.deleteAccount` en `routers/profile.ts`; lo que queda pendiente, `myBalances` de `groups.list` |
| Novedades: a quién le llega cada cambio, reemplazar la no leída, las últimas 50 | `lib/notifications.ts` (`notifyInvolved`, `mergedKind`, `MAX_NOTIFICATIONS_PER_USER`), que llaman `expenses.create` / `update` / `delete` y `settlements.create` / `delete` después de guardar. Si falla, el cambio queda guardado igual (va a Sentry). Qué muestra cada una: `lib/notificationView.ts` (`notificationSelect`, `toNotificationView`) y el texto y a dónde lleva, `notificationText` / `notificationPath` en `schemas.ts` (los usa también la web) |
| Notificaciones en el dispositivo: silenciar, agrupar, una por minuto, qué dice, mandarla | `lib/push.ts`: `queuePushes` (lo llama `notifyInvolved`), `PushBatcher` (`PUSH_DELAY_MS`, `PUSH_MIN_INTERVAL_MS`, en memoria), `sendGroupPush` (la última no leída del grupo, si no está silenciado; borra los dispositivos que el servicio ya no conoce) y `pushPayload`. Se prende al arrancar (`configurePush()` en `index.ts`, nunca en los tests) |
| Cupos (grupos por usuario; personas, categorías, gastos y pagos por grupo; filtros guardados) | `lib/quotas.ts` (valores y mensajes) |

## Convenciones de routers

- Un archivo por dominio en `src/trpc/routers/`, registrado en `router.ts`.
- Al principio de cada procedure: `requireMembership` (lectura) o `requireActiveGroup` (escritura). Si recibe ids de participantes: `assertParticipantsInGroup`. Si no es miembro → `NOT_FOUND` (no revelar que existe).
- Input siempre validado con Zod. Schemas reusables por la app → `schemas.ts`.
- Prisma directo desde el procedure; a `lib/` solo lo que se reusa o es lógica pura testeable.
- **Lo que se devuelve, con `select` explícito** (`groupSelect`, `participantSelect`, `expenseSelect`, `settlementSelect`): nunca `userId` ni `createdById`, que son ids de cuenta de otros miembros. De un participante se dice `hasAccount` / `isMe`. Lo controla `accountIds.test.ts`.
- Errores con `TRPCError` y mensaje **en español** (la app lo muestra tal cual). P2002 / P2025 de Prisma ya se traducen a `CONFLICT` / `NOT_FOUND` en `init.ts`; cualquier otro error inesperado sale como "Error interno. Intentá de nuevo." (`errorFormatter`; un `INTERNAL_SERVER_ERROR` que tiramos con mensaje propio lo conserva), y un input inválido, con el mensaje de su primer problema (por eso los mensajes de Zod que puede ver alguien van en español).
