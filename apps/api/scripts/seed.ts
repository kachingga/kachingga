// Usage: bun run db:seed
// Fills the DEV database with demo users and groups so the front has realistic data to show.
// Goes through the real tRPC procedures (same business rules as the app). Re-running it deletes
// the demo users' groups and creates them again. Refuses to run against anything but dev.
import type { User } from '@supabase/supabase-js'
import { prisma } from '../src/db'
import { getSupabase } from '../src/lib/supabase'
import { createCallerFactory } from '../src/trpc/init'
import { appRouter } from '../src/trpc/router'

const DEV_REF = 'nraoqdaplvvsakvtlcam' // stg (INFRA.md)

if (![process.env.SUPABASE_URL, process.env.DATABASE_URL].every((url) => url?.includes(DEV_REF))) {
  console.error(`El seed solo corre contra la base de dev (${DEV_REF}). Revisá apps/api/.env.`)
  process.exit(1)
}
const password = process.env.SEED_USER_PASSWORD
if (!password || password.length < 8) {
  console.error('Falta SEED_USER_PASSWORD en apps/api/.env (mínimo 8 caracteres). Pedísela a Galo.')
  process.exit(1)
}

const EMAILS = {
  juan: 'juan.demo@example.com',
  tuke: 'tuke.demo@example.com',
  roman: 'roman.demo@example.com',
}

// Creates the auth user with its email already confirmed (admin API: no mail, works with "Confirm
// email" on), or resets its password and confirms it if it already exists.
async function ensureUser(email: string) {
  const auth = getSupabase().auth.admin
  const created = await auth.createUser({ email, password, email_confirm: true })
  if (created.data.user) return created.data.user.id
  const { data, error } = await auth.listUsers({ perPage: 1000 })
  if (error) throw error
  const existing = data.users.find((u) => u.email === email)
  if (!existing) throw created.error
  await auth.updateUserById(existing.id, { password, email_confirm: true })
  return existing.id
}

const userIds = {
  juan: await ensureUser(EMAILS.juan),
  tuke: await ensureUser(EMAILS.tuke),
  roman: await ensureUser(EMAILS.roman),
}
const allIds = Object.values(userIds)

// Reset: everything in groups where a demo user takes part (no cascades on groups, so in order).
const old = await prisma.group.findMany({
  where: { OR: [{ createdById: { in: allIds } }, { participants: { some: { userId: { in: allIds } } } }] },
  select: { id: true },
})
const groupIds = old.map((g) => g.id)
await prisma.$transaction([
  prisma.savedFilter.deleteMany({ where: { groupId: { in: groupIds } } }),
  prisma.settlement.deleteMany({ where: { groupId: { in: groupIds } } }),
  prisma.expense.deleteMany({ where: { groupId: { in: groupIds } } }),
  prisma.participant.deleteMany({ where: { groupId: { in: groupIds } } }),
  prisma.group.deleteMany({ where: { id: { in: groupIds } } }),
  prisma.userProfile.deleteMany({ where: { userId: { in: allIds } } }),
])

const createCaller = createCallerFactory(appRouter)
const as = (key: keyof typeof userIds) => createCaller({ user: { id: userIds[key], email: EMAILS[key] } as User })
const juan = as('juan')
const tuke = as('tuke')
const roman = as('roman')

// 12:00 UTC n days ago (dates are calendar days, see "Modelo de datos"), relative to today so
// "este mes" filters always have data.
const daysAgo = (n: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(12, 0, 0, 0)
  return d
}
const ars = (pesos: number) => pesos * 100

// The group's built-in categories by key (FOOD, GROCERIES…): every group starts with them.
async function categoryIds(groupId: string) {
  const categories = await juan.categories.list({ groupId })
  return Object.fromEntries(categories.filter((c) => c.defaultKey).map((c) => [c.defaultKey!, c.id]))
}

async function participantIds(groupId: string) {
  const g = await juan.groups.get({ groupId })
  return Object.fromEntries(g.participants.map((p) => [p.name, p.id]))
}

