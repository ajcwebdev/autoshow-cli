import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { planCurrentTtsResumePrice } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import type { CanonicalAudioProviderProjection, PipelineProviderState, ProviderRenderPlan, ProviderRenderResult, TtsOptions } from '~/types'
import { withTempDir } from '../../../../test-utils/temp-dirs'
import { createDialogueFixtureTarget, DIALOGUE_OPTIONS, latestJournalForState } from './shared'

const createPartialSlotFixture = async (dir: string) => {
  const text = 'Host: First retained turn.\nGuest: Second unstarted turn.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, DIALOGUE_OPTIONS, new Date(0).toISOString())
  const firstCalls: number[] = []
  let retained: PipelineProviderState | undefined
  let injected = false
  await expect(runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(firstCalls)], {
    sourceIdentity,
    dialoguePlan,
    beforeDispatch: async () => {},
    onProviderState: async (state) => {
      const journal = await latestJournalForState(dir, state)
      if (!injected && journal?.recordedBatchResults.length === 1) {
        retained = state
        injected = true
        throw new Error('fixture crash after first batch result promotion')
      }
    }
  })).rejects.toThrow(/Recovery checkpoint: 1\/2 generation slots retained; 1 unresolved\. Rerun the same command to reuse retained audio/)
  if (!retained) throw new Error('Missing partial-slot retained state')
  const recoveredSlotId = (await latestJournalForState(dir, retained))?.recordedBatchResults[0]?.generationSlotId
  if (!recoveredSlotId) throw new Error('Missing first promoted slot evidence')
  return { text, sourceIdentity, dialoguePlan, firstCalls, retained, recoveredSlotId }
}

const assertPartialAggregate = async (
  dir: string,
  fixture: Awaited<ReturnType<typeof createPartialSlotFixture>>,
  resumed: Awaited<ReturnType<typeof runTtsForTargets>>,
  terminalState: PipelineProviderState
): Promise<void> => {
  const journal = await latestJournalForState(dir, terminalState)
  expect(journal?.plannedRequestCount).toBe(1)
  expect(journal?.plannedGenerationSlots).toHaveLength(1)
  expect(journal?.plannedGenerationSlots[0]?.generationSlotId).not.toBe(fixture.recoveredSlotId)
  expect(journal?.requests[0]?.generationSlotId).toBe(journal?.plannedGenerationSlots[0]?.generationSlotId)
  const projection = terminalState.result?.['ttsAudio'] as CanonicalAudioProviderProjection
  const render = projection.renderHistory[0]
  const event = render?.events.at(-1)
  if (!render || !event?.providerRenderResultRef) throw new Error('Missing resumed aggregate provider result')
  const renderPlan = await Bun.file(join(dir, terminalState.artifactDir, render.renderPlanRef)).json() as ProviderRenderPlan
  const result = await Bun.file(join(dir, terminalState.artifactDir, event.providerRenderResultRef)).json() as ProviderRenderResult
  const unresolvedSlotId = journal?.plannedGenerationSlots[0]?.generationSlotId
  const unresolvedCost = renderPlan.batches.flatMap((batch) => batch.generationSlots)
    .find((slot) => slot.generationSlotId === unresolvedSlotId)?.plannedCost
  if (!unresolvedCost) throw new Error('Missing unresolved slot cost in immutable render plan')
  expect(result.cost.closingAttempt.planned).toEqual(unresolvedCost)
  expect(result.batchResults).toHaveLength(2)
  const metadata = resumed.metadata[0]
  if (!metadata?.targetKey || !metadata.operation || !metadata.transport) throw new Error('Missing resumed target identity metadata')
  const artifact = await materializeTtsDialoguePlanArtifact(dir, fixture.dialoguePlan)
  const providerState = bindTtsDialoguePlanArtifact(buildCurrentTtsProviderState(metadata), artifact)
  await writeGenerationMetadata(dir, 'tts', resumed.metadata, {}, {}, {
    input: fixture.text,
    requestedProviders: [{ service: 'openai', model: 'fixture-dialogue-recovery-model', operation: metadata.operation, targetKey: metadata.targetKey, transport: metadata.transport }],
    completedProviders: [{ service: 'openai', model: 'fixture-dialogue-recovery-model' }],
    providerStates: [providerState]
  })
  const manifest = await readManifest(dir)
  expect(manifest?.items[0]?.status).toBe('full')
  expect(manifest?.items[0]?.providers[0]?.result).toEqual({ ttsAudio: metadata.ttsAudio })
}

