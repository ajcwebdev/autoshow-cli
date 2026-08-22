import { mkdir, rm } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import type {
  AudioRun,
  CompactMix,
  CompactSfx,
  CompactTargetRender,
  DialogueAudioRunBinding,
  FinalTimeline,
  HostedConcurrencyCoordinator,
  PipelineProviderState,
  SoundEffectAdapter,
  SoundEffectLicenseUse,
  SoundEffectLicenseUseClassification,
  SoundEffectRenderPlan,
  SoundscapePlan,
} from '~/types'
import { requireProviderKey } from '~/utils/validate/env-utils'
import { UsageError } from '~/utils/error-handler'
import { hardlinkContainedArtifact, readContainedArtifactFile, writeImmutableArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '../../step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { assertAudioGenDispatchEligible, assertAudioGenLicenseEligible, createReplicateAudioGenAdapter, createSoundEffectLicenseUse } from '../../step-4-tts/soundscape/replicate-audiogen-adapter'
import { createStabilitySoundEffectAdapter } from '../../step-4-tts/soundscape/stability-stable-audio-adapter'
import { createSoundEffectRenderPlan, executeSoundEffectRenderPlan, loadCompactSfx, loadSoundEffectRenderPlan, loadSoundEffectRenderResult, planSoundEffectResumePrice, writeSoundEffectRenderPlan } from '../../step-4-tts/soundscape/sound-effect-execution'
import { mixSoundscape } from '../../step-4-tts/soundscape/soundscape-mixer'
import { resolveSoundscapeTimeline } from '../../step-4-tts/soundscape/soundscape-timeline'
import { writeSoundscapePlan } from '../../step-4-tts/soundscape/soundscape-planner'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue } from '../../step-4-tts/script-to-audio/contract-identity'
import { createSilenceWav } from '../../step-4-tts/tts-utils/audio-utils'

export const soundscapeReportedOutputPath = (targetKey: string): string => `audio/final/${targetKey}.soundscape.wav`

