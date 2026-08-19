import { describe, expect, test } from 'bun:test'
import {
  createHostedOcrScheduler,
  HOSTED_OCR_PROFILE_MAX_CAP_CEILING,
  resolveHostedOcrAutoMaxCap,
  resolveHostedOcrEstimateCap,
  resolveHostedOcrLaneKey
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-scheduler'
import { findHostedOcrThroughputProfile } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-throughput-profiles'
import {
  admission,
  buildThroughputProfile,
  defer,
  missingProfilePath,
  waitFor,
  withThroughputProfile
} from './hosted-ocr-scheduler/shared'

describe('hosted OCR cap and profile policy contracts', () => {
  test('auto cap formula and fixed estimate caps follow ADR bounds', () => {
    expect(resolveHostedOcrAutoMaxCap(1)).toBe(10)
    expect(resolveHostedOcrAutoMaxCap(100)).toBe(10)
    expect(resolveHostedOcrAutoMaxCap(121)).toBe(11)
    expect(resolveHostedOcrAutoMaxCap(10_000)).toBe(32)
    expect(resolveHostedOcrEstimateCap(199, 'auto')).toBe(13)
    expect(resolveHostedOcrEstimateCap(286, 'auto')).toBe(17)
    expect(resolveHostedOcrEstimateCap(1024, 'auto')).toBe(32)
    expect(resolveHostedOcrEstimateCap(1024, 'fixed', 7)).toBe(7)
    expect(resolveHostedOcrEstimateCap(1024, 'fixed', 0)).toBe(1)
    expect(resolveHostedOcrLaneKey('gemini')).toBe('gemini:env-api-key')
    const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 2, pageCount: 1 })
    expect(() => scheduler.getMaxConcurrency({
      ...admission('gemini', 'gemini-3.5-flash'),
      laneKey: 'gemini:mismatched-scope'
    })).toThrow('does not match its service and scope label')
  })

  test('large auto lanes start at the large-document estimate cap', async () => {
    const scheduler = createHostedOcrScheduler({
      mode: 'auto',
      pageCount: 286,
      profilePath: missingProfilePath()
    })
    const gate = defer()
    const starts: number[] = []
    const runs = Array.from({ length: 40 }, (_, index) =>
      scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => {
        starts.push(index)
        await gate.promise
        return index
      })
    )

    try {
      await waitFor(() => starts.length === 17)
      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        mode: 'auto',
        initialCap: 17,
        currentCap: 17,
        maxCap: 17,
        capSource: 'unprofiled',
        sourceConfidence: 'none'
      })
    } finally {
      gate.resolve()
    }

    await Promise.all(runs)
  })

  test('clean auto lanes fast-ramp until retry pressure disables fast-ramp', async () => {
    const scheduler = createHostedOcrScheduler({
      mode: 'auto',
      pageCount: 196,
      profilePath: missingProfilePath()
    })

    await Promise.all(Array.from({ length: 5 }, (_, index) =>
      scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => index)
    ))
    expect(scheduler.snapshot().lanes[0]).toMatchObject({
      initialCap: 10,
      currentCap: 12,
      retryPressureCount: 0
    })

    scheduler.recordRetryPressure(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), {
      reason: 'rate-limit',
      status: 429
    })
    expect(scheduler.snapshot().lanes[0]).toMatchObject({
      currentCap: 6,
      retryPressureCount: 1
    })

    await Promise.all(Array.from({ length: 3 }, (_, index) =>
      scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => index)
    ))
    expect(scheduler.snapshot().lanes[0]?.currentCap).toBe(6)

    await Promise.all(Array.from({ length: 3 }, (_, index) =>
      scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => index)
    ))
    expect(scheduler.snapshot().lanes[0]?.currentCap).toBe(7)
  })

  test('profile-raised caps can exceed unprofiled auto caps but fixed caps ignore profiles', async () => {
    await withThroughputProfile(buildThroughputProfile(), async (profilePath) => {
      const autoScheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 286, profilePath })
      const fixedScheduler = createHostedOcrScheduler({
        mode: 'fixed',
        fixedCap: 7,
        pageCount: 286,
        profilePath
      })

      expect(autoScheduler.getMaxConcurrency(
        admission('gemini', 'gemini-3.5-flash', 'gemini:flash')
      )).toBe(HOSTED_OCR_PROFILE_MAX_CAP_CEILING)
      expect(fixedScheduler.getMaxConcurrency(
        admission('gemini', 'gemini-3.5-flash', 'gemini:flash')
      )).toBe(7)

      await autoScheduler.run(
        admission('gemini', 'gemini-3.5-flash', 'gemini:flash'),
        async () => 'ok'
      )
      expect(autoScheduler.snapshot().lanes[0]).toMatchObject({
        initialCap: 17,
        maxCap: HOSTED_OCR_PROFILE_MAX_CAP_CEILING,
        capSource: 'profile',
        sourceConfidence: 'healthy',
        profileSampleCount: 1,
        profileRaisedMaxCap: HOSTED_OCR_PROFILE_MAX_CAP_CEILING
      })
    })
  })

  test('unpromoted throughput profiles expose why the lane cap stayed unprofiled', async () => {
    const profile = buildThroughputProfile({
      provider: 'kimi',
      model: 'kimi-k2.6',
      throughputPagesPerMinute: 50,
      activePeak: 16,
      sampleCount: 3,
      cleanSampleCount: 3,
      raisedMaxCap: 16,
      firstSeenAt: '2026-07-12T18:55:00.000Z',
      lastSeenAt: '2026-07-12T18:55:00.000Z'
    })
    await withThroughputProfile(profile, async (profilePath) => {
      const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 228, profilePath })
      await scheduler.run(admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'), async () => 'ok')

      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        capSource: 'unprofiled',
        sourceConfidence: 'healthy',
        profileSampleCount: 3,
        profileDisqualificationReason: 'profile-cap-not-above-auto-cap'
      })
    })
  })
})

