import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import type { AggregatedPriceEstimate, ExtractionOptions, OcrProviderRunContext, PreparedDocument, ProcessDocumentOutput, Step1SourceRef } from '~/types'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { downloadDocument } from '../../step-1-download/document/dl-document'
import { buildDocumentSource } from './ocr-document-metadata'
import { resolveOcrExtractionOptions } from './ocr-extraction-options'
import { runOcrMultiProviderBatch } from './ocr-multi-provider-batch'
import { parseStoredOcrPoolLedger, runOcrPooledBatch } from './ocr-pooled-batch'
import { runOcrSingleTarget } from './ocr-single-target'
import { collectExplicitOcrTargets } from './ocr-targets'
import { cleanupOcrPreparationCache, createOcrPreparationCache } from './ocr-utils/preparation-cache'
import { createHostedOcrScheduler } from './ocr-utils/hosted-ocr-scheduler'
import { readSinglePipelineItemRecord } from '../../pipeline-manifest'
import { isRecord } from '~/utils/rest-client'
import { UsageError } from '~/utils/error-handler'

export { writeProviderArtifacts } from './ocr-artifacts'

export const processOcr = async (
  filePath: string,
  rawOpts: Partial<ExtractionOptions>,
  sourceRef?: Step1SourceRef,
  preparedDocument?: PreparedDocument,
  preflightEstimate?: AggregatedPriceEstimate,
  providerRunContext?: OcrProviderRunContext
): Promise<ProcessDocumentOutput> => {
  const resolvedOutputDir = providerRunContext?.outputDir !== undefined
    ? providerRunContext.outputDir
    : rawOpts.outputDir || getOutputRoot()

  const resolvedOcrConcurrencyMode: 'auto' | 'fixed' = rawOpts.ocrConcurrencyMode
    ?? (typeof rawOpts.ocrConcurrency === 'number' ? 'fixed' : 'auto')
  const opts = resolveOcrExtractionOptions(filePath, rawOpts, resolvedOutputDir, resolvedOcrConcurrencyMode, preparedDocument)

  const prepared = preparedDocument
    ? preparedDocument
    : await runWithLogContext({ step: 'step-1-download' }, async () =>
      await downloadDocument(filePath, opts.outputDir, opts.password, sourceRef)
    )
  const ocrPreparationCache = createOcrPreparationCache()
  const rootHostedOcrScheduler = rawOpts.hostedOcrScheduler ?? createHostedOcrScheduler({
    mode: opts.ocrConcurrencyMode,
    fixedCap: opts.ocrConcurrency,
    pageCount: prepared.step1Metadata.pageCount,
    concurrencyMode: rawOpts.concurrencyMode,
    hostedConcurrencyCoordinator: rawOpts.hostedConcurrencyCoordinator
  })
  const hostedOcrScheduler = rootHostedOcrScheduler.getLifetime() === 'run'
    ? rootHostedOcrScheduler.createDocumentScope(prepared.step1Metadata.pageCount)
    : rootHostedOcrScheduler
  const optsWithPreparationCache: ExtractionOptions = {
    ...opts,
    ocrPreparationCache,
    hostedOcrScheduler
  }

  const { outputDir, step1Metadata, effectiveFilePath, tempCleanup, web } = prepared
  const extractFilePath = effectiveFilePath ?? filePath
  const effectiveOptsWithPreparationCache: ExtractionOptions = {
    ...optsWithPreparationCache,
    outputDir
  }

  const explicitTargets = effectiveOptsWithPreparationCache.preparedMarkdown ? [] : collectExplicitOcrTargets(effectiveOptsWithPreparationCache)
  const documentSource = buildDocumentSource(filePath, sourceRef)
  const ocrProviderMode = providerRunContext?.ocrProviderMode ?? opts.ocrProviderMode

  try {
    const storedRecord = providerRunContext
      ? await readSinglePipelineItemRecord(outputDir, { command: 'extract', extractRoute: 'document' })
      : undefined
    if (isRecord(storedRecord)) {
      const storedMode = storedRecord['ocrProviderMode'] === 'pool' ? 'pool' : 'fanout'
      if (storedMode !== ocrProviderMode) {
        throw UsageError(`Cannot resume a ${storedMode} OCR run as ${ocrProviderMode}. Resume preserves the OCR provider mode stored in manifest.json.`)
      }
    }
    if (ocrProviderMode === 'pool') {
      const requestedTargets = providerRunContext?.requestedTargets ?? explicitTargets
      const targetsToRun = providerRunContext?.targetsToRun ?? requestedTargets
      return await runOcrPooledBatch({
        outputDir,
        requestedTargets,
        targetsToRun,
        opts,
        effectiveOpts: { ...effectiveOptsWithPreparationCache, ocrProviderMode: 'pool' },
        ocrPreparationCache,
        hostedOcrScheduler,
        step1Metadata,
        web,
        documentSource,
        extractFilePath,
        preparedMarkdown: prepared.preparedMarkdown,
        preflightEstimate,
        restoredLedger: isRecord(storedRecord) ? parseStoredOcrPoolLedger(storedRecord['ocrPool']) : undefined,
        reenabledTargets: providerRunContext?.reenabledTargets
      })
    }

    if (providerRunContext || explicitTargets.length > 1) {
      const requestedTargets = providerRunContext?.requestedTargets ?? explicitTargets
      const targetsToRun = providerRunContext?.targetsToRun ?? requestedTargets
      return await runOcrMultiProviderBatch({
        outputDir,
        requestedTargets,
        targetsToRun,
        opts,
        effectiveOpts: effectiveOptsWithPreparationCache,
        ocrPreparationCache,
        hostedOcrScheduler,
        step1Metadata,
        web,
        documentSource,
        extractFilePath,
        preparedMarkdown: prepared.preparedMarkdown,
        preflightEstimate
      })
    }

    return await runOcrSingleTarget({
      outputDir,
      explicitTargets,
      opts,
      effectiveOpts: effectiveOptsWithPreparationCache,
      hostedOcrScheduler,
      step1Metadata,
      web,
      documentSource,
      extractFilePath,
      preparedMarkdown: prepared.preparedMarkdown,
      preflightEstimate
    })
  } finally {
    await cleanupOcrPreparationCache(ocrPreparationCache)
    if (tempCleanup) await tempCleanup()
  }
}
