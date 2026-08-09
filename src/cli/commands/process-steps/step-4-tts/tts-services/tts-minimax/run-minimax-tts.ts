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
import { InfraError, ValidationError } from '~/utils/error-handler'
import { MinimaxCreateResponseSchema, MinimaxQueryResponseSchema, isMinimaxTaskFailure, isMinimaxTaskSuccess, minimaxFetchJson, minimaxJsonRequestInit, readMinimaxTaskStatus, resolveMinimaxFileId } from '~/utils/minimax-client/minimax-client'

const MINIMAX_DEFAULT_VOICE_ID = 'English_expressive_narrator'
const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const createMinimaxHttpError = async (
  response: Response,
  message: string
): Promise<Error & { status: number, headers: Headers }> => {
  const body = await response.text()
  return InfraError(`${message} (${response.status}): ${body || 'No response body'}`, {
    stage: 'tts:minimax',
    status: response.status,
    headers: response.headers
  }) as Error & { status: number, headers: Headers }
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

      const createTaskData = await minimaxFetchJson(
        `${baseURL}/v1/t2a_async_v2`,
        {
          init: minimaxJsonRequestInit(apiKey, 'POST', requestBody),
          schema: MinimaxCreateResponseSchema,
          responseContext: 'MiniMax TTS create task response',
          baseRespContext: 'MiniMax TTS task creation',
          stage: 'tts:minimax',
          httpErrorMessage: 'MiniMax TTS task creation failed',
          decorateError: async response => await createMinimaxHttpError(response, 'MiniMax TTS task creation failed'),
          execute: async request => await withHostedTtsRetry(
            {
              operationName: `minimax-tts-create-chunk-${chunkIndex}`,
              ttsProvider: 'minimax',
              chunkScheduler: options.chunkScheduler
            },
            request
          )
        }
      )

      const taskId = String(createTaskData.task_id)

      const queryData = await pollUntil({
        operationName: `minimax-tts-chunk-${chunkIndex}`,
        intervalMs: POLL_INTERVAL_MS,
        deadlineMs: POLL_TIMEOUT_MS,
        pollFn: async () => {
          return await minimaxFetchJson(
            `${baseURL}/v1/query/t2a_async_query_v2?task_id=${encodeURIComponent(taskId)}`,
            {
              init: minimaxJsonRequestInit(apiKey, 'GET'),
              schema: MinimaxQueryResponseSchema,
              responseContext: 'MiniMax TTS query task response',
              baseRespContext: 'MiniMax TTS task query',
              stage: 'tts:minimax',
              httpErrorMessage: 'MiniMax TTS task query failed',
              decorateError: async response => await createMinimaxHttpError(response, 'MiniMax TTS task query failed'),
              execute: async request => await withHostedTtsRetry(
                {
                  operationName: `minimax-tts-query-chunk-${chunkIndex}`,
                  ttsProvider: 'minimax',
                  chunkScheduler: options.chunkScheduler
                },
                request
              )
            }
          )
        },
        isDone: (data) => isMinimaxTaskSuccess(readMinimaxTaskStatus(data)),
        isFailed: (data) => {
          const status = readMinimaxTaskStatus(data)
          if (isMinimaxTaskFailure(status)) {
            return { failed: true, reason: data.data?.error_message ?? data.error_message ?? data.base_resp?.status_msg ?? 'Unknown error' }
          }
          return { failed: false }
        }
      })

      const fileId = resolveMinimaxFileId(queryData, createTaskData)
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
