import { expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { appendCurrentTtsProviderState, buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { planCurrentTtsResumePrice } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { canonicalTtsJson, hashCanonicalRecordWithout, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type { CanonicalAudioProviderProjection, PipelineProviderState, ProviderRenderResult, RenderAdmissionJournalSnapshot, TtsOptions } from '~/types'
import { withTempDir } from '../../../../test-utils/temp-dirs'
import {
  createDialogueFixtureTarget,
  createFixtureTarget,
  createRejectedDialogueFixtureTarget,
  DIALOGUE_OPTIONS,
  journalEventForState,
  latestJournalForState
} from './shared'

const blockedAdmissionScenario = async (dir: string): Promise<void> => {
  const text = 'Do not repurchase accepted work.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, new Date(0).toISOString())
  let providerCalls = 0
  const target = createFixtureTarget(() => { providerCalls += 1 }, 'accepted-error')
  const states: PipelineProviderState[] = []
  await expect(runTtsForTargets(text, dir, {}, [target], {
    sourceIdentity,
    dialoguePlan,
    beforeDispatch: async () => {},
    onProviderState: async (state) => { states.push(state) }
  })).rejects.toThrow(/Recovery checkpoint: 0\/1 generation slots retained; 1 unresolved\. 1 unresolved slot has ambiguous provider admission\. Rerun the same command with --allow-ambiguous-redispatch/)
  const retained = states.at(-1)
  if (!retained) throw new Error('Missing retained accepted-error provider state')
  const callsBeforeResume = providerCalls
  await expect(runTtsForTargets(text, dir, {}, [target], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [retained],
    recoveryRootDir: dir,
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })).rejects.toThrow('automatic redispatch is blocked')
  expect(providerCalls).toBe(callsBeforeResume)
}

const historicalOrphanScenario = async (dir: string): Promise<void> => {
  const text = 'Host: Retain this turn.\nGuest: Lose this accepted response.'
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
      const second = (await latestJournalForState(dir, state))?.requests.find((request) => request.requestOrdinal === 2)
      if (!injected && second?.transitions.at(-1)?.state === 'provider-accepted') {
        injected = true
        throw new Error('fixture crash after historical provider acceptance')
      }
      if (injected) throw new Error('fixture canonical commit remains unavailable')
      retained = state
    }
  })).rejects.toThrow('No TTS outputs were generated')
  if (!retained) throw new Error('Missing pre-acceptance historical provider state')
  expect(firstCalls).toEqual([0, 1])
  const orphanPrice = await planCurrentTtsResumePrice({ rootDir: dir, state: retained, target: createDialogueFixtureTarget([]), sourceText: text, ttsOptions: DIALOGUE_OPTIONS, sourceIdentity, dialoguePlan })
  expect(orphanPrice.reconciliationBlockers).toEqual([expect.objectContaining({ state: 'provider-accepted', attempt: 1, requestOrdinal: 2 })])

  const rejectedCalls: number[] = []
  const rejectedStates: PipelineProviderState[] = []
  let merged = retained
  await expect(runTtsForTargets(text, dir, { ...DIALOGUE_OPTIONS, ttsAllowAmbiguousRedispatch: true }, [createRejectedDialogueFixtureTarget(rejectedCalls)], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [retained],
    recoveryRootDir: dir,
    beforeDispatch: async () => {},
    onProviderState: async (state) => {
      merged = appendCurrentTtsProviderState(merged, state)
      rejectedStates.push(merged)
    }
  })).rejects.toThrow('No TTS outputs were generated')
  expect(rejectedCalls).toEqual([1])
  const rejected = rejectedStates.at(-1)
  if (!rejected) throw new Error('Missing rejected follow-up provider state')
  const price = await planCurrentTtsResumePrice({ rootDir: dir, state: rejected, target: createDialogueFixtureTarget([]), sourceText: text, ttsOptions: DIALOGUE_OPTIONS, sourceIdentity, dialoguePlan })
  expect(price).toMatchObject({ recoveredSlotCount: 1, unresolvedSlotCount: 1, plannedSlotCount: 1 })
  expect(price.reconciliationBlockers).toEqual([expect.objectContaining({ state: 'provider-accepted', attempt: 1, requestOrdinal: 2 })])
  const blockedCalls: number[] = []
  await expect(runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(blockedCalls)], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [rejected],
    recoveryRootDir: dir,
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })).rejects.toThrow(/provider-accepted provider work in attempt 1, request 2/)
  expect(blockedCalls).toEqual([])
}

