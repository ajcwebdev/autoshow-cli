import * as l from '~/utils/app-logger/app-logger'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ReplicatePrediction, ReplicateVideoBuildResult, ReplicateVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateReplicateCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  isReplicateHappyHorseVideoModel,
  isReplicateAlephVideoModel,
  isReplicateKlingOmniVideoModel,
  isReplicateKlingVideoModel,
  isReplicatePixVerseVideoModel,
  isReplicateSeedanceVideoModel,
  isReplicateWanVideoModel,
  normalizeReplicateVideoAspectRatio,
  normalizeReplicateVideoDuration,
  normalizeReplicateVideoResolution
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import {
  tryResolveLocalAudioProbe,
  tryResolveLocalVideoDurationSeconds,
  videoMediaReferenceToUrlOrDataUrl
} from '../../video-utils/video-media-inputs'
import { downloadVideoOutputBytes } from '../../video-utils/video-output-download'
import { ensureReplicateSetup, getReplicateBaseUrl } from '~/cli/commands/process-steps/step-5-image/image-generation-services/replicate/replicate-image-gen'
import { normalizeReplicateOutputUris, runReplicatePrediction } from '~/utils/replicate-client/replicate-prediction'

const MAX_WAN_AUDIO_BYTES = 15 * 1024 * 1024
const MAX_SEEDANCE_REFERENCE_DURATION_SECONDS = 15

const hasText = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0

const requirePrompt = (prompt: string | undefined, label: string): string => {
  if (!hasText(prompt)) {
    throw CLIUsageError(`${label} video prompt cannot be empty.`)
  }
  return prompt
}

const normalizeKlingMultiPrompt = (value: string | undefined, duration: number): string | undefined => {
  if (!hasText(value)) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw CLIUsageError('--replicate-video-multi-prompt must be a valid JSON array.')
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 6) {
    throw CLIUsageError('--replicate-video-multi-prompt must contain 1 through 6 shots.')
  }
  let totalDuration = 0
  for (const shot of parsed) {
    if (typeof shot !== 'object' || shot === null || typeof (shot as { prompt?: unknown }).prompt !== 'string') {
      throw CLIUsageError('Each --replicate-video-multi-prompt shot must contain a string prompt and integer duration.')
    }
    const shotDuration = (shot as { duration?: unknown }).duration
    if (typeof shotDuration !== 'number' || !Number.isInteger(shotDuration) || shotDuration < 1) {
      throw CLIUsageError('Each --replicate-video-multi-prompt shot duration must be an integer of at least 1 second.')
    }
    totalDuration += shotDuration
  }
  if (totalDuration !== duration) {
    throw CLIUsageError(`--replicate-video-multi-prompt shot durations must total --video-duration (${duration}).`)
  }
  return JSON.stringify(parsed)
}

const statusTimingFromPrediction = (
  prediction: ReplicatePrediction,
  startTime: number
): NonNullable<Step6VideoMetadata['providerStatusTimings']>[number] => ({
  status: prediction.status,
  elapsedMs: Date.now() - startTime,
  ...(prediction.id ? { id: prediction.id } : {}),
  ...(prediction.created_at ? { createdAt: prediction.created_at } : {}),
  ...(prediction.started_at ? { startedAt: prediction.started_at } : {}),
  ...(prediction.completed_at ? { completedAt: prediction.completed_at } : {})
})

const validateWanAudioProbe = async (audio: string): Promise<void> => {
  const probe = await tryResolveLocalAudioProbe(audio)
  if (!probe) return

  if (typeof probe.sizeBytes === 'number' && probe.sizeBytes > MAX_WAN_AUDIO_BYTES) {
    throw CLIUsageError(`--replicate-video-audio must be 15MB or smaller for Replicate/wan-video/wan-2.7-t2v.`)
  }
  if (
    typeof probe.durationSeconds === 'number'
    && (probe.durationSeconds < 3 || probe.durationSeconds > 30)
  ) {
    throw CLIUsageError(`--replicate-video-audio duration must be between 3 and 30 seconds for Replicate/wan-video/wan-2.7-t2v.`)
  }
}

