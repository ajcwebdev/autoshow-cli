import { describe, expect, test } from 'bun:test'
import * as v from 'valibot'
import type { CharacterCatalogService } from '~/types'
import { createStructuredScriptArtifactRef, computeSceneRunIdentity, validateStructuredScriptSourceSpans } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { parseScriptMarkdownToStructuredData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import { StructuredScriptDataSchema } from '~/cli/commands/process-steps/step-8-comic/schemas/schemas'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import type { LocationReferenceCatalog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'

const characters = {
  characterKeys: ['pilot'],
  resolve: (value: string) => value.replace(/[^A-Za-z]/gu, '').toUpperCase() === 'PILOT' ? ['pilot'] : undefined,
  detectMentions: () => [],
} as unknown as CharacterCatalogService

const locations: LocationReferenceCatalog = {
  schemaVersion: 1,
  styleImage: 'style.png',
  locations: [{ key: 'bridge', name: 'Bridge', aliases: ['ship bridge'], specification: 'Bridge.', sourceScripts: [] }],
}

const source = [
  '# Episode',
  '',
  '## Scene: "Sound"',
  '',
  '**INT. SHIP BRIDGE**',
  '',
  '**AMBIENCE:**',
  '',
  'OPTIONAL {duration: 12s, gain: -2dB, pan: 0} low engine room hum',
  '',
  '**PILOT**',
  'Ready [[VOCAL SFX: OPTIONAL {duration: 0.8s, gain: -1dB, pan: -0.25} nervous inhale]] for [[SFX: {duration: 1.5s, pan: 0.4} console chirp]] launch.',
  '',
  '**SFX:**',
  '',
  'Heavy hatch closes',
].join('\n')

describe('ADR-018 structured soundscape contracts', () => {
  test('parses strict v5 block and inline directives with exact source spans and stable anchors', async () => {
    const initial = parseScriptMarkdownToStructuredData(source, 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })
    const sourceIdentity = initial.sourceIdentity
    const structured = parseScriptMarkdownToStructuredData(source, 'input/sound.md', { sourceIdentity, characterCatalog: characters, locationCatalog: locations })
    expect(structured.schemaVersion).toBe(5)
    expect(structured.scene.soundscape.cues.map(cue => ({ kind: cue.kind, required: cue.required, prompt: cue.prompt, anchor: cue.anchor.kind }))).toEqual([
      { kind: 'vocal-reaction', required: false, prompt: 'nervous inhale', anchor: 'source-text-offset' },
      { kind: 'action-sfx', required: true, prompt: 'console chirp', anchor: 'source-text-offset' },
      { kind: 'action-sfx', required: true, prompt: 'Heavy hatch closes', anchor: 'source-segment-edge' },
    ])
    expect(structured.scene.soundscape.cues).toMatchObject([
      { durationSeconds: 0.8, gainDb: -1, pan: -0.25 },
      { durationSeconds: 1.5, pan: 0.4 },
      {},
    ])
    expect(structured.scene.soundscape.ambientBeds).toMatchObject([{ kind: 'ambience', required: false, prompt: 'low engine room hum', durationSeconds: 12, gainDb: -2, pan: 0, range: { kind: 'full-scene' } }])
    expect(structured.sourceSegments.find(segment => segment.type === 'dialogue')?.text).toBe('Ready for launch.')
    expect(JSON.stringify(structured.scene.soundscape)).not.toMatch(/provider|model_id|output_format/iu)
    expect(() => validateStructuredScriptSourceSpans(structured, source)).not.toThrow()
    const reparsed = parseScriptMarkdownToStructuredData(source, 'input/sound.md', { sourceIdentity, characterCatalog: characters, locationCatalog: locations })
    expect(reparsed.scene.soundscape).toEqual(structured.scene.soundscape)
  })

  test('rejects malformed or out-of-range authored sound controls locally', () => {
    expect(() => parseScriptMarkdownToStructuredData(source.replace('duration: 12s', 'duration: 31s'), 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })).toThrow(/between 0\.5 and 30 seconds/iu)
    expect(() => parseScriptMarkdownToStructuredData(source.replace('pan: 0.4', 'pan: 1.1'), 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })).toThrow(/pan must be between -1 and 1/iu)
    expect(() => parseScriptMarkdownToStructuredData(source.replace('gain: -2dB', 'volume: -2dB'), 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })).toThrow(/expected duration, gain, pan, from, or to/iu)
    expect(() => parseScriptMarkdownToStructuredData(source.replace('[[SFX: {duration: 1.5s, pan: 0.4} console chirp]]', '[[SFX: {from: scene-start, to: scene-end} console chirp]]'), 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })).toThrow(/only valid on AMBIENCE/iu)
  })

  test('rejects v4 and separates generation identity from placement and mix identity', async () => {
    const initial = parseScriptMarkdownToStructuredData(source, 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })
    const sourceIdentity = initial.sourceIdentity
    const structured = parseScriptMarkdownToStructuredData(source, 'input/sound.md', { sourceIdentity, characterCatalog: characters, locationCatalog: locations })
    expect(() => v.parse(StructuredScriptDataSchema, { ...structured, schemaVersion: 4 })).toThrow()
    const bytes = `${JSON.stringify(structured)}\n`
    const ref = createStructuredScriptArtifactRef(bytes)
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, ref)
    const dialogue = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: ref, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z' })
    const first = createSoundscapePlan({ structuredScript: structured, structuredScriptRef: ref, dialoguePlan: dialogue, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z' })
    const proportional = createSoundscapePlan({ structuredScript: structured, structuredScriptRef: ref, dialoguePlan: dialogue, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z', timingPolicy: 'proportional' })
    const changed = structured.scene.soundscape.cues.map((cue, index) => index === 0 ? { ...cue, gainDb: -9, pan: 0.75 } : cue)
    const second = createSoundscapePlan({ structuredScript: { ...structured, scene: { ...structured.scene, soundscape: { ...structured.scene.soundscape, cues: changed } } }, structuredScriptRef: ref, dialoguePlan: dialogue, sceneRunIdentity, createdAt: '2026-08-13T00:00:00.000Z' })
    expect(second.synthesisTasks.map(task => task.generationIdentity)).toEqual(first.synthesisTasks.map(task => task.generationIdentity))
    expect(second.mixIdentity).not.toBe(first.mixIdentity)
    expect(first.timingPolicy).toBe('strict')
    expect(proportional.synthesisTasks.map(task => task.generationIdentity)).toEqual(first.synthesisTasks.map(task => task.generationIdentity))
    expect(proportional.mixIdentity).not.toBe(first.mixIdentity)
    expect(proportional.soundscapePlanId).not.toBe(first.soundscapePlanId)
  })

  test('includes authored controls in cue identity and parses explicit ambient ranges', () => {
    const louder = source.replace('gain: -1dB', 'gain: -6dB')
    const ranged = [
      '# Episode',
      '',
      '## Scene: "Sound"',
      '',
      '**INT. SHIP BRIDGE**',
      '',
      '**AMBIENCE:** {from: scene-start, to: next-line-start} low engine room hum',
      '',
      '**PILOT**',
      'Ready for launch.',
      '',
      '**AMBIENCE:** {from: previous-line-end, to: scene-end} corridor ventilation',
    ].join('\n')
    const initial = parseScriptMarkdownToStructuredData(source, 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })
    const structured = parseScriptMarkdownToStructuredData(source, 'input/sound.md', { sourceIdentity: initial.sourceIdentity, characterCatalog: characters, locationCatalog: locations })
    const louderStructured = parseScriptMarkdownToStructuredData(louder, 'input/sound.md', { sourceIdentity: initial.sourceIdentity, characterCatalog: characters, locationCatalog: locations })
    const rangedStructured = parseScriptMarkdownToStructuredData(ranged, 'input/ranged.md', { characterCatalog: characters, locationCatalog: locations })
    expect(louderStructured.scene.soundscape.cues[0]?.cueId).not.toBe(structured.scene.soundscape.cues[0]?.cueId)
    expect(rangedStructured.scene.soundscape.ambientBeds).toMatchObject([
      { prompt: 'low engine room hum', range: { kind: 'anchors', start: { kind: 'resolved-scene-edge', edge: 'start' }, end: { kind: 'source-segment-edge', edge: 'start' } } },
      { prompt: 'corridor ventilation', range: { kind: 'anchors', start: { kind: 'source-segment-edge', edge: 'end' }, end: { kind: 'resolved-scene-edge', edge: 'end' } } },
    ])
    expect(() => parseScriptMarkdownToStructuredData(source.replace('OPTIONAL {duration: 12s, gain: -2dB, pan: 0}', 'OPTIONAL {from: scene-start}'), 'input/sound.md', { characterCatalog: characters, locationCatalog: locations })).toThrow(/requires both from and to/iu)
  })
})
