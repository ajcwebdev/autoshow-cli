import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import {
  classifyHostedRateLimitPressure,
  createHostedConcurrencyCoordinator,
  recoverHostedConcurrencyRequest,
  runHostedConcurrencyRequest,
} from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { estimateHostedConcurrencyWallTimeMs } from '~/utils/hosted-concurrency-estimator'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { createHostedOcrScheduler } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'
import { withOcrPageRequestRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import type { HostedConcurrencyAdmissionToken, HostedConcurrencyCoordinatorOptions } from '~/types'

const createClock = () => {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number, callback: () => void }>()
  const setTimer: NonNullable<HostedConcurrencyCoordinatorOptions['setTimer']> = (callback, delayMs) => {
    const id = nextId++
    timers.set(id, { at: now + Math.max(0, delayMs), callback })
    return id as unknown as ReturnType<typeof setTimeout>
  }
  const clearTimer: NonNullable<HostedConcurrencyCoordinatorOptions['clearTimer']> = (timer) => {
    timers.delete(timer as unknown as number)
  }
  const advance = async (durationMs: number): Promise<void> => {
    const target = now + durationMs
    while (true) {
      const next = [...timers.entries()].sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0]
      if (!next || next[1].at > target) break
      now = next[1].at
      timers.delete(next[0])
      next[1].callback()
      await Promise.resolve()
    }
    now = target
    await Promise.resolve()
  }
  return { now: () => now, setTimer, clearTimer, advance, timerCount: () => timers.size }
}

const admission = (provider: string, unitIndex: number, configuredLimit = 12) => ({
  provider,
  workClass: 'image' as const,
  configuredLimit,
  workId: `${provider}-work`,
  unitIndex,
})

const flushMicrotasks = async (): Promise<void> => {
  for (let index = 0; index < 8; index++) await Promise.resolve()
}

