import { validateImageReferenceCapabilities } from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'
import { mkdir } from 'node:fs/promises'
import type { JsonObject, ReplicateImageModel, ReplicateImageRequestMode, ReplicateImageSize, Step5Metadata } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/command-shared/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { normalizeReplicateOutputUris, runReplicatePrediction } from '~/utils/replicate-client/replicate-prediction'
import { imageReferenceToUrlOrDataUrl } from '../../image-utils/image-inputs'
import { downloadImageUrl, getImageFileNames } from '../../image-utils/image-output'
import { ensureReplicateImageGenSetup, getReplicateBaseUrl } from './replicate-image-gen'

const REPLICATE_SEEDREAM_MODELS = new Set<ReplicateImageModel>([
  'bytedance/seedream-5-lite',
  'bytedance/seedream-5-pro'
])

const REPLICATE_QWEN_MODELS = new Set<ReplicateImageModel>([
  'alibaba/qwen-image-3',
  'alibaba/qwen-image-3-pro'
])

export const REPLICATE_SEEDREAM_ASPECT_RATIO_VALUES = [
  '1:1',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
  '3:2',
  '2:3',
  '21:9',
  'match_input_image'
] as const

export const REPLICATE_QWEN_ASPECT_RATIO_VALUES = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '2:1',
  '1:2'
] as const

const REPLICATE_SEEDREAM_ASPECT_RATIOS = new Set<string>(REPLICATE_SEEDREAM_ASPECT_RATIO_VALUES)

const REPLICATE_QWEN_ASPECT_RATIOS = new Set<string>(REPLICATE_QWEN_ASPECT_RATIO_VALUES)

export const isReplicateSeedreamModel = (model: ReplicateImageModel): boolean =>
  REPLICATE_SEEDREAM_MODELS.has(model)

export const isReplicateQwenModel = (model: ReplicateImageModel): boolean =>
  REPLICATE_QWEN_MODELS.has(model)

export const normalizeReplicateSeedreamAspectRatio = (
  model: ReplicateImageModel,
  aspectRatio: string | undefined
): string | undefined => {
  if (aspectRatio === undefined || aspectRatio.length === 0) {
    return undefined
  }

  if (REPLICATE_SEEDREAM_ASPECT_RATIOS.has(aspectRatio)) {
    return aspectRatio
  }

  throw UsageError(
    `Invalid --aspect-ratio value "${aspectRatio}" for Replicate/${model}. Supported values: ${Array.from(REPLICATE_SEEDREAM_ASPECT_RATIOS).join(', ')}.`
  )
}

export const normalizeReplicateQwenAspectRatio = (
  model: ReplicateImageModel,
  aspectRatio: string | undefined
): string | undefined => {
  if (aspectRatio === undefined || aspectRatio.length === 0) {
    return undefined
  }

  if (REPLICATE_QWEN_ASPECT_RATIOS.has(aspectRatio)) {
    return aspectRatio
  }

  throw UsageError(
    `Invalid --aspect-ratio value "${aspectRatio}" for Replicate/${model}. Supported values: ${Array.from(REPLICATE_QWEN_ASPECT_RATIOS).join(', ')}.`
  )
}

export const normalizeReplicateSeedreamSize = (
  model: ReplicateImageModel,
  imageSize: string | undefined
): ReplicateImageSize | undefined => {
  if (imageSize === undefined || imageSize.length === 0) {
    return undefined
  }

  const normalized = imageSize.trim()
  const upper = normalized.toUpperCase()

  if (model === 'bytedance/seedream-5-lite' && (upper === '2K' || upper === '3K')) {
    return { requestValue: upper, metadataValue: upper }
  }

  if (model === 'bytedance/seedream-5-pro' && (upper === '1K' || upper === '2K')) {
    return { requestValue: upper, metadataValue: upper }
  }

  if (/^\d+x\d+$/i.test(normalized) || upper === '1K' || upper === '3K' || upper === '4K') {
    const supported = model === 'bytedance/seedream-5-pro' ? '1K or 2K' : '2K or 3K'
    throw UsageError(`--size ${imageSize} is not supported by Replicate/${model}. Supported values: ${supported}.`)
  }

  const supported = model === 'bytedance/seedream-5-pro' ? '1K or 2K' : '2K or 3K'
  throw UsageError(`Invalid --size value "${imageSize}" for Replicate/${model}. Supported values: ${supported}.`)
}

export const normalizeReplicateImageOutputFormat = (
  model: ReplicateImageModel,
  outputFormat: string | undefined
): 'png' | 'jpeg' | undefined => {
  if (outputFormat === undefined || outputFormat.length === 0) {
    return undefined
  }

  const normalized = outputFormat.toLowerCase()
  const supportsFormat = model === 'bytedance/seedream-5-lite'
    || model === 'bytedance/seedream-5-pro'
  if (!supportsFormat) {
    throw UsageError(`--format is supported only by Replicate Seedream 5 image models. Omit --format for Replicate/${model}.`)
  }
  if (normalized === 'png' || normalized === 'jpeg') {
    return normalized
  }

  throw UsageError(`Invalid --format value "${outputFormat}" for Replicate/${model}. Expected png or jpeg.`)
}

export const normalizeReplicateImageCount = (
  model: ReplicateImageModel,
  count: number | undefined
): number => {
  if (count === undefined) {
    return 1
  }

  throw UsageError(`--count is not supported by Replicate/${model}. Omit --count.`)
}

