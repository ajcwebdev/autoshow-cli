import { describe,expect,test } from 'bun:test'
import { claimOcrPoolPage,commitAcceptedOcrPoolResult,createOcrPoolState,finalizeOcrPoolLedger,markOcrPoolTerminalPages,recordOcrPoolClaimFailure,reenableOcrPoolTarget,rejectStaleOcrPoolResult,retireOcrPoolLane,retireOcrPoolTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-page-pool-state'
import { assertOcrPoolCompatible,getOcrPoolAttemptRelativeDir } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch'
import { defaultOcrPoolLaneKey } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import type { OcrTarget } from '~/types'

const pageResult = (pageNumber: number, target: OcrTarget) => ({
  result: {
    pageNumber,
    method: 'ocr' as const,
    text: `${target.service}/${target.model}: page ${pageNumber}`
  },
  effectiveReasoningEffort: 'default'
})

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
})
