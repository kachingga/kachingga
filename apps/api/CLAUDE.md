# CLAUDE.md — apps/api

> Ver el `CLAUDE.md` raíz para alcance (v1/v2), stack, auth, reglas de tRPC y formato de commits. Consultalo antes de implementar lógica de dominio o un router nuevo. Antes de tocar dependencias, `prisma.config.ts`, migraciones o resolver un conflicto, leer **"Notas técnicas — no romper"** y **"Trabajo en paralelo y conflictos"** del `CLAUDE.md` raíz.

API en Hono + tRPC sobre Bun, con Prisma contra PostgreSQL en Supabase. Paquete `@kachingga/api`: la app importa **solo el tipo** `AppRouter` desde acá.

---

## Comandos

```bash
bun run dev               # servidor con hot reload en :3000
bun test                  # tests
bun test <path>           # un archivo de tests
bun run typecheck         # tsc --noEmit

# Base de datos (desde apps/api/)
bun run db:generate        # regenerar el cliente de Prisma (también corre en postinstall)
bun run db:migrate:create  # crear el SQL de una migración sin aplicarla
bun run db:migrate:dev     # crear y aplicar la migración en la DB de desarrollo (.env)
bun run db:migrate:prod    # aplicar migraciones pendientes en producción (.env.prod)
bun run db:studio          # Prisma Studio
```

> **Reglas de migraciones:**
> - Nunca correr `prisma db push`, `prisma migrate reset` ni `prisma db execute` contra producción.
> - Nunca tocar a mano la tabla `_prisma_migrations` ni el schema desde el SQL editor de Supabase.
> - Flujo: `db:migrate:dev` para crear el SQL → probar → `db:migrate:prod` → push (ver `DEPLOY.md`).
> - Después de cambiar el schema, `db:generate`.

---

## Env

Copiar `.env.sample` a `.env` (desarrollo) y a `.env.prod` (solo para `db:migrate:prod`). Ambos están gitignoreados.

```
DATABASE_URL=...          # Supabase pooler (puerto 6543) — queries en runtime
DIRECT_URL=...            # Supabase directo (puerto 5432) — migraciones
SUPABASE_URL=https://czrkjokurbmbbvobvmxd.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
PORT=3000
```

---

## Arquitectura

```
src/
├── index.ts              # Hono: GET /health + tRPC montado en /trpc/*
├── trpc/
│   ├── init.ts           # initTRPC (superjson), router, publicProcedure, protectedProcedure
│   ├── context.ts        # createContext: valida el Bearer token con Supabase → ctx.user
│   ├── router.ts         # appRouter + `export type AppRouter` (entry del paquete)
│   └── routers/          # un router por dominio (health, groups, expenses, …)
├── db/
│   ├── schema.prisma     # generator + datasource
│   ├── models/*.prisma   # un archivo por modelo/dominio
│   ├── migrations/
│   ├── generated/        # cliente de Prisma (gitignoreado, lo genera postinstall)
│   └── index.ts          # `prisma` (PrismaClient con @prisma/adapter-pg)
├── lib/                  # helpers (supabase.ts, lógica reutilizable entre routers)
└── __tests__/            # bun:test
```

### Routers
- Un archivo por dominio en `src/trpc/routers/`, registrado en `router.ts`.
- Todo usa `protectedProcedure` salvo que sea explícitamente público.
- Input siempre validado con Zod en `.input(...)`.
- Prisma se llama directo desde el procedure; solo se extrae a `lib/` la lógica que se reusa entre routers (ej. cálculo de saldos).
- Errores con `TRPCError` y el `code` adecuado.

### Imports
Sin extensión `.ts` en los imports relativos (`from './init'`): la app typechequea estos archivos con su propio `tsconfig`, que no acepta extensiones `.ts`.

**`router.ts` y lo que importa no pueden depender de nada que no exista en la app** a nivel de tipos (por eso el cliente de Supabase es lazy y el de Prisma vive en `db/`, fuera del grafo de tipos del router hasta que un router lo use).

---

## Tests

`bun:test` en `src/__tests__/`. Para routers, usar `createCallerFactory(appRouter)` con un contexto armado a mano (`{ user: null }` o un `User` fake) — sin HTTP ni Supabase real. La lógica pura en `lib/` se testea directo.