export const getReplicateImageExtension = (
  model: ReplicateImageModel | string,
  outputFormat: string | undefined
): string => {
  if (model === 'bytedance/seedream-5-lite') {
    const format = normalizeReplicateImageOutputFormat(model, outputFormat) ?? 'png'
    return format === 'jpeg' ? 'jpg' : format
  }
  if (model === 'bytedance/seedream-5-pro') {
    const format = normalizeReplicateImageOutputFormat(model, outputFormat) ?? 'png'
    return format === 'jpeg' ? 'jpg' : format
  }
  return 'png'
}

export const buildReplicateImageInput = async (
  prompt: string,
  options: {
    model: ReplicateImageModel
    inputs: string[]
    imageSize?: string | undefined
    aspectRatio?: string | undefined
    count?: number | undefined
    outputFormat?: string | undefined
  }
): Promise<{ input: JsonObject, imageSize?: ReplicateImageSize | undefined, count: number, mode: ReplicateImageRequestMode }> => {
  validateImageReferenceCapabilities(options.model, options.inputs.length, 'replicate')
  const references = await Promise.all(options.inputs.map(imageReferenceToUrlOrDataUrl))
  const mode: ReplicateImageRequestMode = references.length > 0 ? 'edit' : 'generation'

  if (isReplicateSeedreamModel(options.model)) {
    const imageSize = normalizeReplicateSeedreamSize(options.model, options.imageSize)
    const outputFormat = normalizeReplicateImageOutputFormat(options.model, options.outputFormat)
    const aspectRatio = normalizeReplicateSeedreamAspectRatio(options.model, options.aspectRatio)
    normalizeReplicateImageCount(options.model, options.count)
    return {
      input: {
        prompt,
        sequential_image_generation: 'disabled',
        max_images: 1,
        ...(references.length > 0 ? { image_input: references } : {}),
        ...(imageSize?.requestValue ? { size: imageSize.requestValue } : {}),
        ...(imageSize?.width !== undefined ? { width: imageSize.width } : {}),
        ...(imageSize?.height !== undefined ? { height: imageSize.height } : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        ...(outputFormat ? { output_format: outputFormat } : {})
      },
      imageSize,
      count: 1,
      mode
    }
  }

  if (isReplicateQwenModel(options.model)) {
    if (options.imageSize !== undefined) {
      throw UsageError(`--size is not supported by Replicate/${options.model}. Use --aspect-ratio for Qwen image dimensions.`)
    }
    normalizeReplicateImageOutputFormat(options.model, options.outputFormat)
    normalizeReplicateImageCount(options.model, options.count)
    const aspectRatio = normalizeReplicateQwenAspectRatio(options.model, options.aspectRatio)
    return {
      input: {
        prompt,
        match_input_image: references.length > 0,
        ...(references[0] ? { image: references[0] } : {}),
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {})
      },
      count: 1,
      mode
    }
  }

  throw UsageError(`Unsupported Replicate image model "${options.model}".`)
}

const providerReturnedModel = (requestedModel: string, actual: string | undefined): string | undefined =>
  actual && actual.length > 0 && actual !== requestedModel ? actual : undefined

export const runReplicateImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: ReplicateImageModel
    inputs?: string[] | undefined
    imageSize?: string | undefined
    aspectRatio?: string | undefined
    count?: number | undefined
    outputFormat?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiToken = await ensureReplicateImageGenSetup()
  const inputs = options.inputs ?? []
  const { input, imageSize, count, mode } = await buildReplicateImageInput(prompt, {
    model: options.model,
    inputs,
    imageSize: options.imageSize,
    aspectRatio: options.aspectRatio,
    count: options.count,
    outputFormat: options.outputFormat
  })
  const fallbackExt = getReplicateImageExtension(options.model, options.outputFormat)

  const estimate = estimateImageCosts({ replicateImageModels: [options.model], imageCount: count, imageSize: imageSize?.metadataValue ?? options.imageSize })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logGenStatus('image', 'replicate', options.model, 'started', mode)

  const startTime = Date.now()
  await mkdir(outputDir, { recursive: true })

  const prediction = await runReplicatePrediction({
    apiToken,
    baseUrl: getReplicateBaseUrl(),
    model: options.model,
    input,
    operationName: 'replicate-image-gen',
    onStatus: (status) => {
      logGenStatus('image', 'replicate', options.model, status.status)
    }
  })

  const outputUris = normalizeReplicateOutputUris(prediction.output)
  if (outputUris.length === 0) {
    throw InfraError('Replicate image generation completed without output image URLs', { stage: 'image:replicate' })
  }

  const imagePaths = await Promise.all(outputUris.map(async (url, index) =>
    await withRetry(
      { retryClass: 'runtime_http_read', operationName: 'replicate-image-result-download' },
      async (signal) => await downloadImageUrl(url, outputDir, index, fallbackExt, signal),
      (error) => classifyFetchRetry(error, 'runtime_http_read')
    )
  ))

  const processingTime = Date.now() - startTime
  const primaryImagePath = imagePaths[0] as string
  const imageFile = Bun.file(primaryImagePath)
  const returnedModel = providerReturnedModel(options.model, prediction.model ?? prediction.version)

  logGenCompleted('image', 'replicate', options.model, processingTime, imagePaths)

  return {
    imagePaths,
    metadata: {
      imageService: 'replicate',
      imageModel: options.model,
      processingTime,
      imageCount: imagePaths.length,
      imageFileNames: getImageFileNames(imagePaths),
      imageFileSize: imageFile.size,
      imageWidth: imageSize?.width,
      imageHeight: imageSize?.height,
      ...(imageSize?.metadataValue ? { imageSize: imageSize.metadataValue } : {}),
      imageFormat: fallbackExt,
      requestMode: mode,
      ...(returnedModel ? { providerReturnedModel: returnedModel } : {}),
      ...(estimate ? {
        providerCostCents: estimate.totalCost,
        providerCostSource: 'registry_fallback' as const
      } : {})
    }
  }
}
