# Cómo usa la web la API — web

> **Aplica a:** pantallas que piden o mandan datos, `src/lib/trpc.ts`, `src/lib/auth.ts`, login y sesión, tipo de cambio (`src/lib/use-exchange-rate.ts`, `src/components/exchange-rate-fields.tsx`), monedas, alias, export, errores. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`. Cache, optimistic y precarga: `datos-y-cache.md`.

La API ya implementa **toda la lógica de la v1** (permisos, divisiones, redondeo, monedas, saldos, transferencias, totales, export). **La web no recalcula nada de eso**: pide los datos ya resueltos y los muestra.

## Dónde buscar

| Necesito… | Dónde |
|-----------|-------|
| Qué tiene que hacer una pantalla | "Reglas de negocio" en el `CLAUDE.md` raíz + `V1.md` → "Pantallas" |
| Qué procedure llamar y qué devuelve | `docs/claude/api/contrato.md` → "Procedures tRPC" |
| El input exacto (campos, validaciones) | `apps/api/src/schemas.ts` (importable como `@kachingga/api/schemas`) |
| El output exacto | El router en `apps/api/src/trpc/routers/`, o `inferRouterOutputs<AppRouter>` |

## Patrones

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

## Cada cosa

- **Tipo de cambio:** resuelto en `useExchangeRate` + `<ExchangeRateFields>`, que usan el formulario de gasto y el de pago. Al cargar un gasto o pago en otra moneda se precarga la sugerencia de `rates.get({ currency, source })` (`mid`), editable, y se manda el valor final como `exchangeRate`. En **USD**: **Blue** (default) / **Oficial** / **A mano**; en **EUR, BRL, UYU y CLP**: **Oficial** (default) / **A mano**. `rates.get` da 1 unidad en ARS: si la base del grupo es la moneda extranjera y el gasto es en ARS, se muestra "1 USD = X ARS" y se guarda `1 / X`. Entre dos monedas extranjeras no hay sugerencia: solo a mano. También "mantener moneda" (`keepCurrency: true`). Si la cotización no cargó, no se deja guardar. Cada gasto elige lo suyo.
- **Monedas:** los selectores muestran **todas** las de `currencies` de `@kachingga/api/schemas`, con su nombre en español (`currencyLabels` en `src/lib/format.ts`). Nunca una lista a mano.
- **Alias para cobrar:** `groups.get` trae el de cada participante (`paymentAlias`, `paymentAliasSource`). "Copiar alias" y "Copiar monto" (`formatPlainAmount`) con `navigator.clipboard.writeText`.
- **Exportar:** `expenses.export` devuelve `{ filename, mimeType, content }` → `new Blob([content], { type: mimeType })` + un `<a download={filename}>`.
- **Fechas** viajan como `Date` (superjson). La de un gasto o pago es un día del calendario: ver `plata-y-fechas.md`.
- **Errores:** los `TRPCClientError` traen `message` en español listo para mostrar (`ErrorState` en queries, toast en mutations). `NOT_FOUND` en un grupo = no sos miembro. `TOO_MANY_REQUESTS` = límite de pedidos: mostrar el mensaje y no reintentar en loop.
- **Si a la web le falta algo de la API**, se agrega en `apps/api` (mismo repo), nunca workarounds en el front.

## Login (Supabase Auth, email + password)

- **Decisión:** el login va **directo contra Supabase** (`src/lib/auth.ts`), no por nuestra API; la librería guarda la sesión (localStorage) y **renueva el token** sola. Los datos siempre por la API.
- `src/lib/trpc.ts` manda el token en cada pedido (`Authorization: Bearer`). Sin sesión, todo menos `health.ping` responde `UNAUTHORIZED`. `src/components/api-provider.tsx` reintenta una vez un `UNAUTHORIZED` (carrera justo después del login).
- Las rutas privadas van dentro de `<RequireAuth />` en `src/router.tsx`. `useSession()` devuelve `undefined` mientras restaura la sesión (no mostrar nada), `null` sin sesión.
- Después del login: `groups.list`. Unirse: `groups.preview` con el código → elegir participante sin cuenta o nombre nuevo → `groups.join`.

## En local: proxy de Vite

`VITE_API_URL` va **vacía** en local: la web llama a `/trpc` en su mismo origen y Vite (`dev` y `preview`) lo reenvía a la API en `localhost:3000` (`vite.config.ts`). Así no hay CORS y funciona desde un celu en la misma Wi-Fi (`bun run dev:celu` expone la web en la red local con `KACHINGGA_LAN=1` → `server.host`; por defecto solo `localhost`). En staging y prod, `VITE_API_URL` = la API de ese entorno (`https://api-staging.kachingga.com` / `https://api.kachingga.com`) y CORS sí importa (la URL de la web en `CORS_ORIGINS`).
