import { describe,expect,test } from 'bun:test'
import {
chunkComicPagePanels,
DEFAULT_FINAL_PANELS_PER_IMAGE,
DEFAULT_SKETCH_PANELS_PER_IMAGE,
parseComicGridSpec
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import {
coerceAndValidateDraftScenes,
coerceAndValidateGenerateImages,
coerceAndValidateReferenceSketch,
DEFAULT_LLM_MODEL
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import {
draftScenesCommandDefinition,
generateAudioCommandDefinition,
generateImagesCommandDefinition,
generateSlideshowCommandDefinition,
referenceSketchCommandDefinition
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'

const parseSubcommandArgs = (args: string[], command: typeof draftScenesCommandDefinition | typeof generateImagesCommandDefinition | typeof generateAudioCommandDefinition | typeof generateSlideshowCommandDefinition | typeof referenceSketchCommandDefinition) =>
  parseCommandInvocation([command.name, ...args], command, GLOBAL_FLAG_DEFINITIONS)

const parseDraftScenesArgs = (args: string[]) =>
  coerceAndValidateDraftScenes(parseSubcommandArgs(args, draftScenesCommandDefinition))

const parseGenerateImagesArgs = (args: string[]) =>
  coerceAndValidateGenerateImages(parseSubcommandArgs(args, generateImagesCommandDefinition))

const parseReferenceSketchArgs = (args: string[]) =>
  coerceAndValidateReferenceSketch(parseSubcommandArgs(args, referenceSketchCommandDefinition))

describe('option resolution contracts', () => {
  test('comic scene drafting defaults to gpt-5.6-sol', () => {
    expect(DEFAULT_LLM_MODEL).toBe('gpt-5.6-sol')
  })

  test('comic reference-sketch requires exactly one reference mode', () => {
    expect(parseReferenceSketchArgs(['--location', 'cargo-bay']).location).toBe('cargo-bay')
    expect(parseReferenceSketchArgs(['--location', 'cargo-bay']).view).toBeUndefined()
    expect(parseReferenceSketchArgs(['--location', 'cargo-bay', '--view', 'reverse']).view).toBe('reverse')
    expect(parseReferenceSketchArgs(['--character', 'engineer']).character).toBe('engineer')
    expect(() => parseReferenceSketchArgs(['--character', 'engineer', '--view', 'side'])).toThrow('--view is only valid with --location')
    expect(() => parseReferenceSketchArgs(['--location', 'cargo-bay', '--view', 'diagonal'])).toThrow('Expected one of')
    expect(() => parseReferenceSketchArgs([])).toThrow('Exactly one')
    expect(() => parseReferenceSketchArgs(['--character', 'engineer', '--location', 'cargo-bay'])).toThrow('Exactly one')
  })
  test('comic final images default to one panel while sketch chunks remain six', () => {
    expect(DEFAULT_FINAL_PANELS_PER_IMAGE).toBe(1)
    expect(DEFAULT_SKETCH_PANELS_PER_IMAGE).toBe(6)
    const chunks = chunkComicPagePanels(Array.from({ length: 29 }, (_, index) => ({ panelNumber: index + 1 })), DEFAULT_FINAL_PANELS_PER_IMAGE)
    expect(chunks).toHaveLength(29)
    expect(chunks.at(-1)?.panelNumbers).toEqual([29])
    const qa = parseGenerateImagesArgs(['script.md', '--qa'])
    expect(qa.qa).toBe(true)
    expect(qa.qaModel).toBe('gpt-5.6-sol')
    expect(parseGenerateImagesArgs(['script.md', '--qa-model', 'gpt-5.5']).qaModel).toBe('gpt-5.5')
  })
  test('comic generate-images args parse page image options', () => {
      const opts = parseGenerateImagesArgs([
        'input/scripts/02-script/01-co-work-smarter.md',
        '--image-model', 'gpt-image-2,gemini-3.1-flash-lite-image',
        '--panels', '1-4,9',
        '--panels-per-image', String(DEFAULT_SKETCH_PANELS_PER_IMAGE),
        '--variation', 'animation-polish,cinematic-depth',
        '--size', '1536x1024',
        '--quality', 'high',
        '--force'
      ])

      expect(opts.scriptPath).toBe('input/scripts/02-script/01-co-work-smarter.md')
      expect(opts.imageModels).toEqual(['gpt-image-2', 'gemini-3.1-flash-lite-image'])
      expect(opts.panels).toEqual([1, 2, 3, 4, 9])
      expect(opts.panelsPerImage).toBe(DEFAULT_SKETCH_PANELS_PER_IMAGE)
      expect(opts.variations).toEqual(['animation-polish', 'cinematic-depth'])
      expect(opts.size).toBe('1536x1024')
      expect(opts.quality).toBe('high')
      expect(opts.force).toBe(true)
    })

  test('comic generate-images args parse grid page composition options', () => {
      const opts = parseGenerateImagesArgs([
        'input/scripts/02-script/01-co-work-smarter.md',
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
      expect(parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '2x3', '--grid', '3x2']).grid).toEqual({ columns: 3, rows: 2 })
      expect(() => parseGenerateImagesArgs(['script.md', '--target', 'sketches', '--panels-per-image', '1', '--grid', '2x3'])).toThrow('--grid only applies when --target is images or both')
      expect(() => parseGenerateImagesArgs(['script.md', '--grid', '2x3'])).toThrow('--grid requires --panels-per-image 1')
      expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '1', '--grid', '2x3', '--size', '1024x1024'])).toThrow('--grid requires --size 1536x1024')
    })

  test('comic generate-images rejects removed option spellings as unknown arguments', () => {
      expect(() => parseGenerateImagesArgs(['script.md', '--llm-model', 'gpt-5.5'])).toThrow('Unexpected flag: --llm-model')
      expect(() => parseGenerateImagesArgs(['script.md', '--panel-limit', '3'])).toThrow('Unexpected flag: --panel-limit')
      expect(() => parseGenerateImagesArgs(['script.md', '--chunk', '2'])).toThrow('Unexpected flag: --chunk')
      expect(() => parseGenerateImagesArgs(['script.md', '--sketch-group-size', '8'])).toThrow('Unexpected flag: --sketch-group-size')
      expect(() => parseGenerateImagesArgs(['script.md', '--sketch-panels', '1-4'])).toThrow('Unexpected flag: --sketch-panels')
    })

  test('comic generate-images variation args reject duplicates and unknown values', () => {
      expect(() => parseGenerateImagesArgs(['script.md', '--variation', 'animation-polish,animation-polish'])).toThrow('Duplicate variation "animation-polish" is not allowed')
      expect(() => parseGenerateImagesArgs(['script.md', '--variation', 'unknown'])).toThrow('Invalid variation "unknown"')
    })

  test('comic draft-scenes args parse llm model and panel prompt stage', () => {
      const opts = parseDraftScenesArgs([
        'input/scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--llm-model', 'gpt-5.5',
        '--only', 'panel-prompts',
      ])
      const grokOpts = parseDraftScenesArgs([
        'input/scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--llm-model', 'grok-4.5'
      ])

      expect(findRegistryServiceForModel('llm', 'gpt-5.5')).toBe('openai')
      expect(findRegistryServiceForModel('llm', 'grok-4.5')).toBe('grok')
      expect(opts.scriptPath).toBe('input/scripts/05-script/01-mechanic-goes-on-vacation.md')
      expect(opts.llmModel).toBe('gpt-5.5')
      expect(opts.only).toBe('panel-prompts')
      expect(grokOpts.llmModel).toBe('grok-4.5')
    })

  test('comic generate-images args parse target', () => {
      const opts = parseGenerateImagesArgs([
        'input/scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--target', 'sketches',
        '--panels-per-image', String(DEFAULT_SKETCH_PANELS_PER_IMAGE),
        '--quality', 'high',
      ])

      expect(opts.scriptPath).toBe('input/scripts/05-script/01-mechanic-goes-on-vacation.md')
      expect(opts.target).toBe('sketches')
      expect(opts.panelsPerImage).toBe(DEFAULT_SKETCH_PANELS_PER_IMAGE)
      expect(opts.quality).toBe('high')
      expect(() => parseGenerateImagesArgs(['script.md', '--target', 'prompts'])).toThrow('Invalid target "prompts". Expected one of: images, sketches, both')
    })

  test('comic generate-images args parse page image options with target', () => {
      const opts = parseGenerateImagesArgs([
        'input/scripts/02-script/01-co-work-smarter.md',
        '--target', 'images',
        '--panels', '1-6',
        '--panels-per-image', String(DEFAULT_SKETCH_PANELS_PER_IMAGE),
        '--image-model', 'gpt-image-2',
        '--size', '1536x1024',
        '--quality', 'high',
        '--force'
      ])

      expect(opts.scriptPath).toBe('input/scripts/02-script/01-co-work-smarter.md')
      expect(opts.target).toBe('images')
      expect(opts.panels).toEqual([1, 2, 3, 4, 5, 6])
      expect(opts.panelsPerImage).toBe(DEFAULT_SKETCH_PANELS_PER_IMAGE)
      expect(opts.imageModels).toEqual(['gpt-image-2'])
      expect(opts.size).toBe('1536x1024')
      expect(opts.quality).toBe('high')
      expect(opts.force).toBe(true)
    })
})
