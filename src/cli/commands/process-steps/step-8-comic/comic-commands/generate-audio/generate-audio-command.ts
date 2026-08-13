import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ApprovedVoiceSnapshotEntry,
  CliCommandContext,
  ComicAudioMode,
  ComicAudioDeliveryPolicy,
  ComicAudioPacingProfile,
  ComicAudioRolePolicy,
  ComicTtsRenderContext,
  PipelineProviderState,
  ProtectedAssetRef,
  Step4Metadata,
  TtsOptions,
  TtsTarget,
  TtsTurnControls,
} from '~/types'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { canonicalTargetKey, sha256Bytes } from '../../../step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsResumePrice, prepareComicSegmentedProviderTexts } from '../../../step-4-tts/script-to-audio/current-render-attempt'
import { runTtsForTargets, validateTtsRenderInputsForTargets } from '../../../step-4-tts/run-tts'
import { collectTtsTargets, validateTtsTargetsForExecution } from '../../../step-4-tts/tts-targets'
import { createResourceGate } from '~/utils/resource-gate'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { createComicDialoguePlan, writeComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { appendComicAudioProviderState, updateComicAudioManifest } from '../../comic-utils/comic-manifest'
import { readManifest } from '../../../pipeline-manifest'
import { bindSnapshotRenderIdentities, buildVoiceReferenceManifest, loadVoiceReferenceManifest, writeVoiceReferenceManifest } from '../../comic-utils/voice-reference-snapshot'
import { assertProtectedStoreOutputDisjoint } from '../../../step-4-tts/voice-assets/protected-output-boundary'
import { MANAGED_VOICE_STORE_ROOT } from '../../../step-4-tts/voice-management/managed-voice-store'
import { createHostedTtsChunkScheduler } from '../../../step-4-tts/tts-utils/hosted-tts-chunk-scheduler'

const DEFAULT_PROFILE = 'default'
const DEFAULT_SAMPLE_RATE = 48000

const repeatableStrings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((entry): entry is string => typeof entry === 'string')
  : typeof value === 'string' ? [value] : []

const parseInteger = (value: unknown, fallback: number, label: string): number => {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) <= 0) throw CLIUsageError(`${label} must be a positive integer.`)
  return Number(value)
}

const parseOptionalPositiveInteger = (value: unknown, label: string): number | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) throw CLIUsageError(`${label} must be a positive safe integer.`)
  return Number(value)
}

const parseRolePolicies = (values: readonly string[]): ComicAudioRolePolicy[] => values.map((value) => {
  const separator = value.indexOf('=')
  const speakerLabel = value.slice(0, separator).trim()
  const subjectKey = value.slice(separator + 1).trim()
  if (separator <= 0 || !speakerLabel || !/^(?:role|voice):[a-z0-9][a-z0-9_-]{0,127}$/.test(subjectKey)) throw CLIUsageError(`Invalid --role "${value}". Expected LABEL=role:key or LABEL=voice:key.`)
  return { speakerLabel, subjectKey }
})

const parseMode = (value: unknown): ComicAudioMode => {
  const mode = value ?? 'auto'
  if (mode !== 'auto' && mode !== 'native' && mode !== 'segmented') throw CLIUsageError('--mode must be auto, native, or segmented.')
  return mode
}

const parseDeliveryPolicy = (value: unknown): ComicAudioDeliveryPolicy => {
  const policy = value ?? 'strict'
  if (policy !== 'strict' && policy !== 'best-effort') throw CLIUsageError('--delivery-policy must be strict or best-effort.')
  return policy
}

const parsePacingProfile = (value: unknown): ComicAudioPacingProfile => {
  const profile = value ?? 'none'
  if (profile !== 'none' && profile !== 'loose-comedy') throw CLIUsageError('--pacing-profile must be none or loose-comedy.')
  return profile
}

const flattenTurns = (plan: Awaited<ReturnType<typeof createComicDialoguePlan>>) =>
  plan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)

