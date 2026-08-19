import { expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createCurrentTtsRenderAttempt, planCurrentTtsResumePrice } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import type { PipelineProviderState } from '~/types'
import { withTempDir } from '../../../../test-utils/temp-dirs'
import {
  crashAfterPromotedResult,
  createAuthorizedRetryFixtureTarget,
  createDialogueFixtureTarget,
  createFixtureTarget,
  DIALOGUE_OPTIONS,
  latestJournalForState,
  syntheticRecoveryAudio
} from './shared'

const authorizedRetryScenario = async (dir: string): Promise<void> => {
  const text = 'Recover within this run.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, new Date(0).toISOString())
  const attempts: number[] = []
  await runTtsForTargets(text, dir, { ttsAllowAmbiguousRedispatch: true }, [createAuthorizedRetryFixtureTarget(attempts)], { sourceIdentity, dialoguePlan })
  expect(attempts).toEqual([1, 2, 3])
  const resultPath = (await readdir(dir, { recursive: true })).find((name) => name.endsWith('/provider-batch-result.json'))
  if (!resultPath) throw new Error('Missing authorized retry batch result')
  const result = await Bun.file(join(dir, resultPath)).json()
  expect(result.status).toBe('succeeded')
  expect(result.observedRequests).toHaveLength(3)
  expect(result.retryAttempts).toEqual([
    expect.objectContaining({ requestOrdinal: 2, retryOfRequestOrdinal: 1, reasonCode: 'retryable status 500' }),
    expect.objectContaining({ requestOrdinal: 3, retryOfRequestOrdinal: 2, reasonCode: 'retryable status 500' })
  ])
}

const completeInterruptedTurn = async (
  dir: string,
  attempt: Awaited<ReturnType<typeof createCurrentTtsRenderAttempt>>
): Promise<void> => {
  const evidence = attempt.requestEvidence.forInvocation?.({
    sourceId: 'dialogue-turn-001',
    sourceIndex: 0,
    speaker: 'Host',
    voice: { kind: 'id', value: 'alloy' },
    controls: {}
  })
  if (!evidence) throw new Error('Missing invocation-scoped TTS evidence')
  const audioPath = join(dir, 'interrupted-provider-response.wav')
  const bytes = syntheticRecoveryAudio(0, 0.15)
  await evidence.dispatch({
    chunkIndex: 1,
    endpointKind: 'speech-synthesis',
    serializerVersion: 'openai.tts.phase-0-v1',
    serializedRequest: { body: { input: 'Recover retained audio.', voice: 'alloy', response_format: 'wav' } },
    providerText: 'Recover retained audio.',
    voiceField: 'voice',
    voices: [{ kind: 'provider-id', value: 'alloy' }],
    requestControls: { responseFormat: 'wav' },
    continuation: { kind: 'none' }
  }, { attempt: 1 }, async ({ accepted }) => {
    await accepted({ providerRequestId: 'interrupted-promotion-fixture' })
    await Bun.write(audioPath, bytes)
  })
  await evidence.recordOutput({ chunkIndex: 1, path: audioPath })
  await expect(evidence.complete({ chunkIndex: 1 })).rejects.toThrow('fixture termination before batch-result promotion')
}

const interruptedPromotionScenario = async (dir: string): Promise<void> => {
  const text = 'Host: Recover retained audio.\nGuest: Generate only this unresolved turn.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, DIALOGUE_OPTIONS, new Date(0).toISOString())
  const target = createDialogueFixtureTarget([])
  let retained: PipelineProviderState | undefined
  const attempt = await createCurrentTtsRenderAttempt({
    outputDir: dir,
    target,
    sourceText: text,
    ttsOptions: DIALOGUE_OPTIONS,
    sourceIdentity,
    dialoguePlan,
    onProviderState: async (state) => {
      const journal = await latestJournalForState(dir, state)
      if (journal?.requests[0]?.transitions.at(-1)?.state === 'completed' && journal.recordedBatchResults.length === 0) {
        retained = state
        throw new Error('fixture termination before batch-result promotion')
      }
    }
  })
  await completeInterruptedTurn(dir, attempt)
  if (!retained) throw new Error('Missing interrupted completion state')
  expect((await latestJournalForState(dir, retained))?.recordedBatchResults).toEqual([])
  const price = await planCurrentTtsResumePrice({ rootDir: dir, state: retained, target, sourceText: text, ttsOptions: DIALOGUE_OPTIONS, sourceIdentity, dialoguePlan })
  expect(price).toMatchObject({ recoveryKind: 'partial-slots', recoveredSlotCount: 1, unresolvedSlotCount: 1, plannedSlotCount: 1 })

  const reportedOutput = join(dir, 'interrupted-promotion-recovered.wav')
  const resumedCalls: number[] = []
  const recovered = await runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(resumedCalls)], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [retained],
    recoveryRootDir: dir,
    resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'interrupted-promotion-recovered.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })
  expect(resumedCalls).toEqual([1])
  expect(await Bun.file(reportedOutput).exists()).toBe(true)
  expect(recovered.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('succeeded')
  expect((await readdir(dir, { recursive: true })).filter((name) => name.endsWith('/provider-batch-result.json'))).toHaveLength(2)
  const priceAfter = await planCurrentTtsResumePrice({ rootDir: dir, state: retained, target, sourceText: text, ttsOptions: DIALOGUE_OPTIONS, sourceIdentity, dialoguePlan })
  expect(priceAfter).toMatchObject({ recoveryKind: 'partial-slots', plannedSlotCount: 1 })
}

const promotedResultScenario = async (dir: string): Promise<void> => {
  const text = 'Recover this completed provider result.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, new Date(0).toISOString())
  let providerCalls = 0
  const target = createFixtureTarget(() => { providerCalls += 1 }, 'success')
  const first = await runTtsForTargets(text, dir, {}, [target], { sourceIdentity, dialoguePlan })
  const crashedState = crashAfterPromotedResult(buildCurrentTtsProviderState(first.metadata[0]!))
  const callsBeforeRecovery = providerCalls
  const recoveredPath = join(dir, 'speech-recovered.wav')
  const observedStates: PipelineProviderState[] = []
  const recovered = await runTtsForTargets(text, dir, {}, [target], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [crashedState],
    recoveryRootDir: dir,
    resolveReportedOutput: () => ({ path: recoveredPath, fileName: 'speech-recovered.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async (state) => { observedStates.push(state) }
  })
  expect(providerCalls).toBe(callsBeforeRecovery)
  expect(await Bun.file(recoveredPath).exists()).toBe(true)
  expect(recovered.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('succeeded')
  expect(observedStates.at(-1)?.status).toBe('succeeded')
}

export const registerRetryAndPromotionCases = (): void => {
  test('journals authorized ambiguous retries against one slot and completes without a new process', async () =>
    await withTempDir('autoshow-tts-authorized-retry-', authorizedRetryScenario))
  test('reconstructs a completed partial slot when termination interrupts batch-result promotion', async () =>
    await withTempDir('autoshow-tts-interrupted-batch-promotion-', interruptedPromotionScenario))
  test('assembles a promoted completed result locally without another provider call', async () =>
    await withTempDir('autoshow-tts-completed-recovery-', promotedResultScenario))
}