const validateSeedanceReferenceDurations = async (
  references: readonly string[],
  kind: 'audio' | 'video'
): Promise<void> => {
  const durations = await Promise.all(references.map(async (reference) =>
    kind === 'video'
      ? await tryResolveLocalVideoDurationSeconds(reference)
      : (await tryResolveLocalAudioProbe(reference))?.durationSeconds
  ))
  let knownTotal = 0
  for (const duration of durations) {
    knownTotal += duration ?? 0
  }
  if (knownTotal > MAX_SEEDANCE_REFERENCE_DURATION_SECONDS) {
    throw CLIUsageError(`Replicate Seedance reference ${kind}s must total 15 seconds or less.`)
  }
}

const buildHappyHorseInput = async (
  prompt: string | undefined,
  options: {
    model: ReplicateVideoModel
    mode: VideoMode
    durationSeconds?: number | undefined
    resolution?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    referenceImages?: string[] | undefined
    seed?: number | undefined
  }
): Promise<ReplicateVideoBuildResult> => {
  const durationForApi = normalizeReplicateVideoDuration(options.model, options.durationSeconds)
  const resolution = normalizeReplicateVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeReplicateVideoAspectRatio(options.model, options.aspectRatio)
  const imageInputs = options.mode === 'reference-to-video'
    ? (options.referenceImages ?? [])
    : options.inputImage ? [options.inputImage] : []
  const images = imageInputs.length > 0
    ? await Promise.all(imageInputs.map(async image => await videoMediaReferenceToUrlOrDataUrl(image, 'image')))
    : undefined
  if (!images || images.length !== 1) {
    requirePrompt(prompt, `Replicate/${options.model}`)
  }

  return {
    input: {
      ...(hasText(prompt) ? { prompt } : {}),
      ...(images ? { images } : {}),
      resolution,
      duration: durationForApi,
      ...(images?.length !== 1 ? { aspect_ratio: aspectRatio } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {})
    },
    requestMode: options.mode,
    durationForApi,
    resolution,
    ...(images?.length !== 1 ? { aspectRatio } : {})
  }
}

const buildKlingInput = async (
  prompt: string | undefined,
  options: {
    model: ReplicateVideoModel
    mode: VideoMode
    durationSeconds?: number | undefined
    resolution?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
    inputVideo?: string | undefined
    referenceVideos?: string[] | undefined
    negativePrompt?: string | undefined
    generateAudio?: boolean | undefined
    multiPrompt?: string | undefined
  }
): Promise<ReplicateVideoBuildResult> => {
  const resolvedPrompt = requirePrompt(prompt, `Replicate/${options.model}`)
  const durationForApi = normalizeReplicateVideoDuration(options.model, options.durationSeconds)
  const resolution = normalizeReplicateVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeReplicateVideoAspectRatio(options.model, options.aspectRatio)
  const providerMode = resolution === '4k' ? '4k' : resolution === '1080p' ? 'pro' : 'standard'
  const startImage = options.inputImage ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image') : undefined
  const endImage = options.lastFrameImage ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrameImage, 'image') : undefined
  const referenceImages = options.referenceImages?.length
    ? await Promise.all(options.referenceImages.map(async image => await videoMediaReferenceToUrlOrDataUrl(image, 'image')))
    : undefined
  const videoInput = options.mode === 'edit'
    ? options.inputVideo
    : options.referenceVideos?.[0]
  const referenceVideo = videoInput ? await videoMediaReferenceToUrlOrDataUrl(videoInput, 'video') : undefined
  const inputVideoDurationSeconds = videoInput ? await tryResolveLocalVideoDurationSeconds(videoInput) : undefined
  const multiPrompt = normalizeKlingMultiPrompt(options.multiPrompt, durationForApi)

  return {
    input: {
      prompt: resolvedPrompt,
      mode: providerMode,
      duration: durationForApi,
      ...(!startImage && options.mode !== 'edit' ? { aspect_ratio: aspectRatio } : {}),
      ...(startImage ? { start_image: startImage } : {}),
      ...(endImage ? { end_image: endImage } : {}),
      ...(isReplicateKlingOmniVideoModel(options.model) && referenceImages ? { reference_images: referenceImages } : {}),
      ...(isReplicateKlingOmniVideoModel(options.model) && referenceVideo ? {
        reference_video: referenceVideo,
        video_reference_type: options.mode === 'edit' ? 'base' : 'feature'
      } : {}),
      ...(!referenceVideo && options.generateAudio !== undefined ? { generate_audio: options.generateAudio } : {}),
      ...(multiPrompt ? { multi_prompt: multiPrompt } : {}),
      ...(!isReplicateKlingOmniVideoModel(options.model) && hasText(options.negativePrompt) ? { negative_prompt: options.negativePrompt } : {})
    },
    requestMode: options.mode,
    durationForApi,
    resolution,
    ...(!startImage && options.mode !== 'edit' ? { aspectRatio } : {}),
    ...(inputVideoDurationSeconds !== undefined ? { inputVideoDurationSeconds } : {})
  }
}

