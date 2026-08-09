import {
  IMAGE_GENERATION_QUALITIES,
} from '~/types'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { NativeMissingFlagValueError } from '~/cli/native/native-errors'
import { parseCommandArgv } from '~/cli/native/native-parser'
import { CLIUsageError } from '~/utils/error-handler'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import {
  validateImageSizeForModels,
} from './image-size'
import {
  parseImagePromptVariations,
} from '../comic-commands/generate-images/prompt-variations'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_SKETCH_PANELS_PER_IMAGE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  parseComicGridSpec,
  parsePanelSelector,
  validateComicGridOptions,
} from '../comic-commands/generate-images/comic-page-utils'
import type {
  CliCommandDefinition,
  CliCommandContext,
  CliParseResult,
  ParsedDraftCommandArgs,
  ParsedGenerateBaseArgs,
  ParsedGenerateImagesArgs,
  ParsedImageModel,
  ParsedImageQuality,
  ParsedImageSize,
  ParsedLlmModel,
  ParsedReferenceSketchArgs,
} from '~/types'

type ComicParsedArgs = Pick<CliCommandContext, 'flags' | 'parameters' | 'rawParsed'>

// Comic's default text model. Validated against the central LLM registry at parse time.
export const DEFAULT_LLM_MODEL = 'gpt-5.6-sol'
// Comic's default vision judge. Keep QA independent from the drafting model.
export const DEFAULT_QA_MODEL = 'gpt-5.6-sol'

export const REFERENCE_SKETCH_COMMAND = 'reference-sketch'
export const DRAFT_SCENES_COMMAND = 'draft-scenes'
export const GENERATE_IMAGES_COMMAND = 'generate-images'

const DRAFT_SCENES_ONLY_VALUES = ['structure', 'prompt', 'scene', 'panel-prompts'] as const
const GENERATE_IMAGES_TARGET_VALUES = ['images', 'sketches', 'both'] as const

const IMAGE_QUALITY_OPTIONS = new Set<string>(IMAGE_GENERATION_QUALITIES)
const DRAFT_SCENES_ONLY_OPTIONS = new Set<string>(DRAFT_SCENES_ONLY_VALUES)
const GENERATE_IMAGES_TARGET_OPTIONS = new Set<string>(GENERATE_IMAGES_TARGET_VALUES)

// Comic historically rejected inline assignments while the native parser accepts them.
// Keep that grammar fork explicit until the public comic surface deliberately changes.
const assertComicFlagGrammar = (args: readonly string[]): void => {
  for (const argument of args) {
    if (argument === '--' || (argument.startsWith('--') && argument.includes('='))) {
      throw CLIUsageError(`Unknown argument: ${argument}`)
    }
  }
}

export const parseComicSubcommandArgv = (
  args: string[],
  command: CliCommandDefinition
): CliParseResult => {
  assertComicFlagGrammar(args)
  const parseDefinition = command.parameters?.some(parameter => parameter.key === '<script-path>')
    ? {
        ...command,
        parameters: command.parameters.map(parameter =>
          parameter.key === '<script-path>' ? { ...parameter, key: '[script-path]' } : parameter
        )
      }
    : command
  try {
    return parseCommandArgv([command.name, ...args], parseDefinition, GLOBAL_FLAG_DEFINITIONS)
  } catch (error) {
    if (error instanceof NativeMissingFlagValueError) {
      throw CLIUsageError(`Missing value for --${error.flagName}`)
    }
    throw error
  }
}

const assertKnownFlags = (parsed: ComicParsedArgs): void => {
  const unknown = parsed.rawParsed.flagOccurrences.find(occurrence => !occurrence.known)
  if (unknown) {
    throw CLIUsageError(`Unknown argument: ${unknown.raw}`)
  }
}

const assertSpecifiedOnce = (
  parsed: ComicParsedArgs,
  name: string,
  message: string
): void => {
  let seen = false
  for (const occurrence of parsed.rawParsed.flagOccurrences) {
    if (occurrence.name !== name) continue
    if (seen) throw CLIUsageError(message)
    seen = true
  }
}

const stringFlag = (parsed: ComicParsedArgs, name: string): string | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  const value = parsed.flags[name]
  return typeof value === 'string' ? value : undefined
}

