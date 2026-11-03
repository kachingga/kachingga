import { getBlueRate } from '../../lib/rates'
import { protectedProcedure, router } from '../init'

export const ratesRouter = router({
  // For pre-filling the exchange rate in the app (mid = (buy + sell) / 2).
  blue: protectedProcedure.query(() => getBlueRate()),
})