const compatibleAmbiguityScenario = async (dir: string): Promise<void> => {
  const text = 'Host: Keep this retained voice.\nGuest: Preserve this ambiguous request.\nNarrator: Change only this unstarted voice.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const initialOptions: TtsOptions = { ...DIALOGUE_OPTIONS, ttsSpeakers: ['Host=alloy', 'Guest=echo', 'Narrator=nova'] }
  const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, initialOptions, new Date(0).toISOString())
  const firstCalls: number[] = []
  const retainedStates: PipelineProviderState[] = []
  await expect(runTtsForTargets(text, dir, initialOptions, [createDialogueFixtureTarget(firstCalls, 'fixture-dialogue-recovery-model', 1)], {
    sourceIdentity,
    dialoguePlan,
    beforeDispatch: async () => {},
    onProviderState: async (state) => { retainedStates.push(state) }
  })).rejects.toThrow(/Recovery checkpoint: 1\/3 generation slots retained; 2 unresolved\. 1 unresolved slot has ambiguous provider admission/)
  const retained = retainedStates.at(-1)
  if (!retained) throw new Error('Missing retained cross-render ambiguity state')
  expect(firstCalls).toEqual([0, 1])
  const changedOptions: TtsOptions = { ...initialOptions, ttsSpeakers: ['Host=alloy', 'Guest=echo', 'Narrator=onyx'] }
  const price = await planCurrentTtsResumePrice({ rootDir: dir, state: retained, target: createDialogueFixtureTarget([]), sourceText: text, ttsOptions: changedOptions, sourceIdentity, dialoguePlan })
  expect(price).toMatchObject({ recoveryKind: 'partial-slots', recoveredSlotCount: 1, unresolvedSlotCount: 2, plannedSlotCount: 2 })
  expect(price.reconciliationBlockers).toEqual([expect.objectContaining({ state: 'provider-accepted', attempt: 1, requestOrdinal: 2 })])
  const blockedCalls: number[] = []
  await expect(runTtsForTargets(text, dir, changedOptions, [createDialogueFixtureTarget(blockedCalls)], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [retained],
    recoveryRootDir: dir,
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })).rejects.toThrow(/Stored compatible TTS generation slot .* has provider-accepted provider work/)
  expect(blockedCalls).toEqual([])
}

const durableAggregateScenario = async (dir: string): Promise<void> => {
  const text = 'Host: First completed turn.\nGuest: Second completed turn.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, DIALOGUE_OPTIONS, new Date(0).toISOString())
  const firstCalls: number[] = []
  let lastCommitted: PipelineProviderState | undefined
  let injected = false
  await expect(runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(firstCalls)], {
    sourceIdentity,
    dialoguePlan,
    beforeDispatch: async () => {},
    onProviderState: async (state) => {
      if (injected) throw new Error('fixture canonical commit remains unavailable')
      const journal = await latestJournalForState(dir, state)
      if (journal?.recordedBatchResults.length === 2 && journal.recordedResult === undefined) {
        injected = true
        throw new Error('fixture crash after every batch result promotion')
      }
      lastCommitted = state
    }
  })).rejects.toThrow('No TTS outputs were generated')
  if (!lastCommitted) throw new Error('Missing last successfully committed pre-crash state')
  expect((await latestJournalForState(dir, lastCommitted))?.recordedBatchResults.length ?? 0).toBeLessThan(2)
  const resumedCalls: number[] = []
  const states: PipelineProviderState[] = []
  const reportedOutput = join(dir, 'speech-batch-only-recovered.wav')
  const resumed = await runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(resumedCalls)], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [lastCommitted],
    recoveryRootDir: dir,
    resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-batch-only-recovered.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async (state) => { states.push(state) }
  })
  expect(firstCalls).toEqual([0, 1])
  expect(resumedCalls).toEqual([])
  expect(await Bun.file(reportedOutput).exists()).toBe(true)
  expect(resumed.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('succeeded')
  const terminal = states.at(-1)
  const projection = terminal?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const event = projection?.renderHistory[0]?.events.at(-1)
  if (!terminal || !event?.providerRenderResultRef) throw new Error('Missing orphan aggregate recovery result')
  const result = await Bun.file(join(dir, terminal.artifactDir, event.providerRenderResultRef)).json() as ProviderRenderResult
  expect(result.closedBy.kind).toBe('provider-attempt')
}

