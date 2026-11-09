# Kachingga — App para dividir gastos en grupo

Proyecto de **Kachingga**, una organización de amigos (repo: `github.com/kachingga/kachingga`). **Hoy es para uso propio del grupo**: cada uno la usa en su celu y siempre en la última versión. El front es una **web app mobile-first** (`apps/web`: se usa en el celu y también en la compu; en `kachingga.com`). No hay app nativa: se sacó del repo (decisión en `docs/decisiones/costos-y-alternativas.md`). **A futuro se podría publicar** (ver `docs/decisiones/lanzamiento.md` → "Fase 2"): no tomar decisiones que lo hagan imposible, pero tampoco construir cosas para usuarios públicos antes de tiempo.

---

## Cómo está organizada la documentación

**La guía completa —qué hay en cada archivo, qué tiene que haber y cómo se lee y se actualiza— está en `README.md` → "Documentación". Leerla antes de crear, mover o reorganizar un doc.** Resumen:

| Dónde | Qué va |
|-------|--------|
| **Este `CLAUDE.md` (raíz)** | **Reglas de negocio y decisiones de producto**, más lo que aplica a todo el repo: stack, arquitectura, comandos, commits, PRs, conflictos y tooling |
| **`apps/api/CLAUDE.md`** | Todo lo técnico de la API: modelo de datos, procedures tRPC, Prisma, migraciones, Supabase |
| **`apps/web/CLAUDE.md`** | Todo lo técnico del front web (el principal): React + Vite, cliente tRPC, login, UI/UX, testing |
| **`V1.md` / `V2.md`** | Alcance de cada versión: qué entra, pantallas y roadmap |
| **`INFRA.md` / `DEPLOY.md`** | Qué servicios y variables existen / cómo se deploya |
| **GitHub Issues** (no un archivo) | **Todo lo pendiente**: tareas, bugs, propuestas y decisiones a tomar, agrupados por milestone. Ver "Issues" (abajo) |
| **`docs/claude/`** | **Cómo está hecha cada cosa por dentro** (explicaciones, ejemplos, el porqué). Se lee **antes de tocar** ese tema, según el índice "Antes de tocar…" de cada `CLAUDE.md`. Ver `docs/claude/README.md` |
| **`docs/decisiones/`** | Decisiones investigadas: costos y alternativas de front, Mercado Pago, fases de lanzamiento |

- Antes de implementar cualquier feature, leer **"Reglas de negocio"** de este archivo. Si el código contradice una regla de negocio, gana la regla (y se avisa).
- **Un dato vive en un solo lugar.** Si cambia una regla de negocio → acá; un detalle técnico → el `CLAUDE.md` de la app; algo pendiente → un issue de GitHub (ver "Issues"); una decisión investigada → `docs/decisiones/`.
- **Los `CLAUDE.md` tienen las reglas cortas que valen siempre; el detalle técnico vive en `docs/claude/`.** Antes de tocar un tema, leer su doc (índices: "Dónde buscar según la tarea", abajo, y "Antes de tocar…" del `CLAUDE.md` de cada app). **Si cambiás cómo funciona algo que describe un doc, actualizalo en el mismo PR.** `bun run check` falla si un doc menciona un archivo que ya no existe o si un doc de `docs/claude/` no está linkeado.
- Lo personal de cada uno va en `CLAUDE.local.md` / `.claude/settings.local.json` (gitignoreados), nunca acá.

### Dónde buscar según la tarea

