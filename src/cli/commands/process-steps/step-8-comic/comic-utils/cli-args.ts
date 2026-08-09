import {
  IMAGE_GENERATION_QUALITIES,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'

// Comic's default text model. Validated against the central LLM registry at parse time.
export const DEFAULT_LLM_MODEL = 'gpt-5.6-sol'
// Comic's default vision judge. Keep QA independent from the drafting model.
export const DEFAULT_QA_MODEL = 'gpt-5.6-sol'
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
import type { ParsedDraftCommandArgs, ParsedGenerateBaseArgs, ParsedGenerateImagesArgs, ParsedImageModel, ParsedImageQuality, ParsedImageSize, ParsedLlmModel, ParsedReferenceSketchArgs } from '~/types'


export const REFERENCE_SKETCH_COMMAND = 'reference-sketch'
export const DRAFT_SCENES_COMMAND = 'draft-scenes'
export const GENERATE_IMAGES_COMMAND = 'generate-images'
const DRAFT_SCENES_ONLY_VALUES = ['structure', 'prompt', 'scene', 'panel-prompts'] as const
const GENERATE_IMAGES_TARGET_VALUES = ['images', 'sketches', 'both'] as const

const IMAGE_QUALITY_OPTIONS = new Set<string>(IMAGE_GENERATION_QUALITIES)
const DRAFT_SCENES_ONLY_OPTIONS = new Set<string>(DRAFT_SCENES_ONLY_VALUES)
const GENERATE_IMAGES_TARGET_OPTIONS = new Set<string>(GENERATE_IMAGES_TARGET_VALUES)

const readFlagValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('-')) {
    throw CLIUsageError(`Missing value for ${flag}`)
  }

  return value
}

const isPositiveInteger = (value: string): boolean => {
  return /^\d+$/.test(value) && Number(value) > 0
}

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
      throw CLIUsageError(
        `Invalid image model "${model}". It is not present in the central image registry.`
      )
    }

    if (seenModels.has(model)) {
      throw CLIUsageError(`Duplicate image model "${model}" is not allowed`)
    }

    seenModels.add(model)
    parsedModels.push(model as ParsedImageModel)
  }

  return parsedModels
}

const parseLlmModelFlag = (existing: ParsedLlmModel | undefined, args: string[], index: number, flag: string): ParsedLlmModel => {
  if (existing) throw CLIUsageError('LLM model can only be specified once')
  const llmModel = readFlagValue(args, index, flag)
  if (!findRegistryServiceForModel('llm', llmModel)) {
    throw CLIUsageError(
      `Invalid llm model "${llmModel}". It is not present in the central LLM registry.`
    )
  }

  return llmModel as ParsedLlmModel
}

const parseImageSizeFlag = (existing: ParsedImageSize | undefined, args: string[], index: number, flag: string): ParsedImageSize => {
  if (existing) throw CLIUsageError('Size can only be specified once')
  return readFlagValue(args, index, flag) as ParsedImageSize
}

const parseImageQualityFlag = (existing: ParsedImageQuality | undefined, args: string[], index: number, flag: string): ParsedImageQuality => {
  if (existing) throw CLIUsageError('Quality can only be specified once')
  const quality = readFlagValue(args, index, flag)
  if (!IMAGE_QUALITY_OPTIONS.has(quality)) {
    throw CLIUsageError(`Invalid quality "${quality}". Expected one of: low, medium, high, auto`)
  }

  return quality as ParsedImageQuality
}

const parseConcurrencyFlag = (existing: number | undefined, args: string[], index: number, flag: string): number => {
  if (existing !== undefined) throw CLIUsageError('Concurrency can only be specified once')
  return parseConcurrencyValue(readFlagValue(args, index, flag))
}

// Trailing positional script path shared by the draft-scenes and generate-images default cases.
const readTrailingScriptPath = (existing: string | undefined, argument: string | undefined): string | undefined => {
  if (argument && argument.startsWith('-')) throw CLIUsageError(`Unknown argument: ${argument}`)
  if (existing) throw CLIUsageError('Script path can only be specified once')
  return argument
}

export const parseDraftScenesArgs = (args: string[]): ParsedDraftCommandArgs => {
  const parsed: ParsedDraftCommandArgs = { showHelp: false }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '-h':
      case '--help':
        parsed.showHelp = true
        break
      case '--price':
        parsed.price = true
        break
      case '--llm-model': {
        parsed.llmModel = parseLlmModelFlag(parsed.llmModel, args, index, argument)
        index++
        break
      }
      case '--only': {
        if (parsed.only) {
          throw CLIUsageError('Only can only be specified once')
        }

        const only = readFlagValue(args, index, argument)
        if (!DRAFT_SCENES_ONLY_OPTIONS.has(only)) {
          throw CLIUsageError(
            `Invalid only "${only}". Expected one of: ${DRAFT_SCENES_ONLY_VALUES.join(', ')}`
          )
        }

        parsed.only = only as NonNullable<ParsedDraftCommandArgs['only']>
        index++
        break
      }
      case '--concurrency': {
        parsed.concurrency = parseConcurrencyFlag(parsed.concurrency, args, index, argument)
        index++
        break
      }
      default: {
        const scriptPath = readTrailingScriptPath(parsed.scriptPath, argument)
        if (scriptPath) {
          parsed.scriptPath = scriptPath
        }
        break
      }
    }
  }

  return parsed
}

