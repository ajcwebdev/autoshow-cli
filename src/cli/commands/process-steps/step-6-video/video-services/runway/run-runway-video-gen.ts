import * as v from 'valibot'
import type { RunwayVideoModel, Step6VideoMetadata } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateVideoCost, logVideoEstimate } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { normalizeRunwayDuration, normalizeRunwayRatio } from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { downloadVideoOutputBytes } from '~/cli/commands/process-steps/step-6-video/video-utils/video-output-download'
import { formatPolledJobError, runPolledJob } from '~/utils/polled-job-client/polled-job'
import { requireApiKey } from '~/utils/validate/env-utils'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const RUNWAY_BASE_URL = 'https://api.dev.runwayml.com/v1'
const RUNWAY_API_VERSION = '2024-11-06'
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const RunwayCreateTaskResponseSchema = v.object({
  id: v.string()
})

const RunwayTaskStatusResponseSchema = v.object({
  id: v.optional(v.string(), undefined),
  status: v.string(),
  output: v.optional(v.array(v.string()), undefined),
  failure: v.optional(v.unknown(), undefined),
  failureCode: v.optional(v.unknown(), undefined),
  createdAt: v.optional(v.string(), undefined)
})

const formatRunwayError = (task: v.InferOutput<typeof RunwayTaskStatusResponseSchema>): string => {
  const detail = task.failure ?? task.failureCode
  return formatPolledJobError(detail, `Runway task status ${task.status}`)
}

const validateRunwayPromptText = (prompt: string): void => {
  if (prompt.trim().length === 0) {
    throw CLIUsageError('Runway video prompt cannot be empty.')
  }
  if (prompt.length > 1000) {
    throw CLIUsageError(`Runway video prompts must be 1000 UTF-16 code units or fewer. Received ${prompt.length}.`)
  }
}

export const runRunwayVideoGen = async (
  prompt: string,
  outputDir: string,
  options: { model: RunwayVideoModel, durationSeconds?: number | undefined, aspectRatio?: string | undefined }
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  validateRunwayPromptText(prompt)

  const apiKey = requireApiKey('RUNWAYML_API_SECRET', 'video:runway', 'Runway video generation')

  const duration = normalizeRunwayDuration(options.durationSeconds)
  const ratio = normalizeRunwayRatio(options.aspectRatio)

  logGenStatus('video', 'runway', options.model, 'started')

  const estimate = estimateVideoCost({
    runwayVideoModel: options.model,
    videoDuration: options.durationSeconds
  })
  logVideoEstimate(estimate)

  const startTime = Date.now()
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'X-Runway-Version': RUNWAY_API_VERSION,
    'Content-Type': 'application/json'
  }
  const { result: taskData } = await runPolledJob({
    operationName: 'runway-video-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    create: {
      url: `${RUNWAY_BASE_URL}/text_to_video`,
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: options.model, promptText: prompt, ratio, duration })
      },
      schema: RunwayCreateTaskResponseSchema,
      context: 'Runway video generation create response',
      stage: 'video:runway',
      errorMessage: 'Runway video generation request failed'
    },
    poll: (created) => ({
      url: `${RUNWAY_BASE_URL}/tasks/${encodeURIComponent(created.id)}`,
      init: { method: 'GET', headers },
      schema: RunwayTaskStatusResponseSchema,
      context: 'Runway video generation query response',
      stage: 'video:runway',
      errorMessage: 'Runway video generation query failed'
    }),
    onPoll: (data) => logGenStatus('video', 'runway', options.model, data.status),
    isDone: (data) => data.status === 'SUCCEEDED',
    isFailed: (data) => ['FAILED', 'CANCELLED', 'THROTTLED'].includes(data.status)
      ? { failed: true, reason: formatRunwayError(data) }
      : { failed: false }
  })

  const videoUrl = taskData.output?.[0]
  if (!videoUrl) {
    throw InfraError('Runway video generation succeeded but no output[0] URL was returned', { stage: 'video:runway' })
  }

  const outputPath = `${outputDir}/generated-video.mp4`
  await Bun.write(outputPath, await downloadVideoOutputBytes(videoUrl, 'Runway'))

  const processingTime = Date.now() - startTime
  const videoFile = Bun.file(outputPath)

  logGenCompleted('video', 'runway', options.model, processingTime, [outputPath])

  return {
    videoPath: outputPath,
    metadata: {
      videoGenService: 'runway',
      videoGenModel: options.model,
      processingTime,
      videoFileName: 'generated-video.mp4',
      videoFileSize: videoFile.size,
      videoDuration: duration
    }
  }
}