| Tarea | Leer primero |
|-------|--------------|
| Cualquier feature | "Reglas de negocio" (abajo) + `V1.md` (si está en alcance) |
| Pantallas / UI de la app | `V1.md` → **"Pantallas"** + `apps/web/CLAUDE.md` (reglas + índice "Antes de tocar…") → `docs/claude/web/ui-ux.md` y `docs/claude/web/usar-la-api.md` |
| Queries, mutations, optimistic updates o precarga en la web | `docs/claude/web/datos-y-cache.md` |
| Colores, tema, componentes de la web | `docs/claude/web/componentes-y-tema.md` (nunca colores fijos: variables del tema) |
| Montos, números o fechas en la web | `docs/claude/web/plata-y-fechas.md` (idioma del navegador, valores normalizados, día del calendario) |
| Probar la web desde el celu | `bun run dev:celu` (ver `docs/claude/web/usar-la-api.md` → "En local: proxy de Vite") |
| Lógica, endpoints o datos de la API | `apps/api/CLAUDE.md` (reglas + índice) → `docs/claude/api/contrato.md` (modelo, procedures, dónde vive cada regla) |
| A la app le falta algo de la API | Se agrega en `apps/api` (mismo repo) siguiendo `apps/api/CLAUDE.md`; nunca workarounds en la app |
| Cambios de base de datos | `apps/api/CLAUDE.md` → "Migraciones — reglas" + `DEPLOY.md` |
| Deploy, builds, variables de entorno | `DEPLOY.md` + `INFRA.md` |
| Qué falta para que todos la usen / publicarla / infra pendiente | Issues del milestone **"Fase 1 — Privada"** (`gh issue list --milestone "Fase 1 — Privada"`) + `docs/decisiones/lanzamiento.md` |
| Proponer una mejora, anotar algo pendiente o dejar una decisión para otro | "Issues" (abajo) + `docs/claude/repo/issues.md` (qué label y milestone lleva cada cosa) |
| Costos, front nativo vs. web, Tricount | `docs/decisiones/costos-y-alternativas.md` |
| Mercado Pago | `docs/decisiones/mercado-pago.md` (no es parte de ninguna versión) |
| Conflictos de git, rebases, PRs | `docs/claude/repo/git-prs-y-conflictos.md` + "Conflictos" del `CLAUDE.md` de cada app |
| Hooks, `package.json`, `bunfig.toml`, Prettier, versiones de TS / React | `docs/claude/repo/tooling.md` |
| Cualquier cosa que toque permisos, login, secretos o datos de otros | "Seguridad" (abajo) + checklist de `apps/api/CLAUDE.md` + `docs/claude/api/seguridad.md` |
| Errores en prod, Sentry, UptimeRobot | `docs/claude/repo/monitoreo.md` + `DEPLOY.md` → "Monitoreo" |
| Saber si una tarea está terminada | "Cuándo una tarea está terminada" (abajo) + plantilla de PR (`.github/pull_request_template.md`) |

> **Alcance:** v1 = todo lo de `V1.md`; v2 = explicación de saldos y agente con IA (`V2.md`). Si una tarea toca la v2, frená y preguntá antes de implementarlo. Mercado Pago **no es parte de ninguna versión** (`docs/decisiones/mercado-pago.md`).

---

## Idioma

- UI y mensajes de error que ve el usuario en **español** (argentino).
- Código (variables, funciones, tipos, comentarios) en **inglés**.
- Documentación del repo y mensajes de commit en español (el `type(scope)` va en inglés).

---

## Reglas de negocio

### Usuarios y login
- Cada persona entra con **email + password** o con **Google** (Supabase Auth). Si ya tenía cuenta con email y entra con Google con el mismo mail, es la misma cuenta. Sin Apple (exige la cuenta de Apple Developer, USD 99/año) ni magic link.
- Un usuario puede estar en muchos grupos.

### Grupos
- Un grupo tiene **nombre** y **moneda base** (ver Multimoneda). Quien lo crea queda como participante con el nombre que elija.
- **Solo ven un grupo los usuarios que son participantes de ese grupo.** Para cualquier otro, el grupo "no existe" (no se revela que existe).
- Todos los miembros tienen los mismos permisos: no hay admin. Cualquiera puede cargar, editar o borrar cualquier gasto del grupo.
- **Dentro del grupo todo es público para sus miembros:** todos ven todos los gastos (los cargue y los pague quien sea), todos los pagos y los saldos de todos. Lo único personal son los **filtros guardados**.
- **Código de invitación:** cada grupo tiene un código (8 caracteres, sin letras/números confusibles como 0/O, 1/I/L). Se puede regenerar; el anterior deja de servir.
- **Archivar:** un grupo archivado se puede ver pero no modificar (ni gastos, ni pagos, ni participantes) hasta desarchivarlo. No aparece en la lista por defecto.

