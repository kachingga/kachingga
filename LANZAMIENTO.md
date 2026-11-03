# Lanzamiento

> Antes de pagar nada, ver **`CONTRAS.md`**: costos, impuestos y por qué no hay integración con Mercado Pago, para decidir si seguir o volver a Tricount.

Dos hitos distintos. **El que está en curso es la Fase 1.** La Fase 2 es a futuro y no se arranca sin decidirlo explícitamente.

| Fase | Para quién | Cómo se instala | Cuándo |
|------|------------|-----------------|--------|
| **1. Privada** | El grupo de amigos | iPhone: **TestFlight**. Android: **APK** (build `preview`) | Al cerrar la V1 |
| **2. Pública** | Cualquier persona | App Store y Google Play | Después de la Fase 1, cuando se decida |

> Cada ítem pendiente con issue tiene el link. Al completar uno, se tilda acá y se cierra el issue (ver "Cuándo una tarea está terminada" en `CLAUDE.md`).

---

## Fase 1 — Privada: todo el grupo usándola a la vez

**Objetivo:** que todos tengan la app instalada, logueados contra producción, recibiendo los updates solos.

### Bloqueantes
- [ ] **API en Railway** (producción) — [#5](https://github.com/kachingga/kachingga/issues/5). Sin esto la app no anda fuera de una compu de desarrollo.
- [ ] **Cuenta de Apple Developer** (USD 99/año, la paga Galo) — [#12](https://github.com/kachingga/kachingga/issues/12). Sin esto no hay forma de instalar la app nativa en un iPhone (ni sin publicarla). **Expo Go no sirve para usarla**: solo para desarrollar (depende de que una compu corra `expo start`).

### Puesta en marcha (en orden)
1. [ ] API en Railway con las variables de `.env.prod` y su URL en `INFRA.md` — [#5](https://github.com/kachingga/kachingga/issues/5).
2. [ ] Variables de prod en EAS, entorno `production` (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) — `DEPLOY.md`.
3. [ ] **Android:** build `preview` (APK) y compartir el link de instalación.
4. [ ] **iPhone:** build `production` → TestFlight, con cada amigo como *Internal Tester* — [#12](https://github.com/kachingga/kachingga/issues/12), pasos en `DEPLOY.md`.
5. [ ] `EXPO_TOKEN` en GitHub para que los updates OTA salgan solos al mergear — [#6](https://github.com/kachingga/kachingga/issues/6).
6. [ ] Cada uno se registra **en prod** desde la app (las cuentas de dev no sirven en prod).

### Para que ande bien con todos usándola
- [ ] **Backup de la base de prod** — [#8](https://github.com/kachingga/kachingga/issues/8). Desde que hay datos reales, perderlos es perder las cuentas del grupo.
- [ ] Decidir si el registro queda abierto o se crean las cuentas a mano (Supabase → Authentication). Con la app solo en TestFlight/APK, abierto está bien.
- [ ] Confirmación de email: el servidor de mails que trae Supabase tiene un límite muy bajo por hora. Para un grupo chico alcanza; si molesta, desactivar "Confirm email" en Supabase.
- [ ] Probar el recorrido completo en un iPhone y en un Android reales antes de invitar a todos (los E2E de CI son en emulador Android).

> Los builds de EAS (Android e iOS) **solo se lanzan cuando alguien lo pide explícitamente**.

---

## Fase 2 — Pública en App Store y Google Play (futuro)

**No arrancar sin decisión explícita.** Varias decisiones de producto se tomaron pensando en un grupo de amigos (ver "Decisiones de producto tomadas" en `CLAUDE.md`) y hay que revisarlas.

### Requisitos de las stores
- [ ] **Borrar la cuenta desde la app** (Apple lo exige si la app permite crear cuenta): procedure en la API + pantalla, borrando también en Supabase Auth y definiendo qué pasa con sus gastos en grupos compartidos.
- [ ] **Política de privacidad** publicada (URL) y declaración de datos en App Store Connect / Google Play.
- [ ] **Términos de uso** y **URL / mail de soporte**.
- [ ] Ícono, capturas, descripción y categoría para cada store.
- [ ] **Apple:** pasar la revisión de App Store. Publicando como persona, la store muestra **el nombre de Galo** como vendedor; para que diga "Kachingga" hace falta una organización (con número D-U-N-S).
- [ ] **Google Play:** cuenta de desarrollador (USD 25, pago único). Las cuentas personales nuevas tienen que hacer una **prueba cerrada con al menos 12 testers durante 14 días** antes de publicar.

### Producto y operación con usuarios desconocidos
- [ ] Revisar decisiones "para amigos": todos los miembros con los mismos permisos (sin admin), cualquiera puede editar/borrar cualquier gasto, código de invitación como única barrera de entrada a un grupo.
- [ ] Servidor de mail propio (SMTP) en Supabase para confirmación y recuperación de contraseña.
- [ ] Límites contra abuso en la API (rate limiting) y en el registro.
- [ ] Reporte de errores en la app y en la API (ej. Sentry).
- [ ] Revisar costos al crecer: planes de Supabase, Railway y EAS.
- [ ] Revisar requisitos legales de datos personales en Argentina.
- [ ] Canales de EAS Update separados para la versión de las stores (hoy todo el grupo está en `main`).
