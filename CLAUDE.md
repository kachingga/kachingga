# Kachingga — App para dividir gastos en grupo

Proyecto de **Kachingga**, una organización de amigos (repo: `github.com/kachingga/kachingga`). **Hoy es para uso propio del grupo**: cada uno la usa en su celu y siempre en la última versión. El front todavía no está decidido (lo más probable: **web app mobile-first**; ver `docs/decisiones/costos-y-alternativas.md`). **A futuro se podría publicar** (ver `PENDIENTES.md` → Lanzamiento → Fase 2): no tomar decisiones que lo hagan imposible, pero tampoco construir cosas para usuarios públicos antes de tiempo.

---

## Cómo está organizada la documentación

**La guía completa —qué hay en cada archivo, qué tiene que haber y cómo se lee y se actualiza— está en `README.md` → "Documentación". Leerla antes de crear, mover o reorganizar un doc.** Resumen:

| Dónde | Qué va |
|-------|--------|
| **Este `CLAUDE.md` (raíz)** | **Reglas de negocio y decisiones de producto**, más lo que aplica a todo el repo: stack, arquitectura, comandos, commits, PRs, conflictos y tooling |
| **`apps/api/CLAUDE.md`** | Todo lo técnico de la API: modelo de datos, procedures tRPC, Prisma, migraciones, Supabase |
| **`apps/mobile/CLAUDE.md`** | Todo lo técnico de la app: Expo, EAS, navegación, cliente tRPC, UI/UX, testing |
| **`V1.md` / `V2.md`** | Alcance de cada versión: qué entra, pantallas y roadmap |
| **`INFRA.md` / `DEPLOY.md`** | Qué servicios y variables existen / cómo se deploya |
| **`PENDIENTES.md`** | Lanzamiento e infraestructura pendientes (cada ítem con su issue) |
| **`docs/decisiones/`** | Decisiones investigadas: costos y alternativas de front, Mercado Pago |

- Antes de implementar cualquier feature, leer **"Reglas de negocio"** de este archivo. Si el código contradice una regla de negocio, gana la regla (y se avisa).
- **Un dato vive en un solo lugar.** Si cambia una regla de negocio → acá; un detalle técnico → el `CLAUDE.md` de la app; algo pendiente → `PENDIENTES.md` + issue; una decisión investigada → `docs/decisiones/`.
- Lo personal de cada uno va en `CLAUDE.local.md` / `.claude/settings.local.json` (gitignoreados), nunca acá.

### Dónde buscar según la tarea

| Tarea | Leer primero |
|-------|--------------|
| Cualquier feature | "Reglas de negocio" (abajo) + `V1.md` (si está en alcance) |
| Pantallas / UI de la app | `V1.md` → **"Pantallas"** + `apps/mobile/CLAUDE.md` → **"UI / UX — estándar de calidad"** y **"Cómo usar la API desde la app"** |
| Lógica, endpoints o datos de la API | `apps/api/CLAUDE.md` → "Procedures tRPC", "Modelo de datos", "Dónde vive cada regla de negocio" |
| A la app le falta algo de la API | Se agrega en `apps/api` (mismo repo) siguiendo `apps/api/CLAUDE.md`; nunca workarounds en la app |
| Cambios de base de datos | `apps/api/CLAUDE.md` → "Migraciones — reglas" + `DEPLOY.md` |
| Deploy, builds, variables de entorno | `DEPLOY.md` + `INFRA.md` |
| Qué falta para que todos la usen / publicarla / infra pendiente | `PENDIENTES.md` (y los issues `infra`) |
| Costos, front nativo vs. web, Tricount | `docs/decisiones/costos-y-alternativas.md` |
| Mercado Pago | `docs/decisiones/mercado-pago.md` (no es parte de ninguna versión) |
| Conflictos de git | "Trabajo en paralelo y conflictos" (abajo) + "Conflictos" del `CLAUDE.md` de cada app |
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
- Cada persona se registra con **email + password** (Supabase Auth). Sin login social ni magic link en v1.
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
     - **Tipo de cambio automático = dólar blue promedio:** `(compra + venta) / 2`. Ej.: compra 1545, venta 1565 → **1555**. Es la cotización que usamos en Argentina (la de dolarhoy.com); **nunca el oficial**.
     - El automático solo existe entre **ARS y USD**. Para otras monedas el tipo de cambio se carga a mano (obligatorio).
     - **Siempre se puede pisar con uno manual** (ej. el que se usó de verdad en ese momento).
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
- Grupo de amigos, uso propio → sin roles ni permisos finos dentro de un grupo. *(A revisar antes de publicarla: `PENDIENTES.md` → Lanzamiento → Fase 2.)*
- **Distribución V1:** iPhone por **TestFlight** (cuenta de Apple Developer, la paga Galo) y Android por **APK**. Expo Go solo para desarrollar, no para usar la app.
- Saldar deudas es siempre manual (el pago se hace fuera de la app). **No hay integración con Mercado Pago**: pagar de una persona a otra desde la app sin comisiones no es posible (ver `docs/decisiones/mercado-pago.md`). El agente con IA es v2.
- Dólar de referencia: **blue promedio**, nunca oficial.
- Los tipos de cambio quedan "congelados" en cada gasto/pago al cargarlo.
- Borrados lógicos (gastos y pagos) para no perder historial.
- **Login directo con Supabase Auth desde la app** (no vía nuestra API): la librería de Supabase ya maneja sesión, renovación del token, registro y recuperación de contraseña. Los datos igual pasan siempre por la API. Se evaluó la alternativa "login vía API" y se descartó por el código y el riesgo extra (renovación de tokens a mano).

