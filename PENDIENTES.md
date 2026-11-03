# Pendientes

Todo lo que falta **fuera del código de las versiones** (el alcance de producto está en `V1.md` / `V2.md`): lanzamiento e infraestructura. Cada ítem con issue tiene el link; los issues de GitHub (labels `infra` y `blocked`) son el tracker y este archivo es el resumen.

**Cómo mantenerlo:** al terminar algo, se borra de acá (o se tilda si es parte de una lista de lanzamiento), se cierra su issue y lo que haya que saber queda documentado donde corresponde (`INFRA.md`, `DEPLOY.md` o el `CLAUDE.md` que toque). Lo nuevo pendiente se agrega acá **y** como issue.

---

## Lanzamiento

| Fase | Para quién | Estado |
|------|------------|--------|
| **1. Privada** | El grupo de amigos, todos usándola a la vez | **En curso** (al cerrar la V1) |
| **2. Pública** | Cualquier persona, en las stores | Futuro: no arrancar sin decidirlo explícitamente |

> Costos y la decisión de front (web app vs. nativa): `docs/decisiones/costos-y-alternativas.md`.

### Fase 1 — Privada: todo el grupo usándola

**Objetivo:** que todos la tengan en el celu, logueados contra producción y siempre en la última versión.

**Bloqueantes:**
- [x] **Decidir el front**: web app mobile-first (`apps/web`) — `docs/decisiones/costos-y-alternativas.md`.
- [ ] **Pantallas de la V1** en `apps/web` (las hace Juan; ver `V1.md` → "Trabajo de la UI (web)").
- [ ] **API en Railway** (producción) — [#5](https://github.com/kachingga/kachingga/issues/5). Bloqueado por presupuesto (Hobby, USD 5/mes).

**Puesta en marcha (web app)** — pasos en `DEPLOY.md`:
1. [ ] API en Railway con las variables de `apps/api/.env.prod` y su URL en `INFRA.md` — [#5](https://github.com/kachingga/kachingga/issues/5).
2. [ ] Web en Vercel con las variables `VITE_*` de prod; su URL en `INFRA.md` y en `CORS_ORIGINS` de Railway.
3. [ ] Hacerla instalable (PWA) — [#18](https://github.com/kachingga/kachingga/issues/18).
4. [ ] Cada uno la abre en el celu y la agrega a la pantalla de inicio (iPhone: Safari → Compartir → "Agregar a inicio").
5. [ ] Cada uno se registra **en prod** (las cuentas de dev no sirven en prod).

**Si algún día se hace la app nativa** (pasos en `DEPLOY.md`):
1. [ ] API en Railway — [#5](https://github.com/kachingga/kachingga/issues/5).
2. [ ] Cuenta de Apple Developer (USD 99/año) — [#12](https://github.com/kachingga/kachingga/issues/12). Sin esto no hay app nativa en iPhone; Expo Go solo sirve para desarrollar.
3. [ ] Variables de prod en EAS, entorno `production`.
4. [ ] Android: build `preview` (APK). iPhone: build `production` → TestFlight (*Internal Testers*).
5. [ ] `EXPO_TOKEN` en GitHub para los updates automáticos — [#6](https://github.com/kachingga/kachingga/issues/6).
6. [ ] Cada uno se registra **en prod**.

> Los builds de EAS **solo se lanzan cuando alguien lo pide explícitamente**.

**Para que ande bien con todos usándola:**
- [ ] **Aplicar las migraciones pendientes en prod** (`bun run db:migrate:prod`): hoy prod no tiene la del alias para cobrar.
- [ ] **Bajar Supabase a Free** (la org `kachingga` está en Pro, ~USD 35/mes).
- [ ] **Backup de la base de prod** — [#8](https://github.com/kachingga/kachingga/issues/8).
- [ ] Decidir si el registro queda abierto o se crean las cuentas a mano (Supabase → Authentication).
- [ ] Confirmación de email: el servidor de mails de Supabase tiene un límite muy bajo por hora; si molesta, desactivar "Confirm email".
- [ ] Probar el recorrido completo en un iPhone y en un Android reales antes de invitar a todos.

### Fase 2 — Pública en App Store y Google Play (futuro)

**No arrancar sin decisión explícita.** Varias decisiones de producto se tomaron pensando en un grupo de amigos y hay que revisarlas. Si se sigue como web app, solo aplica lo que no es de las stores.

**Requisitos de las stores (solo app nativa):**
- [ ] **Borrar la cuenta desde la app** (Apple lo exige): procedure + pantalla, borrando también en Supabase Auth y definiendo qué pasa con sus gastos en grupos compartidos.
- [ ] Política de privacidad (URL), declaración de datos, términos de uso y URL/mail de soporte.
- [ ] Ícono, capturas, descripción y categoría.
- [ ] **Apple:** revisión de App Store. Publicando como persona, figura **el nombre de Galo** como vendedor; para que diga "Kachingga" hace falta una organización (con número D-U-N-S).
- [ ] **Google Play:** USD 25 (una vez). Las cuentas personales nuevas necesitan una **prueba cerrada con al menos 12 testers durante 14 días** antes de publicar.

**Producto y operación con usuarios desconocidos:**
- [ ] Revisar decisiones "para amigos": todos con los mismos permisos (sin admin), cualquiera edita/borra cualquier gasto, el código de invitación como única barrera.
- [ ] Servidor de mail propio (SMTP) en Supabase.
- [ ] Límites contra abuso más finos: por usuario (no solo por IP), store compartido si hay varias instancias de la API, y revisar los límites de registro de Supabase. (Ya hay límite por IP: `apps/api/CLAUDE.md` → "Seguridad".)
- [ ] Reporte de errores en la app y en la API (ej. Sentry).
- [ ] Revisar costos al crecer (Supabase, Railway, Vercel —Hobby es solo no comercial—, EAS).
- [ ] Requisitos legales de datos personales en Argentina.
- [ ] Canales de EAS Update separados para la versión de las stores (solo nativa).

---

## Infraestructura

### Web instalable (PWA) — [#18](https://github.com/kachingga/kachingga/issues/18)
Manifest, íconos y meta tags para que "Agregar a inicio" la abra como app. Depende de los íconos del diseño.

### EAS Update automático — [#6](https://github.com/kachingga/kachingga/issues/6) (solo app nativa)
El workflow existe (`.github/workflows/eas-update.yml`) y está **inactivo** hasta que haya a quién mandarle updates y un `EXPO_TOKEN`. **Falta:** Railway → variables de prod en EAS → primer build instalado → secret `EXPO_TOKEN`. Pasos en `DEPLOY.md` → "Activar EAS Update automático". Con la web como front, este ítem queda en pausa (los deploys de Vercel cumplen esa función); solo aplica si se hace la app nativa.

### Entorno de staging (opcional) — [#7](https://github.com/kachingga/kachingga/issues/7)
**Ya hay base de dev** (`kachingga-dev`, `INFRA.md` → "Entornos"). **Falta, solo si hace falta:** un entorno `staging` en Railway apuntando a `kachingga-dev` (y, si es nativa, un canal `staging` de EAS Update). Hoy no hace falta: se desarrolla en local contra dev.

### Backup semanal de la base de prod — [#8](https://github.com/kachingga/kachingga/issues/8)
Snapshot semanal (`pg_dump`) guardado fuera de Supabase, con retención de las últimas N semanas. Opción: GitHub Actions programado con la URL de prod como secret.