describe('hosted concurrency coordinator', () => {
  test('ramps one queued slot every five seconds and replaces completed work inside the live limit', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'ramp', now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const pending = Array.from({ length: 12 }, (_, index) => coordinator.acquire(admission('openai', index)))

    expect(coordinator.snapshot().lanes[0]).toMatchObject({ configuredLimit: 12, currentLimit: 1, active: 1, queuedWork: 11 })
    await clock.advance(50_000)
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ currentLimit: 11, active: 11, queuedWork: 1 })
    await clock.advance(5_000)
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ currentLimit: 12, active: 12, queuedWork: 0, activePeak: 12 })

    const tokens = await Promise.all(pending)
    coordinator.release(tokens[0] as HostedConcurrencyAdmissionToken)
    const replacement = coordinator.acquire(admission('openai', 12))
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ currentLimit: 12, active: 12, queuedWork: 0 })
    coordinator.release(await replacement)
    for (const token of tokens.slice(1)) coordinator.release(token)
    coordinator.dispose()
    expect(clock.timerCount()).toBe(0)
  })

  test('starts independent provider lanes immediately while same-provider classes share the aggregate lane', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'ramp', now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const openai = coordinator.acquire(admission('openai', 0, 4))
    const gemini = coordinator.acquire(admission('gemini', 0, 4))
    const secondOpenai = coordinator.acquire({ ...admission('openai', 1, 2), workClass: 'llm' })

    expect(coordinator.snapshot().lanes).toHaveLength(2)
    expect(coordinator.snapshot().lanes.map((lane) => lane.active)).toEqual([1, 1])
    expect(coordinator.snapshot().lanes.find((lane) => lane.lane.service === 'openai')).toMatchObject({ configuredLimit: 4, active: 1, queuedWork: 1 })
    await clock.advance(5_000)
    expect(coordinator.snapshot().lanes.find((lane) => lane.lane.service === 'openai')).toMatchObject({ currentLimit: 2, active: 2 })
    coordinator.release(await openai)
    coordinator.release(await gemini)
    coordinator.release(await secondOpenai)
  })

  test('isolates account labels, preserves lane progress across idle time, and enforces per-class caps', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'ramp', now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const primary = coordinator.acquire({ ...admission('openai', 0, 4), accountLabel: 'primary' })
    const secondary = coordinator.acquire({ ...admission('openai', 0, 4), accountLabel: 'secondary' })
    const primaryQueue = Array.from({ length: 2 }, (_, index) => coordinator.acquire({ ...admission('openai', index + 1, 4), accountLabel: 'primary' }))
    expect(coordinator.snapshot().lanes.map((lane) => lane.active)).toEqual([1, 1])
    await clock.advance(10_000)
    const primaryTokens = [await primary, ...await Promise.all(primaryQueue)]
    expect(coordinator.snapshot().lanes.find((lane) => lane.lane.scopeLabel === 'primary')).toMatchObject({ currentLimit: 3, active: 3 })
    for (const token of primaryTokens) coordinator.release(token)
    coordinator.release(await secondary)

    await clock.advance(60_000)
    const classOne = coordinator.acquire({ ...admission('openai', 10, 4), accountLabel: 'primary', workClass: 'llm' as const, configuredLimit: 1 })
    const classTwo = coordinator.acquire({ ...admission('openai', 11, 4), accountLabel: 'primary', workClass: 'llm' as const, configuredLimit: 1 })
    await flushMicrotasks()
    expect(coordinator.snapshot().lanes.find((lane) => lane.lane.scopeLabel === 'primary')).toMatchObject({ currentLimit: 3, active: 1, queuedWork: 1 })
    coordinator.release(await classOne)
    coordinator.release(await classTwo)
  })

  test('immediate mode begins at the configured cap', async () => {
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'immediate' })
    const tokens = await Promise.all(Array.from({ length: 4 }, (_, index) => coordinator.acquire(admission('openai', index, 4))))
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ configuredLimit: 4, currentLimit: 4, activePeak: 4 })
    for (const token of tokens) coordinator.release(token)
  })

  test('halves on 429, waits for backoff, admits one recovery probe, and re-ramps after success', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'immediate', now: clock.now, random: () => 1, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    let attempts = 0
    const request = runHostedConcurrencyRequest({ coordinator, admission: admission('openai', 0, 8) }, async () => {
      attempts += 1
      if (attempts === 1) throw ProviderError('too many requests', { status: 429, headers: new Headers({ 'retry-after': '1' }) })
      return 'ok'
    })
    await flushMicrotasks()

    expect(attempts).toBe(1)
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ currentLimit: 4, active: 0, queuedWork: 1 })
    await clock.advance(1_999)
    expect(attempts).toBe(1)
    await clock.advance(1)
    await expect(request).resolves.toBe('ok')
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ currentLimit: 4, recoveryProbes: 1, pressureEvents: [{ backoffMs: 2_000 }] })

    const queued = Array.from({ length: 5 }, (_, index) => coordinator.acquire(admission('openai', index + 1, 8)))
    await clock.advance(5_000)
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ currentLimit: 5, active: 5 })
    for (const token of await Promise.all(queued)) coordinator.release(token)
  })

  test('uses 2, 4, 8, 16, and 30 second recovery bases and respects a larger Retry-After floor', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'immediate', now: clock.now, random: () => 1, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const attemptTimes: number[] = []
    const request = runHostedConcurrencyRequest({ coordinator, admission: admission('openai', 0, 16) }, async () => {
      attemptTimes.push(clock.now())
      if (attemptTimes.length <= 5) throw ProviderError('rate limited', { status: 429 })
      return 'ok'
    })
    request.catch(() => undefined)
    await flushMicrotasks()
    for (const delay of [2_000, 4_000, 8_000, 16_000, 30_000]) {
      await clock.advance(delay)
      await flushMicrotasks()
    }
    await expect(request).resolves.toBe('ok')
    expect(attemptTimes).toEqual([0, 2_000, 6_000, 14_000, 30_000, 60_000])
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ currentLimit: 1, recoveryProbes: 5 })

    let retryAfterAttempts = 0
    const retryAfter = runHostedConcurrencyRequest({ coordinator, admission: admission('gemini', 0, 4) }, async () => {
      retryAfterAttempts += 1
      if (retryAfterAttempts === 1) throw ProviderError('too many requests', { status: 429, headers: new Headers({ 'Retry-After': '9' }) })
      return 'ok'
    })
    await flushMicrotasks()
    await clock.advance(8_999)
    expect(retryAfterAttempts).toBe(1)
    await clock.advance(1)
    await expect(retryAfter).resolves.toBe('ok')
    expect(coordinator.snapshot().lanes.find((lane) => lane.lane.service === 'gemini')?.pressureEvents[0]?.backoffMs).toBe(9_000)
  })

  test('lets shared retry contexts replace the exact admission without a second sleep', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'immediate', now: clock.now, random: () => 1, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const requestAdmission = admission('openai', 0, 4)
    let token = await coordinator.acquire(requestAdmission)
    const attemptTimes: number[] = []
    const request = withRetry({
      retryClass: 'runtime_http_create_retriable',
      operationName: 'shared hosted retry hook',
      policy: { maxAttempts: 1, baseDelayMs: 30_000, maxDelayMs: 30_000, jitter: false, exponential: false },
      retryHookCanExtendAttempts: true,
      onRetryAttempt: async (error) => {
        token = await recoverHostedConcurrencyRequest({ coordinator, admission: requestAdmission, token, error })
        return true
      }
    }, async () => {
      attemptTimes.push(clock.now())
      if (attemptTimes.length === 1) throw ProviderError('too many requests', { status: 429 })
      return 'ok'
    }, (error) => classifyFetchRetry(error, 'runtime_http_create_retriable'))
    request.catch(() => undefined)
    await flushMicrotasks()
    await clock.advance(1_999)
    expect(attemptTimes).toEqual([0])
    await clock.advance(1)
    await expect(request).resolves.toBe('ok')
    coordinator.release(token, 'succeeded')
    expect(attemptTimes).toEqual([0, 2_000])
  })

  test('routes hosted TTS and OCR retry scaffolding through exact recovery probes', async () => {
    const ttsClock = createClock()
    const ttsCoordinator = createHostedConcurrencyCoordinator({ mode: 'immediate', now: ttsClock.now, random: () => 1, setTimer: ttsClock.setTimer, clearTimer: ttsClock.clearTimer })
    const ttsScheduler = createHostedTtsChunkScheduler({ maxConcurrency: 2, concurrencyMode: 'immediate', hostedConcurrencyCoordinator: ttsCoordinator })
    let ttsAttempts = 0
    const ttsRun = ttsScheduler.runChunks('grok', ['chunk'], async (_chunk, _index, ttsAdmission) =>
      await withHostedTtsRetry({ operationName: 'hosted TTS exact recovery', chunkScheduler: ttsScheduler, admission: ttsAdmission, policy: { maxAttempts: 1 } }, async () => {
        ttsAttempts += 1
        if (ttsAttempts === 1) throw ProviderError('rate limited', { status: 429 })
        return 'tts-ok'
      })
    )
    await flushMicrotasks()
    expect(ttsAttempts).toBe(1)
    await ttsClock.advance(2_000)
    await flushMicrotasks()
    await expect(ttsRun).resolves.toEqual(['tts-ok'])
    expect(ttsCoordinator.snapshot().lanes[0]).toMatchObject({ recoveryProbes: 1, completed: 1 })

    const ocrClock = createClock()
    const ocrCoordinator = createHostedConcurrencyCoordinator({ mode: 'immediate', now: ocrClock.now, random: () => 1, setTimer: ocrClock.setTimer, clearTimer: ocrClock.clearTimer })
    const ocrScheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 1, concurrencyMode: 'immediate', hostedConcurrencyCoordinator: ocrCoordinator })
    let ocrAttempts = 0
    const ocrRun = ocrScheduler.run({ service: 'gemini', model: 'gemini-3.5-flash', pageNumber: 1 }, async ({ onRetryable }) =>
      await withOcrPageRequestRetry('hosted OCR exact recovery', async () => {
        ocrAttempts += 1
        if (ocrAttempts === 1) throw ProviderError('rate limited', { status: 429 })
        return 'ocr-ok'
      }, { attempts: 1, onRetryable })
    )
    await flushMicrotasks()
    expect(ocrAttempts).toBe(1)
    await ocrClock.advance(2_000)
    await flushMicrotasks()
    await expect(ocrRun).resolves.toBe('ocr-ok')
    expect(ocrCoordinator.snapshot().lanes[0]).toMatchObject({ recoveryProbes: 1, completed: 1 })
  })

  test('stops recovery when the next delay exceeds the five-minute-style budget and leaves non-rate failures unchanged', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'immediate', recoveryBudgetMs: 5_000, now: clock.now, random: () => 1, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const exhausted = runHostedConcurrencyRequest({ coordinator, admission: admission('openai', 0, 4) }, async () => {
      throw ProviderError('rate limited', { status: 429 })
    })
    exhausted.catch(() => undefined)
    await flushMicrotasks()
    await clock.advance(2_000)
    await expect(exhausted).rejects.toMatchObject({ kind: 'retry_exhausted', status: 429 })
    expect(coordinator.snapshot().lanes[0]).toMatchObject({ recoveryFailures: 1 })

    const validation = ProviderError('invalid request', { status: 400 })
    await expect(runHostedConcurrencyRequest({ coordinator, admission: admission('gemini', 0, 4) }, async () => { throw validation })).rejects.toBe(validation)
  })

  test('classifies explicit rate pressure but excludes billing, quota, auth, timeout, and server failures', () => {
    expect(classifyHostedRateLimitPressure(ProviderError('limited', { status: 429 }))).toMatchObject({ status: 429 })
    expect(classifyHostedRateLimitPressure(ProviderError('billing quota exhausted', { status: 429 }))).toBeUndefined()
    expect(classifyHostedRateLimitPressure(ProviderError('request rejected', { status: 429, metadata: { category: 'quota_exceeded' } }))).toBeUndefined()
    expect(classifyHostedRateLimitPressure(ProviderError('request rejected', { metadata: { category: 'concurrency_limit' } }))).toMatchObject({ reason: 'concurrency_limit' })
    expect(classifyHostedRateLimitPressure(ProviderError('timeout', { status: 408 }))).toBeUndefined()
    expect(classifyHostedRateLimitPressure(ProviderError('server error', { status: 503 }))).toBeUndefined()
  })

  test('cleans up queued abort listeners and timers on cancellation and disposal', async () => {
    const clock = createClock()
    const coordinator = createHostedConcurrencyCoordinator({ mode: 'ramp', now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer })
    const active = await coordinator.acquire(admission('openai', 0, 3))
    const abort = new AbortController()
    const canceled = coordinator.acquire({ ...admission('openai', 1, 3), abortSignal: abort.signal })
    abort.abort(new Error('stop'))
    await expect(canceled).rejects.toThrow('stop')
    coordinator.dispose(new Error('disposed'))
    expect(clock.timerCount()).toBe(0)
    coordinator.release(active)
  })
})

describe('clean hosted ramp price model', () => {
  test('models independent five-second startup slots and immediate mode without rate-limit events', () => {
    const work = Array.from({ length: 12 }, () => 100_000)
    expect(estimateHostedConcurrencyWallTimeMs(work, 12, 'ramp')).toBe(155_000)
    expect(estimateHostedConcurrencyWallTimeMs(work, 12, 'immediate')).toBe(100_000)
    expect(estimateHostedConcurrencyWallTimeMs([1_000, 1_000, 1_000], 12, 'ramp')).toBe(3_000)
  })
})