---

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime / package manager | Bun (monorepo con workspaces) |
| Mobile | React Native con Expo (SDK 58) + Expo Router |
| Distribución mobile | EAS Build (instalación interna) + EAS Update (OTA) |
| Backend | Hono + TypeScript sobre Bun, hosteado en Railway |
| API (contrato app ↔ backend) | tRPC + Zod, con TanStack Query en la app |
| Base de datos | PostgreSQL en Supabase, con Prisma |
| Auth | Supabase Auth — email + password |
| Cotización del dólar | DolarApi (blue) |
| Agente (v2) | API de LLM con tool calling sobre los datos del grupo |

---

## Arquitectura general

```
App (Expo) ──tRPC + token de Supabase──▶ API (Hono, Railway) ──Prisma──▶ PostgreSQL (Supabase)
     │                                        │
     └── Supabase Auth (solo login/sesión)    └── valida el token con Supabase
```

- **La app nunca lee ni escribe la base directo**: todo pasa por la API, que es la que aplica las reglas de negocio y decide qué ve cada usuario. La app usa Supabase solo para el login.
- **App ↔ API solo por tRPC**, con tipos de punta a punta: la app importa el *tipo* del router de la API, nunca código del server. No hay endpoints REST a mano para la app (la única ruta fuera de tRPC es `/health`).
- Las validaciones de inputs (Zod) viven en la API y la app las reusa para sus formularios.
- Detalles: `apps/api/CLAUDE.md` y `apps/mobile/CLAUDE.md`.

---

## Estructura del monorepo

```
kachingga/
├── .claude/                 # CLAUDE.md (comportamiento) + settings.json compartido
├── .husky/                  # commit-msg (formato) + pre-commit (bun run check)
├── apps/
│   ├── api/                 # @kachingga/api — Hono + tRPC + Prisma (ver apps/api/CLAUDE.md)
│   └── mobile/              # @kachingga/mobile — Expo (ver apps/mobile/CLAUDE.md)
├── CLAUDE.md
├── V1.md / V2.md
├── INFRA.md / DEPLOY.md
├── PENDIENTES.md
├── docs/decisiones/     # costos-y-alternativas.md, mercado-pago.md
└── package.json             # workspaces + scripts globales
```

> **Dependencias:** nunca agregar paquetes al `package.json` raíz (única excepción: tooling del repo, hoy `husky` y `prettier`). Siempre `cd` al workspace y desde ahí `bun add` (en mobile: `bunx expo install <paquete>`).

---

## Comandos

Desde la raíz (corren en todos los workspaces con `bun --filter`):

```bash
bun install          # instala todo, activa husky y genera el cliente de Prisma
bun run dev          # levanta la API (:3000) y Expo a la vez
bun run api          # solo la API
bun run mobile       # solo Expo
bun run typecheck    # tsc en api y mobile
bun run test         # tests: api (unit + integración con PGlite) y mobile (Jest + RNTL)
bun run lint         # expo lint en mobile
bun run format       # formatea todo con Prettier (correrlo antes de commitear)
bun run check        # formato + typecheck + test + lint — lo mismo que corre el pre-commit y el CI
```

**Antes de dar una tarea por terminada, correr `bun run check`.** El pre-commit lo corre en cada commit y lo rechaza si algo falla.

> Los builds de EAS (`eas build`) solo se lanzan cuando alguien lo pide explícitamente. Ver `DEPLOY.md`.

### Variables de entorno

Cada app tiene un `.env.sample` commiteado que dice qué variables hacen falta y de dónde sale cada valor. **Hay dos entornos:** `.env` → **DEV** (Supabase `kachingga-dev`), que es lo que usa todo lo local; `.env.prod` → **PROD** (Supabase `kachingga`), solo para migrar producción y como referencia de Railway/EAS. Ambos gitignoreados. Detalle en `INFRA.md` → "Entornos". Si agregás una variable, sumala al `.env.sample` y a `INFRA.md`.

