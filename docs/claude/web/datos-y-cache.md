# Datos y cache (TanStack Query) — web

> **Aplica a:** toda query, mutation, optimistic update o precarga de `apps/web` (`useQuery`, `useMutation`, `setQueryData`, `invalidateQueries`), `src/lib/optimistic.ts`, `src/lib/use-prefetch.ts`, el modo offline (`src/lib/offline-cache.ts`, `src/components/api-provider.tsx`). **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

## Cómo funciona la cache

- TanStack Query guarda en memoria un mapa **query key → datos + estado**. Cada `useQuery` observa una entrada. tRPC arma la key con el procedure y el input (`[['groups','get'], { input: { groupId }, type: 'query' }]`), así que **dos inputs distintos son dos entradas distintas**: `{ groupId }` y `{ groupId, filters: {} }` no comparten datos.
- Al montar, si la key ya tiene datos se muestran **en el acto**. Con `staleTime` 0 (el default) además se revalida en segundo plano y la pantalla se actualiza sola (*stale-while-revalidate*). Si hay un pedido en vuelo con la misma key, no se hace otro (deduplicación).
- `queryClient.setQueryData(key, data)` escribe en la cache: todo lo que observa esa key se re-renderiza como si viniera del server. `invalidateQueries(...)` marca como vieja: lo montado se pide ya, lo demás al usarse. Lo que nadie observa se borra de la memoria a los 7 días (`gcTime` = lo que dura la copia offline, ver abajo).
- **Saldos, transferencias y totales los calcula la API**: nunca se recalculan en el front ni se escriben a mano en la cache; después de tocar gastos o pagos se invalidan (`balances.get`, `expenses.summary`).
- `expenses.list` es una *infinite query*: en la cache es `{ pages: [{ items, nextCursor }], pageParams }`, no un array.

### Qué invalidar después de cada mutation
Gastos y pagos → `expenses` (todo el path), `balances.get` y `expenses.summary`; participantes → `groups.get`; perfil → `profile`.

## Optimistic updates

Hechos: agregar / editar / borrar gasto, registrar / borrar pago.

Ciclo de una mutation: `onMutate` (antes del pedido; lo que devuelve es el `context`) → pedido → `onSuccess` / `onError(err, input, context)` → `onSettled` (siempre).

```tsx
onMutate: async (input) => {
  await queryClient.cancelQueries({ queryKey: listKey });   // que un refetch en vuelo no pise lo optimista
  const previous = queryClient.getQueryData(listKey);        // foto para deshacer
  queryClient.setQueryData(listKey, (old) => /* cómo quedaría */);
  return { previous };
},
onError: (err, _input, context) => {
  if (context) queryClient.setQueryData(listKey, context.previous);  // deshacer
  toast.error(`No se …: ${err.message}`);
},
onSettled: () => { /* invalidar la lista y lo que calcula la API (saldos, totales) */ },
```

- **Lo nuevo se arma con la forma exacta que devuelve la API**: `buildExpense` / `buildSettlement` (`src/lib/optimistic.ts`), con el mismo reparto de centavos (`distributeCents`, de `@kachingga/api/schemas`). Llevan un **id provisorio** (`tempId()`); `isTemp(id)` → se muestra atenuado ("Guardando…") y **sin link ni acciones** (todavía no existe en el server). Al invalidar, llega el real y lo reemplaza.
- **Callbacks siempre en `useMutation(trpc.x.mutationOptions({ … }))`**, no en `mutate(input, { … })`: los primeros quedan en la mutation dentro de la cache y corren aunque el componente ya se haya desmontado (el formulario se cierra en `onMutate`); los segundos se pierden.
- **Si falla con el formulario ya cerrado**, el toast ofrece **"Revisar"**: navega al form con el gasto armado en el *router state* (`{ draft }`) y el form lo toma como valores iniciales (`key={location.key}` para que se monte de nuevo). No se pierde lo cargado.
- **Cerrar la pantalla** después de guardar o borrar: `useGoBack()` (ver `sensacion-de-app.md`).
- **Validar en el form lo mismo que la API** (montos que suman el total, 100%, al menos una persona, personas distintas en un pago) antes de mandar: mostrar algo como guardado y que después se rechace es peor que esperar. Para `onError` queda lo que el front no puede saber (sin conexión, grupo archivado por otro).
- **Limitación conocida:** la foto es de toda la lista. Con dos mutations seguidas sobre la misma lista, si la primera falla, el rollback puede deshacer un momento la segunda; `onSettled` lo corrige con lo que dice el server.
- **Mutation nueva frecuente** → mismo patrón + test de "se ve al instante" y de "si falla, se deshace" (ejemplos en `src/routes/groups/__tests__/settlements.test.tsx` y `src/routes/groups/__tests__/expense-form.test.tsx`).

