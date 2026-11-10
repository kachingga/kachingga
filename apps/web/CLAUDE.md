# CLAUDE.md — apps/web

> **Reglas de negocio → `CLAUDE.md` raíz.** Leelas antes de construir una pantalla: la UI tiene que reflejarlas. Qué pantallas hay: **`V1.md` → "Pantallas"**. Este archivo es lo **técnico** de la web: reglas cortas que valen siempre + un índice de docs para leer **antes de tocar** cada tema.

**Front principal de Kachingga**: web app **mobile-first** (se usa en el celu, también en la compu), instalable desde el navegador ("Agregar a inicio").

**Stack:** React 19 + TypeScript (`strict`) · Vite · Tailwind CSS v4 · shadcn/ui · React Router v8 (`createBrowserRouter` en `src/router.tsx`) · tRPC + TanStack Query (`src/lib/trpc.ts`) · Supabase Auth solo para login · Vitest + Testing Library + Playwright · Railway (estático, con `server.ts`; la API es otro servicio).

## Antes de tocar… → leé (y actualizalo si cambiás cómo funciona)

| Antes de tocar… | Leé |
|-----------------|-----|
| Una query, mutation, optimistic update, precarga o el modo offline (`useQuery`, `useMutation`, `setQueryData`, `invalidateQueries`, `src/lib/optimistic.ts`, `src/lib/use-prefetch.ts`, `src/lib/offline-cache.ts`) | `docs/claude/web/datos-y-cache.md` |
| Qué procedure llamar, login / sesión, tipo de cambio, monedas, alias, export, errores de la API, el proxy de Vite | `docs/claude/web/usar-la-api.md` |
| Montos, porcentajes, tipos de cambio o fechas (`src/lib/format.ts`, `<NumberInput>`, `<input type="date">`) | `docs/claude/web/plata-y-fechas.md` |
| Colores, tema claro / oscuro (toggle), `src/index.css`, componentes de `src/components/` o de shadcn, el marco (`AppShell`, `<Page>`), confirmaciones, toasts, skeletons | `docs/claude/web/componentes-y-tema.md` |
| Transiciones, navegar al guardar o borrar, gestos, tamaño del bundle, carga diferida, PWA (service worker, manifest, íconos de `public/logo.svg`) | `docs/claude/web/sensacion-de-app.md` |
| Una pantalla nueva o un cambio visible | `docs/claude/web/ui-ux.md` (+ `V1.md` → "Pantallas") |
| Tests (`renderWithApi`, setup, E2E) | `docs/claude/web/testing.md` |
| Errores inesperados y Sentry (`src/lib/monitoring.ts`, `RouteError`, los `onError` de `api-provider.tsx`) | `docs/claude/repo/monitoreo.md` |

## Reglas que valen siempre

**Datos**
- Toda la data por **tRPC** (`useTRPC`): nunca `fetch` a mano ni Supabase para datos. De `@kachingga/api` solo `import type`; schemas y helpers compartidos desde `@kachingga/api/schemas`. No redefinir tipos de inputs / outputs.
- **La web no recalcula** saldos, transferencias, totales ni divisiones: los calcula la API. Después de una mutation, **invalidar** lo que afecta.
- Mutations: **callbacks en `useMutation(trpc.x.mutationOptions({ … }))`**, nunca en `mutate(input, { … })`. Optimistic updates con `src/lib/optimistic.ts`; lo provisorio (`isTemp`) sin link ni acciones.
- Precarga: los inputs tienen que ser **idénticos** a los de la pantalla.
- Si a la web le falta algo de la API, se agrega en `apps/api`, nunca un workaround en el front.
- **Offline es solo lectura:** la cache guardada en el dispositivo es **por usuario** y **se borra al cerrar sesión**; sin conexión las mutations fallan antes del optimistic update. No persistir mutations ni nada de la sesión.

**Plata y fechas**
- Plata en **centavos enteros**. Campos numéricos con **`<NumberInput>`**, nunca `parseFloat` sobre lo que escribe el usuario. Mostrar con `formatCents`.
- Se muestra en el **idioma del navegador** (`es` / `es-419` → `es-AR`); se guarda **normalizado**.
- La fecha de un gasto o pago es un **día del calendario** (12:00 UTC): siempre los helpers de `src/lib/format.ts` (`today`, `dayToDate`, `toDay`, `startOfDay` / `endOfDay`, `formatDate`). Nunca `toISOString()` sobre "ahora".
- Monedas: siempre la lista `currencies` de `@kachingga/api/schemas`, nunca una a mano.

**UI**
- **Colores del tema** (`bg-card`, `text-muted-foreground`, `text-positive`…), **nunca fijos** (`bg-neutral-900`, `text-white`). Claro y oscuro siguen al sistema salvo que la persona elija con el toggle (`src/lib/theme.ts`).
- **Marco y piezas del diseño:** toda pantalla logueada va dentro de `AppShell` (lo pone el router) y define su ancho con `<Page>`; tarjetas, íconos de categoría, avatares y saldos con los de `src/components/kit.tsx`, no a mano. Formularios con `Button` (con `loading`), `Input`, `NativeSelect`, `<Field>` y `<Chip>`, nunca `<button>` / `<input>` con clases a mano.
- Cargando = **skeleton** (nunca un spinner suelto); error = **`ErrorState`** con Reintentar; confirmar = **`useConfirm`** (nunca `confirm()`); avisar = **toast**.
- Cerrar una pantalla después de guardar o borrar: **`useGoBack()(fallback)`**, no `navigate(ruta)`.
- Componentes generados de shadcn (`src/components/ui/`): no se editan salvo estilo.
- Copy en español argentino; código en inglés.