export const parseReferenceSketchArgs = (args: string[]): ParsedReferenceSketchArgs => {
  const parsed: ParsedReferenceSketchArgs = { showHelp: false }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '-h':
      case '--help':
        parsed.showHelp = true
        break
      case '--price':
        parsed.price = true
        break
      case '--character': {
        if (parsed.character) throw CLIUsageError('Character can only be specified once')
        parsed.character = readFlagValue(args, index, argument)
        index++
        break
      }
      case '--location': {
        if (parsed.location) throw CLIUsageError('Location can only be specified once')
        parsed.location = readFlagValue(args, index, argument)
        index++
        break
      }
      case '--view': {
        if (parsed.view) throw CLIUsageError('View can only be specified once')
        const view = readFlagValue(args, index, argument)
        if (view !== 'establishing' && view !== 'reverse' && view !== 'side') throw CLIUsageError(`Invalid location view "${view}". Expected one of: establishing, reverse, side`)
        parsed.view = view
        index++
        break
      }
      case '--llm-model':
      case '--qa-model': {
        const field = argument === '--llm-model' ? 'llmModel' : 'qaModel'
        if (parsed[field]) throw CLIUsageError(`${argument} can only be specified once`)
        const model = readFlagValue(args, index, argument)
        if (!findRegistryServiceForModel('llm', model)) throw CLIUsageError(`Invalid llm model "${model}". It is not present in the central LLM registry.`)
        parsed[field] = model as ParsedLlmModel
        index++
        break
      }
      case '--qa':
        if (parsed.qa !== undefined) throw CLIUsageError('QA can only be specified once')
        parsed.qa = true
        break
      case '--no-qa':
        if (parsed.qa !== undefined) throw CLIUsageError('QA can only be specified once')
        parsed.qa = false
        break
      case '--max-repairs': {
        if (parsed.maxRepairs !== undefined) throw CLIUsageError('Max repairs can only be specified once')
        const value = readFlagValue(args, index, argument)
        if (!/^\d+$/.test(value)) throw CLIUsageError(`Invalid max repairs "${value}". Expected a non-negative integer.`)
        parsed.maxRepairs = Number(value)
        index++
        break
      }
      case '--image-model': {
        if (parsed.imageModels) {
          throw CLIUsageError('Image model can only be specified once')
        }

        parsed.imageModels = parseImageModels(readFlagValue(args, index, argument))
        if (parsed.imageModels.length !== 1) {
          throw CLIUsageError('comic reference-sketch accepts exactly one --image-model')
        }
        index++
        break
      }
      case '--size': {
        parsed.size = parseImageSizeFlag(parsed.size, args, index, argument)
        index++
        break
      }
      case '--quality': {
        parsed.quality = parseImageQualityFlag(parsed.quality, args, index, argument)
        index++
        break
      }
      case '-r':
      case '--revise': {
        if (parsed.revise) {
          throw CLIUsageError('Revise can only be specified once')
        }

        parsed.revise = true
        break
      }
      case '--notes': {
        if (parsed.notes) {
          throw CLIUsageError('Notes can only be specified once')
        }

        parsed.notes = readFlagValue(args, index, argument)
        index++
        break
      }
      case '--concurrency': {
        parsed.concurrency = parseConcurrencyFlag(parsed.concurrency, args, index, argument)
        index++
        break
      }
      default:
        throw CLIUsageError(`Unknown argument: ${argument}`)
    }
  }

  if (!parsed.showHelp && Number(Boolean(parsed.character)) + Number(Boolean(parsed.location)) !== 1) {
    throw CLIUsageError('Exactly one of --character or --location is required')
  }

  if (parsed.character && parsed.view) throw CLIUsageError('--view is only valid with --location')

  validateImageSizeForModels(parsed.size, parsed.imageModels)

  if (parsed.revise && !parsed.notes) {
    throw CLIUsageError('--notes is required when using --revise')
  }

  if (parsed.notes && !parsed.revise) {
    throw CLIUsageError('--notes requires --revise')
  }

  return parsed
}