### Participantes
- Un participante es una persona dentro de un grupo. **Puede no tener cuenta** ("Juan", que no usa la app).
- **Unirse con el código:** quien entra elige entre
  - **reclamar** un participante sin cuenta que ya existía (ej. "soy Juan") → hereda sus gastos y saldos, o
  - entrar como **participante nuevo** con su nombre.
- Un usuario es un solo participante por grupo. Un participante ya reclamado no se puede reclamar de nuevo.
- Se puede renombrar a cualquiera.
- **Quitar un participante** solo se puede si no tiene cuenta y nunca aparece en un gasto o pago (para no romper saldos).

### Gastos
- Un gasto tiene: descripción, categoría, fecha, monto, moneda, quién pagó y entre quiénes se divide.
- **Categorías:** comida (`FOOD`), súper (`GROCERIES`), transporte (`TRANSPORT`), alojamiento (`LODGING`), salidas (`ENTERTAINMENT`), compras (`SHOPPING`), servicios (`SERVICES`), otros (`OTHER`, default).
- **Quien paga puede no estar en la división** (ej. pagué yo un regalo que es solo de Román).
- **Cualquier miembro puede cargar un gasto pagado por otro** (ej. "pagó Román, entre Tuke y yo") y editar o borrar cualquier gasto.
- **Formas de dividir:**
  - **Partes iguales** entre los elegidos.
  - **Por monto:** cada uno un monto fijo; tienen que sumar exactamente el total.
  - **Por porcentaje:** tienen que sumar 100%.
- **Redondeo:** se trabaja en centavos. Si no divide exacto, los centavos que sobran se reparten de a uno (a los que más "fracción" tenían; en partes iguales, a los primeros). **La suma de las partes siempre es exactamente el total.**
- Editar un gasto lo reemplaza entero (incluida la división).
- **Borrar** un gasto no lo elimina: queda oculto y deja de contar en saldos.

### Multimoneda
- **Monedas:** ARS, USD, EUR, BRL, UYU, CLP.
- Cada grupo tiene una **moneda base** (normalmente ARS). Los saldos "principales" se muestran en esa moneda.
- Un gasto en la moneda base cuenta tal cual.
- Un gasto en **otra moneda** tiene dos opciones:
  1. **Convertir a la base** (por defecto). Se guarda el tipo de cambio en el gasto, así el saldo no cambia aunque después cambie el dólar.
     - **Por defecto, dólar blue promedio:** `(compra + venta) / 2`. Ej.: compra 1545, venta 1565 → **1555**. Es la cotización que usamos en Argentina (la de dolarhoy.com).
     - **Se puede elegir el oficial** (también promedio entre compra y venta) en vez del blue, ej. si se pagó con tarjeta.
     - **Las demás monedas (EUR, BRL, UYU, CLP) se sugieren con su cotización oficial** (promedio entre compra y venta; no tienen blue).
     - La sugerencia automática es solo **entre ARS y otra moneda**. Entre dos monedas extranjeras (ej. un gasto en EUR en un grupo en USD), el tipo de cambio se carga a mano (obligatorio).
     - **Siempre se puede poner uno a mano** (ej. el que se usó de verdad en ese momento).
  2. **Mantener la moneda** ("este gasto es en USD, pagame en USD"): no se convierte. Genera un **saldo aparte en esa moneda**.
