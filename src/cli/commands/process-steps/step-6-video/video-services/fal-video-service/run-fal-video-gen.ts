import * as l from '~/utils/app-logger/app-logger'
import { mkdir } from 'node:fs/promises'
import type { FalVideoModel, FalVideoOutput, Step6VideoMetadata, VideoMode } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '../../video-utils/video-pricing'
import { videoMediaReferenceToUrlOrDataUrl } from '../../video-utils/video-media-inputs'
import { downloadVideoOutputBytes } from '../../video-utils/video-output-download'
import { runFalQueue } from '~/utils/fal-client/fal-queue'
import { ensureFalVideoGenSetup } from './fal-video-gen'

export const FAL_H3_RESOLUTIONS = ['768p', '2k'] as const
export const FAL_H3_ASPECT_RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const
export const FAL_PIXVERSE_RESOLUTIONS = ['360p', '540p', '720p', '1080p'] as const
export const FAL_PIXVERSE_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '2:3', '3:2', '21:9'] as const

export const normalizeFalVideoDuration = (model: FalVideoModel, value: number | undefined): number => {
  const duration = value ?? 5
  const min = model === 'minimax/h3' ? 5 : 1
  if (!Number.isInteger(duration) || duration < min || duration > 15) throw CLIUsageError(`Invalid --video-duration value "${String(value)}" for fal.ai/${model}. Supported range: ${min}-15 seconds.`)
  return duration
}

export const normalizeFalVideoResolution = (model: FalVideoModel, value: string | undefined): string => {
  const normalized = value?.toLowerCase() ?? (model === 'minimax/h3' ? '2k' : '720p')
  const allowed = model === 'minimax/h3' ? FAL_H3_RESOLUTIONS : FAL_PIXVERSE_RESOLUTIONS
  if (!(allowed as readonly string[]).includes(normalized)) throw CLIUsageError(`Invalid --video-resolution value "${value}" for fal.ai/${model}. Supported values: ${allowed.join(', ')}.`)
  return model === 'minimax/h3' ? normalized.toUpperCase() : normalized
}

export const normalizeFalVideoAspectRatio = (model: FalVideoModel, value: string | undefined, mode: VideoMode): string | undefined => {
  if (!value) return undefined
  if (model === 'minimax/h3' && mode === 'image-to-video') throw CLIUsageError(`--video-aspect-ratio is not supported by fal.ai/${model} image-to-video; output follows the first frame.`)
  const allowed = model === 'minimax/h3' ? FAL_H3_ASPECT_RATIOS : FAL_PIXVERSE_ASPECT_RATIOS
  if (!(allowed as readonly string[]).includes(value)) throw CLIUsageError(`Invalid --video-aspect-ratio value "${value}" for fal.ai/${model}. Supported values: ${allowed.join(', ')}.`)
  return value
}

const buildFalVideoRequest = async (prompt: string, options: {
  model: FalVideoModel
  mode: VideoMode
  duration?: number | undefined
  resolution?: string | undefined
  aspectRatio?: string | undefined
  inputImage?: string | undefined
  lastFrame?: string | undefined
  referenceImages?: string[] | undefined
  referenceVideos?: string[] | undefined
  referenceAudios?: string[] | undefined
  generateAudio?: boolean | undefined
}): Promise<{ endpointId: string, input: Record<string, unknown>, duration: number, resolution: string, aspectRatio?: string | undefined }> => {
  const duration = normalizeFalVideoDuration(options.model, options.duration)
  const resolution = normalizeFalVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeFalVideoAspectRatio(options.model, options.aspectRatio, options.mode)
  const image = options.inputImage ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image') : undefined
  const lastFrame = options.lastFrame ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrame, 'image') : undefined
  const referenceImages = await Promise.all((options.referenceImages ?? []).map(value => videoMediaReferenceToUrlOrDataUrl(value, 'image')))
  const referenceVideos = await Promise.all((options.referenceVideos ?? []).map(value => videoMediaReferenceToUrlOrDataUrl(value, 'video')))
  const referenceAudios = await Promise.all((options.referenceAudios ?? []).map(value => videoMediaReferenceToUrlOrDataUrl(value, 'audio')))

  if (options.model === 'minimax/h3') {
    if (options.generateAudio !== undefined) throw CLIUsageError(`--video-generate-audio is not configurable for fal.ai/${options.model}; H3 generates native audio according to its model behavior.`)
    if (options.mode === 'text') return { endpointId: 'minimax/h3/text-to-video', input: { prompt, duration, resolution, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) }, duration, resolution, aspectRatio }
    if (options.mode === 'image-to-video' || options.mode === 'interpolate') return { endpointId: 'minimax/h3/image-to-video', input: { prompt, duration, resolution, image_url: image, ...(lastFrame ? { end_image_url: lastFrame } : {}) }, duration, resolution }
    return {
      endpointId: 'minimax/h3/reference-to-video',
      input: { prompt, duration, resolution, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}), ...(referenceImages.length ? { reference_image_urls: referenceImages } : {}), ...(referenceVideos.length ? { reference_video_urls: referenceVideos } : {}), ...(referenceAudios.length ? { reference_audio_urls: referenceAudios } : {}) },
      duration,
      resolution,
      aspectRatio
    }
  }

  const common = { prompt, duration, resolution, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}), ...(options.generateAudio !== undefined ? { generate_audio_switch: options.generateAudio } : {}) }
  if (options.mode === 'text') return { endpointId: 'fal-ai/pixverse/c1/text-to-video', input: common, duration, resolution, aspectRatio }
  if (options.mode === 'image-to-video') return { endpointId: 'fal-ai/pixverse/c1/image-to-video', input: { ...common, image_url: image }, duration, resolution }
  if (options.mode === 'interpolate') return { endpointId: 'fal-ai/pixverse/c1/transition', input: { ...common, first_image_url: image, end_image_url: lastFrame }, duration, resolution, aspectRatio }
  return {
    endpointId: 'fal-ai/pixverse/c1/reference-to-video',
    input: { ...common, image_references: referenceImages.map((imageUrl, index) => ({ image_url: imageUrl, type: 'subject', ref_name: `image${index + 1}` })) },
    duration,
    resolution,
    aspectRatio
  }
}

