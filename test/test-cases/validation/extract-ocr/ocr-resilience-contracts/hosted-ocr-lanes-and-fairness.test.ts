import { describe, expect, test } from 'bun:test'
import { createHostedOcrScheduler } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'
import {
  admission,
  createSchedulerClock,
  defer,
  sleep,
  waitFor
} from './hosted-ocr-scheduler/shared'

describe('hosted OCR lane identity and cross-document contracts', () => {
  test('same-provider hosted targets share one provider/API-key lane', async () => {
    const clock = createSchedulerClock()
    const scheduler = createHostedOcrScheduler({
      mode: 'fixed',
      fixedCap: 2,
      pageCount: 6,
      now: clock.now,
      setTimer: clock.setTimer
    })
    const gate = defer()
    const starts: string[] = []
    const runs = [
      ...Array.from({ length: 3 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'flash'), async () => {
          starts.push(`flash-${index}`)
          await gate.promise
          await clock.advance(1)
          return index
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash-lite', 'lite'), async () => {
          starts.push(`lite-${index}`)
          await gate.promise
          await clock.advance(1)
          return index
        })
      )
    ]

    try {
      await waitFor(() => starts.length === 2)
      expect(scheduler.snapshot().lanes).toEqual([
        expect.objectContaining({
          laneKey: 'gemini:env-api-key',
          activePeak: 2,
          submittedPages: 6
        })
      ])
    } finally {
      gate.resolve()
    }

    await Promise.all(runs)
    const lane = scheduler.snapshot().lanes[0]
    expect(lane?.targets).toHaveLength(2)
    expect(lane?.completedPages).toBe(6)
    expect(lane?.targets.map((target) => target.share).sort()).toEqual([0.5, 0.5])
    expect(lane?.targets.every((target) => target.status === 'succeeded')).toBe(true)
    expect(lane?.pagesPerMinute).toEqual(expect.any(Number))
  })

  test('run-scoped document adapters share one hard provider cap across documents', async () => {
    const scheduler = createHostedOcrScheduler({
      mode: 'fixed',
      fixedCap: 2,
      pageCount: 0,
      lifetime: 'run'
    })
    const firstDocument = scheduler.createDocumentScope(4)
    const secondDocument = scheduler.createDocumentScope(6)
    const gate = defer()
    let active = 0
    let maxActive = 0
    const runPage = async (value: string): Promise<string> => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await gate.promise
      active -= 1
      return value
    }
    const runs = [
      ...Array.from({ length: 4 }, (_, index) =>
        firstDocument.run(
          admission('gemini', 'gemini-3.5-flash'),
          async () => await runPage(`a-${index}`)
        )
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        secondDocument.run(
          admission('gemini', 'gemini-3.5-flash'),
          async () => await runPage(`b-${index}`)
        )
      )
    ]

    try {
      await waitFor(() => active === 2)
      expect(maxActive).toBe(2)
      expect(scheduler.snapshot()).toMatchObject({
        lifetime: 'run',
        documentCount: 2,
        documentPages: 10,
        lanes: [{ activePeak: 2, currentCap: 2, maxCap: 2 }]
      })
    } finally {
      gate.resolve()
    }

    await Promise.all(runs)
    expect(maxActive).toBe(2)
    expect(scheduler.snapshot().lanes[0]?.targets.map((target) => target.targetKey))
      .toEqual(['gemini:gemini-3.5-flash'])
    expect(firstDocument.snapshot()).toMatchObject({
      lifetime: 'run',
      documentCount: 1,
      documentPages: 4,
      lanes: [{
        submittedPages: 4,
        completedPages: 4,
        targets: [{ completedPages: 4, share: 1 }]
      }]
    })
    expect(secondDocument.snapshot()).toMatchObject({
      lifetime: 'run',
      documentCount: 1,
      documentPages: 6,
      lanes: [{
        submittedPages: 6,
        completedPages: 6,
        targets: [{ completedPages: 6, share: 1 }]
      }]
    })
  })

  test('different hosted providers run independent lanes', async () => {
    const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 6 })
    const gate = defer()
    const starts: string[] = []
    const runs = [
      ...Array.from({ length: 3 }, (_, index) =>
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini'), async () => {
          starts.push(`gemini-${index}`)
          await gate.promise
          return index
        })
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        scheduler.run(admission('openai', 'gpt-5.4-nano', 'openai'), async () => {
          starts.push(`openai-${index}`)
          await gate.promise
          return index
        })
      )
    ]

    try {
      await waitFor(() => starts.length === 4)
      expect(scheduler.snapshot().lanes.map((lane) => [lane.service, lane.activePeak]).sort())
        .toEqual([['gemini', 2], ['openai', 2]])
    } finally {
      gate.resolve()
    }

    await Promise.all(runs)
  })
})

