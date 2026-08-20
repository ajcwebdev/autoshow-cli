import { expect, test } from 'bun:test'
import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import { PIPELINE_MANIFEST_FILE, readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { canonicalTtsJson, hashCanonicalRecordWithout, hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type {
  CanonicalAudioProviderProjection,
  PipelineManifest,
  PipelineProviderState,
  ProviderRenderPlan,
  ProviderRenderResult
} from '~/types'
import { withTempDir } from '../../../../test-utils/temp-dirs'
import { createDialogueFixtureTarget, DIALOGUE_OPTIONS, latestJournalForState } from './shared'
import { requireDefined } from '../../../../test-utils/value-assertions'

const MODEL = 'gpt-4o-mini-tts-2025-12-15'

const deferredGate = () => {
  let release = (): void => {}
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

const requireProviderState = (
  state: PipelineProviderState | undefined,
  message: string
): PipelineProviderState => {
  if (!state) throw new Error(message)
  return state
}

const attemptsRootForState = (dir: string, state: PipelineProviderState): string => {
  const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const render = requireDefined(projection?.renderHistory[0], 'transitive retained render')
  return join(dir, state.artifactDir, render.renderDir, 'attempts')
}

const settlePhaseTwo = async (
  run: Promise<Awaited<ReturnType<typeof runTtsForTargets>>> | undefined,
  ...gates: Array<ReturnType<typeof deferredGate>>
): Promise<void> => {
  for (const gate of gates) gate.release()
  if (!run) return
  const error = await run.then(() => undefined, (reason: unknown) => reason)
  if (!(error instanceof Error) || !error.message.includes('No TTS outputs were generated')) {
    throw error ?? new Error('Phase two unexpectedly completed')
  }
}

export const runTransitiveRecoveryPhases = async (dir: string) => {
  const text = 'Host: First retained turn.\nGuest: Second retained turn.'
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, DIALOGUE_OPTIONS, new Date(0).toISOString())
  const phaseOneCalls: number[] = []
  let phaseOneState: PipelineProviderState | undefined
  let phaseOneInjected = false
  await expect(runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(phaseOneCalls, MODEL)], {
    sourceIdentity,
    dialoguePlan,
    beforeDispatch: async () => {},
    onProviderState: async (state) => {
      if (!phaseOneInjected && (await latestJournalForState(dir, state))?.recordedBatchResults.length === 1) {
        phaseOneState = state
        phaseOneInjected = true
        throw new Error('fixture crash after attempt one promoted slot one')
      }
    }
  })).rejects.toThrow('No TTS outputs were generated')
  const retainedPhaseOne = requireProviderState(phaseOneState, 'Missing attempt-one retained slot state')

  const hold = deferredGate()
  const captured = deferredGate()
  const phaseTwoCalls: number[] = []
  let phaseTwoState: PipelineProviderState | undefined
  let phaseTwoInjected = false
  let phaseTwoRun: Promise<Awaited<ReturnType<typeof runTtsForTargets>>> | undefined
  try {
    phaseTwoRun = runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(phaseTwoCalls, MODEL)], {
      sourceIdentity,
      dialoguePlan,
      retainedProviderStates: [retainedPhaseOne],
      recoveryRootDir: dir,
      beforeDispatch: async () => {},
      onProviderState: async (state) => {
        const journal = await latestJournalForState(dir, state)
        const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
        const active = projection?.activeWork
        const render = active?.kind === 'render' ? projection?.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity) : undefined
        const event = active?.kind === 'render' ? render?.events.find((entry) => entry.sequence === active.eventSequence) : undefined
        const promoted = event?.batchProgress?.flatMap((batch) => batch.generationSlots)
          .filter((slot) => slot.source === 'provider-dispatch' && slot.batchResult !== undefined)
        if (!phaseTwoInjected && journal?.recordedBatchResults.length === 1 && promoted?.length === 2) {
          phaseTwoState = state
          phaseTwoInjected = true
          captured.release()
          await hold.promise
          throw new Error('fixture process ended after attempt two promoted slot two')
        }
      }
    })
    await Promise.race([
      captured.promise,
      phaseTwoRun.then(
        () => { throw new Error('Phase two completed before the retained state was captured') },
        (error) => { throw error }
      )
    ])
    const retainedPhaseTwo = requireProviderState(phaseTwoState, 'Missing transitive two-slot retained state')
    const attemptsRoot = attemptsRootForState(dir, retainedPhaseTwo)
    const attemptsBefore = (await readdir(attemptsRoot)).filter((entry) => entry.startsWith('attempt-')).sort()
    const journalsBefore = (await readdir(attemptsRoot, { recursive: true })).filter((entry) => /admission-journal-\d+\.json$/.test(entry)).sort()
    const phaseThreeCalls: number[] = []
    const phaseThreeStates: PipelineProviderState[] = []
    const reportedOutput = join(dir, 'speech-transitive-recovered.wav')
    await Bun.write(reportedOutput, 'unreferenced stale recovered output')
    const phaseThree = await runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(phaseThreeCalls, MODEL)], {
      sourceIdentity,
      dialoguePlan,
      retainedProviderStates: [retainedPhaseTwo],
      recoveryRootDir: dir,
      resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-transitive-recovered.wav' }),
      beforeDispatch: async () => {},
      onProviderState: async (state) => { phaseThreeStates.push(state) }
    })
    const attemptsAfter = (await readdir(attemptsRoot)).filter((entry) => entry.startsWith('attempt-')).sort()
    const journalsAfter = (await readdir(attemptsRoot, { recursive: true })).filter((entry) => /admission-journal-\d+\.json$/.test(entry)).sort()
    return { text, sourceIdentity, dialoguePlan, phaseOneCalls, phaseTwoCalls, phaseThreeCalls, phaseThreeStates, phaseThree, reportedOutput, attemptsBefore, attemptsAfter, journalsBefore, journalsAfter }
  } finally {
    await settlePhaseTwo(phaseTwoRun, hold, captured)
  }
}

