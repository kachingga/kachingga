# Tests — API

> **Aplica a:** `apps/api/src/__tests__/`. **Si cambiás cómo se testea, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/api/CLAUDE.md`.

`bun:test` en `src/__tests__/`. Corren en el pre-commit de todos, así que **no pueden depender de `.env`, red ni Supabase**.

| Tipo | Dónde | Qué |
|------|-------|-----|
| Unit | `src/__tests__/*.test.ts` | Lógica pura (`lib/`, `buildExpenseWhere`) |
| HTTP | `src/__tests__/http.test.ts` | El servidor real (`index.ts`) por HTTP sin red: Hono + adaptador tRPC + superjson, 401 sin token, 404 |
| **Integración** | `src/__tests__/integration/` | Routers reales + Prisma contra **PGlite** (Postgres en memoria) armado con las **migraciones reales**. `routers.test.ts` = reglas por router; `scenarios.test.ts` = casos reales del grupo (pagarle a un tercero, quién pagó / entre quiénes, "mis gastos", totales del mes); `authorization.test.ts` = todos los procedures contra un atacante |

## Integración (`setupTestApi`)

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