await juan.profile.update({ paymentAlias: 'juan.kachingga' })
await tuke.profile.update({ paymentAlias: 'tuke.mp' })
// Román has no alias: the front shows the suggested transfer without one.

// 1. Trip: every currency case, every split type, payer outside the split, settlements, a deleted expense.
{
  const group = await juan.groups.create({ name: 'Viaje a Florianópolis', baseCurrency: 'ARS', myName: 'Juan' })
  const tukeP = await juan.participants.add({ groupId: group.id, name: 'Tuke' })
  const romanP = await juan.participants.add({ groupId: group.id, name: 'Román' })
  await juan.participants.add({ groupId: group.id, name: 'Sofi' }) // no account, so no alias
  await tuke.groups.join({ inviteCode: group.inviteCode, participantId: tukeP.id })
  await roman.groups.join({ inviteCode: group.inviteCode, participantId: romanP.id })
  await tuke.participants.setPaymentAlias({ participantId: tukeP.id, paymentAlias: 'tuke.viajes' }) // overrides the account's

  const p = await participantIds(group.id)
  const c = await categoryIds(group.id)
  const everyone = [p.Juan!, p.Tuke!, p.Román!, p.Sofi!]
  const base = { groupId: group.id }
  const equal = { type: 'EQUAL' as const, participantIds: everyone }

  await juan.expenses.create({
    ...base,
    description: 'Micro ida y vuelta',
    categoryId: c.TRANSPORT!,
    date: daysAgo(40),
    amountCents: ars(480_000),
    currency: 'ARS',
    paidById: p.Juan!,
    split: equal,
  })
  // Automatic blue midpoint (DolarApi)
  await tuke.expenses.create({
    ...base,
    description: 'Airbnb en Lagoa',
    categoryId: c.LODGING!,
    date: daysAgo(38),
    amountCents: 800_00,
    currency: 'USD',
    paidById: p.Tuke!,
    split: equal,
  })
  await roman.expenses.create({
    ...base,
    description: 'Súper para la semana',
    categoryId: c.GROCERIES!,
    date: daysAgo(37),
    amountCents: 650_00,
    currency: 'BRL',
    exchangeRate: 280,
    paidById: p.Román!,
    split: equal,
  })
  // Kept in USD / BRL → separate balances
  await juan.expenses.create({
    ...base,
    description: 'Cena de despedida',
    categoryId: c.FOOD!,
    date: daysAgo(32),
    amountCents: 120_00,
    currency: 'USD',
    keepCurrency: true,
    paidById: p.Juan!,
    split: equal,
  })
  await tuke.expenses.create({
    ...base,
    description: 'Caipirinhas en la playa',
    categoryId: c.ENTERTAINMENT!,
    date: daysAgo(35),
    amountCents: 180_00,
    currency: 'BRL',
    keepCurrency: true,
    paidById: p.Tuke!,
    split: equal,
  })
  await juan.expenses.create({
    ...base,
    description: 'Excursión en barco',
    categoryId: c.ENTERTAINMENT!,
    date: daysAgo(36),
    amountCents: ars(110_000),
    currency: 'ARS',
    paidById: p.Sofi!,
    split: {
      type: 'AMOUNT',
      shares: [
        { participantId: p.Juan!, amountCents: ars(40_000) },
        { participantId: p.Tuke!, amountCents: ars(40_000) },
        { participantId: p.Sofi!, amountCents: ars(30_000) },
      ],
    },
  })
  await roman.expenses.create({
    ...base,
    description: 'Nafta del auto alquilado',
    categoryId: c.TRANSPORT!,
    date: daysAgo(34),
    amountCents: 45_00,
    currency: 'USD',
    exchangeRate: 1500,
    paidById: p.Román!,
    split: {
      type: 'PERCENTAGE',
      shares: [
        { participantId: p.Juan!, percentage: 25 },
        { participantId: p.Tuke!, percentage: 25 },
        { participantId: p.Román!, percentage: 50 },
      ],
    },
  })
  // Payer outside the split
  await juan.expenses.create({
    ...base,
    description: 'Regalo de cumple para Sofi',
    categoryId: c.SHOPPING!,
    date: daysAgo(33),
    amountCents: ars(60_000),
    currency: 'ARS',
    paidById: p.Juan!,
    split: { type: 'EQUAL', participantIds: [p.Tuke!, p.Román!] },
  })
  const meals: [string, number, string][] = [
    ['Desayuno en la posada', 24_500, 'Tuke'],
    ['Almuerzo en Barra da Lagoa', 61_300, 'Román'],
    ['Helado', 18_500, 'Tuke'],
    ['Pizza el primer día', 52_000, 'Juan'],
    ['Café y medialunas', 9_800, 'Sofi'],
    ['Sushi en Jurerê', 97_250, 'Juan'],
  ]
  for (const [i, [description, pesos, payer]] of meals.entries()) {
    await juan.expenses.create({
      ...base,
      description,
      categoryId: c.FOOD!,
      date: daysAgo(39 - i),
      amountCents: ars(pesos),
      currency: 'ARS',
      paidById: p[payer]!,
      split: equal,
    })
  }
  const duplicated = await juan.expenses.create({
    ...base,
    description: 'Helado (duplicado)',
    categoryId: c.FOOD!,
    date: daysAgo(35),
    amountCents: ars(18_500),
    currency: 'ARS',
    paidById: p.Tuke!,
    split: equal,
  })
  await juan.expenses.delete({ expenseId: duplicated.id })

  await tuke.settlements.create({
    ...base,
    fromId: p.Tuke!,
    toId: p.Juan!,
    amountCents: ars(100_000),
    currency: 'ARS',
    date: daysAgo(20),
    note: 'Transferencia',
  })
  await roman.settlements.create({
    ...base,
    fromId: p.Román!,
    toId: p.Juan!,
    amountCents: 30_00,
    currency: 'USD',
    keepCurrency: true,
    date: daysAgo(18),
    note: 'En efectivo',
  })
}