export const parseGenerateImagesArgs = (args: string[]): ParsedGenerateImagesArgs => {
  const parsed: ParsedGenerateBaseArgs = { showHelp: false }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '-h':
      case '--help':
        parsed.showHelp = true
        break
      case '--price':
        parsed.price = true
        break
      case '--qa':
        if (parsed.qa !== undefined) throw CLIUsageError('QA can only be specified once')
        parsed.qa = true
        break
      case '--no-qa':
        if (parsed.qa !== undefined) throw CLIUsageError('QA can only be specified once')
        parsed.qa = false
        break
      case '--qa-model': {
        if (parsed.qaModel) throw CLIUsageError('QA model can only be specified once')
        const model = readFlagValue(args, index, argument)
        if (findRegistryServiceForModel('llm', model) !== 'openai') throw CLIUsageError(`Invalid QA model "${model}". QA currently requires an OpenAI vision-capable LLM.`)
        parsed.qaModel = model as ParsedLlmModel
        index++
        break
      }
      case '--max-repairs': {
        if (parsed.maxRepairs !== undefined) throw CLIUsageError('Max repairs can only be specified once')
        const value = readFlagValue(args, index, argument)
        if (!/^\d+$/.test(value)) throw CLIUsageError(`Invalid max repairs "${value}". Expected a non-negative integer.`)
        parsed.maxRepairs = Number(value)
        index++
        break
      }
      case '--target': {
        if (parsed.target) {
          throw CLIUsageError('Target can only be specified once')
        }

        const target = readFlagValue(args, index, argument)
        if (!GENERATE_IMAGES_TARGET_OPTIONS.has(target)) {
          throw CLIUsageError(
            `Invalid target "${target}". Expected one of: ${GENERATE_IMAGES_TARGET_VALUES.join(', ')}`
          )
        }

        parsed.target = target as NonNullable<ParsedGenerateBaseArgs['target']>
        index++
        break
      }
      case '--llm-model': {
        parsed.llmModel = parseLlmModelFlag(parsed.llmModel, args, index, argument)
        index++
        break
      }
      case '--concurrency': {
        parsed.concurrency = parseConcurrencyFlag(parsed.concurrency, args, index, argument)
        index++
        break
      }
      case '--panels': {
        if (parsed.panels !== undefined) {
          throw CLIUsageError('Panels can only be specified once')
        }

        parsed.panels = parsePanelSelector(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--panels-per-image': {
        if (parsed.panelsPerImage !== undefined) {
          throw CLIUsageError('Panels per image can only be specified once')
        }

        const panelsPerImage = readFlagValue(args, index, argument)
        if (!isPositiveInteger(panelsPerImage)) {
          throw CLIUsageError(`Invalid panels per image "${panelsPerImage}". Expected a positive integer like 1 or ${DEFAULT_SKETCH_PANELS_PER_IMAGE}`)
        }

        parsed.panelsPerImage = Number(panelsPerImage)
        index++
        break
      }
      case '--grid': {
        if (parsed.grid !== undefined) {
          throw CLIUsageError('Grid can only be specified once')
        }

        parsed.grid = parseComicGridSpec(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--image-model': {
        if (parsed.imageModels) {
          throw CLIUsageError('Image model can only be specified once')
        }

        parsed.imageModels = parseImageModels(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--variation': {
        if (parsed.variations) {
          throw CLIUsageError('Variation can only be specified once')
        }

        parsed.variations = parseImagePromptVariations(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--size': {
        parsed.size = parseImageSizeFlag(parsed.size, args, index, argument)
        index++
        break
      }
      case '--quality': {
        parsed.quality = parseImageQualityFlag(parsed.quality, args, index, argument)
        index++
        break
      }
      case '-f':
      case '--force': {
        if (parsed.force) {
          throw CLIUsageError('Force can only be specified once')
        }

        parsed.force = true
        break
      }
      default: {
        const scriptPath = readTrailingScriptPath(parsed.scriptPath, argument)
        if (scriptPath) {
          parsed.scriptPath = scriptPath
        }
        break
      }
    }
  }

  const target = parsed.target ?? 'images'
  const targetRunsFinalImages = target === 'images' || target === 'both'

  if ((parsed.qa !== undefined || parsed.qaModel || parsed.maxRepairs !== undefined) && !targetRunsFinalImages) throw CLIUsageError('QA options only apply when --target is images or both')
  if (parsed.grid && parsed.panelsPerImage === undefined) throw CLIUsageError('--grid requires --panels-per-image 1')

  parsed.qa ??= true
  parsed.qaModel ??= DEFAULT_QA_MODEL as ParsedLlmModel
  parsed.maxRepairs ??= 2

  if (parsed.variations !== undefined && !targetRunsFinalImages) {
    throw CLIUsageError('--variation only applies when --target is images or both')
  }

  validateImageSizeForModels(parsed.size, parsed.imageModels)
  validateComicGridOptions(parsed.grid, {
    target,
    size: parsed.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: parsed.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  })

  return parsed as ParsedGenerateImagesArgs
}
