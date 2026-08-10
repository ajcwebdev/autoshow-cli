import { createManifest, createPipelineItemFromRecord, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { extractSourceMetadata } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { prepareSttMedia } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/media'
import {
  buildProviderModelLabel,
  selectPrimaryPromptProvider
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-prompt'
import { logSpeakerCountHintSummary } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-provider-pool'
import { createMistralSttPassController } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/mistral-stt-pass-controller'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { formatTranscriptText } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { runGenerationStagesForSingleWrite } from '~/cli/commands/process-steps/step-3-write/generation-stage-runner'
import { runLLM } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { writeShowNoteArtifacts } from '~/cli/commands/process-steps/step-3-write/show-note-artifacts'
import { writeRenderedTextArtifacts } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { buildPrompt } from '~/cli/commands/process-steps/step-3-write/write-utils/prompt-utils'
import { serializeOneOrMany } from '~/cli/commands/process-steps/target-runner'
import { logWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import type { AggregatedPriceEstimate, ProcessVideoRuntimeOptions, ProcessingOptions, Step1Metadata, Step3Metadata, StructuredRunResult, VideoMetadata } from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { InternalError } from '~/utils/error-handler'
import { logLocationsTable } from '~/utils/app-logger/human-table/human-table'
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
  const outputDir = runtimeOptions?.outputDir ?? resolveRunDirectory(baseDir, metadata.title, 'write')
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
      throw InternalError('No transcription result was produced for the write pipeline', { stage: 'write:video' })
    }
    const finalizedTranscriptionResult = transcriptionResult
    const promptSource = selectPrimaryPromptProvider(successfulSttProviders)
    const promptOptions = promptSource
      ? {
          promptSourceProvider: buildProviderModelLabel(promptSource.metadata),
          requestedSpeakerCount: promptSource.target.diarizationOptions?.speakerCount
        }
      : undefined

    let step3RunResults: StructuredRunResult[] = []
    let step3Results: Step3Metadata[] = []
    if (processingOptions.skipLLM) {
      await runWithLogContext({ step: 'step-3-write' }, async () => {
        const promptPath = `${outputDir}/prompt.md`
        const instruction = await resolvePromptNames(processingOptions.prompts ?? [], {
          exampleFormat: 'json'
        })
        const promptContent = buildPrompt(
          sourceMetadata,
          finalizedTranscriptionResult.result,
          instruction,
          step1Metadata.slug,
          promptOptions
        )
        await Bun.write(promptPath, promptContent)
      })
    } else {
      step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () =>
        await runLLM(sourceMetadata, finalizedTranscriptionResult.result, {
          ...processingOptions,
          promptBuilder: (instruction: string) =>
            buildPrompt(
              sourceMetadata,
              finalizedTranscriptionResult.result,
              instruction,
              step1Metadata.slug,
              promptOptions
            )
        }, step1Metadata.slug)
      )
      step3Results = step3RunResults.map((result) => result.metadata)
    }

    const renderedArtifacts = step3RunResults.length > 0
      ? await writeRenderedTextArtifacts({
          outputDir,
          results: step3RunResults,
          writeInternal: processingOptions.renderedText === true,
          sourcePath: options.filePath,
          trackListPath: processingOptions.trackList,
          externalDir: processingOptions.renderedOutDir,
          externalBaseName: step1Metadata.slug
        })
      : { internalArtifacts: {}, externalFiles: [] as string[] }

    if (renderedArtifacts.externalFiles.length > 0) {
      logLocationsTable(l, [{
        artifact: 'renderedOutDir',
        path: processingOptions.renderedOutDir,
        detail: `${renderedArtifacts.externalFiles.length} file${renderedArtifacts.externalFiles.length === 1 ? '' : 's'}`
      }])
    }

    const generationResult = await runGenerationStagesForSingleWrite({
      step3Results,
      step3RunResults,
      outputDir,
      generationOptions: processingOptions
    })
    const {
      step4Metadata,
      step5Metadata,
      step6Metadata,
      step7Metadata,
      ttsCharacterCount,
      ttsInputText,
      attemptedTtsTargets,
      attemptedImageTargets,
      attemptedVideoTargets,
      attemptedMusicTargets
    } = generationResult

    const showNoteSourceText = formatTranscriptText(finalizedTranscriptionResult.result.segments, { precision: 'seconds' }) || finalizedTranscriptionResult.result.text
    const showNoteArtifacts = step3RunResults.length > 0
      ? await writeShowNoteArtifacts({
          outputDir,
          results: step3RunResults,
          sourceText: showNoteSourceText,
          step4Metadata,
          step5Metadata,
          step6Metadata,
          step7Metadata
        })
      : { internalArtifacts: {} }

    const step3Serialized = step3Results.length === 1
      ? step3Results[0]
      : step3Results.length > 1
        ? step3Results
        : undefined

    const { cost, timing } = await computeWriteCostAndTiming({
      processingOptions,
      preflightEstimate,
      step1Metadata,
      transcriptionResult: finalizedTranscriptionResult,
      mediaDurationSeconds,
      step3Results,
      step3Serialized,
      ttsCharacterCount,
      ttsInputText,
      attemptedTtsTargets,
      attemptedImageTargets,
      attemptedVideoTargets,
      attemptedMusicTargets,
      step4Metadata,
      step5Metadata,
      step6Metadata,
      step7Metadata
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
      ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
      ...(step4Metadata ? { step4: serializeOneOrMany(step4Metadata) } : {}),
      ...(step5Metadata ? { step5: serializeOneOrMany(step5Metadata) } : {}),
      ...(step6Metadata ? { step6: serializeOneOrMany(step6Metadata) } : {}),
      ...(step7Metadata ? { step7: serializeOneOrMany(step7Metadata) } : {}),
      cost,
      ...(timing ? { timing } : {}),
      ...(sttFailures.length > 0 ? { errors: sttFailures } : {}),
    }
    await writeManifest(outputDir, createManifest('write', 'single', [
      createPipelineItemFromRecord(outputDir, processingMetadata, { status: completionStatus })
    ]))
    logWriteManifestConsoleSummary(outputDir, processingMetadata, {
      promptArtifact: 'prompt.md',
      ...(step3Results.length === 1 && typeof renderedArtifacts.internalArtifacts['rendered'] === 'string'
        ? { step3RenderedOutput: renderedArtifacts.internalArtifacts['rendered'] }
        : {})
    })

    const totalTime = Date.now() - processStart

    const stepSummaries = buildWriteStepSummaries({
      processingOptions,
      step1Time,
      step2Entries,
      step3Results,
      step4Metadata,
      step5Metadata,
      step6Metadata,
      step7Metadata,
      actualSteps: cost.actual.steps
    })

    const artifactFiles = buildWriteArtifactFiles({
      step1Metadata,
      renderedInternalArtifacts: renderedArtifacts.internalArtifacts,
      showNoteInternalArtifacts: showNoteArtifacts.internalArtifacts,
      step2Entries,
      successfulSttProviders,
      step3Results,
      step4Metadata,
      step5Metadata,
      step6Metadata,
      step7Metadata
    })

    l.report.complete(outputDir, artifactFiles, { steps: stepSummaries, totalTimeMs: totalTime, totalCost: cost.actual.totalCost })

    if (sttFailures.length > 0) {
      l.warn(`write run completed with partial STT failures/skips: ${sttFailures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`)
    }

    return outputDir
  } finally {
    await preparedSttMedia?.cleanup?.()
  }
}
