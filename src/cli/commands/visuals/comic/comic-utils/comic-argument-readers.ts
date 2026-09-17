import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type {
  ComicParsedArgs,
  ParsedGenerateBaseArgs,
  ParsedImageModel,
  ParsedImageQuality,
  ParsedImageSize,
  ParsedLlmModel,
  ParsedReferenceSketchArgs
} from '~/types'
import {
  IMAGE_GENERATION_QUALITIES,
} from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { UsageError } from '~/utils/error-handler'
import { resolveProviderSelector } from '~/cli/flags/service-selector-normalization/flag-helpers'
import { COMIC_IMAGE_PROVIDER_TARGETS, COMIC_LLM_PROVIDER_TARGETS, COMIC_QA_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'

const IMAGE_QUALITY_OPTIONS = new Set<string>(IMAGE_GENERATION_QUALITIES)

export const stringFlag = (parsed: ComicParsedArgs, name: string): string | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  const value = parsed.flags[name]
  return typeof value === 'string' ? value : undefined
}

export const stringListFlag = (parsed: ComicParsedArgs, name: string): string[] | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  return parsed.rawParsed.flagOccurrences
    .filter((occurrence) => occurrence.name === name && typeof occurrence.value === 'string')
    .map((occurrence) => occurrence.value as string)
}

export const enabledFlag = (parsed: ComicParsedArgs, name: string): boolean | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  return parsed.flags[name] === true
}

export const readScriptPath = (parsed: ComicParsedArgs): string | undefined => {
  const scriptPath = parsed.parameters['script-path']
  return typeof scriptPath === 'string' ? scriptPath : undefined
}

export const isPositiveInteger = (value: string): boolean =>
  /^\d+$/.test(value) && Number(value) > 0

export const parseConcurrencyValue = (value: string): number => {
  if (!isPositiveInteger(value)) {
    throw UsageError(`Invalid concurrency "${value}". Expected a positive integer like 1 or ${DEFAULT_CLI_CONCURRENCY}`)
  }
  return Number(value)
}

export const parseImageModels = (value: string): ParsedImageModel[] => {
  const rawModels = value.split(',').map(model => model.trim())
  if (rawModels.some(model => model.length === 0)) {
    throw UsageError(
      `Invalid image model list "${value}". Expected one or more comma-separated image model ids from the central image registry.`
    )
  }

  const parsedModels: ParsedImageModel[] = []
  const seenModels = new Set<string>()
  for (const model of rawModels) {
    if (!findRegistryServiceForModel('image', model)) {
      throw UsageError(`Invalid image model "${model}". It is not present in the central image registry.`)
    }
    if (seenModels.has(model)) {
      throw UsageError(`Duplicate image model "${model}" is not allowed`)
    }
    seenModels.add(model)
    parsedModels.push(model as ParsedImageModel)
  }
  return parsedModels
}

export const parseLlmModel = (value: string): ParsedLlmModel => {
  if (!findRegistryServiceForModel('llm', value)) {
    throw UsageError(`Invalid llm model "${value}". It is not present in the central LLM registry.`)
  }
  return value as ParsedLlmModel
}

export const parseImageQuality = (value: string): ParsedImageQuality => {
  if (!IMAGE_QUALITY_OPTIONS.has(value)) {
    throw UsageError(`Invalid quality "${value}". Expected one of: ${IMAGE_GENERATION_QUALITIES.join(', ')}`)
  }
  return value as ParsedImageQuality
}

export const parseMaxRepairs = (value: string): number => {
  if (!/^\d+$/.test(value)) {
    throw UsageError(`Invalid max repairs "${value}". Expected a non-negative integer.`)
  }
  return Number(value)
}

// --provider / --<role>-provider carry `provider[=model]`; an omitted model resolves that provider's
// cheapest registered model, matching the "(default: cheapest hosted)" language write/tts already
// use. The parsed option fields stay imageModels/llmModel/qaModel so downstream consumers are
// untouched.
const resolveSelectorModel = (
  value: string,
  flagName: string,
  targets: Readonly<Record<string, string>>
): string => {
  const { target, model } = resolveProviderSelector(value, flagName, targets, new Set())
  if (model !== true) return model
  const cheapest = resolveCheapestModelForFlag(target)
  if (cheapest === undefined) {
    throw UsageError(`--${flagName} ${value} has no registered model to select; pass provider=model.`)
  }
  return cheapest
}

export const parseComicImageSelectors = (values: readonly string[]): ParsedImageModel[] =>
  parseImageModels(values.map((value) => resolveSelectorModel(value, 'provider', COMIC_IMAGE_PROVIDER_TARGETS)).join(','))

export const parseComicLlmSelector = (value: string, flagName: string): ParsedLlmModel =>
  parseLlmModel(resolveSelectorModel(value, flagName, COMIC_LLM_PROVIDER_TARGETS))

export const parseComicQaSelector = (value: string, flagName: string): ParsedLlmModel =>
  parseLlmModel(resolveSelectorModel(value, flagName, COMIC_QA_PROVIDER_TARGETS))

export const assignSharedImageOptions = (
  parsed: ComicParsedArgs,
  output: ParsedGenerateBaseArgs | ParsedReferenceSketchArgs
): void => {
  const imageProviders = stringListFlag(parsed, 'provider')
  const size = stringFlag(parsed, 'size')
  const quality = stringFlag(parsed, 'quality')
  if (imageProviders !== undefined) output.imageModels = parseComicImageSelectors(imageProviders)
  if (size !== undefined) output.size = size as ParsedImageSize
  if (quality !== undefined) output.quality = parseImageQuality(quality)
}
