import type { LumalabsImageRef, LumalabsVideoModel, Step6VideoMetadata } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { runVideoGeneration } from '~/cli/commands/command-shared/media-generation/video-generation-scaffold'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import { normalizeLumaVideoAspectRatio, normalizeLumaVideoDuration, normalizeLumaVideoResolution } from '~/cli/commands/visuals/video/video-utils/video-normalization'
import { videoMediaReferenceToUrlOrDataUrl } from '~/cli/commands/visuals/video/video-utils/video-media-inputs'
import { downloadVideoOutputBytes } from '~/cli/commands/visuals/video/video-utils/video-output-download'
import { LUMALABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { LumalabsGenerationSchema, runPolledJob } from '~/utils/polled-job-client/polled-job'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const toLumalabsImageRef = async (input: string): Promise<LumalabsImageRef> => {
  const ref = await videoMediaReferenceToUrlOrDataUrl(input, 'image')
  const match = /^data:([^;,]+);base64,(.*)$/is.exec(ref)
  if (match && match[1] && match[2] !== undefined) {
    return { data: match[2], media_type: match[1] }
  }
  return { url: ref }
}

export const runLumalabsVideoGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: LumalabsVideoModel
    durationSeconds?: number | undefined
    aspectRatio?: string | undefined
    resolution?: string | undefined
    inputImage?: string | undefined
  }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  if (prompt.trim().length === 0) {
    throw UsageError('Luma Labs video prompt cannot be empty.')
  }

  const baseUrl = LUMALABS_DEFAULT_BASE_URL.replace(/\/+$/, '')

  return await runVideoGeneration({
    service: 'lumalabs',
    model: options.model,
    outputDir,
    startDetail: options.inputImage ? 'image-to-video' : 'text',
    prepare: async () => {
      const aspectRatio = normalizeLumaVideoAspectRatio(options.aspectRatio)
      const resolution = normalizeLumaVideoResolution(options.resolution)
      const duration = normalizeLumaVideoDuration(options.durationSeconds)
      const startFrame = options.inputImage ? await toLumalabsImageRef(options.inputImage) : undefined

      return {
        aspectRatio,
        resolution,
        durationSeconds: duration === '10s' ? 10 : 5,
        body: {
          model: options.model,
          type: 'video',
          prompt,
          aspect_ratio: aspectRatio,
          video: {
            resolution,
            duration,
            ...(startFrame ? { start_frame: startFrame } : {})
          }
        },
        estimate: estimateVideoCost({
          lumalabsVideoModels: [options.model],
          videoDuration: options.durationSeconds,
          videoResolution: options.resolution
        })
      }
    },
    estimate: (prepared) => logVideoEstimate(prepared.estimate),
    execute: async (context, prepared) => {
      const headers = {
        Authorization: `Bearer ${context.apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json'
      }
      const { result: pollData } = await runPolledJob({
        operationName: 'lumalabs-video-gen',
        intervalMs: POLL_INTERVAL_MS,
        deadlineMs: POLL_TIMEOUT_MS,
        create: {
          url: `${baseUrl}/generations`,
          init: { method: 'POST', headers, body: JSON.stringify(prepared.body) },
          schema: LumalabsGenerationSchema,
          context: 'Luma Labs video generation create response',
          stage: 'video:lumalabs',
          errorMessage: 'Luma Labs video generation request failed'
        },
        poll: (created) => ({
          url: `${baseUrl}/generations/${encodeURIComponent(created.id)}`,
          init: { method: 'GET', headers },
          schema: LumalabsGenerationSchema,
          context: 'Luma Labs video generation poll response',
          stage: 'video:lumalabs',
          errorMessage: 'Luma Labs video generation query failed'
        }),
        onPoll: (data) => context.logStatus(data.state),
        isDone: (data) => data.state.toLowerCase() === 'completed',
        isFailed: (data) => data.state.toLowerCase() === 'failed'
          ? { failed: true, reason: data.failure_reason ?? data.failure_code ?? `Luma Labs generation state ${data.state}` }
          : { failed: false }
      })

      const videoUrl = pollData.output?.[0]?.url
      if (!videoUrl) {
        throw InfraError('Luma Labs video generation completed without an output URL', { stage: 'video:lumalabs' })
      }

      const outputPath = context.artifactPath()
      await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'Luma Labs'))

      return {
        artifactPaths: [outputPath],
        metadata: {
          videoDuration: prepared.durationSeconds,
          videoResolution: prepared.resolution,
          videoAspectRatio: prepared.aspectRatio,
          ...(options.inputImage ? { inputImage: options.inputImage } : {})
        }
      }
    }
  })
}
