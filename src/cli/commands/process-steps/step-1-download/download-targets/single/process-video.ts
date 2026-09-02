import { createManifest, createPipelineItemFromRecord, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { extractSourceMetadata } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { prepareSttMedia } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/media'
import {
  buildPromptFile,
  buildProviderModelLabel,
  selectPrimaryPromptProvider
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-prompt'
import { logSpeakerCountHintSummary } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-pool'
import { createMistralSttPassController } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/mistral-stt-pass-controller'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { serializeOneOrMany } from '~/cli/commands/process-steps/target-runner'
import { logWriteManifestSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import type { AggregatedPriceEstimate, ProcessVideoRuntimeOptions, ProcessingOptions, Step1Metadata, VideoMetadata } from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { InternalError } from '~/utils/error-handler'
import { resolveWriteTranscription } from './write-transcription'
import { computeWriteCostAndTiming } from './write-cost-timing'
import { buildWriteSttProviderStates } from './write-provider-states'
import { buildWriteStepSummaries } from './write-step-summaries'
import { buildWriteArtifactFiles } from './write-artifact-files'


export const processVideo = async (
  options: ProcessingOptions,
  precomputedMetadata?: VideoMetadata,
  preflightEstimate?: AggregatedPriceEstimate,
  runtimeOptions?: ProcessVideoRuntimeOptions
): Promise<string> => {
  const processStart = Date.now()
  const metadata = precomputedMetadata ?? await extractSourceMetadata({
    ...(options.url !== undefined ? { url: options.url } : {}),
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {})
  })
  const baseDir = options.outputDir && options.outputDir.trim().length > 0
    ? options.outputDir
    : runtimeOptions?.outputRootDir ?? getOutputRoot()
  const outputDir = runtimeOptions?.outputDir ?? resolveRunDirectory(baseDir, metadata.title, 'extract')
  await ensureDirectory(outputDir)
  const processingOptions: ProcessingOptions = {
    ...options,
    outputDir
  }
  const sttTargets = collectSttTargets(processingOptions)
  const mistralPassController = sttTargets.some((target) => target.service === 'mistral')
    ? createMistralSttPassController()
    : undefined
  let preparedSttMedia: Awaited<ReturnType<typeof prepareSttMedia>> | undefined

  try {
    const step1Start = Date.now()
    preparedSttMedia = await runWithLogContext({ step: 'step-1-download' }, async () =>
      await prepareSttMedia({
        source: {
          ...(options.url !== undefined ? { url: options.url } : {}),
          ...(options.filePath !== undefined ? { filePath: options.filePath } : {})
        },
        targets: sttTargets,
        outputDir
      })
    )
    const preparedMedia = preparedSttMedia
    const step1Time = Date.now() - step1Start
    const step1Metadata: Step1Metadata = preparedMedia.step1Metadata
    const sourceMetadata = preparedMedia.metadata
    const audioPath = preparedMedia.executionArtifacts.sourceMediaPath
    const mediaDurationSeconds = preparedMedia.durationSeconds
    logSpeakerCountHintSummary(sttTargets, processingOptions.diarizationSpeakerCount)

    const { transcriptionResult, successfulSttProviders, sttFailures } = await resolveWriteTranscription({
      processingOptions,
      outputDir,
      sttTargets,
      audioPath,
      preparedMedia,
      runtimeOptions,
      mistralPassController
    })

    if (!transcriptionResult) {
      throw InternalError('No transcription result was produced for the extract pipeline', { stage: 'extract:video' })
    }
    const finalizedTranscriptionResult = transcriptionResult
    const promptSource = selectPrimaryPromptProvider(successfulSttProviders)
    const promptOptions = promptSource
      ? {
          promptSourceProvider: buildProviderModelLabel(promptSource.metadata),
          requestedSpeakerCount: promptSource.target.diarizationOptions?.speakerCount
        }
      : undefined

    await buildPromptFile(
      outputDir,
      sourceMetadata,
      finalizedTranscriptionResult.result,
      step1Metadata.slug,
      {
        prompts: [],
        promptMd: false,
        ...promptOptions
      }
    )

    const { cost, timing } = await computeWriteCostAndTiming({
      processingOptions,
      preflightEstimate,
      step1Metadata,
      transcriptionResult: finalizedTranscriptionResult,
      mediaDurationSeconds
    })

    const step2Entries = Array.isArray(finalizedTranscriptionResult.metadata)
      ? finalizedTranscriptionResult.metadata
      : [finalizedTranscriptionResult.metadata]

    const { completionStatus, requestedProviders, providerStates, missingProviders } = buildWriteSttProviderStates({
      sttTargets,
      successfulSttProviders,
      sttFailures
    })

    const processingMetadata = {
      step1: step1Metadata,
      step2: serializeOneOrMany(step2Entries),
      completionStatus,
      requestedProviders,
      providerStates,
      missingProviders,
      cost,
      ...(timing ? { timing } : {}),
      ...(sttFailures.length > 0 ? { errors: sttFailures } : {}),
    }
    await writeManifest(outputDir, createManifest('extract', 'single', [
      createPipelineItemFromRecord(outputDir, processingMetadata, { status: completionStatus })
    ]))
    logWriteManifestSummary(outputDir, processingMetadata, {
      promptArtifact: 'prompt.md'
    })

    const totalTime = Date.now() - processStart

    const stepSummaries = buildWriteStepSummaries({
      processingOptions,
      step1Time,
      step2Entries,
      step3Results: [],
      actualSteps: cost.actual.steps
    })

    const artifactFiles = buildWriteArtifactFiles({
      step1Metadata,
      renderedInternalArtifacts: {},
      showNoteInternalArtifacts: {},
      step2Entries,
      successfulSttProviders,
      step3Results: []
    })

    l.report.complete(outputDir, artifactFiles, { steps: stepSummaries, totalTimeMs: totalTime, totalCost: cost.actual.totalCost })

    if (sttFailures.length > 0) {
      l.warn(`extract run completed with partial STT failures/skips: ${sttFailures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`, {
        category: 'pipeline',
        metadata: {
          failureCount: sttFailures.length,
          failures: sttFailures.map((failure) => ({ service: failure.service, model: failure.model, message: failure.message }))
        }
      })
    }

    return outputDir
  } finally {
    await preparedSttMedia?.cleanup?.()
  }
}
