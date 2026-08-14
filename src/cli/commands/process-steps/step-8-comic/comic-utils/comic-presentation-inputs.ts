import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, posix, resolve } from 'node:path'
import * as v from 'valibot'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type {
  AudioRun,
  ComicPresentationAmbienceInput,
  ComicPresentationPanelInput,
  FinalTimeline,
  ObservedAudioFormat,
  ResolvedSoundscapeTimeline,
  ScenePromptData,
  SoundEffectRenderResult,
  SoundscapeAudioRun,
  SoundscapePlan,
  StructuredScriptData,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTargetKey, hashCanonicalTtsValue, sha256Bytes } from '../../step-4-tts/script-to-audio/contract-identity'
import { readContainedArtifactFile, writeImmutableArtifactFile } from '../../step-4-tts/script-to-audio/safe-artifact-store'
import { inspectSoundscapeAudio } from '../../step-4-tts/soundscape/soundscape-audio'
import { validateSoundscapePlan } from '../../step-4-tts/soundscape/soundscape-planner'
import { ScenePromptDataSchema } from '../schemas/schemas'
import { validateComicDialoguePlan } from './comic-audio-contracts'
import type { PresentationSoundSource } from './comic-presentation-plan'
import type { CompatibleComicSceneRun } from './compatible-scene-run'
import { validateSceneSourceSegmentCoverage } from './source-coverage-utils'

type ArtifactRef = { path: string, sha256: string }

export type PresentationVisualInputs = {
  scene: ScenePromptData
  sceneRef: ArtifactRef
  panels: ComicPresentationPanelInput[]
  sourceDir: string
  imported: boolean
}

export type LoadedPresentationAudio = {
  kind: 'dialogue' | 'soundscape'
  targetKey: string
  provider: string
  model: string
  dialogueBinding: NonNullable<CompatibleComicSceneRun['comicMetadata']['audio']['selectedAudioRuns']>[number]
  dialogueAudioRun: AudioRun
  dialogueTimeline: FinalTimeline
  dialogueAudio: { path: string, sha256: string, format: ObservedAudioFormat, durationMs: number }
  soundscapeBinding?: NonNullable<CompatibleComicSceneRun['comicMetadata']['audio']['selectedSoundscapeRuns']>[number] | undefined
  soundscapeAudioRun?: SoundscapeAudioRun | undefined
  soundscapePlan?: SoundscapePlan | undefined
  soundscapeTimeline?: ResolvedSoundscapeTimeline | undefined
  renderResult?: SoundEffectRenderResult | undefined
  sounds: PresentationSoundSource[]
  ambience: ComicPresentationAmbienceInput[]
}

const verifiedJson = async <T>(rootDir: string, ref: ArtifactRef, label: string): Promise<T> => {
  const stored = await readContainedArtifactFile(rootDir, ref.path)
  if (stored.sha256 !== ref.sha256) throw CLIUsageError(`${label} checksum is stale: ${ref.path}`)
  try { return JSON.parse(stored.bytes.toString('utf8')) as T }
  catch { throw CLIUsageError(`${label} is not valid JSON: ${ref.path}`) }
}

const runRelativeRef = (audioRunRef: string, ref: ArtifactRef): ArtifactRef => ({
  path: posix.join(posix.dirname(audioRunRef), ref.path),
  sha256: ref.sha256,
})

const assertIdentity = <T extends Record<string, unknown>>(value: T, field: keyof T, label: string): void => {
  const identity = value[field]
  const base = { ...value }
  delete base[field]
  if (typeof identity !== 'string' || identity !== hashCanonicalTtsValue(base)) throw CLIUsageError(`${label} has invalid content identity.`)
}

