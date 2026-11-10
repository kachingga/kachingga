# Tests — web

> **Aplica a:** `apps/web/src/**/__tests__/`, `src/test/setup.ts`, `src/test/render.tsx`, `apps/web/e2e/`, `apps/web/playwright.config.ts`. **Si cambiás cómo se testea, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

| Nivel | Herramienta | Dónde | Corre en |
|-------|-------------|-------|----------|
| Unit (helpers, hooks) | Vitest | `src/**/__tests__/*.test.ts` | `bun run check` / pre-commit / CI |
| **Contenido de pantallas** | Vitest + Testing Library + `renderWithApi` | `src/**/__tests__/*.test.tsx` | `bun run check` / pre-commit / CI |
| E2E (recorridos en el navegador) | Playwright, en celular (WebKit) y compu (Chrome) | `e2e/*.spec.ts` | Local (`bun run e2e`) y en GitHub Actions (a mano o PRs con label `e2e`) |

## Tests de contenido (`renderWithApi`)

`src/test/render.tsx` renderiza una pantalla con los mismos providers que la app (tRPC + TanStack Query + router + `ConfirmProvider` + `Toaster`) contra una **API falsa**: un handler por procedure. Ejemplo completo en `src/test/__tests__/render.test.tsx`.

```tsx
renderWithApi(<GroupScreen />, {
  'groups.get': () => fixtureGroup,
  'balances.get': () => [],
  'expenses.list': () => ({ items: [], nextCursor: null }),
}, '/grupos/g1');
expect(await screen.findByText('Todavía no hay gastos')).toBeInTheDocument();
```

- Un test por estado (cargando con `neverResolves`, vacío, error con `throw apiError(...)`, datos) + las interacciones principales (`@testing-library/user-event`), verificando qué procedure se llamó y con qué input.
- Un procedure sin handler responde `NOT_FOUND` ("Sin handler de test para …").
- El 3er argumento es la URL inicial (sirve para `?from=…` y otros search params). La pantalla se renderiza sin `<Routes>`, así que `useParams` viene vacío.
- Devuelve también el `queryClient`: para datos que cambian con la pantalla abierta (cambiar lo que responde el handler y `await act(() => queryClient.invalidateQueries())`; ej. "Saldo actualizado" en `detail.test.tsx`).
- Buscar como el usuario: `getByRole`, `getByLabelText`, `getByText`.
- Datos falsos con la forma real (`docs/claude/api/contrato.md` o `inferRouterOutputs<AppRouter>`).
- **Login y sesión:** se mockea `@/lib/auth` entero (`vi.mock`, ej. `login.test.tsx`). **Captcha:** `vi.mock('@marsidev/react-turnstile', () => import('@/test/fake-turnstile'))` + `vi.stubEnv('VITE_TURNSTILE_SITE_KEY', …)` en el test: "Resolver captcha" da el token `captcha-token` (sin la variable no hay widget).
- Optimistic updates: ver `datos-y-cache.md` (qué testear).

## Setup (`src/test/setup.ts`)

- Navegador en **`es-AR`** (`navigator.language`): los montos se ven "1.500,50".
- Stubs de lo que jsdom no tiene y usan los toasts: `matchMedia` y pointer capture (`setPointerCapture`…). Sin el segundo, tocar un botón de un toast tira un error no capturado y Vitest falla.
- `QueryClient` de los tests con `gcTime: Infinity` (si no, quedan timers colgados) y sin reintentos.
- **Los tests no pueden depender de `.env`** (corren en el CI y en el pre-commit de todos): `vite.config.ts` → `test.env` les da valores fijos a las `VITE_*`. Si agregás una variable que se lee al importar un módulo, sumala ahí también.

## E2E (Playwright)

