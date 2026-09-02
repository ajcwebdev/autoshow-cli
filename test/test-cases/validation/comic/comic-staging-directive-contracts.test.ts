import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import * as v from 'valibot'
import { validateStructuredScriptSourceSpans } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { StructuredScriptDataSchema, StructuredStagingSchema } from '~/cli/commands/process-steps/step-8-comic/schemas/schemas'
import { reviewStructuredScriptWithLlm } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/llm-review'
import { normalizeStructuredScriptData } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-data-normalization'
import { parseScriptMarkdownToStructuredData as parseStructuredScript } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import { STAGING_DIRECTIVE_LABELS, STAGING_HEADER_KEYS, parseStagingBlockDirective } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/staging-directives'
import type { CharacterCatalogService, ComicStructuredLlmResult, StructuredScriptData } from '~/types'

const fixtureRoot = 'test/test-cases/validation/comic/fixtures/structured-script-parser'
const testLocationCatalog = {
  schemaVersion: 1 as const,
  styleImage: 'style.png',
  locations: [
    { key: 'cargo-bay', name: 'Cargo Bay', aliases: ['Starship Horizon Fabrication Bay'], specification: 'Test.', sourceScripts: [] },
    { key: 'stone-cell', name: 'Stone Cell', specification: 'Test.', sourceScripts: [] },
    { key: 'clearing', name: 'Clearing', specification: 'Test.', sourceScripts: [] },
    { key: 'shuttle-bay', name: 'Shuttle Bay', specification: 'Test.', sourceScripts: [] },
  ],
}
const characterAliases = new Map<string, string>([
  ['CAPTAIN', 'captain'], ['ENGINEER', 'engineer'], ['PILOT', 'pilot'], ['NAVIGATOR', 'navigator'],
  ['COMMANDER', 'commander'], ['GUIDE', 'virtual-guide'], ['VILLAGERS', 'villagers'],
])
const normalizeTestCharacter = (value: string) => value.toUpperCase().replace(/\s*\((?:V\.?O\.?|O\.?S\.?)\)\s*$/, '').trim()
const testCharacterCatalog = {
  characterKeys: Array.from(new Set(characterAliases.values())),
  resolve(value: string) {
    const key = characterAliases.get(normalizeTestCharacter(value))
    return key ? [key] : undefined
  },
  detectMentions(text: string) {
    return Array.from(characterAliases.entries()).flatMap(([alias, key]) => {
      const match = text.match(new RegExp(`\\b${alias}\\b`, 'i'))
      return match ? [{ raw: match[0]!, characterKeys: [key] }] : []
    })
  },
} as unknown as CharacterCatalogService
const fixtureSourceIdentity = (name: string) => ({
  schemaVersion: 1 as const,
  canonicalPath: `input/${name}.md`,
  scriptSlug: name,
  contentSha256: '0'.repeat(64),
  identityHash: '1'.repeat(64),
})
const parse = (content: string, name = 'staging-probe'): StructuredScriptData =>
  parseStructuredScript(content, `input/${name}.md`, {
    sourceIdentity: fixtureSourceIdentity(name),
    locationCatalog: testLocationCatalog,
    characterCatalog: testCharacterCatalog,
  })
const scene = (body: string): string => `# Episode Nine\n\n## Scene: "Probe"\n\n**INT. CARGO BAY - NIGHT**\n\n${body}\n`

const FIXTURE_DIRECTIVE_LINES = [
  '**BLOCKING:**\n\n{state: meeting-open, location: cargo-bay} CAPTAIN stands at the loading door facing the crew. ENGINEER sits at the terminal screen-right of the door, facing the Captain.\n\n',
  '**CAMERA:** {panel: next} Low and wide from behind the crew, looking at the Captain at the door.\n\n',
  '**BREAK-180:** {panel: 2} The argument turns into a free-for-all; cross the line so the room feels unmoored.\n\n',
  '**COSTUME:** {character: pilot} Flight jacket torn at the left sleeve from here on.\n\n',
  '**EXTRAS:** {group: villagers, count: 12, exclude: children|readable signs} Mixed ages and heights; picket signs stay blank.\n\n',
  '**BLOCKING:** Engineer stands and crosses to the loading door, facing the Captain.\n\n',
  '**SKIP-PANELS: {reason: previously-on recap}**\n\n',
]

