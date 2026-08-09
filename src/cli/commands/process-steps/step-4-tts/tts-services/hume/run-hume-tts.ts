import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { HUME_DEFAULT_TTS_VOICE, validateHumeTtsVoice, validateHumeTtsVoiceProvider } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { HostedTtsChunkScheduler, HumeTtsModel, HumeVoicePayload, Step4Metadata } from '~/types'
import { HUME_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { requireApiKey } from '~/utils/validate/env-utils'
import { ValidationError } from '~/utils/error-handler'
import { httpResponseError } from '~/utils/rest-client'

const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const readHumeError = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

const resolveHumeVoice = (
  options: {
    voice?: string | undefined
    voiceProvider?: string | undefined
  }
): { label: string, payload: HumeVoicePayload, provider?: string | undefined } => {
  const rawVoice = options.voice?.trim() || HUME_DEFAULT_TTS_VOICE
  const label = validateHumeTtsVoice(rawVoice)
  const explicitProvider = options.voiceProvider?.trim()

  if (UUID_LIKE_RE.test(label) && !explicitProvider) {
    return { label, payload: { id: label } }
  }

  const provider = validateHumeTtsVoiceProvider(explicitProvider || 'HUME_AI')
  return { label, provider, payload: { name: label, provider } }
}

export const runHumeTts = async (
  text: string,
  outputDir: string,
  options: {
    model: HumeTtsModel
    voice?: string | undefined
    voiceProvider?: string | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('HUME_API_KEY', 'tts:hume', 'Hume TTS')

  const baseURL = trimTrailingSlash(HUME_DEFAULT_BASE_URL)
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.hume)

  if (chunks.length === 0) {
    throw ValidationError('Hume TTS input text is empty', { stage: 'tts:hume' })
  }

  const voice = resolveHumeVoice(options)

  logTtsConfig('Hume', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice.label },
    { label: 'voice provider', value: voice.provider },
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'hume',
    providerLabel: 'Hume',
    model: options.model,
    speaker: voice.label,
    chunks,
    outputDir,
    chunkExtension: 'mp3',
    startTime: Date.now(),
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    fetchChunkAudio: async ({ chunk, signal }) => {
      const response = await fetch(`${baseURL}/v0/tts/file`, {
        method: 'POST',
        headers: {
          'X-Hume-Api-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream'
        },
        body: JSON.stringify({
          version: '2',
          format: { type: 'mp3' },
          num_generations: 1,
          utterances: [{
            text: chunk,
            voice: voice.payload
          }]
        }),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readHumeError(response)
        throw httpResponseError(`Hume TTS failed (${response.status}): ${errText}`, response)
      }

      return new Uint8Array(await response.arrayBuffer())
    }
  })
}
