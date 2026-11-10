# Estándar de UI / UX — web

> **Aplica a:** cualquier pantalla nueva o cambio visible en `apps/web/src/routes/`. **Si cambia el estándar, actualizá este archivo en el mismo PR.** Qué hace cada pantalla: `V1.md` → "Pantallas". Reglas cortas: `apps/web/CLAUDE.md`.

La app la usamos nosotros todos los días, sobre todo en el celu: tiene que ser rápida, clara y linda. Ante la duda, priorizar que **cargar un gasto sea lo más rápido posible**.

## Mobile-first
- Diseñar primero para un celu (~390 px de ancho), después ampliar para la compu (`sm:`, `md:`…). Que nada dependa de hover.
- Áreas táctiles de al menos 44×44 px; `inputMode="decimal"` para montos; zonas seguras del iPhone.
- Que se pueda usar con una mano: acciones principales abajo y al alcance del pulgar.

## Los 4 estados de toda pantalla con datos
1. **Cargando:** skeletons con la forma del contenido. En recargas, mantener los datos viejos visibles.
2. **Vacío:** mensaje que explique qué va ahí + la acción para empezar (`EmptyState`).
3. **Error:** el `message` de la API + **Reintentar** (`ErrorState`).
4. **Con datos.** Listas largas con scroll infinito donde haya paginación.

## Acciones y feedback
- Botones de envío deshabilitados + indicador mientras la mutation está en curso (`isPending`); nunca doble envío.
- Optimistic updates en lo frecuente y precarga de la próxima pantalla (`datos-y-cache.md`).
- Confirmación antes de lo destructivo (borrar gasto o pago, quitar participante, archivar), con `useConfirm`.
- Confirmar éxitos de forma breve y no bloqueante (toast).

## Formularios
- Validar con los schemas de `@kachingga/api/schemas` y las mismas reglas que la API; error al lado del campo o del botón, en español.
- Defaults inteligentes (fecha = hoy, pagó = yo, moneda = la base, todos en partes iguales).
- En divisiones por monto o porcentaje, mostrar en vivo cuánto falta para el total o el 100%; en partes iguales, el mismo reparto de centavos que la API (`distributeCents`).

## Plata, fechas y textos
- Montos con `formatCents`, siempre con la moneda (`plata-y-fechas.md`).
- Saldos con color **y** texto ("Debés $X" / "Te deben $X" / "Estás al día").
- Copy en español argentino, corto y claro.

## Visual y accesibilidad
- Modo claro y oscuro con las variables del tema (`componentes-y-tema.md`).
- HTML semántico (`button`, `label`, `nav`, `main`, headings), foco visible, contraste suficiente, `aria-label` en botones con solo ícono.

## Antes de dar una pantalla por terminada
- [ ] Cumple las reglas de negocio y `V1.md` → "Pantallas".
- [ ] Tiene los 4 estados.
- [ ] Mutations con `isPending`, invalidación y (si aplica) optimistic update.
- [ ] Funciona en un celu real (o el modo celular del navegador) y en la compu, claro y oscuro.
- [ ] Tiene su test de contenido y, si es un recorrido crítico, su E2E.
- [ ] `bun run check` pasa.
