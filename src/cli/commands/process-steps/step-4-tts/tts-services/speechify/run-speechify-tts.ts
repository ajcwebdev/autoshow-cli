import * as v from 'valibot'
import type { HostedTtsChunkScheduler, SpeechifyTtsModel, Step4Metadata, TtsRequestEvidenceScope } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { SPEECHIFY_DEFAULT_TTS_VOICE, validateSpeechifyTtsLanguageForModel, validateSpeechifyTtsVoiceForModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { requireApiKey } from '~/utils/validate/env-utils'
import { SPEECHIFY_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { validateDataSafe } from '~/utils/validate/validation'
import { ValidationError } from '~/utils/error-handler'
import { httpResponseError } from '~/utils/rest-client'
import { dispatchTtsProviderRequest } from '../../script-to-audio/tts-request-evidence'

const SpeechifySpeechResponseSchema = v.object({
  audio_data: v.string()
})

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const decodeSpeechifyAudioData = (audioData: string): Uint8Array => {
  const cleaned = audioData.includes(',')
    ? audioData.slice(audioData.indexOf(',') + 1)
    : audioData
  return new Uint8Array(Buffer.from(cleaned, 'base64'))
}

const readSpeechifyError = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

export const runSpeechifyTts = async (
  text: string,
  outputDir: string,
  options: {
    model: SpeechifyTtsModel
    voiceId?: string | undefined
    audioFormat?: string | undefined
    language?: string | undefined
    abortSignal?: AbortSignal | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
    requestEvidence?: TtsRequestEvidenceScope | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('SPEECHIFY_API_KEY', 'tts:speechify', 'Speechify TTS')

  const baseURL = trimTrailingSlash(SPEECHIFY_DEFAULT_BASE_URL)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.speechify)

  if (chunks.length === 0) {
    throw ValidationError('Speechify TTS input text is empty', { stage: 'tts:speechify' })
  }

  const startTime = Date.now()
  const voice = validateSpeechifyTtsVoiceForModel(options.model, options.voiceId?.trim() || SPEECHIFY_DEFAULT_TTS_VOICE)
  const audioFormat = options.audioFormat?.trim() || 'mp3'
  const language = validateSpeechifyTtsLanguageForModel(options.model, options.language)
  const speaker = voice

  logTtsConfig('Speechify', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'audio format', value: audioFormat },
    { label: 'language', value: language },
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'speechify',
    providerLabel: 'Speechify',
    model: options.model,
    speaker,
    chunks,
    outputDir,
    chunkExtension: audioFormat,
    startTime,
    abortSignal: options.abortSignal,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    requestEvidence: options.requestEvidence,
    fetchChunkAudio: async ({ chunk, chunkIndex, signal, requestAttempt, retryReasonCode }) => {
      const requestBody = {
        input: chunk,
        voice_id: voice,
        audio_format: audioFormat,
        model: options.model,
        ...(language ? { language } : {})
      }
      return await dispatchTtsProviderRequest(options.requestEvidence, {
        chunkIndex,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'speechify.tts.phase-0-v1',
        serializedRequest: { path: '/v1/audio/speech', body: requestBody },
        providerText: chunk,
        voiceField: 'voice_id',
        voices: [{ kind: 'provider-id', value: voice }],
        requestControls: {
          audioFormat,
          ...(language ? { language } : {})
        },
        continuation: { kind: 'none' }
      }, { attempt: requestAttempt, ...(retryReasonCode ? { retryReasonCode } : {}) }, async ({ accepted }) => {
        const response = await fetch(`${baseURL}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(requestBody),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readSpeechifyError(response)
        throw httpResponseError(`Speechify TTS failed (${response.status}): ${errText}`, response)
      }
      await accepted({ fields: { httpStatus: response.status } })

      const payload = validateDataSafe(SpeechifySpeechResponseSchema, await response.json())
      if (!payload) {
        throw ValidationError('Speechify TTS returned an invalid response: missing audio_data', { stage: 'tts:speechify' })
      }
      return decodeSpeechifyAudioData(payload.audio_data)
      })
    }
  })
}
