import { describe, expect, test } from 'bun:test'
import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import { PIPELINE_MANIFEST_FILE, readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { appendCurrentTtsProviderState, buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { planCurrentTtsResumePrice } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { canonicalTtsJson, hashCanonicalRecordWithout, hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type { CanonicalAudioProviderProjection, PipelineProviderState, ProviderRenderPlan, ProviderRenderResult, RenderAdmissionJournalSnapshot, TtsOptions, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'

const createFixtureTarget = (
  onRun: () => void,
  mode: 'success' | 'accepted-error'
): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const transport = 'hosted-api'
  const model = 'fixture-recovery-model'
  return {
    service: 'openai',
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, 'openai', model, transport),
    voice: 'alloy',
    run: async (text, outputDir, _options, _invocation, requestEvidence) => {
      onRun()
      const audioPath = join(outputDir, 'speech.wav')
      const bytes = createSyntheticWavBytes({ durationSeconds: 0.15, amplitude: 0.2, frequencyHz: 330 })
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { body: { input: text, voice: 'alloy', response_format: 'wav' } },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: 'alloy' }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async ({ accepted }) => {
        await accepted({ providerRequestId: 'local-recovery-fixture' })
        if (mode === 'accepted-error') throw new Error('fixture failed after provider acceptance')
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'openai',
          ttsModel: model,
          speaker: 'alloy',
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

const crashAfterPromotedResult = (state: PipelineProviderState): PipelineProviderState => {
  const projection = structuredClone(state.result?.['ttsAudio']) as CanonicalAudioProviderProjection
  const render = projection.renderHistory[0]
  if (!render) throw new Error('Missing recovery fixture render')
  const running = [...render.events].reverse().find((event) => event.status === 'running' && event.providerRenderResultRef === undefined)
  const promotedResultRunning = [...render.events].reverse().find((event) => event.status === 'running' && event.admissionJournalRef)
  const selectedRunning = promotedResultRunning ?? running
  if (!selectedRunning) throw new Error('Missing recovery fixture running event')
  render.events = render.events.filter((event) => event.sequence <= selectedRunning.sequence)
  projection.activeWork = { kind: 'render', renderIdentity: render.renderIdentity, eventSequence: selectedRunning.sequence }
  delete projection.selectedSuccess
  projection.pointerEvents = projection.pointerEvents.filter((event) =>
    event.action !== 'select-success'
    && (event.action !== 'activate-render' || event.renderIdentity !== render.renderIdentity || event.eventSequence <= selectedRunning.sequence)
  )
  return {
    ...state,
    status: 'running',
    attempts: selectedRunning.attempt,
    metadata: { ...state.metadata, ttsAudio: projection },
    result: { ttsAudio: projection },
    error: undefined
  }
}

const DIALOGUE_OPTIONS: TtsOptions = {
  ttsDialogueFormat: 'labeled',
  ttsSpeakers: ['Host=alloy', 'Guest=echo'],
  ttsChunkConcurrency: 1
}

const createDialogueFixtureTarget = (
  calls: number[],
  model = 'fixture-dialogue-recovery-model'
): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const transport = 'hosted-api'
  return {
    service: 'openai',
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, 'openai', model, transport),
    multiSpeakerStrategy: 'segment-and-concat',
    run: async (text, outputDir, _options, invocation, requestEvidence) => {
      const sourceIndex = invocation?.sourceIndex ?? -1
      calls.push(sourceIndex)
      const voice = invocation?.voice.value ?? 'alloy'
      const audioPath = join(outputDir, 'speech.wav')
      const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: sourceIndex === 0 ? 280 : 420 })
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { body: { input: text, voice, response_format: 'wav' } },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async ({ accepted }) => {
        await accepted({ providerRequestId: `dialogue-${sourceIndex}` })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'openai',
          ttsModel: model,
          speaker: voice,
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

const createRejectedDialogueFixtureTarget = (
  calls: number[],
  model = 'fixture-dialogue-recovery-model'
): TtsTarget => ({
  service: 'openai',
  model,
  operation: 'tts-synthesis',
  transport: 'hosted-api',
  targetKey: canonicalTargetKey('tts-synthesis', 'openai', model, 'hosted-api'),
  multiSpeakerStrategy: 'segment-and-concat',
  run: async (text, _outputDir, _options, invocation, requestEvidence) => {
    const sourceIndex = invocation?.sourceIndex ?? -1
    calls.push(sourceIndex)
    const voice = invocation?.voice.value ?? 'alloy'
    await requestEvidence?.dispatch({
      chunkIndex: 1,
      endpointKind: 'speech-synthesis',
      serializerVersion: 'openai.tts.phase-0-v1',
      serializedRequest: { body: { input: text, voice, response_format: 'wav' } },
      providerText: text,
      voiceField: 'voice',
      voices: [{ kind: 'provider-id', value: voice }],
      requestControls: { responseFormat: 'wav' },
      continuation: { kind: 'none' }
    }, { attempt: 1 }, async () => {
      const error = new Error('fixture provider rejected request')
      Object.defineProperty(error, 'status', { value: 400, configurable: true })
      throw error
    })
    throw new Error('fixture rejection unexpectedly returned')
  }
})

const latestJournalForState = async (
  rootDir: string,
  state: PipelineProviderState
): Promise<RenderAdmissionJournalSnapshot | undefined> => {
  const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
  const active = projection?.activeWork
  if (!projection || active?.kind !== 'render') return undefined
  const render = projection.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
  const event = render?.events.find((entry) => entry.sequence === active.eventSequence)
  if (!event?.admissionJournalRef) return undefined
  return await Bun.file(join(rootDir, state.artifactDir, event.admissionJournalRef)).json()
}

describe('TTS completed-render recovery', () => {
  test('assembles a promoted completed result locally without another provider call', async () => {
    await withTempDir('autoshow-tts-completed-recovery-', async (dir) => {
      const text = 'Recover this completed provider result.'
      const sourceIdentity = createInlineTtsSourceIdentity(text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, new Date(0).toISOString())
      let providerCalls = 0
      const target = createFixtureTarget(() => { providerCalls += 1 }, 'success')
      const first = await runTtsForTargets(text, dir, {}, [target], { sourceIdentity, dialoguePlan })
      const firstState = buildCurrentTtsProviderState(first.metadata[0]!)
      const crashedState = crashAfterPromotedResult(firstState)
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
    })
  })

  test('blocks accepted unresolved work before a second provider call', async () => {
    await withTempDir('autoshow-tts-ambiguous-recovery-', async (dir) => {
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
      })).rejects.toThrow('No TTS outputs were generated')
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
    })
  })

  test('advances an earlier attempt orphan frontier and reports its accepted request without redispatch', async () => {
    await withTempDir('autoshow-tts-historical-orphan-reconciliation-', async (dir) => {
      const text = 'Host: Retain this turn.\nGuest: Lose this accepted response.'
      const sourceIdentity = createInlineTtsSourceIdentity(text)
      const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, DIALOGUE_OPTIONS, new Date(0).toISOString())
      const firstCalls: number[] = []
      let retainedBeforeAccepted: PipelineProviderState | undefined
      let injected = false
      await expect(runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(firstCalls)], {
        sourceIdentity,
        dialoguePlan,
        beforeDispatch: async () => {},
        onProviderState: async (state) => {
          const journal = await latestJournalForState(dir, state)
          const secondRequest = journal?.requests.find((request) => request.requestOrdinal === 2)
          if (!injected && secondRequest?.transitions.at(-1)?.state === 'provider-accepted') {
            injected = true
            throw new Error('fixture crash after historical provider acceptance')
          }
          if (injected) throw new Error('fixture canonical commit remains unavailable')
          retainedBeforeAccepted = state
        }
      })).rejects.toThrow('No TTS outputs were generated')
      if (!retainedBeforeAccepted) throw new Error('Missing pre-acceptance historical provider state')
      expect(firstCalls).toEqual([0, 1])
      const orphanPrice = await planCurrentTtsResumePrice({
        rootDir: dir,
        state: retainedBeforeAccepted,
        target: createDialogueFixtureTarget([]),
        sourceText: text,
        ttsOptions: DIALOGUE_OPTIONS,
        sourceIdentity,
        dialoguePlan
      })
      expect(orphanPrice.reconciliationBlockers).toEqual([expect.objectContaining({ state: 'provider-accepted', attempt: 1, requestOrdinal: 2 })])

      const rejectedCalls: number[] = []
      const rejectedStates: PipelineProviderState[] = []
      let mergedRejectedState = retainedBeforeAccepted
      await expect(runTtsForTargets(text, dir, { ...DIALOGUE_OPTIONS, ttsAllowAmbiguousRedispatch: true }, [createRejectedDialogueFixtureTarget(rejectedCalls)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [retainedBeforeAccepted],
        recoveryRootDir: dir,
        beforeDispatch: async () => {},
        onProviderState: async (state) => {
          mergedRejectedState = appendCurrentTtsProviderState(mergedRejectedState, state)
          rejectedStates.push(mergedRejectedState)
        }
      })).rejects.toThrow('No TTS outputs were generated')
      expect(rejectedCalls).toEqual([1])
      const rejectedState = rejectedStates.at(-1)
      if (!rejectedState) throw new Error('Missing rejected follow-up provider state')

      const price = await planCurrentTtsResumePrice({
        rootDir: dir,
        state: rejectedState,
        target: createDialogueFixtureTarget([]),
        sourceText: text,
        ttsOptions: DIALOGUE_OPTIONS,
        sourceIdentity,
        dialoguePlan
      })
      expect(price.recoveredSlotCount).toBe(1)
      expect(price.unresolvedSlotCount).toBe(1)
      expect(price.plannedSlotCount).toBe(1)
      expect(price.reconciliationBlockers).toEqual([expect.objectContaining({ state: 'provider-accepted', attempt: 1, requestOrdinal: 2 })])

      const blockedCalls: number[] = []
      await expect(runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(blockedCalls)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [rejectedState],
        recoveryRootDir: dir,
        beforeDispatch: async () => {},
        onProviderState: async () => {}
      })).rejects.toThrow(/provider-accepted provider work in attempt 1, request 2/)
      expect(blockedCalls).toEqual([])
    })
  })

  test('reuses completed slot one and dispatches only safe unstarted slot two', async () => {
    await withTempDir('autoshow-tts-partial-slot-recovery-', async (dir) => {
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
      })).rejects.toThrow('No TTS outputs were generated')
      if (!retained) throw new Error('Missing partial-slot retained state')
      const firstJournal = await latestJournalForState(dir, retained)
      const recoveredSlotId = firstJournal?.recordedBatchResults[0]?.generationSlotId
      if (!firstJournal || !recoveredSlotId) throw new Error('Missing first promoted slot evidence')

      const resumedCalls: number[] = []
      const resumedStates: PipelineProviderState[] = []
      const reportedOutput = join(dir, 'speech-partial-recovered.wav')
      const resumed = await runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(resumedCalls)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [retained],
        recoveryRootDir: dir,
        resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-partial-recovered.wav' }),
        beforeDispatch: async () => {},
        onProviderState: async (state) => { resumedStates.push(state) }
      })

      expect(firstCalls).toEqual([0])
      expect(resumedCalls).toEqual([1])
      expect(await Bun.file(reportedOutput).exists()).toBe(true)
      expect(resumed.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('succeeded')
      const terminalState = resumedStates.at(-1)
      if (!terminalState) throw new Error('Missing resumed terminal provider state')
      const terminalJournal = await latestJournalForState(dir, terminalState)
      expect(terminalJournal?.plannedRequestCount).toBe(1)
      expect(terminalJournal?.plannedGenerationSlots).toHaveLength(1)
      expect(terminalJournal?.plannedGenerationSlots[0]?.generationSlotId).not.toBe(recoveredSlotId)
      expect(terminalJournal?.requests).toHaveLength(1)
      expect(terminalJournal?.requests[0]?.generationSlotId).toBe(terminalJournal?.plannedGenerationSlots[0]?.generationSlotId)

      const projection = terminalState.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const render = projection.renderHistory[0]
      const terminalEvent = render?.events.at(-1)
      if (!render || !terminalEvent?.providerRenderResultRef) throw new Error('Missing resumed aggregate provider result')
      const renderPlan = await Bun.file(join(dir, terminalState.artifactDir, render.renderPlanRef)).json() as ProviderRenderPlan
      const providerResult = await Bun.file(join(dir, terminalState.artifactDir, terminalEvent.providerRenderResultRef)).json() as ProviderRenderResult
      const unresolvedSlotId = terminalJournal?.plannedGenerationSlots[0]?.generationSlotId
      const unresolvedCost = renderPlan.batches
        .flatMap((batch) => batch.generationSlots)
        .find((slot) => slot.generationSlotId === unresolvedSlotId)?.plannedCost
      if (!unresolvedCost) throw new Error('Missing unresolved slot cost in immutable render plan')
      expect(providerResult.cost.closingAttempt.planned).toEqual(unresolvedCost)
      expect(providerResult.batchResults).toHaveLength(2)

      const metadata = resumed.metadata[0]
      if (!metadata?.targetKey || !metadata.operation || !metadata.transport) throw new Error('Missing resumed target identity metadata')
      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      const providerState = bindTtsDialoguePlanArtifact(buildCurrentTtsProviderState(metadata), dialoguePlanArtifact)
      await writeGenerationMetadata(dir, 'tts', resumed.metadata, {}, {}, {
        input: text,
        requestedProviders: [{ service: 'openai', model: 'fixture-dialogue-recovery-model', operation: metadata.operation, targetKey: metadata.targetKey, transport: metadata.transport }],
        completedProviders: [{ service: 'openai', model: 'fixture-dialogue-recovery-model' }],
        providerStates: [providerState]
      })
      const manifest = await readManifest(dir)
      expect(manifest?.items[0]?.status).toBe('full')
      expect(manifest?.items[0]?.providers[0]?.result).toEqual({ ttsAudio: metadata.ttsAudio })
    })
  })

  test('checkpoints exactly one unresolved segmented slot without publishing a final audio run', async () => {
    await withTempDir('autoshow-tts-one-slot-checkpoint-', async (dir) => {
      const text = 'Host: First turn.\nGuest: Second turn.\nHost: Third turn.'
      const checkpointOptions: TtsOptions = {
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
      }
      const sourceIdentity = createInlineTtsSourceIdentity(text)
      const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, checkpointOptions, new Date(0).toISOString())
      const firstCalls: number[] = []
      const firstTarget = createDialogueFixtureTarget(firstCalls)
      const reportedOutput = join(dir, 'must-not-exist.wav')
      const first = await runTtsForTargets(text, dir, checkpointOptions, [firstTarget], {
        sourceIdentity,
        dialoguePlan,
        resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'must-not-exist.wav' }),
        beforeDispatch: async () => {},
        onProviderState: async () => {}
      })

      expect(firstCalls).toHaveLength(1)
      expect(first.audioPaths).toEqual([])
      expect(await Bun.file(reportedOutput).exists()).toBe(false)
      expect(first.metadata[0]?.generationCheckpoint?.completedGenerationSlotIds).toHaveLength(1)
      expect(first.metadata[0]?.generationCheckpoint?.remainingGenerationSlotCount).toBe(2)
      expect(first.metadata[0]?.ttsAudio?.selectedSuccess).toBeUndefined()
      expect(first.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('running')
      const firstState = buildCurrentTtsProviderState(first.metadata[0]!)
      expect(firstState.status).toBe('running')
      const firstJournal = await latestJournalForState(dir, firstState)
      expect(firstJournal?.plannedRequestCount).toBe(1)
      expect(firstJournal?.requests).toHaveLength(1)

      const secondCalls: number[] = []
      const second = await runTtsForTargets(text, dir, checkpointOptions, [createDialogueFixtureTarget(secondCalls)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [firstState],
        recoveryRootDir: dir,
        resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'must-not-exist.wav' }),
        beforeDispatch: async () => {},
        onProviderState: async () => {}
      })

      expect(secondCalls).toHaveLength(1)
      expect(second.audioPaths).toEqual([])
      expect(await Bun.file(reportedOutput).exists()).toBe(false)
      expect(second.metadata[0]?.generationCheckpoint?.completedGenerationSlotIds).toHaveLength(2)
      expect(second.metadata[0]?.generationCheckpoint?.remainingGenerationSlotCount).toBe(1)
      expect(second.metadata[0]?.ttsAudio?.selectedSuccess).toBeUndefined()
      const secondSlotIds = second.metadata[0]?.generationCheckpoint?.completedGenerationSlotIds ?? []
      expect(new Set(secondSlotIds).size).toBe(2)
      const secondState = buildCurrentTtsProviderState(second.metadata[0]!)
      const { ttsMaxGenerationSlots: _checkpointLimit, ...unboundedOptions } = checkpointOptions
      const partialPrice = await planCurrentTtsResumePrice({
        rootDir: dir,
        state: secondState,
        target: createDialogueFixtureTarget([]),
        sourceText: text,
        ttsOptions: unboundedOptions,
        sourceIdentity,
        dialoguePlan
      })
      const unresolvedSlot = partialPrice.readiness.renderPlan.batches
        .flatMap((batch) => batch.generationSlots)
        .find((slot) => !secondSlotIds.includes(slot.generationSlotId))
      if (!unresolvedSlot) throw new Error('Missing unresolved pricing fixture slot')
      expect(partialPrice.recoveryKind).toBe('partial-slots')
      expect(partialPrice.recoveredSlotCount).toBe(2)
      expect(partialPrice.unresolvedSlotCount).toBe(1)
      expect(partialPrice.plannedSlotCount).toBe(1)
      expect(partialPrice.plannedCost).toEqual(unresolvedSlot.plannedCost)

      const thirdCalls: number[] = []
      const third = await runTtsForTargets(text, dir, checkpointOptions, [createDialogueFixtureTarget(thirdCalls)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [secondState],
        recoveryRootDir: dir,
        resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'must-not-exist.wav' }),
        beforeDispatch: async () => {},
        onProviderState: async () => {}
      })
      expect(thirdCalls).toHaveLength(1)
      expect(third.metadata[0]?.generationCheckpoint?.remainingGenerationSlotCount).toBe(0)
      const completedPrice = await planCurrentTtsResumePrice({
        rootDir: dir,
        state: buildCurrentTtsProviderState(third.metadata[0]!),
        target: createDialogueFixtureTarget([]),
        sourceText: text,
        ttsOptions: unboundedOptions,
        sourceIdentity,
        dialoguePlan
      })
      expect(completedPrice.recoveryKind).toBe('complete-render')
      expect(completedPrice.recoveredSlotCount).toBe(3)
      expect(completedPrice.unresolvedSlotCount).toBe(0)
      expect(completedPrice.plannedSlotCount).toBe(0)
      expect(completedPrice.plannedCost).toEqual({ amounts: [] })
    })
  })

  test('discovers a strictly chained durable aggregate beyond the last committed callback without another provider call', async () => {
    await withTempDir('autoshow-tts-batch-only-recovery-', async (dir) => {
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
      const committedJournal = await latestJournalForState(dir, lastCommitted)
      expect(committedJournal?.recordedBatchResults.length ?? 0).toBeLessThan(2)

      const resumedCalls: number[] = []
      const resumedStates: PipelineProviderState[] = []
      const reportedOutput = join(dir, 'speech-batch-only-recovered.wav')
      const resumed = await runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(resumedCalls)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [lastCommitted],
        recoveryRootDir: dir,
        resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-batch-only-recovered.wav' }),
        beforeDispatch: async () => {},
        onProviderState: async (state) => { resumedStates.push(state) }
      })

      expect(firstCalls).toEqual([0, 1])
      expect(resumedCalls).toEqual([])
      expect(await Bun.file(reportedOutput).exists()).toBe(true)
      expect(resumed.metadata[0]?.ttsAudio?.renderHistory[0]?.events.at(-1)?.status).toBe('succeeded')
      const terminalState = resumedStates.at(-1)
      const projection = terminalState?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
      const terminalEvent = projection?.renderHistory[0]?.events.at(-1)
      if (!terminalState || !terminalEvent?.providerRenderResultRef) throw new Error('Missing orphan aggregate recovery result')
      const providerResult = await Bun.file(join(dir, terminalState.artifactDir, terminalEvent.providerRenderResultRef)).json() as ProviderRenderResult
      expect(providerResult.closedBy.kind).toBe('provider-attempt')
    })
  })

  test('rejects a valid foreign journal in the exact retained attempt directory before another provider call', async () => {
    await withTempDir('autoshow-tts-foreign-orphan-journal-', async (dir) => {
      const text = 'Reject foreign retained journal evidence.'
      const sourceIdentity = createInlineTtsSourceIdentity(text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, new Date(0).toISOString())
      let providerCalls = 0
      const target = createFixtureTarget(() => { providerCalls += 1 }, 'success')
      const first = await runTtsForTargets(text, dir, {}, [target], { sourceIdentity, dialoguePlan })
      const retained = buildCurrentTtsProviderState(first.metadata[0]!)
      const projection = retained.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
      const active = projection?.activeWork
      const render = active?.kind === 'render'
        ? projection?.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
        : undefined
      const event = active?.kind === 'render'
        ? render?.events.find((entry) => entry.sequence === active.eventSequence)
        : undefined
      if (!event?.admissionJournalRef || !event.admissionJournalSnapshotId) throw new Error('Missing retained journal fixture')
      const retainedJournalPath = join(dir, retained.artifactDir, event.admissionJournalRef)
      const attemptRoot = join(retainedJournalPath, '..')
      const seedName = (await readdir(attemptRoot))
        .filter((entry) => /^admission-journal-\d+\.json$/.test(entry))
        .sort()[0]
      if (!seedName) throw new Error('Missing seed admission journal fixture')
      const foreignJournal = await Bun.file(join(attemptRoot, seedName)).json() as RenderAdmissionJournalSnapshot
      foreignJournal.previousSnapshotId = event.admissionJournalSnapshotId
      foreignJournal.invocationId = 'invocation-foreign-orphan-fixture'
      foreignJournal.journalId = hashCanonicalTtsValue({
        renderPlanId: foreignJournal.renderPlanId,
        renderIdentity: foreignJournal.renderIdentity,
        attempt: foreignJournal.attempt,
        invocationId: foreignJournal.invocationId
      })
      foreignJournal.snapshotId = hashCanonicalRecordWithout(
        foreignJournal as unknown as Record<string, unknown>,
        ['snapshotId']
      )
      await Bun.write(
        join(attemptRoot, 'admission-journal-9999.json'),
        `${canonicalTtsJson(foreignJournal)}\n`
      )
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
    })
  })

  test('recovers transitive slot results across two attempts and closes the third phase by local composition', async () => {
    await withTempDir('autoshow-tts-transitive-slot-recovery-', async (dir) => {
      const text = 'Host: First retained turn.\nGuest: Second retained turn.'
      const sourceIdentity = createInlineTtsSourceIdentity(text)
      const dialoguePlan = createGenericTtsDialoguePlan(sourceIdentity, text, DIALOGUE_OPTIONS, new Date(0).toISOString())
      const model = 'gpt-4o-mini-tts-2025-12-15'

      const phaseOneCalls: number[] = []
      let phaseOneState: PipelineProviderState | undefined
      let phaseOneInjected = false
      await expect(runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(phaseOneCalls, model)], {
        sourceIdentity,
        dialoguePlan,
        beforeDispatch: async () => {},
        onProviderState: async (state) => {
          const journal = await latestJournalForState(dir, state)
          if (!phaseOneInjected && journal?.recordedBatchResults.length === 1) {
            phaseOneState = state
            phaseOneInjected = true
            throw new Error('fixture crash after attempt one promoted slot one')
          }
        }
      })).rejects.toThrow('No TTS outputs were generated')
      if (!phaseOneState) throw new Error('Missing attempt-one retained slot state')

      let releasePhaseTwo!: () => void
      const phaseTwoHold = new Promise<void>((resolve) => { releasePhaseTwo = resolve })
      let phaseTwoCaptured!: () => void
      const phaseTwoReady = new Promise<void>((resolve) => { phaseTwoCaptured = resolve })
      const phaseTwoCalls: number[] = []
      let phaseTwoState: PipelineProviderState | undefined
      let phaseTwoInjected = false
      const phaseTwoRun = runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(phaseTwoCalls, model)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [phaseOneState],
        recoveryRootDir: dir,
        beforeDispatch: async () => {},
        onProviderState: async (state) => {
          const journal = await latestJournalForState(dir, state)
          const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
          const active = projection?.activeWork
          const render = active?.kind === 'render'
            ? projection?.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
            : undefined
          const event = active?.kind === 'render'
            ? render?.events.find((entry) => entry.sequence === active.eventSequence)
            : undefined
          const promotedSlots = event?.batchProgress?.flatMap((batch) => batch.generationSlots)
            .filter((slot) => slot.source === 'provider-dispatch' && slot.batchResult !== undefined)
          if (!phaseTwoInjected && journal?.recordedBatchResults.length === 1 && promotedSlots?.length === 2) {
            phaseTwoState = state
            phaseTwoInjected = true
            phaseTwoCaptured()
            await phaseTwoHold
            throw new Error('fixture process ended after attempt two promoted slot two')
          }
        }
      })
      await phaseTwoReady
      if (!phaseTwoState) throw new Error('Missing transitive two-slot retained state')
      const phaseTwoProjection = phaseTwoState.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
      const phaseTwoRender = phaseTwoProjection?.renderHistory[0]
      if (!phaseTwoRender) throw new Error('Missing transitive retained render')
      const attemptsRoot = join(dir, phaseTwoState.artifactDir, phaseTwoRender.renderDir, 'attempts')
      const attemptDirectoriesBeforeLocalClose = (await readdir(attemptsRoot)).filter((entry) => entry.startsWith('attempt-')).sort()
      const journalFilesBeforeLocalClose = (await readdir(attemptsRoot, { recursive: true })).filter((entry) => /admission-journal-\d+\.json$/.test(entry)).sort()

      const phaseThreeCalls: number[] = []
      const phaseThreeStates: PipelineProviderState[] = []
      const reportedOutput = join(dir, 'speech-transitive-recovered.wav')
      const phaseThree = await runTtsForTargets(text, dir, DIALOGUE_OPTIONS, [createDialogueFixtureTarget(phaseThreeCalls, model)], {
        sourceIdentity,
        dialoguePlan,
        retainedProviderStates: [phaseTwoState],
        recoveryRootDir: dir,
        resolveReportedOutput: () => ({ path: reportedOutput, fileName: 'speech-transitive-recovered.wav' }),
        beforeDispatch: async () => {},
        onProviderState: async (state) => { phaseThreeStates.push(state) }
      })
      const attemptDirectoriesAfterLocalClose = (await readdir(attemptsRoot)).filter((entry) => entry.startsWith('attempt-')).sort()
      const journalFilesAfterLocalClose = (await readdir(attemptsRoot, { recursive: true })).filter((entry) => /admission-journal-\d+\.json$/.test(entry)).sort()
      releasePhaseTwo()
      await expect(phaseTwoRun).rejects.toThrow('No TTS outputs were generated')

      expect(phaseOneCalls).toEqual([0])
      expect(phaseTwoCalls).toEqual([1])
      expect(phaseThreeCalls).toEqual([])
      expect(await Bun.file(reportedOutput).exists()).toBe(true)
      const terminalState = phaseThreeStates.at(-1)
      const projection = terminalState?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
      const render = projection?.renderHistory[0]
      const terminalEvent = render?.events.at(-1)
      if (!terminalState || !render || !terminalEvent?.providerRenderResultRef) throw new Error('Missing transitive recovery terminal evidence')
      const renderPlan = await Bun.file(join(dir, terminalState.artifactDir, render.renderPlanRef)).json() as ProviderRenderPlan
      const providerResult = await Bun.file(join(dir, terminalState.artifactDir, terminalEvent.providerRenderResultRef)).json() as ProviderRenderResult
      expect(providerResult.closedBy.kind).toBe('local-composition')
      if (providerResult.closedBy.kind !== 'local-composition') throw new Error('Expected local-composition recovery result')
      expect(providerResult.closedBy.compositionId).toBe(hashCanonicalTtsValue({
        renderPlanId: providerResult.renderPlanId,
        renderIdentity: providerResult.renderIdentity,
        batchResults: providerResult.batchResults
      }))
      expect(providerResult.batchResults).toHaveLength(2)
      expect(providerResult.cost.currentComposition.planned).toEqual(renderPlan.plannedCost)
      expect(providerResult.cost.closingAttempt.planned).toEqual({ amounts: [] })
      expect(providerResult.cost.cumulativeRenderHistory.planned).toEqual(renderPlan.plannedCost)
      expect(terminalEvent.attempt).toBe(2)
      expect(terminalEvent.readinessAuthorization).toBeUndefined()
      expect(terminalEvent.admissionJournalRef).toBeUndefined()
      expect(terminalEvent.admissionJournalSnapshotId).toBeUndefined()
      expect(attemptDirectoriesAfterLocalClose).toEqual(attemptDirectoriesBeforeLocalClose)
      expect(journalFilesAfterLocalClose).toEqual(journalFilesBeforeLocalClose)
      expect(phaseThree.metadata[0]?.ttsAudio?.selectedSuccess?.resultIdentity).toBe(providerResult.resultIdentity)

      const metadata = phaseThree.metadata[0]
      if (!metadata?.targetKey || !metadata.operation || !metadata.transport) throw new Error('Missing transitive recovery target metadata')
      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      const providerState = bindTtsDialoguePlanArtifact(buildCurrentTtsProviderState(metadata), dialoguePlanArtifact)
      await writeGenerationMetadata(dir, 'tts', phaseThree.metadata, {}, {}, {
        input: text,
        requestedProviders: [{ service: 'openai', model, operation: metadata.operation, targetKey: metadata.targetKey, transport: metadata.transport }],
        completedProviders: [{ service: 'openai', model }],
        providerStates: [providerState]
      })
      const manifest = await readManifest(dir)
      expect(manifest?.items[0]?.status).toBe('full')
      expect(manifest?.items[0]?.providers[0]?.result).toEqual({ ttsAudio: metadata.ttsAudio })

      if (!manifest) throw new Error('Missing valid local-composition manifest fixture')
      const resultArtifactPath = join(dir, terminalState.artifactDir, terminalEvent.providerRenderResultRef)
      const originalResultBytes = await Bun.file(resultArtifactPath).bytes()
      await unlink(join(dir, PIPELINE_MANIFEST_FILE))

      const failedAssemblyError = {
        phase: 'assembly' as const,
        code: 'fixture-local-assembly-failed',
        message: 'Fixture local assembly failed.',
        retryable: true
      }
      const makeFailedLocalResultManifest = () => {
        const mutated = structuredClone(manifest)
        const item = mutated.items[0]
        const provider = item?.providers[0]
        const projection = provider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
        const active = projection?.activeWork
        const activeRender = active?.kind === 'render'
          ? projection?.renderHistory.find((entry) => entry.renderIdentity === active.renderIdentity)
          : undefined
        const event = active?.kind === 'render'
          ? activeRender?.events.find((entry) => entry.sequence === active.eventSequence)
          : undefined
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
          pointer.action !== 'select-success'
          || pointer.renderIdentity !== activeRender?.renderIdentity
          || pointer.eventSequence !== event.sequence)
        provider.status = 'failed'
        provider.error = failedAssemblyError
        provider.metadata = { ...provider.metadata, ttsAudio: projection }
        provider.result = { ttsAudio: projection }
        item.status = 'failed'
        return { mutated, event }
      }

      const wrongCompositionResult = structuredClone(providerResult)
      if (wrongCompositionResult.closedBy.kind !== 'local-composition') throw new Error('Missing mutable local-composition result fixture')
      wrongCompositionResult.closedBy.compositionId = '0'.repeat(64)
      wrongCompositionResult.resultIdentity = hashCanonicalRecordWithout(
        wrongCompositionResult as unknown as Record<string, unknown>,
        ['resultIdentity']
      )
      const wrongCompositionBytes = `${canonicalTtsJson(wrongCompositionResult)}\n`
      await Bun.write(resultArtifactPath, wrongCompositionBytes)
      const wrongCompositionManifest = makeFailedLocalResultManifest()
      wrongCompositionManifest.event.providerRenderResultIdentity = wrongCompositionResult.resultIdentity
      wrongCompositionManifest.event.providerRenderResultSha256 = sha256Bytes(wrongCompositionBytes)
      await expect(writeManifest(dir, wrongCompositionManifest.mutated)).rejects.toThrow('Invalid canonical manifest')

      await Bun.write(resultArtifactPath, originalResultBytes)
      const fabricatedJournalManifest = structuredClone(manifest)
      const fabricatedProvider = fabricatedJournalManifest.items[0]?.providers[0]
      const fabricatedProjection = fabricatedProvider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
      const fabricatedActive = fabricatedProjection?.activeWork
      const fabricatedRender = fabricatedActive?.kind === 'render'
        ? fabricatedProjection?.renderHistory.find((entry) => entry.renderIdentity === fabricatedActive.renderIdentity)
        : undefined
      const fabricatedEvent = fabricatedActive?.kind === 'render'
        ? fabricatedRender?.events.find((entry) => entry.sequence === fabricatedActive.eventSequence)
        : undefined
      const providerAttemptEvent = [...(fabricatedRender?.events ?? [])].reverse().find((event) =>
        event.admissionJournalRef !== undefined && event.readinessAuthorization !== undefined)
      if (!fabricatedProvider || !fabricatedProjection || !fabricatedEvent || !providerAttemptEvent?.admissionJournalRef || !providerAttemptEvent.admissionJournalSha256 || !providerAttemptEvent.admissionJournalSnapshotId || !providerAttemptEvent.readinessAuthorization) {
        throw new Error('Missing provider-attempt evidence for fabricated local journal mutation')
      }
      fabricatedEvent.readinessAuthorization = providerAttemptEvent.readinessAuthorization
      fabricatedEvent.admissionJournalSnapshotId = providerAttemptEvent.admissionJournalSnapshotId
      fabricatedEvent.admissionJournalRef = providerAttemptEvent.admissionJournalRef
      fabricatedEvent.admissionJournalSha256 = providerAttemptEvent.admissionJournalSha256
      fabricatedProvider.metadata = { ...fabricatedProvider.metadata, ttsAudio: fabricatedProjection }
      fabricatedProvider.result = { ttsAudio: fabricatedProjection }
      await expect(writeManifest(dir, fabricatedJournalManifest)).rejects.toThrow('Invalid canonical manifest')
    })
  })
})