describe('hosted OCR fairness and partial gating contracts', () => {
  test('likely gating target includes failed partial targets by projected observed duration', async () => {
    const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 16, pageCount: 228 })
    const kimiFailure = new Error('Kimi OCR page 9 timed out after 10m')
    const results = await Promise.allSettled([
      scheduler.run(admission('kimi', 'kimi-latest', 'kimi:kimi-latest', 227), async () => {
        await sleep(5)
        return 'kimi-success-pages'
      }),
      scheduler.run(admission('kimi', 'kimi-latest', 'kimi:kimi-latest', 1), async () => {
        await sleep(30)
        throw kimiFailure
      }),
      scheduler.run(
        admission('deepinfra', 'mistral-small-ocr', 'deepinfra:mistral-small-ocr', 228),
        async () => {
          await sleep(10)
          return 'deepinfra'
        }
      )
    ])
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const snapshot = scheduler.snapshot()
    expect(snapshot.likelyGatingTarget).toMatchObject({
      service: 'kimi',
      model: 'kimi-latest',
      status: 'failed',
      submittedPages: 228,
      completedPages: 227,
      failedPages: 1
    })
    const kimiLane = snapshot.lanes.find((lane) => lane.service === 'kimi')
    const deepinfraLane = snapshot.lanes.find((lane) => lane.service === 'deepinfra')
    expect(kimiLane?.status).toBe('failed')
    expect(deepinfraLane?.status).toBe('succeeded')
    expect(kimiLane?.targets[0]?.projectedObservedDurationMs ?? 0)
      .toBeGreaterThan(deepinfraLane?.targets[0]?.projectedObservedDurationMs ?? 0)
  })

  test('Retry-After pauses only the affected lane', async () => {
    const clock = createSchedulerClock()
    const scheduler = createHostedOcrScheduler({
      mode: 'fixed',
      fixedCap: 1,
      pageCount: 2,
      now: clock.now,
      setTimer: clock.setTimer
    })
    const starts: string[] = []

    scheduler.recordRetryPressure(admission('gemini', 'gemini-3.5-flash'), {
      reason: 'retry-after',
      status: 429,
      retryAfterMs: 100
    })
    await clock.advance(25)
    scheduler.recordRetryPressure(admission('gemini', 'gemini-3.5-flash'), {
      reason: 'retry-after-extension',
      status: 429,
      retryAfterMs: 100
    })
    const geminiRun = scheduler.run(admission('gemini', 'gemini-3.5-flash'), async () => {
      starts.push('gemini')
      return 'gemini'
    })
    const openaiRun = scheduler.run(admission('openai', 'gpt-5.4-nano'), async () => {
      starts.push('openai')
      return 'openai'
    })

    await waitFor(() => starts.includes('openai'))
    expect(starts).not.toContain('gemini')
    await clock.advance(99)
    expect(starts).not.toContain('gemini')
    await clock.advance(1)
    await waitFor(() => starts.includes('gemini'))
    await Promise.all([geminiRun, openaiRun])

    const lanes = new Map(scheduler.snapshot().lanes.map((lane) => [lane.service, lane]))
    expect(lanes.get('gemini')).toMatchObject({
      retryPressureCount: 2,
      pauseTimeMs: 125
    })
    expect(lanes.get('openai')).toMatchObject({
      retryPressureCount: 0,
      pauseTimeMs: 0
    })
    expect(clock.timerCount()).toBe(0)
  })

  test('queued targets are admitted round-robin within a shared lane', async () => {
    const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 4 })
    const initialGate = defer()
    const followGate = defer()
    const starts: string[] = []
    const runs = [
      scheduler.run(admission('gemini', 'gemini-3.5-flash', 'a'), async () => {
        starts.push('a1')
        await initialGate.promise
        return 'a1'
      }),
      scheduler.run(admission('gemini', 'gemini-3.5-flash-lite', 'b'), async () => {
        starts.push('b1')
        await initialGate.promise
        return 'b1'
      })
    ]

    try {
      await waitFor(() => starts.length === 2)
      runs.push(
        scheduler.run(admission('gemini', 'gemini-3.5-flash', 'a'), async () => {
          starts.push('a2')
          await followGate.promise
          return 'a2'
        }),
        scheduler.run(admission('gemini', 'gemini-3.5-flash-lite', 'b'), async () => {
          starts.push('b2')
          await followGate.promise
          return 'b2'
        })
      )
      await sleep(5)
      expect(starts).toEqual(['a1', 'b1'])

      initialGate.resolve()
      await waitFor(() => starts.length === 4)
      expect(starts).toEqual(['a1', 'b1', 'a2', 'b2'])
    } finally {
      initialGate.resolve()
      followGate.resolve()
    }

    await Promise.all(runs)
  })

  test('repeated scheduler runs preserve deterministic admission order', async () => {
    const runScenario = async (): Promise<string[]> => {
      const scheduler = createHostedOcrScheduler({
        mode: 'fixed',
        fixedCap: 1,
        pageCount: 4
      })
      const gate = defer()
      const starts: string[] = []
      const run = (target: 'a' | 'b', sequence: number) =>
        scheduler.run(
          admission(
            'gemini',
            target === 'a'
              ? 'gemini-3.5-flash'
              : 'gemini-3.5-flash-lite',
            target
          ),
          async () => {
            starts.push(`${target}${sequence}`)
            await gate.promise
            return target
          }
        )
      const runs = [
        run('a', 1),
        run('b', 1),
        run('a', 2),
        run('b', 2)
      ]
      try {
        await waitFor(() => starts.length === 1)
      } finally {
        gate.resolve()
      }
      await Promise.all(runs)
      return starts
    }

    expect(await runScenario()).toEqual(['a1', 'b1', 'a2', 'b2'])
    expect(await runScenario()).toEqual(['a1', 'b1', 'a2', 'b2'])
    expect(await runScenario()).toEqual(['a1', 'b1', 'a2', 'b2'])
  })
})

