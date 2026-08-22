import { describe, expect, test } from 'bun:test'
import { extractErrorMetadata, ProviderError } from '~/utils/error-handler'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defaultOcrPoolLaneKey, runOcrPagePool } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import { claimOcrPoolPage, commitAcceptedOcrPoolResult, createOcrPoolState, finalizeOcrPoolLedger, markOcrPoolTerminalPages, recordOcrPoolClaimFailure, reenableOcrPoolTarget, rejectStaleOcrPoolResult, retireOcrPoolLane, retireOcrPoolTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-page-pool-state'
import { assertOcrPoolCompatible, getOcrPoolAttemptRelativeDir } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch'
import { createPipelineItemFromRecord, derivePipelineItemRecord, PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { priceOcrTarget } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import type { OcrPoolLedger, OcrTarget, ResumeTarget } from '~/types'

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

const transitionState = (targets: OcrTarget[], totalPages = 2) => {
  let clock = 2_000
  let claimId = 0
  return createOcrPoolState({
    totalPages,
    requestedTargets: targets,
    targetsToRun: targets,
    providerConcurrency: targets.length,
    localConcurrency: 1,
    getLaneKey: defaultOcrPoolLaneKey,
    getTargetConcurrency: () => 2,
    getAttemptArtifactDir: getOcrPoolAttemptRelativeDir,
    processPage: async ({ pageNumber, target }) => pageResult(pageNumber, target),
    classifyFailure: () => ({ scope: 'page', ambiguous: false, failure: { message: 'unused' } }),
    now: () => clock++,
    createClaimId: () => `transition-claim-${++claimId}`
  })
}

describe('pooled OCR page scheduler contracts', () => {
  test('rejects incompatible normalized inputs and primary selection locally', () => {
    const target: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
    expect(() => assertOcrPoolCompatible({
      step1Metadata: { format: 'docx' },
      opts: {},
      requestedTargets: [target]
    })).toThrow('requires a PDF or supported image input')
    expect(() => assertOcrPoolCompatible({
      step1Metadata: { format: 'pdf' },
      opts: { primaryOcr: 'openai' },
      requestedTargets: [target]
    })).toThrow('--primary-ocr cannot be used')
    expect(() => assertOcrPoolCompatible({
      step1Metadata: { format: 'pdf' },
      opts: {},
      requestedTargets: []
    })).toThrow('requires at least one selected OCR target')
  })

  test('claim, target retirement, stale rejection, and accepted commit are explicit transitions', () => {
    const retired: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
    const survivor: OcrTarget = { service: 'mistral', model: 'mistral-ocr-4-0' }
    const state = transitionState([retired, survivor])
    const admitted = new Set(['openai:gpt-5.6-sol'])
    const firstRetiredClaim = claimOcrPoolPage(state, retired, admitted)
    const secondRetiredClaim = claimOcrPoolPage(state, retired, admitted)
    expect(firstRetiredClaim).toBeDefined()
    expect(secondRetiredClaim).toBeDefined()

    const retirement = { scope: 'target' as const, ambiguous: false, failure: { message: 'target unavailable' } }
    retireOcrPoolTarget(state, 'openai:gpt-5.6-sol', retirement, 2_010)
    admitted.add('mistral:mistral-ocr-4-0')
    const firstSurvivorClaim = claimOcrPoolPage(state, survivor, admitted)
    expect(firstSurvivorClaim).toBeDefined()
    commitAcceptedOcrPoolResult(state, firstSurvivorClaim!, pageResult(1, survivor), 2_020)
    rejectStaleOcrPoolResult(state, firstRetiredClaim!, pageResult(1, retired), 2_021)
    rejectStaleOcrPoolResult(state, secondRetiredClaim!, pageResult(2, retired), 2_022)
    const secondSurvivorClaim = claimOcrPoolPage(state, survivor, admitted)
    expect(secondSurvivorClaim).toBeDefined()
    commitAcceptedOcrPoolResult(state, secondSurvivorClaim!, pageResult(2, survivor), 2_030)

    expect(state.ledger.pages.every((page) =>
      page.status === 'accepted' && page.attempts.filter((attempt) => attempt.status === 'accepted').length === 1
    )).toBe(true)
    expect(state.ledger.telemetry.duplicateCommitsPrevented).toBe(2)
    expect(state.targetStates.get('openai:gpt-5.6-sol')?.status).toBe('retired')
  })

  test('lane retirement and selective re-enablement do not revive sibling targets', () => {
    const selected: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
    const sibling: OcrTarget = { service: 'openai', model: 'gpt-5.4-mini' }
    const state = transitionState([selected, sibling])
    const admitted = new Set(state.targetStates.keys())
    const selectedClaim = claimOcrPoolPage(state, selected, admitted)
    const siblingClaim = claimOcrPoolPage(state, sibling, admitted)
    expect(selectedClaim).toBeDefined()
    expect(siblingClaim).toBeDefined()

    const retirement = { scope: 'lane' as const, ambiguous: false, failure: { message: 'account unavailable' } }
    retireOcrPoolLane(state, 'openai:env-api-key', retirement, 2_010)
    rejectStaleOcrPoolResult(state, selectedClaim!, pageResult(1, selected), 2_011)
    recordOcrPoolClaimFailure(state, siblingClaim!, {
      scope: 'page',
      ambiguous: false,
      failure: { message: 'interrupted request also failed' }
    }, 2_012)
    expect(reenableOcrPoolTarget(state, 'openai:gpt-5.6-sol')).toBe(true)

    expect(state.laneStates.get('openai:env-api-key')?.status).toBe('eligible')
    expect(state.targetStates.get('openai:gpt-5.6-sol')?.status).toBe('eligible')
    expect(state.targetStates.get('openai:gpt-5.4-mini')?.status).toBe('retired')
    expect(claimOcrPoolPage(state, selected, admitted)).toBeDefined()
    expect(claimOcrPoolPage(state, sibling, admitted)).toBeUndefined()
  })

  test('failure terminal marking and final projection preserve throughput and purity', () => {
    const acceptedTarget: OcrTarget = { service: 'mistral', model: 'mistral-ocr-4-0' }
    const state = transitionState([acceptedTarget])
    const admitted = new Set(state.targetStates.keys())
    const acceptedClaim = claimOcrPoolPage(state, acceptedTarget, admitted)
    const failedClaim = claimOcrPoolPage(state, acceptedTarget, admitted)
    expect(acceptedClaim).toBeDefined()
    expect(failedClaim).toBeDefined()
    commitAcceptedOcrPoolResult(state, acceptedClaim!, pageResult(1, acceptedTarget), 62_000)
    recordOcrPoolClaimFailure(state, failedClaim!, {
      scope: 'page',
      ambiguous: false,
      failure: { message: 'page rejected' }
    }, 62_001)
    markOcrPoolTerminalPages(state)
    const before = structuredClone(state.ledger)
    const finalized = finalizeOcrPoolLedger(state)

    expect(state.ledger).toEqual(before)
    expect(finalized.status).toBe('incomplete')
    expect(finalized.pages[1]?.status).toBe('exhausted')
    expect(finalized.telemetry.targetThroughputPagesPerMinute['mistral:mistral-ocr-4-0']).toBeCloseTo(1)
    expect(finalized.telemetry.gatingTarget).toBe('mistral:mistral-ocr-4-0')
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

  test('bounds page attempts, marks exhaustion, and resumes only unfinished claims', async () => {
    const failed = await runPool({
      totalPages: 2,
      processPage: async () => { throw new Error('page rejected') }
    })

    expect(failed.status).toBe('incomplete')
    expect(failed.pages.every((page) => page.status === 'exhausted' && page.attempts.length === 2)).toBe(true)
    expect(failed.telemetry.exhaustedPages).toBe(2)

    const restored = structuredClone(failed)
    const acceptedPage = restored.pages[0]!
    acceptedPage.status = 'accepted'
    acceptedPage.accepted = {
      provider: 'openai',
      model: 'gpt-5.6-sol',
      attempt: acceptedPage.attempts.length,
      acceptedAtMs: 1,
      durationMs: 1,
      artifactDir: 'providers/openai/attempts/page-000001/attempt-002',
      result: { pageNumber: 1, method: 'ocr', text: 'preserved' }
    }
    const interruptedPage = restored.pages[1]!
    interruptedPage.status = 'claimed'
    interruptedPage.claim = { claimId: 'stale', targetKey: 'openai:gpt-5.6-sol', laneKey: 'openai:env-api-key', attempt: 3, claimedAtMs: 2 }
    interruptedPage.attempts.push({
      attempt: 3,
      claimId: 'stale',
      provider: 'openai',
      model: 'gpt-5.6-sol',
      laneKey: 'openai:env-api-key',
      status: 'running',
      startedAtMs: 2,
      artifactDir: 'providers/openai/attempts/page-000002/attempt-003'
    })
    const additive: OcrTarget = { service: 'gemini', model: 'gemini-3.6-flash' }
    const resumed = await runPool({
      totalPages: 2,
      requestedTargets: [...failed.targets.map(({ service, model }) => ({ service, model })), additive],
      targetsToRun: [additive],
      restoredLedger: restored,
      processPage: async ({ pageNumber, target }) => pageResult(pageNumber, target)
    })

    expect(resumed.status).toBe('full')
    expect(resumed.pages[0]?.accepted?.result.text).toBe('preserved')
    expect(resumed.pages[0]?.attempts).toHaveLength(2)
    expect(resumed.pages[1]?.attempts.find((attempt) => attempt.claimId === 'stale')?.status).toBe('interrupted')
    expect(resumed.pages[1]?.accepted?.provider).toBe('gemini')
  })

  test('explicit re-enablement permits a retired target to retry without changing accepted pages', async () => {
    const target: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
    const failed = await runPool({
      totalPages: 1,
      requestedTargets: [target],
      targetsToRun: [target],
      processPage: async () => { throw new Error('blocked') },
      classifyFailure: () => ({ scope: 'target', ambiguous: false, failure: { message: 'blocked' } })
    })
    const resumed = await runPool({
      totalPages: 1,
      requestedTargets: [target],
      targetsToRun: [target],
      reenabledTargets: [target],
      restoredLedger: failed,
      processPage: async ({ pageNumber }) => pageResult(pageNumber, target)
    })

    expect(resumed.status).toBe('full')
    expect(resumed.pages[0]?.attempts).toHaveLength(2)
    expect(resumed.pages[0]?.accepted?.provider).toBe('openai')
    expect(resumed.targets[0]?.status).toBe('succeeded')
  })

  test('re-enabling one target does not revive a separately retired sibling on the same lane', async () => {
    const selected: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
    const sibling: OcrTarget = { service: 'openai', model: 'gpt-5.4-mini' }
    const failed = await runPool({
      totalPages: 2,
      requestedTargets: [selected, sibling],
      targetsToRun: [selected, sibling],
      getTargetConcurrency: () => 1,
      processPage: async () => { throw new Error('target blocked') },
      classifyFailure: () => ({ scope: 'target', ambiguous: false, failure: { message: 'target blocked' } })
    })
    expect(failed.targets.every((target) => target.status === 'retired')).toBe(true)

    const resumed = await runPool({
      totalPages: 2,
      requestedTargets: [selected, sibling],
      targetsToRun: [selected],
      reenabledTargets: [selected],
      restoredLedger: failed,
      processPage: async ({ pageNumber }) => pageResult(pageNumber, selected)
    })

    expect(resumed.status).toBe('full')
    expect(resumed.targets.find((target) => target.model === selected.model)?.status).toBe('succeeded')
    expect(resumed.targets.find((target) => target.model === sibling.model)?.status).toBe('retired')
  })

  test('a checkpointed in-flight claim resumes on the same still-eligible target', async () => {
    const target: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
    let crashCheckpoint: OcrPoolLedger | undefined
    await expect(runPool({
      totalPages: 1,
      requestedTargets: [target],
      targetsToRun: [target],
      onCheckpoint: async (checkpoint) => {
        if (checkpoint.pages[0]?.status === 'claimed') {
          crashCheckpoint = checkpoint
          throw new Error('simulated process interruption')
        }
      }
    })).rejects.toThrow('simulated process interruption')
    expect(crashCheckpoint?.pages[0]?.attempts[0]?.status).toBe('running')

    const resumed = await runPool({
      totalPages: 1,
      requestedTargets: [target],
      targetsToRun: [target],
      restoredLedger: crashCheckpoint
    })

    expect(resumed.status).toBe('full')
    expect(resumed.pages[0]?.attempts.map((attempt) => attempt.status)).toEqual(['interrupted', 'accepted'])
    expect(resumed.telemetry.interruptedClaimsRecovered).toBe(1)
  })

  test('does not turn an accepted-page checkpoint failure into a provider retry', async () => {
    const target: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
    const persisted: OcrPoolLedger[] = []
    let providerCalls = 0
    let classifiedFailures = 0

    await expect(runPool({
      totalPages: 1,
      requestedTargets: [target],
      targetsToRun: [target],
      processPage: async ({ pageNumber }) => {
        providerCalls += 1
        return pageResult(pageNumber, target)
      },
      classifyFailure: () => {
        classifiedFailures += 1
        return { scope: 'page', ambiguous: false, failure: { message: 'provider failure' } }
      },
      onCheckpoint: async (checkpoint) => {
        if (checkpoint.pages[0]?.status === 'accepted') throw new Error('atomic checkpoint unavailable')
        persisted.push(checkpoint)
      }
    })).rejects.toThrow('atomic checkpoint unavailable')

    expect(providerCalls).toBe(1)
    expect(classifiedFailures).toBe(0)
    expect(persisted.at(-1)?.pages[0]?.status).toBe('claimed')
  })

  test('attempt artifact paths are isolated and path-contained', () => {
    const path = getOcrPoolAttemptRelativeDir(7, { service: 'deepinfra', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' }, 3)
    expect(path).toBe('providers/deepinfra-Qwen-Qwen3-VL-30B-A3B-Instruct/attempts/page-000007/attempt-003')
    expect(path.startsWith('/')).toBe(false)
    expect(path.split('/')).not.toContain('..')
  })

  test('the canonical manifest item retains the composite output and page ledger as the only resume authority', async () => {
    const ledger = await runPool({ totalPages: 1 })
    const root = '/tmp/autoshow-pool-manifest-contract'
    const record = {
      completionStatus: 'full',
      ocrProviderMode: 'pool',
      ocrPool: ledger,
      step2: { extractionMethod: 'ocr-pool', totalPages: 1 },
      requestedProviders: ledger.targets.map(({ service, model }) => ({ service, model })),
      providerStates: ledger.targets.map(({ service, model, attempts }) => ({
        service,
        model,
        artifactDir: `providers/${service}-${model}`,
        status: 'succeeded',
        attempts,
        metadata: {}
      }))
    }
    const item = createPipelineItemFromRecord(root, record, {
      outputDir: root,
      input: 'document.pdf',
      inputFamily: 'document',
      extractRoute: 'document'
    })
    const restored = derivePipelineItemRecord(root, item)

    expect(restored['ocrProviderMode']).toBe('pool')
    expect(restored['ocrPool']).toEqual(ledger)
    expect(restored['step2']).toEqual(record.step2)
    expect((restored['ocrPool'] as OcrPoolLedger).pages[0]?.accepted?.result.text).toContain('page 1')
  })

  test('pooled resume price preserves stored mode, estimates only unfinished pages, and does not mutate the manifest', async () => {
    await withTempDir('autoshow-pool-resume-price-', async (dir) => {
      const target: OcrTarget = { service: 'openai', model: 'gpt-5.6-sol' }
      let checkpoint: OcrPoolLedger | undefined
      await runPool({
        totalPages: 1,
        requestedTargets: [target],
        targetsToRun: [target],
        onCheckpoint: async (ledger) => {
          if (ledger.pages[0]?.status === 'claimed') {
            checkpoint = ledger
            throw new Error('capture interrupted claim')
          }
        }
      }).catch(() => undefined)
      expect(checkpoint).toBeDefined()
      await writeSingleManifestFixture(dir, 'extract', {
        source: { filePath: join(process.cwd(), 'input/examples/document/3-document.pdf') },
        completionStatus: 'incomplete',
        ocrProviderMode: 'pool',
        ocrPool: checkpoint,
        requestedProviders: [target],
        providerStates: [{ ...target, artifactDir: 'providers/openai-gpt-5.6-sol', status: 'running', attempts: 1, metadata: {} }]
      }, { extractRoute: 'document' })
      const resumeTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'single',
        dir,
        manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
      }
      const manifestPath = join(dir, PIPELINE_MANIFEST_FILE)
      const before = await readFile(manifestPath)
      const estimate = await priceOcrTarget(resumeTarget, buildOptsFromFlags({}))
      const after = await readFile(manifestPath)

      expect(estimate.steps).toHaveLength(1)
      expect(estimate.steps[0]).toMatchObject({ provider: 'openai', model: 'gpt-5.6-sol', pageCount: 1, ocrProviderMode: 'pool' })
      expect(after.equals(before)).toBe(true)

      const explicitFanout = buildOptsFromFlags({ 'ocr-provider-mode': 'fanout' }, {}, new Set(['ocr-provider-mode']))
      await expect(priceOcrTarget(resumeTarget, explicitFanout)).rejects.toThrow('Cannot resume a pool OCR run as fanout')
      expect((await readFile(manifestPath)).equals(before)).toBe(true)
    })
  })
})
