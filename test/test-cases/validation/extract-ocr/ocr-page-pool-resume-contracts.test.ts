import { describe,expect,test } from 'bun:test'
import { getOcrPoolAttemptRelativeDir } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch'
import { defaultOcrPoolLaneKey,runOcrPagePool } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-provider-pool'
import type { OcrPoolLedger,OcrTarget } from '~/types'

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
})
