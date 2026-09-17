import * as v from 'valibot'
import type { GrokVideoModel, Step6VideoMetadata, VideoMode } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { runVideoGeneration } from '~/cli/commands/command-shared/media-generation/video-generation-scaffold'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import {
  normalizeGrokVideoAspectRatio,
  normalizeGrokVideoDuration,
  normalizeGrokVideoResolution
} from '~/cli/commands/visuals/video/video-utils/video-normalization'
import { downloadVideoOutputBytes } from '~/cli/commands/visuals/video/video-utils/video-output-download'
import { formatPolledJobError, runPolledJob } from '~/utils/polled-job-client/polled-job'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import {
  videoMediaReferenceToGrokUrlObject
} from '../../video-utils/video-media-inputs'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const GrokCreateVideoResponseSchema = v.object({
  request_id: v.string()
})

const GrokPollVideoResponseSchema = v.object({
  status: v.string(),
  error: v.optional(v.unknown(), undefined),
  model: v.optional(v.string(), undefined),
  progress: v.optional(v.number(), undefined),
  usage: v.optional(v.object({
    cost_in_usd_ticks: v.optional(v.number(), undefined)
  }), undefined),
  video: v.optional(v.object({
    url: v.optional(v.nullable(v.string()), undefined),
    duration: v.optional(v.number(), undefined),
    respect_moderation: v.optional(v.boolean(), undefined)
  }), undefined)
})

export const runGrokVideoGen = async (
  prompt: string | undefined,
  outputDir: string,
  options: {
    model: GrokVideoModel
    mode?: VideoMode | undefined
    durationSeconds?: number | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
    referenceImages?: string[] | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const mode = options.mode ?? 'text'

  return await runVideoGeneration({
    service: 'grok',
    model: options.model,
    outputDir,
    prepare: async () => {
      const duration = normalizeGrokVideoDuration(options.durationSeconds)
      const aspectRatio = normalizeGrokVideoAspectRatio(options.aspectRatio)
      const resolution = normalizeGrokVideoResolution(options.resolution, options.model)

      const image = options.inputImage
        ? await videoMediaReferenceToGrokUrlObject(options.inputImage, 'image')
        : undefined
      const referenceImages = options.referenceImages && options.referenceImages.length > 0
        ? await Promise.all(options.referenceImages.map(async (input) => await videoMediaReferenceToGrokUrlObject(input, 'image')))
        : undefined

      return {
        duration,
        aspectRatio,
        resolution,
        requestBody: {
          model: options.model,
          ...(prompt !== undefined ? { prompt } : {}),
          duration,
          aspect_ratio: aspectRatio,
          resolution,
          ...(image ? { image } : {}),
          ...(referenceImages && referenceImages.length > 0 ? { reference_images: referenceImages } : {})
        } satisfies Record<string, unknown>,
        estimate: estimateVideoCost({
          grokVideoModels: [options.model],
          videoDuration: options.durationSeconds,
          videoResolution: options.resolution,
          videoMode: options.mode,
          grokInputImageCount: (options.inputImage ? 1 : 0) + (options.referenceImages?.length ?? 0)
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
        operationName: 'grok-video-gen',
        intervalMs: POLL_INTERVAL_MS,
        deadlineMs: POLL_TIMEOUT_MS,
        create: {
          url: `${XAI_DEFAULT_BASE_URL}/videos/generations`,
          init: { method: 'POST', headers, body: JSON.stringify(prepared.requestBody) },
          schema: GrokCreateVideoResponseSchema,
          context: 'Grok video generation create response',
          stage: 'video:grok',
          errorMessage: `Grok video ${mode} request failed`,
          errorFactory: (response, payload) => InfraError(`Grok video ${mode} request failed (${response.status}): ${typeof payload === 'string' && payload.length > 0 ? payload : 'No response body'}`, { stage: 'video:grok' })
        },
        poll: (created) => ({
          url: `${XAI_DEFAULT_BASE_URL}/videos/${encodeURIComponent(created.request_id)}`,
          init: { method: 'GET', headers },
          schema: GrokPollVideoResponseSchema,
          context: 'Grok video generation query response',
          stage: 'video:grok',
          errorMessage: 'Grok video generation query failed'
        }),
        onPoll: (data) => context.logStatus(data.status),
        isDone: (data) => data.status === 'done',
        isFailed: (data) => data.status === 'failed' || data.status === 'expired'
          ? { failed: true, reason: formatPolledJobError(data.error) }
          : { failed: false }
      })

      const videoUrl = taskData.video?.url
      if (!videoUrl && taskData.video?.respect_moderation === false) {
        throw InfraError('Grok video generation was blocked by moderation and no video URL was returned', { stage: 'video:grok' })
      }
      if (!videoUrl) {
        throw InfraError('Grok video generation succeeded but no video.url was returned', { stage: 'video:grok' })
      }

      const outputPath = context.artifactPath()
      await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'Grok'))

      return {
        artifactPaths: [outputPath],
        metadata: {
          videoDuration: taskData.video?.duration ?? prepared.duration,
          requestMode: mode,
          ...(prepared.resolution ? { videoResolution: prepared.resolution } : {}),
          ...(prepared.aspectRatio ? { videoAspectRatio: prepared.aspectRatio } : {}),
          ...(options.inputImage ? { inputImage: options.inputImage } : {}),
          ...(options.referenceImages && options.referenceImages.length > 0 ? { referenceImages: options.referenceImages } : {}),
          providerRequestId: createData.request_id,
          ...(taskData.model ? { providerReturnedModel: taskData.model } : {}),
          providerVideoUrl: videoUrl,
          ...(typeof taskData.progress === 'number' ? { providerProgress: taskData.progress } : {}),
          ...(taskData.video?.respect_moderation !== undefined ? { providerModeration: taskData.video.respect_moderation } : {}),
          ...(typeof taskData.usage?.cost_in_usd_ticks === 'number'
            ? {
                providerCostCents: taskData.usage.cost_in_usd_ticks / 100_000_000,
                providerCostSource: 'provider_usage' as const
              }
            : {})
        }
      }
    }
  })
}
