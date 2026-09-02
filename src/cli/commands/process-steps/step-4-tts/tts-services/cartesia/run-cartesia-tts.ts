import type { CartesiaTtsModel, HostedTtsChunkScheduler, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import {
  CARTESIA_DEFAULT_TTS_VOICE,
  validateCartesiaTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { resolveCredential } from '~/utils/validate/env-utils'
import { CARTESIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ValidationError } from '~/utils/error-handler'
import { httpResponseError, httpResponseOptions } from '~/utils/rest-client'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { readRestErrorText } from '~/utils/rest-client'
const CARTESIA_DEFAULT_VERSION = '2026-03-01'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const runCartesiaTts = async (
  text: string,
  outputDir: string,
  options: {
    model: CartesiaTtsModel
    voiceId?: string | undefined
    language?: string | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = resolveCredential('cartesia', 'require', { stage: 'tts:cartesia', description: 'Cartesia TTS' })

  const baseURL = trimTrailingSlash(CARTESIA_DEFAULT_BASE_URL)
  const version = CARTESIA_DEFAULT_VERSION
  const voice = validateCartesiaTtsVoice(options.voiceId?.trim() || CARTESIA_DEFAULT_TTS_VOICE)
  const language = options.language?.trim() || undefined
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.cartesia)

  if (chunks.length === 0) {
    throw ValidationError('Cartesia TTS input text is empty', { stage: 'tts:cartesia' })
  }

  logTtsConfig('Cartesia', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'language', value: language },
    { label: 'version', value: version },
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'cartesia',
    providerLabel: 'Cartesia',
    model: options.model,
    speaker: voice,
    chunks,
    outputDir,
    chunkExtension: 'wav',
    startTime: Date.now(),
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, signal, requestAttempt, retryReasonCode }) => {
      const requestBody = {
        model_id: options.model,
        transcript: chunk,
        voice: { mode: 'id', id: voice },
        ...(language ? { language } : {}),
        output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 }
      }
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'cartesia.tts.phase-0-v1',
        serializedRequest: { path: '/tts/bytes', version, body: requestBody },
        providerText: chunk,
        voiceField: 'voice.id',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          ...(language ? { language } : {}),
          outputFormat: requestBody.output_format,
          version
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const response = await fetch(`${baseURL}/tts/bytes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Cartesia-Version': version,
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream'
        },
        body: JSON.stringify(requestBody),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readRestErrorText(response)
        throw httpResponseError(`Cartesia TTS failed (${response.status}): ${errText}`, httpResponseOptions(response, {
          stage: 'tts:cartesia', retryClass: 'runtime_http_create_conservative', retryable: response.status === 425 || response.status === 429, metadata: { provider: 'cartesia' }
        }))
      }
      await accepted({ fields: { httpStatus: response.status } })
      return new Uint8Array(await response.arrayBuffer())
      })
    }
  })
}
