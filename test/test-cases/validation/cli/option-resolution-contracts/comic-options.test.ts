import { describe, expect, test } from 'bun:test'
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildComicPagePrompt,
  buildComicPagePromptData,
  chunkComicGridPanels,
  chunkComicPagePanels,
  DEFAULT_PANELS_PER_IMAGE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  parseComicGridSpec,
  panelSelectionToSketchRange,
  parsePanelSelector,
  selectComicPanels
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import { applyImagePromptVariation } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/prompt-variations'
import {
  buildSketchPrompt,
  resolveSketchChunks,
  selectSketchPanelRange
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-sketches/generate-scene-sketches'
import { DEFAULT_LLM_MODEL, parseCharacterSketchArgs, parseDraftScenesArgs, parseGenerateImagesArgs, parseReferenceSketchArgs } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import {
  characterSketchFlags,
  draftScenesFlags,
  generateImagesFlags,
  referenceSketchFlags
} from '~/cli/flags/comic-flags'
import type { CliFlagsDefinition } from '~/types'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import {
  getPageComicImageFilename,
  getPageComicImagePath,
  getPanelComicImagePath
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-utils'
import {
  getSceneOutputDirectory,
  resolveComicScriptReference
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import type { PanelBundleData, PromptsConfig } from '~/types'

describe('option resolution contracts', () => {
  test('comic scene drafting defaults to gpt-5.6-sol', () => {
    expect(DEFAULT_LLM_MODEL).toBe('gpt-5.6-sol')
  })

  test('comic reference-sketch requires exactly one reference mode', () => {
    expect(parseReferenceSketchArgs(['--location', 'cargo-bay']).location).toBe('cargo-bay')
    expect(parseReferenceSketchArgs(['--character', 'engineer']).character).toBe('engineer')
    expect(() => parseReferenceSketchArgs([])).toThrow('Exactly one')
    expect(() => parseReferenceSketchArgs(['--character', 'engineer', '--location', 'cargo-bay'])).toThrow('Exactly one')
  })
  test('comic final images default to one panel while sketch chunks remain six', () => {
    expect(DEFAULT_FINAL_PANELS_PER_IMAGE).toBe(1)
    expect(DEFAULT_PANELS_PER_IMAGE).toBe(6)
    const chunks = chunkComicPagePanels(Array.from({ length: 29 }, (_, index) => ({ panelNumber: index + 1 })), DEFAULT_FINAL_PANELS_PER_IMAGE)
    expect(chunks).toHaveLength(29)
    expect(chunks.at(-1)?.panelNumbers).toEqual([29])
    const qa = parseGenerateImagesArgs(['script.md', '--page-qa'])
    expect(qa.qa).toBe(true)
    expect(qa.qaModel).toBe('gpt-5.6-sol')
    expect(parseGenerateImagesArgs(['script.md', '--page-qa-model', 'gpt-5.5']).qaModel).toBe('gpt-5.5')
  })
  test('comic generate-images args parse page image options', () => {
      const opts = parseGenerateImagesArgs([
        'input/episode-scripts/02-script/01-co-work-smarter.md',
        '--image-model', 'gpt-image-2,gemini-3.1-flash-image-preview',
        '--panels', '1-4,9',
        '--panels-per-image', String(DEFAULT_PANELS_PER_IMAGE),
        '--variation', 'animation-polish,cinematic-depth',
        '--size', '1536x1024',
        '--quality', 'high',
        '--force'
      ])

      expect(opts.scriptPath).toBe('input/episode-scripts/02-script/01-co-work-smarter.md')
      expect(opts.imageModels).toEqual(['gpt-image-2', 'gemini-3.1-flash-image-preview'])
      expect(opts.panels).toEqual([1, 2, 3, 4, 9])
      expect(opts.panelsPerImage).toBe(DEFAULT_PANELS_PER_IMAGE)
      expect(opts.variations).toEqual(['animation-polish', 'cinematic-depth'])
      expect(opts.size).toBe('1536x1024')
      expect(opts.quality).toBe('high')
      expect(opts.force).toBe(true)
    })

  test('comic generate-images args parse grid page composition options', () => {
      const opts = parseGenerateImagesArgs([
        'input/episode-scripts/02-script/01-co-work-smarter.md',
        '--target', 'images',
        '--panels', '1-6',
        '--panels-per-image', '1',
        '--grid', '2x3',
        '--size', '1536x1024',
      ])

      expect(opts.grid).toEqual({ columns: 2, rows: 3 })
      expect(opts.panelsPerImage).toBe(1)
    })

  test('comic generate-images grid args reject invalid values and combinations', () => {
      expect(() => parseComicGridSpec('2x3')).not.toThrow()
      expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '0x3'])).toThrow('Invalid grid "0x3"')
      expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '2x3', '--grid', '3x2'])).toThrow('Grid can only be specified once')
      expect(() => parseGenerateImagesArgs(['script.md', '--target', 'sketches', '--panels-per-image', '1', '--grid', '2x3'])).toThrow('--grid only applies when --target is images or both')
      expect(() => parseGenerateImagesArgs(['script.md', '--grid', '2x3'])).toThrow('--grid requires --panels-per-image 1')
      expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '2x3', '--size', '1024x1024'])).toThrow('--grid requires --size 1536x1024')
    })

  test('comic generate-images removed options throw deprecation errors', () => {
      expect(() => parseGenerateImagesArgs(['script.md', '--panel-limit', '3'])).toThrow('--panel-limit was removed')
      expect(() => parseGenerateImagesArgs(['script.md', '--panel', '2'])).toThrow('--panel was removed')
      expect(() => parseGenerateImagesArgs(['script.md', '--chunk', '2'])).toThrow('--chunk was removed')
      expect(() => parseGenerateImagesArgs(['script.md', '--sketch-group-size', '8'])).toThrow('--sketch-group-size was removed')
      expect(() => parseGenerateImagesArgs(['script.md', '--sketch-panels', '1-4'])).toThrow('--sketch-panels was removed')
    })

  test('comic generate-images variation args reject duplicates and unknown values', () => {
      expect(() => parseGenerateImagesArgs(['script.md', '--variation', 'animation-polish,animation-polish'])).toThrow('Duplicate variation "animation-polish" is not allowed')
      expect(() => parseGenerateImagesArgs(['script.md', '--variation', 'unknown'])).toThrow('Invalid variation "unknown"')
    })

  test('comic draft-scenes args parse llm model and panel prompt stage', () => {
      const opts = parseDraftScenesArgs([
        'input/episode-scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--llm-model', 'gpt-5.5',
        '--only', 'panel-prompts',
      ])
      const grokOpts = parseDraftScenesArgs([
        'input/episode-scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--llm-model', 'grok-4.5'
      ])

      // --llm-model now resolves against the central LLM registry instead of a comic-local list.
      expect(findRegistryServiceForModel('llm', 'gpt-5.5')).toBe('openai')
      expect(findRegistryServiceForModel('llm', 'grok-4.5')).toBe('grok')
      expect(opts.scriptPath).toBe('input/episode-scripts/05-script/01-mechanic-goes-on-vacation.md')
      expect(opts.llmModel).toBe('gpt-5.5')
      expect(opts.only).toBe('panel-prompts')
      expect(grokOpts.llmModel).toBe('grok-4.5')
    })

  test('comic generate-images args parse target', () => {
      const opts = parseGenerateImagesArgs([
        'input/episode-scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--target', 'sketches',
        '--panels-per-image', String(DEFAULT_PANELS_PER_IMAGE),
        '--quality', 'high',
      ])

      expect(opts.scriptPath).toBe('input/episode-scripts/05-script/01-mechanic-goes-on-vacation.md')
      expect(opts.target).toBe('sketches')
      expect(opts.panelsPerImage).toBe(DEFAULT_PANELS_PER_IMAGE)
      expect(opts.quality).toBe('high')
      expect(() => parseGenerateImagesArgs(['script.md', '--target', 'prompts'])).toThrow(
        'bun autoshow comic draft-scenes <script-path> --only panel-prompts'
      )
    })

  test('comic generate-images args parse page image options with target', () => {
      const opts = parseGenerateImagesArgs([
        'input/episode-scripts/02-script/01-co-work-smarter.md',
        '--target', 'images',
        '--panels', '1-6',
        '--panels-per-image', String(DEFAULT_PANELS_PER_IMAGE),
        '--image-model', 'gpt-image-2',
        '--size', '1536x1024',
        '--quality', 'high',
        '--force'
      ])

      expect(opts.scriptPath).toBe('input/episode-scripts/02-script/01-co-work-smarter.md')
      expect(opts.target).toBe('images')
      expect(opts.panels).toEqual([1, 2, 3, 4, 5, 6])
      expect(opts.panelsPerImage).toBe(DEFAULT_PANELS_PER_IMAGE)
      expect(opts.imageModels).toEqual(['gpt-image-2'])
      expect(opts.size).toBe('1536x1024')
      expect(opts.quality).toBe('high')
      expect(opts.force).toBe(true)
    })

  test('comic script shorthand resolves only strict NN-SC references', async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-comic-script-ref-'))
      const episodeDir = join(tempDir, '02-script')
      const fullPath = 'input/episode-scripts/02-script/01-co-work-smarter.md'

      try {
        await mkdir(episodeDir, { recursive: true })
        await writeFile(join(episodeDir, '01-co-work-smarter.md'), '# Co-Work Smarter\n')

        expect(parseDraftScenesArgs(['02-01']).scriptPath).toBe('02-01')
        expect(parseGenerateImagesArgs(['02-01']).scriptPath).toBe('02-01')
        await expect(resolveComicScriptReference('02-01', { episodeScriptsRoot: tempDir }))
          .resolves.toBe(join(episodeDir, '01-co-work-smarter.md'))
        await expect(resolveComicScriptReference(fullPath, { episodeScriptsRoot: tempDir }))
          .resolves.toBe(fullPath)
        await expect(resolveComicScriptReference('2-1', { episodeScriptsRoot: tempDir }))
          .resolves.toBe('2-1')
        await expect(resolveComicScriptReference('02-02', { episodeScriptsRoot: tempDir }))
          .rejects.toThrow('Comic script shorthand "02-02" could not be resolved')

        await writeFile(join(episodeDir, '01-alt.md'), '# Alternate Scene\n')

        await expect(resolveComicScriptReference('02-01', { episodeScriptsRoot: tempDir }))
          .rejects.toThrow('Expected exactly one Markdown file')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('comic panel selectors dedupe, sort, and chunk page groups', () => {
      expect(parsePanelSelector('all')).toBe('all')
      expect(parsePanelSelector('3,1,3,2-4')).toEqual([1, 2, 3, 4])

      const selected = selectComicPanels(
        [1, 2, 3, 4, 5].map(panelNumber => ({ panelNumber })),
        parsePanelSelector('1-4'),
        undefined,
        'ep02/scene'
      )
      const chunks = chunkComicPagePanels(selected, 2)

      expect(selected.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4])
      expect(chunks.map(chunk => ({
        pageNumber: chunk.pageNumber,
        panelNumbers: chunk.panelNumbers
      }))).toEqual([
        { pageNumber: 1, panelNumbers: [1, 2] },
        { pageNumber: 2, panelNumbers: [3, 4] }
      ])
    })

  test('comic grid chunks preserve selected panel order and full grid capacity', () => {
      const grid = { columns: 2, rows: 3 }
      const exact = chunkComicGridPanels(
        Array.from({ length: 6 }, (_, index) => ({ panelNumber: index + 1 })),
        grid
      )
      const fewer = chunkComicGridPanels(
        [1, 2, 3, 4].map(panelNumber => ({ panelNumber })),
        grid
      )
      const more = chunkComicGridPanels(
        Array.from({ length: 8 }, (_, index) => ({ panelNumber: index + 1 })),
        grid
      )
      const nonContiguous = chunkComicGridPanels(
        [1, 3, 7, 9, 11, 13, 15].map(panelNumber => ({ panelNumber })),
        grid
      )

      expect(exact.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4, 5, 6]])
      expect(fewer.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4]])
      expect(more.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4, 5, 6], [7, 8]])
      expect(nonContiguous.map(chunk => ({
        pageNumber: chunk.pageNumber,
        panelNumbers: chunk.panelNumbers,
      }))).toEqual([
        { pageNumber: 1, panelNumbers: [1, 3, 7, 9, 11, 13] },
        { pageNumber: 2, panelNumbers: [15] },
      ])
    })

  test('comic sketch chunks default to six panels per image', () => {
      const panels = Array.from({ length: 13 }, (_, index) => ({ panelNumber: index + 1 }))
      const defaultChunks = resolveSketchChunks(panels, {}, 'ep02/scene')
      const selectedChunks = resolveSketchChunks(
        panels,
        {
          sketchPanels: { startPanelNumber: 1, endPanelNumber: 12 },
          panelsPerImage: DEFAULT_PANELS_PER_IMAGE,
        },
        'ep02/scene'
      )

      expect(defaultChunks.selectedChunks.map(chunk => [
        chunk.startPanelNumber,
        chunk.endPanelNumber
      ])).toEqual([
        [1, 6],
        [7, 12],
        [13, 13],
      ])
      expect(selectedChunks.selectedChunks.map(chunk => [
        chunk.startPanelNumber,
        chunk.endPanelNumber
      ])).toEqual([
        [1, 6],
        [7, 12],
      ])
    })

  test('comic panel selectors clamp overlong contiguous ranges to available overlap', () => {
      const panels = Array.from({ length: 11 }, (_, index) => ({ panelNumber: index + 1 }))

      const selected = selectComicPanels(
        panels,
        parsePanelSelector('9-16'),
        undefined,
        'ep02/scene'
      )
      const sketchChunk = selectSketchPanelRange(
        panels,
        { startPanelNumber: 9, endPanelNumber: 16 },
        'ep02/scene'
      )

      expect(selected.map(panel => panel.panelNumber)).toEqual([9, 10, 11])
      expect(sketchChunk.startPanelNumber).toBe(9)
      expect(sketchChunk.endPanelNumber).toBe(11)
      expect(sketchChunk.panels.map(panel => panel.panelNumber)).toEqual([9, 10, 11])
    })

  test('comic panel selectors reject no-overlap and non-contiguous missing selections', () => {
      const panels = Array.from({ length: 11 }, (_, index) => ({ panelNumber: index + 1 }))
      const gappedPanels = [1, 2, 4, 5].map(panelNumber => ({ panelNumber }))

      expect(() => selectComicPanels(
        panels,
        parsePanelSelector('12-16'),
        undefined,
        'ep02/scene'
      )).toThrow('Selected panels 12, 13, 14, 15, 16 were not found')
      expect(() => selectComicPanels(
        gappedPanels,
        parsePanelSelector('1-5'),
        undefined,
        'ep02/scene'
      )).toThrow('Selected panel 3 was not found')
      expect(() => selectComicPanels(
        panels,
        parsePanelSelector('1,99'),
        undefined,
        'ep02/scene'
      )).toThrow('Selected panel 99 was not found')
      expect(() => selectSketchPanelRange(
        gappedPanels,
        { startPanelNumber: 1, endPanelNumber: 5 },
        'ep02/scene'
      )).toThrow('Sketch panel range "1-5" was not found')
      expect(() => selectSketchPanelRange(
        panels,
        { startPanelNumber: 12, endPanelNumber: 16 },
        'ep02/scene'
      )).toThrow('Sketch panel range "12-16" was not found')
      expect(() => panelSelectionToSketchRange(parsePanelSelector('1,99'))).toThrow(
        'Sketch panel selection must be contiguous'
      )
    })

  test('comic page image filenames preserve contiguous and non-contiguous panel labels', () => {
      expect(getPageComicImageFilename(1, [1, 2, 3, 4])).toBe('page-01-panels-01-04.png')
      expect(getPageComicImageFilename(2, [5, 6, 7, 8])).toBe('page-02-panels-05-08.png')
      expect(getPageComicImageFilename(1, [1, 3, 7])).toBe('page-01-panels-01_03_07.png')
    })

  test('comic final image paths nest under the resolved run directory; variations add prefixes', () => {
      const base = getSceneOutputDirectory('scene-one')
      expect(getPanelComicImagePath('scene-one', 1)).toBe(join(base, 'panels', 'panel-01.png'))
      expect(getPanelComicImagePath('scene-one', 1, 'gpt-image-2')).toBe(join(base, 'panels', 'gpt-image-2', 'panel-01.png'))
      expect(getPanelComicImagePath('scene-one', 1, 'gpt-image-2', 'animation-polish')).toBe(join(base, 'panels', 'animation-polish', 'gpt-image-2', 'panel-01.png'))
      expect(getPageComicImagePath('scene-one', 1, [1, 2], 'gpt-image-2', 'cinematic-depth')).toBe(join(base, 'pages', 'cinematic-depth', 'gpt-image-2', 'page-01-panels-01-02.png'))
    })

  test('comic final image prompt variations apply only non-canonical prompt prefixes', () => {
      const prompts = {
        'Image Prompt Variations': {
          'animation-polish': 'Production animation instruction.',
          'cinematic-depth': 'Cinematic depth instruction.',
        },
      } as unknown as PromptsConfig
      const basePrompt = 'Base final prompt.'

      expect(applyImagePromptVariation(basePrompt, 'canonical', prompts)).toBe(basePrompt)

      const animationPrompt = applyImagePromptVariation(basePrompt, 'animation-polish', prompts)
      const cinematicPrompt = applyImagePromptVariation(basePrompt, 'cinematic-depth', prompts)

      expect(animationPrompt.startsWith('Production animation instruction.')).toBe(true)
      expect(cinematicPrompt.startsWith('Cinematic depth instruction.')).toBe(true)
      expect(animationPrompt).toContain(`\n\n${basePrompt}`)
      expect(cinematicPrompt).toContain(`\n\n${basePrompt}`)
      expect(animationPrompt).not.toBe(cinematicPrompt)
    })

  test('comic final page prompt preserves panel order and speech text', () => {
      const promptData = buildComicPagePromptData([
        {
          schemaVersion: 3,
          snapshotId: 'test-snapshot',
          locationSnapshotId: 'test-location',
          title: 'Co-Work Smarter',
          location: 'Engineering Bay',
          panels: [{
            number: 1,
            description: 'Commander points at the dashboard.',
            shotPlan: 'Medium eye-level shot; Commander stands screen left and points right.',
            characterKeys: ['commander'],
            speech: [{ speaker: { kind: 'character', characterKey: 'commander', offscreen: false }, line: 'We need the exact text.', tone: 'firm' }],
            sourceSegmentIds: ['beat-0001'],
            sourceSegments: [{
              id: 'beat-0001',
              type: 'dialogue',
              text: 'We need the exact text.',
              beatIndex: 1,
              speakerKey: 'commander',
              speakerLabel: 'COMMANDER',
            }]
          }]
        },
        {
          schemaVersion: 3,
          snapshotId: 'test-snapshot',
          locationSnapshotId: 'test-location',
          title: 'Co-Work Smarter',
          location: 'Engineering Bay',
          panels: [{
            number: 3,
            description: 'Engineer nods.',
            shotPlan: 'Close shot from screen right; Engineer faces left and nods.',
            characterKeys: ['engineer'],
            speech: [{ speaker: { kind: 'character', characterKey: 'engineer', offscreen: false }, line: 'Then do not rewrite it.', tone: 'dry' }],
            sourceSegmentIds: ['beat-0002'],
            sourceSegments: [{
              id: 'beat-0002',
              type: 'dialogue',
              text: 'Then do not rewrite it.',
              beatIndex: 2,
              speakerKey: 'engineer',
              speakerLabel: 'ENGINEER',
            }]
          }]
        }
      ])
      const prompt = buildComicPagePrompt(promptData, [
        { key: 'commander', referenceIndex: 1, description: 'Peach-colored captain with a blue uniform.' },
        { key: 'engineer', referenceIndex: 2, description: 'Tall engineer with a red visor.' },
      ])

      expect(promptData.panels.map(panel => panel.number)).toEqual([1, 3])
      expect(prompt).toContain('Render exactly 2 sub-panels')
      expect(prompt).toContain('immutable canonical location reference')
      expect(prompt).toContain('persistent world-space geometry')
      expect(prompt).toContain('The `characterKeys` array in each source panel is exact and authoritative')
      expect(prompt).toContain('highest visual precedence for identity, physical embodiment, projection/display medium')
      expect(prompt).toContain('interface, screen, monitor, avatar, or body is never permission')
      expect(prompt).toContain('Never carry a character forward from')
      expect(prompt).toContain('Preserve location topology, not a frozen composition')
      expect(prompt).toContain('If the composition reveals an anchor\'s canonical part of the set, render that anchor there')
      expect(prompt).toContain('Treat every named fixed anchor as a presence-and-geometry requirement')
      expect(prompt).toContain('Preserve fixed furniture footprint, silhouette, connectedness, orientation, edge count, and relationship to walls')
      expect(prompt).toContain('foreground placement caused by a new camera is allowed, physical relocation is not')
      expect(prompt).toContain('Create shot diversity through camera distance, camera side, elevation, lens feel')
      expect(prompt).toContain('Do not flatten a sequence into repeated near-identical compositions')
      expect(prompt).toContain('Exhaustive prose shot plan')
      expect(prompt).toContain('Reference 1: characterKey=commander; catalog appearance=Peach-colored captain')
      expect(prompt).toContain('Reference 2: characterKey=engineer; catalog appearance=Tall engineer')
      expect(prompt).toContain('Exact required visible characters: commander')
      expect(prompt).toContain('Referenced characters forbidden from this sub-panel: engineer')
      expect(prompt).toContain('Bubble tail must visibly point to commander')
      expect(prompt).toContain('Never substitute one referenced identity for another')
      expect(prompt).toContain('Never copy a character key, filename, reference-sheet label')
      expect(prompt).toContain('strict left-to-right two-panel layout')
      expect(prompt).toContain('We need the exact text.')
      expect(prompt).toContain('Then do not rewrite it.')
      expect(prompt.indexOf('"number": 1')).toBeLessThan(prompt.indexOf('"number": 3'))
    })

  test('comic sketch prompt asks for numeric panel labels only', () => {
      const promptData: PanelBundleData = {
        schemaVersion: 2,
        snapshotId: 'test-snapshot',
        title: 'Mechanic Repairs Everything',
        location: 'Engineering Bay',
        panels: [{
          number: 4,
          description: 'Mechanic kicks the laser cutter panel as steam escapes.',
          characterKeys: [],
          speech: [{ speaker: { kind: 'character', characterKey: 'mechanic', offscreen: false }, line: 'I need the exact text.', tone: 'muttering' }],
          sourceSegmentIds: ['beat-0004'],
          sourceSegments: [{
            id: 'beat-0004',
            type: 'dialogue',
            text: 'I need the exact text.',
            beatIndex: 4,
            speakerKey: 'mechanic',
            speakerLabel: 'MECHANIC',
          }]
        }]
      }
      const sketchPrompts: PromptsConfig['Sketch Prompts'] = {
        Prefix: 'Generate a black-and-white rough sketch review image for comic layout approval.',
        Chunk: 'Use the ordered panel data below to produce one review sketch image with one sub-panel per source panel.',
      }

      const prompt = buildSketchPrompt(promptData, sketchPrompts)

      expect(prompt).toContain('Label each sub-panel only with its source panel number')
      expect(prompt).toContain('small boxed numeral in the upper-left corner')
      expect(prompt).toContain('caption banners such as "Wide opening shot..." or "Action panel..."')
      expect(prompt).toContain('Keep visible text limited to story content explicitly present in the panel data')
      expect(prompt).toContain('Include the exact speech bubble text')
      expect(prompt).toContain('I need the exact text.')
    })
})