const targetDescription = (compatible: CompatibleComicSceneRun, targetKey: string): { provider: string, model: string } => {
  const state = compatible.manifest.items[0]?.providers.find(provider => provider.operation === 'comic-audio' && provider.targetKey === targetKey)
  if (state?.model) return { provider: state.service, model: state.model }
  if (targetKey === canonicalTargetKey('comic-audio', 'local', 'silence-v1', 'local-process')) return { provider: 'local', model: 'silence-v1' }
  return { provider: 'unknown', model: targetKey }
}

const parseAudioTarget = (value: string | undefined): { provider: string, model: string } | undefined => {
  if (value === undefined) return undefined
  const separator = value.indexOf('=')
  if (separator <= 0 || separator !== value.lastIndexOf('=') || !value.slice(0, separator).trim() || !value.slice(separator + 1).trim()) throw CLIUsageError('--audio-target must use provider=model.')
  return { provider: value.slice(0, separator).trim(), model: value.slice(separator + 1).trim() }
}

const bindingMatchesTarget = (compatible: CompatibleComicSceneRun, targetKey: string, requested: { provider: string, model: string }): boolean => {
  const actual = targetDescription(compatible, targetKey)
  return actual.provider === requested.provider && actual.model === requested.model
}

export const selectPresentationAudioBinding = (compatible: CompatibleComicSceneRun, selector: string | undefined): {
  kind: 'dialogue' | 'soundscape'
  dialogue: NonNullable<CompatibleComicSceneRun['comicMetadata']['audio']['selectedAudioRuns']>[number]
  soundscape?: NonNullable<CompatibleComicSceneRun['comicMetadata']['audio']['selectedSoundscapeRuns']>[number] | undefined
} => {
  const dialogue = compatible.comicMetadata.audio.selectedAudioRuns ?? []
  const soundscape = compatible.comicMetadata.audio.selectedSoundscapeRuns ?? []
  const duplicate = (values: readonly { targetKey: string }[]) => values.find((entry, index) => values.findIndex(candidate => candidate.targetKey === entry.targetKey) !== index)
  if (duplicate(dialogue) || duplicate(soundscape)) throw CLIUsageError('Canonical comic audio metadata contains duplicate selected target bindings.')
  const requested = parseAudioTarget(selector)
  if (requested) {
    const soundMatches = soundscape.filter(binding => bindingMatchesTarget(compatible, binding.targetKey, requested))
    const dialogueMatches = dialogue.filter(binding => bindingMatchesTarget(compatible, binding.targetKey, requested))
    if (soundMatches.length > 1 || dialogueMatches.length > 1) throw CLIUsageError(`--audio-target ${requested.provider}=${requested.model} is ambiguous in canonical selected audio metadata.`)
    const selectedSoundscape = soundMatches[0]
    if (selectedSoundscape) {
      const selectedDialogue = dialogue.find(binding => binding.audioRunId === selectedSoundscape.dialogueAudioRunId && binding.targetKey === selectedSoundscape.targetKey)
      if (!selectedDialogue) throw CLIUsageError(`Selected soundscape target ${requested.provider}=${requested.model} has no exact canonical dialogue AudioRun binding.`)
      return { kind: 'soundscape', dialogue: selectedDialogue, soundscape: selectedSoundscape }
    }
    const selectedDialogue = dialogueMatches[0]
    if (selectedDialogue) return { kind: 'dialogue', dialogue: selectedDialogue }
    throw CLIUsageError(`--audio-target ${requested.provider}=${requested.model} does not name a complete selected comic dialogue or soundscape run.`)
  }
  if (soundscape.length === 1) {
    const selectedSoundscape = soundscape[0] as NonNullable<typeof soundscape[number]>
    const selectedDialogue = dialogue.find(binding => binding.audioRunId === selectedSoundscape.dialogueAudioRunId && binding.targetKey === selectedSoundscape.targetKey)
    if (!selectedDialogue) throw CLIUsageError('The sole selected soundscape run has no exact canonical dialogue AudioRun binding.')
    return { kind: 'soundscape', dialogue: selectedDialogue, soundscape: selectedSoundscape }
  }
  if (soundscape.length > 1) throw CLIUsageError(`Comic slideshow audio selection is ambiguous across ${soundscape.length} complete soundscape runs; pass --audio-target provider=model.`)
  if (dialogue.length === 1) return { kind: 'dialogue', dialogue: dialogue[0] as NonNullable<typeof dialogue[number]> }
  if (dialogue.length > 1) throw CLIUsageError(`Comic slideshow audio selection is ambiguous across ${dialogue.length} complete dialogue runs; pass --audio-target provider=model.`)
  throw CLIUsageError('Comic slideshow requires a complete selected dialogue or soundscape AudioRun with its canonical timeline; raw audio files are unsupported.')
}