describe('hosted OCR Kimi profile safeguard contracts', () => {
  test('Kimi profiles with historical retry pressure stay healthy but do not promote high caps', async () => {
    const profile = buildThroughputProfile({
      provider: 'kimi',
      model: 'kimi-k2.6',
      laneTargetCount: 1,
      throughputPagesPerMinute: 44,
      activePeak: 20,
      retryPressureCount: 1,
      pauseTimeMs: 250,
      firstSeenAt: '2026-07-12T18:55:00.000Z',
      lastSeenAt: '2026-07-12T19:21:00.000Z',
      sampleCount: 4,
      cleanSampleCount: 1,
      raisedMaxCap: 22
    })
    await withThroughputProfile(profile, async (profilePath) => {
      const estimate = findHostedOcrThroughputProfile({
        provider: 'kimi',
        model: 'kimi-k2.6',
        pageCount: 312,
        ocrConcurrencyMode: 'auto',
        laneTargetCount: 1,
        profilePath
      })
      expect(estimate?.confidence).toBe('healthy')

      const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 312, profilePath })
      await scheduler.run(admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'), async () => 'ok')
      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        maxCap: 18,
        capSource: 'unprofiled',
        sourceConfidence: 'healthy',
        profileSampleCount: 4,
        profileDisqualificationReason: 'kimi-profile-retry-pressure'
      })
    })
  })

  test('Kimi high profile caps require repeated clean samples', async () => {
    const profile = buildThroughputProfile({
      provider: 'kimi',
      model: 'kimi-k2.6',
      pageCountBand: '51-200',
      laneTargetCount: 1,
      throughputPagesPerMinute: 52,
      activePeak: 11,
      firstSeenAt: '2026-07-12T18:55:00.000Z',
      lastSeenAt: '2026-07-12T18:55:00.000Z',
      raisedMaxCap: 13
    })
    await withThroughputProfile(profile, async (profilePath) => {
      const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 121, profilePath })
      await scheduler.run(admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'), async () => 'ok')
      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        maxCap: 11,
        capSource: 'unprofiled',
        sourceConfidence: 'healthy',
        profileSampleCount: 1,
        profileDisqualificationReason: 'kimi-profile-needs-clean-samples'
      })
    })
  })

  test('Kimi current retry pressure demotes profile caps and records page-level timeout telemetry', async () => {
    const profile = buildThroughputProfile({
      provider: 'kimi',
      model: 'kimi-k2.6',
      laneTargetCount: 1,
      throughputPagesPerMinute: 54,
      activePeak: 20,
      firstSeenAt: '2026-07-12T18:55:00.000Z',
      lastSeenAt: '2026-07-12T18:55:00.000Z',
      sampleCount: 3,
      cleanSampleCount: 3,
      raisedMaxCap: 22
    })
    await withThroughputProfile(profile, async (profilePath) => {
      const scheduler = createHostedOcrScheduler({ mode: 'auto', pageCount: 312, profilePath })
      await scheduler.run({
        ...admission('kimi', 'kimi-k2.6', 'kimi:kimi-k2.6'),
        pageNumber: 9
      }, async ({ onRetryable }) => {
        onRetryable({ reason: 'timeout', delayMs: 125 })
        return 'ok'
      })

      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        maxCap: 18,
        capSource: 'unprofiled',
        profileDisqualificationReason: 'kimi-current-retry-pressure',
        retryPressureCount: 1,
        retryEvents: [{
          reason: 'timeout',
          targetKey: 'kimi:kimi-k2.6',
          pageNumber: 9,
          delayMs: 125,
          effectiveCap: 9
        }]
      })
    })
  })
})