// The comic subcommands document their flags with the tables in src/cli/flags/comic-flags.ts
// but parse them with the hand-rolled parsers in comic-utils/cli-args.ts. This guards against
// the two drifting apart: everything the help output advertises must reach a parser branch.
describe('documented comic flags are accepted by the comic parsers', () => {
  const documentedInvocations = (flags: CliFlagsDefinition): string[][] => {
    const invocations: string[][] = []
    for (const [name, definition] of Object.entries(flags)) {
      if (definition.type === Boolean) {
        invocations.push([`--${name}`])
        if (definition.negatable === true) {
          invocations.push([`--no-${name}`])
        }
        continue
      }
      invocations.push([`--${name}`, 'placeholder-value'])
    }
    return invocations
  }

  const expectFlagIsKnown = (parse: (args: string[]) => unknown, args: string[]): void => {
    const flag = args[0] as string
    try {
      parse(args)
    } catch (error) {
      // Value-level rejections are expected for placeholder values; unknown flags are not.
      expect((error as Error).message).not.toContain(`Unknown argument: ${flag}`)
    }
  }

  const cases = [
    ['draft-scenes', draftScenesFlags as CliFlagsDefinition, parseDraftScenesArgs],
    ['generate-images', generateImagesFlags as CliFlagsDefinition, parseGenerateImagesArgs],
    ['reference-sketch', referenceSketchFlags as CliFlagsDefinition, parseReferenceSketchArgs],
    ['character-sketch', characterSketchFlags as CliFlagsDefinition, parseCharacterSketchArgs]
  ] as const

  for (const [subcommand, flags, parse] of cases) {
    test(`comic ${subcommand} parses every flag it documents`, () => {
      const invocations = documentedInvocations(flags)
      expect(invocations.length).toBeGreaterThan(0)
      for (const args of invocations) {
        expectFlagIsKnown(parse, args)
      }
    })
  }

  test('comic character-sketch documents no flag it rejects outright', () => {
    expect(Object.keys(characterSketchFlags)).not.toContain('location')
    expect(() => parseCharacterSketchArgs(['--location', 'cargo-bay'])).toThrow('only supports --character')
  })
})
