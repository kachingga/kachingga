import { canAutoSuggest, type ExchangeRateState } from '@/lib/use-exchange-rate';
import { NumberInput } from '@/components/number-input';
import { formatCents, toNumeric } from '@/lib/format';

const chip = (active: boolean) =>
  `rounded-lg px-3 py-1 text-xs ${active ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'}`;

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
    <div className="space-y-3 rounded-2xl bg-card p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => rate.setKeepCurrency(false)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${!keepCurrency ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'}`}
        >
          Convertir a {base}
        </button>
        <button
          type="button"
          onClick={() => rate.setKeepCurrency(true)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium ${keepCurrency ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'}`}
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
                className="flex-1 rounded-lg border border-input bg-muted px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