// 2. Shared flat: months of history (long list for infinite scroll) and saved filters.
{
  const group = await juan.groups.create({ name: 'Depto Palermo', baseCurrency: 'ARS', myName: 'Juan' })
  await tuke.groups.join({ inviteCode: group.inviteCode, name: 'Tuke' })
  const p = await participantIds(group.id)
  const c = await categoryIds(group.id)
  const both = { type: 'EQUAL' as const, participantIds: [p.Juan!, p.Tuke!] }
  const base = { groupId: group.id, currency: 'ARS' as const, split: both }

  for (let month = 5; month >= 0; month--) {
    const start = month * 30 + 25
    const bump = 1 + (5 - month) * 0.04 // prices go up every month
    const amount = (pesos: number) => ars(Math.round(pesos * bump))
    await juan.expenses.create({
      ...base,
      description: 'Alquiler',
      categoryId: c.LODGING!,
      date: daysAgo(start),
      amountCents: amount(650_000),
      paidById: p.Juan!,
    })
    await tuke.expenses.create({
      ...base,
      description: 'Expensas',
      categoryId: c.SERVICES!,
      date: daysAgo(start - 2),
      amountCents: amount(118_000),
      paidById: p.Tuke!,
    })
    await tuke.expenses.create({
      ...base,
      description: 'Luz',
      categoryId: c.SERVICES!,
      date: daysAgo(start - 5),
      amountCents: amount(32_400),
      paidById: p.Tuke!,
    })
    await juan.expenses.create({
      ...base,
      description: 'Gas',
      categoryId: c.SERVICES!,
      date: daysAgo(start - 6),
      amountCents: amount(14_900),
      paidById: p.Juan!,
    })
    await juan.expenses.create({
      ...base,
      description: 'Internet',
      categoryId: c.SERVICES!,
      date: daysAgo(start - 8),
      amountCents: amount(27_000),
      paidById: p.Juan!,
    })
    for (let week = 0; week < 4; week++) {
      const payer = week % 2 === 0 ? p.Tuke! : p.Juan!
      await juan.expenses.create({
        ...base,
        description: 'Súper',
        categoryId: c.GROCERIES!,
        date: daysAgo(start - 3 - week * 7),
        amountCents: amount(48_000 + week * 7_350),
        paidById: payer,
      })
    }
    if (month > 0) {
      await juan.settlements.create({
        groupId: group.id,
        fromId: p.Tuke!,
        toId: p.Juan!,
        amountCents: amount(200_000),
        currency: 'ARS',
        date: daysAgo(start - 20),
      })
    }
  }
  const firstOfMonth = new Date()
  firstOfMonth.setDate(1)
  firstOfMonth.setHours(0, 0, 0, 0)
  await juan.savedFilters.create({ groupId: group.id, name: 'Servicios', filters: { categoryIds: [c.SERVICES!] } })
  await juan.savedFilters.create({ groupId: group.id, name: 'Lo que pagué yo', filters: { paidById: p.Juan! } })
  await juan.savedFilters.create({ groupId: group.id, name: 'Este mes', filters: { dateFrom: firstOfMonth } })
}

