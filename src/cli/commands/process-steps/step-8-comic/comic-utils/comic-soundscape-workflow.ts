import { mkdir, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import type { AudioRun, FinalTimeline, PipelineProviderState, SoundEffectRenderPlan, SoundscapeAudioRun, SoundscapePlan } from '~/types'
import { requireApiKey } from '~/utils/validate/env-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { readContainedArtifactFile, writeImmutableArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '../../step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan, executeSoundEffectRenderPlan, loadSoundEffectRenderPlan, loadSoundEffectRenderResult, planSoundEffectResumePrice, type SoundEffectAdapter, writeSoundEffectRenderPlan } from '../../step-4-tts/soundscape/sound-effect-execution'
import { mixSoundscape } from '../../step-4-tts/soundscape/soundscape-mixer'
import { resolveSoundscapeTimeline } from '../../step-4-tts/soundscape/soundscape-timeline'
import { writeSoundscapePlan } from '../../step-4-tts/soundscape/soundscape-planner'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '../../step-4-tts/script-to-audio/contract-identity'
import { createSilenceWav } from '../../step-4-tts/tts-utils/audio-utils'

export type DialogueAudioRunBinding = {
  targetKey: string
  renderIdentity: string
  audioRunId: string
  audioRunRef: string
  audioRunSha256: string
  reportedOutputPath: string
}

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
  const work = join(input.rootDir, 'audio', `.local-silence-${randomUUID()}`)
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
  if (stored.sha256 !== sha256) throw CLIUsageError(`${label} checksum is invalid.`)
  try { return JSON.parse(stored.bytes.toString('utf8')) as T }
  catch { throw CLIUsageError(`${label} is not valid JSON.`) }
}

export const resolveSoundEffectPlan = async (input: {
  rootDir: string
  soundscapePlan: SoundscapePlan
  selector?: string | undefined
  retainedPlanRef?: { path: string, sha256: string } | undefined
}): Promise<SoundEffectRenderPlan | undefined> => {
  if (input.soundscapePlan.synthesisTasks.length === 0) return undefined
  if (input.selector) return createSoundEffectRenderPlan({ plan: input.soundscapePlan, target: resolveSoundEffectTarget(input.selector) })
  if (input.retainedPlanRef) {
    const retained = await loadSoundEffectRenderPlan(input.rootDir, input.retainedPlanRef)
    if (retained.soundscapePlanId !== input.soundscapePlan.soundscapePlanId) throw CLIUsageError('Retained sound-effect target belongs to a different soundscape plan; provide an explicit --sfx-provider for the new plan.')
    return retained
  }
  throw CLIUsageError('Authored SFX, VOCAL SFX, or AMBIENCE requires --sfx-provider elevenlabs=eleven_text_to_sound_v2; no paid hosted default is selected.')
}

export const planComicSoundscapePrice = async (input: {
  rootDir: string
  plan: SoundscapePlan
  selector?: string | undefined
  retainedPlanRef?: { path: string, sha256: string } | undefined
}): Promise<{ renderPlan?: SoundEffectRenderPlan | undefined, summary: string }> => {
  const renderPlan = await resolveSoundEffectPlan({ rootDir: input.rootDir, soundscapePlan: input.plan, selector: input.selector, retainedPlanRef: input.retainedPlanRef })
  if (!renderPlan) return { summary: 'soundscape: 0 authored generation tasks, 0.0000 USD, no SFX target setup' }
  const estimate = await planSoundEffectResumePrice(input.rootDir, renderPlan)
  const amount = estimate.amount === null ? 'unknown' : estimate.amount.toFixed(4)
  return { renderPlan, summary: `soundscape ${renderPlan.target.provider}/${renderPlan.target.model}: ${estimate.unresolvedTaskCount} unresolved, ${estimate.cachedTaskCount} cache, ${estimate.resumedTaskCount} resume, ${amount} ${estimate.currency}` }
}

