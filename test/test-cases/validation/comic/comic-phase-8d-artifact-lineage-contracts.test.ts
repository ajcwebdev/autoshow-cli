import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CharacterCatalogService, ComicPresentationPlan, ComicPresentationRun, ResolvedPanelTimeline } from '~/types'
import type { LocationReferenceCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { auditComicSceneArtifactLineage, soundscapeAudioRunLineageRefs } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-artifact-lineage-audit'
import { createStructuredScriptArtifactRef, computeSceneRunIdentity } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { updateComicAudioManifest, updateComicPresentationManifest, writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { createLocalSilentDialogueRun, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { writeImmutableArtifactFile } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/safe-artifact-store'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'

const characters = {
  characterKeys: [], resolve: () => undefined, detectMentions: () => [],
} as unknown as CharacterCatalogService

const locations: LocationReferenceCatalog = {
  schemaVersion: 1,
  styleImage: 'style.png',
  locations: [{ key: 'hangar', name: 'Hangar', aliases: [], specification: 'Hangar.', sourceScripts: [] }],
}

const HASH = 'a'.repeat(64)

const writePresentation = async (input: {
  root: string
  targetKey: string
  provider: string
  model: string
  sceneRunIdentity: string
  structuredRef: { path: string, sha256: string }
  dialoguePlanId: string
  dialoguePlanRef: { path: string, sha256: string }
  dialogue: { audioRunId: string, audioRunRef: string, audioRunSha256: string, timelineRef: { path: string, sha256: string }, audioRef: { path: string, sha256: string } }
  soundscape: { audioRunId: string, audioRunRef: string, audioRunSha256: string }
}): Promise<{ presentationId: string, refs: Array<{ path: string, sha256: string }>, finalOutputRefs: Array<{ path: string, sha256: string }> }> => {
  const panel = await writeImmutableArtifactFile(input.root, 'presentation/inputs/panel-01.png', new Uint8Array([137, 80, 78, 71]))
  const scene = await writeImmutableArtifactFile(input.root, 'presentation/inputs/scene.json', `${canonicalTtsJson({ schemaVersion: 4, title: 'Hangar' })}\n`)
  const wav = await writeImmutableArtifactFile(input.root, `presentation/runs/pending/presentation.wav`, createSyntheticWavBytes({ durationSeconds: 0.2, amplitude: 0.1, frequencyHz: 220 }))
  const mp4 = await writeImmutableArtifactFile(input.root, `presentation/runs/pending/slideshow.mp4`, new Uint8Array([0, 0, 0, 32]))
  const planBase: Omit<ComicPresentationPlan, 'presentationId'> = {
    schemaVersion: 1,
    sceneRunIdentity: input.sceneRunIdentity,
    sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/soundscape-only.md', scriptSlug: 'soundscape-only', contentSha256: HASH, identityHash: HASH },
    createdAt: '2026-08-13T00:00:00.000Z',
    options: { untimedPanelMs: 2000, fps: 30 },
    inputs: {
      reviewedScene: { path: scene.relativePath, sha256: scene.sha256 },
      structuredScript: input.structuredRef,
      dialoguePlan: { ...input.dialoguePlanRef, dialoguePlanId: input.dialoguePlanId },
      audioTarget: { kind: 'soundscape', targetKey: input.targetKey, provider: input.provider, model: input.model },
      dialogueAudioRun: { path: input.dialogue.audioRunRef, sha256: input.dialogue.audioRunSha256, audioRunId: input.dialogue.audioRunId },
      dialogueTimeline: { ...input.dialogue.timelineRef, timelineId: HASH },
      dialogueAudio: { ...input.dialogue.audioRef, format: { codec: 'pcm_s24le', container: 'wav', sampleRate: 48000, channels: 2 }, durationMs: 1 },
      soundscapeAudioRun: { path: input.soundscape.audioRunRef, sha256: input.soundscape.audioRunSha256, audioRunId: input.soundscape.audioRunId },
      panels: [{ panelNumber: 1, path: panel.relativePath, sha256: panel.sha256, width: 64, height: 64 }],
    },
    dialogueBindings: [],
    soundBindings: [],
    ambience: [],
  }
  const plan: ComicPresentationPlan = { ...planBase, presentationId: hashCanonicalTtsValue(planBase) }
  const timelineBase: Omit<ResolvedPanelTimeline, 'timelineId'> = {
    schemaVersion: 1,
    presentationId: plan.presentationId,
    durationMs: 2000,
    panels: [{ panelNumber: 1, image: plan.inputs.panels[0]!, startMs: 0, endMs: 2000, durationMs: 2000, timing: 'untimed-hold', eventIds: [] }],
    events: [],
  }
  const timeline: ResolvedPanelTimeline = { ...timelineBase, timelineId: hashCanonicalTtsValue(timelineBase) }
  const planWritten = await writeImmutableArtifactFile(input.root, `presentation/runs/${plan.presentationId}/comic-presentation-plan.json`, `${canonicalTtsJson(plan)}\n`)
  const timelineWritten = await writeImmutableArtifactFile(input.root, `presentation/runs/${plan.presentationId}/resolved-panel-timeline.json`, `${canonicalTtsJson(timeline)}\n`)
  const publishedWav = await writeImmutableArtifactFile(input.root, `presentation/runs/${plan.presentationId}/presentation.wav`, new Uint8Array(await Bun.file(join(input.root, wav.relativePath)).arrayBuffer()))
  const publishedMp4 = await writeImmutableArtifactFile(input.root, `presentation/runs/${plan.presentationId}/slideshow.mp4`, new Uint8Array(await Bun.file(join(input.root, mp4.relativePath)).arrayBuffer()))
  const runBase: Omit<ComicPresentationRun, 'presentationRunId'> = {
    schemaVersion: 1,
    presentationId: plan.presentationId,
    plan: { path: planWritten.relativePath, sha256: planWritten.sha256 },
    resolvedTimeline: { path: timelineWritten.relativePath, sha256: timelineWritten.sha256, timelineId: timeline.timelineId },
    audioTransforms: [],
    encoderProfile: { schemaVersion: 1, videoCodec: 'h264', videoEncoder: 'libx264', pixelFormat: 'yuv420p', fps: 30, stillImageTuning: 'libx264-stillimage', audioCodec: 'aac', audioBitrate: '192k', fastStart: true, transitions: 'hard-cuts', width: 64, height: 64 },
    commands: [],
    outputs: {
      wav: { path: publishedWav.relativePath, sha256: publishedWav.sha256, format: { codec: 'pcm_s24le', container: 'wav', sampleRate: 48000, channels: 2 }, durationMs: 2000 },
      mp4: { path: publishedMp4.relativePath, sha256: publishedMp4.sha256, durationMs: 2000 },
    },
    createdAt: '2026-08-13T00:00:00.000Z',
  }
  const run: ComicPresentationRun = { ...runBase, presentationRunId: hashCanonicalTtsValue(runBase) }
  const runWritten = await writeImmutableArtifactFile(input.root, `presentation/runs/${plan.presentationId}/comic-presentation-run.json`, `${canonicalTtsJson(run)}\n`)
  const finalOutputRefs = [
    { path: 'presentation/final/slideshow.wav', sha256: publishedWav.sha256 },
    { path: 'presentation/final/slideshow.mp4', sha256: publishedMp4.sha256 },
  ]
  return {
    presentationId: plan.presentationId,
    refs: [planWritten, timelineWritten, runWritten, publishedWav, publishedMp4].map(ref => ({ path: ref.relativePath, sha256: ref.sha256 })),
    finalOutputRefs,
  }
}

const buildSoundscapeScene = async (root: string) => {
  const unique = randomUUID()
  const source = ['# Episode', '', '## Scene: "Hangar"', '', '**INT. HANGAR**', '', '**AMBIENCE:**', '', `OPTIONAL ventilation ${unique}`, '', '**SFX:**', '', `airlock closes ${unique}`].join('\n')
  const provisional = parseScriptMarkdownToStructuredData(source, 'input/soundscape-only.md', { characterCatalog: characters, locationCatalog: locations })
  const structured = parseScriptMarkdownToStructuredData(source, 'input/soundscape-only.md', { sourceIdentity: provisional.sourceIdentity, characterCatalog: characters, locationCatalog: locations })
  const structuredRef = createStructuredScriptArtifactRef(`${JSON.stringify(structured)}\n`)
  await mkdir(join(root, 'metadata'), { recursive: true })
  await Bun.write(join(root, structuredRef.path), `${JSON.stringify(structured)}\n`)
  const sceneRunIdentity = computeSceneRunIdentity(structured.sourceIdentity, structuredRef)
  const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity: structured.sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z' })
  const dialogueRef = await writeImmutableArtifactFile(root, `metadata/dialogue-plans/${dialoguePlan.dialoguePlanId}.json`, `${canonicalTtsJson(dialoguePlan)}\n`)
  const soundscapePlan = createSoundscapePlan({ structuredScript: structured, structuredScriptRef: structuredRef, dialoguePlan, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z' })
  const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2') })
  const firstDialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'fixture-a', model: 'dialogue-a', transport: 'local-process' } })
  const secondDialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'fixture-b', model: 'dialogue-b', transport: 'local-process' } })
  await mkdir(join(root, 'audio', 'final'), { recursive: true })
  let calls = 0
  const adapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => {
    calls++
    return { status: 200, headers: { 'content-type': 'audio/wav', 'request-id': `fixture-${calls}` }, body: createSyntheticWavBytes({ durationSeconds: 0.5, amplitude: 0.2, frequencyHz: 220 + calls * 110 }) }
  }, now: () => '2026-08-13T00:00:00.000Z' })
  const first = await runComicSoundscape({ rootDir: root, plan: soundscapePlan, renderPlan, dialoguePlan, dialogueRuns: [firstDialogue.binding, secondDialogue.binding], adapter, concurrency: 2, hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: 'immediate' }) })
  const selectedSoundscapeRuns = first.soundscapeRuns.map(run => ({ targetKey: run.binding.targetKey, dialogueAudioRunId: run.binding.audioRunId, soundscapeAudioRunId: run.audioRun.audioRunId, audioRunRef: run.ref.path, audioRunSha256: run.ref.sha256, masterRef: { path: run.audioRun.master.path, sha256: run.audioRun.master.sha256 } }))
  const artifactRefs = [structuredRef, { path: dialogueRef.relativePath, sha256: dialogueRef.sha256 }, first.planRef, first.renderPlanRef, first.renderResultRef, ...firstDialogue.refs, ...secondDialogue.refs, ...first.soundscapeRuns.flatMap(run => [run.ref, ...soundscapeAudioRunLineageRefs(run.audioRun)])].map(ref => ({ path: ref.path, sha256: ref.sha256 }))
  await writeInitialComicStructureManifest({ sceneRunDir: root, createdAt: soundscapePlan.createdAt, sourceIdentity: structured.sourceIdentity, structuredScript: structuredRef })
  await updateComicAudioManifest({
    sceneRunDir: root, sourceIdentity: structured.sourceIdentity,
    stage: { requirement: 'required', status: 'full', execution: { kind: 'provider-targets' }, targetKeys: [renderPlan.target.targetKey], artifactRefs },
    audio: {
      sceneRunIdentity, structuredScript: structuredRef, dialoguePlanId: dialoguePlan.dialoguePlanId, dialoguePlanRef: { path: dialogueRef.relativePath, sha256: dialogueRef.sha256 },
      soundscapePlanId: soundscapePlan.soundscapePlanId, soundscapePlanRef: first.planRef, soundEffectRenderPlanRef: first.renderPlanRef, soundEffectRenderResultRef: first.renderResultRef,
      selectedAudioRuns: [firstDialogue.binding, secondDialogue.binding].map(binding => ({ targetKey: binding.targetKey, renderIdentity: binding.renderIdentity, audioRunId: binding.audioRunId, audioRunRef: binding.audioRunRef, audioRunSha256: binding.audioRunSha256 })),
      selectedSoundscapeRuns, publishedAudioRunId: selectedSoundscapeRuns[0]?.soundscapeAudioRunId,
      finalOutputRefs: first.soundscapeRuns.map(run => ({ path: run.binding.reportedOutputPath, sha256: run.audioRun.master.sha256 })),
    },
    providers: [first.providerState],
  })
  const dialogueMedia = (binding: typeof firstDialogue) => ({
    audioRunId: binding.binding.audioRunId,
    audioRunRef: binding.binding.audioRunRef,
    audioRunSha256: binding.binding.audioRunSha256,
    timelineRef: binding.refs.find(ref => ref.path.endsWith('final-timeline.json')) as { path: string, sha256: string },
    audioRef: binding.refs.find(ref => ref.path.endsWith('final.wav')) as { path: string, sha256: string },
  })
  return { structured, structuredRef, sceneRunIdentity, dialoguePlan, dialogueRef, firstDialogue, secondDialogue, first, selectedSoundscapeRuns, firstDialogueMedia: dialogueMedia(firstDialogue), secondDialogueMedia: dialogueMedia(secondDialogue) }
}

