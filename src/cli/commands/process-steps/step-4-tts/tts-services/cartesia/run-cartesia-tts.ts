import type { CartesiaTtsModel, HostedTtsChunkScheduler, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import {
  CARTESIA_DEFAULT_TTS_VOICE,
  validateCartesiaTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { requireApiKey } from '~/utils/validate/env-utils'
import { CARTESIA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { ValidationError } from '~/utils/error-handler'
const CARTESIA_DEFAULT_VERSION = '2026-03-01'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const readCartesiaError = async (response: Response): Promise<string> => {
  const text = await response.text()
  return text.trim() || `HTTP ${response.status}`
}

export const runCartesiaTts = async (
  text: string,
  outputDir: string,
  options: {
    model: CartesiaTtsModel
    voiceId?: string | undefined
    language?: string | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = requireApiKey('CARTESIA_API_KEY', 'tts:cartesia', 'Cartesia TTS')

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
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    fetchChunkAudio: async ({ chunk, signal }) => {
      const response = await fetch(`${baseURL}/tts/bytes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Cartesia-Version': version,
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream'
        },
        body: JSON.stringify({
          model_id: options.model,
          transcript: chunk,
          voice: {
            mode: 'id',
            id: voice
          },
          ...(language ? { language } : {}),
          output_format: {
            container: 'wav',
            encoding: 'pcm_s16le',
            sample_rate: 24000
          }
        }),
        ...(signal ? { signal } : {})
      })

      if (!response.ok) {
        const errText = await readCartesiaError(response)
        const err = new Error(`Cartesia TTS failed (${response.status}): ${errText}`) as Error & { status: number, headers: Headers }
        err.status = response.status
        err.headers = response.headers
        throw err
      }

      return new Uint8Array(await response.arrayBuffer())
    }
  })
}
