import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ApprovedVoiceSnapshotEntry,
  CliCommandContext,
  ComicAudioMode,
  ComicAudioDeliveryPolicy,
  ComicAudioPacingProfile,
  ComicAudioSoundscapeTimingPolicy,
  ComicAudioRolePolicy,
  ComicTtsRenderContext,
  PipelineProviderState,
  ProtectedAssetRef,
  SoundscapeAudioRun,
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
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { generateComicSlideshow } from '../generate-slideshow/generate-slideshow-command'
import { preparePresentationVisualInputs, resolvePresentationVisualInputs } from '../../comic-utils/comic-presentation-inputs'
import { reconcilePresentationDialogue } from '../../comic-utils/comic-presentation-plan'
import { selectPresentationVideoEncoder } from '../../comic-utils/comic-presentation-renderer'
import { createComicDialoguePlan, writeComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { appendComicAudioProviderState, updateComicAudioManifest } from '../../comic-utils/comic-manifest'
import { readManifest } from '../../../pipeline-manifest'
import { bindSnapshotRenderIdentities, buildVoiceReferenceManifest, loadVoiceReferenceManifest, writeVoiceReferenceManifest } from '../../comic-utils/voice-reference-snapshot'
import { assertProtectedStoreOutputDisjoint } from '../../../step-4-tts/voice-assets/protected-output-boundary'
import { MANAGED_VOICE_STORE_ROOT } from '../../../step-4-tts/voice-management/managed-voice-store'
import { resolveCharacterVoiceRegistryPaths } from '../../../step-4-tts/voice-management/character-voice-registry'
import { createHostedTtsChunkScheduler } from '../../../step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { createSoundscapePlan, DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE, writeSoundscapePlan } from '../../../step-4-tts/soundscape/soundscape-planner'
import { soundscapeAudioRunLineageRefs } from '../../comic-utils/comic-artifact-lineage-audit'
import { assertComicSoundscapeExecutionReady, createLocalSilentDialogueRun, parseSoundEffectLicenseUseClassification, planComicSoundscapePrice, runComicSoundscape, soundscapeReportedOutputPath } from '../../comic-utils/comic-soundscape-workflow'
import { readContainedArtifactFile } from '../../../step-4-tts/script-to-audio/safe-artifact-store'

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

const parseSoundscapeTimingPolicy = (value: unknown): ComicAudioSoundscapeTimingPolicy => {
  const policy = value ?? 'strict'
  if (policy !== 'strict' && policy !== 'proportional') throw CLIUsageError('--soundscape-timing-policy must be strict or proportional.')
  return policy
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
  fishTtsVoice: undefined,
  inworldTtsVoice: undefined,
  deepinfraTtsVoice: undefined,
  replicateTtsVoice: undefined,
  falTtsVoice: undefined,
})

