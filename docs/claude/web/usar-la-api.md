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
- **Categorías:** son **de cada grupo** (`categories.list`: todas, con `archived` y `expenseCount`). Cada gasto trae `category { id, name, icon, color }`: mostrar siempre esos datos, nunca una lista fija. El formulario de gasto ofrece las activas (y la que ya tenía, aunque esté archivada) con `<CategoryPicker>`; sin elegir manda nada y la API usa "Otros". **Categoría sugerida:** mientras no se elija una a mano (y no al editar), el formulario pide `categories.suggest` con la descripción **con debounce** (`useDebouncedValue`, 400 ms) y `placeholderData: keepPreviousData` (sin volver a "Otros" entre una sugerencia y la siguiente), y la muestra elegida con la marca "Sugerida"; si falla, se ignora. `gcTime` corto para que no se acumule en la cache offline. Los filtros usan `categoryIds`. La pantalla `/grupos/:id/categorias` (`routes/groups/categories.tsx`, desde el menú del grupo y "Editar categorías" del formulario) crea, edita (`<CategoryEditor>`: nombre, ícono y color) y archiva / desarchiva; después de cambiar una, invalidar `categories` y `expenses` (el nombre, ícono y color se ven en los gastos).
- **Monedas:** los selectores muestran **todas** las de `currencies` de `@kachingga/api/schemas`, con su nombre en español (`currencyLabels` en `src/lib/format.ts`). Nunca una lista a mano.
- **Alias para cobrar:** `groups.get` trae el de cada participante (`paymentAlias`, `paymentAliasSource`). "Copiar alias" y "Copiar monto" (`formatPlainAmount`).
- **Copiar y compartir** (`src/lib/share.ts`): todo lo que se copia pasa por `copyText`, que avisa con un toast (en el celu no hay otra señal). El código de invitación se comparte con `shareInviteCode` (menú de compartir del celu, `navigator.share`) con un link a `/grupos/unirme?codigo=…` que abre "Unirme" con el código ya buscado; donde no se puede compartir, lo copia.
- **Mis grupos:** `groups.list` trae `myBalanceCents` (mi saldo en la moneda base de cada grupo); se muestra con `formatMyBalance`, igual que en el grupo.
- **Borrar mi cuenta** (`src/routes/account.tsx`): al tocar el botón pide `groups.list({ includeArchived: true })` en el momento (`fetchQuery`, saldos frescos) y muestra en `useConfirm` mi nombre (`myName`) y lo que dejo pendiente en cada grupo (`myBalances`, ya calculado por la API). Si confirma: `profile.deleteAccount` → `useSignOut()` (igual que "Cerrar sesión") → toast "Tu cuenta se borró". Si falla, toast con el error e invalida todo (la API ya pudo desvincularlo de sus grupos; reintentar termina).
- **Grupo archivado:** se puede ver pero no modificar. Las pantallas del grupo esconden lo que escribe y muestran `<ArchivedNotice>` (con "Desarchivar"); la API lo rechaza igual.
- **Filtros:** viven en la URL (`src/lib/url-filters.ts`: `readUrlFilters` / `writeUrlFilters`, con días y montos como los muestran los campos) y `toApiFilters` los pasa a lo que toma la API (`Date`, centavos). Así no se pierden al abrir un gasto y volver. Las listas paginadas cargan la página siguiente al llegar al final (`<LoadMore>`).
- **Exportar:** `expenses.export` devuelve `{ filename, mimeType, content }` → `new Blob([content], { type: mimeType })` + un `<a download={filename}>`.
- **Fechas** viajan como `Date` (superjson). La de un gasto o pago es un día del calendario: ver `plata-y-fechas.md`.
- **Errores:** los `TRPCClientError` traen `message` en español listo para mostrar (`ErrorState` en queries, toast en mutations). `NOT_FOUND` en un grupo = no sos miembro. `TOO_MANY_REQUESTS` = límite de pedidos: mostrar el mensaje y no reintentar en loop.
- **Si a la web le falta algo de la API**, se agrega en `apps/api` (mismo repo), nunca workarounds en el front.

## Login (Supabase Auth: email + password y Google)

