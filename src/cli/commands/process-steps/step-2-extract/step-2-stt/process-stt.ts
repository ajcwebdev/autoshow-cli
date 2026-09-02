import { basename } from 'node:path'
import type { AggregatedPriceEstimate, ProcessSttRunOptions, SttExtractionOptions } from '~/types'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '../../batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { collectSttTargetsForSource, getSttTargetKey } from './stt-targets'
import { prepareSttMedia, resolveSttSourceMetadata } from './media'
import { createMistralSttPassController } from './stt-services/stt-mistral/mistral-stt-pass-controller'
import { logSttAcquireSummary } from './stt-logging'
import { logSpeakerCountHintSummary } from './stt-provider-pool'
import { completeYoutubeCaptionStt } from './process-stt/youtube-caption-completion'
import { completeSingleProviderStt } from './process-stt/single-provider-completion'
import { runMultiProviderSttBatch } from './process-stt/multi-provider-batch'

export const processStt = async (
  source: { url?: string, filePath?: string },
  baseDir: string,
  options: SttExtractionOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  runOptions: ProcessSttRunOptions = {}
): Promise<string> => {
  const processStart = Date.now()
  const requestedTargets = runOptions.requestedTargets ?? collectSttTargetsForSource(options, source)
  const mistralPassController = runOptions.mistralPassController
    ?? (requestedTargets.some((target) => target.service === 'mistral')
      ? createMistralSttPassController()
      : undefined)
  const targetsToRun = runOptions.targetsToRun ?? requestedTargets
  const targetsToRunKeys = new Set(targetsToRun.map((target) => getSttTargetKey(target)))
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : options.outputRootDir
  const metadata = await resolveSttSourceMetadata(source)
  const batchChildOutputDir = runOptions.outputDir === undefined
    ? await reserveBatchChildOutputDir(runOptions.batchChildContext, {
        title: metadata.title,
        publishedAt: metadata.publishDate,
        fallbackLabel: metadata.title
      })
    : undefined
  const outputDir = runOptions.outputDir ?? batchChildOutputDir ?? resolveRunDirectory(outputBaseDir, metadata.title, 'extract')
  await ensureDirectory(outputDir)

  let prepared: Awaited<ReturnType<typeof prepareSttMedia>> | undefined

  try {
    const acquisitionStartedAt = Date.now()
    prepared = await runWithLogContext({ step: 'step-1-download' }, async () =>
      await prepareSttMedia({
        source,
        targets: requestedTargets,
        outputDir
      })
    )
    const acquisitionTimeMs = Date.now() - acquisitionStartedAt
    logSttAcquireSummary( {
      item: prepared.step1Metadata.slug,
      sourceMedia: basename(prepared.outputArtifacts.sourceMediaPath),
      elapsedMs: acquisitionTimeMs,
      sourceMediaMs: prepared.timings.sourceMediaMs
    })
    logSpeakerCountHintSummary(requestedTargets, options.diarizationSpeakerCount)

    const youtubeCaptionOutputDir = await completeYoutubeCaptionStt({
      sourceUrl: source.url,
      outputDir,
      requestedTargets,
      options,
      preflightEstimate,
      prepared,
      acquisitionTimeMs,
      processStart
    })
    if (youtubeCaptionOutputDir) {
      return youtubeCaptionOutputDir
    }

    const singleProviderOutputDir = await completeSingleProviderStt({
      outputDir,
      requestedTargets,
      options,
      preflightEstimate,
      prepared,
      acquisitionTimeMs,
      processStart,
      mistralPassController
    })
    if (singleProviderOutputDir) {
      return singleProviderOutputDir
    }

    return await runMultiProviderSttBatch({
      outputDir,
      requestedTargets,
      targetsToRunKeys,
      options,
      preflightEstimate,
      prepared,
      acquisitionTimeMs,
      processStart,
      runOptions,
      mistralPassController
    })
  } finally {
    await prepared?.cleanup?.()
  }
}
