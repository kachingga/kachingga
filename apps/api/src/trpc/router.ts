import { router } from './init'
import { balancesRouter } from './routers/balances'
import { categoriesRouter } from './routers/categories'
import { expensesRouter } from './routers/expenses'
import { groupsRouter } from './routers/groups'
import { healthRouter } from './routers/health'
import { participantsRouter } from './routers/participants'
import { profileRouter } from './routers/profile'
import { ratesRouter } from './routers/rates'
import { savedFiltersRouter } from './routers/savedFilters'
import { settlementsRouter } from './routers/settlements'

export const appRouter = router({
  health: healthRouter,
  groups: groupsRouter,
  participants: participantsRouter,
  profile: profileRouter,
  categories: categoriesRouter,
  expenses: expensesRouter,
  settlements: settlementsRouter,
  balances: balancesRouter,
  savedFilters: savedFiltersRouter,
  rates: ratesRouter,
})

export type AppRouter = typeof appRouter
