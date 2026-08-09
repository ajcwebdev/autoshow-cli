import type { HostedTtsChunkScheduler, OpenAITtsModel, Step4Metadata } from '~/types'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { runHostedTtsChunkPipeline } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-pipeline'
import { OPENAI_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAISpeech } from '~/utils/openai/openai-client'
import { ValidationError } from '~/utils/error-handler'

export const runOpenAITts = async (
  text: string,
  outputDir: string,
  options: {
    model: OpenAITtsModel
    voiceId?: string | undefined
    instructions?: string | undefined
    speed?: number | undefined
    chunkConcurrency?: number | undefined
    chunkScheduler?: HostedTtsChunkScheduler | undefined
  }
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const config = getOpenAIClientConfig()
  const chunks = splitTextIntoChunks(text, TTS_CHUNK_CHARACTER_LIMITS.openai)

  if (chunks.length === 0) {
    throw ValidationError('OpenAI TTS input text is empty', { stage: 'tts:openai' })
  }

  const startTime = Date.now()
  const voiceId = options.voiceId?.trim() || OPENAI_DEFAULT_TTS_VOICE
  const speaker = voiceId
  const speechVoice = voiceId

  const supportsInstructions = options.model === 'gpt-4o-mini-tts-2025-12-15'
  const includeInstructions = Boolean(options.instructions) && supportsInstructions

  logTtsConfig('OpenAI', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId },
    ...(includeInstructions ? [{ label: 'instructions', value: 'configured' }] : []),
    ...(typeof options.speed === 'number' ? [{ label: 'speed', value: options.speed }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  return await runHostedTtsChunkPipeline({
    provider: 'openai',
    providerLabel: 'OpenAI',
    model: options.model,
    speaker,
    chunks,
    outputDir,
    chunkExtension: 'wav',
    startTime,
    chunkConcurrency: options.chunkConcurrency,
    chunkScheduler: options.chunkScheduler,
    fetchChunkAudio: async ({ chunk, signal }) => {
      const requestBody = {
        model: options.model,
        voice: speechVoice,
        input: chunk,
        response_format: 'wav' as const,
        ...(includeInstructions ? { instructions: options.instructions } : {}),
        ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
      }
      return await createOpenAISpeech(config, requestBody, { signal })
    }
  })
}