- Los **pagos manuales** (ver abajo) siguen exactamente las mismas reglas.
- **Saldos por moneda:** el grupo muestra primero el saldo en la moneda base y después uno por cada moneda "mantenida" que tenga movimientos. Cada saldo se salda por separado y en su moneda.
- Ejemplo (grupo en ARS): nafta USD 20 convertida a 1555 → suma ARS 31.100 al saldo en pesos. Una cena de USD 60 "mantenida en USD" → aparece un saldo en dólares aparte.

### Saldos y cómo quedar a mano
- **Saldo de una persona** = lo que pagó − lo que le correspondía (+ pagos que hizo − pagos que recibió). Positivo = le deben; negativo = debe.
- En cada moneda, **la suma de todos los saldos es siempre cero** (al convertir, se convierte cada parte y al que pagó se le acredita la suma, para que no queden centavos sueltos).
- **Transferencias sugeridas:** la app propone cómo quedar a mano con **la menor cantidad de transferencias razonable** (el que más debe le paga al que más le deben, y así; como mucho una menos que la cantidad de personas).

### Pagos manuales (saldar deudas)
- "Ya te pagué": se registra quién le pagó a quién, cuánto, en qué moneda y cuándo (con nota opcional). El pago en sí se hizo **fuera de la app** (efectivo, transferencia…).
- Tiene que ser entre dos personas distintas del grupo.
- Se puede borrar (queda oculto y deja de contar).
- **Se le puede pagar a cualquiera del grupo, no solo a quien le debés.** Ej.: le debo $100.000 a Tuke y le transfiero $50.000 a Manu → yo paso a deber $50.000, Manu pasa a deber $50.000 (tiene plata mía) y las transferencias sugeridas se recalculan (Yo → Tuke $50.000, Manu → Tuke $50.000).
- Un pago **no es un gasto**: no aparece en la lista de gastos ni suma en los totales de gasto; solo mueve saldos.
- Cualquier miembro puede registrar un pago entre otros dos (ej. "Román ya le pagó a Tuke").
- "Marcar como pagado" una transferencia sugerida = registrar ese pago tal cual.

### Alias para cobrar
- Cada persona puede cargar su **alias o CVU/CBU** para que le paguen por transferencia. Formato: alias de 6 a 20 letras, números, puntos o guiones, o CVU/CBU de 22 dígitos.
- **Alias de la cuenta:** se carga una vez y se usa **en todos los grupos** de esa persona.
- **Alias por grupo (opcional):** pisa al de la cuenta **solo en ese grupo** (ej. una cuenta distinta para un viaje). Si se borra, vuelve a usarse el de la cuenta.
- El alias de alguien **con cuenta** solo lo cambia esa persona. A alguien **sin cuenta** cualquier miembro del grupo le puede cargar el alias.
- Al saldar, la app muestra a quién pagarle, cuánto y su alias, con botones para **copiar el alias** y **copiar el monto**. La transferencia se hace afuera (Mercado Pago, banco) y después se marca "ya pagué" (pago manual). Sin comisiones.
- Si la persona no tiene alias cargado, se muestra igual la transferencia sugerida, sin alias.

### Filtros
- Los gastos se pueden filtrar, combinando todo:
  - **quién pagó** ("gastos que pagó Román"),
  - **a quién le corresponde** (participa de la división),
  - **en qué gastos está involucrado alguien** (lo pagó **o** participa: "mis gastos"),
  - categorías, rango de fechas (por mes = del 1 al último día), rango de montos (en la moneda de cada gasto) y texto en la descripción (sin distinguir mayúsculas).
- **Totales para cualquier filtro** ("¿cuánto gasté en noviembre?"): cantidad de gastos, total gastado, **mi parte** (lo que me correspondió), **lo que pagué yo** y el total por categoría. Por moneda, con las mismas reglas que los saldos (lo convertido suma en la base; lo mantenido, en su moneda). Los pagos manuales no cuentan como gasto.
- **Filtros guardados:** cada usuario puede guardar combinaciones con nombre, por grupo. Son personales (los demás no los ven).


