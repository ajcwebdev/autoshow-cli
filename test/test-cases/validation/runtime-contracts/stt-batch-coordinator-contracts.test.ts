import { describe, expect, spyOn, test } from 'bun:test'
import { SttBatchCoordinator } from '~/cli/commands/stt/stt-batch/stt-batch-coordinator'
import type { SttBatchBlockedProviderReason, SttTarget } from '~/types'
import { createManualTimerClock } from '../../../test-utils/manual-timer-clock'

const target = (service: SttTarget['service'] = 'deepgram', model = 'fixture'): SttTarget => ({ service, model, local: false })
const transient = { message: 'try again', retryable: true, status: 503 }
const flush = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve()
}
const installClock = () => {
  const clock = createManualTimerClock<ReturnType<typeof setTimeout>>(
    id => id as unknown as ReturnType<typeof setTimeout>,
    timer => timer as unknown as number
  )
  const now = spyOn(Date, 'now').mockImplementation(clock.now)
  const timer = spyOn(globalThis, 'setTimeout').mockImplementation(clock.setTimer as typeof setTimeout)
  const clear = spyOn(globalThis, 'clearTimeout').mockImplementation(clock.clearTimer as typeof clearTimeout)
  return { ...clock, restore: () => { now.mockRestore(); timer.mockRestore(); clear.mockRestore() } }
}

