import * as v from 'valibot'
import type { LtxVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { runVideoGeneration } from '~/cli/commands/command-shared/media-generation/video-generation-scaffold'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import {
  normalizeLtxVideoAspectRatio,
  normalizeLtxVideoDuration,
  normalizeLtxVideoResolution,
  normalizeLtxVideoSize
} from '~/cli/commands/visuals/video/video-utils/video-normalization'
import { downloadVideoOutput } from '~/cli/commands/visuals/video/video-utils/video-output-download'
import { formatPolledJobError, runPolledJob } from '~/utils/polled-job-client/polled-job'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { validateModeInputs } from '../../video-utils/video-mode-validation'
import { videoMediaReferenceToUrlOrDataUrl } from '../../video-utils/video-media-inputs'
const LTX_BASE_URL = 'https://api.ltx.io'
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const DEFAULT_IMAGE_VIDEO_PROMPT = 'Animate the provided image with natural, subtle motion while preserving its subject and composition.'

const LtxCreateVideoResponseSchema = v.object({
  id: v.string()
})

const LtxPollVideoResponseSchema = v.object({
  id: v.optional(v.string(), undefined),
  status: v.string(),
  created_at: v.optional(v.string(), undefined),
  completed_at: v.optional(v.string(), undefined),
  result: v.optional(v.object({
    video_url: v.optional(v.string(), undefined)
  }), undefined),
  error: v.optional(v.unknown(), undefined)
})

const resolveLtxEndpoint = (mode: VideoMode): 'text-to-video' | 'image-to-video' => {
  if (mode === 'text') return 'text-to-video'
  if (mode === 'image-to-video' || mode === 'interpolate') return 'image-to-video'
  throw UsageError(`--mode ${mode} is not supported by LTX.`)
}

const requireLtxPrompt = (prompt: string | undefined): string => {
  if (prompt === undefined || prompt.trim().length === 0) {
    throw UsageError('LTX video prompt cannot be empty.')
  }
  return prompt
}

export const runLtxVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: LtxVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
    lastFrameImage?: string | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const mode = options.mode ?? 'text'

  return await runVideoGeneration({
    service: 'ltx',
    model: options.model,
    outputDir,
    prepare: async () => {
      const endpoint = resolveLtxEndpoint(mode)
      const size = normalizeLtxVideoSize(options.model, options.resolution, options.aspectRatio)
      const resolution = normalizeLtxVideoResolution(options.resolution, options.model)
      const aspectRatio = normalizeLtxVideoAspectRatio(options.model, options.aspectRatio)
      const duration = normalizeLtxVideoDuration(options.model, size, options.durationSeconds, mode)
      const fps = 24
      const resolvedPrompt = prompt ?? (mode === 'image-to-video' || mode === 'interpolate' ? DEFAULT_IMAGE_VIDEO_PROMPT : undefined)
      if (mode === 'text') {
        requireLtxPrompt(resolvedPrompt)
      }
      validateModeInputs({ videoInputImage: options.inputImage, videoLastFrame: options.lastFrameImage }, mode)

      const inputImage = options.inputImage
        ? await videoMediaReferenceToUrlOrDataUrl(options.inputImage, 'image')
        : undefined
      const lastFrame = options.lastFrameImage
        ? await videoMediaReferenceToUrlOrDataUrl(options.lastFrameImage, 'image')
        : undefined

      const requestBody: Record<string, unknown> = mode === 'text'
        ? {
          model: options.model,
          prompt: requireLtxPrompt(resolvedPrompt),
          duration,
          fps,
          resolution: size
        }
        : {
          model: options.model,
          image_uri: inputImage,
          prompt: resolvedPrompt,
          duration,
          fps,
          resolution: size,
          ...(lastFrame ? { last_frame_uri: lastFrame } : {})
        }

      return {
        endpoint,
        size,
        resolution,
        aspectRatio,
        duration,
        requestBody,
        estimate: estimateVideoCost({
          ltxVideoModels: [options.model],
          videoDuration: options.durationSeconds,
          videoAspectRatio: options.aspectRatio,
          videoResolution: options.resolution,
          videoMode: mode
        })
      }
    },
    estimate: (prepared) => logVideoEstimate(prepared.estimate),
    execute: async (context, prepared) => {
      const headers = {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json'
      }
      const { created: createData, result: taskData } = await runPolledJob({
        operationName: 'ltx-video-gen',
        intervalMs: POLL_INTERVAL_MS,
        deadlineMs: POLL_TIMEOUT_MS,
        create: {
          url: `${LTX_BASE_URL}/v2/${prepared.endpoint}`,
          init: { method: 'POST', headers, body: JSON.stringify(prepared.requestBody) },
          schema: LtxCreateVideoResponseSchema,
          context: 'LTX video generation create response',
          stage: 'video:ltx',
          errorMessage: `LTX video ${mode} request failed`
        },
        poll: (created) => ({
          url: `${LTX_BASE_URL}/v2/${prepared.endpoint}/${encodeURIComponent(created.id)}`,
          init: { method: 'GET', headers },
          schema: LtxPollVideoResponseSchema,
          context: 'LTX video generation query response',
          stage: 'video:ltx',
          errorMessage: 'LTX video generation query failed'
        }),
        onPoll: (data) => context.logStatus(data.status),
        isDone: (data) => data.status === 'completed',
        isFailed: (data) => data.status === 'failed'
          ? { failed: true, reason: formatPolledJobError(data.error) }
          : { failed: false }
      })

      const videoUrl = taskData.result?.video_url
      if (!videoUrl) {
        throw InfraError('LTX video generation succeeded but no result.video_url was returned', { stage: 'video:ltx' })
      }

      const outputPath = context.artifactPath()
      await downloadVideoOutput(videoUrl, 'LTX', outputPath)

      return {
        artifactPaths: [outputPath],
        completionDetail: `Actual billed cost was not returned by the API; estimated ${prepared.estimate.totalCost.toFixed(2)}¢.`,
        metadata: {
          videoDuration: prepared.duration,
          videoSize: prepared.size,
          requestMode: mode,
          videoResolution: prepared.resolution,
          videoAspectRatio: prepared.aspectRatio,
          ...(options.inputImage ? { inputImage: options.inputImage } : {}),
          ...(options.lastFrameImage ? { lastFrameImage: options.lastFrameImage } : {}),
          providerRequestId: createData.id,
          providerVideoUrl: videoUrl,
          ...(taskData.created_at || taskData.completed_at
            ? { providerFileOutput: { created_at: taskData.created_at, completed_at: taskData.completed_at } }
            : {}),
          providerCostCents: prepared.estimate.totalCost,
          providerCostSource: 'registry_fallback'
        }
      }
    }
  })
}
