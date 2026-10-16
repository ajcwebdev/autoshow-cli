import { join } from 'node:path'
import type { AggregatedPriceEstimate, BatchChildRunContext, LLMOptions, LLMTarget, Step3Metadata, StepTimingCost, TranscriptionResult, VideoMetadata, WriteRuntimeOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { ensureDirectory } from '~/utils/cli-utils'
import { reserveBatchChildOutputDir } from '~/cli/commands/command-shared/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/command-shared/run-dir'
import { sanitizeTitleSlug } from '~/cli/commands/sources/download/download-audio/metadata-utils'
import { buildLLMModelOptions, resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'
import { collectLlmTargets, runLLM } from './run-llm'
import {
  buildTextInputPrompt,
  formatTextInputRenderedText,
  getTextInputTitle,
  readPromptFile,
  resolveTextInputSongTitle,
} from './text-input-utils'
import { buildProviderStepSummaries } from '~/cli/commands/command-shared/generation-command-utils'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { serializeOneOrMany } from '~/cli/commands/command-shared/target-runner'
import { createManifest, createPipelineItemFromRecord, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { logWriteManifestSummary } from '~/cli/commands/command-shared/write-manifest-log/write-manifest-log'
import { applySummaryArtifactNames, serializeStep3Results, writeWriteFlowArtifacts } from './write-artifact-finalization'
import { sha256Bytes } from '~/utils/value-helpers'
import { toLocalSourceRef, toProjectRelativePath } from '~/utils/project-root'
import { createProviderSettingsRecord, describeSettingsFile } from '~/cli/commands/command-shared/pipeline-manifest/provider-settings-record'

const buildTextInputMetadata = (inputPath: string): VideoMetadata => {
  const title = getTextInputTitle(inputPath)

  return {
    title,
    duration: 'Unknown',
    channel: 'Local',
    description: '',
    url: toLocalSourceRef(inputPath),
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

const withoutRequestSettings = ({ requestSettings: _requestSettings, ...entry }: Step3Metadata): Step3Metadata => entry

const buildWriteProviderRecords = async (
  step3Results: readonly Step3Metadata[],
  opts: WriteRuntimeOptions,
  requestedTargets: readonly LLMTarget[],
  failures: ReadonlyMap<string, unknown>
): Promise<{ requestedProviders: Array<Record<string, unknown>>, providerStates: Array<Record<string, unknown>> }> => {
  const promptFile = await describeSettingsFile(opts.promptFile)
  const promptFileKind = (await readPromptFile(opts.promptFile))?.kind
  const entries = requestedTargets.map((target) => {
    const identity = { service: target.service, model: target.model }
    const entry = step3Results.find(result => result.llmService === target.service && result.llmModel === target.model)
    const failure = failures.get(`${target.service}/${target.model}`)
    const failed = failures.has(`${target.service}/${target.model}`)
    const settings = createProviderSettingsRecord({
      service: target.service,
      operation: 'write',
      request: {
        ...(entry?.requestSettings ?? { model: target.model }),
        requestedReasoningEffort: entry?.requestedReasoningEffort ?? opts.reasoningEffort,
        effectiveReasoningEffort: entry?.effectiveReasoningEffort,
      },
      local: {
        prompts: opts.prompts,
        promptFile,
        promptFileKind,
        structuredMode: entry?.structuredMode,
        structuredPresetNames: entry?.structuredPresetNames,
      },
    })
    return {
      requested: { ...identity, settings },
      state: { ...identity, artifactDir: '.', status: entry ? 'succeeded' : failed ? 'failed' : 'missing', attempts: entry || failed ? 1 : 0, options: {}, metadata: {}, settings,
        ...(failed ? { error: { message: failure instanceof Error ? failure.message : String(failure) } } : {}) },
    }
  })
  return { requestedProviders: entries.map((entry) => entry.requested), providerStates: entries.map((entry) => entry.state) }
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

  const failures = new Map<string, unknown>()
  const llmOptions: LLMOptions = {
    outputDir,
    prompts: opts.prompts,
    promptFile: opts.promptFile,
    ...buildLLMModelOptions(llmConfig),
    llmProviderConcurrency: opts.llmProviderConcurrency,
    llmLocalConcurrency: opts.llmLocalConcurrency,
    reasoningEffort: opts.reasoningEffort,
    modelCostFilterExcludedTargetKeys: opts.modelCostFilterExcludedTargetKeys,
    structuredContext: {
      songLyricsTitle
    },
    onTargetFailure: (target, error) => { failures.set(`${target.service}/${target.model}`, error) },
    promptBuilder: (instruction: string) =>
      buildTextInputPrompt(sourceText, {
        title,
        sourcePath: inputPath,
        instruction
      })
  }
  const requestedTargets = collectLlmTargets(llmOptions)
  let providerFailure: unknown
  const step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () => {
    try { return await runLLM(metadata, transcriptionLike, llmOptions) }
    catch (error) {
      if (requestedTargets.length === 0 || failures.size !== requestedTargets.length) throw error
      providerFailure = error
      return []
    }
  })

  const step3Results = step3RunResults.map((result) => result.metadata)
  if (step3Results.length === 0 && providerFailure === undefined) {
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
  const providerRecords = await buildWriteProviderRecords(step3Results, opts, requestedTargets, failures)

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

  const sourceSnapshotPath = 'source.txt'
  await Bun.write(join(outputDir, sourceSnapshotPath), sourceText)
  const sourceSha256 = sha256Bytes(sourceText)

  const manifestMetadata = {
    title,
    source: {
      kind: 'text-input' as const,
      inputPath: toProjectRelativePath(inputPath),
      slug: sanitizeTitleSlug(title, 180),
      snapshot: {
        path: sourceSnapshotPath,
        sha256: sourceSha256,
      },
    },
    step3: serializeOneOrMany(step3Results.map(withoutRequestSettings)),
    ...providerRecords,
    cost,
    ...(timing ? { timing } : {}),
  }

  const completionStatus = step3Results.length === 0 ? 'failed' : failures.size > 0 ? 'incomplete' : 'full'
  await writeManifest(outputDir, createManifest('write', 'single', [
    createPipelineItemFromRecord(outputDir, manifestMetadata, { status: completionStatus })
  ]))
  if (providerFailure !== undefined) throw providerFailure
  logWriteManifestSummary(outputDir, manifestMetadata, {
    promptArtifact: 'prompt.md',
    ...(step3Results.length === 1 && typeof renderedArtifacts.internalArtifacts['rendered'] === 'string'
      ? { step3RenderedOutput: renderedArtifacts.internalArtifacts['rendered'] }
      : {})
  })

  const totalTimeMs = actualTiming.totalProcessingTimeMs
  const artifactFiles: Record<string, string> = {
    prompt: 'prompt.md',
    source: sourceSnapshotPath,
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
