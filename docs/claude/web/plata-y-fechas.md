# Montos, números y fechas — web

> **Aplica a:** `src/lib/format.ts`, `src/lib/calculator.ts`, `src/components/number-input.tsx`, `src/components/calculator-input.tsx`, todo campo o texto con plata, porcentajes, tipos de cambio o fechas. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

## Idioma del navegador para mostrar, valores normalizados por detrás

- Lo que **se ve** (montos, números, fechas) usa el idioma del navegador: `getLocale()` en `src/lib/format.ts` ("1.500,50" en es-AR, "1,500.50" en en-US).
- **Español sin país (`es`) o `es-419` van como `es-AR`.** Chrome en Argentina reporta `es-419`, que escribe "1,500.5": sin esto, la coma decimal se ignoraba y "1500,5" se guardaba como 15.005 (bug real, encontrado en Chromium). Un país específico (`es-MX`, `es-ES`, `en-US`…) se respeta.
- Lo que **se guarda** en el estado y se manda a la API está siempre normalizado: números como string numérico (`"1500.5"`), plata en **centavos enteros** (`amountCents`), fechas como día del calendario.
- En los tests el navegador es `es-AR` (`src/test/setup.ts`).

## Campos numéricos: `<NumberInput>`

- Todo campo numérico (monto, partes, porcentajes, tipo de cambio) es un `<NumberInput>` (sobre `react-number-format`): formatea mientras se escribe en el idioma del navegador y devuelve el string normalizado; después `toCents` / `toNumber`. **Nunca un `<input>` de texto con `parseFloat`.**
- **Solo el separador decimal del idioma escribe decimales.** En es-AR, un "." tipeado por costumbre ("1.500") se ignora: es 1500. (Si el punto también fuera decimal, "1.500" daría 1,5.)
- `decimals` limita los decimales (2 para plata, 6 para tipos de cambio).
- Helpers: `toCents("1500.5")` → 150050, `centsToNumeric(150050)` → "1500.5", `toNumeric(n)` para precargar un número.

## Montos con cuentas: `<CalculatorInput>`

- El **Monto** de un gasto y la parte de cada uno en **"Por monto"** son un `<CalculatorInput>` (`src/components/calculator-input.tsx`, #167): igual que `<NumberInput>` (mismo `value` normalizado y `onValueChange`), pero acepta una cuenta con + − × ÷ ("12.000 + 3.500 + 8.000 ÷ 4"; × y ÷ antes que + y −, sin paréntesis). La lógica es pura y está en `src/lib/calculator.ts` (`evaluateExpression`, `formatExpression`).
- Mientras se escribe, el valor es el resultado (redondeado a `decimals`), así la suma de las partes se ve en vivo; una cuenta a medio escribir ("5 +") o imposible (÷ 0, negativa) deja el último resultado. Al salir del campo se ve el resultado.
- Los números siguen la misma regla del idioma (en es-AR el "." es de miles). Lo escrito se reformatea con miles y operadores con espacios, y el cursor se vuelve a poner después de los mismos dígitos y operadores (`caretAfterFormat`).
- **El teclado numérico del celu no tiene + − × ÷:** con el campo enfocado aparece abajo una fila con los cuatro botones y el resultado. Los botones hacen `preventDefault` en `mousedown` para que no se vaya el foco (ni se cierre el teclado). El envoltorio es `display: contents`: el padre ubica el campo y la fila (en una fila `flex flex-wrap`, la de botones baja a su propia línea).

## Mostrar plata

- **Un solo helper:** `formatCents(cents, currency)` (`Intl.NumberFormat` en el idioma del navegador, siempre con 2 decimales y la moneda). Las deudas se ven con centavos.
- "Copiar monto" usa `formatPlainAmount` (separador decimal del idioma, sin miles: "1500,50"), para pegar en el banco.
- Números sueltos (tipo de cambio, porcentajes): `formatNumber`.

## Fechas: un día del calendario

- **La fecha de un gasto o pago es un día del calendario, no un instante**: se guarda a las **12:00 UTC** de ese día y se lee siempre en UTC (igual que el export de la API; ver `docs/claude/api/contrato.md` → "Modelo de datos"). Así todos ven el mismo día, estén en la zona horaria que estén. Lo cargado antes al mediodía de Argentina (15:00 UTC) cae en el mismo día.
- Un "día" es un string `YYYY-MM-DD` (el valor de `<input type="date">`, que se muestra en el formato del navegador).
- Helpers de `src/lib/format.ts`:
  - `today()` — hoy **en la zona del usuario** (no `toISOString()`, que es UTC: a las 22 h en Argentina daba mañana).
  - `dayToDate(day)` — lo que se guarda (12:00 UTC). `toDay(date)` — el día de una fecha guardada.
  - `startOfDay` / `endOfDay` — rangos de filtros (00:00 a 23:59:59.999 UTC). `monthRange(day)` — del 1 al último día del mes.
  - `formatDate(date)` — en el idioma del navegador, en UTC.
- **Nunca** `toISOString()` sobre "ahora" ni `new Date('YYYY-MM-DDT…')` en hora local.
