import { stat } from 'node:fs/promises'
import { join, resolve as pathResolve } from 'node:path'
import { createManifest, createPipelineItemFromRecord, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { downloadDocument } from '~/cli/commands/process-steps/step-1-download/document/dl-document'
import { buildOcrCostDiagnostics, collectEstimatedExtractTargets, resolveDocumentWriteEstimatedCosts, resolveDocumentWriteObservedEstimateCosts } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-costs'
import { buildDocumentPrompt } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/doc-prompt-utils'
import { processOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { runLLM } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { writeShowNoteArtifacts } from '~/cli/commands/process-steps/step-3-write/show-note-artifacts'
import { writeRenderedTextArtifacts } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { logWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import type { AggregatedPriceEstimate, BatchChildRunContext, DocumentExtractionOptions, ExtractionMetadata, ExtractionOptions, PreparedDocument, ResolvedLLMModelOptions, RunExtractedDocumentWriteOptions, Step1SourceRef, Step3Metadata, TranscriptionResult, VideoMetadata, WriteDocumentOutputMetadataOptions, WriteRuntimeOptions } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InternalError } from '~/utils/error-handler'
import { logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildAggregateTiming } from '~/utils/pricing/aggregate-pricing/timing'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { buildLLMModelOptions, resolveLLMDefaults } from '~/cli/options/option-resolution/model-option-llm-defaults'

const hasConfiguredLlmProvider = (opts: ResolvedLLMModelOptions): boolean =>
  [
    ...(opts.llamaModels ?? (opts.llamaModel ? [opts.llamaModel] : [])),
    ...(opts.openaiModels ?? (opts.openaiModel ? [opts.openaiModel] : [])),
    ...(opts.groqModels ?? (opts.groqModel ? [opts.groqModel] : [])),
    ...(opts.geminiModels ?? (opts.geminiModel ? [opts.geminiModel] : [])),
    ...(opts.anthropicModels ?? (opts.anthropicModel ? [opts.anthropicModel] : [])),
    ...(opts.minimaxModels ?? (opts.minimaxModel ? [opts.minimaxModel] : [])),
    ...(opts.grokModels ?? (opts.grokModel ? [opts.grokModel] : [])),
    ...(opts.glmModels ?? (opts.glmModel ? [opts.glmModel] : [])),
    ...(opts.kimiModels ?? (opts.kimiModel ? [opts.kimiModel] : [])),
    ...(opts.togetherModels ?? (opts.togetherModel ? [opts.togetherModel] : [])),
    ...(opts.cerebrasModels ?? (opts.cerebrasModel ? [opts.cerebrasModel] : []))
  ].some((value) => typeof value === 'string' && value.length > 0)

const toDocumentSourceUrl = (target: string): string => {
  if (isLikelyUrl(target)) {
    return target
  }

  return `file://${pathResolve(target)}`
}

const buildEstimateMatchKey = (step: string, provider: string, model: string): string =>
  `${step}::${provider}::${model}`

export const buildExtractionCallOpts = (target: string, baseDir: string, opts: DocumentExtractionOptions): Partial<ExtractionOptions> => {
  const step2SelectionOrigins = opts.step2SelectionOrigins
    ? Object.fromEntries(
        Object.entries(opts.step2SelectionOrigins).filter(([, value]) => value !== undefined)
      ) as Record<string, 'default' | 'explicit' | 'all-shortcut'>
    : undefined
  const extractionOpts: Partial<ExtractionOptions> = {
    filePath: target,
    outputDir: baseDir || opts.outputRootDir,
    dpi: opts.dpi,
    languages: opts.lang,
    outputFormat: opts.out,
    pdfChapterMode: opts.pdfChapterMode,
    ocrConcurrencyMode: opts.ocrConcurrencyMode,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    keepOcrPageInputs: opts.keepOcrPageInputs,
    primaryOcr: opts.primaryOcr,
    configPath: opts.configPath
  }

  if (opts.pdfChapterMode !== 'local' && hasConfiguredLlmProvider(opts)) {
    const llmConfig = resolveLLMDefaults(opts)
    if (typeof llmConfig.llmService === 'string' && typeof llmConfig.llmModel === 'string') {
      extractionOpts.pdfChapterLlmService = llmConfig.llmService
      extractionOpts.pdfChapterLlmModel = llmConfig.llmModel
    }
  }

  if (opts.password) {
    extractionOpts.password = opts.password
  }
  if (opts.ocrConcurrency !== undefined) {
    extractionOpts.ocrConcurrency = opts.ocrConcurrency
  }
  if (opts.useTesseract) {
    extractionOpts.useTesseract = true
  }
  if (opts.mistralOcrModel) {
    extractionOpts.mistralOcrModel = opts.mistralOcrModel
  }
  if (opts.mistralOcrModels) {
    extractionOpts.mistralOcrModels = opts.mistralOcrModels
  }
  if (opts.glmOcrModel) {
    extractionOpts.glmOcrModel = opts.glmOcrModel
  }
  if (opts.glmOcrModels) {
    extractionOpts.glmOcrModels = opts.glmOcrModels
  }
  if (opts.kimiOcrModel) {
    extractionOpts.kimiOcrModel = opts.kimiOcrModel
  }
  if (opts.kimiOcrModels) {
    extractionOpts.kimiOcrModels = opts.kimiOcrModels
  }
  if (opts.openaiOcrModel) {
    extractionOpts.openaiOcrModel = opts.openaiOcrModel
  }
  if (opts.openaiOcrModels) {
    extractionOpts.openaiOcrModels = opts.openaiOcrModels
  }
  if (opts.grokOcrModel) {
    extractionOpts.grokOcrModel = opts.grokOcrModel
  }
  if (opts.grokOcrModels) {
    extractionOpts.grokOcrModels = opts.grokOcrModels
  }
  if (opts.anthropicOcrModel) {
    extractionOpts.anthropicOcrModel = opts.anthropicOcrModel
  }
  if (opts.anthropicOcrModels) {
    extractionOpts.anthropicOcrModels = opts.anthropicOcrModels
  }
  if (opts.geminiOcrModel) {
    extractionOpts.geminiOcrModel = opts.geminiOcrModel
  }
  if (opts.geminiOcrModels) {
    extractionOpts.geminiOcrModels = opts.geminiOcrModels
  }
  if (opts.deepinfraOcrModel) {
    extractionOpts.deepinfraOcrModel = opts.deepinfraOcrModel
  }
  if (opts.deepinfraOcrModels) {
    extractionOpts.deepinfraOcrModels = opts.deepinfraOcrModels
  }
  if (typeof opts.chapterFiles === 'boolean') {
    extractionOpts.chapterFiles = opts.chapterFiles
  }
  if (typeof opts.chapterChunkLimitChars === 'number') {
    extractionOpts.chapterChunkLimitChars = opts.chapterChunkLimitChars
  }
  if (opts.useEpubBun) {
    extractionOpts.useEpubBun = true
  }
  if (step2SelectionOrigins) {
    extractionOpts.step2SelectionOrigins = step2SelectionOrigins
  }

  return extractionOpts
}
const writeDocumentOutputMetadata = async (
  outputDir: string,
  params: WriteDocumentOutputMetadataOptions
): Promise<void> => {
  const {
    step1,
    step2,
    step3,
    mistralOcrModel,
    glmOcrModel,
    kimiOcrModel,
    openaiOcrModel,
    grokOcrModel,
    anthropicOcrModel,
    geminiOcrModel,
    deepinfraOcrModel,
    artifactFiles,
    preflightEstimate,
    completionStatus,
    requestedProviders,
    providerStates,
    missingProviders,
    blockedProviders,
    web,
    errors,
    ocrConcurrency,
    ocrConcurrencyMode,
    ocrProviderConcurrency,
    ocrLocalConcurrency
  } = params
  const extractTargets = collectEstimatedExtractTargets(step2, {
    mistralOcrModel,
    glmOcrModel,
    kimiOcrModel,
    openaiOcrModel,
    grokOcrModel,
    anthropicOcrModel,
    geminiOcrModel,
    deepinfraOcrModel
  })
  const step3Entries = Array.isArray(step3) ? step3 : [step3]

  const estimated = resolveDocumentWriteEstimatedCosts(preflightEstimate, step2, step3, {
    mistralOcrModel,
    glmOcrModel,
    kimiOcrModel,
    openaiOcrModel,
    grokOcrModel,
    anthropicOcrModel,
    geminiOcrModel,
    deepinfraOcrModel
  })
  const observedEstimate = resolveDocumentWriteObservedEstimateCosts(step2, step3, {
    mistralOcrModel,
    glmOcrModel,
    kimiOcrModel,
    openaiOcrModel,
    grokOcrModel,
    anthropicOcrModel,
    geminiOcrModel,
    deepinfraOcrModel
  })
  const actual = computeActualCosts({ step2, step3 })
  const ocrDiagnostics = buildOcrCostDiagnostics(step2, estimated, actual)
  const cost = {
    estimated,
    observedEstimate,
    actual,
    ...(ocrDiagnostics.length > 0 ? { ocrDiagnostics } : {})
  }

  const fallbackEstimatedTiming = computeEstimatedProcessingTimes({
    extractTargets: extractTargets.map((target) => ({
      provider: target.provider,
      model: target.model,
      pageCount: target.pageCount ?? step1.pageCount,
      ...(typeof target.rasterizedPages === 'number' ? { rasterizedPages: target.rasterizedPages } : {}),
      ...(typeof target.singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages: target.singlePagePdfFallbackPages } : {})
    })),
    llmTargets: step3Entries.map((entry) => ({
      service: entry.llmService,
      model: entry.llmModel,
      inputTokens: entry.inputTokenCount,
      outputTokens: entry.outputTokenCount
    })),
    skipLLM: false,
    ...(typeof ocrConcurrency === 'number' ? { ocrConcurrency } : {}),
    ...(ocrConcurrencyMode ? { ocrConcurrencyMode } : {}),
    ...(typeof ocrProviderConcurrency === 'number' ? { ocrProviderConcurrency } : {}),
    ...(typeof ocrLocalConcurrency === 'number' ? { ocrLocalConcurrency } : {})
  })
  const timingAllowedKeys = new Set([
    ...extractTargets.map((target) => buildEstimateMatchKey('extract', target.provider, target.model)),
    ...step3Entries.map((entry) => buildEstimateMatchKey('llm', entry.llmService, entry.llmModel))
  ])
  const priceAlignedTimingSteps = preflightEstimate?.steps.filter((step) =>
    timingAllowedKeys.has(buildEstimateMatchKey(step.step, step.provider, step.model))
  )
  const priceAlignedTiming = priceAlignedTimingSteps && priceAlignedTimingSteps.length > 0
    ? buildAggregateTiming(priceAlignedTimingSteps, undefined, {
        ...(typeof ocrConcurrency === 'number' ? { ocrConcurrency } : {}),
        ...(ocrConcurrencyMode ? { ocrConcurrencyMode } : {}),
        ...(typeof ocrProviderConcurrency === 'number' ? { ocrProviderConcurrency } : {}),
        ...(typeof ocrLocalConcurrency === 'number' ? { ocrLocalConcurrency } : {})
      })
    : undefined
  const hasRasterizedExtractTargets = extractTargets.some((target) => typeof target.rasterizedPages === 'number' && target.rasterizedPages > 0)
  const estimatedTiming = hasRasterizedExtractTargets ? fallbackEstimatedTiming : priceAlignedTiming ?? fallbackEstimatedTiming
  const actualTiming = computeActualProcessingTimes({ step1, step2, step3 })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined

  const manifestMetadata = {
    step1,
    step2,
    ...(completionStatus ? { completionStatus } : {}),
    ...(requestedProviders ? { requestedProviders } : {}),
    ...(providerStates ? { providerStates } : {}),
    ...(missingProviders ? { missingProviders } : {}),
    ...(blockedProviders ? { blockedProviders } : {}),
    step3,
    ...(web ? { web } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(errors && errors.length > 0 ? { errors } : {}),
  }

  await writeManifest(outputDir, createManifest('write', 'single', [
    createPipelineItemFromRecord(outputDir, manifestMetadata, { status: completionStatus ?? 'full' })
  ]))
  logWriteManifestConsoleSummary(outputDir, manifestMetadata, {
    promptArtifact: typeof artifactFiles['prompt'] === 'string' ? artifactFiles['prompt'] : 'prompt.md',
    ...(typeof artifactFiles['rendered'] === 'string' ? { step3RenderedOutput: artifactFiles['rendered'] } : {})
  })

  l.report.complete(outputDir, artifactFiles)
}

const rootArtifactDirectoryExists = async (
  outputDir: string,
  directory: string
): Promise<boolean> =>
  await stat(join(outputDir, directory)).then((entry) => entry.isDirectory(), () => false)

export const appendChapterExportArtifacts = async (
  artifactFiles: Record<string, string>,
  step2Metadata: ExtractionMetadata | ExtractionMetadata[],
  outputDir: string
): Promise<void> => {
  const primary = Array.isArray(step2Metadata) ? step2Metadata[0] : step2Metadata
  const exportSummary = primary?.chapterExport
  if (!exportSummary || !Array.isArray(exportSummary.directories)) {
    return
  }

  if (exportSummary.directories.includes('chapters') && await rootArtifactDirectoryExists(outputDir, 'chapters')) {
    artifactFiles['chapters'] = 'chapters/'
  }
  if (exportSummary.directories.includes('chunks') && await rootArtifactDirectoryExists(outputDir, 'chunks')) {
    artifactFiles['chunks'] = 'chunks/'
  }
}

export const runExtractedDocumentWrite = async ({
  target,
  opts,
  extraction,
  sourceRef,
  preflightEstimate,
  extraArtifactFiles
}: RunExtractedDocumentWriteOptions): Promise<{ outputDir: string }> => {
  const llmConfig = resolveLLMDefaults(opts)
  const documentMeta: VideoMetadata = {
    title: extraction.step1Metadata.title ?? 'Document',
    duration: 'Unknown',
    channel: extraction.step1Metadata.author ?? 'Unknown',
    description: '',
    url: sourceRef?.url ?? toDocumentSourceUrl(target)
  }
  const transcriptionLike: TranscriptionResult = {
    text: extraction.result.text,
    segments: [{
      start: '00:00:00',
      end: '00:00:00',
      text: extraction.result.text
    }]
  }

  const step3Runs = await runLLM(documentMeta, transcriptionLike, {
    outputDir: extraction.outputDir,
    prompts: opts.prompts,
    promptFile: opts.promptFile,
    ...buildLLMModelOptions(llmConfig),
    llmProviderConcurrency: opts.llmProviderConcurrency,
    llmLocalConcurrency: opts.llmLocalConcurrency,
    promptBuilder: (instruction: string) =>
      buildDocumentPrompt(extraction.result.text, extraction.step1Metadata, instruction)
  })

  const step3Results = step3Runs.map((entry) => entry.metadata)
  if (step3Results.length === 0) {
    throw InternalError('No LLM outputs generated for document write', { stage: 'write:document' })
  }

  const renderedArtifacts = await writeRenderedTextArtifacts({
    outputDir: extraction.outputDir,
    results: step3Runs,
    writeInternal: opts.renderedText,
    sourcePath: sourceRef?.filePath ?? target,
    trackListPath: opts.trackList,
    externalDir: opts.renderedOutDir,
    externalBaseName: extraction.step1Metadata.slug
  })
  if (renderedArtifacts.externalFiles.length > 0) {
    logLocationsTable(l, [{
      artifact: 'renderedOutDir',
      path: opts.renderedOutDir,
      detail: `${renderedArtifacts.externalFiles.length} file${renderedArtifacts.externalFiles.length === 1 ? '' : 's'}`
    }])
  }

  const showNoteArtifacts = await writeShowNoteArtifacts({
    outputDir: extraction.outputDir,
    results: step3Runs,
    sourceText: extraction.result.text
  })

  const step3Serialized: Step3Metadata | Step3Metadata[] = step3Results.length === 1 ? step3Results[0]! : step3Results
  const llmInputTokenCount = step3Results.reduce((sum, item) => sum + item.inputTokenCount, 0)
  const llmOutputTokenCount = step3Results.reduce((sum, item) => sum + item.outputTokenCount, 0)
  const llmService = step3Results[0]?.llmService ?? 'llama.cpp'
  const llmModel = step3Results[0]?.llmModel ?? (llmConfig.llamaModel ?? 'unknown')

  const artifactFiles: Record<string, string> = {
    ...(extraArtifactFiles ?? {}),
    prompt: 'prompt.md',
    manifest: 'manifest.json',
    ...renderedArtifacts.internalArtifacts,
    ...showNoteArtifacts.internalArtifacts
  }
  await appendChapterExportArtifacts(artifactFiles, extraction.step2Metadata, extraction.outputDir)
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
  } else {
    for (const step3 of step3Results) {
      const summaryKey = step3.outputFileName.replace(/\.json$/u, '').replace(/^text-/u, 'summary-')
      artifactFiles[summaryKey] = step3.outputFileName
    }
  }

  const priceAlignedEstimate = preflightEstimate ?? await buildAggregatedPriceEstimate('write', target, opts)

  await writeDocumentOutputMetadata(extraction.outputDir, {
    step1: extraction.step1Metadata,
    step2: extraction.step2Metadata,
    step3: step3Serialized,
    mistralOcrModel: opts.mistralOcrModel,
    glmOcrModel: opts.glmOcrModel,
    kimiOcrModel: opts.kimiOcrModel,
    openaiOcrModel: opts.openaiOcrModel,
    grokOcrModel: opts.grokOcrModel,
    anthropicOcrModel: opts.anthropicOcrModel,
    geminiOcrModel: opts.geminiOcrModel,
    deepinfraOcrModel: opts.deepinfraOcrModel,
    llmService,
    llmModel,
    llmInputTokenCount,
    llmOutputTokenCount,
    artifactFiles,
    preflightEstimate: priceAlignedEstimate,
    ...(extraction.completionStatus ? { completionStatus: extraction.completionStatus } : {}),
    ...(extraction.requestedProviders ? { requestedProviders: extraction.requestedProviders } : {}),
    ...(extraction.providerStates ? { providerStates: extraction.providerStates } : {}),
    ...(extraction.missingProviders ? { missingProviders: extraction.missingProviders } : {}),
    ...(extraction.blockedProviders ? { blockedProviders: extraction.blockedProviders } : {}),
    ...(extraction.web ? { web: extraction.web } : {}),
    ...(extraction.step2Errors ? { errors: extraction.step2Errors } : {}),
    ocrConcurrency: opts.ocrConcurrency,
    ocrConcurrencyMode: opts.ocrConcurrencyMode,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency
  })
  return { outputDir: extraction.outputDir }
}

export const runDocumentWrite = async (
  target: string,
  baseDir: string,
  opts: WriteRuntimeOptions,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<{ outputDir: string }> => {
  const resolvedPreparedDocument = preparedDocument ?? (batchChildContext
    ? await downloadDocument(target, baseDir || opts.outputRootDir, opts.password, sourceRef, batchChildContext)
    : undefined)
  const extraction = await processOcr(
    target,
    {
      ...buildExtractionCallOpts(target, baseDir, opts),
      ...(batchChildContext?.hostedOcrScheduler ? { hostedOcrScheduler: batchChildContext.hostedOcrScheduler } : {})
    },
    sourceRef,
    resolvedPreparedDocument,
    preflightEstimate
  )

  return await runExtractedDocumentWrite({
    target,
    opts,
    extraction,
    ...(sourceRef ? { sourceRef } : {}),
    ...(preflightEstimate ? { preflightEstimate } : {})
  })
}
