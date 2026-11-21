import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import type {
  ComicParsedArgs,
  ParsedImageModel,
  ParsedImageQuality,
  ParsedImageSize,
  ParsedLlmModel
} from '~/types'
import {
  IMAGE_GENERATION_QUALITIES,
} from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { UsageError } from '~/utils/error-handler'
import { resolveProviderSelector } from '~/cli/flags/service-selector-normalization/flag-helpers'
import { COMIC_IMAGE_PROVIDER_TARGETS, COMIC_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'

const IMAGE_QUALITY_OPTIONS = new Set<string>(IMAGE_GENERATION_QUALITIES)

export const stringFlag = (parsed: ComicParsedArgs, name: string): string | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  const value = parsed.flags[name]
  return typeof value === 'string' ? value : undefined
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

export const parseImageModel = (value: string): ParsedImageModel => {
  if (!findRegistryServiceForModel('image', value)) {
    throw UsageError(`Invalid image model "${value}". It is not present in the central image registry.`)
  }
  return value as ParsedImageModel
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

// --provider / --<role>-provider carry `provider[=model]`; an omitted model resolves that provider's
// cheapest registered model, matching the "(default: cheapest hosted)" language write/tts already
// use.
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

// Image commands accept exactly one image selector per run. Every raw --provider occurrence is counted
// before any resolution, so repeated, duplicate, and same-provider selectors all fail instead of being
// deduplicated or resolved last-value-wins.
const parseComicImageSelector = (value: string, commandName: string): ParsedImageModel => {
  if (value.includes(',')) throw UsageError(`comic ${commandName} accepts exactly one --provider provider[=model]; received "${value}"`)
  return parseImageModel(resolveSelectorModel(value, 'provider', COMIC_IMAGE_PROVIDER_TARGETS))
}

export const readSingleComicImageSelector = (parsed: ComicParsedArgs, commandName: string): ParsedImageModel | undefined => {
  if (!parsed.rawParsed.explicitFlags.has('provider')) return undefined
  // The parsed array value also carries the flag's declared default, so only raw occurrences count.
  const occurrences = parsed.rawParsed.flagOccurrences.filter((occurrence) => occurrence.name === 'provider')
  if (occurrences.length !== 1) {
    throw UsageError(`comic ${commandName} accepts exactly one --provider; run a separate invocation for each image model`)
  }
  const value = occurrences[0]!.value
  if (typeof value !== 'string' || !value.trim()) throw UsageError(`comic ${commandName} --provider requires provider[=model]`)
  return parseComicImageSelector(value.trim(), commandName)
}

export const parseComicLlmSelector = (value: string, flagName: string): ParsedLlmModel =>
  parseLlmModel(resolveSelectorModel(value, flagName, COMIC_LLM_PROVIDER_TARGETS))

export const assignSharedImageRenderOptions = (
  parsed: ComicParsedArgs,
  output: { size?: ParsedImageSize, quality?: ParsedImageQuality }
): void => {
  const size = stringFlag(parsed, 'size')
  const quality = stringFlag(parsed, 'quality')
  if (size !== undefined) output.size = size as ParsedImageSize
  if (quality !== undefined) output.quality = parseImageQuality(quality)
}