### Exportar gastos
- Desde la lista de gastos, con **los filtros aplicados**, se puede exportar **todo** lo que coincide (no solo lo que se ve en pantalla) para analizarlo afuera (planilla, IA, gastos personales).
- Formatos: **CSV** (se abre en Excel o Google Sheets; UTF-8, separado por comas, decimales con punto) y **JSON** (incluye el grupo, la moneda base, la fecha y los filtros usados).
- Cada fila es un gasto, del más viejo al más nuevo: fecha, descripción, categoría, moneda y monto, tipo de cambio (si se convirtió), en qué saldo cuenta y su monto ahí, quién pagó, cómo se dividió, la parte de cada uno y **mi parte** (en la moneda del gasto y en la del saldo).
- Exporta solo gastos: los pagos manuales no son gastos y no se incluyen.
- Cualquier miembro puede exportar los gastos de su grupo.
### Decisiones de producto tomadas
- Grupo de amigos, uso propio → sin roles ni permisos finos dentro de un grupo. *(A revisar antes de publicarla: `docs/decisiones/lanzamiento.md` → "Fase 2".)*
- **Front: web app mobile-first** (web y API en Railway, con dominio propio `kachingga.com`), instalable en el celu desde el navegador ("Agregar a inicio"). Sin cuenta de Apple ni stores. **Solo web:** la app nativa (Expo) se sacó del repo el 8/11/2026; si algún día se quiere en las stores, se arranca de cero (`docs/decisiones/costos-y-alternativas.md`).
- Saldar deudas es siempre manual (el pago se hace fuera de la app). **No hay integración con Mercado Pago**: pagar de una persona a otra desde la app sin comisiones no es posible (ver `docs/decisiones/mercado-pago.md`). El agente con IA es v2.
- Dólar de referencia: **blue promedio** por defecto; se puede elegir el oficial o cargar uno a mano en cada gasto o pago. Las demás monedas, con su oficial sugerido.
- Los tipos de cambio quedan "congelados" en cada gasto/pago al cargarlo.
- Borrados lógicos (gastos y pagos) para no perder historial.
- **Login directo con Supabase Auth desde la app** (no vía nuestra API): la librería de Supabase ya maneja sesión, renovación del token, registro y recuperación de contraseña. Los datos igual pasan siempre por la API. Se evaluó la alternativa "login vía API" y se descartó por el código y el riesgo extra (renovación de tokens a mano).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime / package manager | Bun (monorepo con workspaces) |
| **Web (front principal)** | React 19 + Vite + Tailwind + React Router, hosteada en Railway (server estático de Bun) |
| Backend | Hono + TypeScript sobre Bun, hosteado en Railway |
| API (contrato app ↔ backend) | tRPC + Zod, con TanStack Query en la app |
| Base de datos | PostgreSQL en Supabase, con Prisma |
| Auth | Supabase Auth — email + password y Google (OAuth) |
| Cotizaciones | DolarApi (dólar blue y oficial; oficial de EUR, BRL, UYU y CLP) |
| Agente (v2) | API de LLM con tool calling sobre los datos del grupo |

---

## Arquitectura general

```
Web (Railway) ──tRPC + token de Supabase──▶ API (Hono, Railway) ──Prisma──▶ PostgreSQL (Supabase)
     │                                        │
     └── Supabase Auth (solo login/sesión)    └── valida el token con Supabase
```

- **La app nunca lee ni escribe la base directo**: todo pasa por la API, que es la que aplica las reglas de negocio y decide qué ve cada usuario. La app usa Supabase solo para el login.
- **App ↔ API solo por tRPC**, con tipos de punta a punta: la app importa el *tipo* del router de la API, nunca código del server. No hay endpoints REST a mano para la app (la única ruta fuera de tRPC es `/health`).
- Las validaciones de inputs (Zod) viven en la API y la app las reusa para sus formularios.
- La web corre en el navegador en otro dominio: la API permite su origen por **CORS** (`CORS_ORIGINS`).
- Detalles: `apps/api/CLAUDE.md` y `apps/web/CLAUDE.md`.