export const assertComicSoundscapeExecutionReady = async (rootDir: string, renderPlan: SoundEffectRenderPlan): Promise<void> => {
  const estimate = await planSoundEffectResumePrice(rootDir, renderPlan)
  if (estimate.unresolvedTaskCount > 0) requireApiKey('ELEVENLABS_API_KEY', 'comic:soundscape', 'ElevenLabs sound-effect generation')
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
}): Promise<{
  planRef: { path: string, sha256: string }
  renderPlanRef: { path: string, sha256: string }
  renderResultRef: { path: string, sha256: string }
  soundscapeRuns: Array<{ binding: DialogueAudioRunBinding, audioRun: SoundscapeAudioRun, ref: { path: string, sha256: string } }>
  providerState: PipelineProviderState
}> => {
  if (input.dialogueRuns.length === 0) throw CLIUsageError('Soundscape mastering requires at least one selected dialogue AudioRun.')
  const planRef = await writeSoundscapePlan(input.rootDir, input.plan)
  const renderPlanRef = await writeSoundEffectRenderPlan(input.rootDir, input.renderPlan)
  let renderResult = await loadSoundEffectRenderResult(input.rootDir, input.renderPlan)
  let renderResultRef: { path: string, sha256: string }
  if (renderResult) {
    const path = `audio/sound-effects/${input.renderPlan.renderPlanId}/sound-effect-render-result.json`
    const stored = await readContainedArtifactFile(input.rootDir, path)
    renderResultRef = { path, sha256: stored.sha256 }
  } else {
    const estimate = await planSoundEffectResumePrice(input.rootDir, input.renderPlan)
    const liveAdapter = input.adapter ?? (estimate.unresolvedTaskCount > 0
      ? createElevenLabsSoundEffectAdapter({ apiKey: requireApiKey('ELEVENLABS_API_KEY', 'comic:soundscape', 'ElevenLabs sound-effect generation') })
      : { generate: async (): Promise<never> => { throw CLIUsageError('Verified sound-effect resume planning unexpectedly attempted provider dispatch.') } })
    const executed = await executeSoundEffectRenderPlan({ rootDir: input.rootDir, plan: input.renderPlan, adapter: liveAdapter, concurrency: input.concurrency, cancellation: input.cancellation })
    renderResult = executed.result
    renderResultRef = executed.ref
  }
  const providerState: PipelineProviderState = {
    service: input.renderPlan.target.provider,
    model: input.renderPlan.target.model,
    local: false,
    operation: 'sound-effect-generation',
    targetKey: input.renderPlan.target.targetKey,
    transport: input.renderPlan.target.transport,
    artifactDir: `audio/sound-effects/${input.renderPlan.renderPlanId}`,
    status: renderResult.status === 'succeeded' ? 'succeeded' : 'failed',
    attempts: 1,
    options: { outputFormat: input.renderPlan.target.outputFormat, promptInfluence: input.renderPlan.target.promptInfluence, boundedConcurrency: input.concurrency ?? 2 },
    metadata: { soundscapePlanId: input.plan.soundscapePlanId, renderPlanId: input.renderPlan.renderPlanId, resultId: renderResult.resultId, taskCount: input.renderPlan.tasks.length },
    ...(renderResult.status === 'succeeded' ? { result: { resultId: renderResult.resultId, renderResultRef: renderResultRef.path, renderResultSha256: renderResultRef.sha256 } } : { error: { code: renderResult.status === 'canceled' ? 'canceled' : 'required-cue-failed', message: 'One or more required sound cues did not produce a verified source.' } }),
  }
  if (renderResult.status !== 'succeeded') return { planRef, renderPlanRef, renderResultRef, soundscapeRuns: [], providerState }
  const mixed: Array<{ binding: DialogueAudioRunBinding, audioRun: SoundscapeAudioRun, ref: { path: string, sha256: string } }> = []
  for (const binding of input.dialogueRuns) {
    const audioRun = await verifiedJson<AudioRun>(input.rootDir, binding.audioRunRef, binding.audioRunSha256, `Dialogue AudioRun ${binding.audioRunId}`)
    if (audioRun.audioRunId !== binding.audioRunId || audioRun.targetKey !== binding.targetKey) throw CLIUsageError('Selected dialogue AudioRun identity does not match its canonical manifest binding.')
    const audioRunDirectory = dirname(binding.audioRunRef)
    const finalTimelinePath = join(audioRunDirectory, audioRun.finalTimeline.path).replace(/\\/gu, '/')
    const finalTimeline = await verifiedJson<FinalTimeline>(input.rootDir, finalTimelinePath, audioRun.finalTimeline.sha256, `Dialogue timeline ${audioRun.finalTimeline.timelineId}`)
    const finalOutput = audioRun.finalOutputs[0]
    if (!finalOutput) throw CLIUsageError(`Dialogue AudioRun ${binding.audioRunId} has no final audio output.`)
    const finalAudioPath = join(audioRunDirectory, finalOutput.path).replace(/\\/gu, '/')
    const timeline = resolveSoundscapeTimeline({ plan: input.plan, dialoguePlan: input.dialoguePlan, dialogueTimeline: finalTimeline, dialogueAudioRunId: audioRun.audioRunId, renderResult })
    const soundscape = await mixSoundscape({
      rootDir: input.rootDir, plan: input.plan, planRef, timeline,
      dialogueAudioRun: { audioRunId: audioRun.audioRunId, path: binding.audioRunRef, sha256: binding.audioRunSha256, finalAudio: { path: finalAudioPath, sha256: finalOutput.sha256 } },
      renderPlan: { value: input.renderPlan, ref: renderPlanRef }, renderResult: { value: renderResult, ref: renderResultRef }, cancellation: input.cancellation,
    })
    mixed.push({ binding, ...soundscape })
  }
  for (const entry of mixed) {
    const master = await readContainedArtifactFile(input.rootDir, entry.audioRun.master.path)
    if (master.sha256 !== entry.audioRun.master.sha256) throw CLIUsageError('Soundscape master checksum changed before publication.')
    await Bun.write(join(input.rootDir, entry.binding.reportedOutputPath), master.bytes)
    const published = new Uint8Array(await Bun.file(join(input.rootDir, entry.binding.reportedOutputPath)).arrayBuffer())
    if (sha256Bytes(published) !== master.sha256) throw CLIUsageError('Published soundscape master checksum does not match its canonical artifact.')
  }
  return { planRef, renderPlanRef, renderResultRef, soundscapeRuns: mixed, providerState }
}
