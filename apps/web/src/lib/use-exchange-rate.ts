import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '@/lib/trpc';
import { toNumber, toNumeric, type Currency } from '@/lib/format';

type RateSource = 'blue' | 'oficial' | 'manual';

// Suggested rates only exist between ARS and another currency (rates.get gives 1 unit in ARS).
export function canAutoSuggest(base: Currency, currency: Currency) {
  return base !== currency && (base === 'ARS') !== (currency === 'ARS');
}

function defaultSource(base: Currency, currency: Currency): RateSource {
  if (!canAutoSuggest(base, currency)) return 'manual';
  return (base === 'ARS' ? currency : base) === 'USD' ? 'blue' : 'oficial';
}

/**
 * State of the "currency of a movement" part of a form (expense or settlement): convert to the
 * group's base (suggested blue/oficial rate or by hand) or keep the currency.
 *
 * The rate is always shown as "1 <foreign> = X <other>" (for an ARS movement in a foreign-base
 * group, "1 USD = 1555 ARS"), and turned into what the API stores: 1 <movement currency> in base.
 */
export function useExchangeRate(
  base: Currency,
  currency: Currency,
  initial?: { exchangeRate: number | null; keepCurrency: boolean },
) {
  const trpc = useTRPC();
  const inverted = currency === 'ARS' && base !== 'ARS';

  const [keepCurrency, setKeepCurrency] = useState(initial?.keepCurrency ?? false);
  const [source, setSource] = useState<RateSource>(
    initial?.exchangeRate != null ? 'manual' : defaultSource(base, currency),
  );
  const [manualRate, setManualRate] = useState(
    initial?.exchangeRate != null
      ? toNumeric(inverted ? 1 / initial.exchangeRate : initial.exchangeRate)
      : '',
  );

  const converting = currency !== base && !keepCurrency;
  const quoteCurrency = (base === 'ARS' ? currency : base) as Exclude<Currency, 'ARS'>;
  const rateQuery = useQuery({
    ...trpc.rates.get.queryOptions({
      currency: quoteCurrency,
      source: source === 'blue' ? 'blue' : 'oficial',
    }),
    enabled: converting && source !== 'manual' && canAutoSuggest(base, currency),
  });

  const shownRate = source === 'manual' ? toNumber(manualRate) : (rateQuery.data?.mid ?? null);
  const storedRate = shownRate && shownRate > 0 ? (inverted ? 1 / shownRate : shownRate) : null;

  return {
    base,
    currency,
    inverted,
    keepCurrency,
    setKeepCurrency,
    source,
    setSource: (s: RateSource) => {
      if (s === 'manual' && shownRate) setManualRate(toNumeric(shownRate));
      setSource(s);
    },
    manualRate,
    setManualRate,
    rateQuery,
    /** To send as `exchangeRate`: null when the currency is the base or is kept. */
    exchangeRate: converting ? storedRate : null,
    /** Error to show before submitting, if the rate is still missing. */
    missingRateError:
      converting && storedRate === null
        ? source === 'manual'
          ? 'Cargá el tipo de cambio'
          : 'Esperá a que cargue la cotización o cargala a mano'
        : null,
    /** Forget the previous choice when the movement's currency changes. */
    resetFor: (next: Currency) => {
      setKeepCurrency(false);
      setSource(defaultSource(base, next));
      setManualRate('');
    },
  };
}

export type ExchangeRateState = ReturnType<typeof useExchangeRate>;
