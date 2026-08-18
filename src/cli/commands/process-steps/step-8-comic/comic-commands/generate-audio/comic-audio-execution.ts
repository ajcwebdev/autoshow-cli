import { join } from 'node:path'
import type {
  ApprovedVoiceSnapshotEntry,
  ComicAudioDeliveryPolicy,
  ComicAudioMode,
  ComicTtsRenderContext,
  PipelineProviderState,
  ProtectedAssetRef,
  TtsOptions,
  TtsTarget,
  TtsTurnControls,
  VoiceReferenceManifest,
} from '~/types'
import { canonicalTargetKey } from '../../../step-4-tts/script-to-audio/contract-identity'
import { prepareComicSegmentedProviderTexts } from '../../../step-4-tts/script-to-audio/current-render-attempt'
import { runTtsForTargets } from '../../../step-4-tts/run-tts'
import { validateTtsTargetsForExecution } from '../../../step-4-tts/tts-targets'
import { createResourceGate } from '~/utils/resource-gate'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import type { createComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import type { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { appendComicAudioProviderState, updateComicAudioManifest } from '../../comic-utils/comic-manifest'
import { flattenTurns } from './comic-audio-invocation'
import { providerStageStatus } from './comic-audio-staging'

export const voiceLocator = (entry: ApprovedVoiceSnapshotEntry): { value: string, protectedAsset?: ProtectedAssetRef | undefined } => {
  const voice = entry.providerVoice
  if (voice.kind === 'remote-resource') return { value: voice.resourceId }
  if (voice.kind === 'reference-asset') return { value: `ref_audio:${voice.protectedAsset.assetId}`, protectedAsset: voice.protectedAsset }
  if (voice.kind !== 'shared-library-resource') throw CLIUsageError('Comic audio requires a materialized saved, stock, or reference voice.')
  throw CLIUsageError(`Shared-library voice ${voice.sharedVoiceId} must be imported and approved as an account resource before comic synthesis.`)
}

export const buildTargetExecution = (input: {
  target: TtsTarget
  baseOptions: TtsOptions
  snapshot: VoiceReferenceManifest
  dialoguePlan: ReturnType<typeof createComicDialoguePlan>
  mode: ComicAudioMode
  deliveryPolicy: ComicAudioDeliveryPolicy
  sampleRate: number
  channels: 1 | 2
  codec: 'pcm_s16le' | 'pcm_s24le'
  resourceGate: ReturnType<typeof createResourceGate>
}): { target: TtsTarget, options: TtsOptions, sourceText: string, context: ComicTtsRenderContext } => {
  const operation = 'comic-audio' as const
  const transport = input.target.transport ?? 'hosted-api'
  const target: TtsTarget = {
    ...input.target,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, input.target.service, input.target.model, transport),
    ...(input.mode === 'segmented' ? { multiSpeakerStrategy: 'segment-and-concat' as const } : {}),
  }
  const turns = flattenTurns(input.dialoguePlan)
  const subjectLabels = new Map<string, string>()
  const providerSpeakerLabelByTurnId: Record<string, string> = {}
  const snapshotEntryIdByTurnId: Record<string, string> = {}
  const speakers = new Map<string, string>()
  const protectedSpeakerVoiceAssets: Record<string, ProtectedAssetRef> = {}
  const turnControls: Record<string, Record<string, ApprovedVoiceSnapshotEntry['synthesisSettings']['values']>> = {}
  const deliveryDispositionByTurnId: Record<string, 'none' | 'serialized' | 'unsupported-best-effort'> = {}
  const canonicalTurns = turns.map((turn) => {
    let speaker = subjectLabels.get(turn.subjectKey)
    if (!speaker) {
      speaker = `VOICE_${String(subjectLabels.size + 1).padStart(3, '0')}`
      subjectLabels.set(turn.subjectKey, speaker)
    }
    const entry = input.snapshot.entries.find((candidate: ApprovedVoiceSnapshotEntry) =>
      candidate.provider === target.service
      && candidate.providerModel === target.model
      && candidate.subjectKey === turn.subjectKey
    )
    if (!entry) throw CLIUsageError(`Aggregate voice snapshot has no ${target.service}/${target.model} binding for ${turn.subjectKey}.`)
    const locator = voiceLocator(entry)
    const prior = speakers.get(speaker)
    if (prior && prior !== locator.value) throw CLIUsageError(`Comic provider speaker ${speaker} resolves to conflicting approved voices.`)
    speakers.set(speaker, locator.value)
    if (locator.protectedAsset) protectedSpeakerVoiceAssets[speaker] = locator.protectedAsset
    providerSpeakerLabelByTurnId[turn.turnId] = speaker
    snapshotEntryIdByTurnId[turn.turnId] = entry.entryId
    const delivery = turn.delivery?.description
    if (delivery && target.service === 'hume' && target.model === 'octave-2') {
      if (input.deliveryPolicy === 'strict') throw CLIUsageError(`Hume Octave 2 cannot serialize authored delivery for ${turn.turnId}; use --delivery-policy best-effort to record the degradation.`)
      deliveryDispositionByTurnId[turn.turnId] = 'unsupported-best-effort'
    } else {
      deliveryDispositionByTurnId[turn.turnId] = delivery ? 'serialized' : 'none'
    }
    turnControls[turn.turnId] = {
      [target.service]: {
        ...entry.synthesisSettings.values,
        ...(delivery && target.service === 'hume' && target.model === 'octave-1' ? { description: delivery } : {}),
      }
    }
    return {
      turnId: turn.turnId,
      speaker,
      text: turn.canonicalText,
      providerSegments: prepareComicSegmentedProviderTexts(turn, target).providerTexts,
    }
  })
  const ttsSpeakers = [...speakers].map(([speaker, locator]) => `${speaker}=${locator}`)
  const options: TtsOptions = {
    ...input.baseOptions,
    generationResourceGate: input.resourceGate,
    ttsDialogueFormat: 'labeled',
    ttsSpeakers,
    ttsCanonicalTurns: canonicalTurns,
    ttsTurnControls: turnControls as TtsTurnControls,
    ttsMasteringProfile: { schemaVersion: 1, sampleRate: input.sampleRate, channels: input.channels, codec: input.codec, container: 'wav' },
  }
  if (Object.keys(protectedSpeakerVoiceAssets).length > 0) target.protectedSpeakerVoiceAssets = protectedSpeakerVoiceAssets
  if (['elevenlabs', 'hume', 'minimax', 'cartesia', 'speechify', 'inworld'].includes(target.service)) {
    target.readinessVoiceIds = [...new Set(input.snapshot.entries.filter((entry: ApprovedVoiceSnapshotEntry) => entry.provider === target.service && entry.providerModel === target.model && entry.providerVoice.kind === 'remote-resource').map((entry: ApprovedVoiceSnapshotEntry) => (entry.providerVoice as Extract<typeof entry.providerVoice, { kind: 'remote-resource' }>).resourceId))]
  }
  const context: ComicTtsRenderContext = {
    operation,
    sourceIdentity: input.dialoguePlan.sourceIdentity,
    dialoguePlan: input.dialoguePlan,
    voiceSnapshot: input.snapshot,
    snapshotEntryIdByTurnId,
    providerSpeakerLabelByTurnId,
    modePreference: input.mode,
    deliveryPolicy: input.deliveryPolicy,
    deliveryDispositionByTurnId,
  }
  return { target, options, sourceText: canonicalTurns.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'), context }
}

export const executeComicAudioTargets = async (input: {
  compatible: Awaited<ReturnType<typeof resolveCompatibleComicSceneRun>>
  executions: Array<{ target: TtsTarget, options: TtsOptions, sourceText: string, context: ComicTtsRenderContext }>
  dialogueStageTargetKeys: string[]
  baseArtifacts: Array<{ path: string, sha256: string }>
  audioMetadata: Record<string, unknown>
}) => {
  const { compatible, executions, dialogueStageTargetKeys, baseArtifacts, audioMetadata } = input
  const readiness = await validateTtsTargetsForExecution(executions.map(execution => execution.target))
  const targetKeys = executions.map(execution => execution.target.targetKey as string)
  const prepared = new Map<string, PipelineProviderState>()
  let releaseBarrier!: () => void
  let rejectBarrier!: (error: unknown) => void
  const dispatchBarrier = new Promise<void>((resolve, reject) => { releaseBarrier = resolve; rejectBarrier = reject })
  let barrierCommitStarted = false
  const beforeDispatch = async (states: PipelineProviderState[]): Promise<void> => {
    for (const state of states) if (state.targetKey) prepared.set(state.targetKey, state)
    if (prepared.size === executions.length && !barrierCommitStarted) {
      barrierCommitStarted = true
      try {
        const ordered = targetKeys.map(targetKey => prepared.get(targetKey) as PipelineProviderState)
        const priorByTarget = new Map((compatible.manifest.items[0]?.providers ?? []).map(provider => [provider.targetKey, provider] as const))
        for (const state of ordered) priorByTarget.set(state.targetKey, state)
        await updateComicAudioManifest({
          sceneRunDir: compatible.sceneRunDir,
          sourceIdentity: compatible.sourceIdentity,
          stage: { requirement: 'required', status: providerStageStatus(dialogueStageTargetKeys, [...priorByTarget.values()]), execution: { kind: 'provider-targets' }, targetKeys: dialogueStageTargetKeys as [string, ...string[]], artifactRefs: baseArtifacts },
          audio: audioMetadata,
          providers: ordered,
        })
        releaseBarrier()
      } catch (error) {
        rejectBarrier(error)
      }
    }
    await dispatchBarrier
  }
  const settled = await Promise.allSettled(executions.map(async (execution) => {
    try {
      return await runTtsForTargets(
        execution.sourceText,
        compatible.sceneRunDir,
        execution.options,
        [execution.target],
        {
          artifactOutputDir: compatible.sceneRunDir,
          artifactRoot: 'audio/providers',
          recoveryRootDir: compatible.sceneRunDir,
          retainedProviderStates: compatible.manifest.items[0]?.providers,
          executionReadiness: readiness,
          comicContext: execution.context,
          resolveReportedOutput: (target) => ({ path: join(compatible.sceneRunDir, 'audio', 'final', `${target.targetKey}.wav`), fileName: `audio/final/${target.targetKey}.wav` }),
          beforeDispatch,
          onProviderState: async (state) => { await appendComicAudioProviderState({ sceneRunDir: compatible.sceneRunDir, sourceIdentity: compatible.sourceIdentity, targetKeys: dialogueStageTargetKeys, state }) },
        }
      )
    } catch (error) {
      rejectBarrier(error)
      throw error
    }
  }))
  const failures = settled.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (failures.length > 0) throw InfraError(`Comic audio failed for ${failures.length}/${executions.length} target(s): ${failures.map(error => error instanceof Error ? error.message : String(error)).join('; ')}`, {
    stage: 'comic:generate-audio',
    ...(failures[0] instanceof Error ? { cause: failures[0] } : {}),
    metadata: { failureCount: failures.length, targetCount: executions.length }
  })

  return settled
}
