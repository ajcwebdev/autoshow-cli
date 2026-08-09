import type { DeepgramTtsModel, HostedTtsChunkScheduler, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { DEEPGRAM_DEFAULT_VOICE, validateDeepgramTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { requireApiKey } from '~/utils/validate/env-utils'
import { DEEPGRAM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InfraError } from '~/utils/error-handler'
import { readDeepgramError } from './deepgram-utils'
import { httpResponseError } from '~/utils/rest-client'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const runDeepgramTts = async (
  text: string,
  outputDir: string,
  options: {
    model: DeepgramTtsModel
    voiceId?: string | undefined
    encoding?: string | undefined
    container?: string | undefined
    bitRate?: number | undefined
    sampleRate?: number | undefined
    speed?: number | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('DEEPGRAM_API_KEY', 'tts:deepgram', 'Deepgram TTS')

  const baseURL = trimTrailingSlash(DEEPGRAM_DEFAULT_BASE_URL)
  const rawVoice = options.voiceId?.trim() || options.model || DEEPGRAM_DEFAULT_VOICE
  const voice = validateDeepgramTtsVoice(rawVoice)
  const encoding = options.encoding?.trim() || undefined
  const container = options.container?.trim() || undefined
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.deepgram)

  if (chunks.length === 0) {
    throw InfraError('Deepgram TTS input text is empty', { stage: 'tts:deepgram' })
  }

  logTtsConfig('Deepgram', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voice },
    { label: 'encoding', value: encoding },
    { label: 'container', value: container },
    { label: 'bit rate', value: options.bitRate },
    { label: 'sample rate', value: options.sampleRate },
    { label: 'speed', value: options.speed },
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'deepgram',
    providerLabel: 'Deepgram',
    model: options.model,
    speaker: voice,
    chunks,
    outputDir,
    chunkExtension: 'mp3',
    startTime: Date.now(),
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    fetchChunkAudio: async ({ chunk, signal }) => {
      const params = new URLSearchParams({ model: voice })
      if (encoding) params.set('encoding', encoding)
      if (container) params.set('container', container)
      if (typeof options.bitRate === 'number') params.set('bit_rate', String(options.bitRate))
      if (typeof options.sampleRate === 'number') params.set('sample_rate', String(options.sampleRate))
      if (typeof options.speed === 'number') params.set('speed', String(options.speed))

      const response = await fetch(`${baseURL}/v1/speak?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        body: JSON.stringify({ text: chunk }),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readDeepgramError(response)
        throw httpResponseError(`Deepgram TTS failed (${response.status}): ${errText}`, response)
      }

      return new Uint8Array(await response.arrayBuffer())
    }
  })
}