export const readLocalCompositionEvidence = async (
  dir: string,
  terminalState: PipelineProviderState | undefined
) => {
  const projection = terminalState?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const render = projection?.renderHistory[0]
  const event = render?.events.at(-1)
  if (!terminalState || !render || !event?.providerRenderResultRef) {
    throw new Error('Missing transitive recovery terminal evidence')
  }
  const renderPlan = await Bun.file(join(dir, terminalState.artifactDir, render.renderPlanRef)).json() as ProviderRenderPlan
  const resultPath = join(dir, terminalState.artifactDir, event.providerRenderResultRef)
  const providerResult = await Bun.file(resultPath).json() as ProviderRenderResult
  return { terminalState, projection, render, event, renderPlan, providerResult, resultPath }
}

export const assertLocalCompositionEvidence = async (
  phases: Awaited<ReturnType<typeof runTransitiveRecoveryPhases>>,
  evidence: Awaited<ReturnType<typeof readLocalCompositionEvidence>>
): Promise<void> => {
  expect(phases.phaseOneCalls).toEqual([0])
  expect(phases.phaseTwoCalls).toEqual([1])
  expect(phases.phaseThreeCalls).toEqual([])
  expect(await Bun.file(phases.reportedOutput).exists()).toBe(true)
  expect(await Bun.file(phases.reportedOutput).text()).not.toBe('unreferenced stale recovered output')
  expect(evidence.providerResult.closedBy.kind).toBe('local-composition')
  if (evidence.providerResult.closedBy.kind !== 'local-composition') throw new Error('Expected local-composition recovery result')
  expect(evidence.providerResult.closedBy.compositionId).toBe(hashCanonicalTtsValue({
    renderPlanId: evidence.providerResult.renderPlanId,
    renderIdentity: evidence.providerResult.renderIdentity,
    batchResults: evidence.providerResult.batchResults
  }))
  expect(evidence.providerResult.batchResults).toHaveLength(2)
  expect(evidence.providerResult.cost.currentComposition.planned).toEqual(evidence.renderPlan.plannedCost)
  expect(evidence.providerResult.cost.closingAttempt.planned).toEqual({ amounts: [] })
  expect(evidence.providerResult.cost.cumulativeRenderHistory.planned).toEqual(evidence.renderPlan.plannedCost)
  expect(evidence.event.attempt).toBe(2)
  expect(evidence.event.readinessAuthorization).toBeUndefined()
  expect(evidence.event.admissionJournalRef).toBeUndefined()
  expect(evidence.event.admissionJournalSnapshotId).toBeUndefined()
  expect(phases.attemptsAfter).toEqual(phases.attemptsBefore)
  expect(phases.journalsAfter).toEqual(phases.journalsBefore)
  expect(phases.phaseThree.metadata[0]?.ttsAudio?.selectedSuccess?.resultIdentity).toBe(evidence.providerResult.resultIdentity)
}

const persistLocalCompositionManifest = async (
  dir: string,
  phases: Awaited<ReturnType<typeof runTransitiveRecoveryPhases>>
): Promise<PipelineManifest> => {
  const metadata = phases.phaseThree.metadata[0]
  if (!metadata?.targetKey || !metadata.operation || !metadata.transport) throw new Error('Missing transitive recovery target metadata')
  const artifact = await materializeTtsDialoguePlanArtifact(dir, phases.dialoguePlan)
  const providerState = bindTtsDialoguePlanArtifact(buildCurrentTtsProviderState(metadata), artifact)
  await writeGenerationMetadata(dir, 'tts', phases.phaseThree.metadata, {}, {}, {
    input: phases.text,
    requestedProviders: [{ service: 'openai', model: MODEL, operation: metadata.operation, targetKey: metadata.targetKey, transport: metadata.transport }],
    completedProviders: [{ service: 'openai', model: MODEL }],
    providerStates: [providerState]
  })
  const manifest = await readManifest(dir)
  expect(manifest?.items[0]?.status).toBe('full')
  expect(manifest?.items[0]?.providers[0]?.result).toEqual({ ttsAudio: metadata.ttsAudio })
  if (!manifest) throw new Error('Missing valid local-composition manifest fixture')
  return manifest
}

