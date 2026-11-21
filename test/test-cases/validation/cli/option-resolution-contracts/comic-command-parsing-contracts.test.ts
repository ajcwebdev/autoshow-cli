import { describe,expect,test } from 'bun:test'
import {
chunkComicPagePanels,
DEFAULT_FINAL_PANELS_PER_IMAGE,
DEFAULT_SKETCH_PANELS_PER_IMAGE,
parseComicGridSpec
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-utils'
import {
coerceAndValidateDraftScenes,
coerceAndValidateDraftTreatment,
coerceAndValidateGenerateImages,
coerceAndValidateReferenceSketch,
DEFAULT_LLM_MODEL
} from '~/cli/commands/visuals/comic/comic-utils/cli-args'
import {
draftScenesCommandDefinition,
draftTreatmentCommandDefinition,
generateAudioCommandDefinition,
generateImagesCommandDefinition,
generateSlideshowCommandDefinition,
referenceSketchCommandDefinition
} from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'

const parseSubcommandArgs = (args: string[], command: typeof draftScenesCommandDefinition | typeof draftTreatmentCommandDefinition | typeof generateImagesCommandDefinition | typeof generateAudioCommandDefinition | typeof generateSlideshowCommandDefinition | typeof referenceSketchCommandDefinition) =>
  parseCommandInvocation([command.name, ...args], command, GLOBAL_FLAG_DEFINITIONS)

const parseDraftScenesArgs = (args: string[]) =>
  coerceAndValidateDraftScenes(parseSubcommandArgs(args, draftScenesCommandDefinition))

const parseGenerateImagesArgs = (args: string[]) =>
  coerceAndValidateGenerateImages(parseSubcommandArgs(args, generateImagesCommandDefinition))

const parseDraftTreatmentArgs = (args: string[]) =>
  coerceAndValidateDraftTreatment(parseSubcommandArgs(args, draftTreatmentCommandDefinition))

const parseReferenceSketchArgs = (args: string[]) =>
  coerceAndValidateReferenceSketch(parseSubcommandArgs(args, referenceSketchCommandDefinition))

describe('option resolution contracts', () => {
  test('comic accepts Image 2.5 models, custom sizes, and extended quality', () => {
    for (const model of ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']) {
      const opts = parseGenerateImagesArgs(['script.md', '--provider', `openai=${model}`, '--size', '2048x1152', '--quality', 'xhigh'])
      expect(opts).toMatchObject({ imageModel: model, size: '2048x1152', quality: 'xhigh' })
      expect(parseReferenceSketchArgs(['--character', 'engineer', '--provider', `openai=${model}`, '--quality', 'max']).quality).toBe('max')
    }
  })
  test('comic scene drafting defaults to gpt-6.1-sol', () => {
    expect(DEFAULT_LLM_MODEL).toBe('gpt-6.1-sol')
  })

  test('comic draft-treatment resolves defaults, repeatable speakers, and explicit overrides', () => {
    const defaults = parseDraftTreatmentArgs(['input/camp.md'])
    expect(defaults).toMatchObject({ treatmentPath: 'input/camp.md', panelRange: { minimum: 10, maximum: 10 }, voicePacing: 'exclusive', scene: '01', speakers: [], catalogPolicy: 'skip-existing' })
    expect(defaults.episode).toBeUndefined()
    expect(defaults.slug).toBeUndefined()
    expect(defaults.styleSeed).toBeUndefined()
    expect(defaults.force).toBeUndefined()
    expect(defaults.price).toBeUndefined()
    const explicit = parseDraftTreatmentArgs(['input/camp.md', '--panel-count', '8', '--episode', '02', '--scene', '03', '--slug', 'camp-manzanita', '--speaker', 'papa-bear', '--speaker', 'nick,papa-bear', '--style-seed', 'camp-manzanita--style-seed.png', '--catalog-policy', 'fail', '--force', '--provider', 'openai=gpt-6.1-sol', '--price'])
    expect(parseDraftTreatmentArgs(['input/camp.md', '--panel-count', '20-25', '--voice-pacing', 'mixed'])).toMatchObject({ panelRange: { minimum: 20, maximum: 25 }, voicePacing: 'mixed' })
    expect(explicit).toMatchObject({ panelRange: { minimum: 8, maximum: 8 }, episode: '02', scene: '03', slug: 'camp-manzanita', speakers: ['papa-bear', 'nick'], styleSeed: 'camp-manzanita--style-seed.png', catalogPolicy: 'fail', force: true, llmModel: 'gpt-6.1-sol', price: true })
  })

  test('comic draft-scenes accepts --panel-count for the scene stage only', () => {
    expect(parseDraftScenesArgs(['script.md', '--only', 'scene', '--panel-count', '10']).panelCount).toBe(10)
    expect(parseDraftScenesArgs(['script.md', '--panel-count', '6']).panelCount).toBe(6)
    expect(parseDraftScenesArgs(['script.md']).panelCount).toBeUndefined()
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
  })
  test('comic generate-images resolves omitted, bare-provider, and explicit-model selectors to one image model', () => {
    expect(parseGenerateImagesArgs(['script.md']).imageModel).toBeUndefined()
    expect(parseGenerateImagesArgs(['script.md', '--provider', 'openai']).imageModel).toBe('gpt-image-2.6-flare')
    expect(parseGenerateImagesArgs(['script.md', '--provider', 'gemini=gemini-nano-banana-2.1']).imageModel).toBe('gemini-nano-banana-2.1')
    expect(parseGenerateImagesArgs(['script.md', '--provider=openai=gpt-image-2.6-sunburst']).imageModel).toBe('gpt-image-2.6-sunburst')
  })
  test('comic generate-images rejects repeated image selectors instead of deduplicating or keeping the last value', () => {
    const single = 'accepts exactly one --provider'
    expect(() => parseGenerateImagesArgs(['script.md', '--provider', 'openai=gpt-image-2.6-flare', '--provider', 'openai=gpt-image-2.6-flare'])).toThrow(single)
    expect(() => parseGenerateImagesArgs(['script.md', '--provider', 'openai=gpt-image-2.6-flare', '--provider', 'openai=gpt-image-2.6-sunburst'])).toThrow(single)
    expect(() => parseGenerateImagesArgs(['script.md', '--provider', 'openai', '--provider', 'gemini'])).toThrow(single)
    expect(() => parseGenerateImagesArgs(['script.md', '--provider', 'openai=gpt-image-2.6-flare,gemini=gemini-nano-banana-2.1'])).toThrow('accepts exactly one --provider provider[=model]')
  })
  test('comic generate-images args parse page image options', () => {
      const opts = parseGenerateImagesArgs([
        'input/scripts/02-script/01-co-work-smarter.md',
        '--provider', 'gemini=gemini-nano-banana-2.1',
        '--panels', '1-4,9',
        '--panels-per-image', String(DEFAULT_SKETCH_PANELS_PER_IMAGE),
        '--size', '1536x1024',
        '--quality', 'high',
        '--force'
      ])

      expect(opts.scriptPath).toBe('input/scripts/02-script/01-co-work-smarter.md')
      expect(opts.imageModel).toBe('gemini-nano-banana-2.1')
      expect(opts.panels).toEqual([1, 2, 3, 4, 9])
      expect(opts.panelsPerImage).toBe(DEFAULT_SKETCH_PANELS_PER_IMAGE)
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
      expect(() => parseGenerateImagesArgs(['script.md', '--llm-provider', 'openai=gpt-6.1-sol'])).toThrow('Unexpected flag: --llm-provider')
      expect(() => parseGenerateImagesArgs(['script.md', '--panel-limit', '3'])).toThrow('Unexpected flag: --panel-limit')
      expect(() => parseGenerateImagesArgs(['script.md', '--chunk', '2'])).toThrow('Unexpected flag: --chunk')
      expect(() => parseGenerateImagesArgs(['script.md', '--sketch-group-size', '8'])).toThrow('Unexpected flag: --sketch-group-size')
      expect(() => parseGenerateImagesArgs(['script.md', '--sketch-panels', '1-4'])).toThrow('Unexpected flag: --sketch-panels')
    })

  test('comic draft-scenes args parse llm model and panel prompt stage', () => {
      const opts = parseDraftScenesArgs([
        'input/scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--provider', 'openai=gpt-6.1-sol',
        '--only', 'panel-prompts',
      ])
      const grokOpts = parseDraftScenesArgs([
        'input/scripts/05-script/01-mechanic-goes-on-vacation.md',
        '--provider', 'grok=grok-4.7'
      ])

      expect(findRegistryServiceForModel('llm', 'gpt-6.1-sol')).toBe('openai')
      expect(findRegistryServiceForModel('llm', 'grok-4.7')).toBe('grok')
      expect(opts.scriptPath).toBe('input/scripts/05-script/01-mechanic-goes-on-vacation.md')
      expect(opts.llmModel).toBe('gpt-6.1-sol')
      expect(opts.only).toBe('panel-prompts')
      expect(grokOpts.llmModel).toBe('grok-4.7')
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
        '--provider', 'openai=gpt-image-2.6-flare',
        '--size', '1536x1024',
        '--quality', 'high',
        '--force'
      ])

      expect(opts.scriptPath).toBe('input/scripts/02-script/01-co-work-smarter.md')
      expect(opts.target).toBe('images')
      expect(opts.panels).toEqual([1, 2, 3, 4, 5, 6])
      expect(opts.panelsPerImage).toBe(DEFAULT_SKETCH_PANELS_PER_IMAGE)
      expect(opts.imageModel).toBe('gpt-image-2.6-flare')
      expect(opts.size).toBe('1536x1024')
      expect(opts.quality).toBe('high')
      expect(opts.force).toBe(true)
    })
})
