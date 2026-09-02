import type { SplitPolicyTarget, Step2Metadata, SttTarget, SttTargetOptions, TranscriptionResult } from '~/types'
import { dispatchStt } from './dispatch'
import { ensureSttTargetSetup } from '../bootstrap'
import { isSupadataSupportedSourceUrl } from '../stt-services/stt-supadata/supadata'
import { isScrapeCreatorsSupportedSourceUrl } from '../stt-services/scrapecreators/scrapecreators'
import { writeSttResultArtifact } from '../stt-utils/stt-result-artifacts'
import {
  DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from '../stt-split-policy'
import { createMistralSttPassController } from '../stt-services/stt-mistral/mistral-stt-pass-controller'
import { logSttSplitDecision } from '../stt-logging'
import { classifySttSplitLimitError } from './split-limits'
import { runAdaptiveSplitTranscription } from './split-execution'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { runHostedConcurrencyRequest } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
const persistTranscriptionStructuredArtifact = async (
  outputDir: string,
  result: TranscriptionResult
): Promise<void> => {
  await writeSttResultArtifact(outputDir, result)
}

const dispatchHostedStt = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  options: SttTargetOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const run = async () => await dispatchStt(target, audioPath, outputDir, 0, options)
  if (target.local || !options.hostedConcurrencyCoordinator) return await run()
  const result = await runHostedConcurrencyRequest({
    coordinator: options.hostedConcurrencyCoordinator,
    admission: {
      provider: target.service,
      workClass: 'provider-target',
      configuredLimit: options.sttProviderConcurrency ?? DEFAULT_CLI_CONCURRENCY,
      workId: `${target.service}:${target.model}:${outputDir}`,
      unitIndex: 0,
      context: { model: target.model }
    }
  }, async () => await run())
  return {
    ...result,
    metadata: {
      ...result.metadata,
      hostedConcurrency: options.hostedConcurrencyCoordinator.snapshot()
    }
  }
}

const logAutoSplitDecision = (
  target: SplitPolicyTarget,
  audioPath: string,
  splitDecision: ReturnType<typeof resolveTranscriptionSplitDecision>
): void => {
  const autoReason = splitDecision.reasons.find((reason) => reason.kind !== 'explicit')
  if (!autoReason) {
    return
  }

  logSttSplitDecision( target, splitDecision, {
    trigger: 'auto',
    audioPath
  })
}

export const sttTarget = async (
  audioPath: string,
  outputDir: string,
  target: SttTarget,
  options: SttTargetOptions
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  if (target.service === 'supadata' && !isSupadataSupportedSourceUrl(options.sourceUrl)) {
    return await dispatchHostedStt(target, audioPath, outputDir, options)
  }

  if (target.service === 'scrapecreators' && !isScrapeCreatorsSupportedSourceUrl(options.sourceUrl)) {
    return await dispatchHostedStt(target, audioPath, outputDir, options)
  }

  await ensureSttTargetSetup(target)
  const effectiveOptions = target.service === 'mistral' && options.mistralPassController === undefined
    ? {
        ...options,
        mistralPassController: createMistralSttPassController()
      }
    : options

  if (target.service === 'supadata') {
    const transcription = await dispatchHostedStt(target, audioPath, outputDir, effectiveOptions)
    await persistTranscriptionStructuredArtifact(outputDir, transcription.result)
    return transcription
  }

  if (target.service === 'scrapecreators') {
    const transcription = await dispatchHostedStt(target, audioPath, outputDir, effectiveOptions)
    await persistTranscriptionStructuredArtifact(outputDir, transcription.result)
    return transcription
  }

  const audioFileSize = Bun.file(audioPath).size
  const splitDecision = resolveTranscriptionSplitDecision(target, {
    audioFileSizeBytes: audioFileSize,
    audioDurationSeconds: effectiveOptions.audioDurationSeconds,
    splitRequested: effectiveOptions.split === true
  })
  if (splitDecision.shouldSplit) {
    if (effectiveOptions.split !== true) {
      logAutoSplitDecision(target, audioPath, splitDecision)
    }
    return await runAdaptiveSplitTranscription(
      target,
      audioPath,
      outputDir,
      effectiveOptions,
      splitDecision.segmentDurationMinutes,
      audioFileSize
    )
  }

  try {
    const transcription = await dispatchHostedStt(target, audioPath, outputDir, effectiveOptions)
    await persistTranscriptionStructuredArtifact(outputDir, transcription.result)
    return transcription
  } catch (error) {
    const splitLimitClassification = classifySttSplitLimitError(target, error)
    if (splitLimitClassification !== undefined) {
      const splitSegmentDurationMinutes = resolveEffectiveSplitSegmentDurationMinutes(resolveSttSplitPolicy(target), DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES, {
        audioFileSizeBytes: audioFileSize,
        audioDurationSeconds: effectiveOptions.audioDurationSeconds
      })

      return await runAdaptiveSplitTranscription(
        target,
        audioPath,
        outputDir,
        effectiveOptions,
        splitSegmentDurationMinutes,
        audioFileSize,
        splitLimitClassification
      )
    }

    throw error
  }
}
