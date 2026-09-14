import { mkdir } from 'node:fs/promises'
import type { GeminiVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { InfraError, UsageError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/command-shared/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import { resolveCredential } from '~/utils/validate/env-utils'
import {
  normalizeGeminiAspectRatio,
  normalizeGeminiDuration,
  normalizeGeminiResolution
} from '~/cli/commands/visuals/video/video-utils/video-normalization'
import { pollUntil } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import {
  geminiCreateInteraction,
  geminiDownloadFile,
  geminiGetInteraction,
  geminiUploadFile,
  waitForGeminiFileActive
} from '~/utils/gemini/gemini-rest'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import {
  resolveVideoMediaFileForUpload,
  tryResolveLocalVideoDurationSeconds,
  videoMediaReferenceToGeminiInteractionPart
} from '../../video-utils/video-media-inputs'
import { isObjectLike } from '~/utils/value-helpers'

const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const DEFAULT_IMAGE_VIDEO_PROMPT = 'Animate the provided image with natural, subtle motion while preserving its subject and composition.'
const OMNI_TASK_BY_MODE: Record<VideoMode, 'text_to_video' | 'image_to_video' | 'reference_to_video' | 'edit' | 'extend'> = {
  text: 'text_to_video',
  'image-to-video': 'image_to_video',
  interpolate: 'image_to_video',
  'reference-to-video': 'reference_to_video',
  edit: 'edit',
  extend: 'extend'
}
const OMNI_ROLE_TAG = /<(FIRST_FRAME|LAST_FRAME|IMAGE_REF_\d+|VIDEO_REF_\d+|PREVIOUS_VIDEO|VIDEO_0)>/
const MAX_UPLOAD_EDIT_SECONDS = 10
const MAX_REFERENCE_VIDEO_SECONDS = 3

type InteractionContent = Record<string, unknown>
type InteractionVideo = {
  id?: string | undefined
  status?: string | undefined
  mimeType?: string | undefined
  data?: string | undefined
  uri?: string | undefined
}

const withRoleGuidance = (prompt: string, guidance: string): string =>
  OMNI_ROLE_TAG.test(prompt) ? prompt : `${prompt}\n${guidance}`

const parseInteractionVideo = (value: unknown): InteractionVideo => {
  if (!isObjectLike(value)) {
    throw InfraError('Gemini Omni returned an invalid interaction', { stage: 'video:gemini' })
  }
  const id = typeof value['id'] === 'string' ? value['id'] : undefined
  const status = typeof value['status'] === 'string' ? value['status'] : undefined
  if (value['error'] !== undefined) {
    throw InfraError(`Gemini Omni interaction failed: ${JSON.stringify(value['error'])}`, { stage: 'video:gemini' })
  }
  let mimeType: string | undefined
  let data: string | undefined
  let uri: string | undefined
  const outputVideo = isObjectLike(value['output_video']) ? value['output_video'] : undefined
  if (outputVideo) {
    if (typeof outputVideo['data'] === 'string') data = outputVideo['data']
    if (typeof outputVideo['uri'] === 'string') uri = outputVideo['uri']
    if (typeof outputVideo['mime_type'] === 'string') mimeType = outputVideo['mime_type']
  }
  const steps = value['steps']
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (!isObjectLike(step) || step['type'] !== 'model_output' || !Array.isArray(step['content'])) continue
      for (const part of step['content']) {
        if (!isObjectLike(part) || part['type'] !== 'video') continue
        if (typeof part['data'] === 'string') data = part['data']
        if (typeof part['uri'] === 'string') uri = part['uri']
        if (typeof part['mime_type'] === 'string') mimeType = part['mime_type']
      }
    }
  }
  return { id, status, mimeType, data, uri }
}

const requirePrompt = (prompt: string | undefined, mode: VideoMode): string => {
  if (prompt !== undefined && prompt.trim().length > 0) return prompt
  if (mode === 'image-to-video' || mode === 'interpolate') return DEFAULT_IMAGE_VIDEO_PROMPT
  throw UsageError('Gemini Omni requires a text prompt.')
}

