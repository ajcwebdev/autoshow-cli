import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import { validateStructuredScriptSourceSpans } from '~/cli/commands/visuals/comic/comic-utils/comic-audio-contracts'
import {
formatSourceSegmentsMarkdown
} from '~/cli/commands/visuals/comic/comic-utils/source-coverage-utils'
import { RETIRED_STAGING_LABELS } from '~/cli/commands/visuals/comic/comic-utils/structured-script-utils/retired-staging-labels'
import { parseScriptMarkdownToStructuredData as parseStructuredScript } from '~/cli/commands/visuals/comic/comic-utils/structured-script-utils/structured-script-parser'
import type {
CharacterCatalogService
} from '~/types'
const structuredScriptFixtureRoot = 'test/test-cases/validation/visuals/comic/fixtures/structured-script-parser'
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
  ['COMMANDER', 'commander'], ['GUIDE', 'virtual-guide'],
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
const parseScriptMarkdownToStructuredData = (content: string, path: string) =>
  parseStructuredScript(content, path, { locationCatalog: testLocationCatalog, characterCatalog: testCharacterCatalog })
const fixtureSourceIdentity = (name: string) => ({
  schemaVersion: 1 as const,
  canonicalPath: `input/${name}.md`,
  scriptSlug: name,
  contentSha256: '0'.repeat(64),
  identityHash: '1'.repeat(64),
})
const testLocation = { key: 'cargo-bay', raw: 'INT. CARGO BAY - MORNING', type: 'INT', place: 'CARGO BAY - MORNING' }

