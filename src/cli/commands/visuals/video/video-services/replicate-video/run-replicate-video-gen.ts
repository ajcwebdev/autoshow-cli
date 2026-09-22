import type { ReplicatePrediction, ReplicateVideoBuildResult, ReplicateVideoGenOptions, Step6VideoMetadata, VideoMode } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { runVideoGeneration } from '~/cli/commands/command-shared/media-generation/video-generation-scaffold'
import { estimateReplicateCost, logVideoEstimate } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import {
  isReplicateHappyHorseVideoModel,
  isReplicatePixVerseVideoModel,
  isReplicateSeedanceVideoModel,
  isReplicateWanVideoModel,
  normalizeReplicateVideoAspectRatio,
  normalizeReplicateVideoDuration,
  normalizeReplicateVideoResolution
} from '~/cli/commands/visuals/video/video-utils/video-normalization'
import {
  tryResolveLocalAudioProbe,
  tryResolveLocalVideoDurationSeconds,
  videoMediaReferenceToUrlOrDataUrl
} from '../../video-utils/video-media-inputs'
import { downloadVideoOutput } from '../../video-utils/video-output-download'
import { getReplicateBaseUrl } from '~/cli/commands/visuals/image/image-generation-services/replicate/replicate-image-gen'
import { normalizeReplicateOutputUris, runReplicatePrediction } from '~/utils/replicate-client/replicate-prediction'

const MAX_SEEDANCE_REFERENCE_DURATION_SECONDS = 30

