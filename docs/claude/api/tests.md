# Tests — API

> **Aplica a:** `apps/api/src/__tests__/`. **Si cambiás cómo se testea, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/api/CLAUDE.md`.

`bun:test` en `src/__tests__/`. Corren en el pre-commit de todos, así que **no pueden depender de `.env`, red ni Supabase**.

| Tipo | Dónde | Qué |
|------|-------|-----|
| Unit | `src/__tests__/*.test.ts` | Lógica pura (`lib/`, `buildExpenseWhere`) |
| HTTP | `src/__tests__/http.test.ts` | El servidor real (`index.ts`) por HTTP sin red (Supabase falso): Hono + adaptador tRPC + superjson, 401 sin token, 503 con Supabase caído, 404, CORS, límite por IP (antes de validar el token, con el path leído como tRPC; lo que no es un procedure, `NOT_FOUND` ahí mismo) y de 1 MB |
| Errores | `src/__tests__/errors.test.ts` | Qué mensaje llega por HTTP: lo inesperado sale genérico, lo de negocio tal cual, un input inválido con su primer problema |
| **Integración** | `src/__tests__/integration/` | Routers reales + Prisma contra **PGlite** (Postgres en memoria) armado con las **migraciones reales**. `routers.test.ts` = reglas por router; `scenarios.test.ts` = casos reales del grupo (pagarle a un tercero, quién pagó / entre quiénes, "mis gastos", totales del mes); `authorization.test.ts` = todos los procedures contra un atacante y todas las mutations contra un grupo archivado; `accountIds.test.ts` = ninguna respuesta de ningún procedure trae el id de cuenta de otro miembro (un procedure nuevo falla ahí hasta sumarlo a `calls`); `aggregates.test.ts` = lo que la API suma en SQL (`groups.list`, `balances.get` y `expenses.summary` con varios filtros) da lo mismo que las versiones en JS, `computeBalances` y `summarizeExpenses` (grupos al azar con semilla fija y los bordes del redondeo); `limits.test.ts` = cupos, topes, carreras, límites por usuario (escrituras, códigos de invitación, lecturas caras, cosas nuevas por día), lecturas pesadas a la vez y la guardia de tamaño de la base |

## Integración (`setupTestApi`)

```ts
const { caller, anonymous } = await setupTestApi()   // al principio del archivo
stubBlueRate()                                       // si el test dispara el blue automático (fetch falso)
const ana = caller('ana-1')                          // caller autenticado como un usuario fake
await ana.groups.create({ ... })
```

- `setupTestApi` reemplaza `../../db` por un Prisma sobre PGlite (`mock.module`). Cada archivo arranca con una base vacía y con todas las migraciones aplicadas: si una migración nueva rompe, estos tests fallan.
- **Supabase** no se usa en los tests (el caller arma el usuario a mano). Lo que llama a su API de admin (`profile.deleteAccount`) se prueba reemplazando `../../lib/supabase` con `mock.module` antes de `setupTestApi()`, con un `getSupabase()` falso (ver `deleteAccount.test.ts`).
- Usar usuarios distintos por test (ver `users()` en `routers.test.ts`) para que los tests no dependan entre sí.
- `caller(userId)` no tiene límites por usuario; `caller(userId, ip)` sí, como un pedido HTTP real. `signedInCaller(userId, signedInAt?)` = sesión iniciada con la contraseña o con Google en ese momento (por defecto, recién): lo pide `profile.deleteAccount`. Para un límite largo (ej. el tope diario), mover el reloj con `setSystemTime` de `bun:test` y volverlo con `setSystemTime()` en un `finally`.
- **Carreras:** `Promise.all` de dos llamadas sirve en PGlite (las consultas de cada una se intercalan y las transacciones esperan su turno). Chequear la invariante (ej. "queda al menos una categoría activa"), no un orden.
- **Cada procedure nuevo o cambiado lleva tests de integración** que cubran: sin login (`UNAUTHORIZED`), no miembro (`NOT_FOUND`), grupo archivado si escribe, el caso feliz y cada regla de negocio que valide (con el mensaje en español).
- Lógica nueva en `lib/` → test unit además.