const failedAssemblyError = {
  phase: 'assembly' as const,
  code: 'fixture-local-assembly-failed',
  message: 'Fixture local assembly failed.',
  retryable: true
}

export const buildFailedLocalResultManifest = (manifest: PipelineManifest) => {
  const mutated = structuredClone(manifest)
  const item = mutated.items[0]
  const provider = item?.providers[0]
  const projection = provider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const active = projection?.activeWork
  const render = active?.kind === 'render' ? projection?.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity) : undefined
  const event = active?.kind === 'render' ? render?.events.find((entry) => entry.sequence === active.eventSequence) : undefined
  if (!item || !provider || !projection || !event) throw new Error('Missing mutable local-composition manifest fixture')
  event.status = 'failed'
  event.error = failedAssemblyError
  delete event.outputRefs
  delete event.reportedOutputRefs
  delete event.audioRunId
  delete event.audioRunRef
  delete event.audioRunSha256
  delete projection.selectedSuccess
  projection.pointerEvents = projection.pointerEvents.filter((pointer) =>
    pointer.action !== 'select-success' || pointer.renderIdentity !== render?.renderIdentity || pointer.eventSequence !== event.sequence)
  provider.status = 'failed'
  provider.error = failedAssemblyError
  provider.metadata = { ...provider.metadata, ttsAudio: projection }
  provider.result = { ttsAudio: projection }
  item.status = 'failed'
  return { manifest: mutated, event }
}

const assertInvalidLocalCompositionManifests = async (
  dir: string,
  manifest: PipelineManifest,
  evidence: Awaited<ReturnType<typeof readLocalCompositionEvidence>>
): Promise<void> => {
  const originalBytes = await Bun.file(evidence.resultPath).bytes()
  await unlink(join(dir, PIPELINE_MANIFEST_FILE))
  const wrongResult = structuredClone(evidence.providerResult)
  if (wrongResult.closedBy.kind !== 'local-composition') throw new Error('Missing mutable local-composition result fixture')
  wrongResult.closedBy.compositionId = '0'.repeat(64)
  wrongResult.resultIdentity = hashCanonicalRecordWithout(wrongResult as unknown as Record<string, unknown>, ['resultIdentity'])
  const wrongBytes = `${canonicalTtsJson(wrongResult)}\n`
  await Bun.write(evidence.resultPath, wrongBytes)
  const wrongManifest = buildFailedLocalResultManifest(manifest)
  wrongManifest.event.providerRenderResultIdentity = wrongResult.resultIdentity
  wrongManifest.event.providerRenderResultSha256 = sha256Bytes(wrongBytes)
  await expect(writeManifest(dir, wrongManifest.manifest)).rejects.toThrow('Invalid canonical manifest')

  await Bun.write(evidence.resultPath, originalBytes)
  const fabricated = structuredClone(manifest)
  const provider = fabricated.items[0]?.providers[0]
  const projection = provider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const active = projection?.activeWork
  const render = active?.kind === 'render' ? projection?.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity) : undefined
  const event = active?.kind === 'render' ? render?.events.find((entry) => entry.sequence === active.eventSequence) : undefined
  const attemptEvent = [...(render?.events ?? [])].reverse().find((entry) =>
    entry.admissionJournalRef !== undefined && entry.readinessAuthorization !== undefined)
  if (!provider || !projection || !event || !attemptEvent?.admissionJournalRef || !attemptEvent.admissionJournalSha256 || !attemptEvent.admissionJournalSnapshotId || !attemptEvent.readinessAuthorization) {
    throw new Error('Missing provider-attempt evidence for fabricated local journal mutation')
  }
  event.readinessAuthorization = attemptEvent.readinessAuthorization
  event.admissionJournalSnapshotId = attemptEvent.admissionJournalSnapshotId
  event.admissionJournalRef = attemptEvent.admissionJournalRef
  event.admissionJournalSha256 = attemptEvent.admissionJournalSha256
  provider.metadata = { ...provider.metadata, ttsAudio: projection }
  provider.result = { ttsAudio: projection }
  await expect(writeManifest(dir, fabricated)).rejects.toThrow('Invalid canonical manifest')
}

const transitiveLocalCompositionScenario = async (dir: string): Promise<void> => {
  const phases = await runTransitiveRecoveryPhases(dir)
  const evidence = await readLocalCompositionEvidence(dir, phases.phaseThreeStates.at(-1))
  await assertLocalCompositionEvidence(phases, evidence)
  const manifest = await persistLocalCompositionManifest(dir, phases)
  await assertInvalidLocalCompositionManifests(dir, manifest, evidence)
}

export const registerTransitiveLocalCompositionCases = (): void => {
  test('recovers transitive slot results across two attempts and closes the third phase by local composition', async () =>
    await withTempDir('autoshow-tts-transitive-slot-recovery-', transitiveLocalCompositionScenario))
}
