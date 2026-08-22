import type { ImageGenOptions, UnsupportedImageFlagSpec } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const hasEditInputs = (options: Pick<ImageGenOptions, 'imageInputs' | 'imageMask'>): boolean =>
  (options.imageInputs?.length ?? 0) > 0 || options.imageMask !== undefined

export const unsupportedFlagError = (
  provider: string,
  model: string,
  flags: string[],
  alternatives: string
): Error => UsageError(
  `${flags.join(', ')} ${flags.length === 1 ? 'is' : 'are'} not supported by ${provider}/${model}. ${alternatives}`
)

export const assertNoUnsupportedFlags = (
  options: ImageGenOptions,
  spec: readonly UnsupportedImageFlagSpec[],
  context: { provider: string, model: string, hint: string }
): void => {
  const flags = spec.flatMap((entry) => {
    const key = typeof entry === 'string' ? entry : entry.key
    const value = options[key]
    const unsupported = typeof entry === 'string'
      ? value !== undefined && value !== false
      : entry.when(value)
    return unsupported ? [IMAGE_OPTION_LABELS[key]] : []
  })
  if (flags.length > 0) {
    throw unsupportedFlagError(context.provider, context.model, flags, context.hint)
  }
}

export const validateEnumOption = (
  provider: string,
  model: string,
  flagName: string,
  value: string | undefined,
  supported: ReadonlySet<string>
): void => {
  if (value === undefined) return
  if (!supported.has(value)) {
    throw UsageError(
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
    throw UsageError(`Invalid --count value "${String(value)}" for ${provider}/${model}. Supported range: ${min}-${max}.`)
  }
  return count
}

const IMAGE_OPTION_LABELS = {
  geminiImageModels: '--gemini-image',
  openaiImageModels: '--openai-image',
  grokImageModels: '--grok-image',
  bflImageModels: '--bfl-image',
  replicateImageModels: '--replicate-image',
  lumalabsImageModels: '--lumalabs-image',
  falImageModels: '--fal-image',
  imageAspectRatio: '--aspect-ratio',
  imageSize: '--size',
  imageQuality: '--quality',
  imageFormat: '--format',
  imageBackground: '--background',
  imageCount: '--count',
  imageInputs: '--input',
  imageMask: '--mask',
  imageResponseMode: '--response-mode',
  geminiSearchGrounding: '--search-grounding',
  imageCompression: '--compression',
  imageProviderConcurrency: '--image-provider-concurrency',
  imageLocalConcurrency: '--image-local-concurrency',
  concurrencyMode: '--concurrency-mode',
  hostedConcurrencyCoordinator: 'hosted concurrency coordinator',
  generationResourceGate: 'generation resource gate'
}

export const normalizeImageOutputFormat = <TFormat extends string>(
  format: string | undefined,
  policy: { allowed: readonly TFormat[], fallback: TFormat, providerLabel: string, expected: string }
): TFormat => {
  if (format === undefined || format.length === 0) {
    return policy.fallback
  }

  const normalized = format.toLowerCase()
  if ((policy.allowed as readonly string[]).includes(normalized)) {
    return normalized as TFormat
  }

  throw UsageError(`Invalid --format value "${format}" for ${policy.providerLabel}. Expected ${policy.expected}.`)
}
