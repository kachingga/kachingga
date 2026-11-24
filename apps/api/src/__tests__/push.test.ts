import { describe, expect, mock, test } from 'bun:test'
import { isPushServiceUrl, PUSH_DELAY_MS, PUSH_MIN_INTERVAL_MS, PushBatcher, pushPayload } from '../lib/push'

describe('isPushServiceUrl', () => {
  test.each([
    'https://fcm.googleapis.com/fcm/send/abc:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMH',
    'https://wns2-bl2p.notify.windows.com/w/?token=BQYAAA',
  ])('the browsers push services: %s', (url) => {
    expect(isPushServiceUrl(url)).toBe(true)
  })

  test.each([
    ['not https', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['another port', 'https://fcm.googleapis.com:8443/fcm/send/abc'],
    ['with credentials', 'https://user:pass@fcm.googleapis.com/fcm/send/abc'],
    ['an internal address', 'https://169.254.169.254/latest/meta-data'],
    ['localhost', 'https://localhost:3000/trpc'],
    ['a look-alike domain', 'https://fcm.googleapis.com.evil.example/x'],
    ['a suffix without the dot', 'https://evilnotify.windows.com/x'],
    ['not a URL', 'fcm.googleapis.com/fcm/send/abc'],
  ])('anything else is rejected (%s)', (_case, url) => {
    expect(isPushServiceUrl(url)).toBe(false)
  })
})

// Timers the test moves by hand.
function fakeTimers() {
  let now = 0
  let next = 0
  const pending = new Map<number, { at: number; run: () => void }>()
  return {
    timers: {
      now: () => now,
      set: (run: () => void, ms: number) => {
        pending.set(++next, { at: now + ms, run })
        return next
      },
      clear: (handle: unknown) => void pending.delete(handle as number),
    },
    /** Moves the clock, running what comes due (in order). */
    advance(ms: number) {
      const until = now + ms
      for (;;) {
        const due = [...pending].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        pending.delete(due[0])
        now = due[1].at
        due[1].run()
      }
      now = until
    },
  }
}

describe('PushBatcher', () => {
  test('waits a moment, so a burst is one notification', () => {
    const clock = fakeTimers()
    const send = mock(async (_userId: string, _groupId: string) => {})
    const batcher = new PushBatcher(send, clock.timers)
    batcher.queue('ana', 'viaje')
    batcher.queue('ana', 'viaje')
    clock.advance(PUSH_DELAY_MS - 1)
    batcher.queue('ana', 'viaje')
    expect(send).not.toHaveBeenCalled()
    clock.advance(1)
    expect(send.mock.calls).toEqual([['ana', 'viaje']])
  })

  test('at most one per person and group per minute: the next one waits, and carries the rest', () => {
    const clock = fakeTimers()
    const send = mock(async (_userId: string, _groupId: string) => {})
    const batcher = new PushBatcher(send, clock.timers)
    batcher.queue('ana', 'viaje')
    clock.advance(PUSH_DELAY_MS)
    expect(send).toHaveBeenCalledTimes(1)

    clock.advance(10_000)
    batcher.queue('ana', 'viaje')
    batcher.queue('ana', 'viaje')
    clock.advance(PUSH_MIN_INTERVAL_MS - 10_000 - 1)
    expect(send).toHaveBeenCalledTimes(1)
    clock.advance(1)
    expect(send).toHaveBeenCalledTimes(2)
  })

  test('each person and group on its own', () => {
    const clock = fakeTimers()
    const send = mock(async (_userId: string, _groupId: string) => {})
    const batcher = new PushBatcher(send, clock.timers)
    batcher.queue('ana', 'viaje')
    batcher.queue('beto', 'viaje')
    batcher.queue('ana', 'depto')
    clock.advance(PUSH_DELAY_MS)
    expect(send.mock.calls.toSorted()).toEqual([
      ['ana', 'depto'],
      ['ana', 'viaje'],
      ['beto', 'viaje'],
    ])
  })

  test('forgets a person and group once nothing can be held back', () => {
    const clock = fakeTimers()
    const batcher = new PushBatcher(async () => {}, clock.timers)
    batcher.queue('ana', 'viaje')
    clock.advance(PUSH_DELAY_MS)
    expect(batcher.size).toBe(1)
    clock.advance(PUSH_MIN_INTERVAL_MS)
    expect(batcher.size).toBe(0)
  })

  test('a failed send is reported and the next ones still go', async () => {
    const clock = fakeTimers()
    const send = mock(async () => {
      throw new Error('push service down')
    })
    const batcher = new PushBatcher(send, clock.timers)
    batcher.queue('ana', 'viaje')
    clock.advance(PUSH_DELAY_MS)
    await Promise.resolve()
    batcher.queue('ana', 'viaje')
    clock.advance(PUSH_MIN_INTERVAL_MS)
    expect(send).toHaveBeenCalledTimes(2)
  })
})

describe('pushPayload', () => {
  const base = {
    id: 'n1',
    createdAt: new Date(),
    readAt: null,
    group: { id: 'g1', name: 'Bariloche' },
    actor: { id: 'p2', name: 'Román' },
  }
  const cena = {
    ...base,
    kind: 'EXPENSE_CREATED' as const,
    expense: {
      id: 'e1',
      description: 'Cena',
      amountCents: 4_500_000,
      currency: 'ARS' as const,
      deletedAt: null,
      category: { icon: 'utensils', color: 'tomato' },
    },
    settlement: null,
  }

  test('the group as the title; who did what and the amount; to the expense', () => {
    expect(pushPayload(cena, 1, 3)).toEqual({
      title: 'Bariloche',
      body: expect.stringMatching(/^Román agregó «Cena» · \$\s45\.000,00$/),
      url: '/grupos/g1/gastos/e1',
      tag: 'g1',
      badge: 3,
    })
  })

  test('more unread in the group: says how many, and opens the notifications screen', () => {
    const payload = pushPayload(cena, 3, 3)
    expect(payload.body).toMatch(/\(y 2 más\)$/)
    expect(payload.url).toBe('/notificaciones')
  })

  test('a payment says "vos" and goes to the payments; other currencies', () => {
    const payment = {
      ...base,
      kind: 'SETTLEMENT_CREATED' as const,
      expense: null,
      settlement: {
        id: 's1',
        amountCents: 2000,
        currency: 'USD' as const,
        deletedAt: null,
        from: { id: 'p1', name: 'Juan', isMe: true },
        to: { id: 'p2', name: 'Román', isMe: false },
      },
    }
    expect(pushPayload(payment, 1, 1)).toMatchObject({
      body: expect.stringMatching(/^Román registró un pago: vos → Román · US\$\s20,00$/),
      url: '/grupos/g1/pagos',
    })
  })
})