describe('staging directive parser contracts', () => {
  test('golden fixture pins every directive kind beside beats, segments, and the soundscape', async () => {
    const source = await Bun.file(join(fixtureRoot, 'staging-directives.md')).text()
    const expected = JSON.parse(await Bun.file(join(fixtureRoot, 'staging-directives.expected.json')).text())
    const structured = parse(source, 'staging-directives')

    expect(structured).toEqual(expected)
    expect(() => validateStructuredScriptSourceSpans(structured, source)).not.toThrow()
    expect(structured.beats.map(beat => beat.type)).toEqual(['direction', 'dialogue', 'dialogue', 'direction', 'panel-note', 'direction'])
    expect(structured.sourceSegments.map(segment => segment.id)).toEqual(['beat-0001', 'beat-0002', 'beat-0003', 'beat-0004', 'beat-0005', 'beat-0006'])
    expect(structured.scene.soundscape.cues.map(cue => cue.prompt)).toEqual(['door hiss'])
    expect(structured.staging).toMatchObject({
      blocking: [
        { lineIndex: 8, afterSegmentId: null, state: 'meeting-open', location: 'cargo-bay' },
        { lineIndex: 40, afterSegmentId: 'beat-0005', state: 'state-2', location: 'cargo-bay', text: 'Engineer stands and crosses to the loading door, facing the Captain.' },
      ],
      camera: [{ lineIndex: 18, afterSegmentId: 'beat-0002', panel: 'next' }],
      axisBreaks: [{ lineIndex: 26, afterSegmentId: 'beat-0003', panel: 2 }],
      costume: [{ lineIndex: 30, afterSegmentId: 'beat-0003', character: 'pilot' }],
      extras: [{ lineIndex: 36, afterSegmentId: 'beat-0004', group: 'villagers', count: 12, exclude: ['children', 'readable signs'] }],
      skipPanels: { lineIndex: 42, reason: 'previously-on recap' },
    })
  })

  test('directives never become beats or coverage segments and never shift segment ids', async () => {
    const source = await Bun.file(join(fixtureRoot, 'staging-directives.md')).text()
    let stripped = source
    for (const block of FIXTURE_DIRECTIVE_LINES) {
      expect(stripped).toContain(block)
      stripped = stripped.replace(block, '')
    }
    // The fixture places **COSTUME:** between the PILOT label and "Still ready." to exercise the
    // speaker-turn rule pinned below; drop the label too so the stripped script reads "Still ready."
    // as the same direction beat instead of a PILOT dialogue turn.
    expect(stripped).toContain('**PILOT**\n\n')
    stripped = stripped.replace('**PILOT**\n\n', '')
    const withDirectives = parse(source, 'staging-directives')
    const withoutDirectives = parse(stripped, 'staging-directives')

    expect(withoutDirectives.staging).toBeUndefined()
    expect(withDirectives.sourceSegments.map(segment => segment.id)).toEqual(withoutDirectives.sourceSegments.map(segment => segment.id))
    expect(withDirectives.beats.map(beat => [beat.type, beat.text])).toEqual(withoutDirectives.beats.map(beat => [beat.type, beat.text]))
    for (const beat of withDirectives.beats) {
      for (const label of STAGING_DIRECTIVE_LABELS) expect(beat.text.startsWith(`${label}:`) && beat.type !== 'panel-note').toBe(false)
    }
    expect(withDirectives.beats.find(beat => beat.type === 'panel-note')?.text).toBe('COSTUME: this bracket note remains a panel note.')
  })

  test('both label forms parse case-insensitively with the colon required', () => {
    expect(parseStagingBlockDirective('**BLOCKING:**')).toEqual({ kind: 'blocking', label: 'BLOCKING' })
    expect(parseStagingBlockDirective('**camera:** {panel: 3} tight')).toEqual({ kind: 'camera', label: 'CAMERA', prompt: '{panel: 3} tight' })
    expect(parseStagingBlockDirective('**Break-180: {panel: next} cross**')).toEqual({ kind: 'axis-break', label: 'BREAK-180', prompt: '{panel: next} cross' })
    expect(parseStagingBlockDirective('**SKIP-PANELS: {reason: recap}**')).toEqual({ kind: 'skip-panels', label: 'SKIP-PANELS', prompt: '{reason: recap}' })
    expect(parseStagingBlockDirective('**BLOCKING**')).toBeUndefined()
    expect(parseStagingBlockDirective('[BLOCKING: bracket note]')).toBeUndefined()
    expect(parseStagingBlockDirective('**SFX:** door hiss')).toBeUndefined()
    expect(STAGING_HEADER_KEYS).toEqual({ blocking: ['state', 'location'], camera: ['panel'], 'axis-break': ['panel'], costume: ['character'], extras: ['group', 'count', 'exclude'], 'skip-panels': ['reason'] })
  })

  test('headers tolerate spacing, emphasis wrappers, and Unicode normalization while defaults fill missing keys', () => {
    const structured = parse(scene([
      '**CAMERA:** _{ Panel : 4 } Low  and\n  wide ﬁnal look_',
      '**CAMERA:** Tight on the door.',
      '**BREAK-180:** {panel: NEXT} Cross the line.',
      '**EXTRAS:** {group: villagers, exclude: children | readable signs | } Sparse crowd.',
      '**BLOCKING:** {location: shuttle-bay} Everyone waits.',
      '**SKIP-PANELS:** {reason: recap} plus prose',
    ].join('\n\n')))

    // The first directive spans two source lines (6 and 7), so every later directive sits one line further down.
    expect(structured.staging?.camera).toEqual([
      { lineIndex: 6, afterSegmentId: null, panel: 4, text: 'Low and wide final look' },
      { lineIndex: 9, afterSegmentId: null, panel: 'next', text: 'Tight on the door.' },
    ])
    expect(structured.staging?.axisBreaks).toEqual([{ lineIndex: 11, afterSegmentId: null, panel: 'next', text: 'Cross the line.' }])
    expect(structured.staging?.extras).toEqual([{ lineIndex: 13, afterSegmentId: null, group: 'villagers', count: null, exclude: ['children', 'readable signs'], text: 'Sparse crowd.' }])
    expect(structured.staging?.blocking).toEqual([{ lineIndex: 15, afterSegmentId: null, state: 'state-1', location: 'shuttle-bay', text: 'Everyone waits.' }])
    expect(structured.staging?.skipPanels).toEqual({ lineIndex: 17, reason: 'recap plus prose' })
    expect(structured.beats).toEqual([])
    expect(structured.sourceSegments).toEqual([])
  })

  test('afterSegmentId resolves to the nearest preceding segment, including the last part of a split beat', () => {
    const longSentence = 'The cargo bay stretches away under flickering lights while the crew waits for orders that never come.'
    const longDirection = Array.from({ length: 5 }, () => longSentence).join(' ')
    const structured = parse(scene([
      '**CAMERA:** {panel: 1} Before anything.',
      longDirection,
      '**BLOCKING:** After the long direction.',
      '**CAPTAIN**',
      'Listen up.',
      '**CAMERA:** {panel: 2} After the line.',
      'Stars wheel overhead.',
    ].join('\n\n')))

    expect(structured.sourceSegments.map(segment => segment.id)).toEqual(['beat-0001-01', 'beat-0001-02', 'beat-0002', 'beat-0003'])
    expect(structured.staging?.camera.map(directive => directive.afterSegmentId)).toEqual([null, 'beat-0002'])
    expect(structured.staging?.blocking.map(directive => [directive.afterSegmentId, directive.location])).toEqual([['beat-0001-02', 'cargo-bay']])
    expect(structured.staging?.blocking[0]?.state).toBe('state-1')
  })

  test('a directive between a speaker label and its line ends the speaker turn like SFX', () => {
    const withDirective = parse(scene('**PILOT**\n\n**CAMERA:** {panel: next} Tight on the pilot.\n\nWe are go.'))
    const withSfx = parse(scene('**PILOT**\n\n**SFX:** console chirp\n\nWe are go.'))
    const plain = parse(scene('**PILOT**\n\nWe are go.'))

    expect(withDirective.beats.map(beat => [beat.type, beat.text, beat.speakerLabel ?? null])).toEqual([['direction', 'We are go.', null]])
    expect(withSfx.beats.map(beat => [beat.type, beat.text, beat.speakerLabel ?? null])).toEqual([['direction', 'We are go.', null]])
    expect(plain.beats.map(beat => [beat.type, beat.text, beat.speakerLabel ?? null])).toEqual([['dialogue', 'We are go.', 'PILOT']])
    expect(withDirective.staging?.camera[0]?.afterSegmentId).toBeNull()
  })

  test('a bare label pairs with the next block and a bare SFX label still owns its prompt block', () => {
    const structured = parse(scene('**SFX:**\n\n**BLOCKING:** {state: not-a-directive} consumed by the sound label\n\n**COSTUME:**\n\n{character: captain} Coat off from here.\n\n**CAPTAIN**\n\nBegin.'))

    expect(structured.scene.soundscape.cues.map(cue => cue.prompt)).toEqual(['**BLOCKING:** {state: not-a-directive} consumed by the sound label'])
    expect(structured.staging?.blocking).toEqual([])
    expect(structured.staging?.costume).toEqual([{ lineIndex: 10, afterSegmentId: null, character: 'captain', text: 'Coat off from here.' }])
    expect(structured.beats.map(beat => [beat.type, beat.speakerLabel ?? null])).toEqual([['dialogue', 'CAPTAIN']])
  })

  test('validation errors name the directive and its line', () => {
    const errorFor = (body: string): string => {
      try {
        parse(scene(body))
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
      throw new Error(`expected "${body}" to fail`)
    }

    expect(errorFor('**CAMERA:** {lens: wide} Tight.')).toBe('Staging directive **CAMERA:** on line 7 has an unknown header key "lens"; expected panel.')
    expect(errorFor('**EXTRAS:** {group: villagers, panel: 2} Crowd.')).toBe('Staging directive **EXTRAS:** on line 7 has an unknown header key "panel"; expected group, count, exclude.')
    expect(errorFor('**BLOCKING:** {state meeting-open} Everyone.')).toBe('Staging directive **BLOCKING:** on line 7 has a malformed header "{state meeting-open}"; expected {key: value, ...}.')
    expect(errorFor('**BLOCKING:** {state: meeting-open Everyone.')).toBe('Staging directive **BLOCKING:** on line 7 has a malformed header "{state: meeting-open Everyone."; expected {key: value, ...}.')
    expect(errorFor('**BLOCKING:** {state: , location: cargo-bay} Everyone.')).toBe('Staging directive **BLOCKING:** on line 7 has a malformed header "{state: , location: cargo-bay}"; expected {key: value, ...}.')
    expect(errorFor('**BLOCKING:** {state: a, state: b} Everyone.')).toBe('Staging directive **BLOCKING:** on line 7 repeats the header key "state".')
    expect(errorFor('**CAMERA:** {panel: abc} Tight.')).toBe('Staging directive **CAMERA:** on line 7 has an invalid panel value "abc"; expected a positive integer or next.')
    expect(errorFor('**BREAK-180:** {panel: 0} Cross.')).toBe('Staging directive **BREAK-180:** on line 7 has an invalid panel value "0"; expected a positive integer or next.')
    expect(errorFor('**EXTRAS:** {group: villagers, count: many} Crowd.')).toBe('Staging directive **EXTRAS:** on line 7 has an invalid count value "many"; expected a positive integer.')
    expect(errorFor('**COSTUME:** Coat off.')).toBe('Staging directive **COSTUME:** on line 7 requires a character header like {character: duco}.')
    expect(errorFor('**EXTRAS:** {count: 3} Crowd.')).toBe('Staging directive **EXTRAS:** on line 7 requires a group header like {group: villagers}.')
    expect(errorFor('**CAMERA:** {panel: 3}')).toBe('Staging directive **CAMERA:** on line 7 requires prose after the header.')
    expect(errorFor('**SKIP-PANELS:** {}')).toBe('Staging directive **SKIP-PANELS:** on line 7 requires a reason like {reason: previously-on recap}.')
    expect(errorFor('Stars.\n\n**SKIP-PANELS:** {reason: a}\n\n**SKIP-PANELS:** {reason: b}')).toBe("Staging directive **SKIP-PANELS:** on line 11 repeats the scene's skip-panels directive from line 9.")
    expect(errorFor('**BLOCKING:**\n\n**CAMERA:** {panel: 1} Tight.')).toBe('Staging directive **BLOCKING:** on line 7 is missing its prose before the next directive.')
    expect(errorFor('**BLOCKING:**\n\n**SFX:** door hiss')).toBe('Staging directive **BLOCKING:** on line 7 is missing its prose before the next directive.')
    expect(errorFor('Stars.\n\n**BLOCKING:**')).toBe('Staging directive **BLOCKING:** on line 9 at the end of the scene is missing its prose.')
  })

  test('staging is optional in the strict schema and rejects unknown keys', async () => {
    const legacy = JSON.parse(await Bun.file(join(fixtureRoot, 'handler-precedence.expected.json')).text())
    expect(v.safeParse(StructuredScriptDataSchema, legacy).success).toBe(true)
    expect('staging' in legacy).toBe(false)

    const withStaging = JSON.parse(await Bun.file(join(fixtureRoot, 'staging-directives.expected.json')).text())
    expect(v.safeParse(StructuredScriptDataSchema, withStaging).success).toBe(true)
    expect(v.safeParse(StructuredStagingSchema, { ...withStaging.staging, bogus: [] }).success).toBe(false)
    expect(v.safeParse(StructuredStagingSchema, { ...withStaging.staging, camera: [{ lineIndex: 1, afterSegmentId: null, panel: 'later', text: 'x' }] }).success).toBe(false)
    expect(v.safeParse(StructuredStagingSchema, { ...withStaging.staging, skipPanels: null }).success).toBe(true)
  })

  test('LLM review restores staging from the provisional parse and tells the model not to return it', async () => {
    const source = await Bun.file(join(fixtureRoot, 'staging-directives.md')).text()
    const provisional = parse(source, 'staging-directives')
    const prompts: string[] = []
    const runStructuredLlm = async (prompt: string): Promise<ComicStructuredLlmResult> => {
      prompts.push(prompt)
      const echoed = JSON.parse(JSON.stringify(provisional)) as Record<string, unknown>
      echoed['staging'] = { blocking: [{ invented: true }] }
      return {
        text: JSON.stringify(echoed),
        metadata: { llmService: 'openai', llmModel: 'gpt-5.6-sol', processingTime: 1, inputTokenCount: 10, outputTokenCount: 5, outputFileName: 'review.json', outputFormat: 'json', structuredMode: 'native', structuredPresetNames: [] },
      }
    }

    const reviewed = await reviewStructuredScriptWithLlm(source, provisional, 'gpt-5.6-sol', {}, {
      runStructuredLlm,
      characterKeys: testCharacterCatalog.characterKeys,
      characterAliasGuidance: 'CAPTAIN -> captain, ENGINEER -> engineer, PILOT -> pilot',
    })

    expect(reviewed.structuredScript.staging).toEqual(provisional.staging)
    expect(reviewed.structuredScript.sourceSegments.map(segment => segment.id)).toEqual(provisional.sourceSegments.map(segment => segment.id))
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('- Do not return `staging`. Staging directives (BLOCKING, CAMERA, BREAK-180, COSTUME, EXTRAS, SKIP-PANELS) are derived locally and restored after review; they are never beats or source segments.')

    const dropped = normalizeStructuredScriptData({ ...provisional, staging: undefined } as StructuredScriptData, { scriptSlug: provisional.scriptSlug, sourceFile: provisional.sourceFile, staging: provisional.staging })
    expect(dropped.staging).toEqual(provisional.staging)
    const untouched = normalizeStructuredScriptData(provisional, { scriptSlug: provisional.scriptSlug, sourceFile: provisional.sourceFile })
    expect(untouched.staging).toEqual(provisional.staging)
  })
})
