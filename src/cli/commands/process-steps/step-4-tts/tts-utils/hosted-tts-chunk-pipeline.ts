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
  let completed = false

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, options.chunkConcurrency, async (chunk, index, admission) => {
      const chunkIndex = index + 1
      const chunkPath = `${outputDir}/speech-${provider}-chunk-${String(chunkIndex).padStart(3, '0')}.${options.chunkExtension}`
      const audioBytes = await withHostedTtsRetry(
        {
          operationName: `${provider}-tts-chunk-${chunkIndex}`,
          abortSignal: options.abortSignal,
          admission,
          chunkScheduler
        },
        async (signal, requestAttempt) => await options.fetchChunkAudio({
          chunk,
          chunkIndex,
          signal,
          requestAttempt: requestAttempt.attempt,
          ...(requestAttempt.retryReasonCode ? { retryReasonCode: requestAttempt.retryReasonCode } : {})
        })
      )

      if (audioBytes.byteLength === 0) {
        throw InfraError(`${providerLabel} TTS returned empty audio`, { stage: `tts:${provider}` })
      }

      await Bun.write(chunkPath, audioBytes)
      await options.requestEvidence?.recordOutput({ chunkIndex, path: chunkPath })
      await options.requestEvidence?.complete({ chunkIndex })
      chunkPaths.push(chunkPath)
      return chunkPath
    }, {
      provider,
      scheduler: chunkScheduler,
      job: options.chunkJob,
      scopeLabel: options.laneScopeLabel,
      abortSignal: options.abortSignal
    })

    const audioPath = await concatAndConvertToWav(orderedChunkPaths, outputDir, providerLabel, options.abortSignal)
    const result = finalizeTtsRun({
      service: provider,
      model: options.model,
      speaker: options.speaker,
      audioPath,
      chunkCount: chunks.length,
      startTime: options.startTime
    })

    const finalized = {
      audioPath: result.audioPath,
      metadata: {
        ...result.metadata,
        ...options.extraMetadata
      }
    }
    completed = true
    return finalized
  } finally {
    if (completed) {
      for (const chunkPath of chunkPaths) {
        await Bun.$`rm -f ${chunkPath}`.quiet().nothrow()
      }
    }
  }
}
