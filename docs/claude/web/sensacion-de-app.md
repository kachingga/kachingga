# Sensación de app nativa — web

> **Aplica a:** transiciones entre pantallas (`src/components/animated-layout.tsx`, `src/lib/use-go-back.ts`), navegación al guardar o borrar, gestos, inputs en el celu, arranque y tamaño del bundle, PWA. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

Una web nunca se siente 100% nativa en iPhone: los gestos del sistema (deslizar desde el borde para volver), la física del scroll y del teclado, los haptics (Safari no los permite) y el arranque instantáneo son del sistema operativo. Pero se puede acercar mucho, y es parte del estándar.

## Que nada espere
Optimistic updates en lo frecuente, precarga de la próxima pantalla, skeletons con la forma real, cero saltos de layout. Cómo: `datos-y-cache.md` y `componentes-y-tema.md`.

## Transiciones entre pantallas

- `AnimatedLayout` envuelve todas las rutas con `key={location.key}`: cada navegación **remonta** la pantalla, y eso reproduce su animación CSS (`src/index.css`: `transform`, 280 ms, `ease-out`). Es CSS + ese truco de React, sin librería.
- **Avanzar** → entra desde la derecha (`page-enter-right`). **Volver** → desde la izquierda (`page-enter-left`). "Volver" = `POP` (atrás del navegador o `navigate(-1)`) o una navegación con `state: { back: true }` (`BackState`).
- **Para cerrar una pantalla** (guardar o borrar y volver a donde estaba) usar **`useGoBack()(fallback)`**, no `navigate(ruta)`: si se abrió desde la app hace `navigate(-1)` (anima como volver y no deja la pantalla dos veces en el historial); si se abrió por un link directo (`location.key === 'default'`), va a `fallback` marcando la navegación como "volver".
- Con **"reducir movimiento"** del sistema (`prefers-reduced-motion`) no hay animación.
- **Limitación:** solo se anima la pantalla que entra; la vieja desaparece de golpe (por un instante se ve el fondo). Reemplazarlas por la View Transitions API (las dos pantallas a la vez, como iOS) es opcional y se evalúa con la PWA instalada en un iPhone real: #35. En Safari dentro del navegador, el gesto de volver ya tiene su animación y una de la app encima puede verse doble.
- Hojas y modales: animación corta (150–250 ms) que no bloquee (los de shadcn ya la traen).

## Comportamiento de app

- Sin rebote ni "pull to refresh" del navegador donde no corresponde (`overscroll-behavior`), sin selección de texto ni resaltado gris al tocar en controles (`-webkit-tap-highlight-color: transparent`, `user-select` donde aplique), `100dvh` para alturas, zonas seguras con `env(safe-area-inset-*)` (`viewport-fit=cover` ya está; la clase `pb-safe` de la barra de abajo **no existe** en Tailwind v4: pendiente en `V1.md`).
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