export const createLocalSilentDialogueRun = async (input: {
  rootDir: string
  plan: SoundscapePlan
  target?: { service: string, model: string, transport: string } | undefined
}): Promise<{ binding: DialogueAudioRunBinding, refs: Array<{ path: string, sha256: string }> }> => {
  const target = input.target ?? { service: 'local', model: 'silence-v1', transport: 'local-process' }
  const targetKey = canonicalTargetKey('comic-audio', target.service, target.model, target.transport)
  const renderIdentity = hashCanonicalTtsValue({ operation: 'comic-audio', targetKey, dialoguePlanId: input.plan.dialoguePlanId, outputProfileHash: input.plan.mixProfileHash })
  const renderPlanId = hashCanonicalTtsValue({ renderIdentity, strategy: 'local-silence' })
  const root = `audio/local-dialogue/${renderIdentity}`
  const work = join(input.rootDir, 'audio', `.local-silence-${crypto.randomUUID()}`)
  await mkdir(work, { recursive: true })
  try {
    const temporary = join(work, 'silence.wav')
    await createSilenceWav(temporary, 1, { schemaVersion: 1, sampleRate: input.plan.mixProfile.sampleRate, channels: input.plan.mixProfile.channels, codec: input.plan.mixProfile.codec, container: 'wav' })
    const final = await writeImmutableArtifactFile(input.rootDir, `${root}/final.wav`, new Uint8Array(await Bun.file(temporary).arrayBuffer()))
    const providerResultBase = { schemaVersion: 1 as const, renderPlanId, renderIdentity, status: 'succeeded' as const, local: true, createdAt: input.plan.createdAt }
    const providerResult = { ...providerResultBase, resultIdentity: hashCanonicalTtsValue(providerResultBase) }
    const providerResultRef = await writeImmutableArtifactFile(input.rootDir, `${root}/provider-render-result.json`, `${canonicalTtsJson(providerResult)}\n`)
    const mixBase = { schemaVersion: 1 as const, renderIdentity, outputProfileHash: input.plan.mixProfileHash, sources: [], operations: [{ kind: 'local-silence', parametersHash: hashCanonicalTtsValue({ durationMs: 1 }) }], createdAt: input.plan.createdAt }
    const mix = { ...mixBase, mixPlanId: hashCanonicalTtsValue(mixBase) }
    const mixRef = await writeImmutableArtifactFile(input.rootDir, `${root}/mix-plan.json`, `${canonicalTtsJson(mix)}\n`)
    const ledgerBase = { schemaVersion: 1 as const, renderIdentity, operations: [{ operationId: hashCanonicalTtsValue({ kind: 'pause', durationMs: 1 }), kind: 'pause' as const, finalRangeMs: { start: 0, end: 1 }, parametersHash: hashCanonicalTtsValue({ durationMs: 1 }) }] }
    const ledger = { ...ledgerBase, transformLedgerId: hashCanonicalTtsValue(ledgerBase) }
    const ledgerRef = await writeImmutableArtifactFile(input.rootDir, `${root}/transform-ledger.json`, `${canonicalTtsJson(ledger)}\n`)
    const timelineBase = { schemaVersion: 1 as const, renderIdentity, timing: { availability: 'timed' as const, clock: 'final-audio-ms' as const, provenance: 'assembled-segments' as const, turns: [] }, speechSources: [], transformLedgerRef: { path: 'transform-ledger.json', sha256: ledgerRef.sha256 } }
    const timeline = { ...timelineBase, timelineId: hashCanonicalTtsValue(timelineBase) }
    const timelineRef = await writeImmutableArtifactFile(input.rootDir, `${root}/final-timeline.json`, `${canonicalTtsJson(timeline)}\n`)
    const audioRunBase = {
      schemaVersion: 1 as const, targetKey, renderPlanId, renderIdentity,
      providerResult: { resultIdentity: providerResult.resultIdentity, path: 'provider-render-result.json', sha256: providerResultRef.sha256 },
      takeSelections: [], continuationCheckpoints: [], mixPlan: { mixPlanId: mix.mixPlanId, path: 'mix-plan.json', sha256: mixRef.sha256 },
      transformLedger: { transformLedgerId: ledger.transformLedgerId, path: 'transform-ledger.json', sha256: ledgerRef.sha256 },
      finalTimeline: { timelineId: timeline.timelineId, path: 'final-timeline.json', sha256: timelineRef.sha256 },
      finalOutputs: [{ path: 'final.wav', sha256: final.sha256, format: { codec: input.plan.mixProfile.codec, container: 'wav' as const, sampleRate: input.plan.mixProfile.sampleRate, channels: input.plan.mixProfile.channels }, durationMs: 1 }],
      createdAt: input.plan.createdAt,
    }
    const audioRun: AudioRun = { ...audioRunBase, audioRunId: hashCanonicalTtsValue(audioRunBase) }
    const audioRunRef = await writeImmutableArtifactFile(input.rootDir, `${root}/audio-run.json`, `${canonicalTtsJson(audioRun)}\n`)
    return {
      binding: { targetKey, renderIdentity, audioRunId: audioRun.audioRunId, audioRunRef: audioRunRef.relativePath, audioRunSha256: audioRunRef.sha256, reportedOutputPath: soundscapeReportedOutputPath(targetKey) },
      refs: [providerResultRef, mixRef, ledgerRef, timelineRef, final, audioRunRef].map(ref => ({ path: ref.relativePath, sha256: ref.sha256 })),
    }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

const verifiedJson = async <T>(rootDir: string, path: string, sha256: string, label: string): Promise<T> => {
  const stored = await readContainedArtifactFile(rootDir, path)
  if (stored.sha256 !== sha256) throw UsageError(`${label} checksum is invalid.`)
  try { return JSON.parse(stored.bytes.toString('utf8')) as T }
  catch { throw UsageError(`${label} is not valid JSON.`) }
}

const isCompactTargetRender = (value: unknown): value is CompactTargetRender =>
  typeof value === 'object' && value !== null && 'renderId' in value && 'outputs' in value && !('audioRunId' in value)

const loadDialogueMixSource = async (rootDir: string, binding: DialogueAudioRunBinding): Promise<{
  audioRunId: string
  path: string
  sha256: string
  timeline: FinalTimeline
  finalAudio: { path: string, sha256: string }
}> => {
  const stored = await verifiedJson<CompactTargetRender | AudioRun>(rootDir, binding.audioRunRef, binding.audioRunSha256, `Dialogue render ${binding.audioRunId}`)
  if (isCompactTargetRender(stored)) {
    if (stored.targetKey !== binding.targetKey || stored.renderIdentity !== binding.renderIdentity) throw UsageError('Selected dialogue render identity does not match its canonical manifest binding.')
    const timelinePath = posix.join(posix.dirname(binding.audioRunRef), 'timeline.json')
    const timelineBytes = await readContainedArtifactFile(rootDir, timelinePath)
    const timeline = JSON.parse(timelineBytes.bytes.toString('utf8')) as FinalTimeline
    if (timeline.renderIdentity !== stored.renderIdentity) throw UsageError('Selected dialogue timeline does not bind the compact render.')
    return { audioRunId: binding.audioRunId, path: binding.audioRunRef, sha256: binding.audioRunSha256, timeline, finalAudio: { path: stored.outputs.final.path, sha256: stored.outputs.final.sha256 } }
  }
  if (stored.audioRunId !== binding.audioRunId || stored.targetKey !== binding.targetKey) throw UsageError('Selected dialogue AudioRun identity does not match its canonical manifest binding.')
  const audioRunDirectory = dirname(binding.audioRunRef)
  const finalTimelinePath = join(audioRunDirectory, stored.finalTimeline.path).replace(/\\/gu, '/')
  const timeline = await verifiedJson<FinalTimeline>(rootDir, finalTimelinePath, stored.finalTimeline.sha256, `Dialogue timeline ${stored.finalTimeline.timelineId}`)
  const finalOutput = stored.finalOutputs[0]
  if (!finalOutput) throw UsageError(`Dialogue AudioRun ${binding.audioRunId} has no final audio output.`)
  return { audioRunId: stored.audioRunId, path: binding.audioRunRef, sha256: binding.audioRunSha256, timeline, finalAudio: { path: join(audioRunDirectory, finalOutput.path).replace(/\\/gu, '/'), sha256: finalOutput.sha256 } }
}

export const parseSoundEffectLicenseUseClassification = (value: unknown): SoundEffectLicenseUseClassification | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (value !== 'noncommercial' && value !== 'commercial' && value !== 'unknown') {
    throw UsageError('--sfx-license-use must be noncommercial, commercial, or unknown.')
  }
  return value
}

export const resolveSoundEffectPlan = async (input: {
  rootDir: string
  soundscapePlan: SoundscapePlan
  selector?: string | undefined
  licenseUseClassification?: SoundEffectLicenseUseClassification | undefined
  retainedPlanRef?: { path: string, sha256: string } | undefined
}): Promise<SoundEffectRenderPlan | undefined> => {
  if (input.soundscapePlan.synthesisTasks.length === 0) return undefined
  if (input.selector) {
    const target = resolveSoundEffectTarget(input.selector)
    const licenseUse: SoundEffectLicenseUse | undefined = target.provider === 'replicate' && input.licenseUseClassification
      ? createSoundEffectLicenseUse({
        classification: input.licenseUseClassification,
        fixture: target.capabilityFixture,
      })
      : undefined
    return createSoundEffectRenderPlan({ plan: input.soundscapePlan, target, ...(licenseUse ? { licenseUse } : {}) })
  }
  const compact = await loadCompactSfx(input.rootDir)
  if (compact && compact.value.soundscapePlanId === input.soundscapePlan.soundscapePlanId) {
    return createSoundEffectRenderPlan({ plan: input.soundscapePlan, target: compact.value.target, allowUnavailable: true, ...(compact.value.licenseUse ? { licenseUse: compact.value.licenseUse } : {}) })
  }
  if (input.retainedPlanRef) {
    const retained = await loadSoundEffectRenderPlan(input.rootDir, input.retainedPlanRef)
    if (retained.soundscapePlanId !== input.soundscapePlan.soundscapePlanId) throw UsageError('Retained sound-effect target belongs to a different soundscape plan; provide an explicit --sfx-provider for the new plan.')
    return retained
  }
  throw UsageError('Authored SFX, VOCAL SFX, or AMBIENCE requires --sfx-provider (e.g. elevenlabs=eleven_text_to_sound_v2 or replicate=sepal/audiogen@154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8); no paid hosted default is selected.')
}

export const planComicSoundscapePrice = async (input: {
  rootDir: string
  plan: SoundscapePlan
  selector?: string | undefined
  licenseUseClassification?: SoundEffectLicenseUseClassification | undefined
  retainedPlanRef?: { path: string, sha256: string } | undefined
}): Promise<{ renderPlan?: SoundEffectRenderPlan | undefined, summary: string }> => {
  const renderPlan = await resolveSoundEffectPlan({
    rootDir: input.rootDir,
    soundscapePlan: input.plan,
    selector: input.selector,
    licenseUseClassification: input.licenseUseClassification,
    retainedPlanRef: input.retainedPlanRef,
  })
  if (!renderPlan) return { summary: 'soundscape: 0 authored generation tasks, 0.0000 USD, no SFX target setup' }
  const estimate = await planSoundEffectResumePrice(input.rootDir, renderPlan)
  const amount = estimate.amount === null ? 'unknown' : estimate.amount.toFixed(4)
  return { renderPlan, summary: `soundscape ${renderPlan.target.provider}/${renderPlan.target.model}: ${estimate.unresolvedTaskCount} unresolved, ${estimate.cachedTaskCount} cache, ${estimate.resumedTaskCount} resume, ${amount} ${estimate.currency}` }
}

const requireSoundscapeProviderApiKey = (provider: string): string =>
  provider === 'replicate'
    ? requireProviderKey('replicate', 'comic:soundscape', 'Replicate AudioGen sound-effect generation')
    : provider === 'stability'
      ? requireProviderKey('stability', 'comic:soundscape', 'Stability Stable Audio 3 sound-effect generation')
      : requireProviderKey('elevenlabs', 'comic:soundscape', 'ElevenLabs sound-effect generation')

export const assertComicSoundscapeExecutionReady = async (rootDir: string, renderPlan: SoundEffectRenderPlan): Promise<void> => {
  const estimate = await planSoundEffectResumePrice(rootDir, renderPlan)
  if (estimate.unresolvedTaskCount > 0) {
    if (renderPlan.target.provider === 'replicate') {
      assertAudioGenDispatchEligible(renderPlan.target.capabilityFixture)
      assertAudioGenLicenseEligible(renderPlan.licenseUse, renderPlan.target.capabilityFixture)
    }
    requireSoundscapeProviderApiKey(renderPlan.target.provider)
  }
}

export const runComicSoundscape = async (input: {
  rootDir: string
  plan: SoundscapePlan
  renderPlan: SoundEffectRenderPlan
  dialoguePlan: Parameters<typeof resolveSoundscapeTimeline>[0]['dialoguePlan']
  dialogueRuns: DialogueAudioRunBinding[]
  concurrency?: number | undefined
  cancellation?: AbortSignal | undefined
  adapter?: SoundEffectAdapter | undefined
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
}): Promise<{
  planRef: { path: string, sha256: string }
  renderPlanRef?: { path: string, sha256: string } | undefined
  renderResultRef: { path: string, sha256: string }
  compactSfx?: CompactSfx | undefined
  soundscapeRuns: Array<{ binding: DialogueAudioRunBinding, mix: CompactMix, ref: { path: string, sha256: string } }>
  providerState: PipelineProviderState
}> => {
  if (input.dialogueRuns.length === 0) throw UsageError('Soundscape mastering requires at least one selected dialogue AudioRun.')
  const planRef = await writeSoundscapePlan(input.rootDir, input.plan)
  const retainedCompact = await loadCompactSfx(input.rootDir, input.renderPlan)
  let renderResult = retainedCompact ? await loadSoundEffectRenderResult(input.rootDir, input.renderPlan) : undefined
  let renderResultRef: { path: string, sha256: string }
  let renderPlanRef: { path: string, sha256: string } | undefined
  let compactSfx = retainedCompact?.value
  if (retainedCompact && renderResult) {
    renderResultRef = retainedCompact.ref
  } else {
    renderPlanRef = await writeSoundEffectRenderPlan(input.rootDir, input.renderPlan)
    const estimate = await planSoundEffectResumePrice(input.rootDir, input.renderPlan)
    const liveAdapter = input.adapter ?? (estimate.unresolvedTaskCount > 0
      ? (input.renderPlan.target.provider === 'replicate'
          ? createReplicateAudioGenAdapter({ apiToken: requireSoundscapeProviderApiKey('replicate') })
          : input.renderPlan.target.provider === 'stability'
            ? createStabilitySoundEffectAdapter({ apiKey: requireSoundscapeProviderApiKey('stability') })
            : createElevenLabsSoundEffectAdapter({ apiKey: requireSoundscapeProviderApiKey(input.renderPlan.target.provider) }))
      : { generate: async (): Promise<never> => { throw UsageError('Verified sound-effect resume planning unexpectedly attempted provider dispatch.') } })
    const executed = await executeSoundEffectRenderPlan({ rootDir: input.rootDir, plan: input.renderPlan, adapter: liveAdapter, concurrency: input.concurrency, cancellation: input.cancellation, hostedConcurrencyCoordinator: input.hostedConcurrencyCoordinator })
    renderResult = executed.result
    renderResultRef = executed.ref
    compactSfx = executed.compact
    if (executed.compact) renderPlanRef = undefined
  }
  if (!renderResult) throw UsageError('Sound-effect render produced no result.')
  const providerState: PipelineProviderState = {
    service: input.renderPlan.target.provider,
    model: input.renderPlan.target.model,
    local: false,
    operation: 'sound-effect-generation',
    targetKey: input.renderPlan.target.targetKey,
    transport: input.renderPlan.target.transport,
    artifactDir: compactSfx ? 'audio/sound-effects' : `audio/sound-effects/${input.renderPlan.renderPlanId}`,
    status: renderResult.status === 'succeeded' ? 'succeeded' : 'failed',
    attempts: 1,
    options: { outputFormat: input.renderPlan.target.outputFormat, promptInfluence: input.renderPlan.target.promptInfluence, boundedConcurrency: input.concurrency ?? 2 },
    metadata: {
      soundscapePlanId: input.plan.soundscapePlanId,
      renderPlanId: input.renderPlan.renderPlanId,
      resultId: compactSfx?.sfxId ?? renderResult.resultId,
      taskCount: input.renderPlan.tasks.length,
      ...(input.hostedConcurrencyCoordinator ? { hostedConcurrency: input.hostedConcurrencyCoordinator.snapshot() } : {})
    },
    ...(renderResult.status === 'succeeded' ? { result: { resultId: compactSfx?.sfxId ?? renderResult.resultId, renderResultRef: renderResultRef.path, renderResultSha256: renderResultRef.sha256 } } : { error: { code: renderResult.status === 'canceled' ? 'canceled' : 'required-cue-failed', message: 'One or more required sound cues did not produce a verified source.' } }),
  }
  if (renderResult.status !== 'succeeded') return { planRef, ...(renderPlanRef ? { renderPlanRef } : {}), renderResultRef, soundscapeRuns: [], providerState }
  const sfxRef = compactSfx ? { sfxId: compactSfx.sfxId, path: renderResultRef.path, sha256: renderResultRef.sha256 } : undefined
  const mixed: Array<{ binding: DialogueAudioRunBinding, mix: CompactMix, ref: { path: string, sha256: string } }> = []
  for (const binding of input.dialogueRuns) {
    const dialogue = await loadDialogueMixSource(input.rootDir, binding)
    const timeline = resolveSoundscapeTimeline({ plan: input.plan, dialoguePlan: input.dialoguePlan, dialogueTimeline: dialogue.timeline, dialogueAudioRunId: dialogue.audioRunId, renderResult })
    const soundscape = await mixSoundscape({
      rootDir: input.rootDir, plan: input.plan, planRef, timeline,
      dialogueAudioRun: { audioRunId: dialogue.audioRunId, path: dialogue.path, sha256: dialogue.sha256, finalAudio: dialogue.finalAudio },
      ...(renderPlanRef ? { renderPlan: { value: input.renderPlan, ref: renderPlanRef } } : {}),
      renderResult: { value: renderResult, ref: renderResultRef },
      ...(sfxRef ? { sfx: sfxRef } : {}),
      cancellation: input.cancellation,
    })
    mixed.push({ binding, ...soundscape })
  }
  for (const entry of mixed) {
    const published = await hardlinkContainedArtifact(input.rootDir, entry.mix.master.path, entry.binding.reportedOutputPath)
    if (published.sha256 !== entry.mix.master.sha256) throw UsageError('Published soundscape master checksum does not match its canonical artifact.')
  }
  return { planRef, ...(renderPlanRef ? { renderPlanRef } : {}), renderResultRef, ...(compactSfx ? { compactSfx } : {}), soundscapeRuns: mixed, providerState }
}