describe('comic source coverage contracts', () => {
  test('structured parser preserves exact handler precedence output', async () => {
    const source = await Bun.file(join(structuredScriptFixtureRoot, 'handler-precedence.md')).text()
    const expected = JSON.parse(await Bun.file(join(structuredScriptFixtureRoot, 'handler-precedence.expected.json')).text())

    const structured = parseStructuredScript(source, 'input/handler-precedence.md', {
      sourceIdentity: fixtureSourceIdentity('handler-precedence'),
      locationCatalog: testLocationCatalog,
      characterCatalog: testCharacterCatalog,
    })

    expect(structured).toEqual(expected)
    expect(() => validateStructuredScriptSourceSpans(structured, source)).not.toThrow()
  })

  test('structured parser preserves exact Unicode scalar boundaries', async () => {
    const source = await Bun.file(join(structuredScriptFixtureRoot, 'unicode-boundaries.md')).text()
    const expected = JSON.parse(await Bun.file(join(structuredScriptFixtureRoot, 'unicode-boundaries.expected.json')).text())

    const structured = parseStructuredScript(source, 'input/unicode-boundaries.md', {
      sourceIdentity: fixtureSourceIdentity('unicode-boundaries'),
      locationCatalog: testLocationCatalog,
      characterCatalog: testCharacterCatalog,
    })

    expect(structured).toEqual(expected)
    expect(() => validateStructuredScriptSourceSpans(structured, source)).not.toThrow()
  })

  test('structured parser preserves source spans for adjacent bold fragments and following blocks', () => {
    const source = [
      '# Episode Test',
      '',
      '## Scene: "Adjacent Bold Fragments"',
      '',
      '**INT. CARGO BAY - MORNING**',
      '',
      '**TEXT ON SCREEN** **“Previously…”**',
      '',
      '_A rapid montage fills the screen._',
      '',
      '**SMASH CUT TO BLACK.**',
      '',
      '**TITLE CARD: “THE END”**',
    ].join('\n')
    const structured = parseScriptMarkdownToStructuredData(source, 'input/test-adjacent-bold-fragments.md')

    expect(structured.beats.map(beat => beat.text)).toEqual([
      'TEXT ON SCREEN',
      '“Previously…”',
      'A rapid montage fills the screen.',
      'SMASH CUT TO BLACK.',
      'TITLE CARD: “THE END”',
    ])
    expect(structured.beats.every(beat => beat.sourceSpans.length > 0)).toBe(true)
    expect(() => validateStructuredScriptSourceSpans(structured, source)).not.toThrow()
  })

  test('structured parser maps GUIDE script labels and mentions to the HR Hologram reference', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**STARSHIP HORIZON**',
      '',
      '---',
      '',
      '## Hologram Check',
      '',
      '**INT. STARSHIP HORIZON – FABRICATION BAY**',
      '',
      'GUIDE’s interface flickers rapidly on the wall panel.',
      '',
      '**GUIDE (V.O.)**',
      'I am only mostly broken.',
    ].join('\n'), 'input/test-guide-alias.md')

    const narrationBeat = structured.beats.find(beat => beat.text.includes('interface flickers'))
    const dialogueBeat = structured.beats.find(beat => beat.text === 'I am only mostly broken.')

    expect(structured.characterKeys).toContain('virtual-guide')
    expect(narrationBeat?.characterKeys).toEqual(['virtual-guide'])
    expect(narrationBeat?.rawMentions).toEqual([{
      raw: 'GUIDE',
      characterKeys: ['virtual-guide'],
    }])
    expect(dialogueBeat?.speakerKey).toBe('virtual-guide')
    expect(dialogueBeat?.speakerLabel).toBe('GUIDE (V.O.)')
  })

  test('structured parser treats lowercase action after a character label as direction', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**STARSHIP HORIZON**',
      '',
      '---',
      '',
      '## Scene: "Action Label"',
      '',
      '**INT. STONE CELL - LATE NIGHT**',
      '',
      '**ENGINEER**',
      'walks up to the inside of the cell door. There, embedded just beside it, is a small **metallic horn**.',
      '',
      '**ENGINEER**',
      'Alright. Who here thinks they can scream like a prophet?',
      '',
      '**PILOT**',
      '(softly)',
      'no it is not like that.',
    ].join('\n'), 'input/test-action-label.md')

    const actionBeat = structured.beats.find(beat => beat.text.includes('metallic horn'))
    const dialogueBeat = structured.beats.find(beat => beat.text.startsWith('Alright.'))
    const lowercaseDialogueBeat = structured.beats.find(beat => beat.text.startsWith('no it'))
    const actionSegment = structured.sourceSegments.find(segment => segment.text.includes('metallic horn'))

    expect(actionBeat?.type).toBe('direction')
    expect(actionBeat?.characterKeys).toContain('engineer')
    expect(actionBeat?.speakerKey).toBeUndefined()
    expect(actionBeat?.speakerLabel).toBeUndefined()
    expect(actionSegment?.type).toBe('direction')
    expect(actionSegment?.speakerLabel).toBeUndefined()
    expect(dialogueBeat?.type).toBe('dialogue')
    expect(dialogueBeat?.speakerKey).toBe('engineer')
    expect(dialogueBeat?.speakerLabel).toBe('ENGINEER')
    expect(lowercaseDialogueBeat?.type).toBe('dialogue')
    expect(lowercaseDialogueBeat?.speakerKey).toBe('pilot')
    expect(lowercaseDialogueBeat?.delivery).toBe('softly')
  })

  test('structured parser keeps exact spans after a speaker-associated direction', () => {
    const source = [
      '# Episode Test',
      '',
      '**STARSHIP HORIZON**',
      '',
      '---',
      '',
      '## Scene: "Repeated Speaker"',
      '',
      '**INT. CARGO BAY - MORNING**',
      '',
      '**CAPTAIN**',
      '',
      'First line.',
      '',
      '(the room goes quiet)',
      '',
      'Second line.',
      '',
      '_The engineer crosses the room._',
      '',
      '**CAPTAIN**',
      '',
      'Third line.',
    ].join('\n')
    const structured = parseScriptMarkdownToStructuredData(source, 'input/test-repeated-speaker.md')

    expect(() => validateStructuredScriptSourceSpans(structured, source)).not.toThrow()
    expect(structured.beats.every(beat => beat.sourceSpans.length > 0)).toBe(true)
    expect(structured.beats.find(beat => beat.text === 'the room goes quiet')?.sourceSpans[0]?.text).toContain('the room goes quiet')
    expect(structured.beats.find(beat => beat.text === 'The engineer crosses the room.')?.sourceSpans[0]?.text).toContain('The engineer crosses the room.')
  })

  test('structured parser strips screenplay timing notation from spoken dialogue', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**STARSHIP HORIZON**',
      '',
      '---',
      '',
      '## Scene: "Timing Notation"',
      '',
      '**INT. CARGO BAY - MORNING**',
      '',
      '**CAPTAIN**',
      'Respectfully, sir, that doesn’t matter. (beat) We have five cycles.',
      '',
      '**ENGINEER**',
      '(pause)',
      'Hire a doctor?',
      '',
      '**COMMANDER**',
      'Something strong. (a long pause) Something hot.',
      '',
      '**PILOT**',
      '(beat, checking)',
      'Seven. Go now.',
      '',
      '**CAPTAIN**',
      'Too much energy? (beat, quietly indignant) They were not supposed to melt.',
    ].join('\n'), 'input/test-timing-notation.md')

    const captainBeat = structured.beats.find(beat => beat.speakerKey === 'captain')
    const engineerBeat = structured.beats.find(beat => beat.speakerKey === 'engineer')
    const commanderBeat = structured.beats.find(beat => beat.speakerKey === 'commander')
    const pilotBeat = structured.beats.find(beat => beat.speakerKey === 'pilot')
    const captainBeats = structured.beats.filter(beat => beat.speakerKey === 'captain')
    const inlineCaptainBeat = captainBeats.find(beat => beat.text.startsWith('Too much energy'))

    expect(captainBeat?.text).toBe('Respectfully, sir, that doesn’t matter. We have five cycles.')
    expect(commanderBeat?.text).toBe('Something strong. Something hot.')
    expect(engineerBeat?.text).toBe('Hire a doctor?')
    expect(engineerBeat?.delivery).toBeUndefined()
    expect(pilotBeat?.delivery).toBe('checking')
    expect(inlineCaptainBeat?.text).toBe('Too much energy? They were not supposed to melt.')
    expect(inlineCaptainBeat?.delivery).toBe('quietly indignant')
    expect(structured.sourceSegments.some(segment => segment.text.includes('beat'))).toBe(false)
    const inlineSegment = structured.sourceSegments.find(segment => segment.text.startsWith('Too much energy'))
    expect(inlineSegment?.sourceSpans.filter(span => span.kind === 'spoken-text')).toHaveLength(2)
    expect(inlineSegment?.sourceSpans.filter(span => span.kind === 'timing')).toHaveLength(1)
  })

  test('structured parser classifies action prose as unlettered direction and captions as narration', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**STARSHIP HORIZON**',
      '',
      '---',
      '',
      '## Scene: "Staging Versus Caption"',
      '',
      '**INT. CARGO BAY - MORNING**',
      '',
      '*Silence again. Everyone stares at the floor, like it might offer a solution.*',
      '',
      '*Then—*',
      '',
      '**CAPTION**',
      'Three cycles later.',
      '',
      '**PILOT**',
      'What about GUIDE?',
    ].join('\n'), 'input/test-staging-caption.md')

    const silenceBeat = structured.beats.find(beat => beat.text.startsWith('Silence again'))
    const thenBeat = structured.beats.find(beat => beat.text.startsWith('Then'))
    const captionBeat = structured.beats.find(beat => beat.text.startsWith('Three cycles'))

    expect(silenceBeat?.type).toBe('direction')
    expect(thenBeat?.type).toBe('direction')
    expect(silenceBeat?.text).toBe('Silence again. Everyone stares at the floor, like it might offer a solution.')
    expect(thenBeat?.text).toBe('Then—')
    expect(captionBeat?.type).toBe('narration')
    expect(captionBeat?.speakerLabel).toBe('CAPTION')
  })

  test('panel prompt marks staging segments as never lettered and dialogue as verbatim', () => {
    const markdown = formatSourceSegmentsMarkdown([
      {
        id: 'beat-0033',
        type: 'dialogue',
        text: 'Also too expensive.',
        sourceSpans: [],
        beatIndex: 33,
        speakerKey: 'captain',
        speakerLabel: 'CAPTAIN',
        location: testLocation,
      },
      {
        id: 'beat-0034',
        type: 'direction',
        text: 'Silence again. Everyone stares at the floor.',
        sourceSpans: [],
        beatIndex: 34,
        location: testLocation,
      },
      {
        id: 'beat-0035',
        type: 'narration',
        text: 'Three cycles later.',
        sourceSpans: [],
        beatIndex: 35,
        speakerLabel: 'CAPTION',
        location: testLocation,
      },
    ])

    expect(markdown).toContain('Lettering: Spoken line. Letter this text verbatim in a speech balloon.')
    expect(markdown).toContain('Lettering: Staging direction. Draw what it describes. Never letter any of this text in the image.')
    expect(markdown).toContain('Lettering: Authored caption. Letter this text verbatim in a caption box.')
  })

  test('structured parser keeps compound speaker labels as dialogue', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**STARSHIP HORIZON**',
      '',
      '---',
      '',
      '## Scene: "Compound Speaker"',
      '',
      '**EXT. CLEARING - DAY**',
      '',
      '**PILOT AND NAVIGATOR**',
      '(in unison, not looking up)',
      'Almost done!',
    ].join('\n'), 'input/test-compound-speaker.md')

    const beat = structured.beats.find(entry => entry.text === 'Almost done!')
    const segment = structured.sourceSegments.find(entry => entry.text === 'Almost done!')

    expect(beat?.type).toBe('dialogue')
    expect(beat?.speakerKey).toBeUndefined()
    expect(beat?.speakerLabel).toBe('PILOT AND NAVIGATOR')
    expect(beat?.characterKeys).toEqual(['pilot', 'navigator'])
    expect(beat?.delivery).toBe('in unison, not looking up')
    expect(segment?.type).toBe('dialogue')
    expect(segment?.speakerLabel).toBe('PILOT AND NAVIGATOR')
  })

  test('structured parser keeps uncatalogued spoken labels as dialogue without inventing characters', () => {
    const structured = parseScriptMarkdownToStructuredData([
      '# Episode Test',
      '',
      '**STARSHIP HORIZON**',
      '',
      '---',
      '',
      '## Scene: "Radio Speaker"',
      '',
      '**INT. SHUTTLE BAY - IN FLIGHT**',
      '',
      '**RADIO V.O.**',
      'And now those bozos in the URP lower parliament are asking for more funds for...',
    ].join('\n'), 'input/test-radio-speaker.md')

    const beat = structured.beats.find(entry => entry.text.startsWith('And now those bozos'))
    const segment = structured.sourceSegments.find(entry => entry.text.startsWith('And now those bozos'))

    expect(beat?.type).toBe('dialogue')
    expect(beat?.speakerKey).toBeUndefined()
    expect(beat?.speakerLabel).toBe('RADIO V.O.')
    expect(beat?.characterKeys).toEqual([])
    expect(segment?.type).toBe('dialogue')
    expect(segment?.speakerLabel).toBe('RADIO V.O.')
  })

  test('an italicised delivery parenthetical stays a delivery and does not consume the spoken line', () => {
    const script = [
      '# Episode Test',
      '',
      '## Scene 1 - "Emphasis"',
      '',
      '**INT. CARGO BAY - MORNING**',
      '',
      '**CAPTAIN**',
      '',
      '_(beat)_',
      '',
      'We can. But it is everyone.',
      '',
      '**ENGINEER**',
      '',
      '_(already standing, delighted)_',
      '',
      'Then everyone it is.',
      '',
      '**PILOT**',
      '',
      '*(quietly)*',
      '',
      'Stations.',
      '',
    ].join('\n')

    const parsed = parseScriptMarkdownToStructuredData(script, 'input/emphasis-delivery.md')
    const dialogue = parsed.beats.filter(beat => beat.type === 'dialogue')

    expect(dialogue.map(beat => beat.text)).toEqual([
      'We can. But it is everyone.',
      'Then everyone it is.',
      'Stations.',
    ])
    expect(dialogue.map(beat => beat.speakerLabel)).toEqual(['CAPTAIN', 'ENGINEER', 'PILOT'])
    expect(dialogue[0]!.delivery).toBeUndefined()
    expect(dialogue[1]!.delivery).toBe('already standing, delighted')
    expect(dialogue[2]!.delivery).toBe('quietly')
    expect(parsed.beats.some(beat => beat.text.trim() === '')).toBe(false)
    expect(() => validateStructuredScriptSourceSpans(parsed, script)).not.toThrow()
  })
})