const hasText = (value: string | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0

const requirePrompt = (prompt: string | undefined, label: string): string => {
  if (!hasText(prompt)) {
    throw UsageError(`${label} video prompt cannot be empty.`)
  }
  return prompt
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

const validateSeedanceReferenceDurations = async (
  references: readonly string[],
  kind: 'audio' | 'video',
  maxDuration = MAX_SEEDANCE_REFERENCE_DURATION_SECONDS
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
  if (knownTotal > maxDuration) {
    throw UsageError(`Replicate Seedance reference ${kind}s must total ${maxDuration} seconds or less.`)
  }
}

const buildHappyHorseInput = async (
  prompt: string | undefined,
  options: ReplicateVideoGenOptions & { mode: VideoMode }
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

const buildPixVerseInput = async (
  prompt: string | undefined,
  options: ReplicateVideoGenOptions & { mode: VideoMode }
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

const buildSeedanceInput = async (
  prompt: string | undefined,
  options: ReplicateVideoGenOptions & { mode: VideoMode }
): Promise<ReplicateVideoBuildResult> => {
  const resolvedPrompt = requirePrompt(prompt, `Replicate/${options.model}`)
  const durationForApi = normalizeReplicateVideoDuration(options.model, options.durationSeconds)
  const resolution = normalizeReplicateVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeReplicateVideoAspectRatio(options.model, options.aspectRatio ?? (options.inputImage ? 'adaptive' : undefined))
  if (options.inputImage && aspectRatio !== 'adaptive') throw UsageError('Seedance 2.5 first-frame input requires --aspect-ratio adaptive.')
  if ((options.inputImage || options.lastFrameImage) && ((options.referenceImages?.length ?? 0) + (options.referenceVideos?.length ?? 0) + (options.referenceAudios?.length ?? 0) + (options.inputVideo ? 1 : 0) > 0)) throw UsageError('Seedance 2.5 frame inputs cannot be combined with reference media.')
  if (options.lastFrameImage && !options.inputImage) throw UsageError('Seedance 2.5 last frame requires a first frame.')
  if ((options.referenceImages?.length ?? 0) > 30 || (options.referenceVideos?.length ?? 0) + (options.inputVideo ? 1 : 0) > 10 || (options.referenceAudios?.length ?? 0) > 10) throw UsageError('Seedance 2.5 reference limits are 30 images, 10 videos, and 10 audios.')
  if (options.referenceAudios?.length && !options.referenceImages?.length && !options.referenceVideos?.length && !options.inputVideo) throw UsageError('Seedance 2.5 audio requires a reference image or video.')
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
  options: ReplicateVideoGenOptions & { mode: VideoMode }
): Promise<ReplicateVideoBuildResult> => {
  if (options.mode !== 'text' && options.mode !== 'image-to-video') {
    throw UsageError(`Wan 3.0 supports text-to-video and image-to-video only; "${options.mode}" is not supported.`)
  }
  if (options.generateAudio !== undefined) {
    throw UsageError('Wan 3.0 does not support audio generation.')
  }
  if (options.lastFrameImage) {
    throw UsageError('Wan 3.0 does not support last-frame image conditioning.')
  }
  if ((options.referenceImages?.length ?? 0) > 0 || (options.referenceVideos?.length ?? 0) > 0 || (options.referenceAudios?.length ?? 0) > 0 || options.inputVideo) {
    throw UsageError('Wan 3.0 does not support reference media inputs.')
  }
  if (options.multiClip !== undefined) {
    throw UsageError('Wan 3.0 does not support multi-clip generation.')
  }
  const resolvedPrompt = requirePrompt(prompt, `Replicate/${options.model}`)
  const durationForApi = normalizeReplicateVideoDuration(options.model, options.durationSeconds)
  const resolution = normalizeReplicateVideoResolution(options.model, options.resolution)
  const aspectRatio = normalizeReplicateVideoAspectRatio(options.model, options.aspectRatio)
  const image = options.inputImage
    ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image')
    : undefined

  return {
    input: {
      prompt: resolvedPrompt,
      duration: durationForApi,
      resolution,
      ...(!image ? { aspect_ratio: aspectRatio } : {}),
      ...(image ? { image } : {}),
      ...(hasText(options.negativePrompt) ? { negative_prompt: options.negativePrompt } : {}),
      enable_prompt_expansion: true,
      ...(options.seed !== undefined ? { seed: options.seed } : {})
    },
    requestMode: options.mode,
    durationForApi,
    resolution,
    ...(!image ? { aspectRatio } : {})
  }
}

export const buildReplicateVideoInput = async (
  prompt: string | undefined,
  options: ReplicateVideoGenOptions
): Promise<ReplicateVideoBuildResult> => {
  const mode = options.mode ?? 'text'
  if (isReplicateHappyHorseVideoModel(options.model)) {
    return await buildHappyHorseInput(prompt, { ...options, mode })
  }
  if (isReplicateWanVideoModel(options.model)) {
    return await buildWanInput(prompt, { ...options, mode })
  }
  if (isReplicateSeedanceVideoModel(options.model)) {
    return await buildSeedanceInput(prompt, { ...options, mode })
  }
  if (isReplicatePixVerseVideoModel(options.model)) {
    return await buildPixVerseInput(prompt, { ...options, mode })
  }
  throw UsageError(`Unsupported Replicate video model: ${options.model}`)
}

export const runReplicateVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: ReplicateVideoGenOptions
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> =>
  await runVideoGeneration({
    service: 'replicate',
    model: options.model,
    outputDir,
    prepare: async () => {
      const request = await buildReplicateVideoInput(prompt, options)
      const referenceVideoCount = (options.inputVideo ? 1 : 0) + (options.referenceVideos?.length ?? 0)
      return {
        request,
        estimate: estimateReplicateCost(options.model, {
          replicateVideoModels: [options.model],
          videoDuration: options.durationSeconds,
          videoResolution: options.resolution,
          videoMode: request.requestMode,
          replicateVideoReferenceVideoCount: referenceVideoCount,
          videoGenerateAudio: options.generateAudio,
          ...(request.inputVideoDurationSeconds !== undefined ? { replicateInputVideoDurationSeconds: request.inputVideoDurationSeconds } : {})
        })
      }
    },
    startDetail: (prepared) => prepared.request.requestMode,
    estimate: (prepared) => logVideoEstimate(prepared.estimate),
    execute: async (context, { request, estimate }) => {
      const startTime = Date.now()
      const statusTimings: NonNullable<Step6VideoMetadata['providerStatusTimings']> = []

      const prediction = await runReplicatePrediction({
        apiToken: context.apiKey,
        baseUrl: getReplicateBaseUrl(),
        model: options.model,
        input: request.input,
        operationName: 'replicate-video-gen',
        onStatus: (status) => {
          statusTimings.push(statusTimingFromPrediction(status, startTime))
          context.logStatus(status.status)
        }
      })

      const outputUris = normalizeReplicateOutputUris(prediction.output)
      const videoUrl = outputUris[0]
      if (!videoUrl) {
        throw InfraError('Replicate video generation completed without an output video URL', { stage: 'video:replicate' })
      }

      const outputPath = context.artifactPath()
      await downloadVideoOutput(videoUrl, 'Replicate', outputPath)

      const observedDuration = await tryResolveLocalVideoDurationSeconds(outputPath)
      const videoDuration = observedDuration ?? estimate.durationSeconds
      const providerCostCents = videoDuration * estimate.costPerSecond

      return {
        artifactPaths: [outputPath],
        completionDetail: `Actual billed cost was not returned by the API; estimate ${providerCostCents.toFixed(3)}\u00a2`,
        metadata: {
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
  })