const uploadOmniVideo = async (
  apiKey: string,
  value: string,
  outputDir: string,
  abortSignal: AbortSignal | undefined,
  limits: { maxSeconds: number, flagName: string }
): Promise<string> => {
  const durationSeconds = await tryResolveLocalVideoDurationSeconds(value)
  if (durationSeconds !== undefined && durationSeconds > limits.maxSeconds) {
    throw UsageError(`${limits.flagName} must be ${limits.maxSeconds} seconds or less for Gemini Omni.`)
  }
  const file = await resolveVideoMediaFileForUpload(value, outputDir)
  const uploaded = await geminiUploadFile(apiKey, file.path, {
    mimeType: file.mimeType,
    abortSignal
  })
  const name = uploaded.name ?? uploaded.uri
  if (!name) {
    throw InfraError('Gemini Files API upload did not return a file name', { stage: 'video:gemini' })
  }
  await waitForGeminiFileActive(apiKey, name, { stage: 'video:gemini', abortSignal })
  return uploaded.uri ?? `https://generativelanguage.googleapis.com/v1beta/${name.startsWith('files/') ? name : `files/${name}`}`
}

const writeOmniVideo = async (
  apiKey: string,
  video: InteractionVideo,
  outputPath: string,
  abortSignal: AbortSignal | undefined
): Promise<void> => {
  if (video.uri) {
    await waitForGeminiFileActive(apiKey, video.uri, { stage: 'video:gemini', abortSignal })
    await geminiDownloadFile(apiKey, { uri: video.uri, mimeType: video.mimeType }, outputPath)
    return
  }
  if (video.data) {
    await Bun.write(outputPath, Buffer.from(video.data, 'base64'))
    return
  }
  throw InfraError('Gemini Omni completed but no video was returned', { stage: 'video:gemini' })
}

