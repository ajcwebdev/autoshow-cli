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

export const assignSharedImageOptions = (
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
