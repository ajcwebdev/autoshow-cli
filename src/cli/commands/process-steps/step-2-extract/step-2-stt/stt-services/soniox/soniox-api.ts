import { basename } from 'node:path'
import type { DiarizationOptions, SonioxTranscriptionStatus, SonioxTranscriptResponse, SttRequestMetrics } from '~/types'
import {
  SonioxFileResponseSchema,
  SonioxTranscriptResponseSchema,
  SonioxTranscriptionStatusSchema
} from '~/types'
import { deleteSttRemoteResource } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { sttStageRequest, sttStageRequestWithRetryAfter } from '../stt-stage-request'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const buildSonioxUrl = (baseURL: string, path: string): string => new URL(path, baseURL).toString()

const buildUploadForm = (
  audioPath: string
): FormData => {
  const form = new FormData()
  form.append('file', Bun.file(audioPath), basename(audioPath))
  return form
}

export const buildSonioxCreateRequest = (
  modelName: string,
  fileId: string,
  diarizationOptions?: Pick<DiarizationOptions, 'enabled'> | undefined
): Record<string, unknown> => ({
  model: modelName,
  file_id: fileId,
  enable_speaker_diarization: diarizationOptions?.enabled !== false
})

export const uploadAudio = async (
  baseURL: string,
  apiKey: string,
  audioPath: string,
  metrics?: SttRequestMetrics | undefined
): Promise<string> => {
  const payload = await sttStageRequest({
    operationName: 'soniox-upload',
    stage: 'upload',
    retryClass: 'runtime_http_create_conservative',
    maxAttempts: 4,
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Soniox',
    schema: SonioxFileResponseSchema,
    schemaLabel: 'Soniox upload response',
    metrics,
    doFetch: (signal) => fetch(buildSonioxUrl(baseURL, '/v1/files'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: buildUploadForm(audioPath),
      signal: signal ?? null
    })
  })

  return payload.id
}

export const createTranscription = async (
  baseURL: string,
  apiKey: string,
  modelName: string,
  fileId: string,
  diarizationOptions: DiarizationOptions | undefined,
  metrics?: SttRequestMetrics | undefined
): Promise<string> => {
  const body = buildSonioxCreateRequest(modelName, fileId, diarizationOptions)

  const payload = await sttStageRequest({
    operationName: 'soniox-create-transcription',
    stage: 'create',
    retryClass: 'runtime_http_create_conservative',
    maxAttempts: 4,
    timeoutMs: REQUEST_TIMEOUT_MS,
    errorPrefix: 'Soniox',
    schema: SonioxTranscriptionStatusSchema,
    schemaLabel: 'Soniox transcription create response',
    metrics,
    doFetch: (signal) => fetch(buildSonioxUrl(baseURL, '/v1/transcriptions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: signal ?? null
    })
  })

  return payload.id
}

export const pollTranscription = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string,
  metrics?: SttRequestMetrics | undefined
): Promise<{ retryAfterMs: number | null, status: SonioxTranscriptionStatus }> => {
  const { value, retryAfterMs } = await sttStageRequestWithRetryAfter({
    operationName: 'soniox-poll-transcription',
    stage: 'poll',
    retryClass: 'runtime_http_read',
    maxAttempts: 6,
    timeoutMs: POLL_REQUEST_TIMEOUT_MS,
    errorPrefix: 'Soniox',
    schema: SonioxTranscriptionStatusSchema,
    schemaLabel: 'Soniox transcription status',
    metrics,
    doFetch: (signal) => fetch(buildSonioxUrl(baseURL, `/v1/transcriptions/${transcriptionId}`), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: signal ?? null
    })
  })

  return {
    retryAfterMs,
    status: value
  }
}

export const getTranscriptionTranscript = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string,
  metrics?: SttRequestMetrics | undefined
): Promise<SonioxTranscriptResponse> => await sttStageRequest({
  operationName: 'soniox-get-transcript',
  stage: 'transcript',
  retryClass: 'runtime_http_read',
  maxAttempts: 6,
  timeoutMs: POLL_REQUEST_TIMEOUT_MS,
  errorPrefix: 'Soniox',
  schema: SonioxTranscriptResponseSchema,
  schemaLabel: 'Soniox transcript response',
  metrics,
  doFetch: (signal) => fetch(buildSonioxUrl(baseURL, `/v1/transcriptions/${transcriptionId}/transcript`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    signal: signal ?? null
  })
})

export const deleteTranscription = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string
): Promise<boolean> => await deleteSttRemoteResource({
  url: buildSonioxUrl(baseURL, `/v1/transcriptions/${transcriptionId}`),
  apiKey,
  provider: 'soniox',
  artifact: 'transcription',
  id: transcriptionId
})

export const deleteFile = async (
  baseURL: string,
  apiKey: string,
  fileId: string
): Promise<boolean> => await deleteSttRemoteResource({
  url: buildSonioxUrl(baseURL, `/v1/files/${fileId}`),
  apiKey,
  provider: 'soniox',
  artifact: 'file',
  id: fileId
})