// 3. Already settled: everyone even ("están a mano").
{
  const group = await roman.groups.create({ name: 'Asado del sábado', baseCurrency: 'ARS', myName: 'Román' })
  await juan.groups.join({ inviteCode: group.inviteCode, name: 'Juan' })
  await tuke.groups.join({ inviteCode: group.inviteCode, name: 'Tuke' })
  const p = await participantIds(group.id)
  const c = await categoryIds(group.id)
  const base = { groupId: group.id, currency: 'ARS' as const }
  await roman.expenses.create({
    ...base,
    description: 'Carne y achuras',
    categoryId: c.GROCERIES!,
    date: daysAgo(3),
    amountCents: ars(90_000),
    paidById: p.Román!,
    split: { type: 'EQUAL', participantIds: [p.Juan!, p.Tuke!, p.Román!] },
  })
  await juan.settlements.create({ ...base, fromId: p.Juan!, toId: p.Román!, amountCents: ars(30_000), date: daysAgo(2) })
  await tuke.settlements.create({ ...base, fromId: p.Tuke!, toId: p.Román!, amountCents: ars(30_000), date: daysAgo(1) })
}

// 4. Archived: visible but read-only, hidden from the default list.
{
  const group = await juan.groups.create({ name: 'Bariloche 2025', baseCurrency: 'ARS', myName: 'Juan' })
  await roman.groups.join({ inviteCode: group.inviteCode, name: 'Román' })
  const p = await participantIds(group.id)
  const c = await categoryIds(group.id)
  const base = { groupId: group.id, currency: 'ARS' as const, split: { type: 'EQUAL' as const, participantIds: [p.Juan!, p.Román!] } }
  await juan.expenses.create({
    ...base,
    description: 'Cabaña',
    categoryId: c.LODGING!,
    date: daysAgo(300),
    amountCents: ars(420_000),
    paidById: p.Juan!,
  })
  await roman.expenses.create({
    ...base,
    description: 'Pases de ski',
    categoryId: c.ENTERTAINMENT!,
    date: daysAgo(298),
    amountCents: ars(380_000),
    paidById: p.Román!,
  })
  await roman.settlements.create({
    groupId: group.id,
    fromId: p.Román!,
    toId: p.Juan!,
    amountCents: ars(20_000), // Juan paid 420k, Román 380k: even after this
    currency: 'ARS',
    date: daysAgo(290),
  })
  await juan.groups.setArchived({ groupId: group.id, archived: true })
}

// 5. Empty: just created, no expenses yet.
await juan.groups.create({ name: 'Cumple de Román', baseCurrency: 'ARS', myName: 'Juan' })

const groups = await juan.groups.list({ includeArchived: true })
console.log(`Listo. Usuarios (contraseña: SEED_USER_PASSWORD de apps/api/.env):`)
for (const email of Object.values(EMAILS)) console.log(`  ${email}`)
console.log(`Grupos de ${EMAILS.juan}:`)
for (const g of groups) console.log(`  ${g.name}${g.archivedAt ? ' (archivado)' : ''} — código ${g.inviteCode}`)
await prisma.$disconnect()
