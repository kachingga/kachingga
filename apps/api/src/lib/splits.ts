import { TRPCError } from '@trpc/server'

import { distributeCents as distribute } from '../schemas'

export type SplitInput =
  | { type: 'EQUAL'; participantIds: string[] }
  | { type: 'AMOUNT'; shares: { participantId: string; amountCents: number }[] }
  | { type: 'PERCENTAGE'; shares: { participantId: string; percentage: number }[] }

export type ResolvedSplit = { participantId: string; amountCents: number; percentage: number | null }

function assertUnique(ids: string[]) {
  if (ids.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'El gasto tiene que dividirse entre al menos una persona' })
  if (new Set(ids).size !== ids.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Hay participantes repetidos en la división' })
}

export function resolveSplits(amountCents: number, split: SplitInput): ResolvedSplit[] {
  if (split.type === 'EQUAL') {
    assertUnique(split.participantIds)
    const amounts = distribute(
      amountCents,
      split.participantIds.map(() => 1),
    )
    return split.participantIds.map((participantId, i) => ({ participantId, amountCents: amounts[i]!, percentage: null }))
  }

  assertUnique(split.shares.map((s) => s.participantId))

  if (split.type === 'AMOUNT') {
    const sum = split.shares.reduce((a, s) => a + s.amountCents, 0)
    if (sum !== amountCents) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'La suma de los montos no coincide con el total del gasto' })
    }
    return split.shares.map((s) => ({ participantId: s.participantId, amountCents: s.amountCents, percentage: null }))
  }

  const percentSum = split.shares.reduce((a, s) => a + s.percentage, 0)
  if (Math.abs(percentSum - 100) > 0.001) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Los porcentajes tienen que sumar 100' })
  }
  const amounts = distribute(
    amountCents,
    split.shares.map((s) => s.percentage),
  )
  return split.shares.map((s, i) => ({ participantId: s.participantId, amountCents: amounts[i]!, percentage: s.percentage }))
}
