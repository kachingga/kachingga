import { canAutoSuggest, type ExchangeRateState } from '@/lib/use-exchange-rate';
import { Card, Chip } from '@/components/kit';
import { NumberInput } from '@/components/number-input';
import { Label } from '@/components/ui/label';
import { formatCents, toNumeric } from '@/lib/format';

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
    <Card className="space-y-3">
      <div className="flex gap-2">
        <Chip active={!keepCurrency} className="flex-1" onClick={() => rate.setKeepCurrency(false)}>
          Convertir a {base}
        </Chip>
        <Chip active={keepCurrency} className="flex-1" onClick={() => rate.setKeepCurrency(true)}>
          Mantener en {currency}
        </Chip>
      </div>

      {!keepCurrency && (
        <>
          {autoSuggest && (
            <div className="flex gap-2">
              {isUsdQuote && (
                <Chip
                  active={source === 'blue'}
                  className="px-3 py-1.5 text-xs"
                  onClick={() => rate.setSource('blue')}
                >
                  Blue
                </Chip>
              )}
              <Chip
                active={source === 'oficial'}
                className="px-3 py-1.5 text-xs"
                onClick={() => rate.setSource('oficial')}
              >
                Oficial
              </Chip>
              <Chip
                active={source === 'manual'}
                className="px-3 py-1.5 text-xs"
                onClick={() => rate.setSource('manual')}
              >
                A mano
              </Chip>
            </div>
          )}

          <div>
            <Label htmlFor="exchange-rate" className="text-xs text-muted-foreground">
              Tipo de cambio: 1 {from} ={' '}
              {source !== 'manual' && rateQuery.isPending ? 'cargando…' : ''}
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <NumberInput
                id="exchange-rate"
                value={shown}
                onValueChange={rate.setManualRate}
                decimals={6}
                readOnly={source !== 'manual'}
                placeholder="0"
                className="flex-1"
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
    </Card>
  );
}
