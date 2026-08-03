import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  getDraftPromptPath,
  getPanelPromptsDirectory,
  getSceneOutputDirectory,
  getStructuredScriptPath,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { parseScriptMarkdownToStructuredData as parseStructuredScript } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/structured-script-parser'
import { generateJsonPrompt } from '~/cli/commands/process-steps/step-8-comic/comic-utils/json-prompt-utils'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import {
  isRecapMontageBeat,
  resolvePreviousEpisodeScriptsDirectory,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/recap-montage-utils'
import {
  assertSourceCoverageReportComplete,
  formatSourceSegmentsMarkdown,
  validateSceneSourceSegmentCoverage,
  verifySourceSegmentCoverageInPromptFiles,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/source-coverage-utils'
import { writeGeneratedImage } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/image-writer'
import { combineCharacterSketchSheet } from '~/cli/commands/process-steps/step-8-comic/comic-commands/character-sketch/character-sketch-sheet'
import { composeComicGridPage } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-grid-composer'
import { generateComicGridPages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-comic-grid-pages'
import { CHARACTER_SKETCH_VIEWS } from '~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils'
import type {
  BunImageMetadataReader,
  ComicBunImageCodec,
  ScenePromptData,
  StructuredScriptData,
  StructuredScriptSourceSegment,
  CharacterCatalogService,
} from '~/types'
import { pngSignature, redDotPng } from '../../../test-utils/media-fixtures'

const comicSourceRoot = 'src/cli/commands/process-steps/step-8-comic'
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
const testLocation = { key: 'cargo-bay', raw: 'INT. CARGO BAY - MORNING', type: 'INT', place: 'CARGO BAY - MORNING' }

const getBunImageCodec = (): new (source: Uint8Array) => ComicBunImageCodec => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: Uint8Array) => ComicBunImageCodec }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for image writer contracts')
  }
  return imageConstructor
}

const getBunImageMetadataReader = (): new (source: ArrayBuffer) => BunImageMetadataReader => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: ArrayBuffer) => BunImageMetadataReader }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for image metadata contracts')
  }
  return imageConstructor
}

const collectTypeScriptFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return await collectTypeScriptFiles(fullPath)
    }
    return entry.isFile() && fullPath.endsWith('.ts') ? [fullPath] : []
  }))
  return nested.flat()
}

const sampleSourceSegments: StructuredScriptSourceSegment[] = [
  {
    id: 'beat-0001',
    type: 'narration',
    text: 'The screen is black. A machine wakes up.',
    beatIndex: 1,
    location: testLocation,
  },
  {
    id: 'beat-0002',
    type: 'dialogue',
    text: 'C’mon man, wake up, your vacation doesn’t start until tomorrow.',
    beatIndex: 2,
    speakerKey: 'engineer',
    speakerLabel: 'ENGINEER',
    delivery: 'chuckling',
    location: testLocation,
  },
]

const buildSceneData = (sourceSegmentIds: string[]): ScenePromptData => ({
  schemaVersion: 2,
  title: 'Coverage Test',
  location: 'STARSHIP HORIZON',
  panels: [{
    number: 1,
    description: 'Mechanic works through a quiet ship corridor.',
    characterKeys: [],
    speech: [],
    sourceSegmentIds,
  }],
})

