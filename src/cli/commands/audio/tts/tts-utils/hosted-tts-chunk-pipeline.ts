import type { HostedTtsChunkPipelineOptions, HostedTtsInlineAudioResponse, Step4Metadata } from '~/types'
import { rm } from 'node:fs/promises'
import { concatAndConvertToWav, requireHostedTtsChunkScheduler, runTtsChunks } from '~/cli/commands/audio/tts/tts-utils/audio-utils'
import { finalizeTtsRun } from '~/cli/commands/audio/tts/tts-utils/finalize-tts-run'
import { withHostedTtsRetry } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-retry'
import { InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { assertInlineMediaResponseFits } from '~/utils/http-payload'

// Deliberately slow narration for headroom. This is a heuristic, not a hard duration bound:
// delivery tags, text normalization and provider behavior can lengthen the actual result.
const SLOWEST_SPEECH_CHARACTERS_PER_SECOND = 8
// Word and phoneme timestamps returned alongside the audio.
const INLINE_TIMING_ENVELOPE_BYTES_PER_CHARACTER = 64

export const assertInlineSpeechResponsesFit = (
  providerLabel: string,
  stage: string,
  chunks: readonly string[],
  response: HostedTtsInlineAudioResponse
): void => {
  const speed = typeof response.speed === 'number' && response.speed > 0 ? response.speed : 1
  for (const [index, chunk] of chunks.entries()) {
    const seconds = chunk.length / SLOWEST_SPEECH_CHARACTERS_PER_SECOND / speed
    assertInlineMediaResponseFits(`${providerLabel} TTS chunk ${index + 1} of ${chunks.length}`, {
      mediaBytes: Math.ceil(seconds * response.audioBytesPerSecond),
      encoding: response.encoding,
      envelopeBytes: chunk.length * INLINE_TIMING_ENVELOPE_BYTES_PER_CHARACTER
    }, { stage })
  }
}

export const runHostedTtsChunkPipeline = async (
  options: HostedTtsChunkPipelineOptions
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const { chunkScheduler, chunks, outputDir, provider, providerLabel } = options
  const chunkPaths: string[] = []
  const progressInterval = Math.max(1, Math.ceil(chunks.length / 10))
  let completedChunkCount = 0
  let completed = false

  if (options.inlineAudioResponse) {
    assertInlineSpeechResponsesFit(providerLabel, `tts:${provider}`, chunks, options.inlineAudioResponse)
  }

  try {
    const orderedChunkPaths = await runTtsChunks(chunks, async (chunk, index, admission) => {
      const chunkIndex = index + 1
      const chunkPath = `${outputDir}/speech-${provider}-chunk-${String(chunkIndex).padStart(3, '0')}.${options.chunkExtension}`
      const fetchResult = await withHostedTtsRetry(
        {
          operationName: `${provider}-tts-chunk-${chunkIndex}`,
          abortSignal: options.abortSignal,
          timeoutMs: options.timeoutMs,
          policy: options.retryPolicy,
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
      const audioBytes = fetchResult instanceof Uint8Array ? fetchResult : fetchResult.audio
      const timingFactory = fetchResult instanceof Uint8Array ? undefined : fetchResult.timing

      if (audioBytes.byteLength === 0) {
        throw InfraError(`${providerLabel} TTS returned empty audio`, { stage: `tts:${provider}` })
      }

      await Bun.write(chunkPath, audioBytes)
      await options.requestEvidence?.recordOutput({ chunkIndex, path: chunkPath, ...(timingFactory ? { timingFactory } : {}) })
      await options.requestEvidence?.complete({ chunkIndex })
      completedChunkCount += 1
      if (
        completedChunkCount === 1
        || completedChunkCount === chunks.length
        || completedChunkCount % progressInterval === 0
      ) {
        l.write('info', `${providerLabel} TTS progress (${options.model}): ${completedChunkCount}/${chunks.length} chunks durably saved`, {
          category: 'pipeline',
          metadata: {
            provider,
            model: options.model,
            completedChunks: completedChunkCount,
            totalChunks: chunks.length
          }
        })
      }
      chunkPaths.push(chunkPath)
      return chunkPath
    }, {
      provider,
      scheduler: requireHostedTtsChunkScheduler(chunkScheduler),
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
        await rm(chunkPath, { force: true }).catch(() => {})
      }
    }
  }
}
