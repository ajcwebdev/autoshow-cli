import type { HostedTtsChunkPipelineOptions, Step4Metadata } from '~/types'
import { concatAndConvertToWav, runTtsChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/process-steps/step-4-tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { InfraError } from '~/utils/error-handler'

export const runHostedTtsChunkPipeline = async (
  options: HostedTtsChunkPipelineOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const { chunkScheduler, chunks, outputDir, provider, providerLabel } = options
  const chunkPaths: string[] = []

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index) => {
      const chunkIndex = index + 1
      const chunkPath = `${outputDir}/speech-${provider}-chunk-${String(chunkIndex).padStart(3, '0')}.${options.chunkExtension}`
      const audioBytes = await withHostedTtsRetry(
        {
          operationName: `${provider}-tts-chunk-${chunkIndex}`,
          ttsProvider: provider,
          chunkScheduler
        },
        async (signal) => await options.fetchChunkAudio({ chunk, chunkIndex, signal })
      )

      if (audioBytes.byteLength === 0) {
        throw InfraError(`${providerLabel} TTS returned empty audio`, { stage: `tts:${provider}` })
      }

      await Bun.write(chunkPath, audioBytes)
      chunkPaths.push(chunkPath)
      return chunkPath
    }, { provider, scheduler: chunkScheduler })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, providerLabel)
    const result = finalizeTtsRun({
      service: provider,
      model: options.model,
      speaker: options.speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime: options.startTime
    })

    return {
      audioPath: result.audioPath,
      metadata: {
        ...result.metadata,
        ...options.extraMetadata
      }
    }
  } finally {
    for (const chunkPath of chunkPaths) {
      await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
    }
  }
}
