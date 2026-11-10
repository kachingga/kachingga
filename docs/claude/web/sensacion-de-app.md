# Sensación de app nativa — web

> **Aplica a:** transiciones entre pantallas (`src/components/animated-layout.tsx`, `src/lib/screen-transitions.ts`, `src/lib/use-go-back.ts`), navegación al guardar o borrar, gestos, inputs en el celu, arranque y tamaño del bundle, PWA. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

Una web nunca se siente 100% nativa en iPhone: los gestos del sistema (deslizar desde el borde para volver), la física del scroll y del teclado, los haptics (Safari no los permite) y el arranque instantáneo son del sistema operativo. Pero se puede acercar mucho, y es parte del estándar.

## Que nada espere
Optimistic updates en lo frecuente, precarga de la próxima pantalla, skeletons con la forma real, cero saltos de layout. Cómo: `datos-y-cache.md` y `componentes-y-tema.md`.

## Transiciones entre pantallas

Con la **View Transitions API** (#35): el navegador saca una foto de la pantalla vieja y **anima las dos a la vez**, como iOS. Anda en Safari 18+ y Chrome; donde no está, queda la animación CSS de antes (solo entra la nueva).

- **Una pantalla = un path.** `AnimatedLayout` (`src/components/animated-layout.tsx`) envuelve todas las rutas con `key={location.pathname}`: cambiar de path monta la pantalla nueva; cambiar **solo los search params** (los filtros en la URL, que se escriben letra por letra con `replace`) **no** remonta ni anima (antes, con `key={location.key}`, cada letra remontaba Filtros y se perdía el foco).
- **Cómo se dispara** (`src/lib/screen-transitions.ts`): `withViewTransitions(router)` (en `src/router.tsx`) hace que **toda navegación a otro path** vaya con `viewTransition: true` de React Router, en un solo lugar (no hace falta ponerlo en cada `<Link>` ni `navigate()`). React Router hace el cambio dentro de `document.startViewTransition` y, al volver (`POP`) a una pantalla a la que llegó así, también anima. Se usó esto y **no** el `<ViewTransition>` de React: React actualiza sincrónicamente en `popstate` y ahí no hay transición, así que "volver" no animaba.
- **Dirección:** **avanzar** → la nueva entra desde la derecha por encima de la vieja, que se corre un poco a la izquierda y se oscurece apenas; **volver** → la vieja se va a la derecha y destapa la anterior. "Volver" = `POP` (atrás del navegador, `navigate(-1)`), una navegación con `state: { back: true }` (`BackState`) o **subir a la pantalla que contiene a la actual** aunque sea con un link ("Mis grupos" desde un grupo, el grupo desde uno de sus gastos: el path nuevo es el principio del anterior). `AnimatedLayout` la pone en `<html data-nav="forward|back|none">` y el CSS (`src/index.css`, `::view-transition-old/new(page)`, 380 ms) la lee. La primera pantalla al abrir la app no anima.
- **Lo que se mueve:** el contenido de la pantalla (`view-transition-name: page`, ancho de `main`: en compu no pasa por encima de la barra lateral). El header del celu tiene su propio nombre (`app-header`) y queda quieto arriba. Cada foto va con el fondo del tema y al menos del alto de la ventana (si no, se ve la otra a través).
- **El gesto de volver de Safari** (deslizar desde el borde, en el navegador) ya anima la página antes de que la app se entere: si encima animara la app, se vería doble. El navegador lo avisa en el `popstate` (`hasUAVisualTransition`, Safari 18+ y Chrome) y entonces `data-nav="none"`: sin animación. Instalada a pantalla completa ese gesto no existe y la de la app es la única.
- **Para apagarlo** (si en el iPhone no convence): `VIEW_TRANSITIONS = false` en `src/lib/screen-transitions.ts` → vuelve en todos lados la animación CSS (`page-enter-right` / `page-enter-left`, solo la pantalla nueva, 280 ms).
- **Para cerrar una pantalla** (guardar o borrar y volver a donde estaba) usar **`useGoBack()(fallback)`**, no `navigate(ruta)`: si se abrió desde la app hace `navigate(-1)` (anima como volver y no deja la pantalla dos veces en el historial); si se abrió por un link directo (`location.key === 'default'`), va a `fallback` marcando la navegación como "volver".
- Con **"reducir movimiento"** del sistema (`prefers-reduced-motion`) no hay animación (ni View Transitions ni la CSS).
- **Tests:** la dirección y el parche del router, en `src/lib/__tests__/screen-transitions.test.ts`; la animación CSS y los filtros sin remontar, en `src/components/__tests__/animated-layout.test.tsx` (jsdom no tiene View Transitions); que el navegador de verdad las use (WebKit y Chrome) y que "reducir movimiento" las apague, en `e2e/transiciones.spec.ts`. Probarlo en un iPhone real: instalada y en Safari (el gesto de volver).
- Hojas y modales: animación corta (150–250 ms) que no bloquee (los de shadcn ya la traen).

## Micro-interacciones

Chicas, rápidas y nunca en el camino (todas en `src/index.css`; con "reducir movimiento" no hay ninguna, por la regla global):
- **Tocar:** botones, tarjetas y chips se achican y rebotan un poco al soltar (`press`); el botón principal además se hunde (borde de abajo, `shadow-ledge` → `shadow-ledge-pressed`). En la tarjeta de un grupo, el deslizar para archivar mueve `translate` (no `transform`) para no pisar el rebote.
- **Lo que acabás de agregar:** el gasto nuevo entra en la lista con un destello verde (`pop-in`) mientras se guarda (la fila provisoria del optimistic update, `isTemp`); lo mismo un pago nuevo.
- **Quedar a mano:** si con la pantalla del grupo abierta tu saldo pasa a cero (ej. al volver de registrar el pago, cuando llegan los saldos de la API), "Tu situación" pasa a lima y muestra "Saldo actualizado" ✓ un par de segundos (`role="status"`, lo anuncia el lector de pantalla). Si ya estabas al día al abrir, no.
- **Entradas:** las secciones suben al aparecer (`rise`; en listas, escalonadas).

## Comportamiento de app

- Sin rebote ni "pull to refresh" del navegador donde no corresponde (`overscroll-behavior`), sin selección de texto ni resaltado gris al tocar en controles (`-webkit-tap-highlight-color: transparent`, `user-select` donde aplique), `100dvh` para alturas, zonas seguras con `env(safe-area-inset-*)` (`viewport-fit=cover` ya está; utilidades `pb-safe`, `pt-safe` y `bottom-safe` en `src/index.css`).
- **Inputs:** texto de **16 px o más** (si no, Safari en iPhone hace zoom al enfocar), `inputMode` correcto (`decimal` para montos), `autocomplete` en login.
- **Gestos propios** donde suman (ej. deslizar para archivar un grupo), siempre con alternativa con botón.

## Arranque y tamaño del bundle

- **Sin rutas con carga diferida (`lazy`) — medido (nov 2026):** el bundle pesa ~260 kB comprimido y las pantallas son solo ~8%. El resto lo comparten todas: `react-dom` (26%), Supabase (~25%, casi todo realtime / storage / postgrest que no usamos), `react-router` (12%) y `zod` (11%). Partir las rutas ahorraría muy poco y sumaría un pedido la primera vez que se abre cada pantalla. Revisarlo si las pantallas pasan a ser una parte grande del bundle.
- **Lo que sí rinde:** el service worker de la PWA (abajo), que guarda la app para que abra al instante, y usar solo la parte de auth de Supabase (~13% menos; en `V1.md` → "Por hacer", opcional).

## PWA (instalable)

- **`vite-plugin-pwa`** (config en `vite.config.ts`): genera el manifest (`display: standalone`, abre a pantalla completa sin barra del navegador) y el service worker (Workbox, `generateSW`).
- **El service worker guarda solo los archivos de la app** (HTML, JS, CSS, íconos, fuentes: los del build). **Los datos de la API no se cachean ahí**: son de cada usuario, viven en otro dominio y los maneja TanStack Query. Para verlos sin conexión hay otra cosa: la cache de TanStack Query guardada en `localStorage`, por usuario (`datos-y-cache.md` → "Offline"). Las rutas de la app caen en `index.html` (`navigateFallback`), así abre sin red.
- **Se actualiza solo** (`registerType: 'autoUpdate'`): al deployar, la próxima vez que se abre baja la versión nueva y la activa. `server.ts` sirve `sw.js`, `registerSW.js` y el manifest con `no-cache` para que el navegador vea el cambio.
- **Íconos:** todos (favicon, PWA, *maskable* de Android, `apple-touch-icon` de iPhone) salen de **`public/logo.svg`** al buildear (`@vite-pwa/assets-generator`, config en `pwa-assets.config.ts`). El logo es una **moneda partida en dos** (dividir gastos) con los colores del tema (verde yerba de fondo, durazno y crema). Para cambiarlo: reemplazar ese archivo y, si cambia el color de fondo, `iconBackground` en `pwa-assets.config.ts` (tiene que ser el mismo color plano del fondo del logo, así el ícono de iPhone y Android no muestra un cuadrado adentro de otro). El manifest usa `theme_color` verde y `background_color` crema (splash de Android).
- **iPhone:** metas `apple-mobile-web-app-*` en `index.html`. Las splash screens (`apple-touch-startup-image`) esperan al logo (`V1.md`); Android arma la suya con el manifest.
- **Test:** `e2e/pwa.spec.ts` (manifest válido + service worker activo).