const foreignJournalScenario = async (dir: string): Promise<void> => {
  const text = 'Reject foreign retained journal evidence.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, new Date(0).toISOString())
  let providerCalls = 0
  const target = createFixtureTarget(() => { providerCalls += 1 }, 'success')
  const first = await runTtsForTargets(text, dir, {}, [target], { sourceIdentity, dialoguePlan })
  const retained = buildCurrentTtsProviderState(first.metadata[0]!)
  const event = journalEventForState(retained)
  if (!event?.admissionJournalRef || !event.admissionJournalSnapshotId) throw new Error('Missing retained journal fixture')
  const retainedJournalPath = join(dir, retained.artifactDir, event.admissionJournalRef)
  const attemptRoot = join(retainedJournalPath, '..')
  const seedName = (await readdir(attemptRoot)).filter((entry) => /^admission-journal-\d+\.json$/.test(entry)).sort()[0]
  if (!seedName) throw new Error('Missing seed admission journal fixture')
  const foreign = await Bun.file(join(attemptRoot, seedName)).json() as RenderAdmissionJournalSnapshot
  foreign.previousSnapshotId = event.admissionJournalSnapshotId
  foreign.invocationId = 'invocation-foreign-orphan-fixture'
  foreign.journalId = hashCanonicalTtsValue({ renderPlanId: foreign.renderPlanId, renderIdentity: foreign.renderIdentity, attempt: foreign.attempt, invocationId: foreign.invocationId })
  foreign.snapshotId = hashCanonicalRecordWithout(foreign as unknown as Record<string, unknown>, ['snapshotId'])
  await Bun.write(join(attemptRoot, 'admission-journal-9999.json'), `${canonicalTtsJson(foreign)}\n`)
  const callsBeforeRecovery = providerCalls
  await expect(runTtsForTargets(text, dir, {}, [target], {
    sourceIdentity,
    dialoguePlan,
    retainedProviderStates: [retained],
    recoveryRootDir: dir,
    resolveReportedOutput: () => ({ path: join(dir, 'foreign-orphan-recovery.wav'), fileName: 'foreign-orphan-recovery.wav' }),
    beforeDispatch: async () => {},
    onProviderState: async () => {}
  })).rejects.toThrow(/cross-attempt orphan journal/i)
  expect(providerCalls).toBe(callsBeforeRecovery)
}

export const registerAmbiguousAdmissionAndOrphanCases = (): void => {
  test('blocks accepted unresolved work before a second provider call', async () =>
    await withTempDir('autoshow-tts-ambiguous-recovery-', blockedAdmissionScenario))
  test('advances an earlier attempt orphan frontier and reports its accepted request without redispatch', async () =>
    await withTempDir('autoshow-tts-historical-orphan-reconciliation-', historicalOrphanScenario))
}

export const registerCompatibleAmbiguousAdmissionCase = (): void => {
  test('preserves compatible ambiguous admissions across a render identity change', async () =>
    await withTempDir('autoshow-tts-cross-render-ambiguity-', compatibleAmbiguityScenario))
}

export const registerDurableOrphanCases = (): void => {
  test('discovers a strictly chained durable aggregate beyond the last committed callback without another provider call', async () =>
    await withTempDir('autoshow-tts-batch-only-recovery-', durableAggregateScenario))
  test('rejects a valid foreign journal in the exact retained attempt directory before another provider call', async () =>
    await withTempDir('autoshow-tts-foreign-orphan-journal-', foreignJournalScenario))
}
