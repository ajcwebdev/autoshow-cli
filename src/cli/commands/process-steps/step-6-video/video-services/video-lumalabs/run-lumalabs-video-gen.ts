import * as v from 'valibot'
import type { LumalabsImageRef, LumalabsVideoModel, Step6VideoMetadata } from '~/types'
import { CLIUsageError, InfraError, InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { normalizeLumaVideoAspectRatio, normalizeLumaVideoDuration, normalizeLumaVideoResolution } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { videoMediaReferenceToUrlOrDataUrl } from '~/cli/commands/process-steps/step-6-video/video-utils/video-media-inputs'
import { downloadVideoOutputBytes } from '~/cli/commands/process-steps/step-6-video/video-utils/video-output-download'
import { LUMALABS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { pollUntil } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const LumalabsGenerationSchema = v.object({
  id: v.string(),
  state: v.string(),
  failure_code: v.optional(v.nullable(v.string()), undefined),
  failure_reason: v.optional(v.nullable(v.string()), undefined),
  output: v.optional(v.nullable(v.array(v.object({
    type: v.optional(v.string(), undefined),
    url: v.string()
  }))), undefined)
})

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
    throw CLIUsageError('Luma Labs video prompt cannot be empty.')
  }

  const apiKey = readEnv('LUMA_AGENTS_API_KEY')
  if (!apiKey) {
    throw InternalError('LUMA_AGENTS_API_KEY environment variable is required for Luma Labs video generation', { stage: 'video:lumalabs', hints: hintsForMissingEnv('LUMA_AGENTS_API_KEY') })
  }

  const baseUrl = LUMALABS_DEFAULT_BASE_URL.replace(/\/+$/, '')
  const aspectRatio = normalizeLumaVideoAspectRatio(options.aspectRatio)
  const resolution = normalizeLumaVideoResolution(options.resolution)
  const duration = normalizeLumaVideoDuration(options.durationSeconds)
  const durationSeconds = duration === '10s' ? 10 : 5
  const startFrame = options.inputImage ? await toLumalabsImageRef(options.inputImage) : undefined

  logGenStatus('video', 'lumalabs', options.model, 'started', startFrame ? 'image-to-video' : 'text')

  const estimate = estimateVideoCost({
    lumalabsVideoModel: options.model,
    videoDuration: options.durationSeconds,
    videoResolution: options.resolution
  })
  logVideoEstimate(estimate)

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    accept: 'application/json'
  }

  const body = {
    model: options.model,
    type: 'video',
    prompt,
    aspect_ratio: aspectRatio,
    video: {
      resolution,
      duration,
      ...(startFrame ? { start_frame: startFrame } : {})
    }
  }

  const startTime = Date.now()
  const createResp = await fetch(`${baseUrl}/generations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!createResp.ok) {
    const errorBody = await createResp.text()
    throw InfraError(`Luma Labs video generation request failed (${createResp.status}): ${errorBody || 'No response body'}`, { stage: 'video:lumalabs', status: createResp.status })
  }

  const createData = validateData(
    LumalabsGenerationSchema,
    await createResp.json() as unknown,
    'Luma Labs video generation create response'
  )

  const pollData = await pollUntil({
    operationName: 'lumalabs-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const pollResp = await fetch(`${baseUrl}/generations/${encodeURIComponent(createData.id)}`, {
        method: 'GET',
        headers
      })

      if (!pollResp.ok) {
        const errorBody = await pollResp.text()
        throw InfraError(`Luma Labs video generation query failed (${pollResp.status}): ${errorBody || 'No response body'}`, { stage: 'video:lumalabs', status: pollResp.status })
      }

      const data = validateData(
        LumalabsGenerationSchema,
        await pollResp.json() as unknown,
        'Luma Labs video generation poll response'
      )
      logGenStatus('video', 'lumalabs', options.model, data.state)
      return data
    },
    isDone: (data) => data.state.toLowerCase() === 'completed',
    isFailed: (data) => data.state.toLowerCase() === 'failed'
      ? { failed: true, reason: data.failure_reason ?? data.failure_code ?? `Luma Labs generation state ${data.state}` }
      : { failed: false }
  })

  const videoUrl = pollData.output?.[0]?.url
  if (!videoUrl) {
    throw InfraError('Luma Labs video generation completed without an output URL', { stage: 'video:lumalabs' })
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'Luma Labs'))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logGenCompleted('video', 'lumalabs', options.model, processingTime, [outputPath])

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'lumalabs',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: durationSeconds,
      videoResolution: resolution,
      videoAspectRatio: aspectRatio,
      ...(options.inputImage ? { inputImage: options.inputImage } : {})
    }
  }
}
