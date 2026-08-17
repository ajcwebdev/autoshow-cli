import type { FishTtsModel, HostedTtsChunkScheduler, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { FISH_DEFAULT_TTS_VOICE, validateFishTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { createFishClient } from '~/utils/fish-client/fish-client'
import { ValidationError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'
import {
  FISH_TIMESTAMP_SERIALIZER_VERSION,
  FISH_TTS_SERIALIZER_VERSION,
  isFishTimestampModel,
  normalizeFishTimestampAlignment,
  prepareFishDialogueText,
} from './fish-tts-request'

export type RunFishTtsOptions = Readonly<{
  model: FishTtsModel
  apiKey: string
  voiceId?: string | undefined
  latency?: 'normal' | 'balanced' | undefined
  abortSignal?: AbortSignal | undefined
  chunkConcurrency?: number | undefined
  chunkScheduler?: HostedTtsChunkScheduler | undefined
  requestEvidence?: TtsRequestEvidenceScope | undefined
}>

export const runFishTts = async (
  text: string,
  outputDir: string,
  options: RunFishTtsOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const voice = validateFishTtsVoice(options.voiceId?.trim() || FISH_DEFAULT_TTS_VOICE)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.fish ?? 2000)

  if (chunks.length === 0) {
    throw ValidationError('Fish Audio TTS input text is empty', { stage: 'tts:fish' })
  }

  logTtsConfig('Fish', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'chunk count', value: chunks.length }
  ])

  const client = createFishClient({
    apiKey: options.apiKey,
  })

  return await runHostedTtsChunkPipeline({
    provider: 'fish',
    providerLabel: 'Fish Audio',
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
      const timestamped = isFishTimestampModel(options.model)
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: timestamped ? 'text-to-speech-stream-with-timestamps' : 'speech-synthesis',
        serializerVersion: timestamped ? FISH_TIMESTAMP_SERIALIZER_VERSION : FISH_TTS_SERIALIZER_VERSION,
        serializedRequest: timestamped
          ? { path: '/v1/tts/stream/with-timestamp', body: { text: chunk, reference_id: voice, format: 'wav' } }
          : { path: '/v1/tts', body: { text: chunk, reference_id: voice, model: options.model, format: 'wav' } },
        providerText: chunk,
        voiceField: 'reference_id',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          format: 'wav',
          ...(timestamped ? { model: options.model } : {}),
          ...(options.latency ? { latency: options.latency } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        if (timestamped) {
          const result = await client.synthesizeTtsWithTimestamps({
            text: chunk,
            reference_id: voice,
            model: options.model,
            format: 'wav',
            latency: options.latency,
          }, {
            signal,
            onAccepted: async (response) => {
              await accepted({
                providerRequestId: response.headers.get('x-request-id') ?? undefined,
                fields: { httpStatus: response.status }
              })
            }
          })
          return {
            audio: new Uint8Array(result.audioBuffer),
            timing: (identity) => normalizeFishTimestampAlignment({
              text: prepareFishDialogueText(chunk, undefined, options.model).providerText,
              timeline: result.timeline,
              identity,
            }),
          }
        }
        const { audioBuffer } = await client.synthesizeTts({
          text: chunk,
          reference_id: voice,
          model: options.model,
          format: 'wav',
          latency: options.latency,
        }, {
          signal,
          onAccepted: async (response) => {
            await accepted({
              providerRequestId: response.headers.get('x-request-id') ?? undefined,
              fields: { httpStatus: response.status }
            })
          }
        })
        return new Uint8Array(audioBuffer)
      })
    }
  })
}
