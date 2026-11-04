# CLAUDE.md — apps/web

> **Reglas de negocio → `CLAUDE.md` raíz** (grupos, participantes, gastos, multimoneda, saldos, pagos, alias, filtros, export). Leelas antes de construir una pantalla: la UI tiene que reflejar esas reglas. Qué pantallas hay: **`V1.md` → "Pantallas"**. Contrato de la API (procedures y modelo): `apps/api/CLAUDE.md`. Este archivo es solo lo **técnico** de la web.

**Front principal de Kachingga**: web app **mobile-first** (se usa en el celu, también en la compu) con React + Vite. Se instala en el celu como app desde el navegador ("Agregar a inicio"). `apps/mobile` (Expo) queda como alternativa nativa por si algún día se hace.

---

## Stack

| | |
|---|---|
| UI | React 19 + TypeScript (`strict`) |
| Build / dev | Vite (`bun run dev` → http://localhost:5173) |
| Estilos | Tailwind CSS v4 (`@import "tailwindcss"` en `src/index.css`) |
| Componentes | shadcn/ui (todavía no inicializado: ver "Componentes") |
| Rutas | React Router v8 (`createBrowserRouter` en `src/router.tsx`) |
| Datos | tRPC + TanStack Query (`src/lib/trpc.ts`) |
| Login | Supabase Auth (`src/lib/supabase.ts`, `src/lib/auth.ts`) |
| Tests | Vitest + Testing Library (unit y contenido de pantallas) · Playwright (E2E) |
| Hosting | Vercel (estático). La API va aparte, en Railway |

## Comandos

Desde `apps/web` (o `bun run web` desde la raíz; `bun run dev` en la raíz levanta API + web):

```bash
bun run dev          # Vite en :5173 (necesita la API corriendo: `bun run api` desde la raíz)
                     # Login con datos cargados: juan.demo@example.com (contraseña: SEED_USER_PASSWORD de apps/api/.env)
bun run build        # typecheck + build de producción en dist/
bun run preview      # sirve el build
bun run typecheck    # tsc -b
bun run lint         # ESLint
bun run test         # Vitest (unit + contenido de pantallas)
bun run e2e          # Playwright (build + preview + celular y compu). La primera vez: bunx playwright install chromium webkit
```

Antes de dar una tarea por terminada: `bun run check` desde la raíz (lo corre el pre-commit y el CI).

## Env

Copiar `.env.sample` a `.env` (valores de **dev**). Todo lo `VITE_*` queda **dentro del JavaScript que baja el navegador: es público**. Nunca secretos.

- `VITE_API_URL` — la API (local: `http://localhost:3000`; prod: la URL de Railway).
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` — solo para login y sesión.

Tipadas en `src/vite-env.d.ts`: si agregás una, sumala ahí, al `.env.sample` y a `INFRA.md`.

## Estructura

```
src/
├── main.tsx                  # providers (ApiProvider) + RouterProvider
├── router.tsx                # todas las rutas
├── routes/                   # una pantalla por archivo (groups/ = todo lo de un grupo), tests en __tests__/
├── components/
│   ├── api-provider.tsx      # tRPC + TanStack Query
│   └── require-auth.tsx      # guard de rutas privadas → /login
├── lib/
│   ├── trpc.ts               # cliente tRPC tipado con AppRouter + token de Supabase
│   ├── supabase.ts           # ÚNICO archivo que importa Supabase
│   └── auth.ts               # signIn / signUp / signOut / useSession / getAccessToken
└── test/
    ├── setup.ts              # jest-dom + cleanup
    └── render.tsx            # renderWithApi (API falsa)
e2e/                          # Playwright
```

---

## Cómo usar la API

La API ya implementa **toda la lógica de la v1** (permisos, divisiones, redondeo, monedas, saldos, transferencias, totales, export). **La web no recalcula nada de eso**: pide los datos ya resueltos y los muestra.

### Dónde buscar
| Necesito… | Dónde |
|-----------|-------|
| Qué tiene que hacer una pantalla | "Reglas de negocio" en el `CLAUDE.md` raíz + `V1.md` → "Pantallas" |
| Qué procedure llamar y qué devuelve | Tabla **"Procedures tRPC"** en `apps/api/CLAUDE.md` |
| El input exacto (campos, validaciones) | `apps/api/src/schemas.ts` (importable como `@kachingga/api/schemas`) |
| El output exacto | El router en `apps/api/src/trpc/routers/<dominio>.ts`, o `inferRouterOutputs<AppRouter>` |

### Patrones
```tsx
import type { AppRouter } from '@kachingga/api';
import { expenseInput, type ExpenseInput } from '@kachingga/api/schemas';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { useTRPC } from '@/lib/trpc';

type Balances = inferRouterOutputs<AppRouter>['balances']['get'];

const trpc = useTRPC();
const queryClient = useQueryClient();

const group = useQuery(trpc.groups.get.queryOptions({ groupId }));

// Lista paginada (expenses.list devuelve { items, nextCursor }; el cursor lo maneja tRPC)
const expenses = useInfiniteQuery(
  trpc.expenses.list.infiniteQueryOptions({ groupId, filters }, { getNextPageParam: (last) => last.nextCursor }),
);

const createExpense = useMutation(
  trpc.expenses.create.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.expenses.pathFilter());
      queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
    },
  }),
);
```

### Reglas
- Toda la data viene de la API por tRPC (`useTRPC`). Solo `import type` desde `@kachingga/api`; los schemas Zod para formularios desde `@kachingga/api/schemas`.
- No redefinir a mano tipos de inputs/outputs.
- **Después de una mutation, invalidar** lo que afecta (gastos y pagos → `balances.get` y `expenses.summary`; participantes → `groups.get`).
- **Idioma del navegador para mostrar, valores normalizados por detrás:** montos, números y fechas se muestran con el idioma del navegador (`getLocale()` en `src/lib/format.ts`: "1.500,50" en es-AR, "1,500.50" en en-US). Lo que se guarda en el estado y se manda a la API está siempre normalizado: números como string numérico (`"1500.5"`), plata en centavos, fechas como día del calendario.
- **Montos en centavos enteros** (`amountCents`). Todo campo numérico (montos, porcentajes, tipo de cambio) usa **`<NumberInput>`** (`src/components/number-input.tsx`, sobre `react-number-format`): formatea mientras se escribe y devuelve el string normalizado; después `toCents` / `toNumber`. Solo el separador decimal del idioma escribe decimales (en es-AR, un "." tipeado por costumbre se ignora: "1.500" = mil quinientos). Nunca un `<input>` de texto con `parseFloat`.
- **Tipo de cambio:** ya está resuelto en `useExchangeRate` (`src/lib/use-exchange-rate.ts`) + `<ExchangeRateFields>` (`src/components/`), que usan el formulario de gasto y el de pago. Al cargar un gasto o pago en otra moneda, precargar la sugerencia de `rates.get({ currency, source })` (`mid`), editable, y mandar el valor final como `exchangeRate`. En **USD**: selector **Blue** (default) / **Oficial** / **A mano**; en **EUR, BRL, UYU y CLP**: **Oficial** (default) / **A mano**. `rates.get` da 1 unidad en ARS: si la base del grupo es la moneda extranjera y el gasto es en ARS, usar `1 / mid`. Entre dos monedas extranjeras no hay sugerencia: solo a mano. Ofrecer también "mantener moneda" (`keepCurrency: true`). Cada gasto elige lo suyo (uno en oficial, otro en blue, otro mantenido en USD en el mismo grupo).
- **Monedas:** los selectores (moneda base del grupo, moneda de gasto y pago) muestran **todas** las de `currencies` de `@kachingga/api/schemas` (ARS, USD, EUR, BRL, UYU, CLP), con su nombre en español. Nunca una lista a mano: si se agrega una moneda en la API, aparece sola.
- **Alias para cobrar:** `groups.get` trae el alias de cada participante (`paymentAlias`, `paymentAliasSource`). Botones de copiar con `navigator.clipboard.writeText`.
- **Exportar:** `expenses.export` devuelve `{ filename, mimeType, content }` → descargar con `new Blob([content], { type: mimeType })` + un `<a download={filename}>`.
- **Errores:** los `TRPCClientError` traen `message` en español listo para mostrar. `NOT_FOUND` en un grupo = no sos miembro.
- Fechas viajan como `Date` (superjson). **La fecha de un gasto o pago es un día del calendario** guardado a las 12:00 UTC (ver `apps/api/CLAUDE.md` → "Modelo de datos"): usar siempre los helpers de `src/lib/format.ts` (`today`, `dayToDate`, `toDay`, `startOfDay` / `endOfDay` para filtros, `formatDate`), nunca `toISOString()` sobre "ahora" ni `new Date('YYYY-MM-DDT…')` en hora local.
- **Si a la web le falta algo de la API**, se agrega en `apps/api` siguiendo `apps/api/CLAUDE.md` (mismo repo), nunca workarounds en el front.

### Login (Supabase Auth, email + password)
- **Decisión:** el login va **directo contra Supabase** (`src/lib/auth.ts`), no por nuestra API; la librería guarda la sesión (localStorage) y **renueva el token** sola. Los datos siempre por la API.
- `src/lib/trpc.ts` ya manda el token en cada pedido (`Authorization: Bearer`). Sin sesión, todo menos `health.ping` responde `UNAUTHORIZED`.
- Las rutas privadas van dentro de `<RequireAuth />` en `src/router.tsx`. `useSession()` devuelve `undefined` mientras restaura la sesión (no mostrar nada), `null` sin sesión.
- Después del login: `groups.list`. Unirse: `groups.preview` con el código → elegir participante sin cuenta o nombre nuevo → `groups.join`.

### Lo que hace cumplir el lint (falla el commit y el CI)
`eslint.config.js`. No desactivar estas reglas; si de verdad hace falta una excepción, `eslint-disable-next-line` con el motivo y avisarlo en el PR.
- Importar código de runtime de `@kachingga/api` (solo `import type`, o `@kachingga/api/schemas`).
- Importar `@supabase/supabase-js` fuera de `src/lib/supabase.ts` (los tipos sí se pueden importar).
- Usar `fetch` a mano: la data va por tRPC.
- Reglas de hooks de React (`eslint-plugin-react-hooks`).

---

## React

- Respetar las **Reglas de React** (componentes y hooks puros, no mutar props/estado, hooks siempre en el mismo orden).
- **Nada de `useEffect` para traer datos** (TanStack Query) ni para **derivar estado** (calcularlo en el render). `useEffect` solo para sincronizar con algo externo.
- Estado del servidor en TanStack Query; `useState` solo para estado de UI. No copiar datos de una query a un `useState`.
- `useMemo` / `useCallback` solo si hay un problema de performance medido (esta app no tiene React Compiler).
- Componentes chicos; lógica reutilizable en hooks; formateo en `src/lib/`.
- **Componentes base primero:** antes de la segunda pantalla, armar las piezas que se repiten (los 4 estados de una query, botón con estado de carga, texto de monto) y usarlas en todas.
- **Rutas con carga diferida** (`lazy` de React Router) cuando las pantallas crezcan: hoy el bundle pesa ~170 kB comprimido (Supabase + React + router + tRPC).

## Componentes (shadcn/ui)

**Se usa shadcn/ui** (sobre Tailwind). Todavía no está inicializado: es parte del trabajo de diseño de Juan (ver `V1.md` → "Trabajo de la UI (web)"). Para hacerlo: `bunx shadcn@latest init` desde `apps/web` (Tailwind v4, alias `@/`), y después `bunx shadcn@latest add <componente>`. Los componentes generados en `src/components/ui/` no se editan a mano salvo para ajustar estilo.

## Sensación de app nativa

Una web nunca se siente 100% nativa en iPhone: los gestos del sistema (deslizar desde el borde para volver), la física del scroll y del teclado, los haptics (Safari no los permite) y el arranque instantáneo son del sistema operativo. Pero se puede acercar mucho, y es parte del estándar:

- **Que nada espere:** actualizaciones optimistas en lo frecuente, **precargar** los datos de la próxima pantalla (`queryClient.prefetchQuery` al tocar o al pasar por un link), skeletons con la forma real, cero saltos de layout.
- **Transiciones** entre pantallas y al abrir hojas/modales: View Transitions API (`viewTransition` de React Router; Safari 18+) o una librería de animaciones. Cortas (150–250 ms) y que no bloqueen.
- **Comportamiento de app:** sin rebote ni "pull to refresh" del navegador donde no corresponde (`overscroll-behavior`), sin selección de texto ni resaltado gris al tocar en controles (`-webkit-tap-highlight-color: transparent`, `user-select` donde aplique), `100dvh` para alturas, zonas seguras con `env(safe-area-inset-*)`.
- **Inputs:** texto de **16 px o más** (si no, Safari en iPhone hace zoom al enfocar), `inputMode` correcto (`decimal` para montos), `autocomplete` en login.
- **Gestos propios** donde suman (ej. deslizar un gasto para borrarlo), siempre con alternativa con botón.
- **Arranque rápido:** bundle chico (rutas con `lazy`), y con la PWA (#18) un service worker que guarde la app para abrir al instante.
- **Instalada:** con el manifest (#18) se abre a pantalla completa, sin barra del navegador.

## UI / UX — estándar de calidad

La app la usamos nosotros todos los días, sobre todo en el celu: tiene que ser rápida, clara y linda. Ante la duda, priorizar que **cargar un gasto sea lo más rápido posible**.

### Mobile-first
- Diseñar primero para un celu (~390 px de ancho), después ampliar para la compu (`sm:`, `md:`…). Que nada dependa de hover.
- Áreas táctiles de al menos 44×44 px; inputs con `inputMode="decimal"` para montos (teclado numérico en el celu); respetar las zonas seguras del iPhone (`env(safe-area-inset-*)`, ya está `viewport-fit=cover`).
- Que se pueda usar con una mano: acciones principales abajo y al alcance del pulgar.

### Los 4 estados de toda pantalla con datos
1. **Cargando:** skeletons con la forma del contenido (no un spinner suelto). En recargas, mantener los datos viejos visibles.
2. **Vacío:** mensaje que explique qué va ahí + la acción para empezar.
3. **Error:** el `message` de la API + botón **Reintentar**. Nunca un error técnico crudo.
4. **Con datos.** Listas largas con scroll infinito donde haya paginación.

### Acciones y feedback
- Botones de envío deshabilitados + indicador mientras la mutation está en curso (`isPending`); nunca doble envío.
- Optimistic updates en lo frecuente (agregar/borrar gasto, marcar pago); si falla, revertir y avisar.
- Confirmación antes de lo destructivo (borrar gasto/pago, quitar participante, archivar).
- Confirmar éxitos de forma breve y no bloqueante (toast).

### Formularios
- Validar con los schemas de `@kachingga/api/schemas`; error al lado del campo, en español.
- Defaults inteligentes (fecha = hoy, pagó = yo, moneda = la base, todos en partes iguales).
- En divisiones por monto/porcentaje, mostrar en vivo cuánto falta para el total/100%.

### Plata, fechas y textos
- Montos en **un solo helper** (`formatCents`, con `Intl.NumberFormat` en el idioma del navegador). Siempre mostrar la moneda. "Copiar monto" usa `formatPlainAmount` (sin separador de miles, para pegar en el banco).
- Saldos con color **y** texto ("Debés $X" / "Te deben $X" / "Estás al día").
- Copy en español argentino, corto y claro.

### Visual y accesibilidad
- Modo claro y oscuro (`dark:` de Tailwind, siguiendo la preferencia del sistema).
- HTML semántico (`button`, `label`, `nav`, `main`, headings), foco visible, contraste suficiente, `aria-label` en botones con solo ícono.

### Antes de dar una pantalla por terminada
- [ ] Cumple las reglas de negocio y `V1.md` → "Pantallas".
- [ ] Tiene los 4 estados.
- [ ] Mutations con `isPending`, invalidación y (si aplica) optimistic update.
- [ ] Funciona en un celu real (o el modo celular del navegador) y en la compu, claro y oscuro.
- [ ] Tiene su test de contenido y, si es un recorrido crítico, su E2E.
- [ ] `bun run check` pasa.

---

## Testing

| Nivel | Herramienta | Dónde | Corre en |
|-------|-------------|-------|----------|
| Unit (helpers, hooks) | Vitest | `src/**/__tests__/*.test.ts` | `bun run check` / pre-commit / CI |
| **Contenido de pantallas** | Vitest + Testing Library + `renderWithApi` | `src/**/__tests__/*.test.tsx` | `bun run check` / pre-commit / CI |
| E2E (recorridos en el navegador) | Playwright, en celular (WebKit) y compu (Chrome) | `e2e/*.spec.ts` | Local (`bun run e2e`) y en GitHub Actions (a mano o PRs con label `e2e`) |

### Tests de contenido (`renderWithApi`)
`src/test/render.tsx` renderiza una pantalla con los mismos providers que la app (tRPC + TanStack Query + router) contra una **API falsa**: un handler por procedure. Ejemplo completo en `src/test/__tests__/render.test.tsx`.

```tsx
renderWithApi(<GroupScreen />, {
  'groups.get': () => fixtureGroup,
  'balances.get': () => [],
  'expenses.list': () => ({ items: [], nextCursor: null }),
}, '/grupos/g1');
expect(await screen.findByText('Todavía no hay gastos')).toBeInTheDocument();
```

- Un test por estado (cargando con `neverResolves`, vacío, error con `throw apiError(...)`, datos) + las interacciones principales (`@testing-library/user-event`), verificando qué procedure se llamó y con qué input.
- Buscar como el usuario: `getByRole`, `getByLabelText`, `getByText`.
- Datos falsos con la forma real (tabla de procedures o `inferRouterOutputs<AppRouter>`).

### E2E (Playwright)
- **Qué lleva E2E:** solo los recorridos críticos (registrarse / login, crear grupo, unirse con código, agregar gasto, ver saldos, registrar pago). El resto va en los tests de contenido.
- Corre contra el **build de producción** (`build` + `preview` en :4173) en celular y compu. Hoy solo existe `e2e/smoke.spec.ts` (la app carga).
- Para flujos con datos: la API corriendo (`bun run api`, que permite el origen :4173 por CORS) y un usuario de prueba en **dev** (los de `bun run db:seed`, ver `apps/api/CLAUDE.md` → "Datos de prueba").
- Ponerle la label `e2e` a los PRs que cambian un recorrido crítico.

---

## Seguridad (front)

Reglas generales: `CLAUDE.md` raíz → "Seguridad".
- **El front nunca es la barrera de seguridad:** permisos y validaciones los aplica la API. Ocultar un botón es UX, no seguridad.
- **Nada secreto en `VITE_*`** ni en el código: todo lo del front es público.
- Supabase solo para auth (`src/lib/supabase.ts`); la sesión la maneja la librería. No guardar tokens en otro lado ni loguearlos.
- No renderizar HTML que venga de usuarios (`dangerouslySetInnerHTML`): React ya escapa el texto (descripciones, nombres, alias).
- Links externos con `rel="noopener noreferrer"`.
- `TOO_MANY_REQUESTS` de la API = límite de pedidos: mostrar el mensaje y no reintentar en loop.

## Deploy

Vercel (estático): ver `DEPLOY.md`. La API tiene que permitir la URL de Vercel en `CORS_ORIGINS` (Railway).

## Notas técnicas — no romper

- **TypeScript `~6.0.3`** y React **19.3.0 exacto** (las mismas versiones que mobile): con `node_modules` compartido, versiones distintas de React rompen todo.
- `tsconfig.app.json` sin `baseUrl` (TS 6 lo rechaza); el alias `@/` está en `paths` y en `vite.config.ts`.
- La web typechequea archivos de la API (vía `AppRouter`): si la API importa algo que acá no resuelve, se rompe el typecheck de la web.
- `src/lib/supabase.ts` es el único archivo que importa Supabase (lint).
- CORS: la API permite por defecto `http://localhost:5173` y `:4173`; si cambiás el puerto, cambiá también `CORS_ORIGINS` en `apps/api/.env`.
- En tests, `QueryClient` usa `gcTime: Infinity` (si no, quedan timers colgados).
- **Los tests no pueden depender de `.env`** (corren en el CI y en el pre-commit de todos): `vite.config.ts` → `test.env` les da valores fijos a las `VITE_*`. Si agregás una variable que se lee al importar un módulo, sumala ahí también.

## Conflictos (web)

- **`package.json`:** combinar dependencias; mantener React y TypeScript en las mismas versiones que mobile. Después `bun install && bun run check` desde la raíz.
- **`src/router.tsx`:** si los dos agregaron rutas, quedarse con ambas.
- **`src/main.tsx` / providers:** conservar `ApiProvider` envolviendo todo.
