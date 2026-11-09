# Lanzamiento: fases y requisitos

> Qué significa cada fase de lanzamiento y qué exige cada una. **Las tareas no están acá**: son issues de GitHub agrupados en los milestones [Fase 1 — Privada](https://github.com/kachingga/kachingga/milestone/1) y [Fase 2 — Pública (futuro)](https://github.com/kachingga/kachingga/milestone/2). Este doc es el contexto para crearlos y decidir.
>
> Investigado en nov 2026. Los requisitos de las stores cambian: verificarlos antes de la Fase 2.

| Fase | Para quién | Estado |
|------|------------|--------|
| **1. Privada** | El grupo de amigos, todos usándola a la vez | **En curso** (al cerrar la V1) |
| **2. Pública** | Cualquier persona (stores o web abierta) | Futuro: **no arrancar sin decidirlo explícitamente** (#44) |

Costos y la decisión de front (web app vs. nativa): [`costos-y-alternativas.md`](costos-y-alternativas.md).

---

## Fase 1 — Privada

**Objetivo:** que todos la tengan en el celu, logueados contra producción y siempre en la última versión.

**Camino (web app, el front decidido):** web y API en Railway (staging y prod) → instalable (PWA) → prueba en celus reales → cada uno la instala y se registra **en prod** (las cuentas de dev no sirven en prod). El orden lo dan los "Bloqueado por #N" de cada issue del milestone; los pasos técnicos, `DEPLOY.md`.

**App nativa:** se descartó y se sacó del repo el 8/11/2026 (solo web; ver `costos-y-alternativas.md`). Si algún día se quiere en las stores, se arranca de cero y aplica "Requisitos de las stores" (abajo): cuenta de Apple Developer (USD 99/año), TestFlight o App Store para iPhone y Google Play para Android.

---

## Fase 2 — Pública

Varias decisiones de producto se tomaron pensando en un grupo de amigos y hay que revisarlas. Si se sigue como web app, solo aplica lo que no es de las stores. **Si se decide publicar (#44), cada punto pasa a ser un issue del milestone de la Fase 2.**

### Requisitos de las stores (solo app nativa)
- **Borrar la cuenta desde la app** (Apple lo exige): procedure + pantalla, borrando también en Supabase Auth y definiendo qué pasa con sus gastos en grupos compartidos.
- Política de privacidad (URL), declaración de datos, términos de uso y URL o mail de soporte.
- Ícono, capturas, descripción y categoría.
- **Apple:** revisión de App Store. Publicando como persona, figura **el nombre de Galo** como vendedor; para que diga "Kachingga" hace falta una organización (con número D-U-N-S).
- **Google Play:** USD 25 (una vez). Las cuentas personales nuevas necesitan una **prueba cerrada con al menos 12 testers durante 14 días** antes de publicar.

### Producto y operación con usuarios desconocidos
- **Revisar decisiones "para amigos"**: todos con los mismos permisos (sin admin), cualquiera edita o borra cualquier gasto, el código de invitación como única barrera (`CLAUDE.md` → "Decisiones de producto tomadas").
- Servidor de mail propio (SMTP) en Supabase y **prender "Confirm email"** (en la Fase 1 está apagado, #41). Sin confirmar el email, alguien podría registrarse con el mail de otra persona y quedar unido a su cuenta cuando esa persona entre con Google con el mismo mail (Supabase une identidades por email).
- Límites contra abuso más finos: por usuario (no solo por IP), store compartido si hay varias instancias de la API, y los límites de registro de Supabase. (Ya hay límite por IP: `docs/claude/api/seguridad.md`.)
- Reporte de errores en la web y en la API (ej. Sentry).
- Costos al crecer (Supabase, Railway).
- Requisitos legales de datos personales en Argentina.