const loadDialogueAudio = async (compatible: CompatibleComicSceneRun, binding: ReturnType<typeof selectPresentationAudioBinding>['dialogue']): Promise<{
  run: AudioRun
  timeline: FinalTimeline
  audio: LoadedPresentationAudio['dialogueAudio']
}> => {
  const run = await verifiedJson<AudioRun>(compatible.sceneRunDir, { path: binding.audioRunRef, sha256: binding.audioRunSha256 }, `Dialogue AudioRun ${binding.audioRunId}`)
  assertIdentity(run as unknown as Record<string, unknown>, 'audioRunId', 'Dialogue AudioRun')
  if (run.audioRunId !== binding.audioRunId || run.targetKey !== binding.targetKey) throw CLIUsageError('Selected dialogue AudioRun does not match its canonical target binding.')
  const timelineRef = runRelativeRef(binding.audioRunRef, run.finalTimeline)
  const timeline = await verifiedJson<FinalTimeline>(compatible.sceneRunDir, timelineRef, `Dialogue timeline ${run.finalTimeline.timelineId}`)
  assertIdentity(timeline as unknown as Record<string, unknown>, 'timelineId', 'Dialogue FinalTimeline')
  if (timeline.timelineId !== run.finalTimeline.timelineId || timeline.renderIdentity !== run.renderIdentity) throw CLIUsageError('Dialogue FinalTimeline does not bind the selected AudioRun.')
  if (timeline.timing.availability !== 'timed') throw CLIUsageError(`Selected dialogue AudioRun has no canonical timed FinalTimeline: ${timeline.timing.reason}`)
  const output = run.finalOutputs[0]
  if (!output || run.finalOutputs.length !== 1) throw CLIUsageError('Selected dialogue AudioRun must contain exactly one canonical final audio output.')
  const audioRef = runRelativeRef(binding.audioRunRef, output)
  const stored = await readContainedArtifactFile(compatible.sceneRunDir, audioRef.path)
  if (stored.sha256 !== output.sha256) throw CLIUsageError(`Dialogue final audio checksum is stale: ${audioRef.path}`)
  const observed = await inspectSoundscapeAudio(stored.path)
  if (observed.durationMs !== output.durationMs || observed.format.sampleRate !== output.format.sampleRate || observed.format.channels !== output.format.channels) throw CLIUsageError('Dialogue final audio format or duration no longer matches its AudioRun evidence.')
  return { run, timeline, audio: { path: audioRef.path, sha256: audioRef.sha256, format: output.format, durationMs: output.durationMs } }
}

