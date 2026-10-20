import { describe, expect, test } from 'bun:test'
import { createResourceGate, runWithGate } from '~/utils/resource-gate'

const deferred = (): { promise: Promise<void>, resolve: () => void } => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

const settlesWithin = async (promise: Promise<unknown>, ms: number): Promise<boolean> =>
  await Promise.race([promise.then(() => true), Bun.sleep(ms).then(() => false)])

describe('resource gate contracts', () => {
  test('a caller arriving during a release handoff cannot exceed capacity', async () => {
    const gate = createResourceGate({ capacity: 1 })
    const releaseFirst = await gate.acquire()
    let active = 0
    let peak = 0
    const hold = deferred()
    const work = async (): Promise<void> => {
      active += 1
      peak = Math.max(peak, active)
      await hold.promise
      active -= 1
    }

    const second = runWithGate(gate, work)
    releaseFirst()
    const third = runWithGate(gate, work)
    await Bun.sleep(0)
    hold.resolve()
    await Promise.all([second, third])

    expect(gate.capacity).toBe(1)
    expect(peak).toBe(1)
  })

  test('released slots pass to waiters in arrival order', async () => {
    const gate = createResourceGate({ capacity: 1 })
    const releaseFirst = await gate.acquire()
    const order: string[] = []
    const waiters = ['a', 'b', 'c'].map(async (name) => {
      const release = await gate.acquire()
      order.push(name)
      release()
    })

    releaseFirst()
    await Promise.all(waiters)

    expect(order).toEqual(['a', 'b', 'c'])
  })

  test('a rejected task releases its slot to the next caller', async () => {
    const gate = createResourceGate({ capacity: 1 })
    await expect(runWithGate(gate, async () => { throw new Error('task failed') })).rejects.toThrow('task failed')

    const next = gate.acquire()
    expect(await settlesWithin(next, 50)).toBe(true)
    ;(await next)()
  })

  test('releasing the same lease twice frees only one slot', async () => {
    const gate = createResourceGate({ capacity: 1 })
    const release = await gate.acquire()
    release()
    release()

    const holder = await gate.acquire()
    const blocked = gate.acquire()
    expect(await settlesWithin(blocked, 30)).toBe(false)

    holder()
    expect(await settlesWithin(blocked, 50)).toBe(true)
    ;(await blocked)()
  })

  test('interleaved arrivals and releases never exceed a capacity of three', async () => {
    const gate = createResourceGate({ capacity: 3 })
    let active = 0
    let peak = 0
    const delays = [5, 0, 3, 1, 4, 0, 2, 6, 1, 0, 3, 2]
    const tasks: Array<Promise<void>> = []
    for (const [index, delay] of delays.entries()) {
      tasks.push(runWithGate(gate, async () => {
        active += 1
        peak = Math.max(peak, active)
        await Bun.sleep(delay)
        active -= 1
      }))
      if (index % 3 === 0) await Bun.sleep(1)
    }
    await Promise.all(tasks)

    expect(peak).toBe(3)
    expect(active).toBe(0)
  })

  test('capacities below one slot fall back to the default instead of blocking forever', async () => {
    for (const capacity of [0.5, 0, Number.NaN, -2, Number.POSITIVE_INFINITY]) {
      const gate = createResourceGate({ capacity })
      expect(gate.capacity).toBe(1)
      const lease = gate.acquire()
      expect(await settlesWithin(lease, 50)).toBe(true)
      ;(await lease)()
    }
  })

  test('fractional capacities above one round down and the default is one', () => {
    expect(createResourceGate({ capacity: 2.7 }).capacity).toBe(2)
    expect(createResourceGate({ capacity: 4 }).capacity).toBe(4)
    expect(createResourceGate().capacity).toBe(1)
  })
})