const partialSlotScenario = async (dir: string): Promise<void> => {
  const fixture = await createPartialSlotFixture(dir)
  const resumedCalls: number[] = []
  const states: PipelineProviderState[] = []
  const reportedOutput = join(dir, 'speech-partial-recovered.wav')
  const resumed = await runTtsForTargets(fixture.text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(resumedCalls)], {
    sourceIdentity: fixture.sourceIdentity,
    dialoguePlan: fixture.dialoguePlan,
    retainedProviderStates: [fixture.retained],
    recoveryRootDir: dir,
    resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-partial-recovered.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async (state) => { states.push(state) }
  })
  expect(fixture.firstCalls).toEqual([0])
  expect(resumedCalls).toEqual([1])
  expect(await Bun.file(reportedOutput).exists()).toBe(true)
  expect(resumed.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('succeeded')
  const terminal = states.at(-1)
  if (!terminal) throw new Error('Missing resumed terminal provider state')
  await assertPartialAggregate(dir, fixture, resumed, terminal)
}

const slotHashScenario = async (dir: string): Promise<void> => {
  const text = 'Host: Keep this retained voice.\nGuest: Replace only this voice.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, DIALOGUE_OPTIONS, new Date(0).toISOString())
  const firstCalls: number[] = []
  const first = await runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(firstCalls)], { sourceIdentity, dialoguePlan, beforeDispatch: async () => {}, onProviderState: async () => {} })
  const firstArchive = first.metadata[0]?.ttsAudio?.archive
  if (!firstArchive) throw new Error('Missing first compact TTS archive')
  const firstRender = await Bun.file(join(dir, firstArchive.renderRef.path)).json() as { slots: Array<{ slotHash: string }> }
  const reusedSlotHashes = firstRender.slots.map((slot) => slot.slotHash)
  expect(reusedSlotHashes).toHaveLength(2)
  const retained = buildCurrentTtsProviderState(first.metadata[0]!)
  const changedOptions: TtsOptions = { ...DIALOGUE_OPTIONS, ttsSpeakers: ['Host=alloy', 'Guest=onyx'] }
  const price = await planCurrentTtsResumePrice({ rootDir: dir, state: retained, target: createDialogueFixtureTarget([]), sourceText: text, ttsOptions: changedOptions, sourceIdentity, dialoguePlan })
  expect(price).toMatchObject({ recoveryKind: 'partial-slots', recoveredSlotCount: 1, unresolvedSlotCount: 1, plannedSlotCount: 1 })
  const resumedCalls: number[] = []
  const reportedOutput = join(dir, 'speech-cross-render-recovered.wav')
  const resumed = await runTtsForTargets(text, dir, changedOptions, [createDialogueFixtureTarget(resumedCalls)], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [retained],
    recoveryRootDir: dir,
    resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-cross-render-recovered.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })
  expect(firstCalls).toEqual([0, 1])
  expect(resumedCalls).toEqual([1])
  expect(await Bun.file(reportedOutput).exists()).toBe(true)
  expect(resumed.metadata[0]?.ttsAudio?.archive?.slotCount).toBe(2)
  expect(resumed.metadata[0]?.ttsAudio?.renderHistory).toEqual([])
  expect(await Bun.file(join(dir, 'cache-materializations')).exists()).toBe(false)
  const resumedArchive = resumed.metadata[0]?.ttsAudio?.archive
  if (!resumedArchive) throw new Error('Missing recast compact TTS archive')
  const resumedRender = await Bun.file(join(dir, resumedArchive.renderRef.path)).json() as { slots: Array<{ slotHash: string }> }
  const reused = resumedRender.slots.find((slot) => reusedSlotHashes.includes(slot.slotHash))
  expect(reused).toBeDefined()
  expect(await Bun.file(join(dir, 'slots', `${reused?.slotHash}.wav`)).exists()).toBe(true)
  const completedState = buildCurrentTtsProviderState(resumed.metadata[0]!)
  const completedPrice = await planCurrentTtsResumePrice({ rootDir: dir, state: completedState, target: createDialogueFixtureTarget([]), sourceText: text, ttsOptions: changedOptions, sourceIdentity, dialoguePlan })
  expect(completedPrice).toMatchObject({ recoveryKind: 'complete-render', recoveredSlotCount: 2, unresolvedSlotCount: 0, plannedSlotCount: 0, plannedCost: { amounts: [] } })
  const noOpCalls: number[] = []
  await runTtsForTargets(text, dir, changedOptions, [createDialogueFixtureTarget(noOpCalls)], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [completedState],
    recoveryRootDir: dir,
    resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-cross-render-recovered.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })
  expect(noOpCalls).toEqual([])
}