export const loadPresentationAudio = async (compatible: CompatibleComicSceneRun, selector?: string | undefined): Promise<LoadedPresentationAudio> => {
  const selection = selectPresentationAudioBinding(compatible, selector)
  const loadedDialogue = await loadDialogueAudio(compatible, selection.dialogue)
  const target = targetDescription(compatible, selection.dialogue.targetKey)
  if (selection.kind === 'dialogue') return {
    kind: 'dialogue', targetKey: selection.dialogue.targetKey, ...target,
    dialogueBinding: selection.dialogue, dialogueAudioRun: loadedDialogue.run, dialogueTimeline: loadedDialogue.timeline, dialogueAudio: loadedDialogue.audio,
    sounds: [], ambience: [],
  }

  const binding = selection.soundscape as NonNullable<typeof selection.soundscape>
  const soundscapeRun = await verifiedJson<SoundscapeAudioRun>(compatible.sceneRunDir, { path: binding.audioRunRef, sha256: binding.audioRunSha256 }, `Soundscape AudioRun ${binding.soundscapeAudioRunId}`)
  assertIdentity(soundscapeRun as unknown as Record<string, unknown>, 'audioRunId', 'Soundscape AudioRun')
  if (soundscapeRun.audioRunId !== binding.soundscapeAudioRunId || soundscapeRun.dialogueAudioRun.audioRunId !== loadedDialogue.run.audioRunId || soundscapeRun.dialogueAudioRun.sha256 !== selection.dialogue.audioRunSha256) throw CLIUsageError('Selected soundscape AudioRun does not bind the exact selected dialogue AudioRun.')
  const plan = validateSoundscapePlan(await verifiedJson<SoundscapePlan>(compatible.sceneRunDir, { path: soundscapeRun.soundscapePlan.path, sha256: soundscapeRun.soundscapePlan.sha256 }, `SoundscapePlan ${soundscapeRun.soundscapePlan.soundscapePlanId}`), compatible.structuredScript)
  if (plan.soundscapePlanId !== soundscapeRun.soundscapePlan.soundscapePlanId || plan.dialoguePlanId !== compatible.comicMetadata.audio.dialoguePlanId) throw CLIUsageError('Selected SoundscapePlan does not bind the canonical dialogue plan.')
  const soundscapeTimeline = await verifiedJson<ResolvedSoundscapeTimeline>(compatible.sceneRunDir, soundscapeRun.resolvedTimeline, `Resolved soundscape timeline ${soundscapeRun.resolvedTimeline.timelineId}`)
  assertIdentity(soundscapeTimeline as unknown as Record<string, unknown>, 'timelineId', 'Resolved soundscape timeline')
  if (soundscapeTimeline.timelineId !== soundscapeRun.resolvedTimeline.timelineId || soundscapeTimeline.dialogueAudioRunId !== loadedDialogue.run.audioRunId || soundscapeTimeline.soundscapePlanId !== plan.soundscapePlanId) throw CLIUsageError('Resolved soundscape timeline does not bind the selected source runs.')
  let renderResult: SoundEffectRenderResult | undefined
  if (soundscapeRun.soundEffectRenderResult) {
    renderResult = await verifiedJson<SoundEffectRenderResult>(compatible.sceneRunDir, { path: soundscapeRun.soundEffectRenderResult.path, sha256: soundscapeRun.soundEffectRenderResult.sha256 }, `SoundEffectRenderResult ${soundscapeRun.soundEffectRenderResult.resultId}`)
    assertIdentity(renderResult as unknown as Record<string, unknown>, 'resultId', 'SoundEffectRenderResult')
    if (renderResult.resultId !== soundscapeRun.soundEffectRenderResult.resultId || renderResult.soundscapePlanId !== plan.soundscapePlanId || renderResult.status !== 'succeeded') throw CLIUsageError('Selected sound-effect result is not a complete success for the SoundscapePlan.')
  }
  const resultByCue = new Map(renderResult?.entries.map(entry => [entry.cueId, entry] as const) ?? [])
  const timelineByCue = new Map(soundscapeTimeline.entries.map(entry => [entry.cueId, entry] as const))
  const verifiedAudio = new Map<string, { path: string, sha256: string, durationMs: number }>()
  for (const entry of renderResult?.entries ?? []) {
    if (entry.status !== 'succeeded' || !entry.audio) continue
    const stored = await readContainedArtifactFile(compatible.sceneRunDir, entry.audio.path)
    if (stored.sha256 !== entry.audio.sha256) throw CLIUsageError(`Retained sound source checksum is stale for cue ${entry.cueId}: ${entry.audio.path}`)
    const observed = await inspectSoundscapeAudio(stored.path)
    if (observed.durationMs !== entry.audio.durationMs) throw CLIUsageError(`Retained sound source duration changed for cue ${entry.cueId}.`)
    verifiedAudio.set(entry.cueId, { path: entry.audio.path, sha256: entry.audio.sha256, durationMs: entry.audio.durationMs })
  }
  const sounds: PresentationSoundSource[] = plan.cues.flatMap(cue => {
    const result = resultByCue.get(cue.cueId)
    const timelineEntry = timelineByCue.get(cue.cueId)
    const audio = verifiedAudio.get(cue.cueId)
    if (timelineEntry?.status !== 'placed') {
      if (cue.required) throw CLIUsageError(`Required sound cue ${cue.cueId} is not placed in the selected soundscape timeline.`)
      return []
    }
    if (!result?.audio || !audio || !timelineEntry.finalRangeMs) throw CLIUsageError(`Placed sound cue ${cue.cueId} has no checksum-bound retained source.`)
    return [{ cue, sourceAudio: audio, originalRangeMs: timelineEntry.finalRangeMs }]
  })
  const ambience: ComicPresentationAmbienceInput[] = plan.ambientBeds.flatMap(cue => {
    const timelineEntry = timelineByCue.get(cue.cueId)
    const audio = verifiedAudio.get(cue.cueId)
    if (timelineEntry?.status !== 'placed') {
      if (cue.required) throw CLIUsageError(`Required ambience cue ${cue.cueId} is not placed in the selected soundscape timeline.`)
      return []
    }
    if (!audio) throw CLIUsageError(`Placed ambience cue ${cue.cueId} has no checksum-bound retained source.`)
    return [{ cueId: cue.cueId, prompt: cue.prompt, sourceSpan: cue.sourceSpan, sourceAudio: audio, gainDb: plan.mixProfile.busGainDb.ambience + (cue.gainDb ?? 0), pan: cue.pan ?? plan.mixProfile.defaultPan }]
  })
  return {
    kind: 'soundscape', targetKey: binding.targetKey, ...target,
    dialogueBinding: selection.dialogue, dialogueAudioRun: loadedDialogue.run, dialogueTimeline: loadedDialogue.timeline, dialogueAudio: loadedDialogue.audio,
    soundscapeBinding: binding, soundscapeAudioRun: soundscapeRun, soundscapePlan: plan, soundscapeTimeline, renderResult, sounds, ambience,
  }
}

