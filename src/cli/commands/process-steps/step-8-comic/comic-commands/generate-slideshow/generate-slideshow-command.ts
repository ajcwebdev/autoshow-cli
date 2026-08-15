import { posix } from 'node:path'
import type { CliCommandContext, ComicPresentationRun, ResolvedPanelTimeline } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { canonicalTtsJson } from '../../../step-4-tts/script-to-audio/contract-identity'
import { readContainedArtifactFile, writeImmutableArtifactFile } from '../../../step-4-tts/script-to-audio/safe-artifact-store'
import { resolveCompatibleComicSceneRun } from '../../comic-utils/compatible-scene-run'
import { updateComicPresentationManifest } from '../../comic-utils/comic-manifest'
import {
  createComicPresentationPlan,
  reconcilePresentationDialogue,
  reconcilePresentationSoundEffects,
  resolveComicPanelTimeline,
  validateResolvedPanelTimeline,
} from '../../comic-utils/comic-presentation-plan'
import {
  loadPresentationAudio,
  loadPresentationDialoguePlan,
  preparePresentationVisualInputs,
} from '../../comic-utils/comic-presentation-inputs'
import {
  publishComicPresentationFinal,
  renderComicPresentation,
  validateComicPresentationRun,
} from '../../comic-utils/comic-presentation-renderer'

const DEFAULT_UNTIMED_PANEL_MS = 2000
const DEFAULT_FPS = 30

const parsePositiveInteger = (value: unknown, fallback: number, label: string, maximum?: number): number => {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0 || (maximum !== undefined && Number(value) > maximum)) {
    throw CLIUsageError(`${label} must be a positive safe integer${maximum === undefined ? '' : ` no greater than ${maximum}`}.`)
  }
  return Number(value)
}

const loadCompleteRun = async (input: {
  sceneRunDir: string
  runPath: string
  presentationId: string
  planRef: { path: string, sha256: string }
  timelineRef: { path: string, sha256: string }
}): Promise<{ run: ComicPresentationRun, runRef: { path: string, sha256: string } } | undefined> => {
  let stored: Awaited<ReturnType<typeof readContainedArtifactFile>>
  try { stored = await readContainedArtifactFile(input.sceneRunDir, input.runPath) }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') return undefined
    if (error instanceof Error && /does not exist|no such file/iu.test(error.message)) return undefined
    throw error
  }
  let run: ComicPresentationRun
  try { run = validateComicPresentationRun(JSON.parse(stored.bytes.toString('utf8')) as ComicPresentationRun) }
  catch (error) { throw CLIUsageError(`Retained ComicPresentationRun is invalid: ${error instanceof Error ? error.message : String(error)}`) }
  if (run.presentationId !== input.presentationId || canonicalTtsJson(run.plan) !== canonicalTtsJson(input.planRef) || canonicalTtsJson({ path: run.resolvedTimeline.path, sha256: run.resolvedTimeline.sha256 }) !== canonicalTtsJson(input.timelineRef)) throw CLIUsageError('Retained ComicPresentationRun conflicts with the deterministic presentation inputs.')
  for (const output of [run.outputs.wav, run.outputs.mp4]) {
    const artifact = await readContainedArtifactFile(input.sceneRunDir, output.path)
    if (artifact.sha256 !== output.sha256) throw CLIUsageError(`Retained ComicPresentationRun output checksum is stale: ${output.path}`)
  }
  return { run, runRef: { path: input.runPath, sha256: stored.sha256 } }
}

