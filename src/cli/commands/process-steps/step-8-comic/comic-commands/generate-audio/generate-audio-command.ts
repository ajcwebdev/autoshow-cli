import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ApprovedVoiceSnapshotEntry,
  CliCommandContext,
  ComicAudioMode,
  ComicAudioRolePolicy,
  ComicTtsRenderContext,
  PipelineProviderState,
  ProtectedAssetRef,
  TtsOptions,
  TtsTarget,
  TtsTurnControls,
} from '~/types'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { canonicalTargetKey, sha256Bytes } from '../../../step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '../../../step-4-tts/script-to-audio/current-render-attempt'
import { runTtsForTargets, validateTtsRenderInputsForTargets } from '../../../step-4-tts/run-tts'
import { collectTtsTargets, validateTtsTargetsForExecution } from '../../../step-4-tts/tts-targets'
import { createResourceGate } from '~/utils/resource-gate'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { createComicDialoguePlan, writeComicDialoguePlan } from '../../comic-utils/comic-dialogue-plan'
import { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { appendComicAudioProviderState, updateComicAudioManifest } from '../../comic-utils/comic-manifest'
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
    turnControls[turn.turnId] = { [target.service]: entry.synthesisSettings.values }
    return { turnId: turn.turnId, speaker, text: turn.canonicalText }
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

const providerStageStatus = (states: readonly PipelineProviderState[]): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  if (states.every(state => state.status === 'skipped')) return 'skipped'
  if (states.some(state => state.status === 'succeeded') && states.every(state => state.status === 'succeeded' || state.status === 'skipped')) return 'full'
  if (states.some(state => state.status === 'failed') && states.every(state => state.status === 'failed' || state.status === 'skipped')) return 'failed'
  return 'incomplete'
}

