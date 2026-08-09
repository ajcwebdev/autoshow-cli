import { mkdir } from 'node:fs/promises'
import type { OpenAIImageResponse, RecraftImageModel, Step5Metadata } from '~/types'
import { CLIUsageError, ValidationError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { openAIJsonRequest } from '~/utils/openai/openai-client'
import {
  getImageFileNames,
  getProviderReturnedModel,
  writeOpenAIImageResponseData
} from '../../image-utils/image-output'
import { ensureRecraftImageGenSetup, getRecraftBaseUrl } from './recraft-image-gen'

export const RECRAFT_IMAGE_COUNT_RANGE = [1, 6] as const

export const RECRAFT_ASPECT_RATIOS = [
  '1:1',
  '2:1',
  '1:2',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
  '5:4',
  '4:5',
  '6:10',
  '14:10',
  '10:14',
  '16:9',
  '9:16'
] as const

const RECRAFT_STANDARD_RASTER_SIZES = [
  '1024x1024',
  '1536x768',
  '768x1536',
  '1280x832',
  '832x1280',
  '1216x896',
  '896x1216',
  '1152x896',
  '896x1152',
  '832x1344',
  '1280x896',
  '896x1280',
  '1344x768',
  '768x1344'
] as const

const RECRAFT_PRO_RASTER_SIZES = [
  '2048x2048',
  '3072x1536',
  '1536x3072',
  '2560x1664',
  '1664x2560',
  '2432x1792',
  '1792x2432',
  '2304x1792',
  '1792x2304',
  '1664x2688',
  '2560x1792',
  '1792x2560',
  '2688x1536',
  '1536x2688'
] as const

const RECRAFT_STANDARD_RASTER_MODELS = new Set<RecraftImageModel>([
  'recraftv4_1',
  'recraftv4_1_utility'
])

const RECRAFT_PRO_RASTER_MODELS = new Set<RecraftImageModel>([
  'recraftv4_1_pro',
  'recraftv4_1_utility_pro'
])

const supportedSizeValuesForModel = (model: RecraftImageModel): readonly string[] => {
  if (RECRAFT_STANDARD_RASTER_MODELS.has(model)) {
    return [...RECRAFT_ASPECT_RATIOS, ...RECRAFT_STANDARD_RASTER_SIZES]
  }
  if (RECRAFT_PRO_RASTER_MODELS.has(model)) {
    return [...RECRAFT_ASPECT_RATIOS, ...RECRAFT_PRO_RASTER_SIZES]
  }
  return RECRAFT_ASPECT_RATIOS
}

export const normalizeRecraftImageSize = (
  model: RecraftImageModel,
  imageSize: string | undefined,
  aspectRatio?: string | undefined
): string | undefined => {
  if (imageSize !== undefined && aspectRatio !== undefined) {
    throw CLIUsageError(`--image-size and --image-aspect-ratio cannot be used together for Recraft/${model}. Both map to Recraft's size field.`)
  }

  const rawValue = imageSize ?? aspectRatio
  if (rawValue === undefined || rawValue.length === 0) {
    return undefined
  }

  const value = rawValue.trim().toLowerCase()
  const supported = supportedSizeValuesForModel(model)
  if (supported.includes(value)) {
    return value
  }

  const flagName = imageSize !== undefined ? '--image-size' : '--image-aspect-ratio'
  throw CLIUsageError(
    `Invalid ${flagName} value "${rawValue}" for Recraft/${model}. Supported values: ${supported.join(', ')}.`
  )
}

export const runRecraftImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: RecraftImageModel
    count?: number | undefined
    imageSize?: string | undefined
    aspectRatio?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiToken = await ensureRecraftImageGenSetup()
  const count = Math.max(1, options.count ?? 1)
  const size = normalizeRecraftImageSize(options.model, options.imageSize, options.aspectRatio)
  const fallbackExt = 'png'

  const estimate = estimateImageCosts({ recraftImageModel: options.model, imageCount: count })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logGenStatus('image', 'recraft', options.model, 'started', 'generation')

  const startTime = Date.now()
  await mkdir(outputDir, { recursive: true })

  const result = await openAIJsonRequest<OpenAIImageResponse>(
    { apiKey: apiToken, baseURL: getRecraftBaseUrl() },
    '/images/generations',
    {
      prompt,
      model: options.model,
      response_format: 'url',
      n: count,
      ...(size ? { size } : {})
    },
    { errorMessagePrefix: 'Recraft image generation failed' }
  )

  const imagePaths = await writeOpenAIImageResponseData(result, outputDir, fallbackExt)
  if (imagePaths.length === 0) {
    throw ValidationError('No image data in Recraft response', { stage: 'image:recraft' })
  }

  const processingTime = Date.now() - startTime
  const primaryImagePath = imagePaths[0] as string
  const imageFile = Bun.file(primaryImagePath)

  logGenCompleted('image', 'recraft', options.model, processingTime, imagePaths)

  return {
    imagePaths,
    metadata: {
      imageService: 'recraft',
      imageModel: options.model,
      processingTime,
      imageCount: imagePaths.length,
      imageFileNames: getImageFileNames(imagePaths),
      imageFileSize: imageFile.size,
      imageWidth: undefined,
      imageHeight: undefined,
      ...(size ? { imageSize: size } : {}),
      imageFormat: fallbackExt,
      requestMode: 'generation',
      ...(getProviderReturnedModel(options.model, result) ? { providerReturnedModel: getProviderReturnedModel(options.model, result) } : {})
    }
  }
}
