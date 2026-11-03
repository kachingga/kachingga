import { getDollarRate } from '../../lib/rates'
import { protectedProcedure, router } from '../init'

// For pre-filling the exchange rate in the app (mid = (buy + sell) / 2). Blue is the default;
// oficial is an alternative the user can pick. Either way the app sends it as `exchangeRate`.
export const ratesRouter = router({
  blue: protectedProcedure.query(() => getDollarRate('blue')),
  official: protectedProcedure.query(() => getDollarRate('oficial')),
})