> Claude: nunca correr nada contra **prod** (`db:migrate:prod`, scripts con `.env.prod`) salvo que el usuario lo pida explícitamente. **Nunca resetear la contraseña de una base de Supabase** ni sugerirlo como solución: rompe el `.env` de todos. Para armar un `.env`, guiar con la tabla de `README.md` → "Armar los `.env`"; la contraseña de la base se le pide a Galo.

### Tooling del monorepo — no romper
- **Husky** se activa con `prepare` en `bun install`. `pre-commit` corre `bun run check`; `commit-msg` valida Conventional Commits y deja pasar `Merge`, `Revert`, `fixup!`, `squash!` y `amend!`; `post-checkout`, `post-merge` y `post-rewrite` regeneran el cliente de Prisma (sin frenar nunca a git).
- `bunfig.toml` usa `linker = "hoisted"` (todo en el `node_modules` raíz). Viene así desde el setup de Expo; no cambiarlo sin probar que Metro siga resolviendo.
- `bun --filter '*' <script>` corre solo en los workspaces que tienen ese script.
- **Prettier** (versión fija en la raíz) con config por app que respeta su estilo: API sin `;` y líneas de hasta 140 (`apps/api/.prettierrc`), app con `;` y 100 (`apps/mobile/.prettierrc`). `.prettierignore` excluye generados, migraciones y markdown. Si `check` falla por formato: `bun run format`. No discutir estilo: lo decide Prettier.
- **TypeScript `~6.0.3` en los dos workspaces** (el del SDK 58 de Expo): la app typechequea archivos de la API, así que tienen que ir juntos.

---

## Cuándo una tarea está terminada (Definition of Done)

Para cualquier tarea, en cualquier parte del repo. Claude no dice "listo" hasta cumplir todo esto (y si algo no se pudo, lo dice explícitamente):

1. **Cumple las reglas de negocio** de este archivo y el alcance de `V1.md`. Si la tarea pedía algo que las contradice, se avisó antes (ver `.claude/CLAUDE.md` → "Cuestionar al humano").
2. **Tiene tests** según el `CLAUDE.md` de la app tocada (API: integración por procedure; mobile: contenido por estado de cada pantalla).
3. **`bun run check` pasa** (typecheck + tests + lint). Nunca `--no-verify` ni desactivar reglas para que pase.
4. **Docs actualizados en el lugar correcto:** regla de negocio nueva → acá; procedure o modelo → `apps/api/CLAUDE.md`; pantalla o roadmap → `V1.md`; decisión técnica → el `CLAUDE.md` de la app; servicios, variables o secretos → `INFRA.md`; cómo deployar → `DEPLOY.md`; decisión investigada (costos, alternativas) → `docs/decisiones/`. **Si la tarea completa (o deja a medias) algo de `PENDIENTES.md`, actualizarlo** junto con su issue: lo terminado se borra (o se tilda) y queda documentado donde corresponde; lo nuevo pendiente se agrega con su issue. Un dato vive en un solo lugar (guía completa: `README.md` → "Documentación").
5. **En una branch con su PR** (título en formato Conventional Commits), con el checklist de la plantilla completo. Mergear solo si el usuario lo pide.
6. **Se dijo qué quedó sin hacer o sin verificar** (ej. "no lo probé en un teléfono real").

---

## Trabajo en paralelo y conflictos

Somos varios trabajando a la vez.

### Antes de empezar y antes de pushear
```bash
git pull --rebase origin main
bun install          # por si cambiaron dependencias o hooks (el cliente de Prisma lo regeneran los hooks de git)
bun run check
```

> **Cliente de Prisma al cambiar de branch:** el cliente generado no está en git, así que al cambiar de branch puede quedar con el schema de la otra (síntoma: fallan todos los tests de integración juntos, o el typecheck dice que no existe un modelo/campo). Los hooks de husky `post-checkout`, `post-merge` y `post-rewrite` lo regeneran solos. Si igual pasa: `bun run --cwd apps/api db:generate`. **`bun install` no alcanza**: si no hay dependencias nuevas, no vuelve a correr el `postinstall`.

### Si tenés trabajo local viejo
1. Commitealo en una branch (`git switch -c feat/<lo-que-sea>`). Si el hook rechaza el mensaje, usá `type(scope): ...`.
2. `git rebase origin/main` (o `merge`) y resolvé los conflictos como abajo.
3. `bun install && bun run check` antes de pushear.

