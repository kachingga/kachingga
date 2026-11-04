# Seguridad de la API: cómo está implementada

> **Aplica a:** `apps/api/src/trpc/context.ts`, `apps/api/src/trpc/init.ts`, `apps/api/src/lib/access.ts`, `apps/api/src/lib/rateLimit.ts`, CORS, RLS. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Las reglas generales están en el `CLAUDE.md` raíz → "Seguridad" y el checklist por procedure en `apps/api/CLAUDE.md`.

| Capa | Cómo | Dónde |
|------|------|-------|
| **Autenticación** | Cada pedido trae `Authorization: Bearer <token de Supabase>`; `createContext` lo valida con Supabase. Sin token válido: `ctx.user = null` | `trpc/context.ts` |
| **Login obligatorio** | Todo es `protectedProcedure` (→ `UNAUTHORIZED`) salvo `health.ping` | `trpc/init.ts` |
| **Autorización por grupo** | `requireMembership` (leer) / `requireActiveGroup` (escribir) al principio de cada procedure; `assertParticipantsInGroup` para ids que vienen en el input. No miembro → `NOT_FOUND` (no revela que el grupo existe) | `lib/access.ts` |
| **Datos personales** | Perfil, alias de una persona con cuenta y filtros guardados: siempre filtrados por `ctx.user.id` | routers `profile`, `participants`, `savedFilters` |
| **Validación** | Todo input con Zod (tipos, largos, montos, formato del alias) | `schemas.ts` |
| **Límite de pedidos por IP** | Global 300/min; códigos de invitación (`groups.preview` / `join`) 20 cada 10 min; `expenses.export` 20/min. Excedido → `TOO_MANY_REQUESTS`. Corre **antes** del chequeo de login | `lib/rateLimit.ts`, middleware en `trpc/init.ts` |
| **Base de datos** | RLS sin políticas en todas las tablas: la API REST de Supabase no ve nada con la clave pública. La API entra como `postgres` | migraciones |
| **CORS** | Solo los orígenes de `CORS_ORIGINS` (el front web). En local no interviene (proxy de Vite) | `index.ts` |
| **Errores** | Mensajes en español sin datos internos; `NODE_ENV=production` en Railway para no devolver stack traces | `trpc/init.ts`, Railway |
| **Secretos** | Solo en `.env` / `.env.prod` (gitignoreados) y en Railway. GitHub tiene escaneo de secretos y bloquea el push si detecta uno | repo |

## Límites del rate limiting

- Es **en memoria**: sirve con **una sola instancia** de la API (Railway Hobby). Con varias instancias hace falta un store compartido (ej. Redis).
- La IP sale del **último** valor de `X-Forwarded-For` (el que agrega el proxy de Railway; los anteriores los puede inventar el cliente). **Verificar en el primer deploy** que Railway lo setea así (ver `DEPLOY.md`).
- Se reinicia al reiniciar la API (aceptable).

## RLS

Supabase expone el schema `public` por su API REST y la clave publishable está en la app: **RLS sin políticas** en todas las tablas bloquea esa API. Nuestra API entra como `postgres` y no le afecta. Verificado: la REST devuelve `[]` aunque haya datos. Toda tabla nueva lleva `ENABLE ROW LEVEL SECURITY` (lo agrega `db:migrate:new`).