export const buildTargetExecution = (input: {
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
  if (['elevenlabs', 'hume', 'minimax', 'cartesia', 'speechify', 'inworld'].includes(target.service)) {
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
  const soundscapeTimingPolicy = parseSoundscapeTimingPolicy(flags['soundscape-timing-policy'])
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
  const sfxSelector = typeof flags['sfx-provider'] === 'string' && flags['sfx-provider'].trim() ? flags['sfx-provider'].trim() : undefined
  const sfxLicenseUseClassification = parseSoundEffectLicenseUseClassification(flags['sfx-license-use'])
  const sfxConcurrency = parseInteger(flags['sfx-concurrency'], 2, '--sfx-concurrency')
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
  const presentationRequested = Boolean(flags['slideshow']) || Boolean(flags['panel-video'])
  if (presentationRequested) {
    const visualInputs = await resolvePresentationVisualInputs(compatible)
    reconcilePresentationDialogue({ scene: visualInputs.scene, dialoguePlan })
    if (!price) {
      await preparePresentationVisualInputs(compatible, visualInputs)
      await selectPresentationVideoEncoder()
    }
  }
  const turns = flattenTurns(dialoguePlan)
  const structuredRef = dialoguePlan.structuredScript
  const soundscapePlan = createSoundscapePlan({
    structuredScript: compatible.structuredScript,
    structuredScriptRef: structuredRef,
    dialoguePlan,
    sceneRunIdentity: dialoguePlan.sceneRunIdentity,
    createdAt: compatible.manifest.createdAt,
    mixProfile: { ...DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE, sampleRate, channels, codec },
    timingPolicy: soundscapeTimingPolicy,
  })
  const retainedSoundEffectPlanRef = compatible.comicMetadata.audio.soundEffectRenderPlanRef
  const soundscapePrice = await planComicSoundscapePrice({ rootDir: compatible.sceneRunDir, plan: soundscapePlan, selector: sfxSelector, licenseUseClassification: sfxLicenseUseClassification, ...(retainedSoundEffectPlanRef ? { retainedPlanRef: retainedSoundEffectPlanRef } : {}) })
  const soundEffectRenderPlan = soundscapePrice.renderPlan
  if (turns.length === 0 && !soundEffectRenderPlan) {
    if (price) {
      l.write('info', `Comic audio price: 0 speakable turns; no provider work or artifact writes. ${soundscapePrice.summary}`)
      return
    }
    const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
    const soundscapePlanRef = await writeSoundscapePlan(compatible.sceneRunDir, soundscapePlan)
    await updateComicAudioManifest({
      sceneRunDir: compatible.sceneRunDir,
      sourceIdentity: compatible.sourceIdentity,
      stage: {
        requirement: 'required', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [],
        artifactRefs: stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, extra: [soundscapePlanRef] }),
      },
      audio: { sceneRunIdentity: dialoguePlan.sceneRunIdentity, structuredScript: structuredRef, dialoguePlanId: dialoguePlan.dialoguePlanId, dialoguePlanRef: dialogueRef, soundscapePlanId: soundscapePlan.soundscapePlanId, soundscapePlanRef },
      providers: [],
    })
    l.write('info', `Comic audio completed locally with no speakable turns: ${compatible.sceneRunDir}`)
    return
  }
  if (turns.length === 0 && soundEffectRenderPlan) {
    if (price) {
      l.write('info', `Comic audio price: 0 speakable turns. ${soundscapePrice.summary}`)
      return
    }
    await assertComicSoundscapeExecutionReady(compatible.sceneRunDir, soundEffectRenderPlan)
    const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
    const soundscapePlanRef = await writeSoundscapePlan(compatible.sceneRunDir, soundscapePlan)
    const silent = await createLocalSilentDialogueRun({ rootDir: compatible.sceneRunDir, plan: soundscapePlan })
    await mkdir(join(compatible.sceneRunDir, 'audio', 'final'), { recursive: true })
    const soundscape = await runComicSoundscape({ rootDir: compatible.sceneRunDir, plan: soundscapePlan, renderPlan: soundEffectRenderPlan, dialoguePlan, dialogueRuns: [silent.binding], concurrency: sfxConcurrency, hostedConcurrencyCoordinator: baseOptions.hostedConcurrencyCoordinator })
    const run = soundscape.soundscapeRuns[0]
    const nextArtifacts = stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, extra: [soundscapePlanRef, ...silent.refs, soundscape.renderPlanRef, soundscape.renderResultRef, ...(run ? [run.ref, run.audioRun.transformLedger, run.audioRun.resolvedTimeline, ...run.audioRun.stems.map(stem => ({ path: stem.path, sha256: stem.sha256 })), { path: run.audioRun.master.path, sha256: run.audioRun.master.sha256 }] : [])] })
    const artifacts = [...new Map([...compatible.comicMetadata.stages.audio.artifactRefs, ...nextArtifacts].map(ref => [ref.path, ref] as const)).values()]
    await updateComicAudioManifest({
      sceneRunDir: compatible.sceneRunDir,
      sourceIdentity: compatible.sourceIdentity,
      stage: { requirement: 'required', status: soundscape.providerState.status === 'succeeded' ? 'full' : 'failed', execution: { kind: 'provider-targets' }, targetKeys: [soundEffectRenderPlan.target.targetKey], artifactRefs: artifacts },
      audio: {
        ...compatible.comicMetadata.audio,
        sceneRunIdentity: dialoguePlan.sceneRunIdentity, structuredScript: structuredRef, dialoguePlanId: dialoguePlan.dialoguePlanId, dialoguePlanRef: dialogueRef,
        soundscapePlanId: soundscapePlan.soundscapePlanId, soundscapePlanRef, soundEffectRenderPlanRef: soundscape.renderPlanRef, soundEffectRenderResultRef: soundscape.renderResultRef,
        selectedAudioRuns: [{ targetKey: silent.binding.targetKey, renderIdentity: silent.binding.renderIdentity, audioRunId: silent.binding.audioRunId, audioRunRef: silent.binding.audioRunRef, audioRunSha256: silent.binding.audioRunSha256 }],
        ...(run ? { selectedSoundscapeRuns: [{ targetKey: silent.binding.targetKey, dialogueAudioRunId: silent.binding.audioRunId, soundscapeAudioRunId: run.audioRun.audioRunId, audioRunRef: run.ref.path, audioRunSha256: run.ref.sha256, masterRef: { path: run.audioRun.master.path, sha256: run.audioRun.master.sha256 } }], publishedAudioRunId: run.audioRun.audioRunId, finalOutputRefs: [{ path: silent.binding.reportedOutputPath, sha256: run.audioRun.master.sha256 }] } : {}),
      },
      providers: [soundscape.providerState],
    })
    if (soundscape.providerState.status !== 'succeeded') throw CLIUsageError('Comic soundscape failed one or more required cues; generated artifacts were retained but no master was published.')
    l.write('info', `Comic soundscape complete without dialogue: ${compatible.sceneRunDir}`)
    return
  }

  const collectedTargets = collectTtsTargets(baseOptions)
  if (collectedTargets.length === 0) throw CLIUsageError('Comic audio requires at least one selected TTS provider target.')
  const targets = collectedTargets.map((target) => {
    const transport = target.transport ?? (target.service === 'kitten' ? 'local-process' : 'hosted-api')
    return { ...target, operation: 'comic-audio' as const, transport, targetKey: canonicalTargetKey('comic-audio', target.service, target.model, transport) }
  })
  if (new Set(targets.map(target => target.targetKey)).size !== targets.length) throw CLIUsageError('Comic audio provider selection contains duplicate operation-scoped provider/model targets.')
  const selectedSnapshotId = typeof compatible.comicMetadata.audio.snapshotId === 'string'
    ? compatible.comicMetadata.audio.snapshotId
    : undefined
  const selectedRetainedSnapshot = await loadVoiceReferenceManifest({
    sceneRunDir: compatible.sceneRunDir,
    sceneRunIdentity: dialoguePlan.sceneRunIdentity,
    dialoguePlanId: dialoguePlan.dialoguePlanId,
    ...(selectedSnapshotId ? { snapshotId: selectedSnapshotId } : {})
  })
  const charactersRoot = getCharactersRoot()
  const registryPaths = resolveCharacterVoiceRegistryPaths(charactersRoot)
  const registryPresence = await Promise.all([registryPaths.briefs, registryPaths.registrations, registryPaths.current].map(async path => await Bun.file(path).exists()))
  if (registryPresence.some(Boolean) && !registryPresence.every(Boolean)) throw CLIUsageError('Character voice registry is incomplete; briefs, registrations, and current selections must be present together.')
  const currentSnapshot = registryPresence.every(Boolean) || !selectedRetainedSnapshot
    ? await buildVoiceReferenceManifest({
        charactersRoot,
        dialoguePlan,
        targets: targets.map(target => ({ provider: target.service, model: target.model })),
        profileKey,
        createdAt: compatible.manifest.createdAt,
      })
    : undefined
  const retainedSnapshot = currentSnapshot
    ? await loadVoiceReferenceManifest({
        sceneRunDir: compatible.sceneRunDir,
        sceneRunIdentity: dialoguePlan.sceneRunIdentity,
        dialoguePlanId: dialoguePlan.dialoguePlanId,
        snapshotId: currentSnapshot.snapshotId
      })
    : selectedRetainedSnapshot
  const snapshot = retainedSnapshot?.manifest ?? currentSnapshot
  if (!snapshot) throw CLIUsageError('Comic audio requires a retained voice snapshot or a complete character voice registry.')
  const snapshotSubjects = [...new Set(turns.map(turn => turn.subjectKey))]
  assertVoiceSnapshotCoversSelectedTargets({ snapshot, targets, subjectKeys: snapshotSubjects, profileKey })
  baseOptions.hostedTtsChunkScheduler ??= createHostedTtsChunkScheduler({
    maxConcurrency: baseOptions.ttsChunkConcurrency,
    concurrencyMode: baseOptions.concurrencyMode,
    hostedConcurrencyCoordinator: baseOptions.hostedConcurrencyCoordinator
  })
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
    l.write('info', soundscapePrice.summary)
    return
  }

  if (soundEffectRenderPlan) await assertComicSoundscapeExecutionReady(compatible.sceneRunDir, soundEffectRenderPlan)

  const dialogueRef = await writeComicDialoguePlan(compatible.sceneRunDir, dialoguePlan)
  const soundscapePlanRef = await writeSoundscapePlan(compatible.sceneRunDir, soundscapePlan)
  const snapshotRef = retainedSnapshot?.ref ?? await writeVoiceReferenceManifest(compatible.sceneRunDir, snapshot)
  const baseArtifacts = stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, snapshot: snapshotRef, extra: [soundscapePlanRef] })
  const audioMetadata = {
    ...compatible.comicMetadata.audio,
    dialoguePlanId: dialoguePlan.dialoguePlanId,
    dialoguePlanRef: dialogueRef,
    snapshotId: snapshot.snapshotId,
    snapshotRef,
    soundscapePlanId: soundscapePlan.soundscapePlanId,
    soundscapePlanRef,
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
  const soundTargetKeys = soundEffectRenderPlan ? [soundEffectRenderPlan.target.targetKey] : []
  const retainedSoundTargetKeys = soundTargetKeys.filter(targetKey => compatible.manifest.items[0]?.providers.some(provider => provider.targetKey === targetKey))
  const dialogueStageTargetKeys = [...new Set([...compatible.comicMetadata.stages.audio.targetKeys.filter(targetKey => !soundTargetKeys.includes(targetKey) || retainedSoundTargetKeys.includes(targetKey)), ...targetKeys])]
  const stageTargetKeys = [...new Set([...dialogueStageTargetKeys, ...soundTargetKeys])]
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
  let finalOutputRefs = await Promise.all(completedMetadata.map(async entry => {
    const path = entry.audioFileName
    return { path, sha256: sha256Bytes(new Uint8Array(await Bun.file(join(compatible.sceneRunDir, path)).arrayBuffer())) }
  }))
  let selectedSoundscapeRuns = compatible.comicMetadata.audio.selectedSoundscapeRuns ?? []
  let soundscapeArtifactRefs: Array<{ path: string, sha256: string }> = []
  let soundscapeMetadata: Pick<NonNullable<typeof compatible.comicMetadata.audio>, 'soundEffectRenderPlanRef' | 'soundEffectRenderResultRef'> = {}
  let soundscapeRequiredFailure = false
  if (soundEffectRenderPlan && completedMetadata.length > 0) {
    const dialogueRuns = selectedAudioRuns.map((run) => {
      const entry = completedMetadata.find(candidate => candidate.targetKey === run.targetKey)
      if (!entry) throw CLIUsageError(`Selected dialogue AudioRun ${run.audioRunId} has no completed target metadata.`)
      return { targetKey: run.targetKey, renderIdentity: run.renderIdentity, audioRunId: run.audioRunId, audioRunRef: run.audioRunRef, audioRunSha256: run.audioRunSha256, reportedOutputPath: soundscapeReportedOutputPath(run.targetKey) }
    })
    const soundscape = await runComicSoundscape({
      rootDir: compatible.sceneRunDir,
      plan: soundscapePlan,
      renderPlan: soundEffectRenderPlan,
      dialoguePlan,
      dialogueRuns,
      concurrency: sfxConcurrency,
      hostedConcurrencyCoordinator: baseOptions.hostedConcurrencyCoordinator,
    })
    await appendComicAudioProviderState({ sceneRunDir: compatible.sceneRunDir, sourceIdentity: compatible.sourceIdentity, targetKeys: stageTargetKeys, state: soundscape.providerState })
    soundscapeMetadata = { soundEffectRenderPlanRef: soundscape.renderPlanRef, soundEffectRenderResultRef: soundscape.renderResultRef }
    soundscapeRequiredFailure = soundscape.providerState.status !== 'succeeded'
    if (!soundscapeRequiredFailure) {
      const runByTarget = new Map(selectedSoundscapeRuns.map(run => [run.targetKey, run] as const))
      for (const run of soundscape.soundscapeRuns) runByTarget.set(run.binding.targetKey, {
        targetKey: run.binding.targetKey,
        dialogueAudioRunId: run.binding.audioRunId,
        soundscapeAudioRunId: run.audioRun.audioRunId,
        audioRunRef: run.ref.path,
        audioRunSha256: run.ref.sha256,
        masterRef: { path: run.audioRun.master.path, sha256: run.audioRun.master.sha256 },
      })
      selectedSoundscapeRuns = [...runByTarget.values()].sort((left, right) => left.targetKey.localeCompare(right.targetKey))
      const masterByTarget = new Map(soundscape.soundscapeRuns.map(run => [run.binding.targetKey, { master: run.audioRun.master, path: run.binding.reportedOutputPath }] as const))
      finalOutputRefs = completedMetadata.map((entry) => {
        const soundscapeOutput = entry.targetKey ? masterByTarget.get(entry.targetKey) : undefined
        return soundscapeOutput ? { path: soundscapeOutput.path, sha256: soundscapeOutput.master.sha256 } : { path: entry.audioFileName, sha256: finalOutputRefs.find(ref => ref.path === entry.audioFileName)?.sha256 ?? '' }
      })
    }
    const runByMixedTarget = new Map(soundscape.soundscapeRuns.map(run => [run.binding.targetKey, run] as const))
    const retainedSoundscapeRefs: Array<{ path: string, sha256: string }> = []
    for (const binding of selectedSoundscapeRuns) {
      retainedSoundscapeRefs.push({ path: binding.audioRunRef, sha256: binding.audioRunSha256 }, binding.masterRef)
      const mixed = runByMixedTarget.get(binding.targetKey)
      if (mixed) {
        retainedSoundscapeRefs.push(...soundscapeAudioRunLineageRefs(mixed.audioRun))
        continue
      }
      const stored = await readContainedArtifactFile(compatible.sceneRunDir, binding.audioRunRef)
      if (stored.sha256 !== binding.audioRunSha256) throw CLIUsageError(`Retained soundscape AudioRun checksum is stale: ${binding.audioRunRef}`)
      retainedSoundscapeRefs.push(...soundscapeAudioRunLineageRefs(JSON.parse(stored.bytes.toString('utf8')) as SoundscapeAudioRun))
    }
    soundscapeArtifactRefs = [soundscape.planRef, soundscape.renderPlanRef, soundscape.renderResultRef, ...retainedSoundscapeRefs]
  }
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
  const artifactRefByPath = new Map([...compatible.comicMetadata.stages.audio.artifactRefs, ...stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, snapshot: snapshotRef, extra: [...mergedSelectedAudioRuns.map(run => ({ path: run.audioRunRef, sha256: run.audioRunSha256 })), ...mergedFinalOutputRefs, ...soundscapeArtifactRefs] })].map(ref => [ref.path, ref] as const))
  await bindSnapshotRenderIdentities(compatible.sceneRunDir, snapshot.snapshotId, metadata.flatMap(entry => entry.renderIdentity ? [entry.renderIdentity] : []))
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: { requirement: 'required', status: finalStageStatus, execution: { kind: 'provider-targets' }, targetKeys: stageTargetKeys as [string, ...string[]], artifactRefs: [...artifactRefByPath.values()] },
    audio: { ...audioMetadata, ...soundscapeMetadata, selectedAudioRuns: mergedSelectedAudioRuns, selectedSoundscapeRuns, publishedAudioRunId: stageTargetKeys.length === 1 && mergedSelectedAudioRuns.length === 1 ? mergedSelectedAudioRuns[0]?.audioRunId : undefined, finalOutputRefs: mergedFinalOutputRefs },
    ttsEvaluation: completeEvaluation,
  })
  if (soundscapeRequiredFailure) throw CLIUsageError('Comic soundscape failed one or more required cues; verified dialogue and sound-effect artifacts were retained for resume, but no master was published.')
  if (checkpoints.length > 0) {
    for (const { entry, checkpoint } of checkpoints) {
      l.write('info', `${entry.ttsService}/${entry.ttsModel} generation checkpoint complete: ${checkpoint.completedGenerationSlotIds.length} retained, ${checkpoint.remainingGenerationSlotCount} remaining.`)
    }
    l.write('info', `Comic audio generation checkpoint saved; no final WAV was published: ${compatible.sceneRunDir}`)
    return
  }
  l.write('info', finalStageStatus === 'full' ? `Comic audio complete: ${compatible.sceneRunDir}` : `Comic audio target update complete; aggregate stage remains ${finalStageStatus}: ${compatible.sceneRunDir}`)
  if (presentationRequested) {
    await generateComicSlideshow(ctx, scriptPath)
  }
}