export const runFalVideoGen = async (prompt: string, outputDir: string, options: {
  model: FalVideoModel
  mode: VideoMode
  duration?: number | undefined
  resolution?: string | undefined
  aspectRatio?: string | undefined
  inputImage?: string | undefined
  lastFrame?: string | undefined
  referenceImages?: string[] | undefined
  referenceVideos?: string[] | undefined
  referenceAudios?: string[] | undefined
  generateAudio?: boolean | undefined
  pollIntervalMs?: number | undefined
}): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  if (!prompt.trim()) throw CLIUsageError('fal.ai video prompt cannot be empty.')
  const apiKey = await ensureFalVideoGenSetup()
  const request = await buildFalVideoRequest(prompt, options)
  const estimate = estimateVideoCost({ falVideoModel: options.model, videoDuration: request.duration, videoResolution: request.resolution, videoMode: options.mode })
  logVideoEstimate(estimate)
  logMediaGenerationStatus(l, { mediaType: 'video', provider: 'fal', model: options.model, status: 'started', detail: options.mode })
  const startTime = Date.now()
  await mkdir(outputDir, { recursive: true })
  const result = await runFalQueue<FalVideoOutput>({ apiKey, endpointId: request.endpointId, input: request.input, pollIntervalMs: options.pollIntervalMs, operationName: 'fal-video-gen', onStatus: status => logMediaGenerationStatus(l, { mediaType: 'video', provider: 'fal', model: options.model, status: status.status }) })
  const videoUrl = result.output.video?.url
  if (typeof videoUrl !== 'string') throw InfraError('fal.ai video generation completed without a video URL', { stage: 'video:fal' })
  const videoPath = `${outputDir}/generated-video.mp4`
  await Bun.write(videoPath, await downloadVideoOutputBytes(videoUrl, 'fal.ai'))
  const processingTime = Date.now() - startTime
  logMediaGenerationStatus(l, { mediaType: 'video', provider: 'fal', model: options.model, status: 'completed', processingTimeMs: processingTime, outputCount: 1, artifacts: [{ artifact: 'video', path: videoPath }] })
  return {
    videoPath,
    metadata: {
      videoGenService: 'fal',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: Bun.file(videoPath).size,
      videoDuration: request.duration,
      videoResolution: request.resolution,
      ...(request.aspectRatio ? { videoAspectRatio: request.aspectRatio } : {}),
      requestMode: options.mode,
      ...(options.inputImage ? { inputImage: options.inputImage } : {}),
      ...(options.lastFrame ? { lastFrameImage: options.lastFrame } : {}),
      ...(options.referenceImages?.length ? { referenceImages: options.referenceImages } : {}),
      ...(options.referenceVideos?.length ? { referenceVideos: options.referenceVideos } : {}),
      ...(options.referenceAudios?.length ? { referenceAudios: options.referenceAudios } : {}),
      providerRequestId: result.requestId,
      providerOutputUrl: videoUrl,
      providerVideoUrl: videoUrl,
      ...(estimate ? { providerCostCents: estimate.totalCost, providerCostSource: 'registry_fallback' as const } : {})
    }
  }
}
