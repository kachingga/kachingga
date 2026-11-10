# Seguridad de la API: cómo está implementada

> **Aplica a:** `apps/api/src/index.ts`, `apps/api/src/trpc/context.ts`, `apps/api/src/trpc/init.ts`, `apps/api/src/lib/access.ts`, `apps/api/src/lib/rateLimit.ts`, `apps/api/src/lib/quotas.ts`, CORS, RLS. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Las reglas generales están en el `CLAUDE.md` raíz → "Seguridad" y el checklist por procedure en `apps/api/CLAUDE.md`.

| Capa | Cómo | Dónde |
|------|------|-------|
| **Autenticación** | Cada pedido trae `Authorization: Bearer <token de Supabase>`; `createContext` lo valida con Supabase. Sin token válido: `ctx.user = null`. Si Supabase Auth no responde (red o 5xx): `ctx.authUnavailable` | `trpc/context.ts` |
| **Login obligatorio** | Todo es `protectedProcedure` (→ `UNAUTHORIZED`) salvo `health.ping`. Con Supabase Auth caído → `SERVICE_UNAVAILABLE` (503): la sesión puede estar bien, así que no es `UNAUTHORIZED` | `trpc/init.ts` |
| **Autorización por grupo** | `requireMembership` (leer) / `requireActiveGroup` (escribir) al principio de cada procedure; `assertParticipantsInGroup` para ids que vienen en el input. No miembro → `NOT_FOUND` (no revela que el grupo existe) | `lib/access.ts` |
| **Datos personales** | Perfil, alias (de la cuenta y por grupo, solo el propio: nadie le carga alias a otro ni a alguien sin cuenta) y filtros guardados: siempre filtrados por `ctx.user.id`. Borrar la cuenta (`profile.deleteAccount`) no tiene input: siempre es la del que llama | routers `profile`, `participants`, `savedFilters` |
| **Validación** | Todo input con Zod (tipos, largos, montos, formato del alias) | `schemas.ts` |
| **Límite de pedidos** | Por IP: global 300/min; códigos de invitación (`groups.preview` / `join`) 20 cada 10 min; `expenses.export` 20/min; `expenses.summary`, `balances.get` y `categories.suggest` 60/min; `profile.deleteAccount` 5 cada 10 min (llama a la API de admin de Supabase). Por usuario: toda mutation, 30/min y 300/hora. Excedido → `TOO_MANY_REQUESTS`. Lo de IP corre en un middleware de Hono **antes** de tRPC (un 429 no llama a Supabase); lo de usuario, después del login | `lib/rateLimit.ts`, `index.ts`, `protectedProcedure` en `trpc/init.ts` |
| **Tamaño, topes y cupos** | Pedido de hasta 1 MB, topes en todos los inputs y cupos por usuario / grupo: ver "Límites contra abuso" (abajo) | `index.ts`, `schemas.ts`, `lib/quotas.ts` |
| **Base de datos** | RLS sin políticas en todas las tablas: la API REST de Supabase no ve nada con la clave pública. La API entra como `postgres` | migraciones |
| **CORS** | Solo los orígenes de `CORS_ORIGINS` (el front web). En local no interviene (proxy de Vite) | `index.ts` |
| **Errores** | Mensajes en español sin datos internos: el `errorFormatter` reemplaza el de **cualquier** `INTERNAL_SERVER_ERROR` por "Error interno. Intentá de nuevo." y a un input inválido le pone su primer problema (no el JSON de Zod). `NODE_ENV=production` en Railway para no devolver stack traces | `trpc/init.ts`, Railway |
| **Secretos** | Solo en `.env` / `.env.prod` (gitignoreados) y en Railway. GitHub tiene escaneo de secretos y bloquea el push si detecta uno | repo |

## Límites del rate limiting

