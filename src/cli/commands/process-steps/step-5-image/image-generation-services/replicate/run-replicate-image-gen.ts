import * as l from '~/utils/app-logger/app-logger'
import { mkdir } from 'node:fs/promises'
import type { JsonObject, ReplicateImageModel, ReplicateImageRequestMode, ReplicateImageSize, Step5Metadata } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { normalizeReplicateOutputUris, runReplicatePrediction } from '~/utils/replicate-client/replicate-prediction'
import { imageReferenceToUrlOrDataUrl } from '../../image-utils/image-inputs'
import { downloadImageUrl, getImageFileNames } from '../../image-utils/image-output'
import { ensureReplicateImageGenSetup, getReplicateBaseUrl } from './replicate-image-gen'

export const REPLICATE_SEEDREAM_MODELS = new Set<ReplicateImageModel>([
  'bytedance/seedream-4.5',
  'bytedance/seedream-5-lite'
])

export const REPLICATE_QWEN_MODELS = new Set<ReplicateImageModel>([
  'qwen/qwen-image-2-pro',
  'qwen/qwen-image-2'
])

export const REPLICATE_WAN_MODELS = new Set<ReplicateImageModel>([
  'wan-video/wan-2.7-image-pro',
  'wan-video/wan-2.7-image'
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

export const REPLICATE_WAN_IMAGE_COUNT_RANGE = [1, 4] as const

const REPLICATE_SEEDREAM_ASPECT_RATIOS = new Set<string>(REPLICATE_SEEDREAM_ASPECT_RATIO_VALUES)

const REPLICATE_QWEN_ASPECT_RATIOS = new Set<string>(REPLICATE_QWEN_ASPECT_RATIO_VALUES)

const normalizeImageDimensions = (
  size: string,
  providerLabel: string,
  options: { min: number, max: number }
): { width: number, height: number } => {
  const match = /^(\d{1,5})x(\d{1,5})$/i.exec(size.trim())
  if (!match) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for ${providerLabel}. Expected WIDTHxHEIGHT, e.g. 1024x1024.`)
  }

  const width = Number.parseInt(match[1]!, 10)
  const height = Number.parseInt(match[2]!, 10)
  if (
    !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width < options.min
    || height < options.min
    || width > options.max
    || height > options.max
  ) {
    throw CLIUsageError(
      `Invalid --image-size value "${size}" for ${providerLabel}. Width and height must each be between ${options.min} and ${options.max} pixels.`
    )
  }

  return { width, height }
}

export const isReplicateSeedreamModel = (model: ReplicateImageModel): boolean =>
  REPLICATE_SEEDREAM_MODELS.has(model)

export const isReplicateQwenModel = (model: ReplicateImageModel): boolean =>
  REPLICATE_QWEN_MODELS.has(model)

export const isReplicateWanModel = (model: ReplicateImageModel): boolean =>
  REPLICATE_WAN_MODELS.has(model)

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

  throw CLIUsageError(
    `Invalid --image-aspect-ratio value "${aspectRatio}" for Replicate/${model}. Supported values: ${Array.from(REPLICATE_SEEDREAM_ASPECT_RATIOS).join(', ')}.`
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

  throw CLIUsageError(
    `Invalid --image-aspect-ratio value "${aspectRatio}" for Replicate/${model}. Supported values: ${Array.from(REPLICATE_QWEN_ASPECT_RATIOS).join(', ')}.`
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

  if (model === 'bytedance/seedream-4.5') {
    if (upper === '2K' || upper === '4K') {
      return { requestValue: upper, metadataValue: upper }
    }

    const dimensions = normalizeImageDimensions(normalized, `Replicate/${model}`, { min: 1024, max: 4096 })
    return {
      requestValue: 'custom',
      width: dimensions.width,
      height: dimensions.height,
      metadataValue: `${dimensions.width}x${dimensions.height}`
    }
  }

  if (upper === '2K' || upper === '3K') {
    return { requestValue: upper, metadataValue: upper }
  }

  if (/^\d+x\d+$/i.test(normalized) || upper === '4K') {
    throw CLIUsageError(`--image-size ${imageSize} is not supported by Replicate/${model}. Supported values: 2K or 3K.`)
  }

  throw CLIUsageError(`Invalid --image-size value "${imageSize}" for Replicate/${model}. Supported values: 2K or 3K.`)
}

export const normalizeReplicateWanSize = (
  model: ReplicateImageModel,
  imageSize: string | undefined,
  hasInputs: boolean
): ReplicateImageSize | undefined => {
  if (imageSize === undefined || imageSize.length === 0) {
    return undefined
  }

  const normalized = imageSize.trim()
  const upper = normalized.toUpperCase()

  if (upper === '1K' || upper === '2K') {
    return { requestValue: upper, metadataValue: upper }
  }

  if (upper === '4K') {
    if (model === 'wan-video/wan-2.7-image-pro' && !hasInputs) {
      return { requestValue: '4K', metadataValue: '4K' }
    }
    throw CLIUsageError(`--image-size 4K is only supported by Replicate/${model} for Wan text-to-image Pro requests without --image-input.`)
  }

  const dimensions = normalizeImageDimensions(normalized, `Replicate/${model}`, { min: 256, max: 4096 })
  return {
    requestValue: `${dimensions.width}*${dimensions.height}`,
    width: dimensions.width,
    height: dimensions.height,
    metadataValue: `${dimensions.width}x${dimensions.height}`
  }
}

export const normalizeReplicateImageOutputFormat = (
  model: ReplicateImageModel,
  outputFormat: string | undefined
): 'png' | 'jpeg' | undefined => {
  if (outputFormat === undefined || outputFormat.length === 0) {
    return undefined
  }

  const normalized = outputFormat.toLowerCase()
  if (model !== 'bytedance/seedream-5-lite') {
    throw CLIUsageError(`--image-format is only supported by Replicate/bytedance/seedream-5-lite. Omit --image-format for Replicate/${model}.`)
  }
  if (normalized === 'png' || normalized === 'jpeg') {
    return normalized
  }

  throw CLIUsageError(`Invalid --image-format value "${outputFormat}" for Replicate/${model}. Expected png or jpeg.`)
}

export const normalizeReplicateImageCount = (
  model: ReplicateImageModel,
  count: number | undefined
): number => {
  if (count === undefined) {
    return 1
  }

  if (!isReplicateWanModel(model)) {
    throw CLIUsageError(`--image-count is only supported by Replicate Wan image models. Omit --image-count for Replicate/${model}.`)
  }

  const [minCount, maxCount] = REPLICATE_WAN_IMAGE_COUNT_RANGE
  if (!Number.isInteger(count) || count < minCount || count > maxCount) {
    throw CLIUsageError(`Invalid --image-count value "${String(count)}" for Replicate/${model}. Supported range: ${minCount}-${maxCount}.`)
  }

  return count
}

export const getReplicateImageExtension = (
  model: ReplicateImageModel | string,
  outputFormat: string | undefined
): string => {
  if (model === 'bytedance/seedream-4.5') return 'jpg'
  if (model === 'bytedance/seedream-5-lite') {
    const format = normalizeReplicateImageOutputFormat(model, outputFormat) ?? 'png'
    return format === 'jpeg' ? 'jpg' : format
  }
  return 'png'
}

const buildReplicateImageInput = async (
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
      throw CLIUsageError(`--image-size is not supported by Replicate/${options.model}. Use --image-aspect-ratio for Qwen image dimensions.`)
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

  if (options.aspectRatio !== undefined) {
    throw CLIUsageError(`--image-aspect-ratio is not supported by Replicate/${options.model}. Use --image-size 1K|2K|4K or WIDTHxHEIGHT for Wan dimensions.`)
  }
  normalizeReplicateImageOutputFormat(options.model, options.outputFormat)
  const imageSize = normalizeReplicateWanSize(options.model, options.imageSize, references.length > 0)
  const count = normalizeReplicateImageCount(options.model, options.count)
  return {
    input: {
      prompt,
      ...(references.length > 0 ? { images: references } : {}),
      ...(imageSize?.requestValue ? { size: imageSize.requestValue } : {}),
      ...(count !== 1 ? { num_outputs: count } : {})
    },
    imageSize,
    count,
    mode
  }
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
    baseUrl?: string | undefined
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

  const estimate = estimateImageCosts({ replicateImageModel: options.model, imageCount: count })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'replicate',
    model: options.model,
    status: 'started',
    detail: mode
  })

  const startTime = Date.now()
  await mkdir(outputDir, { recursive: true })

  const prediction = await runReplicatePrediction({
    apiToken,
    baseUrl: getReplicateBaseUrl(options.baseUrl),
    model: options.model,
    input,
    operationName: 'replicate-image-gen',
    onStatus: (status) => {
      logMediaGenerationStatus(l, {
        mediaType: 'image',
        provider: 'replicate',
        model: options.model,
        status: status.status
      })
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
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )
  ))

  const processingTime = Date.now() - startTime
  const primaryImagePath = imagePaths[0] as string
  const imageFile = Bun.file(primaryImagePath)
  const returnedModel = providerReturnedModel(options.model, prediction.model ?? prediction.version)

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'replicate',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: imagePaths.length,
    artifacts: imagePaths.map((imagePath, index) => ({
      artifact: index === 0 ? 'image' : `image ${index + 1}`,
      path: imagePath
    }))
  })

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