export const runGeminiVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: GeminiVideoModel
    mode?: VideoMode | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    durationSeconds?: number | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
    referenceVideos?: string[] | undefined
    inputVideo?: string | undefined
    previousInteractionId?: string | undefined
    abortSignal?: AbortSignal | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = resolveCredential('gemini', 'require', { stage: 'video:gemini' })
  const mode = options.mode ?? 'text'
  const normalizedResolution = normalizeGeminiResolution(options.resolution, options.model)
  const normalizedAspectRatio = normalizeGeminiAspectRatio(options.aspectRatio)
  const billedDuration = normalizeGeminiDuration(options.durationSeconds, normalizedResolution, mode)
  const resolvedPrompt = requirePrompt(prompt, mode)

  logGenStatus('video', 'gemini', options.model, 'started')
  const estimate = estimateVideoCost({
    geminiVideoModels: [options.model],
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution,
    videoMode: mode
  })
  logVideoEstimate(estimate)
  await mkdir(outputDir, { recursive: true })

  const input: InteractionContent[] = []
  if (mode === 'image-to-video' && options.inputImage) {
    input.push(await videoMediaReferenceToGeminiInteractionPart(options.inputImage, 'image'))
    input.push({ type: 'text', text: resolvedPrompt })
  } else if (mode === 'interpolate' && options.inputImage && options.lastFrameImage) {
    input.push(await videoMediaReferenceToGeminiInteractionPart(options.inputImage, 'image'))
    input.push(await videoMediaReferenceToGeminiInteractionPart(options.lastFrameImage, 'image'))
    input.push({
      type: 'text',
      text: withRoleGuidance(resolvedPrompt, 'Use the first image as the starting frame and the second image as the final frame.')
    })
  } else if (mode === 'reference-to-video') {
    for (const image of options.referenceImages ?? []) {
      input.push(await videoMediaReferenceToGeminiInteractionPart(image, 'image'))
    }
    for (const video of options.referenceVideos ?? []) {
      const uri = await uploadOmniVideo(apiKey, video, outputDir, options.abortSignal, {
        maxSeconds: MAX_REFERENCE_VIDEO_SECONDS,
        flagName: '--reference-video'
      })
      input.push({ type: 'video', uri })
    }
    const guidance = (options.referenceVideos?.length ?? 0) > 0
      ? 'Use the given image(s) and video(s) as references. Do not use them as a source for video editing.'
      : 'Use the given image(s) as references for video generation. The images should not be used as literal initial frames.'
    input.push({ type: 'text', text: withRoleGuidance(resolvedPrompt, guidance) })
  } else if ((mode === 'edit' || mode === 'extend') && options.inputVideo) {
    const uri = await uploadOmniVideo(apiKey, options.inputVideo, outputDir, options.abortSignal, {
      maxSeconds: MAX_UPLOAD_EDIT_SECONDS,
      flagName: '--input-video'
    })
    input.push({ type: 'video', uri })
    for (const image of options.referenceImages ?? []) {
      input.push(await videoMediaReferenceToGeminiInteractionPart(image, 'image'))
    }
    const guidance = mode === 'extend' && (options.referenceImages?.length ?? 0) > 0
      ? 'Extend this video. Use the given image(s) as references.'
      : mode === 'extend'
        ? 'Extend this video.'
        : resolvedPrompt
    input.push({
      type: 'text',
      text: mode === 'extend' ? withRoleGuidance(resolvedPrompt, guidance) : resolvedPrompt
    })
  } else {
    input.push({ type: 'text', text: resolvedPrompt })
  }

  const responseFormat: Record<string, unknown> = {
    type: 'video',
    aspect_ratio: normalizedAspectRatio,
    resolution: normalizedResolution,
    delivery: 'uri'
  }
  if (options.durationSeconds !== undefined) {
    responseFormat['duration'] = `${billedDuration}s`
  }

  const body: Record<string, unknown> = {
    model: options.model,
    input: input.length === 1 && input[0]?.['type'] === 'text' ? resolvedPrompt : input,
    store: true,
    background: false,
    stream: false,
    response_format: responseFormat,
    generation_config: {
      video_config: {
        task: OMNI_TASK_BY_MODE[mode]
      }
    }
  }
  if (options.previousInteractionId) {
    body['previous_interaction_id'] = options.previousInteractionId
  }

  const startTime = Date.now()
  let interaction = await withRetry({
    retryClass: 'runtime_http_create_conservative',
    operationName: 'gemini-omni-create',
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
  }, async (signal) => await geminiCreateInteraction(apiKey, body, signal), (error) => classifyFetchRetry(error, 'runtime_http_create_conservative'))

  let parsed = parseInteractionVideo(interaction)
  if (parsed.status !== 'completed') {
    const interactionId = parsed.id
    if (!interactionId) {
      throw InfraError(`Gemini Omni interaction did not complete (status ${parsed.status ?? 'unknown'})`, { stage: 'video:gemini' })
    }
    parsed = parseInteractionVideo(await pollUntil({
      operationName: 'gemini-omni-gen',
      intervalMs: POLL_INTERVAL_MS,
      deadlineMs: POLL_TIMEOUT_MS,
      ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
      pollFn: async () => await withRetry({
        retryClass: 'runtime_http_poll',
        operationName: 'gemini-omni-poll',
        ...(options.abortSignal ? { abortSignal: options.abortSignal } : {})
      }, async (signal) => {
        logGenStatus('video', 'gemini', options.model, 'in_progress')
        return await geminiGetInteraction(apiKey, interactionId, signal)
      }, (error) => classifyFetchRetry(error, 'runtime_http_poll')),
      isDone: (value) => parseInteractionVideo(value).status === 'completed',
      isFailed: (value) => {
        const current = parseInteractionVideo(value)
        if (current.status === 'failed' || current.status === 'cancelled') {
          return { failed: true, reason: `Gemini Omni interaction ${current.status}` }
        }
        return { failed: false }
      }
    }))
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await writeOmniVideo(apiKey, parsed, outputPath, options.abortSignal)
  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)
  logGenCompleted('video', 'gemini', options.model, processingTime, [outputPath], `Actual billed cost was not returned by the API; estimate ${estimate.totalCost.toFixed(3)}¢`)

  const metadata: Step6VideoMetadata = {
    videoGenService: 'gemini',
    videoGenModel: options.model,
    processingTime,
    videoFileName: 'generated-video.mp4',
    videoFileSize: videoFile.size,
    videoDuration: options.durationSeconds !== undefined ? billedDuration : undefined,
    requestMode: mode,
    videoResolution: normalizedResolution,
    videoAspectRatio: normalizedAspectRatio,
    ...(options.inputImage ? { inputImage: options.inputImage } : {}),
    ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
    ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {}),
    ...(options.referenceVideos && options.referenceVideos.length > 0 ? { referenceVideos: options.referenceVideos } : {}),
    ...(options.inputVideo ? { inputVideo: options.inputVideo } : {}),
    ...(parsed.id ? { providerRequestId: parsed.id } : {}),
    ...(parsed.uri ? { providerVideoUri: parsed.uri } : {}),
    ...(parsed.mimeType ? { providerFileOutput: { mimeType: parsed.mimeType } } : {})
  }
  return { videoPath: outputPath, metadata }
}
