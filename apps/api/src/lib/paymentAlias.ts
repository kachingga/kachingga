import { prisma } from '../db'

export type PaymentAliasSource = 'group' | 'account' | null

// The alias that applies to each participant in a group: the group's own (Participant.paymentAlias)
// wins over the account's (UserProfile.paymentAlias). Participants without account only have the group's.
export async function resolvePaymentAliases(participants: { id: string; userId: string | null; paymentAlias: string | null }[]) {
  const userIds = participants.flatMap((p) => (p.userId ? [p.userId] : []))
  const profiles = userIds.length ? await prisma.userProfile.findMany({ where: { userId: { in: userIds } } }) : []
  const accountAlias = new Map(profiles.map((p) => [p.userId, p.paymentAlias]))

  return new Map(
    participants.map((p) => {
      if (p.paymentAlias) return [p.id, { paymentAlias: p.paymentAlias, paymentAliasSource: 'group' as PaymentAliasSource }]
      const fromAccount = p.userId ? (accountAlias.get(p.userId) ?? null) : null
      return [p.id, { paymentAlias: fromAccount, paymentAliasSource: (fromAccount ? 'account' : null) as PaymentAliasSource }]
    }),
  )
}