export const generateComicSlideshow = async (ctx: CliCommandContext, scriptPath: string): Promise<void> => {
  const flags = ctx.flags as Record<string, unknown>
  const untimedPanelMs = parsePositiveInteger(flags['untimed-panel-ms'], DEFAULT_UNTIMED_PANEL_MS, '--untimed-panel-ms')
  const fps = parsePositiveInteger(flags['fps'], DEFAULT_FPS, '--fps', 120)
  const audioTarget = typeof flags['audio-target'] === 'string' && flags['audio-target'].trim() ? flags['audio-target'].trim() : undefined
  if (audioTarget && !/^[^=\s]+=[^=\s]+$/u.test(audioTarget)) throw CLIUsageError('--audio-target must use <provider>=<model>.')
  if (flags['price'] === true) {
    l.write('info', 'Comic slideshow price: $0.00 (local FFmpeg presentation; no writes).')
    return
  }

  const compatible = await resolveCompatibleComicSceneRun({ scriptPath })
  const [visuals, dialogue, audio] = await Promise.all([
    preparePresentationVisualInputs(compatible),
    loadPresentationDialoguePlan(compatible),
    loadPresentationAudio(compatible, audioTarget),
  ])
  const { scene, sceneRef, panels } = visuals
  const dialogueBindings = reconcilePresentationDialogue({ scene, dialoguePlan: dialogue.plan })
  const soundBindings = reconcilePresentationSoundEffects({
    scene,
    structuredScript: compatible.structuredScript,
    dialogueBindings,
    sounds: audio.sounds,
    busGainDb: audio.soundscapePlan?.mixProfile.busGainDb,
    defaultPan: audio.soundscapePlan?.mixProfile.defaultPan ?? 0,
  })
  const dialogueTimelinePath = posix.join(posix.dirname(audio.dialogueBinding.audioRunRef), audio.dialogueAudioRun.finalTimeline.path)
  const presentationPlan = createComicPresentationPlan({
    schemaVersion: 1,
    sceneRunIdentity: compatible.comicMetadata.audio.sceneRunIdentity as string,
    sourceIdentity: compatible.sourceIdentity,
    createdAt: compatible.manifest.createdAt,
    options: { untimedPanelMs, fps },
    inputs: {
      reviewedScene: sceneRef,
      structuredScript: { path: dialogue.plan.structuredScript.path, sha256: dialogue.plan.structuredScript.sha256 },
      dialoguePlan: { ...dialogue.ref, dialoguePlanId: dialogue.plan.dialoguePlanId },
      audioTarget: { kind: audio.kind, targetKey: audio.targetKey, provider: audio.provider, model: audio.model },
      dialogueAudioRun: { path: audio.dialogueBinding.audioRunRef, sha256: audio.dialogueBinding.audioRunSha256, audioRunId: audio.dialogueAudioRun.audioRunId },
      dialogueTimeline: { path: dialogueTimelinePath, sha256: audio.dialogueAudioRun.finalTimeline.sha256, timelineId: audio.dialogueTimeline.timelineId },
      dialogueAudio: audio.dialogueAudio,
      ...(audio.soundscapeBinding && audio.soundscapeAudioRun ? { soundscapeAudioRun: { path: audio.soundscapeBinding.audioRunRef, sha256: audio.soundscapeBinding.audioRunSha256, audioRunId: audio.soundscapeAudioRun.audioRunId } } : {}),
      ...(audio.soundscapePlan && audio.soundscapeAudioRun ? { soundscapePlan: { path: audio.soundscapeAudioRun.soundscapePlan.path, sha256: audio.soundscapeAudioRun.soundscapePlan.sha256, soundscapePlanId: audio.soundscapePlan.soundscapePlanId } } : {}),
      ...(audio.renderResult && audio.soundscapeAudioRun?.soundEffectRenderResult ? { soundEffectRenderResult: { path: audio.soundscapeAudioRun.soundEffectRenderResult.path, sha256: audio.soundscapeAudioRun.soundEffectRenderResult.sha256, resultId: audio.renderResult.resultId } } : {}),
      ...(audio.soundscapeTimeline && audio.soundscapeAudioRun ? { soundscapeTimeline: { path: audio.soundscapeAudioRun.resolvedTimeline.path, sha256: audio.soundscapeAudioRun.resolvedTimeline.sha256, timelineId: audio.soundscapeTimeline.timelineId, preRollMs: audio.soundscapeTimeline.preRollMs } } : {}),
      panels,
    },
    dialogueBindings,
    soundBindings,
    ambience: audio.ambience,
    ...(audio.soundscapePlan ? { soundscapeMixProfile: audio.soundscapePlan.mixProfile } : {}),
  })
  const dialogueRanges = new Map(audio.dialogueTimeline.timing.availability === 'timed'
    ? audio.dialogueTimeline.timing.turns.map(turn => [turn.turnId, { start: turn.startMs, end: turn.endMs }] as const)
    : [])
  const timeline: ResolvedPanelTimeline = validateResolvedPanelTimeline(resolveComicPanelTimeline({
    presentationId: presentationPlan.presentationId,
    panels,
    dialogueBindings,
    dialogueRanges,
    dialoguePreRollMs: audio.soundscapeTimeline?.preRollMs ?? 0,
    soundBindings,
    untimedPanelMs,
  }))
  const runRoot = `presentation/runs/${presentationPlan.presentationId}`
  const planPath = `${runRoot}/comic-presentation-plan.json`
  const timelinePath = `${runRoot}/resolved-panel-timeline.json`
  const planWritten = await writeImmutableArtifactFile(compatible.sceneRunDir, planPath, `${canonicalTtsJson(presentationPlan)}\n`)
  const timelineWritten = await writeImmutableArtifactFile(compatible.sceneRunDir, timelinePath, `${canonicalTtsJson(timeline)}\n`)
  const planRef = { path: planWritten.relativePath, sha256: planWritten.sha256 }
  const timelineRef = { path: timelineWritten.relativePath, sha256: timelineWritten.sha256 }
  const runPath = `${runRoot}/comic-presentation-run.json`
  const completed = await loadCompleteRun({ sceneRunDir: compatible.sceneRunDir, runPath, presentationId: presentationPlan.presentationId, planRef, timelineRef })
    ?? await renderComicPresentation({ sceneRunDir: compatible.sceneRunDir, plan: presentationPlan, planRef, timeline, timelineRef })
  const finalOutputRefs = [
    { path: 'presentation/final/slideshow.wav', sha256: completed.run.outputs.wav.sha256 },
    { path: 'presentation/final/slideshow.mp4', sha256: completed.run.outputs.mp4.sha256 },
  ]
  const currentRefs = [
    planRef,
    timelineRef,
    completed.runRef,
    { path: completed.run.outputs.wav.path, sha256: completed.run.outputs.wav.sha256 },
    { path: completed.run.outputs.mp4.path, sha256: completed.run.outputs.mp4.sha256 },
    ...finalOutputRefs,
  ]
  const prior = compatible.comicMetadata
  const artifactRefByPath = new Map(prior.stages.presentation.artifactRefs.map(ref => [ref.path, ref] as const))
  for (const ref of currentRefs) artifactRefByPath.set(ref.path, ref)
  const artifactRefs = [...artifactRefByPath.values()].sort((left, right) => left.path.localeCompare(right.path))
  const presentation = {
    selectedPresentationId: presentationPlan.presentationId,
    planRef,
    resolvedTimelineRef: timelineRef,
    runRef: completed.runRef,
    finalOutputRefs,
  }
  const alreadyPublished = canonicalTtsJson(prior.presentation) === canonicalTtsJson(presentation)
    && prior.stages.presentation.status === 'full'
    && artifactRefs.every(ref => prior.stages.presentation.artifactRefs.some(existing => existing.path === ref.path && existing.sha256 === ref.sha256))
    && prior.stages.presentation.artifactRefs.length === artifactRefs.length
  if (!alreadyPublished) {
    await updateComicPresentationManifest({
      sceneRunDir: compatible.sceneRunDir,
      sourceIdentity: compatible.sourceIdentity,
      stage: { requirement: 'optional', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs },
      presentation,
      publishFinal: async () => await publishComicPresentationFinal(compatible.sceneRunDir, completed.run),
    })
  }
  l.write('info', alreadyPublished
    ? `Comic slideshow already complete; verified immutable checksums: ${compatible.sceneRunDir}`
    : `Comic slideshow complete: ${compatible.sceneRunDir}/presentation/final/slideshow.mp4`)
}
