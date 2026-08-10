import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { sttTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/orchestrator'
import { selectPrimaryPromptProvider } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-prompt'
import { classifySttProviderFailure } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-failures'
import { prioritizeCloudSttTargetIndices } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-pool'
import { getSttTargetDirectoryName } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { writeSttResultArtifact } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-result-artifacts'
import { formatTranscriptText } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { tryResolveYoutubeCaptionTranscription } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import type { ResolveWriteTranscriptionContext, ResolveWriteTranscriptionResult, SttProviderSuccess, SttTarget, WriteSttFailure, WriteTranscriptionBundle } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { InfraError, InternalError } from '~/utils/error-handler'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'

export const resolveWriteTranscription = async (
  ctx: ResolveWriteTranscriptionContext
): Promise<ResolveWriteTranscriptionResult> => {
  const { processingOptions, outputDir, sttTargets, audioPath, preparedMedia, runtimeOptions, mistralPassController } = ctx

  let transcriptionResult: WriteTranscriptionBundle | undefined
  let successfulSttProviders: SttProviderSuccess[] = []
  let sttFailures: WriteSttFailure[] = []

  if (processingOptions.youtubeCaptions && processingOptions.url) {
    const captionTranscription = await tryResolveYoutubeCaptionTranscription(
      processingOptions.url,
      outputDir,
      preparedMedia.sourceVideoInfo
    )

    if (captionTranscription) {
      if (sttTargets.length > 0) {
        l.write('info', 'STT Provider Skips', {
          category: 'pipeline',
          humanTable: createHumanTable(
            sttTargets.map((target) => ({
              provider: `${target.service}/${target.model}`,
              reason: 'youtube-captions'
            })),
            ['provider', 'reason']
          ),
          metadata: {
            reason: 'youtube-captions',
            skippedProviders: sttTargets.map((target) => `${target.service}/${target.model}`)
          }
        })
      }

      transcriptionResult = {
        result: captionTranscription.result,
        metadata: captionTranscription.metadata
      }
      successfulSttProviders = [captionTranscription]
    }
  }

  if (
    successfulSttProviders.length === 0
    && sttTargets.length === 1
    && sttTargets[0]?.service !== 'supadata'
    && sttTargets[0]?.service !== 'scrapecreators'
  ) {
    const target = sttTargets[0] as SttTarget
    const audioDurationSeconds = preparedMedia.durationSeconds
    const singleTranscription = await runWithLogContext({ step: 'step-2-stt' }, async () =>
      await sttTarget(audioPath, outputDir, target, {
        split: processingOptions.split,
        reverbVerbatimicity: processingOptions.reverbVerbatimicity,
        sttSegmentConcurrency: runtimeOptions?.sttSegmentConcurrency,
        audioDurationSeconds,
        sourceUrl: preparedMedia.step1Metadata.url,
        language: target.service === 'scrapecreators' ? processingOptions.scrapecreatorsLang : processingOptions.supadataLang,
        ...(mistralPassController ? { mistralPassController } : {})
      })
    )
    transcriptionResult = singleTranscription
    successfulSttProviders = [{
      target,
      metadata: singleTranscription.metadata,
      result: singleTranscription.result
    }]
  } else if (successfulSttProviders.length === 0) {
    const providersDir = `${outputDir}/providers`
    const audioDurationSeconds = preparedMedia.durationSeconds
    await mkdir(providersDir, { recursive: true })

    const successes: Array<SttProviderSuccess | undefined> = new Array(sttTargets.length)
    const failuresByIndex = new Map<number, WriteSttFailure>()

    const runTargetAtIndex = async (index: number): Promise<void> => {
      const target = sttTargets[index] as SttTarget
      const providerDirName = getSttTargetDirectoryName(target)
      const providerDir = `${providersDir}/${providerDirName}`
      await mkdir(providerDir, { recursive: true })

      try {
        const providerTranscription = await runWithLogContext({ step: 'step-2-stt', provider: providerDirName }, async () =>
          await sttTarget(audioPath, providerDir, target, {
            split: processingOptions.split,
            reverbVerbatimicity: processingOptions.reverbVerbatimicity,
            sttSegmentConcurrency: runtimeOptions?.sttSegmentConcurrency,
            audioDurationSeconds,
            sourceUrl: preparedMedia.step1Metadata.url,
            language: target.service === 'scrapecreators' ? processingOptions.scrapecreatorsLang : processingOptions.supadataLang,
            ...(mistralPassController ? { mistralPassController } : {})
          })
        )
        successes[index] = {
          target,
          metadata: providerTranscription.metadata,
          result: providerTranscription.result,
          relativeDir: `providers/${providerDirName}`
        }
        failuresByIndex.delete(index)
      } catch (error) {
        const failure = {
          service: target.service,
          model: target.model,
          ...classifySttProviderFailure(error)
        }

        if (failure.skipped === true) {
          await Bun.write(join(providerDir, 'error.json'), JSON.stringify({
            service: failure.service,
            model: failure.model,
            message: failure.message,
            skipped: true,
            ...(failure.stage ? { stage: failure.stage } : {}),
            ...(typeof failure.status === 'number' ? { status: failure.status } : {})
          }, null, 2))
        } else {
          await rm(providerDir, { recursive: true, force: true })
        }

        failuresByIndex.set(index, failure)
      }
    }

    const localIndices = sttTargets
      .map((target, index) => ({ target, index }))
      .filter((entry) => entry.target.local)
      .map((entry) => entry.index)
    const cloudIndices = prioritizeCloudSttTargetIndices(sttTargets)

    await Promise.all([
      mapWithConcurrency(runtimeOptions?.sttLocalConcurrency ?? DEFAULT_CLI_CONCURRENCY, localIndices, runTargetAtIndex),
      mapWithConcurrency(runtimeOptions?.sttProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY, cloudIndices, runTargetAtIndex)
    ])

    successfulSttProviders = successes.filter((entry): entry is SttProviderSuccess => entry !== undefined)
    sttFailures = [...failuresByIndex.values()]

    if (successfulSttProviders.length === 0) {
      await rm(providersDir, { recursive: true, force: true })
      throw InfraError(sttFailures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; '), { stage: 'write:video' })
    }

    const promptSource = selectPrimaryPromptProvider(successes)
    if (!promptSource) {
      throw InternalError('No successful transcription provider available for the write pipeline', { stage: 'write:video' })
    }

    await Bun.write(`${outputDir}/transcription.txt`, formatTranscriptText(promptSource.result.segments))
    await writeSttResultArtifact(outputDir, promptSource.result)
    transcriptionResult = {
      result: promptSource.result,
      metadata: successfulSttProviders.map((entry) => entry.metadata)
    }
  }

  return { transcriptionResult, successfulSttProviders, sttFailures }
}
