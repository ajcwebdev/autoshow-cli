import type { GroqTtsModel, HostedTtsChunkScheduler, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { fetchTtsAudioBytes } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-http-utils'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import {
  getGroqDefaultTtsVoiceForModel,
  validateGroqTtsVoiceForModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { GROQ_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { InfraError, InternalError, ValidationError, hintsForMissingEnv } from '~/utils/error-handler'

export const runGroqTts = async (
  text: string,
  outputDir: string,
  options: { model: GroqTtsModel, voiceId?: string | undefined, chunkConcurrency?: number | undefined, chunkScheduler?: HostedTtsChunkScheduler | undefined }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    throw InternalError('GROQ_API_KEY environment variable is required for Groq TTS', { stage: 'tts:groq', hints: hintsForMissingEnv('GROQ_API_KEY') })
  }

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
    { label: 'chunk count', value: chunks.length }
  ])

  const startTime = Date.now()
  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkIndex = index + 1
      const chunkPath = `${outputDir}/speech-groq-chunk-${String(chunkIndex).padStart(3, '0')}.wav`
      const audioBytes = await withHostedTtsRetry(
        {
          operationName: `groq-tts-chunk-${chunkIndex}`,
          ttsProvider: 'groq',
          chunkScheduler: options.chunkScheduler
        },
        async (signal) => await fetchTtsAudioBytes({
          url: `${baseURL}/audio/speech`,
          apiKey,
          providerLabel: 'Groq',
          signal,
          body: {
            model: options.model,
            voice,
            input: chunk,
            response_format: 'wav'
          }
        })
      )

      if (audioBytes.byteLength === 0) {
        throw InfraError('Groq TTS returned empty audio', { stage: 'tts:groq' })
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
      return chunkPath
    }, { provider: 'groq', scheduler: options.chunkScheduler })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'Groq')
    return finalizeTtsRun({
      service: 'groq',
      model: options.model,
      speaker: voice,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