export const generateComicAudio = async (ctx: CliCommandContext, scriptPath: string): Promise<void> => {
  const flags = ctx.flags as Record<string, unknown>
  const profileKey = typeof flags['profile'] === 'string' && flags['profile'].trim() ? flags['profile'].trim() : DEFAULT_PROFILE
  const mode = parseMode(flags['mode'])
  const rolePolicies = parseRolePolicies(repeatableStrings(flags['role']))
  const sampleRate = parseInteger(flags['sample-rate'], DEFAULT_SAMPLE_RATE, '--sample-rate')
  const channelsValue = parseInteger(flags['channels'], 2, '--channels')
  if (channelsValue !== 1 && channelsValue !== 2) throw CLIUsageError('--channels must be 1 or 2.')
  const channels = channelsValue as 1 | 2
  const codecValue = flags['codec'] ?? 'pcm_s24le'
  if (codecValue !== 'pcm_s16le' && codecValue !== 'pcm_s24le') throw CLIUsageError('--codec must be pcm_s16le or pcm_s24le.')
  const codec = codecValue
  const price = flags['price'] === true
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
  const compatible = await resolveCompatibleComicSceneRun({ scriptPath })
  await assertProtectedStoreOutputDisjoint(compatible.sceneRunDir, MANAGED_VOICE_STORE_ROOT)
  const dialoguePlan = createComicDialoguePlan({
    structuredScript: compatible.structuredScript,
    sourceIdentity: compatible.sourceIdentity,
    structuredScriptRef: compatible.comicMetadata.audio.structuredScript as NonNullable<typeof compatible.comicMetadata.audio.structuredScript>,
    sceneRunIdentity: compatible.comicMetadata.audio.sceneRunIdentity as string,
    createdAt: compatible.manifest.createdAt,
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
  const expectedSnapshotTargets = new Set(targets.map(target => `${target.service}\0${target.model}`))
  const snapshotTargets = new Set(snapshot.entries.map(entry => `${entry.provider}\0${entry.providerModel}`))
  const snapshotSubjects = [...new Set(turns.map(turn => turn.subjectKey))]
  const expectedSnapshotBindings = new Set(targets.flatMap(target => snapshotSubjects.map(subjectKey => `${target.service}\0${target.model}\0${profileKey}\0${subjectKey}`)))
  const snapshotBindings = new Set(snapshot.entries.map(entry => `${entry.provider}\0${entry.providerModel}\0${entry.profileKey}\0${entry.subjectKey}`))
  if (expectedSnapshotTargets.size !== snapshotTargets.size || [...expectedSnapshotTargets].some(key => !snapshotTargets.has(key)) || expectedSnapshotBindings.size !== snapshot.entries.length || snapshotBindings.size !== snapshot.entries.length || [...expectedSnapshotBindings].some(key => !snapshotBindings.has(key))) throw CLIUsageError('Retained scene snapshot does not match the exact selected provider/model/profile/subject set; start a new canonical scene run for a recast.')
  baseOptions.hostedTtsChunkScheduler ??= createHostedTtsChunkScheduler(baseOptions.ttsChunkConcurrency)
  const hostedResourceGate = createResourceGate({ capacity: baseOptions.ttsProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY })
  const localResourceGate = createResourceGate({ capacity: baseOptions.ttsLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY })
  const executions = targets.map(target => buildTargetExecution({ target, baseOptions, snapshot, dialoguePlan, mode, sampleRate, channels, codec, resourceGate: target.service === 'kitten' ? localResourceGate : hostedResourceGate }))
  for (const execution of executions) validateTtsRenderInputsForTargets([execution.target], execution.sourceText, execution.options, { comicContext: execution.context })

  if (price) {
    for (const execution of executions) {
      const planned = planCurrentTtsReadiness({ target: execution.target, sourceText: execution.sourceText, ttsOptions: execution.options, comicContext: execution.context })
      const cost = planned.plannedCost.amounts.map(amount => `${amount.amount.toFixed(4)} ${amount.currency}`).join(', ') || '0'
      l.write('info', `${execution.target.service}/${execution.target.model}: ${planned.strategy}, ${cost}`)
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
        await updateComicAudioManifest({
          sceneRunDir: compatible.sceneRunDir,
          sourceIdentity: compatible.sourceIdentity,
          stage: { requirement: 'required', status: providerStageStatus(ordered), execution: { kind: 'provider-targets' }, targetKeys: targetKeys as [string, ...string[]], artifactRefs: baseArtifacts },
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
          onProviderState: async (state) => { await appendComicAudioProviderState({ sceneRunDir: compatible.sceneRunDir, sourceIdentity: compatible.sourceIdentity, targetKeys, state }) },
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
  const selectedAudioRuns = metadata.map((entry) => {
    if (!entry.targetKey || !entry.renderIdentity || !entry.audioRunId || !entry.comicAudio?.selectedSuccess) throw CLIUsageError('Completed comic target is missing selected audio-run evidence.')
    const selected = entry.comicAudio.selectedSuccess
    const render = entry.comicAudio.renderHistory.find(candidate => candidate.renderIdentity === selected.renderIdentity)
    const event = render?.events.find(candidate => candidate.sequence === selected.eventSequence)
    if (!event?.audioRunRef || !event.audioRunSha256 || !entry.artifactDir) throw CLIUsageError('Completed comic target audio run is not checksum-bound.')
    return { targetKey: entry.targetKey, renderIdentity: entry.renderIdentity, audioRunId: entry.audioRunId, audioRunRef: `${entry.artifactDir}/${event.audioRunRef}`, audioRunSha256: event.audioRunSha256 }
  })
  const finalOutputRefs = await Promise.all(metadata.map(async entry => {
    const path = entry.audioFileName
    return { path, sha256: sha256Bytes(new Uint8Array(await Bun.file(join(compatible.sceneRunDir, path)).arrayBuffer())) }
  }))
  await bindSnapshotRenderIdentities(compatible.sceneRunDir, snapshot.snapshotId, metadata.flatMap(entry => entry.renderIdentity ? [entry.renderIdentity] : []))
  await updateComicAudioManifest({
    sceneRunDir: compatible.sceneRunDir,
    sourceIdentity: compatible.sourceIdentity,
    stage: { requirement: 'required', status: 'full', execution: { kind: 'provider-targets' }, targetKeys: targetKeys as [string, ...string[]], artifactRefs: stageArtifactRefs({ structured: structuredRef, dialogue: dialogueRef, snapshot: snapshotRef, extra: [...selectedAudioRuns.map(run => ({ path: run.audioRunRef, sha256: run.audioRunSha256 })), ...finalOutputRefs] }) },
    audio: { ...audioMetadata, selectedAudioRuns, publishedAudioRunId: selectedAudioRuns.length === 1 ? selectedAudioRuns[0]?.audioRunId : undefined, finalOutputRefs },
  })
  l.write('info', `Comic audio complete: ${compatible.sceneRunDir}`)
}