const enabledFlag = (parsed: ComicParsedArgs, name: string): boolean | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  return parsed.flags[name] === true
}

const readScriptPath = (parsed: ComicParsedArgs): string | undefined => {
  const values = parsed.rawParsed.positionals.map(position => position.value)
  if (values.length > 1) throw CLIUsageError('Script path can only be specified once')
  return values[0]
}

const assertNoPositionals = (parsed: ComicParsedArgs): void => {
  const first = parsed.rawParsed.positionals[0]?.value
  if (first !== undefined) throw CLIUsageError(`Unknown argument: ${first}`)
}

const isPositiveInteger = (value: string): boolean =>
  /^\d+$/.test(value) && Number(value) > 0

const parseConcurrencyValue = (value: string): number => {
  if (!isPositiveInteger(value)) {
    throw CLIUsageError(`Invalid concurrency "${value}". Expected a positive integer like 1 or ${DEFAULT_CLI_CONCURRENCY}`)
  }
  return Number(value)
}

const parseImageModels = (value: string): ParsedImageModel[] => {
  const rawModels = value.split(',').map(model => model.trim())
  if (rawModels.some(model => model.length === 0)) {
    throw CLIUsageError(
      `Invalid image model list "${value}". Expected one or more comma-separated image model ids from the central image registry.`
    )
  }

  const parsedModels: ParsedImageModel[] = []
  const seenModels = new Set<string>()
  for (const model of rawModels) {
    if (!findRegistryServiceForModel('image', model)) {
      throw CLIUsageError(`Invalid image model "${model}". It is not present in the central image registry.`)
    }
    if (seenModels.has(model)) {
      throw CLIUsageError(`Duplicate image model "${model}" is not allowed`)
    }
    seenModels.add(model)
    parsedModels.push(model as ParsedImageModel)
  }
  return parsedModels
}

const parseLlmModel = (value: string): ParsedLlmModel => {
  if (!findRegistryServiceForModel('llm', value)) {
    throw CLIUsageError(`Invalid llm model "${value}". It is not present in the central LLM registry.`)
  }
  return value as ParsedLlmModel
}

const parseImageQuality = (value: string): ParsedImageQuality => {
  if (!IMAGE_QUALITY_OPTIONS.has(value)) {
    throw CLIUsageError(`Invalid quality "${value}". Expected one of: low, medium, high, auto`)
  }
  return value as ParsedImageQuality
}

const parseMaxRepairs = (value: string): number => {
  if (!/^\d+$/.test(value)) {
    throw CLIUsageError(`Invalid max repairs "${value}". Expected a non-negative integer.`)
  }
  return Number(value)
}

const assignSharedImageOptions = (
  parsed: ComicParsedArgs,
  output: ParsedGenerateBaseArgs | ParsedReferenceSketchArgs
): void => {
  const imageModel = stringFlag(parsed, 'image-model')
  const size = stringFlag(parsed, 'size')
  const quality = stringFlag(parsed, 'quality')
  if (imageModel !== undefined) output.imageModels = parseImageModels(imageModel)
  if (size !== undefined) output.size = size as ParsedImageSize
  if (quality !== undefined) output.quality = parseImageQuality(quality)
}

export const coerceAndValidateDraftScenes = (parsed: ComicParsedArgs): ParsedDraftCommandArgs => {
  assertKnownFlags(parsed)
  assertSpecifiedOnce(parsed, 'llm-model', 'LLM model can only be specified once')
  assertSpecifiedOnce(parsed, 'only', 'Only can only be specified once')
  assertSpecifiedOnce(parsed, 'concurrency', 'Concurrency can only be specified once')

  const output: ParsedDraftCommandArgs = { showHelp: false }
  const scriptPath = readScriptPath(parsed)
  const llmModel = stringFlag(parsed, 'llm-model')
  const only = stringFlag(parsed, 'only')
  const concurrency = stringFlag(parsed, 'concurrency')
  if (scriptPath !== undefined) output.scriptPath = scriptPath
  if (enabledFlag(parsed, 'price') === true) output.price = true
  if (llmModel !== undefined) output.llmModel = parseLlmModel(llmModel)
  if (only !== undefined) {
    if (!DRAFT_SCENES_ONLY_OPTIONS.has(only)) {
      throw CLIUsageError(`Invalid only "${only}". Expected one of: ${DRAFT_SCENES_ONLY_VALUES.join(', ')}`)
    }
    output.only = only as NonNullable<ParsedDraftCommandArgs['only']>
  }
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  return output
}