describe('hosted OCR lane telemetry contracts', () => {
  test('run telemetry preserves every projected field', async () => {
    const clock = createSchedulerClock()
    const scheduler = createHostedOcrScheduler({
      mode: 'fixed',
      fixedCap: 2,
      pageCount: 2,
      now: clock.now,
      setTimer: clock.setTimer
    })
    await scheduler.run(
      admission('gemini', 'gemini-3.5-flash', 'flash', 2),
      async () => {
        await clock.advance(100)
        return 'ok'
      }
    )

    expect(scheduler.snapshot()).toEqual({
      version: 1,
      lifetime: 'document',
      mode: 'fixed',
      fixedCap: 2,
      documentPages: 2,
      documentCount: 1,
      lanes: [{
        lane: {
          service: 'gemini',
          scopeLabel: 'env-api-key',
          laneKey: 'gemini:env-api-key'
        },
        laneKey: 'gemini:env-api-key',
        service: 'gemini',
        scopeLabel: 'env-api-key',
        status: 'succeeded',
        mode: 'fixed',
        initialCap: 2,
        currentCap: 2,
        maxCap: 2,
        capSource: 'fixed',
        sourceConfidence: 'none',
        activePeak: 1,
        retryPressureCount: 0,
        pauseTimeMs: 0,
        submittedPages: 2,
        completedPages: 2,
        failedPages: 0,
        pagesPerMinute: 1200,
        observedDurationMs: 100,
        projectedObservedDurationMs: 100,
        targets: [{
          targetKey: 'flash',
          service: 'gemini',
          model: 'gemini-3.5-flash',
          status: 'succeeded',
          submittedPages: 2,
          completedPages: 2,
          failedPages: 0,
          share: 1,
          pagesPerMinute: 1200,
          observedDurationMs: 100,
          projectedObservedDurationMs: 100
        }]
      }],
      likelyGatingTarget: {
        laneKey: 'gemini:env-api-key',
        targetKey: 'flash',
        service: 'gemini',
        model: 'gemini-3.5-flash',
        status: 'succeeded',
        submittedPages: 2,
        completedPages: 2,
        failedPages: 0,
        share: 1,
        pagesPerMinute: 1200,
        observedDurationMs: 100,
        projectedObservedDurationMs: 100
      }
    })
  })
})