const buildPixVerseInput = async (
  prompt: string | undefined,
  options: {
    model: ReplicateVideoModel
    mode: VideoMode
    durationSeconds?: number | undefined
    resolution?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    negativePrompt?: string | undefined
    generateAudio?: boolean | undefined
    seed?: number | undefined
    multiClip?: boolean | undefined
  }
): Promise<ReplicateVideoBuildResult> => {
  const resolvedPrompt = requirePrompt(prompt, `Replicate/${options.model}`)
  const durationForApi = normalizeReplicateVideoDuration(options.model, options.durationSeconds)
  const resolution = normalizeReplicateVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeReplicateVideoAspectRatio(options.model, options.aspectRatio)
  const image = options.inputImage ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image') : undefined
  const lastFrameImage = options.lastFrameImage ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrameImage, 'image') : undefined
  return {
    input: {
      prompt: resolvedPrompt,
      quality: resolution,
      duration: durationForApi,
      ...(!image ? { aspect_ratio: aspectRatio } : {}),
      ...(image ? { image } : {}),
      ...(lastFrameImage ? { last_frame_image: lastFrameImage } : {}),
      ...(hasText(options.negativePrompt) ? { negative_prompt: options.negativePrompt } : {}),
      ...(options.generateAudio !== undefined ? { generate_audio_switch: options.generateAudio } : {}),
      ...(options.multiClip !== undefined ? { generate_multi_clip_switch: options.multiClip } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {})
    },
    requestMode: options.mode,
    durationForApi,
    resolution,
    ...(!image ? { aspectRatio } : {})
  }
}

const buildAlephInput = async (
  prompt: string | undefined,
  options: { model: ReplicateVideoModel, inputVideo?: string | undefined, seed?: number | undefined }
): Promise<ReplicateVideoBuildResult> => {
  const resolvedPrompt = requirePrompt(prompt, `Replicate/${options.model}`)
  if (!options.inputVideo) throw CLIUsageError('Replicate/runwayml/aleph-2 requires --video-input-video.')
  if (existsSync(options.inputVideo) && Bun.file(options.inputVideo).size > 16 * 1024 * 1024) {
    throw CLIUsageError('Replicate/runwayml/aleph-2 input video must be 16MB or smaller.')
  }
  const video = await videoMediaReferenceToUrlOrDataUrl(options.inputVideo, 'video')
  const inputVideoDurationSeconds = await tryResolveLocalVideoDurationSeconds(options.inputVideo)
  if (inputVideoDurationSeconds !== undefined && (inputVideoDurationSeconds < 2 || inputVideoDurationSeconds > 30)) {
    throw CLIUsageError('Replicate/runwayml/aleph-2 input video duration must be between 2 and 30 seconds.')
  }
  return {
    input: { prompt: resolvedPrompt, video, ...(options.seed !== undefined ? { seed: options.seed } : {}) },
    requestMode: 'edit',
    durationForApi: inputVideoDurationSeconds ?? 5,
    resolution: 'source',
    ...(inputVideoDurationSeconds !== undefined ? { inputVideoDurationSeconds } : {})
  }
}

