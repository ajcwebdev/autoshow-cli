import { readdir } from 'node:fs/promises'
import { join, posix } from 'node:path'
import type {
  AudioRun,
  CanonicalComicItemMetadata,
  ComicPresentationPlan,
  ComicPresentationRun,
  ResolvedPanelTimeline,
  ResolvedSoundscapeTimeline,
  SoundEffectRenderResult,
  SoundscapeAudioRun,
  SoundscapePlan,
} from '~/types'
import { readManifest } from '../../pipeline-manifest'
import { canonicalTtsJson, hashCanonicalTtsValue } from '../../step-4-tts/script-to-audio/contract-identity'
import { readContainedArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'
import { soundscapeReportedOutputPath } from './comic-soundscape-workflow'
import { validateComicPresentationPlan, validateResolvedPanelTimeline } from './comic-presentation-plan'
import { validateComicPresentationRun } from './comic-presentation-renderer'

export type ComicArtifactLineageError = {
  code: 'manifest-unreadable' | 'checksum-mismatch' | 'missing-artifact' | 'invalid-json' | 'invalid-identity' | 'missing-binding' | 'missing-presentation' | 'transform-ledger-mismatch'
  message: string
  path?: string | undefined
  targetKey?: string | undefined
}

export type ComicArtifactLineageAudit = {
  sceneRunDir: string
  status: 'passed' | 'failed'
  verifiedRefCount: number
  selectedDialogueTargets: string[]
  selectedSoundscapeTargets: string[]
  presentationTargets: string[]
  errors: ComicArtifactLineageError[]
}

type ArtifactRef = { path: string, sha256: string }

export const soundscapeAudioRunLineageRefs = (run: SoundscapeAudioRun): ArtifactRef[] => [
  { path: run.soundscapePlan.path, sha256: run.soundscapePlan.sha256 },
  ...(run.soundEffectRenderPlan ? [{ path: run.soundEffectRenderPlan.path, sha256: run.soundEffectRenderPlan.sha256 }] : []),
  ...(run.soundEffectRenderResult ? [{ path: run.soundEffectRenderResult.path, sha256: run.soundEffectRenderResult.sha256 }] : []),
  run.resolvedTimeline,
  run.transformLedger,
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
        || (error instanceof Error && /does not exist|no such file/iu.test(error.message))
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

  let comic: CanonicalComicItemMetadata | undefined
  try {
    const manifest = await readManifest(sceneRunDir)
    const item = manifest?.items[0]
    comic = item?.metadata['comic'] as CanonicalComicItemMetadata | undefined
    if (!manifest || manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || !item || !comic) {
      throw new Error('unreadable')
    }
  } catch {
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

  for (const stage of Object.values(comic.stages)) {
    for (const ref of stage.artifactRefs) await verifyRef(ref, `Stage artifact ${ref.path}`)
  }

  const audio = comic.audio
  for (const ref of [audio.structuredScript, audio.dialoguePlanRef, audio.snapshotRef, audio.mixPlanRef, audio.finalTimelineRef, audio.soundscapePlanRef, audio.soundEffectRenderPlanRef, audio.soundEffectRenderResultRef]) {
    if (ref) await verifyRef(ref, `Audio envelope ${ref.path}`)
  }
  for (const ref of audio.finalOutputRefs ?? []) await verifyRef(ref, `Audio final output ${ref.path}`)

  const dialogueById = new Map<string, NonNullable<typeof audio.selectedAudioRuns>[number]>()
  for (const binding of audio.selectedAudioRuns ?? []) {
    selectedDialogueTargets.push(binding.targetKey)
    dialogueById.set(binding.audioRunId, binding)
    const run = await verifyJson<AudioRun>({ path: binding.audioRunRef, sha256: binding.audioRunSha256 }, `Dialogue AudioRun ${binding.audioRunId}`, binding.targetKey)
    if (!run) continue
    if (!hashedIdentity(run as unknown as Record<string, unknown>, 'audioRunId') || run.audioRunId !== binding.audioRunId || run.targetKey !== binding.targetKey) {
      fail({ code: 'invalid-identity', message: `Dialogue AudioRun ${binding.audioRunId} does not match its selected binding.`, path: binding.audioRunRef, targetKey: binding.targetKey })
      continue
    }
    await verifyJson(runRelativeRef(binding.audioRunRef, run.finalTimeline), `Dialogue FinalTimeline ${run.finalTimeline.timelineId}`, binding.targetKey)
    await verifyRef(runRelativeRef(binding.audioRunRef, run.transformLedger), `Dialogue transform ledger ${run.transformLedger.transformLedgerId}`, binding.targetKey)
    for (const output of run.finalOutputs) await verifyRef(runRelativeRef(binding.audioRunRef, output), `Dialogue final audio ${output.path}`, binding.targetKey)
  }

  const soundscapeByTarget = new Map<string, NonNullable<typeof audio.selectedSoundscapeRuns>[number]>()
  for (const binding of audio.selectedSoundscapeRuns ?? []) {
    selectedSoundscapeTargets.push(binding.targetKey)
    soundscapeByTarget.set(binding.targetKey, binding)
    const dialogue = dialogueById.get(binding.dialogueAudioRunId)
    if (!dialogue || dialogue.targetKey !== binding.targetKey) {
      fail({ code: 'missing-binding', message: `Selected soundscape ${binding.targetKey} has no exact selected dialogue AudioRun ${binding.dialogueAudioRunId}.`, path: binding.audioRunRef, targetKey: binding.targetKey })
    }
    const run = await verifyJson<SoundscapeAudioRun>({ path: binding.audioRunRef, sha256: binding.audioRunSha256 }, `Soundscape AudioRun ${binding.soundscapeAudioRunId}`, binding.targetKey)
    if (!run) continue
    if (!hashedIdentity(run as unknown as Record<string, unknown>, 'audioRunId') || run.audioRunId !== binding.soundscapeAudioRunId) {
      fail({ code: 'invalid-identity', message: `Soundscape AudioRun ${binding.soundscapeAudioRunId} has invalid content identity.`, path: binding.audioRunRef, targetKey: binding.targetKey })
      continue
    }
    if (dialogue && (run.dialogueAudioRun.audioRunId !== dialogue.audioRunId || run.dialogueAudioRun.sha256 !== dialogue.audioRunSha256 || run.dialogueAudioRun.path !== dialogue.audioRunRef)) {
      fail({ code: 'missing-binding', message: `Soundscape AudioRun ${binding.soundscapeAudioRunId} does not bind the selected dialogue AudioRun.`, path: binding.audioRunRef, targetKey: binding.targetKey })
    }
    if (run.master.path !== binding.masterRef.path || run.master.sha256 !== binding.masterRef.sha256) {
      fail({ code: 'missing-binding', message: `Soundscape AudioRun ${binding.soundscapeAudioRunId} master does not match its selected masterRef.`, path: binding.masterRef.path, targetKey: binding.targetKey })
    }
    const publishedPath = soundscapeReportedOutputPath(binding.targetKey)
    const published = (audio.finalOutputRefs ?? []).find(ref => ref.path === publishedPath)
    if (!published || published.sha256 !== run.master.sha256) {
      fail({ code: 'missing-binding', message: `Published soundscape output ${publishedPath} does not checksum-bind master ${run.master.sha256}.`, path: publishedPath, targetKey: binding.targetKey })
    } else await verifyRef(published, `Published soundscape ${publishedPath}`, binding.targetKey)

    const plan = await verifyJson<SoundscapePlan>(run.soundscapePlan, `SoundscapePlan ${run.soundscapePlan.soundscapePlanId}`, binding.targetKey)
    if (plan && (!hashedIdentity(plan as unknown as Record<string, unknown>, 'soundscapePlanId') || plan.soundscapePlanId !== run.soundscapePlan.soundscapePlanId || (audio.dialoguePlanId && plan.dialoguePlanId !== audio.dialoguePlanId))) {
      fail({ code: 'invalid-identity', message: `SoundscapePlan ${run.soundscapePlan.soundscapePlanId} does not bind the selected scene.`, path: run.soundscapePlan.path, targetKey: binding.targetKey })
    }
    if (run.soundEffectRenderResult) {
      const result = await verifyJson<SoundEffectRenderResult>(run.soundEffectRenderResult, `SoundEffectRenderResult ${run.soundEffectRenderResult.resultId}`, binding.targetKey)
      if (result && (!hashedIdentity(result as unknown as Record<string, unknown>, 'resultId') || result.resultId !== run.soundEffectRenderResult.resultId || result.status !== 'succeeded')) {
        fail({ code: 'invalid-identity', message: `Sound-effect result ${run.soundEffectRenderResult.resultId} is not a complete success identity.`, path: run.soundEffectRenderResult.path, targetKey: binding.targetKey })
      }
      for (const entry of result?.entries ?? []) {
        if (entry.status === 'succeeded' && entry.audio) await verifyRef(entry.audio, `Retained SFX source ${entry.cueId}`, binding.targetKey)
      }
    }
    if (run.soundEffectRenderPlan) await verifyRef(run.soundEffectRenderPlan, `SoundEffectRenderPlan ${run.soundEffectRenderPlan.renderPlanId}`, binding.targetKey)
    const timeline = await verifyJson<ResolvedSoundscapeTimeline>(run.resolvedTimeline, `Resolved soundscape timeline ${run.resolvedTimeline.timelineId}`, binding.targetKey)
    if (timeline && (!hashedIdentity(timeline as unknown as Record<string, unknown>, 'timelineId') || timeline.timelineId !== run.resolvedTimeline.timelineId || timeline.dialogueAudioRunId !== run.dialogueAudioRun.audioRunId || timeline.soundscapePlanId !== run.soundscapePlan.soundscapePlanId)) {
      fail({ code: 'invalid-identity', message: `Resolved soundscape timeline ${run.resolvedTimeline.timelineId} does not bind its source runs.`, path: run.resolvedTimeline.path, targetKey: binding.targetKey })
    }
    const ledgerBytes = await verifyRef(run.transformLedger, `Soundscape transform ledger`, binding.targetKey)
    if (ledgerBytes) {
      try {
        const ledger = JSON.parse(ledgerBytes.toString('utf8')) as { transforms?: unknown }
        if (canonicalTtsJson(ledger.transforms ?? null) !== canonicalTtsJson(run.transforms)) {
          fail({ code: 'transform-ledger-mismatch', message: `Soundscape transform ledger does not match AudioRun transforms.`, path: run.transformLedger.path, targetKey: binding.targetKey })
        }
      } catch {
        fail({ code: 'invalid-json', message: `Soundscape transform ledger is not valid JSON: ${run.transformLedger.path}`, path: run.transformLedger.path, targetKey: binding.targetKey })
      }
    }
    for (const stem of run.stems) await verifyRef(stem, `Soundscape stem ${stem.bus}`, binding.targetKey)
    await verifyRef(run.master, `Soundscape master`, binding.targetKey)
  }

  const presentation = comic.presentation
  for (const ref of [presentation.planRef, presentation.resolvedTimelineRef, presentation.runRef, ...(presentation.finalOutputRefs ?? [])]) {
    if (ref) await verifyRef(ref, `Presentation envelope ${ref.path}`)
  }

  const discovered = new Map<string, { targetKey: string, runPath: string }>()
  try {
    const entries = await readdir(posix.join(sceneRunDir, 'presentation/runs'), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-f0-9]{64}$/u.test(entry.name)) continue
      const runPath = `presentation/runs/${entry.name}/comic-presentation-run.json`
      const stored = await readContainedArtifactFile(sceneRunDir, runPath).catch(() => undefined)
      if (!stored) {
        fail({ code: 'missing-artifact', message: `Presentation run directory ${entry.name} is missing comic-presentation-run.json.`, path: runPath })
        continue
      }
      let run: ComicPresentationRun
      try { run = validateComicPresentationRun(JSON.parse(stored.bytes.toString('utf8')) as ComicPresentationRun) }
      catch (error) {
        fail({ code: 'invalid-identity', message: `Presentation run ${entry.name} is invalid: ${error instanceof Error ? error.message : String(error)}`, path: runPath })
        continue
      }
      verified.add(`${runPath}:${stored.sha256}`)
      const plan = await verifyJson<ComicPresentationPlan>(run.plan, `ComicPresentationPlan ${run.presentationId}`)
      const timeline = await verifyJson<ResolvedPanelTimeline>(run.resolvedTimeline, `ResolvedPanelTimeline ${run.resolvedTimeline.timelineId}`)
      if (plan) {
        try { validateComicPresentationPlan(plan) }
        catch (error) {
          fail({ code: 'invalid-identity', message: `ComicPresentationPlan ${run.presentationId} is invalid: ${error instanceof Error ? error.message : String(error)}`, path: run.plan.path })
        }
        presentationTargets.push(plan.inputs.audioTarget.targetKey)
        discovered.set(plan.inputs.audioTarget.targetKey, { targetKey: plan.inputs.audioTarget.targetKey, runPath })
        const soundscape = soundscapeByTarget.get(plan.inputs.audioTarget.targetKey)
        if (plan.inputs.audioTarget.kind === 'soundscape') {
          if (!soundscape) fail({ code: 'missing-binding', message: `Presentation ${run.presentationId} binds missing selected soundscape ${plan.inputs.audioTarget.targetKey}.`, path: run.plan.path, targetKey: plan.inputs.audioTarget.targetKey })
          else if (plan.inputs.soundscapeAudioRun && (plan.inputs.soundscapeAudioRun.path !== soundscape.audioRunRef || plan.inputs.soundscapeAudioRun.sha256 !== soundscape.audioRunSha256 || plan.inputs.soundscapeAudioRun.audioRunId !== soundscape.soundscapeAudioRunId)) {
            fail({ code: 'missing-binding', message: `Presentation ${run.presentationId} does not bind the selected soundscape AudioRun.`, path: run.plan.path, targetKey: plan.inputs.audioTarget.targetKey })
          }
        }
        for (const panel of plan.inputs.panels) await verifyRef(panel, `Presentation panel ${panel.panelNumber}`, plan.inputs.audioTarget.targetKey)
        await verifyRef(plan.inputs.reviewedScene, `Presentation reviewed scene`, plan.inputs.audioTarget.targetKey)
        await verifyRef(plan.inputs.structuredScript, `Presentation structured script`, plan.inputs.audioTarget.targetKey)
        await verifyRef(plan.inputs.dialoguePlan, `Presentation dialogue plan`, plan.inputs.audioTarget.targetKey)
        await verifyRef(plan.inputs.dialogueAudioRun, `Presentation dialogue AudioRun`, plan.inputs.audioTarget.targetKey)
        await verifyRef(plan.inputs.dialogueTimeline, `Presentation dialogue timeline`, plan.inputs.audioTarget.targetKey)
        await verifyRef(plan.inputs.dialogueAudio, `Presentation dialogue audio`, plan.inputs.audioTarget.targetKey)
        if (plan.inputs.soundscapeAudioRun) await verifyRef(plan.inputs.soundscapeAudioRun, `Presentation soundscape AudioRun`, plan.inputs.audioTarget.targetKey)
        if (plan.inputs.soundscapePlan) await verifyRef(plan.inputs.soundscapePlan, `Presentation SoundscapePlan`, plan.inputs.audioTarget.targetKey)
        if (plan.inputs.soundEffectRenderResult) await verifyRef(plan.inputs.soundEffectRenderResult, `Presentation sound-effect result`, plan.inputs.audioTarget.targetKey)
        if (plan.inputs.soundscapeTimeline) await verifyRef(plan.inputs.soundscapeTimeline, `Presentation soundscape timeline`, plan.inputs.audioTarget.targetKey)
        for (const binding of plan.soundBindings) await verifyRef(binding.sourceAudio, `Presentation sound binding ${binding.cueId}`, plan.inputs.audioTarget.targetKey)
        for (const bed of plan.ambience) await verifyRef(bed.sourceAudio, `Presentation ambience ${bed.cueId}`, plan.inputs.audioTarget.targetKey)
      }
      if (timeline) {
        try { validateResolvedPanelTimeline(timeline) }
        catch (error) {
          fail({ code: 'invalid-identity', message: `ResolvedPanelTimeline ${run.resolvedTimeline.timelineId} is invalid: ${error instanceof Error ? error.message : String(error)}`, path: run.resolvedTimeline.path })
        }
        if (plan && timeline.presentationId !== plan.presentationId) {
          fail({ code: 'missing-binding', message: `ResolvedPanelTimeline ${timeline.timelineId} does not bind presentation ${plan.presentationId}.`, path: run.resolvedTimeline.path })
        }
      }
      await verifyRef(run.outputs.wav, `Presentation WAV ${run.outputs.wav.path}`)
      await verifyRef(run.outputs.mp4, `Presentation MP4 ${run.outputs.mp4.path}`)
      for (const transform of run.audioTransforms) {
        if (transform.sourceRef) await verifyRef(transform.sourceRef, `Presentation transform ${transform.transformId}`)
      }
    }
  } catch (error) {
    const missing = error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
    if (!missing) fail({ code: 'missing-artifact', message: `Could not read presentation/runs: ${error instanceof Error ? error.message : String(error)}`, path: 'presentation/runs' })
  }

  if (comic.stages.presentation.requirement !== 'not-requested' && comic.stages.presentation.status === 'full') {
    for (const targetKey of selectedSoundscapeTargets) {
      if (!discovered.has(targetKey)) fail({ code: 'missing-presentation', message: `Selected soundscape ${targetKey} has no manifest-backed ADR-019 presentation run.`, targetKey })
    }
    if (presentation.selectedPresentationId) {
      const selectedRunPath = presentation.runRef?.path
      if (!selectedRunPath || !selectedRunPath.includes(presentation.selectedPresentationId)) {
        fail({ code: 'missing-binding', message: `selectedPresentationId ${presentation.selectedPresentationId} is not bound by presentation.runRef.`, path: selectedRunPath })
      }
    }
  }

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
