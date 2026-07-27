import type { HostedTtsChunkScheduler, OpenAITtsModel, Step4Metadata } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { logTtsConfig } from '~/cli/commands/process-steps/step-4-tts/tts-utils/log-tts-config'
import { splitTextIntoChunks, concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { OPENAI_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAISpeech } from '~/utils/openai/openai-client'
import { InfraError, ValidationError } from '~/utils/error-handler'

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

  const supportsInstructions = options.model === 'gpt-4o-mini-tts'
  if (options.instructions && !supportsInstructions) {
    l.warn(`OpenAI ${options.model} does not support instructions; ignoring --openai-tts-instructions`)
  }
  const includeInstructions = Boolean(options.instructions) && supportsInstructions

  logTtsConfig('OpenAI', [
    { label: 'model', value: options.model },
    { label: 'voice', value: voiceId },
    ...(includeInstructions ? [{ label: 'instructions', value: 'configured' }] : []),
    ...(typeof options.speed === 'number' ? [{ label: 'speed', value: options.speed }] : []),
    { label: 'chunk count', value: chunks.length }
  ])

  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkPath = `${outputDir}/speech-openai-chunk-${String(index + 1).padStart(3, '0')}.wav`
      const requestBody = {
        model: options.model,
        voice: speechVoice,
        input: chunk,
        response_format: 'wav' as const,
        ...(includeInstructions ? { instructions: options.instructions } : {}),
        ...(typeof options.speed === 'number' ? { speed: options.speed } : {})
      }
      const bytes = await withHostedTtsRetry(
        {
          operationName: `openai-tts-chunk-${index + 1}`,
          ttsProvider: 'openai',
          chunkScheduler: options.chunkScheduler
        },
        async (signal) => await createOpenAISpeech(config, requestBody, { signal })
      )
      if (bytes.byteLength === 0) {
        throw InfraError('OpenAI TTS returned empty audio', { stage: 'tts:openai' })
      }
      await Bun.write(chunkPath, bytes)
      chunkPaths.push(chunkPath)
      return chunkPath
    }, { provider: 'openai', scheduler: options.chunkScheduler })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, 'OpenAI')
    const result = finalizeTtsRun({
      service: 'openai',
      model: options.model,
      speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime
    })

    return {
      audioPath: result.audioPath,
      metadata: result.metadata
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
