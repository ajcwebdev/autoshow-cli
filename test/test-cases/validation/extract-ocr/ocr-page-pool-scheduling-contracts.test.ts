import { describe,expect,test } from 'bun:test'
import { getOcrPoolAttemptRelativeDir,preflightPooledPageInputs } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch'
import { defaultOcrPoolLaneKey,runOcrPagePool } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import type { OcrPoolLedger,OcrTarget } from '~/types'
import { extractErrorMetadata,ProviderError } from '~/utils/error-handler'

const pageResult = (pageNumber: number, target: OcrTarget) => ({
  result: {
    pageNumber,
    method: 'ocr' as const,
    text: `${target.service}/${target.model}: page ${pageNumber}`
  },
  effectiveReasoningEffort: 'default'
})

const runPool = async (overrides: Partial<Parameters<typeof runOcrPagePool>[0]> = {}) => {
  const targets: OcrTarget[] = [
    { service: 'openai', model: 'gpt-5.6-sol' },
    { service: 'mistral', model: 'mistral-ocr-4-0' }
  ]
  let clock = 1_000
  return await runOcrPagePool({
    totalPages: 4,
    requestedTargets: targets,
    targetsToRun: targets,
    providerConcurrency: 2,
    localConcurrency: 1,
    getLaneKey: defaultOcrPoolLaneKey,
    getTargetConcurrency: () => 2,
    getAttemptArtifactDir: getOcrPoolAttemptRelativeDir,
    processPage: async ({ pageNumber, target }) => pageResult(pageNumber, target),
    classifyFailure: (error) => ({
      scope: 'page',
      ambiguous: false,
      failure: { message: error instanceof Error ? error.message : String(error) }
    }),
    now: () => clock++,
    createClaimId: (() => {
      let id = 0
      return () => `claim-${++id}`
    })(),
    ...overrides
  })
}

