# Montos, números y fechas — web

> **Aplica a:** `src/lib/format.ts`, `src/components/number-input.tsx`, todo campo o texto con plata, porcentajes, tipos de cambio o fechas. **Si cambiás cómo funciona algo de esto, actualizá este archivo en el mismo PR.** Reglas cortas: `apps/web/CLAUDE.md`.

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