export const coerceAndValidateReferenceSketch = (parsed: ComicParsedArgs): ParsedReferenceSketchArgs => {
  assertKnownFlags(parsed)
  assertNoPositionals(parsed)
  assertSpecifiedOnce(parsed, 'character', 'Character can only be specified once')
  assertSpecifiedOnce(parsed, 'location', 'Location can only be specified once')
  assertSpecifiedOnce(parsed, 'view', 'View can only be specified once')
  assertSpecifiedOnce(parsed, 'llm-model', '--llm-model can only be specified once')
  assertSpecifiedOnce(parsed, 'qa-model', '--qa-model can only be specified once')
  assertSpecifiedOnce(parsed, 'qa', 'QA can only be specified once')
  assertSpecifiedOnce(parsed, 'max-repairs', 'Max repairs can only be specified once')
  assertSpecifiedOnce(parsed, 'image-model', 'Image model can only be specified once')
  assertSpecifiedOnce(parsed, 'size', 'Size can only be specified once')
  assertSpecifiedOnce(parsed, 'quality', 'Quality can only be specified once')
  assertSpecifiedOnce(parsed, 'revise', 'Revise can only be specified once')
  assertSpecifiedOnce(parsed, 'notes', 'Notes can only be specified once')
  assertSpecifiedOnce(parsed, 'concurrency', 'Concurrency can only be specified once')

  const output: ParsedReferenceSketchArgs = { showHelp: false }
  const character = stringFlag(parsed, 'character')
  const location = stringFlag(parsed, 'location')
  const view = stringFlag(parsed, 'view')
  const llmModel = stringFlag(parsed, 'llm-model')
  const qaModel = stringFlag(parsed, 'qa-model')
  const maxRepairs = stringFlag(parsed, 'max-repairs')
  const notes = stringFlag(parsed, 'notes')
  const concurrency = stringFlag(parsed, 'concurrency')
  if (character !== undefined) output.character = character
  if (location !== undefined) output.location = location
  if (view !== undefined) {
    if (view !== 'establishing' && view !== 'reverse' && view !== 'side') {
      throw CLIUsageError(`Invalid location view "${view}". Expected one of: establishing, reverse, side`)
    }
    output.view = view
  }
  if (llmModel !== undefined) output.llmModel = parseLlmModel(llmModel)
  if (qaModel !== undefined) output.qaModel = parseLlmModel(qaModel)
  const qa = enabledFlag(parsed, 'qa')
  if (qa !== undefined) output.qa = qa
  if (maxRepairs !== undefined) output.maxRepairs = parseMaxRepairs(maxRepairs)
  if (enabledFlag(parsed, 'revise') === true) output.revise = true
  if (notes !== undefined) output.notes = notes
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  if (enabledFlag(parsed, 'price') === true) output.price = true
  assignSharedImageOptions(parsed, output)

  if (output.imageModels && output.imageModels.length !== 1) {
    throw CLIUsageError('comic reference-sketch accepts exactly one --image-model')
  }
  if (Number(Boolean(output.character)) + Number(Boolean(output.location)) !== 1) {
    throw CLIUsageError('Exactly one of --character or --location is required')
  }
  if (output.character && output.view) throw CLIUsageError('--view is only valid with --location')
  validateImageSizeForModels(output.size, output.imageModels)
  if (output.revise && !output.notes) throw CLIUsageError('--notes is required when using --revise')
  if (output.notes && !output.revise) throw CLIUsageError('--notes requires --revise')
  return output
}