- Es **en memoria**: sirve con **una sola instancia** de la API (Railway Hobby). Con varias instancias hace falta un store compartido (ej. Redis).
- La IP sale del **último** valor de `X-Forwarded-For` (el que agrega el proxy de Railway; los anteriores los puede inventar el cliente). **Verificar en el primer deploy** que Railway lo setea así (ver `DEPLOY.md`).
- **IPv6 se agrupa por /64** (`clientIp`): un cliente suele tener un /64 entero y podría ir cambiando de dirección para esquivar el límite.
- Lo de IP cuenta **cada procedure** de un pedido batcheado, con el path decodificado igual que tRPC (`groups%2Epreview` cuenta como `groups.preview`). Si alguno se pasa, se rechaza el pedido entero, con la misma forma de error que tRPC (uno por llamada) para que la web muestre el mensaje.
- Los callers de los tests (sin `ctx.ip`) no tienen límite por usuario; con `caller(userId, ip)` sí.
- Se reinicia al reiniciar la API (aceptable).

## Límites contra abuso

Para que nadie que se registre (o un miembro) llene la base (Supabase Free: 500 MB; después queda **en solo lectura para todos**) ni trabe la API (un solo proceso de Bun).

| Qué | Cómo | Dónde |
|-----|------|-------|
| **Tamaño del pedido** | Hasta 1 MB (`MAX_BODY_BYTES`). Más → `PAYLOAD_TOO_LARGE` (413) antes de que tRPC lo lea | `index.ts` (`bodyLimit` de Hono) |
| **Topes en los inputs** | Ids ≤ 40 caracteres (`id`); listas ≤ 100 (personas de la división, `categoryIds`); fechas entre 2000 y 2100; código de invitación de 8 caracteres; textos con su largo máximo. Los filtros guardados se guardan como los parseó `expenseFilters` (solo campos conocidos, con sus topes), nunca el JSON que llegó | `schemas.ts`, routers |
| **Cupos** (regla de negocio, `CLAUDE.md` raíz) | 50 grupos creados por usuario (archivados incluidos), 50 personas por grupo, 50 categorías por grupo (archivadas incluidas), 30 filtros guardados por usuario y grupo → `BAD_REQUEST` con el mensaje. Se cuentan antes de crear: dos pedidos en el mismo instante pueden pasarse por uno (no importa) | `lib/quotas.ts` |
| **Escrituras por usuario** | Toda mutation: 30/min y 300/hora. Acota qué tan rápido una cuenta puede llenar la base, pero no lo impide del todo: no hay tope de gastos ni pagos por grupo | `USER_WRITE_RULES` en `lib/rateLimit.ts` |
| **Lecturas caras** | `balances.get` y `expenses.summary` con límite propio (60/min por IP); `minimizeTransfers` ordena una sola vez (antes reordenaba en cada vuelta: con miles de personas bloqueaba la API) | `lib/rateLimit.ts`, `lib/balances.ts` |
| **CSV del export** | Una celda de texto que empieza con `=`, `+`, `-`, `@`, tab o CR lleva `'` adelante: nadie mete una fórmula en la planilla de otro | `csvCell` en `lib/exportExpenses.ts` |
| **Carreras** | Nombre de categoría: índice único parcial `Category_active_name_key` (`groupId`, `lower(name)`, solo activas), además del chequeo previo. Archivar la última activa: transacción que bloquea (`FOR UPDATE`) las activas del grupo. Quitar a alguien: `deleteMany` con `userId: null` (si lo reclamaron en el medio, no se borra) | migración `nombre_de_categoria_unico`, `routers/categories.ts`, `routers/participants.ts` |

- El índice parcial **no se puede escribir en el schema de Prisma**: está solo en la migración. `prisma migrate diff` lo ignora (ni el CI "Migraciones al día" ni `db:migrate:new` lo ven como diferencia). No sacarlo.
- Un "update condicional" solo no alcanza para "la última activa": con `READ COMMITTED`, dos archivados a la vez ven cada uno a la otra como activa. Por eso el `FOR UPDATE`.

## RLS

Supabase expone el schema `public` por su API REST y la clave publishable está en la app: **RLS sin políticas** en todas las tablas bloquea esa API. Nuestra API entra como `postgres` y no le afecta. Verificado: la REST devuelve `[]` aunque haya datos. Toda tabla nueva lleva `ENABLE ROW LEVEL SECURITY` (lo agrega `db:migrate:new`). El CI lo controla: el job "Migraciones al día con el schema" (`.github/workflows/ci.yml`) falla si una tabla de `public` queda sin RLS.