---

## Seguridad — reglas para todos

**Nadie (persona o Claude) mergea algo que rompa esto.** Checklist por procedure: `apps/api/CLAUDE.md`; cómo está implementado: `docs/claude/api/seguridad.md`.

- **Un usuario solo ve y toca los grupos de los que es miembro.** Todo procedure que toca un grupo chequea pertenencia en la API; el front nunca es la barrera. A quien no es miembro se le responde "no encontrado" (no se revela que el grupo existe).
- **Lo personal es personal:** el alias de una persona con cuenta solo lo cambia ella; perfil y filtros guardados, solo el dueño.
- **El test `authorization.test.ts` cubre todos los procedures**: un procedure nuevo no pasa el CI hasta que se agrega ahí (como atacable o con el motivo por el que no toca un grupo).
- **Los datos solo por la API.** El front usa Supabase únicamente para el login; RLS bloquea cualquier otro acceso a la base.
- **Secretos:** nunca en el código, en los `.env.sample`, en issues, PRs ni en el chat. Solo en `.env` / `.env.prod` locales (gitignoreados) y en Railway. Lo que empieza con `VITE_` es **público** (va dentro de la app): nunca un secreto ahí. GitHub escanea los pushes y bloquea si detecta una clave.
- **Si se filtra un secreto:** avisar al grupo, **rotarlo** (generar uno nuevo en Supabase / Railway) y actualizarlo en todos lados. Borrarlo del historial no alcanza: el repo es público.
- **Límite de pedidos por IP** en la API (más estricto en códigos de invitación y export). Un procedure caro o adivinable lleva su límite.
- **Validar todo lo que entra** (Zod en la API) y no mostrar errores internos al usuario.
- **Nunca resetear contraseñas de las bases, desactivar RLS, abrir CORS a cualquier origen, ni saltear hooks o checks** (`--no-verify`, `eslint-disable` de las reglas del proyecto) para "destrabar" algo.
- **Ante la duda sobre algo de seguridad, frenar y preguntar** (ver `.claude/CLAUDE.md` → cuestionar al humano).

---

## Estructura del monorepo

```
kachingga/
├── .claude/                 # CLAUDE.md (comportamiento) + settings.json compartido
├── .husky/                  # commit-msg (formato) + pre-commit (bun run check)
├── apps/
│   ├── api/                 # @kachingga/api — Hono + tRPC + Prisma (ver apps/api/CLAUDE.md)
│   └── web/                 # @kachingga/web — React + Vite, el front (ver apps/web/CLAUDE.md)
├── docs/
│   ├── claude/              # cómo está hecha cada cosa por dentro (repo/, web/, api/); ver su README
│   └── decisiones/          # decisiones investigadas: costos, Mercado Pago, lanzamiento
├── scripts/check-docs.ts    # chequeo de docs (parte de bun run check)
├── CLAUDE.md
├── V1.md / V2.md
├── INFRA.md / DEPLOY.md
└── package.json             # workspaces + scripts globales
```

> **Dependencias:** nunca agregar paquetes al `package.json` raíz (única excepción: tooling del repo, hoy `husky` y `prettier`). Siempre `cd` al workspace y desde ahí `bun add`.

---

## Comandos

Desde la raíz (corren en `api` y `web` con `bun --filter`):

```bash
bun install          # instala todo, activa husky y genera el cliente de Prisma
bun run dev          # levanta API (:3000) y web (:5173)
bun run dev:celu     # lo mismo, con la web visible desde el celu en la misma Wi-Fi
bun run api          # solo la API
bun run web          # solo la web (necesita la API)
bun run typecheck    # tsc en api y web
bun run test         # tests: api (unit + integración con PGlite), y web (Vitest)
bun run lint         # ESLint en web
bun run format       # formatea todo con Prettier (correrlo antes de commitear)
bun run docs:check   # que los docs no mencionen archivos que ya no existen (ver docs/claude/README.md)
bun run check        # docs + formato + typecheck + test + lint — lo mismo que corre el pre-commit y el CI
bun run promote      # pasa main a prod (solo con el ok del usuario; ver DEPLOY.md)
```

