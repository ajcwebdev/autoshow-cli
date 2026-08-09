import * as v from 'valibot'
import { MinimaxBaseRespSchema, ensureMinimaxBaseRespSuccess, isMinimaxTaskFailure, isMinimaxTaskSuccess, parseMinimaxJsonResponse } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-minimax/minimax-utils'
import { concatAndConvertToWav, runTtsChunks, splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import type { MinimaxTtsOptions, Step4Metadata } from '~/types'
import { MINIMAX_DEFAULT_BASE_URL } from '~/utils/base-urls'
import * as l from '~/utils/app-logger/app-logger'
import { pollUntil } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { requireApiKey } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { InfraError, ValidationError } from '~/utils/error-handler'

const MINIMAX_DEFAULT_VOICE_ID = 'English_expressive_narrator'
const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const MinimaxCreateResponseSchema = v.object({
  task_id: v.union([v.string(), v.number()]),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxQueryDataSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined)
})

const MinimaxQueryResponseSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  error_message: v.optional(v.string(), undefined),
  data: v.optional(MinimaxQueryDataSchema, undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const readTaskStatus = (query: v.InferOutput<typeof MinimaxQueryResponseSchema>): string | number | undefined => {
  return query.data?.status ?? query.status
}

const extractFileId = (
  createResp: v.InferOutput<typeof MinimaxCreateResponseSchema>,
  queryResp: v.InferOutput<typeof MinimaxQueryResponseSchema>
): string | undefined => {
  const rawFileId = queryResp.data?.file_id ?? queryResp.file_id ?? createResp.file_id
  return rawFileId === undefined ? undefined : String(rawFileId)
}

const createMinimaxHttpError = async (
  response: Response,
  message: string
): Promise<Error & { status: number, headers: Headers }> => {
  const body = await response.text()
  const error = InfraError(`${message} (${response.status}): ${body || 'No response body'}`, { stage: 'tts:minimax', status: response.status }) as unknown as Error & { status: number, headers: Headers }
  error.status = response.status
  error.headers = response.headers
  return error
}

const downloadChunkAudio = async (
  baseURL: string,
  apiKey: string,
  fileId: string,
  chunkPath: string
): Promise<void> => {
  const response = await fetch(`${baseURL}/v1/files/retrieve_content?file_id=${encodeURIComponent(fileId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const body = await response.text()
    throw InfraError(`MiniMax TTS download failed (${response.status}): ${body || 'No response body'}`, { stage: 'tts:minimax', status: response.status })
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw InfraError('MiniMax TTS download returned empty audio', { stage: 'tts:minimax' })
  }

  await Bun.write(chunkPath, bytes)
}

export const runMinimaxTts = async (
  text: string,
  outputDir: string,
  options: MinimaxTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('MINIMAX_API_KEY', 'tts:minimax', 'MiniMax TTS')

  const baseURL = MINIMAX_DEFAULT_BASE_URL
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.minimax)
  if (chunks.length === 0) {
    throw ValidationError('MiniMax TTS input text is empty', { stage: 'tts:minimax' })
  }

  const startTime = Date.now()
  const voiceId = options.voiceId?.trim() ?? MINIMAX_DEFAULT_VOICE_ID

  logTtsConfig('MiniMax', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId },
    ...(options.languageBoost ? [{ label: 'language boost', value: options.languageBoost }] : []),
    ...(typeof options.speed === 'number' ? [{ label: 'speed', value: options.speed }] : []),
    ...(typeof options.volume === 'number' ? [{ label: 'volume', value: options.volume }] : []),
    ...(typeof options.pitch === 'number' ? [{ label: 'pitch', value: options.pitch }] : []),
    ...(options.emotion ? [{ label: 'emotion', value: options.emotion }] : []),
    ...(options.englishNormalization === true ? [{ label: 'English normalization', value: 'enabled' }] : []),
    ...(options.pronunciations && options.pronunciations.length > 0 ? [{ label: 'pronunciation rules', value: options.pronunciations.length }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkIndex = index + 1
      l.debug(`Submitting MiniMax TTS chunk ${chunkIndex}/${chunks.length}`)
      const voiceSetting = {
        voice_id: voiceId,
        ...(typeof options.speed === 'number' ? { speed: options.speed } : {}),
        ...(typeof options.volume === 'number' ? { vol: options.volume } : {}),
        ...(typeof options.pitch === 'number' ? { pitch: options.pitch } : {}),
        ...(options.emotion ? { emotion: options.emotion } : {}),
        ...(options.englishNormalization === true ? { english_normalization: true } : {})
      }
      const pronunciationRules = options.pronunciations?.map(item => item.trim()).filter(Boolean)
      const requestBody = {
        model: options.model,
        text: chunk,
        voice_setting: voiceSetting,
        audio_setting: {
          format: 'mp3',
          audio_sample_rate: 32000,
          channel: 1
        },
        ...(options.languageBoost ? { language_boost: options.languageBoost } : {}),
        ...(pronunciationRules && pronunciationRules.length > 0 ? { pronunciation_dict: { tone: pronunciationRules } } : {})
      }

      const createTaskResponse = await withHostedTtsRetry(
        {
          operationName: `minimax-tts-create-chunk-${chunkIndex}`,
          ttsProvider: 'minimax',
          chunkScheduler: options.chunkScheduler
        },
        async (signal) => await fetch(`${baseURL}/v1/t2a_async_v2`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          ...(signal ? { signal } : {})
        }).then(async (response) => {
          if (!response.ok) {
            throw await createMinimaxHttpError(response, 'MiniMax TTS task creation failed')
          }
          return response
        })
      )


      const createTaskData = validateData(
        MinimaxCreateResponseSchema,
        await parseMinimaxJsonResponse(createTaskResponse, 'MiniMax TTS create task response', 'tts:minimax'),
        'MiniMax TTS create task response'
      )
      ensureMinimaxBaseRespSuccess(createTaskData.base_resp, 'MiniMax TTS task creation', 'tts:minimax')

      const taskId = String(createTaskData.task_id)

      const queryData = await pollUntil({
        operationName: `minimax-tts-chunk-${chunkIndex}`,
        intervalMs: POLL_INTERVAL_MS,
        deadlineMs: POLL_TIMEOUT_MS,
        pollFn: async () => {
          const queryResponse = await withHostedTtsRetry(
            {
              operationName: `minimax-tts-query-chunk-${chunkIndex}`,
              ttsProvider: 'minimax',
              chunkScheduler: options.chunkScheduler
            },
            async (signal) => await fetch(`${baseURL}/v1/query/t2a_async_query_v2?task_id=${encodeURIComponent(taskId)}`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              ...(signal ? { signal } : {})
            }).then(async (response) => {
              if (!response.ok) {
                throw await createMinimaxHttpError(response, 'MiniMax TTS task query failed')
              }
              return response
            })
          )

          const data = validateData(
            MinimaxQueryResponseSchema,
            await parseMinimaxJsonResponse(queryResponse, 'MiniMax TTS query task response', 'tts:minimax'),
            'MiniMax TTS query task response'
          )
          ensureMinimaxBaseRespSuccess(data.base_resp, 'MiniMax TTS task query', 'tts:minimax')
          return data
        },
        isDone: (data) => isMinimaxTaskSuccess(readTaskStatus(data)),
        isFailed: (data) => {
          const status = readTaskStatus(data)
          if (isMinimaxTaskFailure(status)) {
            return { failed: true, reason: data.error_message ?? data.base_resp?.status_msg ?? 'Unknown error' }
          }
          return { failed: false }
        }
      })

      const fileId = extractFileId(createTaskData, queryData)
      if (!fileId) {
        throw InfraError('MiniMax TTS task succeeded but no file_id was returned', { stage: 'tts:minimax' })
      }

      const chunkPath = `${outputDir}/speech-minimax-chunk-${chunkIndex}.mp3`
      await downloadChunkAudio(baseURL, apiKey, fileId, chunkPath)
      chunkPaths.push(chunkPath)
      return chunkPath
    }, { provider: 'minimax', scheduler: options.chunkScheduler })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'MiniMax')
    const result = finalizeTtsRun({
      service: 'minimax',
      model: options.model,
      speaker: voiceId,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })

    return {
      audioPath: result.audioPath,
      metadata: result.metadata
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
    await Bun.$`rm -f ${outputDir}/speech-minimax-chunks.txt`.quiet().nothrow()
  }
}