describe('ADR-018 Phase 8D artifact lineage audit', () => {
  test('passes a two-target soundscape matrix and fails stale or missing presentation lineage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-phase-8d-lineage-'))
    try {
      const built = await buildSoundscapeScene(root)
      const audioOnly = await auditComicSceneArtifactLineage(root)
      expect(audioOnly.status).toBe('passed')
      expect(audioOnly.selectedSoundscapeTargets).toHaveLength(2)
      expect(audioOnly.errors).toEqual([])

      const presentations = []
      for (const [index, run] of built.first.soundscapeRuns.entries()) {
        const dialogue = index === 0 ? built.firstDialogueMedia : built.secondDialogueMedia
        presentations.push(await writePresentation({
          root,
          targetKey: run.binding.targetKey,
          provider: index === 0 ? 'fixture-a' : 'fixture-b',
          model: index === 0 ? 'dialogue-a' : 'dialogue-b',
          sceneRunIdentity: built.sceneRunIdentity,
          structuredRef: built.structuredRef,
          dialoguePlanId: built.dialoguePlan.dialoguePlanId,
          dialoguePlanRef: { path: built.dialogueRef.relativePath, sha256: built.dialogueRef.sha256 },
          dialogue,
          soundscape: { audioRunId: run.audioRun.audioRunId, audioRunRef: run.ref.path, audioRunSha256: run.ref.sha256 },
        }))
      }
      const selected = presentations[1]!
      await Bun.write(join(root, selected.finalOutputRefs[0]!.path), new Uint8Array(await Bun.file(join(root, selected.refs[3]!.path)).arrayBuffer()))
      await Bun.write(join(root, selected.finalOutputRefs[1]!.path), new Uint8Array(await Bun.file(join(root, selected.refs[4]!.path)).arrayBuffer()))
      await updateComicPresentationManifest({
        sceneRunDir: root,
        sourceIdentity: built.structured.sourceIdentity,
        stage: { requirement: 'optional', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs: [...presentations[0]!.refs, ...selected.refs, ...selected.finalOutputRefs] },
        presentation: {
          selectedPresentationId: selected.presentationId,
          planRef: selected.refs[0],
          resolvedTimelineRef: selected.refs[1],
          runRef: selected.refs[2],
          finalOutputRefs: selected.finalOutputRefs,
        },
      })
      const complete = await auditComicSceneArtifactLineage(root)
      expect(complete.status).toBe('passed')
      expect(complete.presentationTargets).toHaveLength(2)
      expect(complete.verifiedRefCount).toBeGreaterThan(20)
      expect(complete.errors).toEqual([])

      await Bun.write(join(root, built.selectedSoundscapeRuns[0]!.masterRef.path), new Uint8Array([1, 2, 3, 4]))
      const stale = await auditComicSceneArtifactLineage(root)
      expect(stale.status).toBe('failed')
      expect(stale.errors.some(error => error.code === 'checksum-mismatch' && error.path === built.selectedSoundscapeRuns[0]?.masterRef.path)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('requires a presentation run for every selected soundscape when presentation is published', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-phase-8d-missing-presentation-'))
    try {
      const built = await buildSoundscapeScene(root)
      const onlyFirst = built.first.soundscapeRuns[0]!
      const written = await writePresentation({
        root,
        targetKey: onlyFirst.binding.targetKey,
        provider: 'fixture-a',
        model: 'dialogue-a',
        sceneRunIdentity: built.sceneRunIdentity,
        structuredRef: built.structuredRef,
        dialoguePlanId: built.dialoguePlan.dialoguePlanId,
        dialoguePlanRef: { path: built.dialogueRef.relativePath, sha256: built.dialogueRef.sha256 },
        dialogue: built.firstDialogueMedia,
        soundscape: { audioRunId: onlyFirst.audioRun.audioRunId, audioRunRef: onlyFirst.ref.path, audioRunSha256: onlyFirst.ref.sha256 },
      })
      await Bun.write(join(root, written.finalOutputRefs[0]!.path), new Uint8Array(await Bun.file(join(root, written.refs[3]!.path)).arrayBuffer()))
      await Bun.write(join(root, written.finalOutputRefs[1]!.path), new Uint8Array(await Bun.file(join(root, written.refs[4]!.path)).arrayBuffer()))
      await updateComicPresentationManifest({
        sceneRunDir: root,
        sourceIdentity: built.structured.sourceIdentity,
        stage: { requirement: 'optional', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs: [...written.refs, ...written.finalOutputRefs] },
        presentation: {
          selectedPresentationId: written.presentationId,
          planRef: written.refs[0],
          resolvedTimelineRef: written.refs[1],
          runRef: written.refs[2],
          finalOutputRefs: written.finalOutputRefs,
        },
      })
      const audit = await auditComicSceneArtifactLineage(root)
      expect(audit.status).toBe('failed')
      expect(audit.errors.some(error => error.code === 'missing-presentation' && error.targetKey === built.secondDialogue.binding.targetKey)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