describe('pooled OCR page scheduler contracts', () => {

  test('prepares pooled page inputs with a bounded parallel preflight', async () => {
    let active = 0
    let maxActive = 0
    const prepared: number[] = []
    await preflightPooledPageInputs({
      totalPages: 12,
      preparePage: async (pageNumber) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await Bun.sleep(2)
        prepared.push(pageNumber)
        active -= 1
        return { path: `/virtual/page-${pageNumber}.png`, metadata: { slug: 'test', format: 'png', pageCount: 1, fileSize: 1 } }
      }
    }, 4)

    expect(maxActive).toBe(4)
    expect(prepared.sort((left, right) => left - right)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1))
  })

  test('uses one shared queue, preserves page order, and shares same-account lane caps', async () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.6-sol' },
      { service: 'openai', model: 'gpt-5.4-mini' },
      { service: 'gemini', model: 'gemini-3.6-flash' },
      { service: 'tesseract', model: 'tesseract' }
    ]
    const activeByLane = new Map<string, number>()
    const peakByLane = new Map<string, number>()
    const activeHostedTargets = new Map<string, number>()
    let hostedTargetPeak = 0
    const completionOrder: number[] = []
    const checkpoints: OcrPoolLedger[] = []

    const ledger = await runPool({
      totalPages: 16,
      requestedTargets: targets,
      targetsToRun: targets,
      providerConcurrency: 2,
      localConcurrency: 1,
      getTargetConcurrency: (target) => target.service === 'tesseract' ? 1 : 2,
      processPage: async ({ pageNumber, target }) => {
        const lane = defaultOcrPoolLaneKey(target)
        const targetKey = `${target.service}:${target.model}`
        activeByLane.set(lane, (activeByLane.get(lane) ?? 0) + 1)
        peakByLane.set(lane, Math.max(peakByLane.get(lane) ?? 0, activeByLane.get(lane) ?? 0))
        if (target.service !== 'tesseract') {
          activeHostedTargets.set(targetKey, (activeHostedTargets.get(targetKey) ?? 0) + 1)
          hostedTargetPeak = Math.max(hostedTargetPeak, [...activeHostedTargets.values()].filter((value) => value > 0).length)
        }
        await Bun.sleep(target.service === 'gemini' ? 1 : target.service === 'tesseract' ? 2 : 4)
        completionOrder.push(pageNumber)
        activeByLane.set(lane, (activeByLane.get(lane) ?? 1) - 1)
        if (target.service !== 'tesseract') activeHostedTargets.set(targetKey, (activeHostedTargets.get(targetKey) ?? 1) - 1)
        return pageResult(pageNumber, target)
      },
      onCheckpoint: async (checkpoint) => {
        checkpoints.push(checkpoint)
      }
    })

    expect(ledger.status).toBe('full')
    expect(ledger.pages.map((page) => page.pageNumber)).toEqual(Array.from({ length: 16 }, (_, index) => index + 1))
    expect(ledger.pages.every((page) => page.status === 'accepted' && page.attempts.filter((attempt) => attempt.status === 'accepted').length === 1)).toBe(true)
    expect(new Set(ledger.pages.map((page) => page.accepted?.result.pageNumber)).size).toBe(16)
    expect(peakByLane.get('openai:env-api-key')).toBeLessThanOrEqual(2)
    expect(peakByLane.get('local:tesseract')).toBeLessThanOrEqual(1)
    expect(hostedTargetPeak).toBeLessThanOrEqual(2)
    expect(completionOrder).not.toEqual([...completionOrder].sort((left, right) => left - right))
    expect(checkpoints.some((checkpoint) => checkpoint.pages.some((page) => page.status === 'claimed'))).toBe(true)
    expect(ledger.telemetry.queueDepth).toBe(0)
    expect(ledger.telemetry.acceptedPages).toBe(16)
    expect(Object.values(ledger.telemetry.targetPageShare).reduce((sum, share) => sum + share, 0)).toBeCloseTo(1)
  })

  test('hands a transient or ambiguous failure to another eligible target and records paid attempts', async () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.6-sol' },
      { service: 'mistral', model: 'mistral-ocr-4-0' }
    ]
    const ledger = await runPool({
      totalPages: 1,
      requestedTargets: targets,
      targetsToRun: targets,
      processPage: async ({ pageNumber, target }) => {
        if (target.service === 'openai') throw Object.assign(ProviderError('uncertain network result'), { ambiguous: true })
        return {
          ...pageResult(pageNumber, target),
          requestedReasoningEffort: 'high',
          effectiveReasoningEffort: 'medium',
          promptTokens: 20,
          completionTokens: 5,
          providerCostCents: 1.25
        }
      },
      classifyFailure: (error, target) => ({
        scope: 'page',
        ambiguous: extractErrorMetadata(error)['ambiguous'] === true,
        failure: { message: String(error), service: target.service },
        providerCostCents: 2.5,
        effectiveReasoningEffort: 'default'
      })
    })

    expect(ledger.status).toBe('full')
    expect(ledger.pages[0]?.attempts.map((attempt) => attempt.status)).toEqual(['ambiguous', 'accepted'])
    expect(ledger.pages[0]?.attempts[0]).toMatchObject({ provider: 'openai', providerCostCents: 2.5 })
    expect(ledger.pages[0]?.accepted?.provider).toBe('mistral')
    expect(ledger.pages[0]?.accepted).toMatchObject({
      requestedReasoningEffort: 'high',
      effectiveReasoningEffort: 'medium',
      promptTokens: 20,
      completionTokens: 5,
      providerCostCents: 1.25
    })
    expect(ledger.pages[0]?.accepted?.durationMs).toBeGreaterThanOrEqual(0)
    expect(ledger.telemetry.requeues).toBe(1)
    expect(ledger.telemetry.handoffs).toBe(1)
    expect(ledger.telemetry.ambiguousAttempts).toBe(1)
  })

  test('retires target and account lanes without discarding accepted pages', async () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.6-sol' },
      { service: 'openai', model: 'gpt-5.4-mini' },
      { service: 'mistral', model: 'mistral-ocr-4-0' }
    ]
    const ledger = await runPool({
      totalPages: 5,
      requestedTargets: targets,
      targetsToRun: targets,
      providerConcurrency: 3,
      processPage: async ({ pageNumber, target }) => {
        if (target.service === 'openai' && target.model === 'gpt-5.6-sol') {
          throw Object.assign(ProviderError('account blocked'), { laneWide: true })
        }
        await Bun.sleep(target.service === 'mistral' ? 1 : 3)
        return {
          ...pageResult(pageNumber, target),
          ...(target.service === 'openai' ? { providerCostCents: 0.75 } : {})
        }
      },
      classifyFailure: (error) => ({
        scope: extractErrorMetadata(error)['laneWide'] ? 'lane' : 'target',
        ambiguous: false,
        failure: { message: String(error) }
      })
    })

    expect(ledger.status).toBe('full')
    expect(ledger.lanes.find((lane) => lane.service === 'openai')?.status).toBe('retired')
    expect(ledger.targets.filter((target) => target.service === 'openai').every((target) => target.status === 'retired')).toBe(true)
    expect(ledger.telemetry.retiredLanes).toContain('openai:env-api-key')
    expect(ledger.pages.every((page) => page.accepted !== undefined)).toBe(true)
    expect(ledger.telemetry.duplicateCommitsPrevented).toBeGreaterThan(0)
    expect(ledger.pages.flatMap((page) => page.attempts).some((attempt) =>
      attempt.provider === 'openai'
      && attempt.model === 'gpt-5.4-mini'
      && attempt.status === 'interrupted'
      && attempt.providerCostCents === 0.75
    )).toBe(true)
  })
})
