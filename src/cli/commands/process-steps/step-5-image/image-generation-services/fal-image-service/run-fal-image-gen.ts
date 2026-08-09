import * as l from '~/utils/app-logger/app-logger'
import { mkdir } from 'node:fs/promises'
import type { FalImageModel, Step5Metadata } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '../../image-utils/image-pricing'
import { imageReferenceToUrlOrDataUrl } from '../../image-utils/image-inputs'
import { downloadImageUrl } from '../../image-utils/image-output'
import { runFalQueue } from '~/utils/fal-client/fal-queue'
import { ensureFalImageGenSetup } from './fal-image-gen'

export const FAL_IMAGE_FORMATS = ['png', 'jpeg', 'webp'] as const
export const FAL_IMAGE_COUNT_RANGE = [1, 4] as const
export const FAL_MAI_ASPECT_RATIOS = ['auto', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'] as const
export const FAL_REVE_ASPECT_RATIOS = ['4:1', '3:1', '21:9', '2:1', '17:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '1:2', '1:3', '1:4', 'auto'] as const

type FalImageFile = { url?: unknown, content_type?: unknown }
type FalImageOutput = { images?: unknown }

const normalizeFormat = (format: string | undefined): typeof FAL_IMAGE_FORMATS[number] | undefined => {
  if (!format) return undefined
  const normalized = format.toLowerCase()
  if ((FAL_IMAGE_FORMATS as readonly string[]).includes(normalized)) return normalized as typeof FAL_IMAGE_FORMATS[number]
  throw CLIUsageError(`Invalid --image-format value "${format}" for fal.ai. Expected png, jpeg, or webp.`)
}

const normalizeCount = (count: number | undefined): number => {
  if (count === undefined) return 1
  if (!Number.isInteger(count) || count < FAL_IMAGE_COUNT_RANGE[0] || count > FAL_IMAGE_COUNT_RANGE[1]) {
    throw CLIUsageError(`Invalid --image-count value "${String(count)}" for fal.ai. Supported range: 1-4.`)
  }
  return count
}

const normalizeDimensions = (size: string | undefined, model: FalImageModel, editing: boolean): { width: number, height: number } | undefined => {
  if (!size) return undefined
  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(size.trim())
  if (!match) throw CLIUsageError(`Invalid --image-size value "${size}" for fal.ai/${model}. Expected WIDTHxHEIGHT.`)
  const width = Number(match[1])
  const height = Number(match[2])
  const max = model === 'alibaba/qwen-image-3' && editing ? 1440 : 2048
  const min = model === 'alibaba/qwen-image-3' ? 512 : 256
  if (width < min || height < min || width > max || height > max) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for fal.ai/${model}. Each edge must be between ${min} and ${max} pixels.`)
  }
  if (model === 'fal-ai/hidream-o1-image' && (width % 32 !== 0 || height % 32 !== 0)) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for fal.ai/${model}. Width and height must be multiples of 32.`)
  }
  return { width, height }
}

export const normalizeFalImageAspectRatio = (model: FalImageModel, ratio: string | undefined): string | undefined => {
  if (!ratio) return undefined
  const allowed = model === 'reve/2.1' ? FAL_REVE_ASPECT_RATIOS : FAL_MAI_ASPECT_RATIOS
  if ((allowed as readonly string[]).includes(ratio)) return ratio
  throw CLIUsageError(`Invalid --image-aspect-ratio value "${ratio}" for fal.ai/${model}. Supported values: ${allowed.join(', ')}.`)
}

export const getFalImageExtension = (format: string | undefined): string => {
  const normalized = normalizeFormat(format) ?? 'png'
  return normalized === 'jpeg' ? 'jpg' : normalized
}