- **Qué lleva E2E:** solo los recorridos críticos (registrarse / login, crear grupo, unirse con código, agregar gasto, ver saldos, registrar pago). El resto va en los tests de contenido.
- Corre contra el **build de producción** (`build` + `preview` en :4173), en celular (WebKit) y compu (Chrome), con `locale: 'es-AR'`.
- **Sin API** (siempre): `e2e/smoke.spec.ts` (la app carga), `e2e/pwa.spec.ts` (instalable), `e2e/offline.spec.ts` (abre sin red; con la sesión vencida, en solo lectura sin esperar ~25 s a la librería), `e2e/splash.spec.ts` (el logo mientras carga), `e2e/accesibilidad.spec.ts` (axe en login, registro y "¿Olvidaste tu contraseña?", claro y oscuro: `e2e/axe.ts`) y `e2e/transiciones.spec.ts` (las pantallas cambian con View Transitions, y no con "reducir movimiento").
- **Captcha:** `e2e.yml` buildea con la *site key* de prueba de Turnstile (`1x00000000000000000000AA`, la misma de `apps/web/.env.sample`): el widget aparece en todos los specs (baja de `challenges.cloudflare.com`, hace falta red) y a los ~2 s da un token que siempre pasa. Los botones de enviar están deshabilitados hasta tener el token: `click()` espera solo, y `accesibilidad.spec.ts` espera que se habiliten antes de axe (así revisa la pantalla con el widget). Sin la variable no hay widget y todo anda igual.
- **Con API — los recorridos críticos** (`e2e/recorridos.spec.ts`, solo en celular: son lentos y crean datos): registro (confirmando el email) → cerrar sesión → login; y en un solo test, con dos usuarios (dos `browser.newContext()`): crear grupo → agregar participante sin cuenta → gasto en partes iguales → saldos y "cómo quedar a mano" → el otro usuario se une con el código reclamando a ese participante → "Marcar como pagado" → los dos "al día". Tarda ~35 s.
  - **Cuentas** (`e2e/accounts.ts`): las de los recorridos se crean **ya confirmadas** con la API de admin de Supabase (`auth.admin.createUser({ …, email_confirm: true })`: sin mail ni captcha) y entran por la pantalla de login (con el captcha). **El registro por pantalla se sigue probando** con una cuenta: con *Confirm email* apagado entra directo; prendido, ve "Revisá tu mail" y el test abre `/login#token_hash=…` con un token generado por admin (`auth.admin.generateLink`, el mismo que lleva el link del mail), que confirma y entra (`useEmailLink`). Está hecho para andar con *Confirm email* y el captcha prendidos o apagados en `stg`.
  - Corren solo con **`E2E_API=1`**: Playwright levanta también la API (`bun run --cwd ../api start`, en :3000) y `preview` le reenvía `/trpc` (la web con `VITE_API_URL` vacía, sin CORS). Sin `E2E_API` se saltean.
  - **Local:** `E2E_API=1 bun run e2e` desde `apps/web`, con `apps/api/.env` y `apps/web/.env` de dev (con la *site key* de prueba si el captcha está prendido en dev). Si ya tenés la API corriendo, la reusa. Los tests leen `SUPABASE_URL` y `SUPABASE_SECRET_KEY` del entorno o, si no están, de `apps/api/.env` (la misma que usa la API): no hace falta nada más. La clave secret queda del lado de Node, nunca en el navegador.
  - **CI** (`e2e.yml`, a mano o con la label `e2e`): corren si existen los secrets `E2E_*` (`INFRA.md` → "GitHub"); si no, avisa y corre solo lo que no necesita API.
  - **Sin traces con `E2E_API=1`** (`playwright.config.ts`): el reporte del CI es un artifact público (dura 3 días) y un trace guarda tokens de sesión y contraseñas. Para depurar en local: `E2E_API=1 bunx playwright test --trace retain-on-failure` (queda en `test-results/`, gitignoreado).
  - **Qué dejan en dev** (`stg`): cada corrida crea tres cuentas nuevas con mails únicos (por eso no hace falta guardar contraseñas): dos por admin (`e2e+…@example.com`, nunca reciben un mail) y la del registro por pantalla, `delivered+e2e-registro-…@resend.dev`. Con *Confirm email* prendido, Supabase le manda **un mail de verdad por corrida** a esa dirección: es una dirección de prueba de Resend (cuenta como entregado, sin rebote que dañe la reputación del dominio, pero **sí suma al límite de 100 mails por día** de Resend); a `example.com` Supabase no manda (la rechaza como inválida). Más un grupo `E2E <fecha>` que **se archiva al final**. Se puede limpiar con un filtro por esos nombres; nunca corren contra prod.
- Ponerle la label `e2e` a los PRs que cambian un recorrido crítico.
- Ojo: Playwright con `locale: 'es-AR'` en Chromium reporta `navigator.language = 'es-419'` (como Chrome real en Argentina).