export const readReviewedPresentationScene = async (sceneRunDir: string): Promise<{ scene: ScenePromptData, ref: ArtifactRef }> => {
  const path = 'metadata/scene.json'
  let bytes: Uint8Array
  try { bytes = new Uint8Array(await readFile(join(sceneRunDir, path))) }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ENOENT') throw CLIUsageError(`Reviewed comic scene is missing: ${join(sceneRunDir, path)}`)
    throw error
  }
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw CLIUsageError('Reviewed comic scene is not valid JSON: metadata/scene.json') }
  return { scene: v.parse(ScenePromptDataSchema, parsed), ref: { path, sha256: sha256Bytes(bytes) } }
}

const pngDimensions = (bytes: Uint8Array, path: string): { width: number, height: number } => {
  const buffer = Buffer.from(bytes)
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a' || buffer.toString('ascii', 12, 16) !== 'IHDR') throw CLIUsageError(`Canonical panel is not a valid PNG with an IHDR header: ${path}`)
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (width <= 0 || height <= 0) throw CLIUsageError(`Canonical panel has invalid dimensions: ${path}`)
  return { width, height }
}

export const loadCanonicalPresentationPanels = async (sceneRunDir: string, scene: ScenePromptData): Promise<ComicPresentationPanelInput[]> => {
  const panelNumbers = scene.panels.map(panel => panel.number)
  if (new Set(panelNumbers).size !== panelNumbers.length) throw CLIUsageError(`Reviewed scene declares duplicate panel numbers: ${panelNumbers.filter((number, index) => panelNumbers.indexOf(number) !== index).join(', ')}.`)
  panelNumbers.forEach((number, index) => {
    if (number !== index + 1) throw CLIUsageError(`Reviewed scene panels must be ordered consecutively 1..N; found panel ${number} at ordinal ${index + 1}.`)
  })
  const panelRoot = join(sceneRunDir, 'panels')
  const entries = await readdir(panelRoot, { withFileTypes: true }).catch(() => [])
  const declared = new Set(panelNumbers)
  const aliases = entries.filter(entry => entry.isFile()).flatMap(entry => {
    const match = /^panel-(\d+)\.png$/u.exec(entry.name)
    return match?.[1] && declared.has(Number(match[1])) ? [{ name: entry.name, panelNumber: Number(match[1]) }] : []
  })
  const duplicates = [...new Set(aliases.flatMap(alias => aliases.filter(candidate => candidate.panelNumber === alias.panelNumber).length > 1 ? [alias.panelNumber] : []))]
  if (duplicates.length > 0) throw CLIUsageError(`Canonical panel directory contains duplicate numeric PNG identities for panel(s): ${duplicates.join(', ')}.`)
  const expected = panelNumbers.map(panelNumber => ({ panelNumber, path: `panels/panel-${String(panelNumber).padStart(2, '0')}.png` }))
  const missing = (await Promise.all(expected.map(async panel => await Bun.file(join(sceneRunDir, panel.path)).exists() ? undefined : panel.path))).filter((path): path is string => path !== undefined)
  if (missing.length > 0) throw CLIUsageError(`Missing ${missing.length} canonical panel PNG(s):\n- ${missing.join('\n- ')}`)
  const panels = await Promise.all(expected.map(async panel => {
    const bytes = new Uint8Array(await Bun.file(join(sceneRunDir, panel.path)).arrayBuffer())
    return { ...panel, sha256: sha256Bytes(bytes), ...pngDimensions(bytes, panel.path) }
  }))
  const first = panels[0] as NonNullable<typeof panels[number]>
  const mismatched = panels.filter(panel => panel.width !== first.width || panel.height !== first.height)
  if (mismatched.length > 0) throw CLIUsageError(`Canonical panel dimensions must be identical to ${basename(first.path)} (${first.width}x${first.height}); mismatches: ${mismatched.map(panel => `${basename(panel.path)}=${panel.width}x${panel.height}`).join(', ')}.`)
  if (first.width % 2 !== 0 || first.height % 2 !== 0) throw CLIUsageError(`Canonical panel dimensions ${first.width}x${first.height} cannot be encoded exactly as H.264 yuv420p; both dimensions must be even.`)
  return panels
}

