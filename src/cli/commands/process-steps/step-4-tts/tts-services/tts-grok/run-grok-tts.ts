import type { GrokTtsModel, HostedTtsChunkScheduler, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { fetchTtsAudioBytes, trimTrailingSlash } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-http-utils'
import { GROK_DEFAULT_TTS_VOICE, validateGrokTtsLanguage, validateGrokTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { requireApiKey } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ValidationError } from '~/utils/error-handler'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

export const runGrokTts = async (
  text: string,
  outputDir: string,
  options: {
    model: GrokTtsModel
    voiceId?: string | undefined
    language?: string | undefined
    textNormalization?: boolean | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('XAI_API_KEY', 'tts:grok', 'Grok TTS')

  const baseURL = trimTrailingSlash(XAI_DEFAULT_BASE_URL)
  const rawVoice = options.voiceId?.trim() || GROK_DEFAULT_TTS_VOICE
  const voice = validateGrokTtsVoice(rawVoice)
  const language = validateGrokTtsLanguage(options.language?.trim() || 'auto')
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.grok)

  if (chunks.length === 0) {
    throw ValidationError('Grok TTS input text is empty', { stage: 'tts:grok' })
  }

  logTtsConfig('Grok', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'language', value: language },
    ...(options.textNormalization === true ? [{ label: 'text normalization', value: 'enabled' }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'grok',
    providerLabel: 'Grok',
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
        text: chunk,
        voice_id: voice,
        language,
        text_normalization: options.textNormalization === true,
        output_format: {
          codec: 'wav',
          sample_rate: 24000
        }
      }
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'grok.tts.phase-0-v1',
        serializedRequest: { path: '/tts', body },
        providerText: chunk,
        voiceField: 'voice_id',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: { language, textNormalization: options.textNormalization === true, outputFormat: body.output_format },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async () => await fetchTtsAudioBytes({
        url: `${baseURL}/tts`, apiKey, providerLabel: 'Grok', signal, body
      }))
    }
  })
}
