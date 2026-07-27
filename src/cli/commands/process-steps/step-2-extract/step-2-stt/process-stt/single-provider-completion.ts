import type { ProviderCompletionStatus, SttSingleProviderCompletionContext, SttTarget } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { logRunManifestLocation } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { writeSttRunManifest } from '../stt-manifest'
import { sttTarget } from '../run-stt'
import { toRequestedProvider } from '../stt-batch/stt-run-state'
import { buildSingleStepSummaries, filterEstimatedSttCosts, resolveSttEstimatedCosts } from '../stt-costs'
import { buildPromptFile, buildProviderModelLabel } from '../stt-prompt'
import { resolveRecordedSttStep2, resolveTargetAudioPath } from './recorded-step2'


export const completeSingleProviderStt = async ({
  outputDir,
  requestedTargets,
  options,
  preflightEstimate,
  prepared,
  acquisitionTimeMs,
  processStart,
  mistralPassController
}: SttSingleProviderCompletionContext): Promise<string | undefined> => {
  if (
    requestedTargets.length !== 1
    || requestedTargets[0]?.service === 'supadata'
    || requestedTargets[0]?.service === 'scrapecreators'
  ) {
    return undefined
  }

  const target = requestedTargets[0] as SttTarget
  const audioPath = resolveTargetAudioPath(target, prepared)
  const audioDurationSeconds = prepared.durationSeconds
  const transcription = await runWithLogContext({ step: 'step-2-stt' }, async () =>
    await sttTarget(audioPath, outputDir, target, {
      split: options.split,
      reverbVerbatimicity: options.reverbVerbatimicity,
      sttSegmentConcurrency: options.sttSegmentConcurrency,
      audioDurationSeconds,
      sourceUrl: prepared.step1Metadata.url,
      language: target.service === 'scrapecreators' ? options.scrapecreatorsLang : options.supadataLang,
      happyscribeOrganizationId: options.happyscribeOrganizationId,
      ...(mistralPassController ? { mistralPassController } : {})
    })
  )

  await buildPromptFile(outputDir, prepared.metadata, transcription.result, prepared.step1Metadata.slug, {
    prompts: options.prompts,
    promptMd: options.promptMd,
    promptSourceProvider: buildProviderModelLabel(transcription.metadata),
    requestedSpeakerCount: target.diarizationOptions?.speakerCount
  })

  const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, requestedTargets, prepared.durationSeconds, prepared.step1Metadata.url))
  const observedEstimate = filterEstimatedSttCosts(resolveSttEstimatedCosts(undefined, requestedTargets, prepared.durationSeconds, prepared.step1Metadata.url))
  const actual = computeActualCosts({
    step1: prepared.step1Metadata,
    step2: transcription.metadata,
    audioDurationSeconds: prepared.durationSeconds
  })
  const cost = { estimated, observedEstimate, actual }
  const estimatedTiming = computeEstimatedProcessingTimes({
    sttTargets: requestedTargets.map((entry) => ({ service: entry.service, model: entry.model })),
    audioDurationSeconds: prepared.durationSeconds
  })
  const actualTiming = computeActualProcessingTimes({
    audioDurationSeconds: prepared.durationSeconds,
    step2: transcription.metadata
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const metadataJson = JSON.stringify({
    step1: prepared.step1Metadata,
    step2: transcription.metadata,
    resolvedStep2: resolveRecordedSttStep2(requestedTargets, options),
    completionStatus: 'full' as ProviderCompletionStatus,
    requestedProviders: requestedTargets.map(toRequestedProvider),
    providerStates: [{
      service: target.service,
      model: target.model,
      local: target.local,
      artifactDir: '.',
      status: 'succeeded',
      attempts: 1
    }],
    missingProviders: [],
    cost,
    ...(timing ? { timing } : {})
  }, null, 2)
  await writeSttRunManifest(outputDir, JSON.parse(metadataJson) as Record<string, unknown>)
  logRunManifestLocation(outputDir, l, 'extract')
  l.debug(`Run manifest:\n${metadataJson}`)

  const artifactFiles: Record<string, string> = {
    audio: prepared.step1Metadata.audioFileName,
    transcript: 'transcription.txt',
    result: 'result.json',
    prompt: 'prompt.md',
    run: 'run.json'
  }

  l.report.complete(outputDir, artifactFiles, {
    steps: buildSingleStepSummaries(acquisitionTimeMs, transcription.metadata, actual),
    totalTimeMs: Date.now() - processStart,
    totalCost: actual.totalCost
  })

  return outputDir
}
