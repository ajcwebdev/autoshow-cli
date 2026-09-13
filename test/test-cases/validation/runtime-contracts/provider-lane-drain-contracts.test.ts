import { expect, test } from 'bun:test'
import { drainProviderLane, LaneDrainLoop, LaneWakeTimer, trimProviderLaneHistory } from '~/cli/commands/command-shared/provider-lane-drain'

test('wake ownership retains earliest deadline, isolates lanes, and ignores stale callbacks after disposal', () => {
  let now = 100, serial = 0
  const timers = new Map<number, { callback: () => void, delay: number }>()
  const cleared: number[] = [], wakes: string[] = []
  const clock = new LaneWakeTimer<object, number>({ now: () => now, setTimer: (callback, delay) => { timers.set(++serial, { callback, delay }); return serial }, clearTimer: id => { cleared.push(id) } })
  const a = {}, b = {}
  clock.schedule(a, 300, () => wakes.push('stale'))
  clock.schedule(a, 400, () => wakes.push('late'))
  expect(timers.size).toBe(1)
  clock.schedule(a, 200, () => wakes.push('a'))
  clock.schedule(b, 150, () => wakes.push('b'))
  expect(cleared).toEqual([1])
  expect(timers.get(2)?.delay).toBe(100)
  timers.get(1)!.callback()
  expect(wakes).toEqual([])
  now = 200
  timers.get(2)!.callback()
  expect(wakes).toEqual(['a'])
  clock.dispose()
  timers.get(3)!.callback()
  expect(wakes).toEqual(['a'])
})

test('shared drain respects capacity and preserves an async notification without duplicate admission', async () => {
  const queue = [1, 2, 3], started: number[] = []
  let active = 0
  await drainProviderLane({ canAdmit: () => active < 2, pick: () => queue.shift(), start: n => { active++; started.push(n) } })
  expect(started).toEqual([1, 2]); expect(queue).toEqual([3])
  const loop = new LaneDrainLoop<object>(), lane = {}
  const gate = Promise.withResolvers<void>()
  let runs = 0
  const drain = async () => { runs++; if (runs === 1) await gate.promise }
  loop.run(lane, drain); loop.run(lane, drain); loop.run(lane, drain)
  expect(runs).toBe(1)
  gate.resolve(); await new Promise(resolve => setTimeout(resolve, 0))
  expect(runs).toBe(2)
})

test('TTS history keeps the latest 100 entries after repeated pressure/recovery', () => {
  const history: number[] = []
  for (let i = 0; i < 250; i++) { history.push(i); trimProviderLaneHistory(history) }
  expect(history).toEqual(Array.from({ length: 100 }, (_, i) => i + 150))
})
