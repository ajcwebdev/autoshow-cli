import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { CanonicalComicItemMetadata, CanonicalDialogueTurn, CharacterCatalogService, ComicDialoguePlan, ComicPresentationPanelInput, PipelineManifest, ScenePromptData, SoundscapePlan, StructuredScriptData } from '~/types'
import {
  reconcilePresentationDialogue,
  reconcilePresentationSoundEffects,
  resolveComicPanelTimeline,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-plan'
import { assertPresentationSoundEffectResult, loadCanonicalPresentationPanels, loadPresentationAudio, preparePresentationVisualInputs, resolvePresentationVisualInputs, selectPresentationAudioBinding } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-presentation-inputs'
import type { CompatibleComicSceneRun } from '~/cli/commands/process-steps/step-8-comic/comic-utils/compatible-scene-run'
import { createLocalSilentDialogueRun } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { createStructuredScriptArtifactRef } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import type { LocationReferenceCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { updateComicPresentationManifest, writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { canonicalTtsJson } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { writeImmutableArtifactFile } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/safe-artifact-store'

const HASH = 'a'.repeat(64)
const NEXT_HASH = 'b'.repeat(64)

const scene = (panels: ScenePromptData['panels']): ScenePromptData => ({ schemaVersion: 4, title: 'Scene', location: 'Bridge', panels })
const panel = (number: number, sourceSegmentIds: string[], speech: ScenePromptData['panels'][number]['speech'] = []): ScenePromptData['panels'][number] => ({
  number, description: `Panel ${number}`, shotPlan: 'Static shot.', characterKeys: [], speech, sourceSegmentIds, locationKey: 'bridge', designReferences: [],
})
const characterSpeech = (characterKey: string, line: string): ScenePromptData['panels'][number]['speech'][number] => ({ speaker: { kind: 'character', characterKey: characterKey as never, offscreen: true }, line })
const dialoguePlan = (turns: CanonicalDialogueTurn[]): ComicDialoguePlan => ({
  schemaVersion: 2, dialoguePlanId: HASH, sceneRunIdentity: HASH,
  sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/script.md', scriptSlug: 'script', contentSha256: HASH, identityHash: HASH },
  structuredScript: { path: 'metadata/structured-script.json', artifactSchemaVersion: 5, sha256: HASH }, createdAt: '2026-08-13T00:00:00.000Z', pacing: { profile: 'none', interTurnMs: 0 },
  nodes: turns.map(turn => ({ kind: 'turn' as const, turn })),
})

describe('comic presentation reconciliation', () => {
  test('prefers exact source IDs and reconciles legacy panels by exact content ordinal', () => {
    const reviewed = scene([
      panel(1, ['action-1']),
      panel(2, ['dialogue-current'], [characterSpeech('pilot', 'Ready now.')]),
      panel(3, ['legacy-id'], [characterSpeech('pilot', 'Same line.')]),
      panel(4, ['legacy-id-2'], [characterSpeech('pilot', 'Same line.')]),
    ])
    const plan = dialoguePlan([
      { turnId: 'turn-1', sourceSegmentId: 'dialogue-current', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Ready now.' },
      { turnId: 'turn-2', sourceSegmentId: 'old-dialogue-1', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Same line.' },
      { turnId: 'turn-3', sourceSegmentId: 'old-dialogue-2', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Same line.' },
    ])
    const bindings = reconcilePresentationDialogue({ scene: reviewed, dialoguePlan: plan })
    expect(bindings.map(binding => [binding.panelNumber, binding.evidence.kind])).toEqual([
      [2, 'source-segment-id'], [3, 'exact-content-ordinal'], [4, 'exact-content-ordinal'],
    ])
    expect(bindings[2]?.evidence).toMatchObject({ occurrence: 2 })
  })

  test('rejects source/content disagreement and legacy ambiguity without fuzzy matching', () => {
    const exactMismatch = scene([panel(1, ['turn-source'], [characterSpeech('pilot', 'Different words.')])])
    const plan = dialoguePlan([{ turnId: 'turn-1', sourceSegmentId: 'turn-source', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Exact words.' }])
    expect(() => reconcilePresentationDialogue({ scene: exactMismatch, dialoguePlan: plan })).toThrow('no exact speaker-and-text entry matches')

    const ambiguousLegacy = scene([panel(1, ['old'], [characterSpeech('pilot', 'Repeated.'), characterSpeech('pilot', 'Repeated.')])])
    const legacyPlan = dialoguePlan([{ turnId: 'turn-1', sourceSegmentId: 'new', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Repeated.' }])
    expect(() => reconcilePresentationDialogue({ scene: ambiguousLegacy, dialoguePlan: legacyPlan })).toThrow('Legacy dialogue ownership is ambiguous')
  })

  test('elides only exact source-backed parenthetical cues when matching panel speech', () => {
    const reviewed = scene([
      panel(1, ['laugh'], [characterSpeech('pilot', '(jolly laugh) Going now!')]),
      panel(2, ['pause'], [characterSpeech('pilot', 'Hold. (beat, quietly) Go.')]),
    ])
    const plan = dialoguePlan([
      { turnId: 'turn-1', sourceSegmentId: 'laugh', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Going now!', delivery: { kind: 'source', description: 'delighted, jolly laugh' } },
      { turnId: 'turn-2', sourceSegmentId: 'pause', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Hold. Go.', timingCues: [{ kind: 'beat', afterTextOffset: 5, durationMs: 750, sourceSpan: { kind: 'timing', start: 1, end: 16, indexUnit: 'unicode-scalar-value', text: '(beat, quietly)' } }] },
    ])
    const bindings = reconcilePresentationDialogue({ scene: reviewed, dialoguePlan: plan })
    expect(bindings.map(binding => binding.evidence.textMatch)).toEqual(['exact-after-source-cue-elision', 'exact-after-source-cue-elision'])
    const unsupported = scene([panel(1, ['laugh'], [characterSpeech('pilot', '(whispering) Going now!')])])
    expect(() => reconcilePresentationDialogue({ scene: unsupported, dialoguePlan: dialoguePlan([plan.nodes[0]!.kind === 'turn' ? plan.nodes[0]!.turn : plan.nodes[0]!.turns[0]!]) })).toThrow('no exact speaker-and-text entry matches')
  })

  test('binds inline effects to dialogue provenance and block effects to the nearest authored action', () => {
    const reviewed = scene([
      panel(1, ['action-1']),
      panel(2, ['dialogue-1'], [characterSpeech('pilot', 'Go.')]),
      panel(3, ['action-2']),
    ])
    const bindings = reconcilePresentationDialogue({ scene: reviewed, dialoguePlan: dialoguePlan([{ turnId: 'turn-1', sourceSegmentId: 'dialogue-1', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Go.' }]) })
    const structured = {
      sourceSegments: [
        { id: 'action-1', type: 'direction', sourceSpans: [{ start: 0, end: 10 }] },
        { id: 'dialogue-1', type: 'dialogue', sourceSpans: [{ start: 20, end: 30 }] },
        { id: 'action-2', type: 'direction', sourceSpans: [{ start: 40, end: 50 }] },
      ],
    } as unknown as StructuredScriptData
    const sourceAudio = { path: 'audio/effect.wav', sha256: HASH, durationMs: 500 }
    const sounds = reconcilePresentationSoundEffects({
      scene: reviewed, structuredScript: structured, dialogueBindings: bindings,
      sounds: [
        { cue: { cueId: 'inline', kind: 'vocal-reaction', prompt: 'gasp', required: true, anchor: { kind: 'source-text-offset', sourceSegmentId: 'dialogue-1', textOffset: 1, indexUnit: 'unicode-scalar-value', offsetMs: 0 }, sourceSpan: { kind: 'sound-effect', start: 25, end: 26, indexUnit: 'unicode-scalar-value', text: 'x' } }, originalRangeMs: { start: 200, end: 700 }, sourceAudio },
        { cue: { cueId: 'block', kind: 'action-sfx', prompt: 'clang', required: true, anchor: { kind: 'scene-clock', positionMs: 1000 }, sourceSpan: { kind: 'sound-effect', start: 60, end: 65, indexUnit: 'unicode-scalar-value', text: 'clang' } }, originalRangeMs: { start: 1000, end: 1500 }, sourceAudio },
      ],
    })
    expect(sounds.map(binding => [binding.cueId, binding.panelNumber, binding.evidence.kind])).toEqual([
      ['inline', 2, 'inline-source-segment'], ['block', 3, 'preceding-action-segment'],
    ])
  })

  test('collapses tied split action segments only when their panel ownership is identical', () => {
    const sourceAudio = { path: 'audio/effect.wav', sha256: HASH, durationMs: 500 }
    const cue = { cueId: 'block', kind: 'action-sfx' as const, prompt: 'transform', required: true, anchor: { kind: 'scene-clock' as const, positionMs: 1000 }, sourceSpan: { kind: 'sound-effect' as const, start: 60, end: 65, indexUnit: 'unicode-scalar-value' as const, text: 'transform' } }
    const structured = {
      sourceSegments: [
        { id: 'action-01', type: 'direction', sourceSpans: [{ start: 0, end: 50 }] },
        { id: 'action-02', type: 'direction', sourceSpans: [{ start: 0, end: 50 }] },
      ],
    } as unknown as StructuredScriptData
    const sharedOwner = scene([panel(1, ['action-01', 'action-02'])])
    const [binding] = reconcilePresentationSoundEffects({ scene: sharedOwner, structuredScript: structured, dialogueBindings: [], sounds: [{ cue, originalRangeMs: { start: 1000, end: 1500 }, sourceAudio }] })
    expect(binding).toMatchObject({ panelNumber: 1, evidence: { equivalentSourceSegmentIds: ['action-01', 'action-02'] } })

    const splitOwners = scene([panel(1, ['action-01']), panel(2, ['action-02'])])
    expect(() => reconcilePresentationSoundEffects({ scene: splitOwners, structuredScript: structured, dialogueBindings: [], sounds: [{ cue, originalRangeMs: { start: 1000, end: 1500 }, sourceAudio }] })).toThrow('owned by panels 1, 2')
  })
})

describe('comic presentation timing', () => {
  test('adds intro, middle, and outro holds while preserving within-panel overlap and serializing panel order', () => {
    const panels: ComicPresentationPanelInput[] = [1, 2, 3, 4, 5].map(panelNumber => ({ panelNumber, path: `panels/panel-0${panelNumber}.png`, sha256: HASH, width: 64, height: 64 }))
    const dialogueBindings = [
      { turnId: 'turn-a', sourceSegmentId: 'a', panelNumber: 2 },
      { turnId: 'turn-b', sourceSegmentId: 'b', panelNumber: 2 },
      { turnId: 'turn-c', sourceSegmentId: 'c', panelNumber: 4 },
    ].map(binding => ({ ...binding, subjectKey: 'pilot', speakerLabel: 'PILOT', canonicalText: binding.turnId, evidence: { kind: 'source-segment-id' as const, sourceSegmentId: binding.sourceSegmentId, panelSourceSegmentIds: [binding.sourceSegmentId], speechOrdinal: 1 } }))
    const sourceAudio = { path: 'audio/effect.wav', sha256: HASH, durationMs: 500 }
    const soundBindings = [{ cueId: 'sfx', panelNumber: 2, kind: 'action-sfx' as const, prompt: 'hit', sourceSpan: { kind: 'sound-effect' as const, start: 1, end: 2, indexUnit: 'unicode-scalar-value' as const, text: 'x' }, sourceAudio, originalRangeMs: { start: 400, end: 900 }, gainDb: 0, pan: 0, evidence: { kind: 'preceding-action-segment' as const, sourceSegmentId: 'action', sourceSegmentEnd: 1 } }]
    const timeline = resolveComicPanelTimeline({
      presentationId: HASH, panels, dialogueBindings,
      dialogueRanges: new Map([['turn-a', { start: 100, end: 1000 }], ['turn-b', { start: 200, end: 800 }], ['turn-c', { start: 300, end: 700 }]]),
      soundBindings, untimedPanelMs: 2000,
    })
    expect(timeline.panels.map(item => [item.panelNumber, item.startMs, item.endMs, item.timing])).toEqual([
      [1, 0, 2000, 'untimed-hold'],
      [2, 2000, 2900, 'assigned-audio'],
      [3, 2900, 4900, 'untimed-hold'],
      [4, 4900, 5300, 'assigned-audio'],
      [5, 5300, 7300, 'untimed-hold'],
    ])
    expect(timeline.events.find(event => event.eventId === 'dialogue:turn-a')?.presentationRangeMs).toEqual({ start: 2000, end: 2900 })
    expect(timeline.events.find(event => event.eventId === 'dialogue:turn-b')?.presentationRangeMs).toEqual({ start: 2100, end: 2700 })
    expect(timeline.events.find(event => event.eventId === 'sound:sfx')?.presentationRangeMs).toEqual({ start: 2300, end: 2800 })
    expect(timeline.events.find(event => event.eventId === 'dialogue:turn-c')?.presentationRangeMs).toEqual({ start: 4900, end: 5300 })
  })
})

const pngHeader = (width: number, height: number): Uint8Array => {
  const bytes = Buffer.alloc(24)
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

describe('canonical presentation panels', () => {
  test('reports every missing panel together and rejects duplicate aliases and dimension drift', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-presentation-panels-'))
    try {
      await mkdir(join(root, 'panels'))
      await Bun.write(join(root, 'panels', 'panel-01.png'), pngHeader(64, 64))
      const reviewed = scene([panel(1, []), panel(2, []), panel(3, [])])
      await expect(loadCanonicalPresentationPanels(root, reviewed)).rejects.toThrow('panel-02.png\n- panels/panel-03.png')
      await Bun.write(join(root, 'panels', 'panel-1.png'), pngHeader(64, 64))
      await expect(loadCanonicalPresentationPanels(root, scene([panel(1, [])]))).rejects.toThrow('duplicate numeric PNG identities')
      await rm(join(root, 'panels', 'panel-1.png'))
      await Bun.write(join(root, 'panels', 'panel-02.png'), pngHeader(80, 64))
      await expect(loadCanonicalPresentationPanels(root, scene([panel(1, []), panel(2, [])]))).rejects.toThrow('panel-02.png=80x64')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

const compatibleAudioFixture = (audio: CanonicalComicItemMetadata['audio'], providers: PipelineManifest['items'][number]['providers'] = []): CompatibleComicSceneRun => ({
  sceneRunDir: '/fixture',
  sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/script.md', scriptSlug: 'script', contentSha256: HASH, identityHash: HASH },
  structuredScript: {} as StructuredScriptData,
  structuredScriptBytes: new Uint8Array(),
  comicMetadata: {
    schemaVersion: 1,
    stages: {} as CanonicalComicItemMetadata['stages'],
    audio,
    presentation: {},
  },
  manifest: { command: 'comic', scope: 'single', createdAt: '2026-08-13T00:00:00.000Z', updatedAt: '2026-08-13T00:00:00.000Z', source: {}, items: [{ input: 'input/script.md', outputDir: '.', status: 'full', metadata: {}, providers }] },
})

describe('comic presentation visual input import', () => {
  test('imports an exact source-covered canonical sibling into an immutable run-contained bundle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-presentation-visual-import-'))
    try {
      const sceneRunDir = join(root, 'script-inworld-v1')
      const canonicalDir = join(root, 'script')
      await mkdir(sceneRunDir, { recursive: true })
      await mkdir(join(canonicalDir, 'metadata'), { recursive: true })
      await mkdir(join(canonicalDir, 'panels'), { recursive: true })
      await Bun.write(join(canonicalDir, 'metadata/scene.json'), `${JSON.stringify(scene([panel(1, ['action-1'])]), null, 2)}\n`)
      await Bun.write(join(canonicalDir, 'panels/panel-01.png'), pngHeader(64, 64))
      const compatible = compatibleAudioFixture({})
      compatible.sceneRunDir = sceneRunDir
      compatible.sourceIdentity = { ...compatible.sourceIdentity, scriptSlug: 'script' }
      compatible.structuredScript = {
        sourceSegments: [{ id: 'action-1', type: 'direction', text: 'A static bridge.', sourceSpans: [], location: { key: 'bridge', raw: 'INT. BRIDGE' } }]
      } as unknown as StructuredScriptData

      const resolved = await resolvePresentationVisualInputs(compatible)
      expect(resolved.sourceDir).toBe(canonicalDir)
      const prepared = await preparePresentationVisualInputs(compatible, resolved)
      expect(prepared.imported).toBe(true)
      expect(prepared.sceneRef.path).toMatch(/^presentation\/inputs\/[a-f0-9]{64}\/reviewed-scene\.json$/)
      expect(prepared.panels[0]?.path).toMatch(/^presentation\/inputs\/[a-f0-9]{64}\/panels\/panel-01\.png$/)
      expect(await Bun.file(join(sceneRunDir, prepared.sceneRef.path)).exists()).toBe(true)
      expect(await Bun.file(join(sceneRunDir, prepared.panels[0]!.path)).exists()).toBe(true)
      expect(await Bun.file(join(sceneRunDir, 'metadata/scene.json')).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('comic presentation audio selection', () => {
  const dialogue = (targetKey: string, audioRunId: string) => ({ targetKey, renderIdentity: HASH, audioRunId, audioRunRef: `audio/${audioRunId}/audio-run.json`, audioRunSha256: HASH })
  const soundscape = (targetKey: string, dialogueAudioRunId: string, soundscapeAudioRunId: string) => ({ targetKey, dialogueAudioRunId, soundscapeAudioRunId, audioRunRef: `audio/${soundscapeAudioRunId}/audio-run.json`, audioRunSha256: HASH, masterRef: { path: `audio/${soundscapeAudioRunId}/master.wav`, sha256: HASH } })
  const provider = (targetKey: string, service: string, model: string) => ({ service, model, local: false, operation: 'comic-audio' as const, targetKey, transport: 'hosted-api', artifactDir: '.', status: 'succeeded' as const, attempts: 1, options: {}, metadata: {}, result: {} })

  test('prefers one soundscape, falls back to one dialogue, and reports incomplete or ambiguous selection', () => {
    const firstDialogue = dialogue('target-a', '1'.repeat(64))
    const secondDialogue = dialogue('target-b', '2'.repeat(64))
    const firstSoundscape = soundscape('target-a', firstDialogue.audioRunId, '3'.repeat(64))
    const soundPreferred = compatibleAudioFixture({ selectedAudioRuns: [firstDialogue], selectedSoundscapeRuns: [firstSoundscape] })
    expect(selectPresentationAudioBinding(soundPreferred, undefined)).toMatchObject({ kind: 'soundscape', dialogue: firstDialogue, soundscape: firstSoundscape })
    expect(selectPresentationAudioBinding(compatibleAudioFixture({ selectedAudioRuns: [firstDialogue] }), undefined)).toMatchObject({ kind: 'dialogue', dialogue: firstDialogue })
    expect(() => selectPresentationAudioBinding(compatibleAudioFixture({ selectedAudioRuns: [firstDialogue, secondDialogue] }), undefined)).toThrow('ambiguous across 2 complete dialogue runs')
    expect(() => selectPresentationAudioBinding(compatibleAudioFixture({ selectedAudioRuns: [], selectedSoundscapeRuns: [firstSoundscape] }), undefined)).toThrow('no exact canonical dialogue AudioRun binding')
    expect(() => selectPresentationAudioBinding(compatibleAudioFixture({}), undefined)).toThrow('raw audio files are unsupported')
  })

  test('requires an exact provider=model selector when provider labels remain ambiguous', () => {
    const firstDialogue = dialogue('target-a', '1'.repeat(64))
    const secondDialogue = dialogue('target-b', '2'.repeat(64))
    const compatible = compatibleAudioFixture({ selectedAudioRuns: [firstDialogue, secondDialogue] }, [provider('target-a', 'fixture', 'voice'), provider('target-b', 'fixture', 'voice')])
    expect(() => selectPresentationAudioBinding(compatible, 'fixture=voice')).toThrow('is ambiguous in canonical selected audio metadata')
    expect(() => selectPresentationAudioBinding(compatible, 'fixture=missing')).toThrow('does not name a complete selected comic dialogue or soundscape run')
  })

  test('accepts a succeeded sound-effect result reused from an earlier SoundscapePlan identity', () => {
    expect(() => assertPresentationSoundEffectResult({ resultId: HASH, status: 'succeeded' }, HASH)).not.toThrow()
    expect(() => assertPresentationSoundEffectResult({ resultId: 'b'.repeat(64), status: 'succeeded' }, HASH)).toThrow('does not match the soundscape AudioRun binding')
    expect(() => assertPresentationSoundEffectResult({ resultId: HASH, status: 'failed' }, HASH)).toThrow('is not a complete success')
  })

  test('verifies retained AudioRun checksums before accepting a complete dialogue target', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-presentation-audio-'))
    try {
      const silent = await createLocalSilentDialogueRun({
        rootDir: root,
        plan: { dialoguePlanId: HASH, mixProfileHash: HASH, mixProfile: { schemaVersion: 1, sampleRate: 48000, channels: 2, codec: 'pcm_s16le', container: 'wav' }, createdAt: '2026-08-13T00:00:00.000Z' } as unknown as SoundscapePlan,
        target: { service: 'fixture', model: 'voice', transport: 'local-process' },
      })
      const compatible = compatibleAudioFixture({ selectedAudioRuns: [silent.binding] }, [provider(silent.binding.targetKey, 'fixture', 'voice')])
      compatible.sceneRunDir = root
      expect((await loadPresentationAudio(compatible)).dialogueAudioRun.audioRunId).toBe(silent.binding.audioRunId)
      compatible.comicMetadata.audio.selectedAudioRuns = [{ ...silent.binding, audioRunSha256: 'b'.repeat(64) }]
      await expect(loadPresentationAudio(compatible)).rejects.toThrow('checksum is stale')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('comic presentation manifest migration', () => {
  test('treats historical absence as not requested and writes the new optional local stage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-presentation-manifest-'))
    try {
      const source = '# Episode\n\n## Scene: "Room"\n\n**INT. ROOM**\n\nA quiet beat.\n'
      const characters = { characterKeys: [], resolve: () => undefined, detectMentions: () => [] } as unknown as CharacterCatalogService
      const locations: LocationReferenceCatalog = { schemaVersion: 1, styleImage: 'style.png', locations: [{ key: 'room', name: 'Room', aliases: [], specification: 'A room.', sourceScripts: [] }] }
      const provisional = parseScriptMarkdownToStructuredData(source, 'input/script.md', { characterCatalog: characters, locationCatalog: locations })
      const structured = parseScriptMarkdownToStructuredData(source, 'input/script.md', { sourceIdentity: provisional.sourceIdentity, characterCatalog: characters, locationCatalog: locations })
      const structuredBytes = `${canonicalTtsJson(structured)}\n`
      const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
      await mkdir(join(root, 'metadata'), { recursive: true })
      await Bun.write(join(root, structuredRef.path), structuredBytes)
      await writeInitialComicStructureManifest({ sceneRunDir: root, createdAt: '2026-08-13T00:00:00.000Z', sourceIdentity: structured.sourceIdentity, structuredScript: structuredRef })

      const historical = await Bun.file(join(root, 'manifest.json')).json() as { items: Array<{ metadata: { comic: { stages: Record<string, unknown>, presentation?: unknown } } }> }
      delete historical.items[0]?.metadata.comic.stages['presentation']
      delete historical.items[0]?.metadata.comic.presentation
      await Bun.write(join(root, 'manifest.json'), `${JSON.stringify(historical, null, 2)}\n`)
      const migrated = await readManifest(root)
      const migratedComic = migrated?.items[0]?.metadata['comic'] as unknown as CanonicalComicItemMetadata
      expect(migratedComic.stages.presentation).toEqual({ requirement: 'not-requested', status: 'skipped', execution: { kind: 'none', reason: 'not-requested' }, targetKeys: [], artifactRefs: [] })
      expect(migratedComic.presentation).toEqual({})

      const plan = await writeImmutableArtifactFile(root, 'presentation/runs/test/plan.json', '{}\n')
      const timeline = await writeImmutableArtifactFile(root, 'presentation/runs/test/timeline.json', '{}\n')
      const run = await writeImmutableArtifactFile(root, 'presentation/runs/test/comic-presentation-run.json', '{}\n')
      const wav = await writeImmutableArtifactFile(root, 'presentation/final/slideshow.wav', new Uint8Array([1, 2, 3]))
      const mp4 = await writeImmutableArtifactFile(root, 'presentation/final/slideshow.mp4', new Uint8Array([4, 5, 6]))
      const artifactRefs = [plan, timeline, run, wav, mp4].map(ref => ({ path: ref.relativePath, sha256: ref.sha256 }))
      await updateComicPresentationManifest({
        sceneRunDir: root,
        sourceIdentity: structured.sourceIdentity,
        stage: { requirement: 'optional', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs },
        presentation: {
          selectedPresentationId: HASH,
          planRef: artifactRefs[0],
          resolvedTimelineRef: artifactRefs[1],
          runRef: artifactRefs[2],
          finalOutputRefs: artifactRefs.slice(3),
        },
      })
      const updated = await readManifest(root)
      const updatedComic = updated?.items[0]?.metadata['comic'] as unknown as CanonicalComicItemMetadata
      expect(updatedComic.stages.presentation).toMatchObject({ requirement: 'optional', status: 'full', execution: { kind: 'local', state: 'succeeded' } })
      expect(updatedComic.presentation.selectedPresentationId).toBe(HASH)
      expect(updated?.items[0]?.status).toBe('full')

      const nextPlan = await writeImmutableArtifactFile(root, 'presentation/runs/next/plan.json', '{"next":"plan"}\n')
      const nextTimeline = await writeImmutableArtifactFile(root, 'presentation/runs/next/timeline.json', '{"next":"timeline"}\n')
      const nextRun = await writeImmutableArtifactFile(root, 'presentation/runs/next/comic-presentation-run.json', '{"next":"run"}\n')
      const nextWavBytes = new Uint8Array([7, 8, 9])
      const nextMp4Bytes = new Uint8Array([10, 11, 12])
      const nextWav = await writeImmutableArtifactFile(root, 'presentation/runs/next/presentation.wav', nextWavBytes)
      const nextMp4 = await writeImmutableArtifactFile(root, 'presentation/runs/next/slideshow.mp4', nextMp4Bytes)
      const nextFinalRefs = [
        { path: 'presentation/final/slideshow.wav', sha256: nextWav.sha256 },
        { path: 'presentation/final/slideshow.mp4', sha256: nextMp4.sha256 },
      ]
      const nextArtifactRefs = [nextPlan, nextTimeline, nextRun, nextWav, nextMp4].map(ref => ({ path: ref.relativePath, sha256: ref.sha256 })).concat(nextFinalRefs)
      let publishSawValidPriorManifest = false
      await updateComicPresentationManifest({
        sceneRunDir: root,
        sourceIdentity: structured.sourceIdentity,
        stage: { requirement: 'optional', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs: nextArtifactRefs },
        presentation: {
          selectedPresentationId: NEXT_HASH,
          planRef: { path: nextPlan.relativePath, sha256: nextPlan.sha256 },
          resolvedTimelineRef: { path: nextTimeline.relativePath, sha256: nextTimeline.sha256 },
          runRef: { path: nextRun.relativePath, sha256: nextRun.sha256 },
          finalOutputRefs: nextFinalRefs,
        },
        publishFinal: async () => {
          publishSawValidPriorManifest = (await readManifest(root))?.items[0]?.status === 'full'
          await Bun.write(join(root, nextFinalRefs[0]!.path), nextWavBytes)
          await Bun.write(join(root, nextFinalRefs[1]!.path), nextMp4Bytes)
          return nextFinalRefs
        },
      })
      expect(publishSawValidPriorManifest).toBe(true)
      const replaced = await readManifest(root)
      const replacedComic = replaced?.items[0]?.metadata['comic'] as unknown as CanonicalComicItemMetadata
      expect(replacedComic.presentation.selectedPresentationId).toBe(NEXT_HASH)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
