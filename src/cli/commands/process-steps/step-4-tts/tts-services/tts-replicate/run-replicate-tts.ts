import type { HostedTtsChunkScheduler, ReplicateTtsModel, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
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
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

export type RunReplicateTtsOptions = Readonly<{
  model: ReplicateTtsModel
  apiKey: string
  voiceId?: string | undefined
  promptInstructions?: string | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>

export const runReplicateTts = async (
  text: string,
  outputDir: string,
  options: RunReplicateTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  if (!options.apiKey.trim()) {
    throw ValidationError('Replicate API token is required', { stage: 'tts:replicate' })
  }
  const voice = validateReplicateTtsVoice(options.voiceId?.trim() || REPLICATE_DEFAULT_TTS_VOICE)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.replicate ?? 2000)

  if (chunks.length === 0) {
    throw ValidationError('Replicate TTS input text is empty', { stage: 'tts:replicate' })
  }

  logTtsConfig('Replicate', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length },
    ...(options.promptInstructions ? [{ label: 'instructions', value: options.promptInstructions }] : [])
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
        serializerVersion: 'replicate.tts.phase-5-v1',
        serializedRequest: {
          path: `/v1/models/${options.model}/predictions`,
          body: {
            input: {
              text: chunk,
              voice,
              ...(options.promptInstructions ? { prompt: options.promptInstructions } : {})
            }
          }
        },
        providerText: chunk,
        voiceField: 'input.voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'wav',
          ...(options.promptInstructions ? { promptInstructions: options.promptInstructions } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const prediction = await runReplicatePrediction({
          apiToken: options.apiKey,
          baseUrl: REPLICATE_DEFAULT_BASE_URL,
          model: options.model,
          input: {
            text: chunk,
            voice,
            ...(options.promptInstructions ? { prompt: options.promptInstructions } : {})
          },
          operationName: `Replicate TTS chunk ${chunkIndex + 1}`,
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
          operationName: `Replicate TTS audio download ${chunkIndex + 1}`,
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
            throw ValidationError('Replicate TTS audio download was empty', { stage: 'tts:replicate:download' })
          }
          return audio
        }, (error) => classifyFetchRetry(error, 'runtime_http_read'))
      })
    }
  })
}
