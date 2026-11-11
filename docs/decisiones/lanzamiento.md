# Lanzamiento: fases y requisitos

> Qué significa cada fase de lanzamiento y qué exige cada una. **Las tareas no están acá**: son issues de GitHub agrupados en los milestones [Fase 1 — Privada](https://github.com/kachingga/kachingga/milestone/1) y [Fase 2 — Pública](https://github.com/kachingga/kachingga/milestone/2). Este doc es el contexto para crearlos y decidir.
>
> Investigado en nov 2026. Los requisitos de las stores cambian: verificarlos antes de la Fase 2.

| Fase | Para quién | Estado |
|------|------------|--------|
| **1. Privada** | El grupo de amigos, todos usándola a la vez | **Terminada** (nov 2026) |
| **2. Pública** | Cualquier persona | **En curso como web abierta** (decidido el 10/11/2026, #44). Las stores, no |

Costos y la decisión de front (web app vs. nativa): [`costos-y-alternativas.md`](costos-y-alternativas.md).

---

## Fase 1 — Privada

**Objetivo:** que todos la tengan en el celu, logueados contra producción y siempre en la última versión.

**Camino (web app, el front decidido):** web y API en Railway (staging y prod) → instalable (PWA) → prueba en celus reales → cada uno la instala y se registra **en prod** (las cuentas de dev no sirven en prod). El orden lo dan los "Bloqueado por #N" de cada issue del milestone; los pasos técnicos, `DEPLOY.md`.

**App nativa:** se descartó y se sacó del repo el 8/11/2026 (solo web; ver `costos-y-alternativas.md`). Si algún día se quiere en las stores, se arranca de cero y aplica "Requisitos de las stores" (abajo): cuenta de Apple Developer (USD 99/año), TestFlight o App Store para iPhone y Google Play para Android.

---

## Fase 2 — Pública

**Decidido (#44, 10/11/2026): web abierta a cualquiera, sin stores.** Antes se hizo una revisión de seguridad (API, web, infra y CI). Lo que falta, legales y seguridad incluidos, son issues del milestone "Fase 2 — Pública"; lo de las stores (abajo) queda como referencia por si algún día se quiere una app nativa.

### Requisitos de las stores (solo app nativa)
- ~~**Borrar la cuenta desde la app** (Apple lo exige)~~: **ya está** (#104, Mi cuenta → "Borrar mi cuenta"; la regla, en `CLAUDE.md` → "Usuarios y login").
- ~~**Política de privacidad (URL)** y **mail de soporte**~~: **ya están** (#100, la landing: `kachingga.com/privacidad` y `hola@kachingga.com`; dónde está, en `INFRA.md` → "Hosting").
- Declaración de datos y términos de uso.
- Ícono, capturas, descripción y categoría.
- **Apple:** revisión de App Store. Publicando como persona, figura **el nombre de Galo** como vendedor; para que diga "Kachingga" hace falta una organización (con número D-U-N-S).
- **Google Play:** USD 25 (una vez). Las cuentas personales nuevas necesitan una **prueba cerrada con al menos 12 testers durante 14 días** antes de publicar.

### Producto y operación con usuarios desconocidos
- ~~**Revisar decisiones "para amigos"**~~: **revisado** (#44). Quedan así: sin admin, cualquiera edita o borra cualquier gasto y el código de invitación es la barrera, porque a un grupo solo entran personas que se invitan entre sí (`CLAUDE.md` → "Decisiones de producto tomadas").
- ~~Servidor de mail propio (SMTP) en Supabase y prender "Confirm email"~~: **ya está** desde la Fase 1 (#98: SMTP de Resend, *Confirm email* y captcha; `INFRA.md` → "Supabase"). Se adelantó porque, sin confirmar el email, alguien podía registrarse con el mail de otra persona y quedar dentro de su cuenta cuando esa persona entrara con Google.
- ~~Límites contra abuso por usuario~~: **ya están** (escrituras por hora, un tope diario de altas, `MAX_DB_MB` y 25 personas por grupo: `docs/claude/api/seguridad.md`). Quedan para cuando haga falta: un store compartido si hay varias instancias de la API, y limitar las lecturas pesadas (issue del milestone).
- ~~Reporte de errores en la web y en la API~~: **ya está** (Sentry, `docs/claude/repo/monitoreo.md`).
- Costos al crecer (Supabase, Railway).
- Requisitos legales de datos personales en Argentina (Ley 25.326: inscripción en la AAIP, leyenda en la política y transferencia a EE.UU.) y términos de uso: son issues del milestone.