const voiceLocator = (entry: ApprovedVoiceSnapshotEntry): { value: string, protectedAsset?: ProtectedAssetRef | undefined } => {
  const voice = entry.providerVoice
  if (voice.kind === 'remote-resource') return { value: voice.resourceId }
  if (voice.kind === 'local-model-voice') return { value: voice.voiceLocator }
  if (voice.kind === 'reference-asset') return { value: `ref_audio:${voice.protectedAsset.assetId}`, protectedAsset: voice.protectedAsset }
  throw CLIUsageError(`Shared-library voice ${voice.sharedVoiceId} must be imported and approved as an account resource before comic synthesis.`)
}

const withoutInheritedVoiceSelection = (options: TtsOptions): TtsOptions => ({
  ...options,
  ttsSpeaker: '',
  ttsDialogueFormat: undefined,
  ttsSpeakers: undefined,
  groqVoiceId: undefined,
  grokTtsVoice: undefined,
  mistralTtsVoice: undefined,
  openaiVoiceId: undefined,
  geminiVoiceId: undefined,
  elevenlabsVoiceId: undefined,
  deepgramVoiceId: undefined,
  minimaxTtsVoice: undefined,
  speechifyVoice: undefined,
  humeTtsVoice: undefined,
  cartesiaTtsVoice: undefined,
})