### Cómo resolver conflictos por archivo
- **`bun.lock`:** nunca a mano. Quedarse con la de `main` (`git checkout --theirs bun.lock` en un merge, `--ours` en un rebase), `bun install` para regenerarlo y `git add bun.lock`.
- **`package.json` (cualquiera):** combinar las dos listas de dependencias y scripts. En mobile, si quedan versiones raras, `bunx expo install --fix`. Después `bun install`.
- **`CLAUDE.md`, `V1.md` y docs:** combinar ambos textos respetando la regla de "dónde va cada cosa".
- **Archivos de cada app:** ver "Conflictos" en `apps/api/CLAUDE.md` y `apps/mobile/CLAUDE.md` (migraciones, `app.json`, `_layout.tsx`, `router.ts`…).

Después de cualquier conflicto: `bun install && bun run check`. Si falla, se arregla antes de commitear — **nunca** `--no-verify`.

---

## Commits — formato obligatorio

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope opcional>): <descripción en minúscula, sin punto final>
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `build`, `ci`, `revert`
**Scopes sugeridos:** `mobile`, `api`, `db`, `infra`, `deps`, `agent` (v2)

```
feat(api): agregar endpoint para crear grupos
fix(mobile): corregir cálculo de saldos con decimales
chore: actualizar bun.lock
refactor(api)!: cambiar formato de respuesta de gastos   # ! = breaking change
```

Reglas para Claude:
- **Nunca** crear un commit que no respete este formato. Si el usuario pide un mensaje que no lo cumple, adaptarlo y avisar.
- Un commit = un cambio lógico.
- Los hooks de husky rechazan mensajes inválidos y código que no pasa `bun run check` — **nunca** `--no-verify`. Si un hook falla, arreglar la causa.

---

## Flujo de trabajo: branches y Pull Requests

**`main` está protegido en GitHub: no se puede pushear directo (ni los admins).** Todo cambio entra por PR.

```bash
git switch main && git pull --rebase origin main
git switch -c feat/<descripcion-corta>        # o fix/…, chore/…, docs/…
# … commits con formato Conventional Commits …
git push -u origin HEAD
gh pr create --fill                            # título = Conventional Commit (ej. "feat(mobile): pantalla de grupos")
```

- Para mergear, el CI (`.github/workflows/ci.yml`) tiene que pasar entero:
  - **"Typecheck, tests y lint"** — `bun run check` (formato + typecheck + tests + lint).
  - **"Migraciones al día con el schema"** — aplica todas las migraciones en un Postgres vacío y falla si el schema de Prisma tiene cambios sin migración.
  - **"Expo doctor"** — versiones de paquetes compatibles con el SDK de Expo.
  - **"Formato de commits y título del PR"** — Conventional Commits.
- **E2E** (`.github/workflows/e2e.yml`, no obligatorio): flujos de Maestro en un emulador Android. Corre a mano o en PRs con la label `e2e` — ponérsela a los PRs que cambian recorridos principales de la app (ver `apps/mobile/CLAUDE.md` → "Testing").
- Dependabot abre PRs mensuales solo para las GitHub Actions (las dependencias de la app se actualizan con `bunx expo install`).
- Se mergea solo con **squash**: el título del PR queda como el commit en `main`, por eso tiene que respetar el formato. La branch se borra sola al mergear.
- **El PR tiene que estar al día con `main`** para poder mergearse (GitHub lo marca como *BEHIND* si entró otro PR antes). Se actualiza **siempre con rebase, nunca con merge** (el historial de `main` es lineal):
  ```bash
  gh pr update-branch <número> --rebase          # desde GitHub, sin tocar tu copia local
  # o en local:
  git fetch origin && git rebase origin/main     # resolver conflictos según "Trabajo en paralelo y conflictos"
  git push --force-with-lease                    # solo sobre TU branch, nunca sobre main
  ```
  Después del rebase el CI corre de nuevo y hay que esperar a que pase.
- Resultado: **un PR = un commit en `main`**, con el título del PR como mensaje.
- No hace falta aprobación de otro para mergear (somos pocos), pero conviene avisar al grupo en PRs grandes.
- Mantener los PRs chicos y de un tema (una pantalla, un procedure, un fix).
- Claude: crear la branch y el PR; **mergear solo si el usuario lo pide** (`gh pr merge --squash` cuando el CI esté en verde).

### Issues
- Lo pendiente se trackea en **GitHub Issues** (labels: `infra` para infraestructura/CI/deploy, `blocked` si depende de algo externo). Cada ítem de `PENDIENTES.md` tiene su issue y viceversa.
- Un PR que resuelve un issue lo dice en la descripción (`Closes #N`) para que se cierre solo al mergear; al cerrar un issue de infra, sacarlo de `PENDIENTES.md` (ver "Cuándo una tarea está terminada").
