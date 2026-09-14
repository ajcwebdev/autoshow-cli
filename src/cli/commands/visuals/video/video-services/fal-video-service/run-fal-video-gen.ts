import { isFalPriorityVideo, isFalSeedance25, normalizeFalPriorityDuration, normalizeFalPriorityResolution, normalizeFalPriorityAspectRatio, validateFalPriorityInputs } from './fal-priority-video-contract'
import { mkdir } from 'node:fs/promises'
import type { FalVideoModel, FalVideoOutput, Step6VideoMetadata, VideoMode } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/command-shared/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '../../video-utils/video-pricing'
import { tryResolveLocalVideoDurationSeconds, tryResolveLocalAudioProbe, videoMediaReferenceToUrlOrDataUrl } from '../../video-utils/video-media-inputs'
import { downloadVideoOutputBytes } from '../../video-utils/video-output-download'
import { runFalQueue } from '~/utils/fal-client/fal-queue'
import { ensureFalVideoGenSetup } from './fal-video-gen'

export const FAL_H3_RESOLUTIONS = ['768p', '2k'] as const
export const FAL_H3_ASPECT_RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const
export const FAL_SEEDANCE_RESOLUTIONS = ['480p', '720p', '1080p'] as const
export const FAL_H3_MAX_RESOLUTIONS = ['480p', '768p', '1080p'] as const

export const normalizeFalVideoDuration = (model: FalVideoModel, value: number | undefined): number => {
  if (isFalPriorityVideo(model)) return normalizeFalPriorityDuration(model, value)
  const duration = value ?? 5
  if (!Number.isInteger(duration) || duration < 5 || duration > 15) throw UsageError(`Invalid --duration value "${String(value)}" for fal.ai/${model}. Supported range: 5-15 seconds.`)
  return duration
}

export const normalizeFalVideoResolution = (model: FalVideoModel, value: string | undefined): string => {
  if (isFalPriorityVideo(model)) return normalizeFalPriorityResolution(model, value)
  const normalized = value?.toLowerCase() ?? '2k'
  if (!(FAL_H3_RESOLUTIONS as readonly string[]).includes(normalized)) throw UsageError(`Invalid --resolution value "${value}" for fal.ai/${model}. Supported values: ${FAL_H3_RESOLUTIONS.join(', ')}.`)
  return normalized.toUpperCase()
}

export const normalizeFalVideoAspectRatio = (model: FalVideoModel, value: string | undefined, mode: VideoMode): string | undefined => {
  if (isFalPriorityVideo(model)) return normalizeFalPriorityAspectRatio(model, value, mode)
  if (!value) return undefined
  if (mode === 'image-to-video') throw UsageError(`--aspect-ratio is not supported by fal.ai/${model} image-to-video; output follows the first frame.`)
  if (!(FAL_H3_ASPECT_RATIOS as readonly string[]).includes(value)) throw UsageError(`Invalid --aspect-ratio value "${value}" for fal.ai/${model}. Supported values: ${FAL_H3_ASPECT_RATIOS.join(', ')}.`)
  return value
}