describe('retired staging directive labels', () => {
  const sceneLines = (body: string[]): string => ['# Episode Nine', '', '## Scene: "Probe"', '', '**INT. CARGO BAY - NIGHT**', '', ...body, ''].join('\n')
  const parseError = (content: string, path = 'input/02-script/legacy-staging.md'): string => {
    try {
      parseScriptMarkdownToStructuredData(content, path)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
    throw new Error('expected the legacy staging script to be rejected')
  }

  test('lists exactly the six retired labels', () => {
    expect([...RETIRED_STAGING_LABELS]).toEqual(['BLOCKING', 'CAMERA', 'BREAK-180', 'COSTUME', 'EXTRAS', 'SKIP-PANELS'])
  })

  for (const label of RETIRED_STAGING_LABELS) {
    test(`rejects **${label}:** with file:line in inline, bold, separate-body and after-speaker forms`, () => {
      // Line 7 is the first body line after the six-line header in sceneLines.
      const forms: Array<{ name: string; body: string[]; line: number }> = [
        { name: 'inline', body: [`**${label}:** {panel: 1} Low and wide.`], line: 7 },
        { name: 'bold', body: [`**${label}: {panel: 1} Low and wide.**`], line: 7 },
        { name: 'separate-body', body: [`**${label}:**`, '', '{panel: 1} Low and wide.'], line: 7 },
        { name: 'lowercase inline', body: [`**${label.toLowerCase()}:** Low and wide.`], line: 7 },
        { name: 'inline after a speaker', body: ['**CAPTAIN**', '', `**${label}:** Tight on the captain.`, '', 'Listen up.'], line: 9 },
        { name: 'separate-body after a speaker', body: ['**CAPTAIN**', '', `**${label}:**`, '', 'Tight on the captain.', '', 'Listen up.'], line: 9 },
      ]
      for (const form of forms) {
        const message = parseError(sceneLines(form.body))
        expect(message, form.name).toContain('legacy-staging.md:' + form.line + ' **' + label + ':**')
        expect(message, form.name).toContain('retired staging directive')
        expect(message, form.name).toContain('draft-scenes --only prepare')
      }
    })
  }

  test('reports every occurrence in source order with its own line', () => {
    const message = parseError(sceneLines(['**BLOCKING:**', '', 'Everyone waits.', '', '**CAPTAIN**', '', 'Listen.', '', '**SKIP-PANELS: {reason: recap}**']))
    expect(message).toContain('uses retired staging directives')
    const listed = message.split('\n').filter(line => line.startsWith('- '))
    expect(listed).toEqual([
      '- legacy-staging.md:7 **BLOCKING:** "**BLOCKING:**"',
      '- legacy-staging.md:15 **SKIP-PANELS:** "**SKIP-PANELS: {reason: recap}**"',
    ])
  })

  test('a label without a colon, a bracket note and prose mentions are not retired directives', () => {
    const parsed = parseScriptMarkdownToStructuredData(sceneLines(['[CAMERA: a bracket note stays a panel note.]', '', 'The camera crew sets up the blocking for the scene.']), 'input/legacy-staging.md')
    expect(parsed.beats.map(beat => [beat.type, beat.text])).toEqual([
      ['panel-note', 'CAMERA: a bracket note stays a panel note.'],
      ['direction', 'The camera crew sets up the blocking for the scene.'],
    ])
    expect(parsed).not.toHaveProperty('staging')
  })

  test('soundscape directives and panel notes still parse beside speech', () => {
    const content = sceneLines(['[Panel 1: The captain at the door.]', '', '**SFX:** door hiss', '', '**CAPTAIN**', '', 'Everyone, listen up.', '', '**AMBIENCE:** engine hum', '', '[Panel 2: The engineer answers.]', '', '**ENGINEER**', '', 'We are listening.'])
    const parsed = parseScriptMarkdownToStructuredData(content, 'input/legacy-staging.md')
    expect(parsed.beats.map(beat => [beat.type, beat.text, beat.speakerLabel ?? null])).toEqual([
      ['panel-note', 'Panel 1: The captain at the door.', null],
      ['dialogue', 'Everyone, listen up.', 'CAPTAIN'],
      ['panel-note', 'Panel 2: The engineer answers.', null],
      ['dialogue', 'We are listening.', 'ENGINEER'],
    ])
    expect(parsed.scene.soundscape.cues.map(cue => cue.prompt)).toEqual(['door hiss'])
    expect(parsed.scene.soundscape.ambientBeds.map(bed => bed.prompt)).toEqual(['engine hum'])
    expect(() => validateStructuredScriptSourceSpans(parsed, content)).not.toThrow()
  })

  test('migrating each directive in place to a panel note or prose preserves speech and source ordering', () => {
    const plain = sceneLines(['**CAPTAIN**', '', 'Everyone, listen up.', '', '**ENGINEER**', '', 'We are listening.'])
    const legacy = sceneLines(['**BLOCKING:**', '', 'The crew gathers.', '', '**CAPTAIN**', '', '**CAMERA:** Tight on the captain.', '', 'Everyone, listen up.', '', '**ENGINEER**', '', 'We are listening.'])
    expect(parseError(legacy)).toContain('legacy-staging.md:7 **BLOCKING:**')
    const migrated = sceneLines(['The crew gathers.', '', '**CAPTAIN**', '', '_(tight on the captain)_', '', 'Everyone, listen up.', '', '[Panel note: tight on the engineer.]', '', '**ENGINEER**', '', 'We are listening.'])
    const plainParsed = parseScriptMarkdownToStructuredData(plain, 'input/legacy-staging.md')
    const migratedParsed = parseScriptMarkdownToStructuredData(migrated, 'input/legacy-staging.md')
    const speech = (parsed: typeof plainParsed) => parsed.beats.filter(beat => beat.type === 'dialogue').map(beat => [beat.speakerLabel, beat.text])
    expect(speech(migratedParsed)).toEqual(speech(plainParsed))
    expect(migratedParsed.sourceSegments.map(segment => [segment.type, segment.text])).toEqual([
      ['direction', 'The crew gathers.'],
      ['dialogue', 'Everyone, listen up.'],
      ['panel-note', 'Panel note: tight on the engineer.'],
      ['dialogue', 'We are listening.'],
    ])
    expect(() => validateStructuredScriptSourceSpans(migratedParsed, migrated)).not.toThrow()
  })
})