- **Decisión:** el login va **directo contra Supabase** (`src/lib/auth.ts`), no por nuestra API; la librería guarda la sesión (localStorage) y **renueva el token** sola. Los datos siempre por la API.
- **Google** (`signInWithGoogle` en `src/lib/auth.ts`, botón `src/components/google-sign-in.tsx` en login y registro): la app se va a Google y vuelve a `/` con un código de un solo uso (flujo **PKCE**, `flowType: 'pkce'` en `src/lib/supabase.ts`); la librería lo canjea por la sesión al cargar, así que `useSession()` ya la ve y `/` manda a `/grupos`. La URL de vuelta tiene que estar permitida en Supabase (`INFRA.md` → "Supabase"). **iPhone con la app instalada:** el ida y vuelta a Google puede abrirse en Safari en vez de la app (y la sesión quedar en Safari); se verifica en #42.
- `src/lib/trpc.ts` manda el token en cada pedido (`Authorization: Bearer`). Sin sesión, todo menos `health.ping` responde `UNAUTHORIZED`. `src/components/api-provider.tsx` reintenta una vez un `UNAUTHORIZED` (carrera justo después del login). `SERVICE_UNAVAILABLE` (503) = Supabase Auth no respondió: la sesión puede estar bien, así que nunca es motivo para cerrarla (se reintenta como cualquier error). La sesión la decide solo Supabase en la web (`useSession`), nunca un error de la API.
- **Volver a donde iba después de loguearse** (`src/lib/return-to.ts`): una página privada abierta sin sesión (ej. el link de invitación `/grupos/unirme?codigo=…`) manda a `/login?volver=<esa página>`; login y registro vuelven ahí (y el link entre login y registro lo conserva). Google sale de la app y vuelve a `/`, así que el destino se guarda en `sessionStorage` antes de ir y `/` (`src/components/after-google.tsx`) sigue hasta ahí. Solo se aceptan rutas de la app (`safeReturnTo`): nunca otro sitio.
- **Confirmar el email** (cuando *Confirm email* está prendido en Supabase; antes de eso, todo sigue igual): `signUp` manda `emailRedirectTo` = `/login?volver=…` y, sin sesión en la respuesta, el registro muestra "Revisá tu mail" (`ConfirmEmailSent`, `src/components/mail-sent.tsx`) con "Reenviar mail" (`resend`; 60 s entre uno y otro, el límite de Supabase por dirección). El link del mail vuelve a `/login`, que confirma, entra y sigue a `volver`; si venció o ya se usó, lo dice y deja entrar igual. Login con el email sin confirmar (`email_not_confirmed`) → "Confirmá tu email" con "Reenviar mail".
- **¿Olvidaste tu contraseña?** `/recuperar-contrasena` (`src/routes/forgot-password.tsx`) → `resetPasswordForEmail` con `redirectTo` `/nueva-contrasena`. El mensaje es neutro: no dice si la cuenta existe (Supabase tampoco). `/nueva-contrasena` (`src/routes/new-password.tsx`) canjea el link (o usa la sesión, si ya hay) → `updateUser({ password })` → `/grupos`; si el link venció o ya se usó, "Este link ya no sirve" con "Pedir otro link". La sesión queda en el navegador donde se abrió el mail (en el iPhone, Safari: después se entra a la app instalada con la contraseña nueva).
- **Los links de los mails** traen el token en el hash: las plantillas de Supabase arman `{{ .RedirectTo }}#token_hash={{ .TokenHash }}` (`INFRA.md` → "Supabase"), y la pantalla de destino lo canjea con `verifyOtp` y lo saca de la URL (`useEmailLink`, `src/lib/email-link.ts`). **Por qué no el link por defecto** (`{{ .ConfirmationURL }}`): con PKCE vuelve con un `?code=` que solo se puede canjear en el navegador donde se pidió el mail, y en el iPhone la app instalada y Safari (donde abre el link) no comparten nada. El token anda en cualquier navegador y, en el hash, no llega a ningún servidor. Si igual llega un `?code=` (plantilla por defecto), la librería lo canjea al cargar cuando puede. **Ojo al iniciar sesión se remonta toda la app** (`ApiProvider` arma la cache por usuario): por eso el canje se guarda por token y una pantalla montada de nuevo reusa el resultado en vez de canjear dos veces un token de un solo uso, y el login con sesión ya iniciada sigue directo a `volver`.
- **Captcha (Cloudflare Turnstile)** en el login con email, el registro, "¿Olvidaste tu contraseña?" y "Reenviar mail" (Google no lo lleva): `useCaptcha` (`src/lib/use-captcha.tsx`, con `@marsidev/react-turnstile`) da el widget (con el tema claro / oscuro de la app) y el token, que va en `captchaToken` y valida Supabase (Authentication → Attack Protection). El botón espera al token, y después de cada intento se pide otro (`reset()`: son de un solo uso). Sin `VITE_TURNSTILE_SITE_KEY` (tests de Vitest) no hay widget ni token; local, staging y los E2E usan la *site key* de prueba de Cloudflare, que siempre pasa (`INFRA.md` → "Supabase"). La CSP (`servidor-y-headers.md`) permite `https://challenges.cloudflare.com` en `script-src` y `frame-src`.
- **Errores de Supabase:** vienen en inglés; `authErrorMessage` (`src/lib/auth-errors.ts`) traduce los que se pueden ver en estas pantallas por `error.code` (credenciales, email sin confirmar, cuenta que ya existe, contraseña débil, captcha, límites de pedidos) y lo demás es un mensaje genérico, nunca el texto crudo.
- **Cerrar sesión** (`useSignOut()` → `signOut` → `signOutOfDevice` en `src/lib/supabase.ts`) **siempre deja el dispositivo sin sesión**: con conexión Supabase la revoca y la librería la borra; sin conexión (o si Supabase no responde con el token vencido) la librería devuelve error y la conserva en `localStorage`, así que se borra igual (la clave de la sesión está fija en `storageKey`, la misma que usaba la librería) y se termina el cierre local (`signOut({ scope: 'local' })`, que dispara `SIGNED_OUT`). Si el navegador dice que no hay conexión ni se intenta (la librería tarda ~25 s en rendirse). Limitación: offline no se revoca en Supabase; el refresh token sigue valiendo hasta que vence, pero ya no está en el dispositivo. Test: `src/lib/__tests__/supabase.test.ts`.
- Las rutas privadas van dentro de `<RequireAuth />` en `src/router.tsx`. `useSession()` devuelve `undefined` mientras restaura la sesión (no mostrar nada), `null` sin sesión.
- Después del login: `groups.list`. Unirse: `groups.preview` con el código → elegir participante sin cuenta o nombre nuevo → `groups.join`.

## En local: proxy de Vite

`VITE_API_URL` va **vacía** en local: la web llama a `/trpc` en su mismo origen y Vite (`dev` y `preview`) lo reenvía a la API en `localhost:3000` (`vite.config.ts`). Así no hay CORS y funciona desde un celu en la misma Wi-Fi (`bun run dev:celu` expone la web en la red local con `KACHINGGA_LAN=1` → `server.host`; por defecto solo `localhost`). En staging y prod, `VITE_API_URL` = la API de ese entorno (`https://api-staging.kachingga.com` / `https://api.kachingga.com`) y CORS sí importa (la URL de la web en `CORS_ORIGINS`).
