import { resolve } from 'node:path'
import type { AggregatedPriceEstimate, BatchChildRunContext, Step3Metadata, StepTimingCost, TranscriptionResult, VideoMetadata, WriteRuntimeOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { buildLLMModelOptions, resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { runLLM } from './run-llm'
import {
  buildTextInputPrompt,
  formatTextInputRenderedText,
  getTextInputTitle,
  resolveTextInputSongTitle,
} from './text-input-utils'
import { buildProviderStepSummaries } from '~/cli/commands/process-steps/generation-command-utils'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { serializeOneOrMany } from '~/cli/commands/process-steps/target-runner'
import { createManifest, createPipelineItemFromRecord, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { logWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { applySummaryArtifactNames, serializeStep3Results, writeWriteFlowArtifacts } from './write-artifact-finalization'

const buildTextInputMetadata = (inputPath: string): VideoMetadata => {
  const title = getTextInputTitle(inputPath)

  return {
    title,
    duration: 'Unknown',
    channel: 'Local',
    description: '',
    url: Bun.pathToFileURL(resolve(inputPath)).toString(),
  }
}

const buildTextTranscription = (text: string): TranscriptionResult => ({
  text,
  segments: [{
    start: '00:00:00',
    end: '00:00:00',
    text
  }]
})

const buildStepSummaries = (
  step3Results: Step3Metadata[],
  actualCosts: ReturnType<typeof computeActualCosts>['steps']
): StepTimingCost[] => {
  const summaries: StepTimingCost[] = []

  summaries.push(...buildProviderStepSummaries(
    'LLM',
    'llm',
    step3Results,
    actualCosts,
    (entry) => `${entry.llmService}/${entry.llmModel}`,
    (entry) => entry.processingTime
  ))

  return summaries
}

export const runTextWrite = async (
  inputPath: string,
  baseDir: string,
  opts: WriteRuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const sourceText = await Bun.file(inputPath).text()
  if (sourceText.trim().length === 0) {
    throw ValidationError(`Text input is empty: ${inputPath}`, { stage: 'write:text' })
  }

  const title = getTextInputTitle(inputPath)
  const songLyricsTitle = await resolveTextInputSongTitle(inputPath, opts.trackList)
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title,
    fallbackLabel: title
  }) ?? resolveRunDirectory(outputBaseDir, title, 'write-text')
  await ensureDirectory(outputDir)

  const llmConfig = resolveLLMDefaults(opts)
  const metadata = buildTextInputMetadata(inputPath)
  const transcriptionLike = buildTextTranscription(sourceText)

  const step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () =>
    await runLLM(metadata, transcriptionLike, {
      outputDir,
      prompts: opts.prompts,
      promptFile: opts.promptFile,
      ...buildLLMModelOptions(llmConfig),
      llmProviderConcurrency: opts.llmProviderConcurrency,
      llmLocalConcurrency: opts.llmLocalConcurrency,
      modelCostFilterExcludedTargetKeys: opts.modelCostFilterExcludedTargetKeys,
      structuredContext: {
        songLyricsTitle
      },
      promptBuilder: (instruction: string) =>
        buildTextInputPrompt(sourceText, {
          title,
          sourcePath: inputPath,
          instruction
        })
    })
  )

  const step3Results = step3RunResults.map((result) => result.metadata)
  if (step3Results.length === 0) {
    throw InfraError('No LLM outputs generated for text input write', { stage: 'write:text' })
  }

  const showNoteRunResults = await Promise.all(step3RunResults.map(async (result) => ({
    ...result,
    renderedText: await formatTextInputRenderedText({
      content: result.renderedText,
      sourcePath: inputPath,
      trackListPath: opts.trackList,
      metadata: result.metadata
    })
  })))

  const { renderedArtifacts, showNoteArtifacts } = await writeWriteFlowArtifacts({
    outputDir,
    results: step3RunResults,
    showNoteResults: showNoteRunResults,
    sourceText,
    sourcePath: inputPath,
    externalBaseName: title,
    opts
  })

  const step3Serialized = serializeStep3Results(step3Results)

  const llmTargets = step3Results.map((item) => ({
    service: item.llmService,
    model: item.llmModel,
    inputTokens: item.inputTokenCount,
    outputTokens: item.outputTokenCount
  }))

  const priceEstimate = preflightEstimate ?? await buildAggregatedPriceEstimate('write', inputPath, opts)
  const estimated = preflightToEstimated(priceEstimate)

  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    llmTargets
  })

  const actual = computeActualCosts({
    step3: step3Serialized
  })

  const cost = { estimated, observedEstimate, actual }
  const fallbackEstimatedTiming = computeEstimatedProcessingTimes({
    llmTargets
  })
  const estimatedTiming = priceEstimate.timing ?? fallbackEstimatedTiming
  const actualTiming = computeActualProcessingTimes({
    step3: step3Serialized
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const manifestMetadata = {
    title,
    source: {
      kind: 'text-input',
      inputPath,
      slug: sanitizeTitleSlug(title, 180)
    },
    step3: serializeOneOrMany(step3Results),
    cost,
    ...(timing ? { timing } : {}),
  }

  await writeManifest(outputDir, createManifest('write', 'single', [
    createPipelineItemFromRecord(outputDir, manifestMetadata, { status: 'full' })
  ]))
  logWriteManifestConsoleSummary(outputDir, manifestMetadata, {
    promptArtifact: 'prompt.md',
    ...(step3Results.length === 1 && typeof renderedArtifacts.internalArtifacts['rendered'] === 'string'
      ? { step3RenderedOutput: renderedArtifacts.internalArtifacts['rendered'] }
      : {})
  })

  const totalTimeMs = actualTiming.totalProcessingTimeMs
  const artifactFiles: Record<string, string> = {
    prompt: 'prompt.md',
    manifest: PIPELINE_MANIFEST_FILE,
    ...renderedArtifacts.internalArtifacts,
    ...showNoteArtifacts.internalArtifacts
  }

  applySummaryArtifactNames(artifactFiles, step3Results)

  l.report.complete(outputDir, artifactFiles, {
    steps: buildStepSummaries(step3Results, actual.steps),
    totalTimeMs,
    totalCost: actual.totalCost
  })

  return { outputDir }
}
