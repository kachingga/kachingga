import { canAutoSuggest, type ExchangeRateState } from '@/lib/use-exchange-rate';
import { NumberInput } from '@/components/number-input';
import { formatCents, toNumeric } from '@/lib/format';

const chip = (active: boolean) =>
  `press rounded-full px-3 py-1.5 text-xs font-medium ${active ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-muted-foreground'}`;

export function ExchangeRateFields({
  rate,
  amountCents,
}: {
  rate: ExchangeRateState;
  amountCents: number;
}) {
  const { base, currency, inverted, keepCurrency, source, rateQuery } = rate;
  if (currency === base) return null;

  const autoSuggest = canAutoSuggest(base, currency);
  const isUsdQuote = (base === 'ARS' ? currency : base) === 'USD';
  const from = inverted ? base : currency;
  const to = inverted ? 'ARS' : base;
  const shown =
    source === 'manual' ? rate.manualRate : rateQuery.data ? toNumeric(rateQuery.data.mid) : '';

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => rate.setKeepCurrency(false)}
          className={`press flex-1 rounded-full py-2 text-sm font-medium ${!keepCurrency ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-muted-foreground'}`}
        >
          Convertir a {base}
        </button>
        <button
          type="button"
          onClick={() => rate.setKeepCurrency(true)}
          className={`press flex-1 rounded-full py-2 text-sm font-medium ${keepCurrency ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-muted-foreground'}`}
        >
          Mantener en {currency}
        </button>
      </div>

      {!keepCurrency && (
        <>
          {autoSuggest && (
            <div className="flex gap-2">
              {isUsdQuote && (
                <button
                  type="button"
                  onClick={() => rate.setSource('blue')}
                  className={chip(source === 'blue')}
                >
                  Blue
                </button>
              )}
              <button
                type="button"
                onClick={() => rate.setSource('oficial')}
                className={chip(source === 'oficial')}
              >
                Oficial
              </button>
              <button
                type="button"
                onClick={() => rate.setSource('manual')}
                className={chip(source === 'manual')}
              >
                A mano
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground" htmlFor="exchange-rate">
              Tipo de cambio: 1 {from} ={' '}
              {source !== 'manual' && rateQuery.isPending ? 'cargando…' : ''}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <NumberInput
                id="exchange-rate"
                value={shown}
                onValueChange={rate.setManualRate}
                decimals={6}
                readOnly={source !== 'manual'}
                placeholder="0"
                className="flex-1 h-11 rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              />
              <span className="text-sm text-muted-foreground">{to}</span>
            </div>
            {rate.exchangeRate !== null && amountCents > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                ≈ {formatCents(Math.round(amountCents * rate.exchangeRate), base)}
              </p>
            )}
            {source !== 'manual' && rateQuery.isError && (
              <p className="mt-1 text-xs text-destructive">
                No se pudo cargar la cotización. Usá &quot;A mano&quot;.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