const loadPresentationVisualSource = async (
  sceneRunDir: string,
  structuredScript: StructuredScriptData
): Promise<Omit<PresentationVisualInputs, 'imported'>> => {
  const { scene, ref: sceneRef } = await readReviewedPresentationScene(sceneRunDir)
  validateSceneSourceSegmentCoverage(scene, structuredScript.sourceSegments)
  const panels = await loadCanonicalPresentationPanels(sceneRunDir, scene)
  return { scene, sceneRef, panels, sourceDir: sceneRunDir }
}

/**
 * Resolves reviewed visual inputs without mutating either workspace. Provider-comparison audio
 * directories may intentionally live beside the canonical reviewed scene directory, named with
 * the exact script slug. Content coverage, dialogue reconciliation at the caller, and panel bytes
 * remain the authority; the sibling directory name is only a deterministic candidate location.
 */
export const resolvePresentationVisualInputs = async (
  compatible: CompatibleComicSceneRun
): Promise<Omit<PresentationVisualInputs, 'imported'>> => {
  const current = resolve(compatible.sceneRunDir)
  const sibling = resolve(dirname(current), sanitizeTitleSlug(compatible.sourceIdentity.scriptSlug))
  const candidates = current === sibling ? [current] : [current, sibling]
  const rejected: string[] = []
  for (const candidate of candidates) {
    try { return await loadPresentationVisualSource(candidate, compatible.structuredScript) }
    catch (error) { rejected.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  throw CLIUsageError(
    `Comic slideshow visual preflight failed before provider dispatch; no exact compatible reviewed scene and complete canonical panel set was found for ${compatible.sourceIdentity.canonicalPath}.`,
    `Checked: ${rejected.join('; ')}`
  )
}

/**
 * Imports external reviewed visuals into an immutable presentation-owned bundle so every path in
 * the presentation plan remains contained by, and portable with, the audio run directory.
 */
export const preparePresentationVisualInputs = async (
  compatible: CompatibleComicSceneRun,
  resolvedInputs?: Omit<PresentationVisualInputs, 'imported'>
): Promise<PresentationVisualInputs> => {
  const loaded = resolvedInputs ?? await resolvePresentationVisualInputs(compatible)
  if (resolve(loaded.sourceDir) === resolve(compatible.sceneRunDir)) return { ...loaded, imported: false }
  const bundleId = hashCanonicalTtsValue({
    schemaVersion: 1,
    reviewedSceneSha256: loaded.sceneRef.sha256,
    panels: loaded.panels.map(panel => ({ panelNumber: panel.panelNumber, sha256: panel.sha256, width: panel.width, height: panel.height })),
  })
  const bundleRoot = `presentation/inputs/${bundleId}`
  const sceneBytes = new Uint8Array(await readFile(join(loaded.sourceDir, loaded.sceneRef.path)))
  const writtenScene = await writeImmutableArtifactFile(compatible.sceneRunDir, `${bundleRoot}/reviewed-scene.json`, sceneBytes)
  if (writtenScene.sha256 !== loaded.sceneRef.sha256) throw CLIUsageError('Reviewed comic scene changed while its immutable presentation input bundle was being imported.')
  const panels = await Promise.all(loaded.panels.map(async panel => {
    const bytes = new Uint8Array(await readFile(join(loaded.sourceDir, panel.path)))
    const written = await writeImmutableArtifactFile(
      compatible.sceneRunDir,
      `${bundleRoot}/panels/panel-${String(panel.panelNumber).padStart(2, '0')}.png`,
      bytes
    )
    if (written.sha256 !== panel.sha256) throw CLIUsageError(`Canonical panel ${panel.panelNumber} changed while its immutable presentation input bundle was being imported.`)
    return { ...panel, path: written.relativePath, sha256: written.sha256 }
  }))
  return {
    scene: loaded.scene,
    sceneRef: { path: writtenScene.relativePath, sha256: writtenScene.sha256 },
    panels,
    sourceDir: loaded.sourceDir,
    imported: true,
  }
}

export const loadPresentationDialoguePlan = async (compatible: CompatibleComicSceneRun) => {
  const ref = compatible.comicMetadata.audio.dialoguePlanRef
  const id = compatible.comicMetadata.audio.dialoguePlanId
  if (!ref || !id) throw CLIUsageError('Comic slideshow requires the canonical ComicDialoguePlan used by the selected AudioRun.')
  const plan = validateComicDialoguePlan(await verifiedJson(compatible.sceneRunDir, ref, `ComicDialoguePlan ${id}`))
  if (plan.dialoguePlanId !== id || plan.sceneRunIdentity !== compatible.comicMetadata.audio.sceneRunIdentity) throw CLIUsageError('Canonical ComicDialoguePlan does not bind the compatible scene run.')
  return { plan, ref }
}
