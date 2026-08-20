import type { ProviderCompletionStatus, YoutubeCaptionCompletionContext } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { logManifestLocation } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { writePipelineItemRecords } from '../../../pipeline-manifest'
import { toRequestedProvider } from '../stt-batch/stt-run-state'
import { buildSingleStepSummaries, filterEstimatedSttCosts, resolveSttEstimatedCosts } from '../stt-costs'
import { buildPromptFile, buildProviderModelLabel } from '../stt-prompt'
import { formatSttTargetLabel } from '../stt-targets'
import { readStoredYoutubeCaptionSuccess, tryResolveYoutubeCaptionTranscription } from '../youtube-captions'
import { resolveRecordedSttStep2 } from './recorded-step2'


export const completeYoutubeCaptionStt = async ({
  sourceUrl,
  outputDir,
  requestedTargets,
  options,
  preflightEstimate,
  prepared,
  acquisitionTimeMs,
  processStart
}: YoutubeCaptionCompletionContext): Promise<string | undefined> => {
  if (!options.youtubeCaptions || !sourceUrl) {
    return undefined
  }

  const captionTranscription = await readStoredYoutubeCaptionSuccess(outputDir)
    ?? await tryResolveYoutubeCaptionTranscription(sourceUrl, outputDir, prepared.sourceVideoInfo)

  if (!captionTranscription) {
    return undefined
  }

  if (requestedTargets.length > 0) {
    l.write('info', 'STT Provider Skips', {
      category: 'pipeline',
      humanTable: createHumanTable(
        requestedTargets.map((target) => ({
          provider: formatSttTargetLabel(target),
          reason: 'youtube-captions'
        })),
        ['provider', 'reason']
      ),
      metadata: {
        reason: 'youtube-captions',
        skippedProviders: requestedTargets.map(formatSttTargetLabel)
      }
    })
  }

  await buildPromptFile(outputDir, prepared.metadata, captionTranscription.result, prepared.step1Metadata.slug, {
    prompts: options.prompts,
    promptMd: options.promptMd,
    promptSourceProvider: buildProviderModelLabel(captionTranscription.metadata)
  })

  const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, [captionTranscription.target], prepared.durationSeconds, prepared.step1Metadata.url))
  const observedEstimate = filterEstimatedSttCosts(resolveSttEstimatedCosts(undefined, [captionTranscription.target], prepared.durationSeconds, prepared.step1Metadata.url))
  const actual = computeActualCosts({
    step1: prepared.step1Metadata,
    step2: captionTranscription.metadata,
    audioDurationSeconds: prepared.durationSeconds
  })
  const cost = { estimated, observedEstimate, actual }
  const estimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: [{
      service: captionTranscription.target.service,
      model: captionTranscription.target.model
    }],
    audioDurationSeconds: prepared.durationSeconds
  })
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: prepared.durationSeconds,
    step2: captionTranscription.metadata
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const metadataJson = JSON.stringify({
    step1: prepared.step1Metadata,
    step2: captionTranscription.metadata,
    resolvedStep2: resolveRecordedSttStep2([captionTranscription.target], options),
    completionStatus: 'full' as ProviderCompletionStatus,
    requestedProviders: [toRequestedProvider(captionTranscription.target)],
    providerStates: [{
      service: captionTranscription.target.service,
      model: captionTranscription.target.model,
      local: captionTranscription.target.local,
      artifactDir: captionTranscription.relativeDir ?? '.',
      status: 'succeeded',
      attempts: 1,
      result: captionTranscription.result
    }],
    missingProviders: [],
    cost,
    ...(timing ? { timing } : {})
  }, null, 2)
  await writePipelineItemRecords(outputDir, 'extract', 'single', [JSON.parse(metadataJson)], { extractRoute: 'media' })
  logManifestLocation(outputDir, l, 'extract')
  l.debug(`Canonical manifest item metadata:\n${metadataJson}`, { category: 'artifact' })

  const artifactFiles: Record<string, string> = {
    audio: prepared.step1Metadata.audioFileName,
    transcript: 'transcription.txt',
    result: 'result.json',
    captions: 'youtube-captions.vtt',
    captionMetadata: 'youtube-captions.json',
    prompt: 'prompt.md',
    manifest: 'manifest.json'
  }

  l.report.complete(outputDir, artifactFiles, {
    steps: buildSingleStepSummaries(acquisitionTimeMs, captionTranscription.metadata, actual),
    totalTimeMs: Date.now() - processStart,
    totalCost: actual.totalCost
  })

  return outputDir
}