const buildRequest = async (prompt: string, options: {
  model: FalImageModel
  inputs: string[]
  imageSize?: string | undefined
  aspectRatio?: string | undefined
  count?: number | undefined
  outputFormat?: string | undefined
}): Promise<{ endpointId: string, input: Record<string, unknown>, count: number, mode: 'generation' | 'edit', metadataSize?: string | undefined }> => {
  const references = await Promise.all(options.inputs.map(imageReferenceToUrlOrDataUrl))
  const editing = references.length > 0
  const format = normalizeFormat(options.outputFormat)
  const count = normalizeCount(options.count)
  const dimensions = normalizeDimensions(options.imageSize, options.model, editing)

  if (options.model === 'fal-ai/hidream-o1-image') {
    if (options.aspectRatio) throw CLIUsageError(`--image-aspect-ratio is not supported by fal.ai/${options.model}; use --image-size WIDTHxHEIGHT.`)
    return {
      endpointId: options.model,
      input: { prompt, ...(references.length ? { reference_image_urls: references } : {}), ...(dimensions ? { image_size: dimensions } : {}), num_images: count, ...(format ? { output_format: format } : {}) },
      count,
      mode: editing ? 'edit' : 'generation',
      ...(dimensions ? { metadataSize: `${dimensions.width}x${dimensions.height}` } : {})
    }
  }

  if (options.model === 'microsoft/mai-image-2.5' || options.model === 'microsoft/mai-image-2.5-pro') {
    if (editing) throw CLIUsageError(`--image-input is not supported by fal.ai/${options.model}; MAI Image 2.5 endpoints are text-to-image only.`)
    if (options.imageSize) throw CLIUsageError(`--image-size is not supported by fal.ai/${options.model}; use --image-aspect-ratio.`)
    const aspectRatio = normalizeFalImageAspectRatio(options.model, options.aspectRatio)
    return { endpointId: options.model, input: { prompt, num_images: count, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}), ...(format ? { output_format: format } : {}) }, count, mode: 'generation' }
  }

  if (options.model === 'alibaba/qwen-image-3') {
    if (options.aspectRatio) throw CLIUsageError(`--image-aspect-ratio is not supported by fal.ai/${options.model}; use --image-size WIDTHxHEIGHT.`)
    if (references.length > 3) throw CLIUsageError(`--image-input supports at most 3 reference images for fal.ai/${options.model}.`)
    return {
      endpointId: `${options.model}/${editing ? 'edit' : 'text-to-image'}`,
      input: { prompt, ...(editing ? { image_urls: references } : {}), ...(dimensions ? { image_size: dimensions } : {}), num_images: count, ...(format ? { output_format: format } : {}) },
      count,
      mode: editing ? 'edit' : 'generation',
      ...(dimensions ? { metadataSize: `${dimensions.width}x${dimensions.height}` } : {})
    }
  }

  if (references.length > 1) throw CLIUsageError(`--image-input supports at most 1 reference image for fal.ai/${options.model}.`)
  if (options.imageSize) throw CLIUsageError(`--image-size is not supported by fal.ai/${options.model}; use --image-aspect-ratio.`)
  const aspectRatio = normalizeFalImageAspectRatio(options.model, options.aspectRatio)
  return {
    endpointId: `reve/2.1/${editing ? 'edit' : 'text-to-image'}`,
    input: { prompt, ...(editing ? { image_url: references[0] } : {}), num_images: count, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}), ...(format ? { output_format: format } : {}) },
    count,
    mode: editing ? 'edit' : 'generation'
  }
}

export const runFalImageGen = async (prompt: string, outputDir: string, options: {
  model: FalImageModel
  inputs?: string[] | undefined
  imageSize?: string | undefined
  aspectRatio?: string | undefined
  count?: number | undefined
  outputFormat?: string | undefined
  /** Test-only override that keeps queue-polling contract tests fast. */
  pollIntervalMs?: number | undefined
}): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  if (!prompt.trim()) throw CLIUsageError('fal.ai image prompt cannot be empty.')
  const apiKey = await ensureFalImageGenSetup()
  const request = await buildRequest(prompt, { ...options, inputs: options.inputs ?? [] })
  const estimate = estimateImageCosts({ falImageModel: options.model, imageCount: request.count, imageSize: request.metadataSize ?? options.imageSize })[0]
  if (estimate) logImageEstimate(estimate)
  logMediaGenerationStatus(l, { mediaType: 'image', provider: 'fal', model: options.model, status: 'started', detail: request.mode })
  const startTime = Date.now()
  await mkdir(outputDir, { recursive: true })
  const result = await runFalQueue<FalImageOutput>({
    apiKey,
    endpointId: request.endpointId,
    input: request.input,
    pollIntervalMs: options.pollIntervalMs,
    operationName: 'fal-image-gen',
    onStatus: status => logMediaGenerationStatus(l, { mediaType: 'image', provider: 'fal', model: options.model, status: status.status })
  })
  if (!Array.isArray(result.output.images)) throw InfraError('fal.ai image generation completed without images', { stage: 'image:fal' })
  const files = result.output.images.filter((value): value is FalImageFile => Boolean(value) && typeof value === 'object' && typeof (value as FalImageFile).url === 'string')
  if (files.length === 0) throw InfraError('fal.ai image generation completed without image URLs', { stage: 'image:fal' })
  const extension = getFalImageExtension(options.outputFormat)
  const imagePaths = await Promise.all(files.map(async (file, index) => await downloadImageUrl(file.url as string, outputDir, index, extension)))
  const processingTime = Date.now() - startTime
  const outputDimensions = request.metadataSize?.split('x').map(Number)
  logMediaGenerationStatus(l, { mediaType: 'image', provider: 'fal', model: options.model, status: 'completed', processingTimeMs: processingTime, outputCount: imagePaths.length, artifacts: imagePaths.map((path, index) => ({ artifact: index ? `image ${index + 1}` : 'image', path })) })
  return {
    imagePaths,
    metadata: {
      imageService: 'fal',
      imageModel: options.model,
      imageFileNames: imagePaths.map(path => path.split('/').pop()!),
      imageFileSize: Bun.file(imagePaths[0]!).size,
      imageWidth: outputDimensions?.[0],
      imageHeight: outputDimensions?.[1],
      imageCount: imagePaths.length,
      processingTime,
      requestMode: request.mode,
      ...(request.metadataSize ? { imageSize: request.metadataSize } : {}),
      ...(options.aspectRatio ? { imageAspectRatio: options.aspectRatio } : {}),
      imageFormat: extension,
      ...(estimate ? { providerCostCents: estimate.totalCost, providerCostSource: 'registry_fallback' as const } : {})
    }
  }
}