const buildSeedanceInput = async (
  prompt: string | undefined,
  options: {
    model: ReplicateVideoModel
    mode: VideoMode
    durationSeconds?: number | undefined
    resolution?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
    inputVideo?: string | undefined
    referenceVideos?: string[] | undefined
    referenceAudios?: string[] | undefined
    generateAudio?: boolean | undefined
    seed?: number | undefined
  }
): Promise<ReplicateVideoBuildResult> => {
  const resolvedPrompt = requirePrompt(prompt, `Replicate/${options.model}`)
  const durationForApi = normalizeReplicateVideoDuration(options.model, options.durationSeconds)
  const resolution = normalizeReplicateVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeReplicateVideoAspectRatio(options.model, options.aspectRatio)
  const inputImage = options.inputImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image')
    : undefined
  const lastFrameImage = options.lastFrameImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrameImage, 'image')
    : undefined
  const referenceImages = options.referenceImages && options.referenceImages.length > 0
    ? await Promise.all(options.referenceImages.map(async (input) => await videoMediaReferenceToUrlOrDataUrl(input, 'image')))
    : undefined
  const videoReferencesRaw = [
    ...(options.inputVideo ? [options.inputVideo] : []),
    ...(options.referenceVideos ?? [])
  ]
  const referenceVideos = videoReferencesRaw.length > 0
    ? await Promise.all(videoReferencesRaw.map(async (input) => await videoMediaReferenceToUrlOrDataUrl(input, 'video')))
    : undefined
  const referenceAudios = options.referenceAudios && options.referenceAudios.length > 0
    ? await Promise.all(options.referenceAudios.map(async (input) => await videoMediaReferenceToUrlOrDataUrl(input, 'audio')))
    : undefined
  const inputVideoDurationSeconds = options.inputVideo
    ? await tryResolveLocalVideoDurationSeconds(options.inputVideo)
    : undefined

  await validateSeedanceReferenceDurations(videoReferencesRaw, 'video')
  await validateSeedanceReferenceDurations(options.referenceAudios ?? [], 'audio')

  return {
    input: {
      prompt: resolvedPrompt,
      duration: durationForApi,
      resolution,
      aspect_ratio: aspectRatio,
      ...(inputImage ? { image: inputImage } : {}),
      ...(lastFrameImage ? { last_frame_image: lastFrameImage } : {}),
      ...(referenceImages ? { reference_images: referenceImages } : {}),
      ...(referenceVideos ? { reference_videos: referenceVideos } : {}),
      ...(referenceAudios ? { reference_audios: referenceAudios } : {}),
      ...(options.generateAudio !== undefined ? { generate_audio: options.generateAudio } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {})
    },
    requestMode: options.mode,
    durationForApi,
    resolution,
    aspectRatio,
    ...(inputVideoDurationSeconds !== undefined ? { inputVideoDurationSeconds } : {})
  }
}

const buildWanInput = async (
  prompt: string | undefined,
  options: {
    model: ReplicateVideoModel
    durationSeconds?: number | undefined
    resolution?: string | undefined
    aspectRatio?: string | undefined
    negativePrompt?: string | undefined
    audio?: string | undefined
    promptExpansion?: boolean | undefined
    seed?: number | undefined
  }
): Promise<ReplicateVideoBuildResult> => {
  const resolvedPrompt = requirePrompt(prompt, `Replicate/${options.model}`)
  const durationForApi = normalizeReplicateVideoDuration(options.model, options.durationSeconds)
  const resolution = normalizeReplicateVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeReplicateVideoAspectRatio(options.model, options.aspectRatio)
  const audio = options.audio
    ? await videoMediaReferenceToUrlOrDataUrl(options.audio, 'audio')
    : undefined
  if (options.audio) {
    await validateWanAudioProbe(options.audio)
  }

  return {
    input: {
      prompt: resolvedPrompt,
      duration: durationForApi,
      resolution,
      aspect_ratio: aspectRatio,
      ...(hasText(options.negativePrompt) ? { negative_prompt: options.negativePrompt } : {}),
      ...(audio ? { audio } : {}),
      ...(options.promptExpansion !== undefined ? { enable_prompt_expansion: options.promptExpansion } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {})
    },
    requestMode: 'text',
    durationForApi,
    resolution,
    aspectRatio
  }
}

const buildReplicateVideoInput = async (
  prompt: string | undefined,
  options: {
    model: ReplicateVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    resolution?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
    inputVideo?: string | undefined
    referenceVideos?: string[] | undefined
    referenceAudios?: string[] | undefined
    negativePrompt?: string | undefined
    audio?: string | undefined
    promptExpansion?: boolean | undefined
    generateAudio?: boolean | undefined
    seed?: number | undefined
    multiPrompt?: string | undefined
    multiClip?: boolean | undefined
  }
): Promise<ReplicateVideoBuildResult> => {
  const mode = options.mode ?? 'text'
  if (isReplicateHappyHorseVideoModel(options.model)) {
    return await buildHappyHorseInput(prompt, { ...options, mode })
  }
  if (isReplicateSeedanceVideoModel(options.model)) {
    return await buildSeedanceInput(prompt, { ...options, mode })
  }
  if (isReplicateKlingVideoModel(options.model)) {
    return await buildKlingInput(prompt, { ...options, mode })
  }
  if (isReplicatePixVerseVideoModel(options.model)) {
    return await buildPixVerseInput(prompt, { ...options, mode })
  }
  if (isReplicateAlephVideoModel(options.model)) {
    return await buildAlephInput(prompt, options)
  }
  if (isReplicateWanVideoModel(options.model)) {
    return await buildWanInput(prompt, options)
  }
  throw CLIUsageError(`Unsupported Replicate video model: ${options.model}`)
}