**Antes de dar una tarea por terminada, correr `bun run check`.** El pre-commit lo corre en cada commit y lo rechaza si algo falla.

### Variables de entorno

Cada app tiene un `.env.sample` commiteado que dice qué variables hacen falta y de dónde sale cada valor. **Hay dos bases:** `.env` → **DEV** (Supabase `staging-kachingga`), que es lo que usa todo lo local y también **staging**; `.env.prod` → **PROD** (Supabase `kachingga`), solo para migrar producción y como referencia de Railway. Ambos gitignoreados. Detalle en `INFRA.md` → "Entornos". Si agregás una variable, sumala al `.env.sample` y a `INFRA.md`.

> Claude: nunca correr nada contra **prod** (`db:migrate:prod`, scripts con `.env.prod`) salvo que el usuario lo pida explícitamente. **Nunca resetear la contraseña de una base de Supabase** ni sugerirlo como solución: rompe el `.env` de todos. Para armar un `.env`, guiar con la tabla de `README.md` → "Armar los `.env`"; la contraseña de la base se le pide a Galo.

### Tooling del monorepo — no romper
- Husky (`pre-commit` = `bun run check`, `commit-msg` = Conventional Commits, hooks que regeneran Prisma), `bunfig.toml` con `linker = "hoisted"`, Prettier con config por app (si falla el formato: `bun run format`; no discutir estilo), **TypeScript `~6.0.3` y React `19.3.0` en todos los workspaces**. Detalle y por qué: **`docs/claude/repo/tooling.md`** (leerlo antes de tocar hooks, `package.json`, `bunfig.toml`, Prettier o versiones).

---

## Cuándo una tarea está terminada (Definition of Done)

Para cualquier tarea, en cualquier parte del repo. Claude no dice "listo" hasta cumplir todo esto (y si algo no se pudo, lo dice explícitamente):

1. **Cumple las reglas de negocio** de este archivo y el alcance de `V1.md`. Si la tarea pedía algo que las contradice, se avisó antes (ver `.claude/CLAUDE.md` → "Cuestionar al humano").
2. **Tiene tests** según el `CLAUDE.md` de la app tocada (API: integración por procedure; web: contenido por estado de cada pantalla).
3. **No rompe ninguna regla de "Seguridad"**; si agrega o cambia un procedure, está cubierto en `authorization.test.ts`.
4. **`bun run check` pasa** (typecheck + tests + lint). Nunca `--no-verify` ni desactivar reglas para que pase.
5. **Docs actualizados en el lugar correcto:** regla de negocio nueva → acá; procedure o modelo → `docs/claude/api/contrato.md`; pantalla o roadmap → `V1.md`; cómo funciona algo técnico → su doc en `docs/claude/` (y, si es una regla que no se puede romper, una línea en el `CLAUDE.md` de la app); **si tocaste algo que aparece en un índice "Antes de tocar…", revisá que su doc siga diciendo la verdad**; servicios, variables o secretos → `INFRA.md`; cómo deployar → `DEPLOY.md`; decisión investigada (costos, alternativas) → `docs/decisiones/`. **Si la tarea resuelve un issue**, el PR dice `Closes #N` y lo que haya que saber queda documentado donde corresponde; **si deja algo pendiente**, se avisa y se propone su issue (ver "Issues"). Si toca un ítem de la checklist de UI de `V1.md`, se tilda ahí. Un dato vive en un solo lugar (guía completa: `README.md` → "Documentación").
6. **En una branch con su PR** (título en formato Conventional Commits), con el checklist de la plantilla completo. Mergear solo si el usuario lo pide.
7. **Se dijo qué quedó sin hacer o sin verificar** (ej. "no lo probé en un teléfono real").