export const buildFalVideoRequest = async (prompt: string, options: {
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
}): Promise<{ endpointId: string, input: Record<string, unknown>, duration: number, resolution: string, aspectRatio?: string | undefined, inputVideoDurationSeconds?: number | undefined }> => {
  let inputVideoDurationSeconds: number | undefined = 0
  if (isFalPriorityVideo(options.model)) {
    validateFalPriorityInputs(options)
    if (isFalSeedance25(options.model)) {
      for (const [kind, refs, maxBytes] of [
        ['image', [options.inputImage, options.lastFrame, ...(options.referenceImages ?? [])], 30 * 1024 * 1024],
        ['video', options.referenceVideos ?? [], 200 * 1024 * 1024],
        ['audio', options.referenceAudios ?? [], 15 * 1024 * 1024],
      ] as const) {
        for (const ref of refs) {
          if (!ref) continue
          if ((ref === options.inputImage || ref === options.lastFrame) && /(?:\.bmp(?:[?#].*)?$|^data:image\/bmp;)/i.test(ref)) throw UsageError('Seedance frame inputs require JPEG, PNG, or WebP.')
          const size = ref.startsWith('data:') ? Buffer.from(ref.slice(ref.indexOf(',') + 1), 'base64').byteLength : /^https?:/i.test(ref) ? undefined : Bun.file(ref).size
          if (size !== undefined && size > maxBytes) throw UsageError(`Seedance ${kind} input exceeds ${maxBytes / 1024 / 1024} MiB.`)
        }
      }
    }
    if (!prompt.trim() || (!isFalSeedance25(options.model) && Array.from(prompt).length > 50000)) throw UsageError('H3 Max prompt must contain 1–50000 characters.')
    for (const kind of ['video', 'audio'] as const) {
      const refs = (kind === 'video' ? options.referenceVideos : options.referenceAudios) ?? []
      let total = 0
      let allKnown = true
      for (const ref of refs) {
        const duration = kind === 'video' ? await tryResolveLocalVideoDurationSeconds(ref) : (await tryResolveLocalAudioProbe(ref))?.durationSeconds
        if (duration !== undefined && (duration < 1.8 || duration > 30.2)) throw UsageError(`Seedance reference ${kind} duration must be 1.8–30.2 seconds.`)
        if (duration === undefined) allKnown = false
        total += duration ?? 0
      }
      if (kind === 'video') inputVideoDurationSeconds = allKnown ? total : undefined
      if (total > 30.2) throw UsageError(`Seedance reference ${kind}s must total at most 30.2 seconds.`)
    }
  }
  const duration = normalizeFalVideoDuration(options.model, options.duration)
  const resolution = normalizeFalVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeFalVideoAspectRatio(options.model, options.aspectRatio, options.mode)
  const image = options.inputImage ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image') : undefined
  const lastFrame = options.lastFrame ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrame, 'image') : undefined
  const referenceImages = await Promise.all((options.referenceImages ?? []).map(value => videoMediaReferenceToUrlOrDataUrl(value, 'image')))
  const referenceVideos = await Promise.all((options.referenceVideos ?? []).map(value => videoMediaReferenceToUrlOrDataUrl(value, 'video')))
  const referenceAudios = await Promise.all((options.referenceAudios ?? []).map(value => videoMediaReferenceToUrlOrDataUrl(value, 'audio')))

  if (isFalPriorityVideo(options.model)) {
    const seedance = isFalSeedance25(options.model)
    const common = { prompt, duration: seedance ? (duration === -1 ? 'auto' : String(duration)) : duration, resolution,
      ...(seedance ? { generate_audio: options.generateAudio ?? true, bitrate_mode: 'standard' } : { prompt_expansion_mode: 'balanced', sync_mode: false }),
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) }
    return { endpointId: options.model, input: { ...common,
      ...(image ? { image_url: image } : {}), ...(lastFrame ? { end_image_url: lastFrame } : {}),
      ...(referenceImages.length ? { image_urls: referenceImages } : {}),
      ...(referenceVideos.length ? { video_urls: referenceVideos } : {}),
      ...(referenceAudios.length ? { audio_urls: referenceAudios } : {}),
      ...(options.mode === 'reference-to-video' ? { task: 'reference' } : {})
    }, duration, resolution, aspectRatio, inputVideoDurationSeconds }
  }

  if (options.model !== 'minimax/h3') throw UsageError(`Unsupported fal.ai video model: ${options.model}`)
  if (options.generateAudio !== undefined) throw UsageError(`--generate-audio is not configurable for fal.ai/${options.model}; H3 generates native audio according to its model behavior.`)
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
  if (!prompt.trim()) throw UsageError('fal.ai video prompt cannot be empty.')
  const apiKey = await ensureFalVideoGenSetup()
  const request = await buildFalVideoRequest(prompt, options)
  const estimate = estimateVideoCost({ falVideoModels: [options.model], videoDuration: request.duration, videoResolution: request.resolution, videoMode: options.mode, falVideoReferenceVideoCount: options.referenceVideos?.length ?? 0, falInputVideoDurationSeconds: request.inputVideoDurationSeconds })
  logVideoEstimate(estimate)
  logMediaGenerationStatus( { mediaType: 'video', provider: 'fal', model: options.model, status: 'started', detail: options.mode })
  const startTime = Date.now()
  await mkdir(outputDir, { recursive: true })
  const result = await runFalQueue<FalVideoOutput>({ apiKey, endpointId: request.endpointId, input: request.input, pollIntervalMs: options.pollIntervalMs, operationName: 'fal-video-gen', onStatus: status => logMediaGenerationStatus( { mediaType: 'video', provider: 'fal', model: options.model, status: status.status }) })
  const videoUrl = result.output.video?.url
  if (typeof videoUrl !== 'string') throw InfraError('fal.ai video generation completed without a video URL', { stage: 'video:fal' })
  const videoPath = `${outputDir}/generated-video.mp4`
  await Bun.write(videoPath, await downloadVideoOutputBytes(videoUrl, 'fal.ai'))
  const processingTime = Date.now() - startTime
  logMediaGenerationStatus( { mediaType: 'video', provider: 'fal', model: options.model, status: 'completed', processingTimeMs: processingTime, outputCount: 1, artifacts: [{ artifact: 'video', path: videoPath }] })
  return {
    videoPath,
    metadata: {
      videoGenService: 'fal',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: Bun.file(videoPath).size,
      videoDuration: request.duration === -1 ? (await tryResolveLocalVideoDurationSeconds(videoPath)) ?? 30 : request.duration,
      ...(isFalPriorityVideo(options.model) ? { providerFileOutput: { requestedDuration: request.duration, nativeAudio: isFalSeedance25(options.model) ? options.generateAudio ?? true : true } } : {}),
      ...(request.inputVideoDurationSeconds !== undefined && options.referenceVideos?.length ? { inputVideoDurationSeconds: request.inputVideoDurationSeconds } : {}),
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