describe('comic source coverage contracts', () => {
  test('comic source does not import OpenAI or Gemini SDK packages', async () => {
    const files = await collectTypeScriptFiles(comicSourceRoot)

    for (const file of files) {
      const source = await Bun.file(file).text()
      expect(source).not.toMatch(/from ['"](?:openai|openai\/|@google\/genai)/)
      expect(source).not.toMatch(/import\s+OpenAI\s+from ['"]openai/)
      expect(source).not.toMatch(/GoogleGenAI/)
      expect(source).not.toMatch(/(?:from|import)\s*\(?['"]sharp/)
    }
  })

  test('generated WebP and JPEG images are normalized to PNG with Bun.Image', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-comic-image-writer-'))
    const Image = getBunImageCodec()
    const encodedImages: Array<{ mimeType: string; bytes: Uint8Array; name: string }> = [
      { mimeType: 'image/webp', bytes: await new Image(redDotPng).webp().bytes(), name: 'webp' },
      { mimeType: 'image/jpeg', bytes: await new Image(redDotPng).jpeg().bytes(), name: 'jpeg' },
    ]

    try {
      for (const encoded of encodedImages) {
        const outputPath = join(dir, `${encoded.name}.png`)
        await writeGeneratedImage(outputPath, Buffer.from(encoded.bytes).toString('base64'), encoded.mimeType)
        const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())

        expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('character sketch sheet composition uses ImageMagick without sharp', async () => {
    if (!Bun.which('magick') && !Bun.which('convert')) {
      throw new Error('ImageMagick magick or convert is required for sketch sheet composition coverage')
    }

    const dir = await mkdtemp(join(tmpdir(), 'autoshow-comic-sketch-sheet-'))

    try {
      const sources = await Promise.all(CHARACTER_SKETCH_VIEWS.map(async (view) => {
        const path = join(dir, `${view}.png`)
        await writeFile(path, redDotPng)
        return { view, path }
      }))
      const outputPath = join(dir, 'sheet.png')
      const dimensions = await combineCharacterSketchSheet({
        outputPath,
        sources,
      })
      const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())

      expect(dimensions).toEqual({ width: 3, height: 1 })
      expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('comic grid composition uses ImageMagick and leaves partial cells blank', async () => {
    if (!Bun.which('magick') && !Bun.which('convert')) {
      throw new Error('ImageMagick magick or convert is required for comic grid composition coverage')
    }

    const dir = await mkdtemp(join(tmpdir(), 'autoshow-comic-grid-page-'))

    try {
      const sources = await Promise.all([1, 2, 3].map(async (panelNumber) => {
        const path = join(dir, `panel-${panelNumber}.png`)
        await writeFile(path, redDotPng)
        return path
      }))
      const outputPath = join(dir, 'page.png')
      const dimensions = await composeComicGridPage({
        sources,
        outputPath,
        grid: { columns: 2, rows: 2 },
        cellSize: { width: 1, height: 1 },
      })
      const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())
      const Image = getBunImageMetadataReader()
      const metadata = await new Image(await Bun.file(outputPath).arrayBuffer()).metadata()

      expect(dimensions).toEqual({ width: 2, height: 2 })
      expect(metadata.width).toBe(2)
      expect(metadata.height).toBe(2)
      expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('comic grid generation reports missing panel PNG paths before composition', async () => {
    const sceneSlug = `grid-missing-${Date.now()}`
    const sceneRoot = getSceneOutputDirectory(sceneSlug)
    const expectedPanelPath = join(sceneRoot, 'panels', 'test-run', 'panel-01.png')

    try {
      await mkdir(join(getPanelPromptsDirectory(sceneSlug), 'panel-01'), { recursive: true })

      await expect(generateComicGridPages(sceneSlug, {
        models: ['gpt-image-2'],
        force: false,
        runId: 'test-run',
        concurrency: 1,
        panels: 'all',
        grid: { columns: 2, rows: 3 },
      }, {
        composeGridPage: async () => {
          throw new Error('compose should not run without panel PNGs')
        },
      })).rejects.toThrow(expectedPanelPath)
    } finally {
      await rm(sceneRoot, { recursive: true, force: true })
    }
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
    ].join('\n'), 'input/test-timing-notation.md')

    const captainBeat = structured.beats.find(beat => beat.speakerKey === 'captain')
    const engineerBeat = structured.beats.find(beat => beat.speakerKey === 'engineer')
    const commanderBeat = structured.beats.find(beat => beat.speakerKey === 'commander')

    expect(captainBeat?.text).toBe('Respectfully, sir, that doesn’t matter. We have five cycles.')
    expect(commanderBeat?.text).toBe('Something strong. Something hot.')
    // "(pause)" is pacing, not an acting note, so it must not become a speech tone.
    expect(engineerBeat?.text).toBe('Hire a doctor?')
    expect(engineerBeat?.delivery).toBeUndefined()
    expect(structured.sourceSegments.some(segment => segment.text.includes('beat'))).toBe(false)
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
    // Emphasis markers are markdown, not staging text, and must not reach image prompts.
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
        beatIndex: 33,
        speakerKey: 'captain',
        speakerLabel: 'CAPTAIN',
        location: testLocation,
      },
      {
        id: 'beat-0034',
        type: 'direction',
        text: 'Silence again. Everyone stares at the floor.',
        beatIndex: 34,
        location: testLocation,
      },
      {
        id: 'beat-0035',
        type: 'narration',
        text: 'Three cycles later.',
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

  test('recap montage resolver maps Episode 4 scripts to Episode 3 scripts', () => {
    expect(resolvePreviousEpisodeScriptsDirectory('input/example/scripts/04-script/01-recap.md'))
      .toBe(join('input', 'example', 'scripts', '03-script'))
  })

  test('recap montage cue detection requires both episode and montage in the same beat', () => {
    expect(isRecapMontageBeat({
      text: 'Cue a rapid montage of Episode 3, every scene sped up.',
    })).toBe(true)

    expect(isRecapMontageBeat({
      text: 'Cue a rapid montage of prior chaos.',
    })).toBe(false)

    expect(isRecapMontageBeat({
      text: 'Episode 3 ended badly for everyone.',
    })).toBe(false)
  })

  test('scene source segment coverage validation rejects missing and unknown IDs', () => {
    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001', 'beat-0002']),
      sampleSourceSegments,
    )).not.toThrow()

    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001']),
      sampleSourceSegments,
    )).toThrow(/missing 1 source segment.*beat-0002/)

    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001', 'beat-9999']),
      sampleSourceSegments,
    )).toThrow(/unknown source segment ID.*beat-9999/)
  })

  test('draft prompt includes an explicit source segment ID checklist', async () => {
    const sceneSlug = `comic-source-checklist-${Date.now()}`
    const sceneOutputDirectory = getSceneOutputDirectory(sceneSlug)
    const charactersRoot = await mkdtemp(join(tmpdir(), 'autoshow-source-checklist-characters-'))
    await writeFile(join(charactersRoot, 'guide.png'), redDotPng)
    await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({
      schemaVersion: 3,
      characters: [{
        key: 'guide', name: 'Guide', aliases: ['GUIDE'], image: 'guide.png', outlineSheet: 'guide.png',
        description: 'A free-standing blue hologram above a small projector base; never inside a screen.',
        sceneTextRules: [
          { kind: 'required', pattern: '\\bhologram\\b', description: 'Every Guide panel must identify him as a hologram.' },
          { kind: 'forbidden', pattern: '\\bguide\\b.{0,80}\\bon\\b.{0,40}\\bscreen\\b', description: 'Guide must never appear on a screen.' },
        ],
      }],
      groupAliases: [],
    }))
    configureCharactersRoot(charactersRoot)
    const structuredScript: StructuredScriptData = {
      schemaVersion: 3,
      scriptSlug: sceneSlug,
      sourceFile: 'input/test.md',
      document: {
        heading: 'Episode Test',
        title: 'Episode Test',
        metadata: [{ label: 'STARSHIP HORIZON', raw: 'STARSHIP HORIZON' }],
      },
      scene: {
        heading: 'COLD OPEN: "Coverage Test"',
        section: 'COLD OPEN',
        title: 'Coverage Test',
        location: { key: 'cargo-bay', raw: 'STARSHIP HORIZON' },
      },
      characterKeys: [],
      beats: [],
      sourceSegments: sampleSourceSegments,
    }

    try {
      await mkdir(sceneOutputDirectory, { recursive: true })
      await writeFile(getStructuredScriptPath(sceneSlug), JSON.stringify(structuredScript, null, 2))

      await generateJsonPrompt(sceneSlug)

      const prompt = await Bun.file(getDraftPromptPath(sceneSlug)).text()
      expect(prompt).toContain('## Required Source Segment ID Checklist')
      expect(prompt).toContain('- beat-0001 (narration, beat 1): The screen is black. A machine wakes up.')
      expect(prompt).toContain('- beat-0002 (dialogue, beat 2): C’mon man, wake up')
      expect(prompt).toContain('verify that every exact ID below appears in at least one panel')
      expect(prompt).toContain('no arbitrary per-panel cast-count ceiling')
      expect(prompt).not.toContain('no more than five unique keys per panel')
      expect(prompt).toContain('Canonical character canon is non-negotiable and has highest visual precedence')
      expect(prompt).toContain('"characterKeys": ["guide"]')
      expect(prompt).toContain('"characterKey": "guide"')
      expect(prompt).toContain('guide: A free-standing blue hologram above a small projector base')
      expect(prompt).toContain('REQUIRED: Every Guide panel must identify him as a hologram.')
      expect(prompt).toContain('FORBIDDEN: Guide must never appear on a screen.')
    } finally {
      configureCharactersRoot('input/characters')
      await rm(sceneOutputDirectory, { recursive: true, force: true })
      await rm(charactersRoot, { recursive: true, force: true })
    }
  })

  test('prompt coverage verifier fails when a source segment is omitted', () => {
    const report = verifySourceSegmentCoverageInPromptFiles(sampleSourceSegments, [{
      path: 'panel-01.md',
      content: formatSourceSegmentsMarkdown([sampleSourceSegments[0]!]),
    }])

    expect(report.complete).toBe(false)
    expect(report.missingSegments.map(segment => segment.id)).toEqual(['beat-0002'])
    expect(() => assertSourceCoverageReportComplete(report)).toThrow(/beat-0002/)
  })
})