**React**
- Respetar las **Reglas de React**: componentes y hooks puros, no mutar props ni estado, hooks siempre en el mismo orden.
- Nada de `useEffect` para traer datos (TanStack Query) ni para derivar estado (calcularlo en el render); `useEffect` solo para sincronizar con algo externo.
- Estado del servidor en TanStack Query; `useState` solo para UI. **No copiar datos de una query a un `useState`.**
- `useMemo` / `useCallback` solo con un problema de performance medido (no hay React Compiler).
- Componentes chicos; lógica reutilizable en hooks; formateo en `src/lib/`. Antes de repetir algo en una segunda pantalla, convertirlo en componente base.

**Seguridad (front)** — generales en el `CLAUDE.md` raíz → "Seguridad"
- **El front nunca es la barrera**: permisos y validaciones los aplica la API. Ocultar un botón es UX.
- Nada secreto en `VITE_*` ni en el código: todo lo del front es público.
- Supabase solo para auth y solo desde `src/lib/supabase.ts`; la sesión la maneja la librería (no guardar ni loguear tokens).
- No renderizar HTML de usuarios (`dangerouslySetInnerHTML`). Links externos con `rel="noopener noreferrer"`.

**Lo que hace cumplir el lint** (`eslint.config.js`; no desactivar, y si de verdad hace falta una excepción, `eslint-disable-next-line` con el motivo y avisarlo en el PR): imports de runtime de `@kachingga/api`, `@supabase/supabase-js` fuera de `src/lib/supabase.ts`, `fetch` a mano, reglas de hooks.

## Comandos

Desde `apps/web` (o desde la raíz: `bun run dev` levanta API + web, `bun run dev:celu` además la expone en la Wi-Fi):

```bash
bun run dev          # Vite en :5173 (necesita la API: `bun run api` desde la raíz)
                     # Login con datos: juan.demo@example.com (contraseña: SEED_USER_PASSWORD de apps/api/.env)
bun run build        # typecheck + build de producción en dist/
bun run preview      # sirve el build (en :4173, también reenvía /trpc a la API)
bun run typecheck    # tsc -b
bun run lint         # ESLint
bun run test         # Vitest (unit + contenido de pantallas)
bun run e2e          # Playwright (la primera vez: bunx playwright install chromium webkit)
E2E_API=1 bun run e2e  # + los recorridos críticos contra la API y la base de dev (docs/claude/web/testing.md)
```

Antes de dar una tarea por terminada: `bun run check` desde la raíz.

## Env

Copiar `.env.sample` a `.env` (valores de **dev**). Todo lo `VITE_*` es **público** (va dentro del JS).
- `VITE_API_URL` — **vacía en local** (Vite reenvía `/trpc` a la API: sin CORS y anda desde el celu). Prod: la URL de Railway.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — solo login y sesión.
- `VITE_SENTRY_DSN` / `VITE_SENTRY_ENVIRONMENT` — errores a Sentry; vacías = apagado (local, tests, CI).

Si agregás una: `src/vite-env.d.ts`, `.env.sample`, `INFRA.md` y `test.env` de `vite.config.ts`.

## Estructura

```
src/
├── main.tsx · router.tsx     # providers (ApiProvider, ConfirmProvider, Toaster) · todas las rutas
├── index.css                 # Tailwind + variables del tema (claro / oscuro) + transiciones
├── routes/                   # una pantalla por archivo (groups/ = lo de un grupo), tests en __tests__/
├── components/               # ui/ (shadcn), kit (Card, CategoryIcon, Avatar, MyBalance, Page…), app-shell,
│                             # auth-layout, skeletons, error-state, number-input, exchange-rate-fields,
│                             # confirm-provider, animated-layout, api-provider, require-auth, offline-banner,
│                             # category-picker, category-editor
├── lib/                      # trpc, supabase (ÚNICO que importa Supabase), auth, format, optimistic,
│                             # use-prefetch, use-exchange-rate, use-confirm, use-go-back, offline-cache,
│                             # theme, use-sign-out, categories (ícono y color de cada categoría)
└── test/                     # setup.ts, render.tsx (renderWithApi)
e2e/                          # Playwright
```

## Notas técnicas — no romper

- **TypeScript `~6.0.3`** y React **19.3.0 exacto**: con `node_modules` compartido, versiones distintas rompen todo (ver `docs/claude/repo/tooling.md`).
- `tsconfig.app.json` sin `baseUrl` (TS 6 lo rechaza); el alias `@/` está en `paths`, en `vite.config.ts` y en `tsconfig.json` (para el CLI de shadcn).
- **El service worker (PWA) guarda solo los archivos de la app, nunca datos de la API.** Los íconos salen de `public/logo.svg`: no agregar PNGs a mano.
- La web typechequea archivos de la API (vía `AppRouter`): si la API importa algo que acá no resuelve, se rompe el typecheck de la web.
- Deploy: servicio `web` en Railway (settings en `DEPLOY.md`): buildea con Vite y `server.ts` sirve `dist` (rutas → `index.html`, cache largo en `/assets/*`). Las `VITE_*` se leen **al buildear**: cambiarlas en Railway requiere un deploy nuevo. La API de cada entorno tiene que permitir la URL de su web en `CORS_ORIGINS`. Ver `DEPLOY.md`.

## Conflictos (web)

- **`package.json`:** combinar dependencias, sin cambiar las versiones de React y TypeScript. Después `bun install && bun run check` desde la raíz.
- **`src/router.tsx`:** si los dos agregaron rutas, quedarse con ambas.
- **`src/main.tsx`:** conservar `ApiProvider` envolviendo todo, y `ConfirmProvider` + `Toaster`.