describe('STT provider coordination transitions', () => {
  test('warmup admits one request, success opens the provider cap, and release wakes pending work', async () => {
    const coordinator = new SttBatchCoordinator()
    const provider = target()
    expect(coordinator.tryReserveProvider(provider)).toEqual({ action: 'run' })
    expect(coordinator.tryReserveProvider(provider)).toEqual({ action: 'defer' })
    let notified = false
    const waiting = coordinator.waitForAvailability([provider, provider]).then(() => { notified = true })
    await flush()
    expect(notified).toBe(false)
    coordinator.reportProviderSuccess(provider)
    await waiting
    expect(coordinator.peekProviderAvailability(provider)).toEqual({ action: 'run', activeCount: 0, slotLimit: 4 })
    for (let index = 0; index < 4; index++) expect(coordinator.tryReserveProvider(provider)).toEqual({ action: 'run' })
    expect(coordinator.tryReserveProvider(provider)).toEqual({ action: 'defer' })
    coordinator.releaseProviderSlot(provider)
    expect(coordinator.tryReserveProvider(provider)).toEqual({ action: 'run' })
    expect(coordinator.getSchedulerSnapshot().providers[0]).toMatchObject({ launchedCount: 6, completedCount: 1, warmupComplete: true })
  })

  test('provider and model reservations are independent while local work bypasses admission and polling', async () => {
    const coordinator = new SttBatchCoordinator({ batchConcurrency: 1 })
    expect(coordinator.tryReserveProvider(target('deepgram', 'one'))).toEqual({ action: 'run' })
    expect(coordinator.tryReserveProvider(target('deepgram', 'two'))).toEqual({ action: 'run' })
    expect(coordinator.tryReserveProvider(target('assemblyai', 'one'))).toEqual({ action: 'run' })
    const local = { ...target(), local: true }
    expect(coordinator.peekProviderAvailability(local)).toEqual({ action: 'run', activeCount: 0, slotLimit: 1 })
    expect(await coordinator.withPollSlot(local, async () => 'local')).toBe('local')
    expect(coordinator.getSchedulerSnapshot().providers).toHaveLength(3)
  })

  test('two consecutive retryable failures degrade a provider and returned reasons do not mutate stored state', () => {
    const coordinator = new SttBatchCoordinator()
    const provider = target()
    coordinator.tryReserveProvider(provider)
    coordinator.reportProviderFailure(provider, transient)
    expect(coordinator.tryReserveProvider(provider)).toEqual({ action: 'run' })
    coordinator.reportProviderFailure(provider, transient)
    const decision = coordinator.peekProviderAvailability(provider)
    expect(decision.action).toBe('skip')
    if (decision.action !== 'skip') throw new Error('Expected degraded provider')
    expect(decision.reason).toMatchObject({ degraded: true, status: 503, retryable: true })
    decision.reason.message = 'mutated snapshot'
    expect(coordinator.peekProviderAvailability(provider)).not.toMatchObject({ reason: { message: 'mutated snapshot' } })
    expect(coordinator.getSchedulerSnapshot().providers[0]).toMatchObject({ degradedCount: 1, blockedCount: 0 })
  })

  test('success and non-retryable failure reset the consecutive failure threshold', () => {
    const coordinator = new SttBatchCoordinator()
    const provider = target()
    coordinator.reportProviderFailure(provider, transient)
    coordinator.reportProviderFailure(provider, { message: 'terminal', retryable: false })
    coordinator.reportProviderFailure(provider, transient)
    expect(coordinator.peekProviderAvailability(provider).action).toBe('run')
    coordinator.reportProviderSuccess(provider)
    coordinator.reportProviderFailure(provider, transient)
    expect(coordinator.peekProviderAvailability(provider).action).toBe('run')
  })

  test('explicit blocking wins over cooldown, is cloned, and wakes waiters', async () => {
    const coordinator = new SttBatchCoordinator()
    const provider = target()
    coordinator.tryReserveProvider(provider)
    const waiting = coordinator.waitForAvailability([provider])
    const reason: SttBatchBlockedProviderReason = { ...provider, message: 'invalid credentials', retryable: false, status: 401 }
    coordinator.reportProviderFailure(provider, transient, { blockedReason: reason, cooldownMs: 1000 })
    reason.message = 'changed input'
    await waiting
    expect(coordinator.peekProviderAvailability(provider)).toMatchObject({ action: 'skip', reason: { message: 'invalid credentials' } })
    expect(coordinator.getSchedulerSnapshot().providers[0]).toMatchObject({ blockedCount: 1, degradedCount: 0 })
  })

  test('cooldowns are bounded, expire on the timer, and leave no registered timer after waking', async () => {
    const clock = installClock()
    try {
      const coordinator = new SttBatchCoordinator()
      const provider = target()
      coordinator.reportProviderFailure(provider, transient, { cooldownMs: 999_999 })
      expect(coordinator.peekProviderAvailability(provider)).toMatchObject({ action: 'defer', cooldownMs: 300_000 })
      let notified = false
      const waiting = coordinator.waitForAvailability([provider]).then(() => { notified = true })
      expect(clock.timerCount()).toBe(1)
      await clock.advance(299_999)
      expect(notified).toBe(false)
      await clock.advance(1)
      await waiting
      expect(coordinator.peekProviderAvailability(provider).action).toBe('run')
      expect(clock.timerCount()).toBe(0)
    } finally {
      clock.restore()
    }
  })

  test('a wake from another target removes the shared cooldown timer and all waiter registrations', async () => {
    const clock = installClock()
    try {
      const coordinator = new SttBatchCoordinator()
      const cooling = target('deepgram')
      const active = target('assemblyai')
      coordinator.reportProviderFailure(cooling, transient, { cooldownMs: 1000 })
      coordinator.tryReserveProvider(active)
      let notifications = 0
      const waiting = coordinator.waitForAvailability([cooling, active, active]).then(() => { notifications++ })
      coordinator.releaseProviderSlot(active, { warmupSuccess: true })
      await waiting
      expect(clock.timerCount()).toBe(0)
      await clock.advance(2000)
      coordinator.reportProviderSuccess(cooling)
      expect(notifications).toBe(1)
    } finally {
      clock.restore()
    }
  })

  test('poll slots queue independently from launch slots and release even when a task rejects', async () => {
    const coordinator = new SttBatchCoordinator({ batchConcurrency: 1 })
    const provider = target('assemblyai')
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const starts: string[] = []
    const first = coordinator.withPollSlot(provider, async () => { starts.push('first'); await gate; throw new Error('poll failed') })
    const firstOutcome = first.catch(error => error as Error)
    const second = coordinator.withPollSlot(provider, async () => { starts.push('second'); return 'completed' })
    await flush()
    expect(starts).toEqual(['first'])
    expect(coordinator.tryReserveProvider(provider)).toEqual({ action: 'run' })
    release()
    expect((await firstOutcome).message).toBe('poll failed')
    expect(await second).toBe('completed')
    expect(starts).toEqual(['first', 'second'])
    expect(coordinator.getSchedulerSnapshot().providers[0]).toMatchObject({ pollCount: 2, launchedCount: 1 })
  })
})
