import * as v from 'valibot'
import type { GlmVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  normalizeGlmAspectRatio,
  normalizeGlmDuration,
  normalizeGlmFps,
  normalizeGlmQuality,
  normalizeGlmSize
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { downloadVideoOutputBytes } from '~/cli/commands/process-steps/step-6-video/video-utils/video-output-download'
import { formatPolledJobError, runPolledJob } from '~/utils/polled-job-client/polled-job'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { videoMediaReferenceToUrlOrBase64, videoMediaReferenceToUrlOrDataUrl } from '../../video-utils/video-media-inputs'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const GLM_PROMPT_MAX_CHARS = 512
const DEFAULT_IMAGE_VIDEO_PROMPT = 'Animate the provided image with natural, subtle motion while preserving its subject and composition.'

const isViduVideoModel = (model: GlmVideoModel): boolean => model.startsWith('vidu')

const resolveGlmImageReference = async (
  model: GlmVideoModel,
  value: string
): Promise<string> => {
  return isViduVideoModel(model)
    ? await videoMediaReferenceToUrlOrDataUrl(value, 'image')
    : await videoMediaReferenceToUrlOrBase64(value, 'image')
}

const buildGlmVideoRequestBodies = (
  baseBody: Record<string, unknown>,
  model: GlmVideoModel,
  imageUrl: string | string[] | undefined
): Record<string, unknown>[] => {
  if (!imageUrl) return [baseBody]
  if (!isViduVideoModel(model)) return [{ ...baseBody, image_url: imageUrl }]

  const images = Array.isArray(imageUrl) ? imageUrl : [imageUrl]
  const variants: Record<string, unknown>[] = [{ ...baseBody, images }]
  if (Array.isArray(imageUrl)) {
    variants.push({ ...baseBody, image_url: imageUrl })
  } else {
    variants.push({ ...baseBody, image_url: [imageUrl] })
    variants.push({ ...baseBody, image_url: imageUrl })
  }
  return variants
}

const shouldRetryViduCreateRequest = (
  model: GlmVideoModel,
  status: number,
  body: string
): boolean => {
  return isViduVideoModel(model)
    && status === 400
    && /1210|field is missing or empty|image_url|images/i.test(body)
}

const GlmCreateVideoResponseSchema = v.object({
  id: v.string(),
  request_id: v.optional(v.string(), undefined),
  model: v.optional(v.string(), undefined),
  task_status: v.optional(v.string(), undefined),
  error: v.optional(v.unknown(), undefined)
})

const GlmPollVideoResponseSchema = v.object({
  id: v.optional(v.string(), undefined),
  request_id: v.optional(v.string(), undefined),
  task_status: v.string(),
  video_result: v.optional(v.array(v.object({ url: v.string() })), undefined),
  error: v.optional(v.unknown(), undefined)
})

export const runGlmVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: GlmVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    size?: string | undefined
    aspectRatio?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
    referenceImages?: string[] | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const apiKey = ensureGlmApiKey('GLM video generation')
  const baseURL = resolveGlmBaseUrl()
  const duration = normalizeGlmDuration(options.model, options.durationSeconds)
  const size = normalizeGlmSize(options.model, options.size)
  const aspectRatio = normalizeGlmAspectRatio(options.aspectRatio)
  const mode = options.mode ?? 'text'
  const resolvedPrompt = prompt ?? (mode === 'image-to-video' || mode === 'interpolate' || mode === 'reference-to-video'
    ? DEFAULT_IMAGE_VIDEO_PROMPT
    : undefined)

  if (resolvedPrompt !== undefined && resolvedPrompt.length > GLM_PROMPT_MAX_CHARS) {
    throw CLIUsageError(`GLM video prompts must be ${GLM_PROMPT_MAX_CHARS} characters or fewer. Received ${resolvedPrompt.length}.`)
  }

  logGenStatus('video', 'glm', options.model, 'started')

  const estimate = estimateVideoCost({
    glmVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoSize: options.size
  })
  logVideoEstimate(estimate)

  const inputImageUrl = options.inputImage
    ? await resolveGlmImageReference(options.model, options.inputImage)
    : undefined
  const lastFrameUrl = options.lastFrameImage
    ? await resolveGlmImageReference(options.model, options.lastFrameImage)
    : undefined
  const referenceImageUrls = options.referenceImages && options.referenceImages.length > 0
    ? await Promise.all(options.referenceImages.map(async (input) => await resolveGlmImageReference(options.model, input)))
    : undefined

  const imageUrl = mode === 'interpolate'
    ? [inputImageUrl, lastFrameUrl].filter((value): value is string => typeof value === 'string')
    : mode === 'reference-to-video'
      ? referenceImageUrls
      : inputImageUrl

  const requestBodyBase: Record<string, unknown> = options.model === 'cogvideox-3'
    ? {
        model: options.model,
        ...(resolvedPrompt !== undefined ? { prompt: resolvedPrompt } : {}),
        quality: normalizeGlmQuality(undefined),
        with_audio: false,
        size,
        fps: normalizeGlmFps(undefined),
        duration
      }
    : {
        model: options.model,
        ...(resolvedPrompt !== undefined ? { prompt: resolvedPrompt } : {}),
        duration,
        size,
        movement_amplitude: 'auto',
        ...(options.model === 'viduq1-text' ? { style: 'general', aspect_ratio: aspectRatio } : {}),
        ...(options.model === 'vidu2-reference' ? { aspect_ratio: aspectRatio, with_audio: false } : {})
      }
  const requestBodies = buildGlmVideoRequestBodies(requestBodyBase, options.model, imageUrl)

  const startTime = Date.now()
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  const { result: taskData } = await runPolledJob({
    operationName: 'glm-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    create: {
      run: async () => {
        const createErrors: string[] = []
        for (let index = 0; index < requestBodies.length; index += 1) {
          const createResp = await fetch(`${baseURL}/videos/generations`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBodies[index])
          })
          if (!createResp.ok) {
            const responseBody = await createResp.text()
            const message = `GLM video generation request failed (${createResp.status}): ${responseBody || 'No response body'}`
            createErrors.push(message)
            if (index < requestBodies.length - 1 && shouldRetryViduCreateRequest(options.model, createResp.status, responseBody)) {
              continue
            }
            throw InfraError(message, { stage: 'video:glm' })
          }
          return validateData(
            GlmCreateVideoResponseSchema,
            await createResp.json() as unknown,
            'GLM video generation create response'
          )
        }
        throw InfraError(createErrors.at(-1) ?? 'GLM video generation request failed: no create response was returned', { stage: 'video:glm' })
      }
    },
    validateCreate: (created) => {
      if (created.task_status === 'FAIL') {
        throw InfraError(`GLM video generation failed: ${formatPolledJobError(created.error)}`, { stage: 'video:glm' })
      }
    },
    poll: (created) => ({
      url: `${baseURL}/async-result/${encodeURIComponent(created.id)}`,
      init: { method: 'GET', headers },
      schema: GlmPollVideoResponseSchema,
      context: 'GLM video generation query response',
      stage: 'video:glm',
      errorMessage: 'GLM video generation query failed'
    }),
    onPoll: (data) => logGenStatus('video', 'glm', options.model, data.task_status),
    isDone: (data) => data.task_status === 'SUCCESS',
    isFailed: (data) => data.task_status === 'FAIL'
      ? { failed: true, reason: formatPolledJobError(data.error) }
      : { failed: false }
  })

  const videoUrl = taskData.video_result?.[0]?.url
  if (!videoUrl) {
    throw InfraError('GLM video generation succeeded but no video_result[0].url was returned', { stage: 'video:glm' })
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'GLM'))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logGenCompleted('video', 'glm', options.model, processingTime, [outputPath])

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'glm',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: duration,
      requestMode: mode,
      ...(options.inputImage ? { inputImage: options.inputImage } : {}),
      ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
      ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {})
    }
  }
}
