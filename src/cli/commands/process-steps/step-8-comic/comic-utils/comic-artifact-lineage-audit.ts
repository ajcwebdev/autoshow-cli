import { join, posix } from 'node:path'
import type {
  ArtifactRef,
  AudioRun,
  CanonicalComicItemMetadata,
  ComicArtifactLineageAudit,
  ComicArtifactLineageError,
  CompactMix,
  CompactPresentation,
  CompactSfx,
  CompactTargetRender,
  FinalTimeline,
  LineageVerifier,
  SoundscapePlan,
} from '~/types'
import { readManifest } from '../../pipeline-manifest'
import { hashCanonicalTtsValue } from '../../step-4-tts/script-to-audio/contract-identity'
import { isMissingArtifactError, readContainedArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'
import { soundscapeReportedOutputPath } from './comic-soundscape-workflow'
import { validateComicPresentationPlan, validateResolvedPanelTimeline } from './comic-presentation-plan'
import { PRESENTATION_ARCHIVE_PATH, validateCompactPresentation } from './comic-presentation-renderer'

export const soundscapeAudioRunLineageRefs = (run: CompactMix): ArtifactRef[] => [
  { path: run.soundscapePlan.path, sha256: run.soundscapePlan.sha256 },
  ...(run.sfx ? [{ path: run.sfx.path, sha256: run.sfx.sha256 }] : []),
  ...run.stems.map(stem => ({ path: stem.path, sha256: stem.sha256 })),
  { path: run.master.path, sha256: run.master.sha256 },
]

const runRelativeRef = (audioRunRef: string, ref: ArtifactRef): ArtifactRef => ({
  path: posix.join(posix.dirname(audioRunRef), ref.path),
  sha256: ref.sha256,
})

const hashedIdentity = (value: Record<string, unknown>, field: string): boolean => {
  const identity = value[field]
  const base = { ...value }
  delete base[field]
  return typeof identity === 'string' && identity === hashCanonicalTtsValue(base)
}

const auditStageAndEnvelopeArtifacts = async (comic: CanonicalComicItemMetadata, verifier: LineageVerifier): Promise<void> => {
  for (const stage of Object.values(comic.stages)) {
    for (const ref of stage.artifactRefs) await verifier.verifyRef(ref, `Stage artifact ${ref.path}`)
  }
  const audio = comic.audio
  for (const ref of [audio.structuredScript, audio.dialoguePlanRef, audio.snapshotRef, audio.mixPlanRef, audio.finalTimelineRef, audio.soundscapePlanRef, audio.soundEffectRenderPlanRef, audio.soundEffectRenderResultRef]) {
    if (ref) await verifier.verifyRef(ref, `Audio envelope ${ref.path}`)
  }
  for (const ref of audio.finalOutputRefs ?? []) await verifier.verifyRef(ref, `Audio final output ${ref.path}`)
}

const auditDialogueArtifacts = async (
  audio: CanonicalComicItemMetadata['audio'],
  sceneRunDir: string,
  selectedDialogueTargets: string[],
  verifier: LineageVerifier
): Promise<Map<string, NonNullable<typeof audio.selectedAudioRuns>[number]>> => {
  const dialogueById = new Map<string, NonNullable<typeof audio.selectedAudioRuns>[number]>()
  for (const binding of audio.selectedAudioRuns ?? []) {
    selectedDialogueTargets.push(binding.targetKey)
    dialogueById.set(binding.audioRunId, binding)
    const compactRender = await verifier.verifyJson<CompactTargetRender | AudioRun>({ path: binding.audioRunRef, sha256: binding.audioRunSha256 }, `Dialogue render ${binding.audioRunId}`, binding.targetKey)
    if (!compactRender) continue
    if ('renderId' in compactRender && 'outputs' in compactRender && !('audioRunId' in compactRender)) {
      if (!hashedIdentity(compactRender as unknown as Record<string, unknown>, 'renderId') || compactRender.targetKey !== binding.targetKey || compactRender.renderIdentity !== binding.renderIdentity) {
        verifier.fail({ code: 'invalid-identity', message: `Dialogue render ${binding.renderIdentity} does not match its selected binding.`, path: binding.audioRunRef, targetKey: binding.targetKey })
        continue
      }
      const timelinePath = posix.join(posix.dirname(binding.audioRunRef), 'timeline.json')
      try {
        const stored = await readContainedArtifactFile(sceneRunDir, timelinePath)
        const timeline = JSON.parse(stored.bytes.toString('utf8')) as FinalTimeline
        if (timeline.renderIdentity !== compactRender.renderIdentity) {
          verifier.fail({ code: 'invalid-identity', message: `Dialogue timeline does not bind compact render ${binding.renderIdentity}.`, path: timelinePath, targetKey: binding.targetKey })
        } else verifier.verified.add(`${timelinePath}:${stored.sha256}`)
      } catch {
        verifier.fail({ code: 'missing-artifact', message: `Dialogue timeline is missing: ${timelinePath}`, path: timelinePath, targetKey: binding.targetKey })
      }
      await verifier.verifyRef(compactRender.outputs.final, `Dialogue final audio ${compactRender.outputs.final.path}`, binding.targetKey)
      continue
    }
    const run = compactRender as AudioRun
    if (!hashedIdentity(run as unknown as Record<string, unknown>, 'audioRunId') || run.audioRunId !== binding.audioRunId || run.targetKey !== binding.targetKey) {
      verifier.fail({ code: 'invalid-identity', message: `Dialogue AudioRun ${binding.audioRunId} does not match its selected binding.`, path: binding.audioRunRef, targetKey: binding.targetKey })
      continue
    }
    await verifier.verifyJson(runRelativeRef(binding.audioRunRef, run.finalTimeline), `Dialogue FinalTimeline ${run.finalTimeline.timelineId}`, binding.targetKey)
    await verifier.verifyRef(runRelativeRef(binding.audioRunRef, run.transformLedger), `Dialogue transform ledger ${run.transformLedger.transformLedgerId}`, binding.targetKey)
    for (const output of run.finalOutputs) await verifier.verifyRef(runRelativeRef(binding.audioRunRef, output), `Dialogue final audio ${output.path}`, binding.targetKey)
  }
  return dialogueById
}

const auditSoundscapeArtifacts = async (
  audio: CanonicalComicItemMetadata['audio'],
  selectedSoundscapeTargets: string[],
  dialogueById: Map<string, NonNullable<typeof audio.selectedAudioRuns>[number]>,
  verifier: LineageVerifier
): Promise<Map<string, NonNullable<typeof audio.selectedSoundscapeRuns>[number]>> => {
  const soundscapeByTarget = new Map<string, NonNullable<typeof audio.selectedSoundscapeRuns>[number]>()
  for (const binding of audio.selectedSoundscapeRuns ?? []) {
    selectedSoundscapeTargets.push(binding.targetKey)
    soundscapeByTarget.set(binding.targetKey, binding)
    const dialogue = dialogueById.get(binding.dialogueAudioRunId)
    if (!dialogue || dialogue.targetKey !== binding.targetKey) {
      verifier.fail({ code: 'missing-binding', message: `Selected soundscape ${binding.targetKey} has no exact selected dialogue AudioRun ${binding.dialogueAudioRunId}.`, path: binding.audioRunRef, targetKey: binding.targetKey })
    }
    const mix = await verifier.verifyJson<CompactMix>({ path: binding.audioRunRef, sha256: binding.audioRunSha256 }, `Soundscape mix ${binding.soundscapeAudioRunId}`, binding.targetKey)
    if (!mix) continue
    if (mix.mixId !== binding.soundscapeAudioRunId) {
      verifier.fail({ code: 'invalid-identity', message: `Soundscape mix ${binding.soundscapeAudioRunId} has invalid content identity.`, path: binding.audioRunRef, targetKey: binding.targetKey })
      continue
    }
    if (dialogue && (mix.dialogueRender.audioRunId !== dialogue.audioRunId || mix.dialogueRender.sha256 !== dialogue.audioRunSha256 || mix.dialogueRender.path !== dialogue.audioRunRef)) {
      verifier.fail({ code: 'missing-binding', message: `Soundscape mix ${binding.soundscapeAudioRunId} does not bind the selected dialogue render.`, path: binding.audioRunRef, targetKey: binding.targetKey })
    }
    if (mix.master.path !== binding.masterRef.path || mix.master.sha256 !== binding.masterRef.sha256) {
      verifier.fail({ code: 'missing-binding', message: `Soundscape mix ${binding.soundscapeAudioRunId} master does not match its selected masterRef.`, path: binding.masterRef.path, targetKey: binding.targetKey })
    }
    const publishedPath = soundscapeReportedOutputPath(binding.targetKey)
    const published = (audio.finalOutputRefs ?? []).find(ref => ref.path === publishedPath)
    if (!published || published.sha256 !== mix.master.sha256) {
      verifier.fail({ code: 'missing-binding', message: `Published soundscape output ${publishedPath} does not checksum-bind master ${mix.master.sha256}.`, path: publishedPath, targetKey: binding.targetKey })
    } else await verifier.verifyRef(published, `Published soundscape ${publishedPath}`, binding.targetKey)

    const plan = await verifier.verifyJson<SoundscapePlan>(mix.soundscapePlan, `SoundscapePlan ${mix.soundscapePlan.soundscapePlanId}`, binding.targetKey)
    if (plan && (!hashedIdentity(plan as unknown as Record<string, unknown>, 'soundscapePlanId') || plan.soundscapePlanId !== mix.soundscapePlan.soundscapePlanId || (audio.dialoguePlanId && plan.dialoguePlanId !== audio.dialoguePlanId))) {
      verifier.fail({ code: 'invalid-identity', message: `SoundscapePlan ${mix.soundscapePlan.soundscapePlanId} does not bind the selected scene.`, path: mix.soundscapePlan.path, targetKey: binding.targetKey })
    }
    if (mix.sfx) {
      const sfx = await verifier.verifyJson<CompactSfx>(mix.sfx, `Compact SFX ${mix.sfx.sfxId}`, binding.targetKey)
      if (sfx && (!hashedIdentity(sfx as unknown as Record<string, unknown>, 'sfxId') || sfx.sfxId !== mix.sfx.sfxId || sfx.status !== 'succeeded')) {
        verifier.fail({ code: 'invalid-identity', message: `Compact SFX ${mix.sfx.sfxId} is not a complete success identity.`, path: mix.sfx.path, targetKey: binding.targetKey })
      }
      for (const entry of sfx?.entries ?? []) {
        if (entry.status === 'succeeded' && entry.audio) await verifier.verifyRef(entry.audio, `Retained SFX source ${entry.cueId}`, binding.targetKey)
      }
    }
    if (mix.timelineSummary.dialogueAudioRunId !== mix.dialogueRender.audioRunId || (plan && mix.timelineSummary.timelineId && plan.soundscapePlanId !== mix.soundscapePlan.soundscapePlanId)) {
      verifier.fail({ code: 'invalid-identity', message: `Soundscape mix timeline summary does not bind its source runs.`, path: binding.audioRunRef, targetKey: binding.targetKey })
    }
    for (const stem of mix.stems) await verifier.verifyRef(stem, `Soundscape stem ${stem.bus}`, binding.targetKey)
    await verifier.verifyRef(mix.master, `Soundscape master`, binding.targetKey)
  }
  return soundscapeByTarget
}

const auditPresentationArtifacts = async (
  comic: CanonicalComicItemMetadata,
  presentationTargets: string[],
  soundscapeByTarget: Map<string, NonNullable<typeof comic.audio.selectedSoundscapeRuns>[number]>,
  verifier: LineageVerifier
): Promise<void> => {
  const presentation = comic.presentation
  for (const ref of [presentation.planRef, presentation.resolvedTimelineRef, presentation.runRef, ...(presentation.finalOutputRefs ?? [])]) {
    if (ref) await verifier.verifyRef(ref, `Presentation envelope ${ref.path}`)
  }

  const discovered = new Map<string, { targetKey: string, runPath: string }>()
  const archiveRef = presentation.runRef ?? (presentation.planRef?.path === PRESENTATION_ARCHIVE_PATH ? presentation.planRef : undefined)
  if (archiveRef) {
    const compact = await verifier.verifyJson<CompactPresentation>(archiveRef, `Compact presentation ${presentation.selectedPresentationId ?? archiveRef.path}`)
    if (compact) {
      try { validateCompactPresentation(compact) }
      catch (error) {
        verifier.fail({ code: 'invalid-identity', message: `Compact presentation is invalid: ${error instanceof Error ? error.message : String(error)}`, path: archiveRef.path })
      }
      if (presentation.selectedPresentationId && compact.presentationId !== presentation.selectedPresentationId) {
        verifier.fail({ code: 'missing-binding', message: `selectedPresentationId ${presentation.selectedPresentationId} is not bound by presentation.json.`, path: archiveRef.path })
      }
      const plan = compact.plan
      try { validateComicPresentationPlan(plan) }
      catch (error) {
        verifier.fail({ code: 'invalid-identity', message: `ComicPresentationPlan ${plan.presentationId} is invalid: ${error instanceof Error ? error.message : String(error)}`, path: archiveRef.path })
      }
      try { validateResolvedPanelTimeline(compact.timeline) }
      catch (error) {
        verifier.fail({ code: 'invalid-identity', message: `ResolvedPanelTimeline ${compact.timeline.timelineId} is invalid: ${error instanceof Error ? error.message : String(error)}`, path: archiveRef.path })
      }
      if (compact.timeline.presentationId !== plan.presentationId) {
        verifier.fail({ code: 'missing-binding', message: `ResolvedPanelTimeline ${compact.timeline.timelineId} does not bind presentation ${plan.presentationId}.`, path: archiveRef.path })
      }
      presentationTargets.push(plan.inputs.audioTarget.targetKey)
      discovered.set(plan.inputs.audioTarget.targetKey, { targetKey: plan.inputs.audioTarget.targetKey, runPath: archiveRef.path })
      const soundscape = soundscapeByTarget.get(plan.inputs.audioTarget.targetKey)
      if (plan.inputs.audioTarget.kind === 'soundscape') {
        if (!soundscape) verifier.fail({ code: 'missing-binding', message: `Presentation ${plan.presentationId} binds missing selected soundscape ${plan.inputs.audioTarget.targetKey}.`, path: archiveRef.path, targetKey: plan.inputs.audioTarget.targetKey })
        else if (plan.inputs.soundscapeAudioRun && (plan.inputs.soundscapeAudioRun.path !== soundscape.audioRunRef || plan.inputs.soundscapeAudioRun.sha256 !== soundscape.audioRunSha256 || plan.inputs.soundscapeAudioRun.audioRunId !== soundscape.soundscapeAudioRunId)) {
          verifier.fail({ code: 'missing-binding', message: `Presentation ${plan.presentationId} does not bind the selected soundscape mix.`, path: archiveRef.path, targetKey: plan.inputs.audioTarget.targetKey })
        }
      }
      for (const panel of plan.inputs.panels) await verifier.verifyRef(panel, `Presentation panel ${panel.panelNumber}`, plan.inputs.audioTarget.targetKey)
      await verifier.verifyRef(plan.inputs.reviewedScene, `Presentation reviewed scene`, plan.inputs.audioTarget.targetKey)
      await verifier.verifyRef(plan.inputs.structuredScript, `Presentation structured script`, plan.inputs.audioTarget.targetKey)
      await verifier.verifyRef(plan.inputs.dialoguePlan, `Presentation dialogue plan`, plan.inputs.audioTarget.targetKey)
      await verifier.verifyRef(plan.inputs.dialogueAudioRun, `Presentation dialogue AudioRun`, plan.inputs.audioTarget.targetKey)
      await verifier.verifyRef(plan.inputs.dialogueTimeline, `Presentation dialogue timeline`, plan.inputs.audioTarget.targetKey)
      await verifier.verifyRef(plan.inputs.dialogueAudio, `Presentation dialogue audio`, plan.inputs.audioTarget.targetKey)
      if (plan.inputs.soundscapeAudioRun) await verifier.verifyRef(plan.inputs.soundscapeAudioRun, `Presentation soundscape mix`, plan.inputs.audioTarget.targetKey)
      if (plan.inputs.soundscapePlan) await verifier.verifyRef(plan.inputs.soundscapePlan, `Presentation SoundscapePlan`, plan.inputs.audioTarget.targetKey)
      if (plan.inputs.soundEffectRenderResult) await verifier.verifyRef(plan.inputs.soundEffectRenderResult, `Presentation sound-effect result`, plan.inputs.audioTarget.targetKey)
      if (plan.inputs.soundscapeTimeline) await verifier.verifyRef(plan.inputs.soundscapeTimeline, `Presentation soundscape timeline`, plan.inputs.audioTarget.targetKey)
      for (const binding of plan.soundBindings) await verifier.verifyRef(binding.sourceAudio, `Presentation sound binding ${binding.cueId}`, plan.inputs.audioTarget.targetKey)
      for (const bed of plan.ambience) await verifier.verifyRef(bed.sourceAudio, `Presentation ambience ${bed.cueId}`, plan.inputs.audioTarget.targetKey)
      await verifier.verifyRef(compact.outputs.wav, `Presentation WAV ${compact.outputs.wav.path}`)
      await verifier.verifyRef(compact.outputs.mp4, `Presentation MP4 ${compact.outputs.mp4.path}`)
      for (const transform of compact.audioTransforms) {
        if (transform.sourceRef) await verifier.verifyRef(transform.sourceRef, `Presentation transform ${transform.transformId}`)
      }
    }
  }

  if (comic.stages.presentation.requirement !== 'not-requested' && comic.stages.presentation.status === 'full') {
    if (!archiveRef || discovered.size === 0) {
      verifier.fail({ code: 'missing-presentation', message: 'Published comic presentation stage has no compact presentation.json archive.', path: PRESENTATION_ARCHIVE_PATH })
    }
    if (presentation.selectedPresentationId && !archiveRef) {
      verifier.fail({ code: 'missing-binding', message: `selectedPresentationId ${presentation.selectedPresentationId} is not bound by presentation.json.`, path: PRESENTATION_ARCHIVE_PATH })
    }
  }
}

export const auditComicSceneArtifactLineage = async (sceneRunDir: string): Promise<ComicArtifactLineageAudit> => {
  const errors: ComicArtifactLineageError[] = []
  const verified = new Set<string>()
  const selectedDialogueTargets: string[] = []
  const selectedSoundscapeTargets: string[] = []
  const presentationTargets: string[] = []

  const fail = (error: ComicArtifactLineageError): void => {
    errors.push(error)
  }

  const verifyRef = async (ref: ArtifactRef, label: string, targetKey?: string): Promise<Buffer | undefined> => {
    const key = `${ref.path}:${ref.sha256}`
    try {
      const stored = await readContainedArtifactFile(sceneRunDir, ref.path)
      if (stored.sha256 !== ref.sha256) {
        fail({ code: 'checksum-mismatch', message: `${label} checksum is stale: ${ref.path}`, path: ref.path, targetKey })
        return undefined
      }
      verified.add(key)
      return stored.bytes
    } catch (error) {
      const missing = error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
        || isMissingArtifactError(error)
      fail({
        code: missing ? 'missing-artifact' : 'checksum-mismatch',
        message: `${label} ${missing ? 'is missing' : 'could not be verified'}: ${ref.path}`,
        path: ref.path,
        targetKey,
      })
      return undefined
    }
  }

  const verifyJson = async <T>(ref: ArtifactRef, label: string, targetKey?: string): Promise<T | undefined> => {
    const bytes = await verifyRef(ref, label, targetKey)
    if (!bytes) return undefined
    try { return JSON.parse(bytes.toString('utf8')) as T }
    catch {
      fail({ code: 'invalid-json', message: `${label} is not valid JSON: ${ref.path}`, path: ref.path, targetKey })
      return undefined
    }
  }

  const verifier: LineageVerifier = { verifyRef, verifyJson, fail, verified }

  // Read the canonical envelope, falling back to the raw manifest when the canonical
  // read either rejects or yields a shape that is not a single comic item. This used to
  // be spelled as a throw-as-goto sentinel caught two lines below; the plain conditional
  // says the same thing without putting a control-flow signal through the error vocabulary.
  const manifest = await readManifest(sceneRunDir).catch(() => undefined)
  const item = manifest?.items[0]
  let comic: CanonicalComicItemMetadata | undefined = manifest
    && manifest.command === 'comic'
    && manifest.scope === 'single'
    && manifest.items.length === 1
    && item
    ? item.metadata['comic'] as CanonicalComicItemMetadata | undefined
    : undefined

  if (!comic) {
    try {
      const raw = await Bun.file(join(sceneRunDir, 'manifest.json')).json() as { command?: unknown, items?: Array<{ metadata?: { comic?: CanonicalComicItemMetadata } }> }
      comic = raw.command === 'comic' ? raw.items?.[0]?.metadata?.comic : undefined
    } catch {
      comic = undefined
    }
    if (!comic) {
      return {
        sceneRunDir,
        status: 'failed',
        verifiedRefCount: 0,
        selectedDialogueTargets,
        selectedSoundscapeTargets,
        presentationTargets,
        errors: [{ code: 'manifest-unreadable', message: 'Canonical comic item is missing its metadata.comic envelope.' }],
      }
    }
  }

  await auditStageAndEnvelopeArtifacts(comic, verifier)
  const dialogueById = await auditDialogueArtifacts(comic.audio, sceneRunDir, selectedDialogueTargets, verifier)
  const soundscapeByTarget = await auditSoundscapeArtifacts(comic.audio, selectedSoundscapeTargets, dialogueById, verifier)
  await auditPresentationArtifacts(comic, presentationTargets, soundscapeByTarget, verifier)

  presentationTargets.sort((left, right) => left.localeCompare(right))
  selectedDialogueTargets.sort((left, right) => left.localeCompare(right))
  selectedSoundscapeTargets.sort((left, right) => left.localeCompare(right))
  return {
    sceneRunDir,
    status: errors.length === 0 ? 'passed' : 'failed',
    verifiedRefCount: verified.size,
    selectedDialogueTargets,
    selectedSoundscapeTargets,
    presentationTargets,
    errors,
  }
}