export const coerceAndValidateGenerateImages = (parsed: ComicParsedArgs): ParsedGenerateImagesArgs => {
  assertKnownFlags(parsed)
  assertSpecifiedOnce(parsed, 'qa', 'QA can only be specified once')
  assertSpecifiedOnce(parsed, 'qa-model', 'QA model can only be specified once')
  assertSpecifiedOnce(parsed, 'max-repairs', 'Max repairs can only be specified once')
  assertSpecifiedOnce(parsed, 'target', 'Target can only be specified once')
  assertSpecifiedOnce(parsed, 'llm-model', 'LLM model can only be specified once')
  assertSpecifiedOnce(parsed, 'concurrency', 'Concurrency can only be specified once')
  assertSpecifiedOnce(parsed, 'panels', 'Panels can only be specified once')
  assertSpecifiedOnce(parsed, 'panels-per-image', 'Panels per image can only be specified once')
  assertSpecifiedOnce(parsed, 'grid', 'Grid can only be specified once')
  assertSpecifiedOnce(parsed, 'image-model', 'Image model can only be specified once')
  assertSpecifiedOnce(parsed, 'variation', 'Variation can only be specified once')
  assertSpecifiedOnce(parsed, 'size', 'Size can only be specified once')
  assertSpecifiedOnce(parsed, 'quality', 'Quality can only be specified once')
  assertSpecifiedOnce(parsed, 'force', 'Force can only be specified once')

  const output: ParsedGenerateBaseArgs = { showHelp: false }
  const scriptPath = readScriptPath(parsed)
  const qaModel = stringFlag(parsed, 'qa-model')
  const maxRepairs = stringFlag(parsed, 'max-repairs')
  const targetValue = stringFlag(parsed, 'target')
  const llmModel = stringFlag(parsed, 'llm-model')
  const concurrency = stringFlag(parsed, 'concurrency')
  const panels = stringFlag(parsed, 'panels')
  const panelsPerImage = stringFlag(parsed, 'panels-per-image')
  const grid = stringFlag(parsed, 'grid')
  const variation = stringFlag(parsed, 'variation')
  if (scriptPath !== undefined) output.scriptPath = scriptPath
  if (enabledFlag(parsed, 'price') === true) output.price = true
  const qa = enabledFlag(parsed, 'qa')
  if (qa !== undefined) output.qa = qa
  if (qaModel !== undefined) {
    if (findRegistryServiceForModel('llm', qaModel) !== 'openai') {
      throw CLIUsageError(`Invalid QA model "${qaModel}". QA currently requires an OpenAI vision-capable LLM.`)
    }
    output.qaModel = qaModel as ParsedLlmModel
  }
  if (maxRepairs !== undefined) output.maxRepairs = parseMaxRepairs(maxRepairs)
  if (targetValue !== undefined) {
    if (!GENERATE_IMAGES_TARGET_OPTIONS.has(targetValue)) {
      throw CLIUsageError(`Invalid target "${targetValue}". Expected one of: ${GENERATE_IMAGES_TARGET_VALUES.join(', ')}`)
    }
    output.target = targetValue as NonNullable<ParsedGenerateBaseArgs['target']>
  }
  if (llmModel !== undefined) output.llmModel = parseLlmModel(llmModel)
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  if (panels !== undefined) output.panels = parsePanelSelector(panels)
  if (panelsPerImage !== undefined) {
    if (!isPositiveInteger(panelsPerImage)) {
      throw CLIUsageError(`Invalid panels per image "${panelsPerImage}". Expected a positive integer like 1 or ${DEFAULT_SKETCH_PANELS_PER_IMAGE}`)
    }
    output.panelsPerImage = Number(panelsPerImage)
  }
  if (grid !== undefined) output.grid = parseComicGridSpec(grid)
  if (variation !== undefined) output.variations = parseImagePromptVariations(variation)
  if (enabledFlag(parsed, 'force') === true) output.force = true
  assignSharedImageOptions(parsed, output)

  const target = output.target ?? 'images'
  const targetRunsFinalImages = target === 'images' || target === 'both'
  if ((output.qa !== undefined || output.qaModel || output.maxRepairs !== undefined) && !targetRunsFinalImages) {
    throw CLIUsageError('QA options only apply when --target is images or both')
  }
  if (output.grid && output.panelsPerImage === undefined) {
    throw CLIUsageError('--grid requires --panels-per-image 1')
  }

  output.qa ??= true
  output.qaModel ??= DEFAULT_QA_MODEL as ParsedLlmModel
  output.maxRepairs ??= 2
  if (output.variations !== undefined && !targetRunsFinalImages) {
    throw CLIUsageError('--variation only applies when --target is images or both')
  }
  validateImageSizeForModels(output.size, output.imageModels)
  validateComicGridOptions(output.grid, {
    target,
    size: output.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: output.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  })
  return output as ParsedGenerateImagesArgs
}
