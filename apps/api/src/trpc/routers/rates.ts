import { z } from 'zod'
import { defaultRateSource, getQuote } from '../../lib/rates'
import { currency, rateSource } from '../../schemas'
import { protectedProcedure, router } from '../init'

export const ratesRouter = router({
  // Suggested rate to pre-fill when a movement is in another currency: 1 `currency` in ARS (mid = (buy + sell) / 2).
  // Without `source`: blue for USD, oficial for the rest. The app sends whatever ends up chosen as `exchangeRate`.
  get: protectedProcedure
    .input(z.object({ currency: currency.exclude(['ARS']), source: rateSource.optional() }))
    .query(async ({ input }) => {
      const source = input.source ?? defaultRateSource(input.currency)
      return { ...(await getQuote(input.currency, source)), source }
    }),
})
