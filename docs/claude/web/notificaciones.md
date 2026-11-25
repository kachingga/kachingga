# Notificaciones en el dispositivo (Web Push) — web

> **Aplica a:** `apps/web/public/push-sw.js` (lo que corre en el service worker), `src/lib/push.ts` (suscribir, desuscribir, la sesión, los mensajes del service worker, el número en el ícono), `src/components/push-device-card.tsx` (Mi cuenta y el aviso de la pantalla de notificaciones), lo que usa `AppShell` de ahí, y `workbox.importScripts` en `vite.config.ts`. Del lado de la API: `apps/api/src/lib/push.ts` (`docs/claude/api/contrato.md` y `docs/claude/api/seguridad.md`). **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Las reglas (a quién le llega, silenciar, una por minuto): `CLAUDE.md` raíz → "Notificaciones".

## Cómo llega una

1. **Activar** (Mi cuenta, o el aviso de arriba de la pantalla de notificaciones): el navegador pide permiso (tiene que salir de un toque), se suscribe con la clave VAPID pública que da `notifications.pushConfig` (`pushManager.subscribe`, `userVisibleOnly: true`) y la web le pasa la suscripción a la API (`notifications.subscribeDevice`: la URL del servicio de push de ese navegador y las claves para cifrarle). Queda anotado qué cuenta la activó (`kachingga-push-user` en `localStorage`).
2. **Alguien cambia un gasto o un pago:** la API guarda la notificación y la encola (`queuePushes`). Unos segundos después (y como mucho una por minuto por persona y grupo), si no está silenciado y sigue sin leer, le manda a cada dispositivo de esa persona la última notificación no leída del grupo, cifrada, al servicio de push del navegador (Google, Apple, Mozilla o Microsoft), que la entrega aunque la app esté cerrada.
3. **El service worker** (`push-sw.js`, evento `push`) muestra la notificación (una por grupo: `tag`), pone el número de no leídas en el ícono (`setAppBadge`, donde existe) y le avisa a la app abierta (`kachingga:push`), que vuelve a pedir lo que muestra.
4. **Tocarla** (`notificationclick`): si la app está abierta, la enfoca y navega sin recargar (`kachingga:navigate` → `useServiceWorkerMessages` en `AppShell`); si no, la abre en esa ruta. Solo rutas de la app: el link se arma y tiene que quedar en el mismo origen (así `//otro.com` o `/\otro.com` no salen de la app); cualquier otra cosa abre `/notificaciones` (la pantalla de la campanita; `/novedades`, su nombre anterior, redirige ahí).

## Dónde anda (y dónde no)

| Dónde | Cómo |
|-------|------|
| **Android** (Chrome, Edge, Samsung…) | Anda, instalada o no |
| **iPhone / iPad** (iOS 16.4+) | **Solo instalada en la pantalla de inicio** y abierta desde el ícono. En Safari, sin instalar, no hay `PushManager`: la tarjeta explica cómo instalarla (`pushSupport()` → `needs-install`) |
| **Compu** (Chrome, Edge, Firefox, Safari) | Anda con el navegador abierto (aunque sin la pestaña) |

- **El permiso se pide una vez.** Si la persona toca "No permitir", el navegador no deja volver a preguntar: la tarjeta dice que las permita desde la configuración (`denied`). Por eso hay un aviso propio ("¿Te avisamos en este dispositivo?") antes del pedido del sistema.
- **Cada push muestra una notificación** (incluso si no se puede leer: "Tenés notificaciones nuevas"). Los navegadores le sacan el permiso a un sitio que recibe pushes sin mostrarlas, así que no se usan para actualizar datos en silencio.
- **Es por dispositivo** (por navegador): la compu y el celu se activan cada uno.
- Lo que se ve con el celu bloqueado depende del celu (iOS y Android dejan ocultar el contenido).

## La sesión

- **Cerrar sesión** (`useSignOut`) primero las apaga **en todos los dispositivos** de la cuenta (`notifications.unsubscribeAll`: cerrar sesión en Supabase cierra todas las sesiones; sin conexión, o si la API tarda más de 2 s, cierra igual), y desuscribe este navegador en el acto (y cierra las notificaciones que quedaron en el centro de notificaciones y borra el número del ícono: el próximo que use el celu no las ve), y `syncPushWithSession()` (`main.tsx`) lo hace cuando la sesión termina por cualquier camino (`SIGNED_OUT`) y cuando hay una sesión de **otra cuenta** que la que las activó. Así otra persona en ese celu nunca ve las notificaciones de la anterior.
- Desuscribir es del lado del navegador: el servicio de push deja de conocer esa dirección y la API borra el dispositivo la próxima vez que intenta mandarle algo (404 / 410). Sin conexión puede no llegar a desuscribirse; la sesión igual se cierra.
- **Abrir la app con sesión confirma este dispositivo** (`useConfirmDevice` en `AppShell`, si lo activó esta cuenta): sigue recibiendo otros 30 días. Uno en el que nadie abre la app deja de recibirlas solo.
- **Mi cuenta muestra "Activadas" solo si las dos partes lo saben:** el navegador tiene una suscripción **y** la API la tiene a nombre de esta cuenta (`notifications.deviceStatus`). Si el navegador cambió la suscripción por su cuenta, aparece como desactivada y se vuelve a activar.

## El service worker

- `vite-plugin-pwa` genera el service worker (Workbox, `generateSW`) y le importa `public/push-sw.js` (`workbox.importScripts`). Es JavaScript a mano, fuera del bundle (no pasa por TypeScript ni ESLint): se prueba en `src/lib/__tests__/push-sw.test.ts`, que lo corre con un `self` falso.
- El service worker sigue sin guardar datos de la API (`sensacion-de-app.md` → "PWA"): la notificación trae su texto en el mensaje.
- No toca la CSP: el servicio de push lo usa el navegador por dentro, y `push-sw.js` es del mismo origen (`script-src 'self'`).

## Probarlo

- **Tests:** `src/components/__tests__/push-device-card.test.tsx` (cada estado de la tarjeta, activar y desactivar con un navegador falso), `src/lib/__tests__/push.test.tsx` (qué soporta el navegador, la sesión) y `push-sw.test.ts`. Del lado de la API, `apps/api/src/__tests__/integration/push.test.ts` descifra lo que recibiría un navegador.
- **En local:** generar claves (`bunx web-push generate-vapid-keys` desde `apps/api`) y ponerlas en `apps/api/.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). El service worker solo existe en el build: `bun run build && bun run preview` (en `localhost` el navegador lo permite sin HTTPS). Desde el celu por la Wi-Fi (`dev:celu`) no anda: hace falta HTTPS, así que en el celu se prueba en **staging**.
- **Falta probarlo en un iPhone y un Android reales** (instalada, con la app cerrada, tocar la notificación, el número en el ícono).