const buildTargetExecution = (input: {
  target: TtsTarget
  baseOptions: TtsOptions
  snapshot: Awaited<ReturnType<typeof buildVoiceReferenceManifest>>
  dialoguePlan: Awaited<ReturnType<typeof createComicDialoguePlan>>
  mode: ComicAudioMode
  deliveryPolicy: ComicAudioDeliveryPolicy
  sampleRate: number
  channels: 1 | 2
  codec: 'pcm_s16le' | 'pcm_s24le'
  resourceGate: ReturnType<typeof createResourceGate>
}): { target: TtsTarget, options: TtsOptions, sourceText: string, context: ComicTtsRenderContext } => {
  const operation = 'comic-audio' as const
  const transport = input.target.transport ?? (input.target.service === 'kitten' ? 'local-process' : 'hosted-api')
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
    const entry = input.snapshot.entries.find(candidate =>
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
  if (target.service === 'elevenlabs' || target.service === 'hume') {
    target.readinessVoiceIds = [...new Set(input.snapshot.entries.filter(entry => entry.provider === target.service && entry.providerModel === target.model && entry.providerVoice.kind === 'remote-resource').map(entry => (entry.providerVoice as Extract<typeof entry.providerVoice, { kind: 'remote-resource' }>).resourceId))]
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

const stageArtifactRefs = (input: {
  structured: { path: string, sha256: string }
  dialogue: { path: string, sha256: string }
  snapshot?: { path: string, sha256: string } | undefined
  extra?: Array<{ path: string, sha256: string }> | undefined
}) => [
  { path: input.structured.path, sha256: input.structured.sha256 },
  { path: input.dialogue.path, sha256: input.dialogue.sha256 },
  ...(input.snapshot ? [{ path: input.snapshot.path, sha256: input.snapshot.sha256 }] : []),
  ...(input.extra ?? []).map(ref => ({ path: ref.path, sha256: ref.sha256 })),
]

const providerStageStatus = (targetKeys: readonly string[], states: readonly PipelineProviderState[]): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  const owned = targetKeys.map(targetKey => states.find(state => state.targetKey === targetKey))
  if (owned.some(state => !state)) return 'incomplete'
  const selected = owned as PipelineProviderState[]
  if (selected.every(state => state.status === 'skipped')) return 'skipped'
  if (selected.some(state => state.status === 'succeeded') && selected.every(state => state.status === 'succeeded' || state.status === 'skipped')) return 'full'
  if (selected.some(state => state.status === 'failed') && selected.every(state => state.status === 'failed' || state.status === 'skipped')) return 'failed'
  return 'incomplete'
}

export const assertVoiceSnapshotCoversSelectedTargets = (input: {
  snapshot: Awaited<ReturnType<typeof buildVoiceReferenceManifest>>
  targets: ReadonlyArray<{ service: string, model: string }>
  subjectKeys: readonly string[]
  profileKey: string
}): void => {
  const selectedTargets = new Set(input.targets.map(target => `${target.service}\0${target.model}`))
  const snapshotTargets = new Set(input.snapshot.entries.map(entry => `${entry.provider}\0${entry.providerModel}`))
  const selectedBindings = new Set(input.targets.flatMap(target => input.subjectKeys.map(subjectKey => `${target.service}\0${target.model}\0${input.profileKey}\0${subjectKey}`)))
  const completeSnapshotBindings = new Set([...snapshotTargets].flatMap(target => {
    const [provider, model] = target.split('\0')
    return input.subjectKeys.map(subjectKey => `${provider}\0${model}\0${input.profileKey}\0${subjectKey}`)
  }))
  const snapshotBindings = new Set(input.snapshot.entries.map(entry => `${entry.provider}\0${entry.providerModel}\0${entry.profileKey}\0${entry.subjectKey}`))
  if ([...selectedTargets].some(key => !snapshotTargets.has(key)) || completeSnapshotBindings.size !== input.snapshot.entries.length || snapshotBindings.size !== input.snapshot.entries.length || [...completeSnapshotBindings].some(key => !snapshotBindings.has(key)) || [...selectedBindings].some(key => !snapshotBindings.has(key))) throw CLIUsageError('Retained scene snapshot is not a complete immutable superset of the selected provider/model/profile/subject bindings; start a new canonical scene run for a recast.')
}

export const generateComicAudio = async (ctx: CliCommandContext, scriptPath: string): Promise<void> => {
  const flags = ctx.flags as Record<string, unknown>
  const profileKey = typeof flags['profile'] === 'string' && flags['profile'].trim() ? flags['profile'].trim() : DEFAULT_PROFILE
  const mode = parseMode(flags['mode'])
  const deliveryPolicy = parseDeliveryPolicy(flags['delivery-policy'])
  const pacingProfile = parsePacingProfile(flags['pacing-profile'])
  const rolePolicies = parseRolePolicies(repeatableStrings(flags['role']))
  const sampleRate = parseInteger(flags['sample-rate'], DEFAULT_SAMPLE_RATE, '--sample-rate')
  const channelsValue = parseInteger(flags['channels'], 2, '--channels')
  if (channelsValue !== 1 && channelsValue !== 2) throw CLIUsageError('--channels must be 1 or 2.')
  const channels = channelsValue as 1 | 2
  const codecValue = flags['codec'] ?? 'pcm_s24le'
  if (codecValue !== 'pcm_s16le' && codecValue !== 'pcm_s24le') throw CLIUsageError('--codec must be pcm_s16le or pcm_s24le.')
  const codec = codecValue
  const price = flags['price'] === true
  const allowAmbiguousRedispatch = flags['allow-ambiguous-redispatch'] === true
  const maxGenerationSlots = parseOptionalPositiveInteger(flags['max-generation-slots'], '--max-generation-slots')
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    flags,
    ctx.rawParsed.explicitFlags,
    ctx.rawParsed.flagOccurrences,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts', allLocalTarget: 'all-local-tts' }
  )
  const baseOptions = withoutInheritedVoiceSelection(buildOptsFromFlags(
    true,
    providerNormalized.flags,
    { defaultTtsEngine: 'kitten' },
    providerNormalized.explicitFlags,
    { flagOccurrences: providerNormalized.flagOccurrences }
  ) as TtsOptions)
  baseOptions.ttsAllowAmbiguousRedispatch = allowAmbiguousRedispatch
  baseOptions.ttsMaxGenerationSlots = maxGenerationSlots
  if (allowAmbiguousRedispatch) l.write('warn', 'Ambiguous TTS redispatch is explicitly authorized for this run; a provider-admitted slot without retained audio may be purchased again.')
  const compatible = await resolveCompatibleComicSceneRun({ scriptPath })
  await assertProtectedStoreOutputDisjoint(compatible.sceneRunDir, MANAGED_VOICE_STORE_ROOT)
  const dialoguePlan = createComicDialoguePlan({
    structuredScript: compatible.structuredScript,
    sourceIdentity: compatible.sourceIdentity,
    structuredScriptRef: compatible.comicMetadata.audio.structuredScript as NonNullable<typeof compatible.comicMetadata.audio.structuredScript>,
    sceneRunIdentity: compatible.comicMetadata.audio.sceneRunIdentity as string,
    createdAt: compatible.manifest.createdAt,
    pacingProfile,
    rolePolicies,
  })
  const turns = flattenTurns(dialoguePlan)
  if (turns.length === 0) {
    if (price) {
      l.write('info', 'Comic audio price: 0 speakable turns; no provider work or artifact writes.')
      return
    }
    const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
    const structuredRef = dialoguePlan.structuredScript
    await updateComicAudioManifest({
      sceneRunDir: compatible.sceneRunDir,
      sourceIdentity: compatible.sourceIdentity,
      stage: {
        requirement: 'required', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [],
        artifactRefs: stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef }),
      },
      audio: { sceneRunIdentity: dialoguePlan.sceneRunIdentity, structuredScript: structuredRef, dialoguePlanId: dialoguePlan.dialoguePlanId, dialoguePlanRef: dialogueRef },
      providers: [],
    })
    l.write('info', `Comic audio completed locally with no speakable turns: ${compatible.sceneRunDir}`)
    return
  }

  const collectedTargets = collectTtsTargets(baseOptions)
  if (collectedTargets.length === 0) throw CLIUsageError('Comic audio requires at least one selected TTS provider target.')
  const targets = collectedTargets.map((target) => {
    const transport = target.transport ?? (target.service === 'kitten' ? 'local-process' : 'hosted-api')
    return { ...target, operation: 'comic-audio' as const, transport, targetKey: canonicalTargetKey('comic-audio', target.service, target.model, transport) }
  })
  if (new Set(targets.map(target => target.targetKey)).size !== targets.length) throw CLIUsageError('Comic audio provider selection contains duplicate operation-scoped provider/model targets.')
  const retainedSnapshot = await loadVoiceReferenceManifest({ sceneRunDir: compatible.sceneRunDir, sceneRunIdentity: dialoguePlan.sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId })
  const snapshot = retainedSnapshot?.manifest ?? await buildVoiceReferenceManifest({
      charactersRoot: getCharactersRoot(),
      dialoguePlan,
      targets: targets.map(target => ({ provider: target.service, model: target.model })),
      profileKey,
      createdAt: compatible.manifest.createdAt,
    })
  const snapshotSubjects = [...new Set(turns.map(turn => turn.subjectKey))]
  assertVoiceSnapshotCoversSelectedTargets({ snapshot, targets, subjectKeys: snapshotSubjects, profileKey })
  baseOptions.hostedTtsChunkScheduler ??= createHostedTtsChunkScheduler(baseOptions.ttsChunkConcurrency)
  const hostedResourceGate = createResourceGate({ capacity: baseOptions.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY })
  const localResourceGate = createResourceGate({ capacity: baseOptions.ttsLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY })
  const executions = targets.map(target => buildTargetExecution({ target, baseOptions, snapshot, dialoguePlan, mode, deliveryPolicy, sampleRate, channels, codec, resourceGate: target.service === 'kitten' ? localResourceGate : hostedResourceGate }))
  for (const execution of executions) validateTtsRenderInputsForTargets([execution.target], execution.sourceText, execution.options, { comicContext: execution.context })

  if (price) {
    for (const execution of executions) {
      const retainedState = compatible.manifest.items[0]?.providers.find((state) => state.targetKey === execution.target.targetKey)
      const estimate = await planCurrentTtsResumePrice({
        rootDir: compatible.sceneRunDir,
        state: retainedState,
        target: execution.target,
        sourceText: execution.sourceText,
        ttsOptions: execution.options,
        comicContext: execution.context
      })
      const cost = estimate.plannedCost.amounts.map(amount => `${amount.amount.toFixed(4)} ${amount.currency}`).join(', ') || '0'
      const resumeDetail = maxGenerationSlots !== undefined
        ? `, ${estimate.plannedSlotCount} unresolved slot checkpoint`
        : estimate.recoveredSlotCount === 0
          ? ''
          : estimate.unresolvedSlotCount === 0
            ? ', 0 unresolved slots, local finalization only'
            : `, ${estimate.unresolvedSlotCount} unresolved slots remaining`
      const blockedSlotCount = new Set(estimate.reconciliationBlockers.map((blocker) => blocker.generationSlotId)).size
      const reconciliationDetail = blockedSlotCount === 0
        ? ''
        : allowAmbiguousRedispatch
          ? `, ${blockedSlotCount} ambiguous slot redispatch authorized`
          : `, blocked: ${blockedSlotCount} unresolved ${blockedSlotCount === 1 ? 'slot requires' : 'slots require'} reconciliation`
      l.write('info', `${execution.target.service}/${execution.target.model}: ${estimate.readiness.strategy}, ${cost}${resumeDetail}${reconciliationDetail}`)
    }
    return
  }

  const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
  const snapshotRef = retainedSnapshot?.ref ?? await writeVoiceReferenceManifest(compatible.sceneRunDir, snapshot)
  const structuredRef = dialoguePlan.structuredScript
  const baseArtifacts = stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, snapshot: snapshotRef })
  const audioMetadata = {
    ...compatible.comicMetadata.audio,
    dialoguePlanId: dialoguePlan.dialoguePlanId,
    dialoguePlanRef: dialogueRef,
    snapshotId: snapshot.snapshotId,
    snapshotRef,
  }
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: compatible.comicMetadata.stages.audio,
    audio: audioMetadata,
  })
  await mkdir(join(compatible.sceneRunDir, 'audio', 'final'), { recursive: true })

  const readiness = await validateTtsTargetsForExecution(executions.map(execution => execution.target))
  const targetKeys = executions.map(execution => execution.target.targetKey as string)
  const stageTargetKeys = [...new Set([...compatible.comicMetadata.stages.audio.targetKeys, ...targetKeys])]
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
          stage: { requirement: 'required', status: providerStageStatus(stageTargetKeys, [...priorByTarget.values()]), execution: { kind: 'provider-targets' }, targetKeys: stageTargetKeys as [string, ...string[]], artifactRefs: baseArtifacts },
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
          onProviderState: async (state) => { await appendComicAudioProviderState({ sceneRunDir: compatible.sceneRunDir, sourceIdentity: compatible.sourceIdentity, targetKeys: stageTargetKeys, state }) },
        }
      )
    } catch (error) {
      rejectBarrier(error)
      throw error
    }
  }))
  const failures = settled.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
  if (failures.length > 0) throw CLIUsageError(`Comic audio failed for ${failures.length}/${executions.length} target(s): ${failures.map(error => error instanceof Error ? error.message : String(error)).join('; ')}`)

  const metadata = settled.flatMap(result => result.status === 'fulfilled' ? result.value.metadata : [])
  const completedMetadata = metadata.filter((entry) => !entry.generationCheckpoint)
  const checkpoints = metadata.flatMap((entry) => entry.generationCheckpoint ? [{ entry, checkpoint: entry.generationCheckpoint }] : [])
  const selectedAudioRuns = completedMetadata.map((entry) => {
    if (!entry.targetKey || !entry.renderIdentity || !entry.audioRunId || !entry.comicAudio?.selectedSuccess) throw CLIUsageError('Completed comic target is missing selected audio-run evidence.')
    const selected = entry.comicAudio.selectedSuccess
    const render = entry.comicAudio.renderHistory.find(candidate => candidate.renderIdentity === selected.renderIdentity)
    const event = render?.events.find(candidate => candidate.sequence === selected.eventSequence)
    if (!event?.audioRunRef || !event.audioRunSha256 || !entry.artifactDir) throw CLIUsageError('Completed comic target audio run is not checksum-bound.')
    return { targetKey: entry.targetKey, renderIdentity: entry.renderIdentity, audioRunId: entry.audioRunId, audioRunRef: `${entry.artifactDir}/${event.audioRunRef}`, audioRunSha256: event.audioRunSha256 }
  })
  const finalOutputRefs = await Promise.all(completedMetadata.map(async entry => {
    const path = entry.audioFileName
    return { path, sha256: sha256Bytes(new Uint8Array(await Bun.file(join(compatible.sceneRunDir, path)).arrayBuffer())) }
  }))
  const selectedRunByTarget = new Map((compatible.comicMetadata.audio.selectedAudioRuns ?? []).map(run => [run.targetKey, run] as const))
  for (const run of selectedAudioRuns) selectedRunByTarget.set(run.targetKey, run)
  const mergedSelectedAudioRuns = [...selectedRunByTarget.values()].sort((left, right) => left.targetKey.localeCompare(right.targetKey))
  const finalOutputByPath = new Map((compatible.comicMetadata.audio.finalOutputRefs ?? []).map(ref => [ref.path, ref] as const))
  for (const ref of finalOutputRefs) finalOutputByPath.set(ref.path, ref)
  const mergedFinalOutputRefs = [...finalOutputByPath.values()].sort((left, right) => left.path.localeCompare(right.path))
  const nextEvaluation = completedMetadata.map(entry => ({
    ttsService: entry.ttsService,
    ttsModel: entry.ttsModel,
    ...(entry.speaker ? { speaker: entry.speaker } : {}),
    ...(entry.language ? { language: entry.language } : {}),
    processingTime: entry.processingTime,
    audioFileName: entry.audioFileName,
    audioFileSize: entry.audioFileSize,
    chunkCount: entry.chunkCount,
  }))
  const evaluationByTarget = new Map<string, Step4Metadata>()
  const priorEvaluation = compatible.manifest.items[0]?.metadata['tts']
  if (Array.isArray(priorEvaluation)) for (const entry of priorEvaluation as Step4Metadata[]) evaluationByTarget.set(`${entry.ttsService}\0${entry.ttsModel}`, entry)
  for (const entry of nextEvaluation) evaluationByTarget.set(`${entry.ttsService}\0${entry.ttsModel}`, entry)
  const currentManifest = await readManifest(compatible.sceneRunDir)
  const currentProviders = currentManifest?.items[0]?.providers ?? []
  const finalStageStatus = providerStageStatus(stageTargetKeys, currentProviders)
  const completeEvaluation = [...evaluationByTarget.values()].filter(entry => currentProviders.some(provider => provider.targetKey && stageTargetKeys.includes(provider.targetKey) && provider.service === entry.ttsService && provider.model === entry.ttsModel && provider.status === 'succeeded'))
  const artifactRefByPath = new Map([...compatible.comicMetadata.stages.audio.artifactRefs, ...stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, snapshot: snapshotRef, extra: [...mergedSelectedAudioRuns.map(run => ({ path: run.audioRunRef, sha256: run.audioRunSha256 })), ...mergedFinalOutputRefs] })].map(ref => [ref.path, ref] as const))
  await bindSnapshotRenderIdentities(compatible.sceneRunDir, snapshot.snapshotId, metadata.flatMap(entry => entry.renderIdentity ? [entry.renderIdentity] : []))
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: { requirement: 'required', status: finalStageStatus, execution: { kind: 'provider-targets' }, targetKeys: stageTargetKeys as [string, ...string[]], artifactRefs: [...artifactRefByPath.values()] },
    audio: { ...audioMetadata, selectedAudioRuns: mergedSelectedAudioRuns, publishedAudioRunId: stageTargetKeys.length === 1 && mergedSelectedAudioRuns.length === 1 ? mergedSelectedAudioRuns[0]?.audioRunId : undefined, finalOutputRefs: mergedFinalOutputRefs },
    ttsEvaluation: completeEvaluation,
  })
  if (checkpoints.length > 0) {
    for (const { entry, checkpoint } of checkpoints) {
      l.write('info', `${entry.ttsService}/${entry.ttsModel} generation checkpoint complete: ${checkpoint.completedGenerationSlotIds.length} retained, ${checkpoint.remainingGenerationSlotCount} remaining.`)
    }
    l.write('info', `Comic audio generation checkpoint saved; no final WAV was published: ${compatible.sceneRunDir}`)
    return
  }
  l.write('info', finalStageStatus === 'full' ? `Comic audio complete: ${compatible.sceneRunDir}` : `Comic audio target update complete; aggregate stage remains ${finalStageStatus}: ${compatible.sceneRunDir}`)
}
