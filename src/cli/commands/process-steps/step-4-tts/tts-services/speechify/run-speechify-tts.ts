import * as v from 'valibot'
import type { HostedTtsChunkScheduler, SpeechifyTtsCustomVoiceOptions, SpeechifyTtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { SPEECHIFY_DEFAULT_TTS_VOICE, validateSpeechifyTtsLanguageForModel, validateSpeechifyTtsVoiceForModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { requireApiKey } from '~/utils/validate/env-utils'
import { SPEECHIFY_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { validateDataSafe } from '~/utils/validate/validation'
import { ValidationError } from '~/utils/error-handler'
import { ensureSpeechifyTtsCustomVoice } from './speechify-custom-voices'

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
    customVoice?: SpeechifyTtsCustomVoiceOptions | undefined
    audioFormat?: string | undefined
    language?: string | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('SPEECHIFY_API_KEY', 'tts:speechify', 'Speechify TTS')

  const baseURL = trimTrailingSlash(SPEECHIFY_DEFAULT_BASE_URL)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.speechify)

  if (chunks.length === 0) {
    throw ValidationError('Speechify TTS input text is empty', { stage: 'tts:speechify' })
  }

  const startTime = Date.now()
  const customVoiceResult = options.customVoice
    ? await ensureSpeechifyTtsCustomVoice(baseURL, apiKey, options.customVoice)
    : undefined
  const voice = validateSpeechifyTtsVoiceForModel(options.model, customVoiceResult?.voiceId || options.voiceId?.trim() || SPEECHIFY_DEFAULT_TTS_VOICE)
  const audioFormat = options.audioFormat?.trim() || 'mp3'
  const language = validateSpeechifyTtsLanguageForModel(options.model, options.language)
  const speaker = customVoiceResult ? `ref_audio:${customVoiceResult.sourceAudio.basename}` : voice

  logTtsConfig('Speechify', [
    { label: 'model', value: options.model },
    { label: customVoiceResult ? 'reference audio' : 'voice', value: customVoiceResult ? customVoiceResult.sourceAudio.basename : voice },
    { label: 'audio format', value: audioFormat },
    { label: 'language', value: language },
    ...(customVoiceResult ? [{ label: 'created voice_id', value: customVoiceResult.voiceId }] : []),
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
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    ...(customVoiceResult ? { extraMetadata: { clonedVoiceId: customVoiceResult.voiceId, cloneCostCents: 0 } } : {}),
    fetchChunkAudio: async ({ chunk, signal }) => {
      const response = await fetch(`${baseURL}/v1/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          input: chunk,
          voice_id: voice,
          audio_format: audioFormat,
          model: options.model,
          ...(language ? { language } : {})
        }),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readSpeechifyError(response)
        const err = new Error(`Speechify TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
        err.status = response.status
        err.headers = response.headers
        throw err
      }

      const payload = validateDataSafe(SpeechifySpeechResponseSchema, await response.json())
      if (!payload) {
        throw ValidationError('Speechify TTS returned an invalid response: missing audio_data', { stage: 'tts:speechify' })
      }
      return decodeSpeechifyAudioData(payload.audio_data)
    }
  })
}
