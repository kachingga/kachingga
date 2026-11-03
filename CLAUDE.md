# Kachingga — App para dividir gastos en grupo

Proyecto de **Kachingga**, una organización de amigos (repo: `github.com/kachingga/kachingga`). Es para uso propio del grupo: cada uno tiene la app instalada en su teléfono y usa siempre la última versión.

---

## Cómo está organizada la documentación

**Regla para todos (personas y Claude):**

| Dónde | Qué va |
|-------|--------|
| **Este `CLAUDE.md` (raíz)** | **Reglas de negocio y decisiones de producto** (cómo funcionan grupos, gastos, monedas, saldos…), más lo que aplica a todo el repo: stack, arquitectura general, comandos, commits, conflictos y tooling del monorepo |
| **`apps/api/CLAUDE.md`** | Todo lo técnico de la API: modelo de datos, procedures tRPC, Prisma, migraciones, Supabase, decisiones de implementación |
| **`apps/mobile/CLAUDE.md`** | Todo lo técnico de la app: Expo, EAS, navegación, cliente tRPC, decisiones de implementación |

- Antes de implementar cualquier feature, leer **"Reglas de negocio"** de este archivo. Si el código contradice una regla de negocio, gana la regla (y se avisa).
- Si cambia o se agrega una regla de negocio → se actualiza **acá**. Si cambia un detalle técnico → se actualiza el `CLAUDE.md` del proyecto. No duplicar: un dato vive en un solo lugar.
- Lo personal de cada uno va en `CLAUDE.local.md` / `.claude/settings.local.json` (gitignoreados), nunca acá.

### Mapa de documentos

| Archivo | Qué tiene |
|---------|-----------|
| `CLAUDE.md` | Este archivo |
| `.claude/CLAUDE.md` | Guías de comportamiento para Claude (pensar antes de codear, simplicidad, cambios quirúrgicos) |
| `.claude/settings.json` | Config compartida de Claude Code (plugin de Expo) |
| `apps/api/CLAUDE.md` | Técnico de la API (ver arriba) |
| `apps/mobile/CLAUDE.md` | Técnico de la app (ver arriba) |
| `V1.md` | Alcance y roadmap de la v1. **Lo que se construye ahora** |
| `V2.md` | Alcance de la v2: agente con IA y Mercado Pago. **No implementar hasta cerrar v1** |
| `README.md` | Qué es la app y onboarding de cada miembro |
| `INFRA.md` | Servicios, dashboards, variables de entorno, secretos |
| `DEPLOY.md` | Deploy de la API (Railway), migraciones en prod y distribución de la app (EAS) |
| `IMPROVEMENTS.md` | Mejoras de infraestructura pendientes |

> **Alcance:** si una tarea toca algo de `V2.md` (agente o Mercado Pago), frená y preguntá antes de implementarlo. Todo lo demás es v1.

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
- **Quien paga puede no estar en la división** (ej. pagó algo solo para otros).
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
- Pagar con Mercado Pago desde la app es **v2**.

### Filtros
- Los gastos se pueden filtrar, combinando todo: quién pagó, a quién le corresponde (participa de la división), categorías, rango de fechas, rango de montos (en la moneda de cada gasto) y búsqueda por texto en la descripción (sin distinguir mayúsculas).
- **Filtros guardados:** cada usuario puede guardar combinaciones con nombre, por grupo. Son personales (los demás no los ven).

### Decisiones de producto tomadas
- Grupo de amigos, uso propio → sin roles ni permisos finos dentro de un grupo.
- Saldar deudas en v1 es solo manual; el pago integrado (Mercado Pago) y el agente con IA son v2.
- Dólar de referencia: **blue promedio**, nunca oficial.
- Los tipos de cambio quedan "congelados" en cada gasto/pago al cargarlo.
- Borrados lógicos (gastos y pagos) para no perder historial.

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
| Pagos (v2) | API de Mercado Pago |

---

## Arquitectura general

```
App (Expo) ──tRPC + token de Supabase──▶ API (Hono, Railway) ──Prisma──▶ PostgreSQL (Supabase)
     │                                        │
     └── Supabase Auth (solo login/sesión)    └── valida el token con Supabase
```

- **La app nunca lee ni escribe la base directo**: todo pasa por la API, que es la que aplica las reglas de negocio y decide qué ve cada usuario. La app usa Supabase solo para el login.
- **App ↔ API solo por tRPC**, con tipos de punta a punta: la app importa el *tipo* del router de la API, nunca código del server. No hay endpoints REST a mano para la app (las únicas rutas fuera de tRPC son `/health` y, en v2, el webhook de Mercado Pago).
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
├── INFRA.md / DEPLOY.md / IMPROVEMENTS.md
└── package.json             # workspaces + scripts globales
```

> **Dependencias:** nunca agregar paquetes al `package.json` raíz (única excepción: tooling del repo como `husky`). Siempre `cd` al workspace y desde ahí `bun add` (en mobile: `bunx expo install <paquete>`).

---

## Comandos

Desde la raíz (corren en todos los workspaces con `bun --filter`):

```bash
bun install          # instala todo, activa husky y genera el cliente de Prisma
bun run dev          # levanta la API (:3000) y Expo a la vez
bun run api          # solo la API
bun run mobile       # solo Expo
bun run typecheck    # tsc en api y mobile
bun run test         # tests (bun test en api)
bun run lint         # expo lint en mobile
bun run check        # typecheck + test + lint — lo mismo que corre el pre-commit
```

**Antes de dar una tarea por terminada, correr `bun run check`.** El pre-commit lo corre en cada commit y lo rechaza si algo falla.

> Los builds de EAS (`eas build`) solo se lanzan cuando alguien lo pide explícitamente. Ver `DEPLOY.md`.

### Variables de entorno

Cada app tiene un `.env.sample` commiteado que dice qué variables hacen falta y de dónde sale cada valor (`apps/api/.env.sample`, `apps/mobile/.env.sample`). Se copian a `.env` (gitignoreado). Si agregás una variable, sumala también al `.env.sample` y a `INFRA.md`.

### Tooling del monorepo — no romper
- **Husky** se activa con `prepare` en `bun install`. `pre-commit` corre `bun run check`; `commit-msg` valida Conventional Commits y deja pasar `Merge`, `Revert`, `fixup!`, `squash!` y `amend!`.
- `bunfig.toml` usa `linker = "hoisted"` (todo en el `node_modules` raíz). Viene así desde el setup de Expo; no cambiarlo sin probar que Metro siga resolviendo.
- `bun --filter '*' <script>` corre solo en los workspaces que tienen ese script.
- **TypeScript `~6.0.3` en los dos workspaces** (el del SDK 58 de Expo): la app typechequea archivos de la API, así que tienen que ir juntos.

---

## Trabajo en paralelo y conflictos

Somos varios trabajando a la vez.

### Antes de empezar y antes de pushear
```bash
git pull --rebase origin main
bun install          # por si cambiaron dependencias, hooks o el schema de Prisma
bun run check
```

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
**Scopes sugeridos:** `mobile`, `api`, `db`, `infra`, `deps`, `agent` (v2), `mp` (v2)

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
- Branches: `feat/<descripcion-corta>`, `fix/…`, `chore/…`. No commitear directo a `main` salvo que el usuario lo pida.