## Precarga

- `usePrefetch()` (`src/lib/use-prefetch.ts`) hace `prefetchQuery` / `prefetchInfiniteQuery` de lo que va a pedir la próxima pantalla; `prefetchOn(load)` lo engancha a `onPointerDown` (el dedo toca: ~100–150 ms antes del `click`), `onMouseEnter` y `onFocus`. Hoy: tarjeta de grupo, "Pagos", "Filtros" y "Marcar como pagado".
- **Los inputs tienen que ser idénticos a los de la pantalla** (si no, es otra key y la precarga no sirve). Pantalla nueva o input cambiado → actualizar `usePrefetch` y su test (`src/routes/groups/__tests__/list.test.tsx` verifica los inputs exactos).
- La precarga usa `staleTime: 10_000` para no repetir pedidos al pasar el mouse varias veces; la pantalla igual revalida al montar.
- **Sembrar en vez de pedir:** si ya tenemos los datos de la próxima pantalla, copiarlos con `setQueryData`. Ej.: `expenses.list` y `expenses.get` devuelven lo mismo por gasto (mismo `include` en la API), así que al tocar un gasto su detalle sale de la lista sin pedido. Si la API cambia uno de los dos, revisar esto.

## Offline (solo lectura)

Sin conexión, la app (instalada, PWA) abre igual y muestra **lo último que se trajo de la API**, con el aviso "Sin conexión: mostrando lo último que viste" (`src/components/offline-banner.tsx`). Al volver la red, las queries se actualizan solas.

- **Dónde se guarda:** la cache de TanStack Query se guarda en `localStorage` con `PersistQueryClientProvider` (`src/components/api-provider.tsx`, helpers en `src/lib/offline-cache.ts`), serializada con **superjson** (las fechas vuelven como `Date`, igual que por tRPC). No es el service worker: ese guarda solo los archivos de la app.
- **Qué se guarda:** solo queries exitosas, nunca mutations ni tokens (la sesión la maneja Supabase). Vale **7 días** (`CACHE_MAX_AGE`); por eso `gcTime` es igual (si una query sale de memoria antes, no se guarda).
- **Por usuario:** una entrada por cuenta (`kachingga-cache:<userId>`) y un `QueryClient` por usuario (`key` en `ApiProvider`): otra cuenta en el mismo dispositivo nunca ve la cache de la anterior, ni en disco ni en memoria. **"Cerrar sesión" borra todo** (`clearOfflineCache()` + `queryClient.clear()`, en `src/routes/account.tsx`).
- **Sesión vencida sin red:** el token de Supabase dura ~1 h y sin red no se puede renovar, así que la sesión aparece vacía. Si el dispositivo tiene la cache del último usuario (`kachingga-cache-user`), `RequireAuth` abre la app igual en solo lectura. Al volver la red, Supabase renueva la sesión sola; si todavía no lo hizo, manda a /login (limitación conocida).
- **Solo lectura:** sin conexión, toda mutation falla **antes** de su `onMutate` (sin optimistic update ni pedido) con "Necesitás conexión para guardar" (`createMutationCache()`, la usan la app y `renderWithApi`). Cada pantalla muestra el error como siempre; el formulario de gasto queda abierto con lo cargado. No se encolan cambios para mandarlos después (conflictos, saldos).
- **Arranque sin red:** TanStack Query asume que hay conexión hasta el evento `offline`; `syncOnlineAtStartup()` (`main.tsx`) lo corrige al abrir.
- Una pantalla que nunca se abrió con red no tiene nada guardado: queda en su skeleton hasta que vuelva la conexión.
- **Tests:** `src/lib/__tests__/offline-cache.test.tsx` (restaurar, por usuario, borrar, mutations, aviso), `src/components/__tests__/require-auth.test.tsx`, el de cerrar sesión en `account.test.tsx`, el de pagos sin conexión en `settlements.test.tsx` y `e2e/offline.spec.ts`.
