import type { ImageGenOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const hasEditInputs = (options: Pick<ImageGenOptions, 'imageInputs' | 'imageMask'>): boolean =>
  (options.imageInputs?.length ?? 0) > 0 || options.imageMask !== undefined

export const unsupportedFlagError = (
  provider: string,
  model: string,
  flags: string[],
  alternatives: string
): Error => CLIUsageError(
  `${flags.join(', ')} ${flags.length === 1 ? 'is' : 'are'} not supported by ${provider}/${model}. ${alternatives}`
)

export const validateEnumOption = (
  provider: string,
  model: string,
  flagName: string,
  value: string | undefined,
  supported: ReadonlySet<string>
): void => {
  if (value === undefined) return
  if (!supported.has(value)) {
    throw CLIUsageError(
      `Invalid --${flagName} value "${value}" for ${provider}/${model}. Supported values: ${Array.from(supported).join(', ')}.`
    )
  }
}

export const validateImageCount = (
  provider: string,
  model: string,
  value: number | undefined,
  min: number,
  max: number
): number => {
  const count = value ?? 1
  if (!Number.isInteger(count) || count < min || count > max) {
    throw CLIUsageError(`Invalid --image-count value "${String(value)}" for ${provider}/${model}. Supported range: ${min}-${max}.`)
  }
  return count
}

export const collectUnsupportedCommonFlags = (
  options: ImageGenOptions,
  flagNames: Array<keyof ImageGenOptions>,
  flagLabels: Record<keyof ImageGenOptions, string>
): string[] => flagNames.flatMap((key) => options[key] !== undefined ? [flagLabels[key]] : [])

export const IMAGE_OPTION_LABELS: Record<keyof ImageGenOptions, string> = {
  geminiImageModels: '--gemini-image',
  geminiImageModel: '--gemini-image',
  openaiImageModels: '--openai-image',
  openaiImageModel: '--openai-image',
  grokImageModels: '--grok-image',
  grokImageModel: '--grok-image',
  bflImageModels: '--bfl-image',
  bflImageModel: '--bfl-image',
  recraftImageModels: '--recraft-image',
  recraftImageModel: '--recraft-image',
  replicateImageModels: '--replicate-image',
  replicateImageModel: '--replicate-image',
  lumalabsImageModels: '--lumalabs-image',
  lumalabsImageModel: '--lumalabs-image',
  falImageModels: '--fal-image',
  falImageModel: '--fal-image',
  imageAspectRatio: '--image-aspect-ratio',
  imageSize: '--image-size',
  imageQuality: '--image-quality',
  imageFormat: '--image-format',
  imageBackground: '--image-background',
  imageCount: '--image-count',
  imageInputs: '--image-input',
  imageMask: '--image-mask',
  imageResponseMode: '--image-response-mode',
  geminiSearchGrounding: '--gemini-search-grounding',
  imageCompression: '--image-compression',
  imageProviderConcurrency: '--image-provider-concurrency',
  imageLocalConcurrency: '--image-local-concurrency',
  generationResourceGate: 'generation resource gate'
}