---

## Trabajo en paralelo y conflictos

Somos varios trabajando a la vez. **Antes de empezar y antes de pushear:** `git pull --rebase origin main && bun install && bun run check`.
- **`bun.lock` nunca a mano** (quedarse con el de `main` y `bun install`). Después de cualquier conflicto: `bun install && bun run check`; si falla, se arregla antes de commitear.
- Cómo resolver cada tipo de conflicto, trabajo local viejo, el cliente de Prisma al cambiar de branch: **`docs/claude/repo/git-prs-y-conflictos.md`** (leerlo ante cualquier conflicto o rebase) + "Conflictos" del `CLAUDE.md` de cada app.

---

## Commits — formato obligatorio

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope opcional>): <descripción en minúscula, sin punto final>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `build`, `ci`, `revert`
**Scopes sugeridos:** `web`, `api`, `db`, `infra`, `deps`, `agent` (v2)

```
feat(api): agregar endpoint para crear grupos
fix(web): corregir cálculo de saldos con decimales
chore: actualizar bun.lock
refactor(api)!: cambiar formato de respuesta de gastos   # ! = breaking change
```

Reglas para Claude:
- **Nunca** crear un commit que no respete este formato. Si el usuario pide un mensaje que no lo cumple, adaptarlo y avisar.
- Un commit = un cambio lógico.
- Los hooks de husky rechazan mensajes inválidos y código que no pasa `bun run check` — **nunca** `--no-verify`. Si un hook falla, arreglar la causa.

---

## Branches y Pull Requests

- **`main` está protegido: todo entra por PR**, con el CI en verde ("Typecheck, tests y lint" = `bun run check`, "Migraciones al día con el schema", "Formato de commits y título del PR").
- Branch `feat/…`, `fix/…`, `chore/…` o `docs/…`; título del PR en Conventional Commits (queda como el commit en `main`: se mergea con **squash**).
- PRs chicos y de un tema. Label `e2e` en los que cambian un recorrido crítico.
- Si el PR queda atrás de `main`: **rebase, nunca merge** (`gh pr update-branch <n> --rebase`).
- **Claude: crear la branch y el PR; mergear solo si el usuario lo pide** (`gh pr merge --squash` con el CI en verde).
- **`main` → staging, `production` → prod:** cada merge a `main` se deploya solo en **staging** (`staging.kachingga.com`). Prod (`kachingga.com`) se deploya desde la branch `production`, que solo avanza con **`bun run promote`** (fast-forward hasta `main`, desde la máquina de un miembro; sin force-push). Antes: probar en staging y, si hay migraciones, `db:migrate:prod`. Claude no promueve a prod sin que el usuario lo pida. Detalle: `DEPLOY.md`.
- Comandos, CI colgado, PRs apilados y demás detalle: **`docs/claude/repo/git-prs-y-conflictos.md`**.

## Issues

**Todo lo pendiente vive en GitHub Issues** (no hay archivo de pendientes): tareas, bugs, propuestas y decisiones a tomar, con milestones "Fase 1 — Privada" y "Fase 2 — Pública (futuro)". Para ver qué falta: `gh issue list`.
- **Claude no crea, edita ni cierra issues, labels o milestones por su cuenta** (el repo es público y lo ve todo el grupo): propone en el chat qué crearía y dónde, y lo crea cuando el humano dice que sí.
- **Proponerle una mejora a otro del grupo** = issue con label `question` (problema, opciones, recomendación); nunca cambiar lo suyo sin hablarlo.
- Un PR que resuelve un issue lo dice en la descripción (`Closes #N`).
- **Qué label o milestone lleva cada cosa** (tarea, propuesta, decisión, bloqueo, lanzamiento, ítem de UI): **`docs/claude/repo/issues.md`** — leerlo antes de proponer o crear un issue.
