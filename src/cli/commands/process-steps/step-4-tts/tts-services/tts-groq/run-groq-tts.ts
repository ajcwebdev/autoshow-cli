import type { GroqTtsModel, HostedTtsChunkScheduler, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { fetchTtsAudioBytes } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-http-utils'
import {
  getGroqDefaultTtsVoiceForModel,
  validateGroqTtsVoiceForModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { requireApiKey } from '~/utils/validate/env-utils'
import { GROQ_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ValidationError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

export const runGroqTts = async (
  text: string,
  outputDir: string,
  options: { model: GroqTtsModel, voiceId?: string | undefined, speed?: number | undefined, abortSignal?: AbortSignal | undefined, chunkConcurrency?: number | undefined, chunkScheduler?: HostedTtsChunkScheduler | undefined, requestEvidence?: TtsRequestEvidenceScope | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('GROQ_API_KEY', 'tts:groq', 'Groq TTS')

  const baseURL = GROQ_DEFAULT_BASE_URL
  const rawVoice = options.voiceId?.trim() || getGroqDefaultTtsVoiceForModel(options.model)
  const voice = validateGroqTtsVoiceForModel(options.model, rawVoice)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.groq)
  if (chunks.length === 0) {
    throw ValidationError('Groq TTS input text is empty', { stage: 'tts:groq' })
  }

  logTtsConfig('Groq', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'speed', value: options.speed },
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'groq',
    providerLabel: 'Groq',
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
      const body = {
        model: options.model,
        voice,
        input: chunk,
        response_format: 'wav',
        ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
      }
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'groq.tts.phase-0-v1',
        serializedRequest: { path: '/audio/speech', body },
        providerText: chunk,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          responseFormat: body.response_format,
          ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async () => await fetchTtsAudioBytes({
        url: `${baseURL}/audio/speech`, apiKey, providerLabel: 'Groq', signal, body
      }))
    }
  })
}