const checkpointOptions = (): TtsOptions => ({
  ...DIALOGUE_OPTIONS,
  ttsMaxGenerationSlots: 1,
  ttsTurnControls: {
    'dialogue-turn-001': { openai: {} },
    'dialogue-turn-002': { openai: {} },
    'dialogue-turn-003': { openai: {} }
  },
  ttsCanonicalTurns: [
    { turnId: 'dialogue-turn-001', speaker: 'Host', text: 'First turn.' },
    { turnId: 'dialogue-turn-002', speaker: 'Guest', text: 'Second turn.' },
    { turnId: 'dialogue-turn-003', speaker: 'Host', text: 'Third turn.' }
  ]
})

const runCheckpointPhase = async (
  dir: string,
  retained: PipelineProviderState | undefined,
  completedCount: number
) => {
  const text = 'Host: First turn.\nGuest: Second turn.\nHost: Third turn.'
  const options = checkpointOptions()
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, options, new Date(0).toISOString())
  const calls: number[] = []
  const reportedOutput = join(dir, 'must-not-exist.wav')
  const result = await runTtsForTargets(text, dir, options, [createDialogueFixtureTarget(calls)], {
    sourceIdentity,
    dialoguePlan,
    ...(retained ? { retainedProviderStates: [retained], recoveryRootDir: dir } : {}),
    resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'must-not-exist.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })
  expect(calls).toHaveLength(1)
  expect(result.audioPaths).toEqual([])
  expect(await Bun.file(reportedOutput).exists()).toBe(false)
  expect(result.metadata[0]?.generationCheckpoint?.completedGenerationSlotIds).toHaveLength(completedCount)
  expect(result.metadata[0]?.generationCheckpoint?.remainingGenerationSlotCount).toBe(3 - completedCount)
  expect(result.metadata[0]?.ttsAudio?.selectedSuccess).toBeUndefined()
  return { text, options, sourceIdentity, dialoguePlan, result, state: buildCurrentTtsProviderState(result.metadata[0]!) }
}

const checkpointScenario = async (dir: string): Promise<void> => {
  const first = await runCheckpointPhase(dir, undefined, 1)
  expect(first.result.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('running')
  expect(first.state.status).toBe('running')
  expect((await latestJournalForState(dir, first.state))?.plannedRequestCount).toBe(1)
  expect((await latestJournalForState(dir, first.state))?.requests).toHaveLength(1)

  const second = await runCheckpointPhase(dir, first.state, 2)
  const secondSlotIds = second.result.metadata[0]?.generationCheckpoint?.completedGenerationSlotIds ?? []
  expect(new Set(secondSlotIds).size).toBe(2)
  const { ttsMaxGenerationSlots: _limit, ...unboundedOptions } = second.options
  const partialPrice = await planCurrentTtsResumePrice({
    rootDir: dir,
    state: second.state,
    target: createDialogueFixtureTarget([]),
    sourceText: second.text,
    ttsOptions: unboundedOptions,
    sourceIdentity: second.sourceIdentity,
    dialoguePlan: second.dialoguePlan
  })
  const unresolved = partialPrice.readiness.renderPlan.batches.flatMap((batch) => batch.generationSlots)
    .find((slot) => !secondSlotIds.includes(slot.generationSlotId))
  if (!unresolved) throw new Error('Missing unresolved pricing fixture slot')
  expect(partialPrice).toMatchObject({ recoveryKind: 'partial-slots', recoveredSlotCount: 2, unresolvedSlotCount: 1, plannedSlotCount: 1 })
  expect(partialPrice.plannedCost).toEqual(unresolved.plannedCost)

  const third = await runCheckpointPhase(dir, second.state, 3)
  const completedPrice = await planCurrentTtsResumePrice({
    rootDir: dir,
    state: third.state,
    target: createDialogueFixtureTarget([]),
    sourceText: third.text,
    ttsOptions: unboundedOptions,
    sourceIdentity: third.sourceIdentity,
    dialoguePlan: third.dialoguePlan
  })
  expect(completedPrice).toMatchObject({ recoveryKind: 'complete-render', recoveredSlotCount: 3, unresolvedSlotCount: 0, plannedSlotCount: 0, plannedCost: { amounts: [] } })
}

export const registerCompatibleSlotReuseCases = (): void => {
  test('reuses completed slot one and dispatches only safe unstarted slot two', async () =>
    await withTempDir('autoshow-tts-partial-slot-recovery-', partialSlotScenario))
  test('reuses unchanged completed slots by slotHash across a voice-profile render change', async () =>
    await withTempDir('autoshow-tts-cross-render-slot-recovery-', slotHashScenario))
}

export const registerCheckpointSlotReuseCase = (): void => {
  test('checkpoints exactly one unresolved segmented slot without publishing a final audio run', async () =>
    await withTempDir('autoshow-tts-one-slot-checkpoint-', checkpointScenario))
}