describe('hosted OCR fixed cap policy contracts', () => {
  test('explicit fixed caps are hard lane maxima while retry pressure can back off below them', async () => {
    const scheduler = createHostedOcrScheduler({ mode: 'fixed', fixedCap: 4, pageCount: 50 })
    const gate = defer()
    const starts: number[] = []

    scheduler.recordRetryPressure(admission('gemini', 'gemini-3.5-flash'), {
      reason: 'rate-limit',
      status: 429
    })
    const runs = Array.from({ length: 8 }, (_, index) =>
      scheduler.run(admission('gemini', 'gemini-3.5-flash', 'gemini:flash'), async () => {
        starts.push(index)
        await gate.promise
        return index
      })
    )

    try {
      await waitFor(() => starts.length === 2)
      expect(scheduler.snapshot().lanes[0]).toMatchObject({
        mode: 'fixed',
        initialCap: 4,
        currentCap: 2,
        maxCap: 4,
        activePeak: 2,
        retryPressureCount: 1
      })
    } finally {
      gate.resolve()
    }

    await Promise.all(runs)
    const lane = scheduler.snapshot().lanes[0]
    expect(lane?.maxCap).toBe(4)
    expect(lane?.activePeak ?? 0).toBeLessThanOrEqual(4)
    expect(lane?.status).toBe('succeeded')
  })

  test('retry telemetry retains only the latest fifty events', () => {
    const scheduler = createHostedOcrScheduler({
      mode: 'fixed',
      fixedCap: 32,
      pageCount: 1
    })
    const target = admission(
      'gemini',
      'gemini-3.5-flash',
      'gemini:flash'
    )
    for (let index = 0; index < 55; index += 1) {
      scheduler.recordRetryPressure(target, {
        reason: `retry-${index}`,
        status: 429
      })
    }

    const lane = scheduler.snapshot().lanes[0]
    expect(lane?.retryPressureCount).toBe(55)
    expect(lane?.retryEvents).toHaveLength(50)
    expect(lane?.retryEvents?.[0]?.reason).toBe('retry-5')
    expect(lane?.retryEvents?.at(-1)?.reason).toBe('retry-54')
  })
})
