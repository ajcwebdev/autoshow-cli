import type { RunReplicateTtsOptions, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { REPLICATE_DEFAULT_TTS_VOICE, validateReplicateTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ProviderError, ValidationError } from '~/utils/error-handler'
import { normalizeReplicateOutputUris, runReplicatePrediction } from '~/utils/replicate-client/replicate-prediction'
import { extractRestErrorMessage, parseJsonOrText, readRestResponseText } from '~/utils/rest-client'
import { classifyFetchRetry, isRetryableStatus, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { hashCanonicalTtsValue } from '../../script-to-audio/contract-identity'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import { resolveCredential } from '~/utils/validate/env-utils'

export const REPLICATE_KOKORO_VERSION = 'f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13'
export const REPLICATE_KOKORO_MODEL_ID = 'jaaari/kokoro-82m' as const
export const REPLICATE_KOKORO_SERIALIZER_VERSION = 'replicate.kokoro.v1' as const

const KOKORO_FIXTURE_BASE = {
  schemaVersion: 1 as const,
  provider: 'replicate' as const,
  model: REPLICATE_KOKORO_MODEL_ID,
  pinnedVersion: REPLICATE_KOKORO_VERSION,
  transport: 'hosted-api' as const,
  endpoint: '/v1/predictions' as const,
  serializerVersion: REPLICATE_KOKORO_SERIALIZER_VERSION,
  inputSchema: { text: 'string', voice: 'stock-voice-id', speed: 'optional-number-0.1-5' } as const,
  defaultVoice: 'af_bella' as const,
  checkedAt: '2026-08-14' as const,
  sourceRefs: [
    'https://replicate.com/jaaari/kokoro-82m',
    'https://replicate.com/jaaari/kokoro-82m/api',
    'https://replicate.com/jaaari/kokoro-82m/api/schema',
    'https://replicate.com/jaaari/kokoro-82m/readme',
    'https://replicate.com/docs/reference/http#create-a-prediction',
  ],
  pricing: {
    currency: 'USD' as const,
    typicalPerPredictionCents: 0.022,
    inputDependent: true,
  },
}

export const REPLICATE_KOKORO_TTS_FIXTURE = {
  ...KOKORO_FIXTURE_BASE,
  fixtureHash: hashCanonicalTtsValue(KOKORO_FIXTURE_BASE),
}

export const runReplicateTts = async (
  text: string,
  outputDir: string,
  options: RunReplicateTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = resolveCredential('replicate', 'require', { stage: 'tts:replicate', providedValue: options.apiKey, useProvidedValue: true, description: 'Replicate TTS' })
  const voice = validateReplicateTtsVoice(options.voiceId?.trim() || REPLICATE_DEFAULT_TTS_VOICE)
  if (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed < 0.1 || options.speed > 5)) {
    throw ValidationError('Replicate Kokoro TTS speed must be between 0.1 and 5', { stage: 'tts:replicate' })
  }
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.replicate ?? 2000)

  if (chunks.length === 0) {
    throw ValidationError('Replicate TTS input text is empty', { stage: 'tts:replicate' })
  }

  logTtsConfig('Replicate', [
    { label: 'model', value: options.model },
    { label: 'model version', value: REPLICATE_KOKORO_VERSION.slice(0, 12) },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length },
    ...(options.speed !== undefined ? [{ label: 'speed', value: options.speed }] : [])
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'replicate',
    providerLabel: 'Replicate',
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
    fetchChunkAudio: async ({ chunk, chunkIndex, requestAttempt, retryReasonCode, signal }) => {
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'predictions',
        serializerVersion: REPLICATE_KOKORO_SERIALIZER_VERSION,
        serializedRequest: {
          path: '/v1/predictions',
          body: {
            version: `${options.model}:${REPLICATE_KOKORO_VERSION}`,
            input: {
              text: chunk,
              voice,
              ...(options.speed !== undefined ? { speed: options.speed } : {})
            }
          }
        },
        providerText: chunk,
        voiceField: 'input.voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'wav',
          ...(options.speed !== undefined ? { speed: options.speed } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const prediction = await runReplicatePrediction({
          apiToken: apiKey,
          baseUrl: REPLICATE_DEFAULT_BASE_URL,
          model: options.model,
          version: REPLICATE_KOKORO_VERSION,
          input: {
            text: chunk,
            voice,
            ...(options.speed !== undefined ? { speed: options.speed } : {})
          },
          operationName: `replicate-tts-chunk-${chunkIndex + 1}`,
          abortSignal: signal,
          onCreated: async (created) => {
            await accepted({
              providerRequestId: created.id,
              fields: { providerStatus: created.status }
            })
          }
        })

        const outputUrl = normalizeReplicateOutputUris(prediction.output)[0]
        if (!outputUrl) {
          throw ValidationError('Replicate TTS prediction completed without an audio output URL', {
            stage: 'tts:replicate:response',
            metadata: { predictionId: prediction.id, providerStatus: prediction.status }
          })
        }

        return await withRetry({
          retryClass: 'runtime_http_read',
          operationName: `replicate-tts-audio-download-${chunkIndex + 1}`,
          timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
          abortSignal: signal
        }, async (downloadSignal) => {
          const audioRes = await fetch(outputUrl, downloadSignal ? { signal: downloadSignal } : undefined)
          if (!audioRes.ok) {
            const captured = await readRestResponseText(audioRes)
            const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
            throw ProviderError(`Replicate TTS audio download failed (${audioRes.status}): ${extractRestErrorMessage(payload, captured.text, audioRes.status)}`, {
              status: audioRes.status,
              headers: audioRes.headers,
              stage: 'tts:replicate:download',
              retryable: isRetryableStatus(audioRes.status)
            })
          }
          const audio = new Uint8Array(await audioRes.arrayBuffer())
          if (audio.byteLength === 0) {
            throw ValidationError('Replicate TTS audio download was empty', { stage: 'tts:replicate:download', retryable: false })
          }
          return audio
        }, (error) => classifyFetchRetry(error, 'runtime_http_read'))
      })
    }
  })
}