export const runReplicateVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: ReplicateVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    resolution?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
    inputVideo?: string | undefined
    referenceVideos?: string[] | undefined
    referenceAudios?: string[] | undefined
    negativePrompt?: string | undefined
    audio?: string | undefined
    promptExpansion?: boolean | undefined
    generateAudio?: boolean | undefined
    seed?: number | undefined
    multiPrompt?: string | undefined
    multiClip?: boolean | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiToken = await ensureReplicateSetup('Replicate video generation')
  const referenceVideoCount = (options.inputVideo ? 1 : 0) + (options.referenceVideos?.length ?? 0)
  const request = await buildReplicateVideoInput(prompt, options)
  const estimate = estimateReplicateCost(options.model, {
    replicateVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution,
    videoMode: request.requestMode,
    replicateVideoReferenceVideoCount: referenceVideoCount,
    replicateVideoGenerateAudio: options.generateAudio,
    ...(request.inputVideoDurationSeconds !== undefined ? { replicateInputVideoDurationSeconds: request.inputVideoDurationSeconds } : {})
  })
  logVideoEstimate(estimate)

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'replicate',
    model: options.model,
    status: 'started',
    detail: request.requestMode
  })

  await mkdir(outputDir, { recursive: true })
  const startTime = Date.now()
  const statusTimings: NonNullable<Step6VideoMetadata['providerStatusTimings']> = []

  const prediction = await runReplicatePrediction({
    apiToken,
    baseUrl: getReplicateBaseUrl(),
    model: options.model,
    input: request.input,
    operationName: 'replicate-video-gen',
    onStatus: (status) => {
      statusTimings.push(statusTimingFromPrediction(status, startTime))
      logMediaGenerationStatus(l, {
        mediaType: 'video',
        provider: 'replicate',
        model: options.model,
        status: status.status
      })
    }
  })

  const outputUris = normalizeReplicateOutputUris(prediction.output)
  const videoUrl = outputUris[0]
  if (!videoUrl) {
    throw InfraError('Replicate video generation completed without an output video URL', { stage: 'video:replicate' })
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'Replicate'))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)
  const observedDuration = await tryResolveLocalVideoDurationSeconds(outputPath)
  const videoDuration = observedDuration ?? estimate.durationSeconds
  const providerCostCents = videoDuration * estimate.costPerSecond

  logMediaGenerationStatus(l, {
    mediaType: 'video',
    provider: 'replicate',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1,
    detail: `Actual billed cost was not returned by the API; estimate ${providerCostCents.toFixed(3)}¢`,
    artifacts: [{ artifact: 'video', path: outputPath }]
  })

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'replicate',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration,
      requestMode: request.requestMode,
      videoResolution: request.resolution,
      ...(request.aspectRatio ? { videoAspectRatio: request.aspectRatio } : {}),
      ...(options.inputImage ? { inputImage: options.inputImage } : {}),
      ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
      ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {}),
      ...(options.referenceVideos && options.referenceVideos.length > 0 ? { referenceVideos: options.referenceVideos } : {}),
      ...(options.referenceAudios && options.referenceAudios.length > 0 ? { referenceAudios: options.referenceAudios } : {}),
      ...(options.inputVideo ? { inputVideo: options.inputVideo } : {}),
      ...(request.inputVideoDurationSeconds !== undefined ? { inputVideoDurationSeconds: request.inputVideoDurationSeconds } : {}),
      ...(options.audio ? { inputAudio: options.audio } : {}),
      ...(prediction.id ? { providerRequestId: prediction.id } : {}),
      ...(prediction.version ? { providerModelVersion: prediction.version } : {}),
      ...(prediction.model && prediction.model !== options.model ? { providerReturnedModel: prediction.model } : {}),
      providerOutputUrl: videoUrl,
      providerVideoUrl: videoUrl,
      ...(statusTimings.length > 0 ? { providerStatusTimings: statusTimings } : {}),
      providerFileOutput: {
        outputCount: outputUris.length,
        requestedDuration: request.durationForApi,
        ...(prediction.metrics ? { metrics: prediction.metrics } : {})
      },
      providerCostCents,
      providerCostSource: 'registry_fallback'
    }
  }
}
