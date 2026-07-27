import { cp, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import type { AggregatedPriceEstimate, ExtractionOptions, OcrProviderRunContext, PreparedDocument, ProcessDocumentOutput, Step1SourceRef } from '~/types'
import { l, runWithLogContext } from '~/utils/app-logger/app-logger'
import { downloadDocument } from '../../step-1-download/document/dl-document'
import { buildDocumentSource } from './ocr-document-metadata'
import { resolveOcrExtractionOptions } from './ocr-extraction-options'
import { runOcrMultiProviderBatch } from './ocr-multi-provider-batch'
import { runOcrSingleTarget } from './ocr-single-target'
import { collectExplicitOcrTargets } from './ocr-targets'
import { cleanupOcrPreparationCache, createOcrPreparationCache } from './ocr-utils/preparation-cache'
import { createHostedOcrScheduler } from './ocr-utils/hosted-ocr-scheduler'

export { writeProviderArtifacts } from './ocr-artifacts'

const pathExists = async (path: string): Promise<boolean> =>
  await stat(path).then(() => true, () => false)

const maybeMigrateLegacyFallbackArtifacts = async (
  legacyDir: string,
  outputDir: string,
  sourceFilePath: string
): Promise<void> => {
  if (legacyDir === outputDir) {
    return
  }

  const legacyStatePath = join(legacyDir, 'fallback-state.json')
  const outputStatePath = join(outputDir, 'fallback-state.json')
  if (!await pathExists(legacyStatePath) || await pathExists(outputStatePath)) {
    return
  }

  let state: Record<string, unknown>
  try {
    state = await Bun.file(legacyStatePath).json() as Record<string, unknown>
  } catch {
    return
  }

  if (state['sourceFile'] !== basename(sourceFilePath)) {
    return
  }

  await cp(legacyStatePath, outputStatePath)
  for (const entry of ['page-results', 'page-inputs']) {
    const sourcePath = join(legacyDir, entry)
    if (await pathExists(sourcePath)) {
      await cp(sourcePath, join(outputDir, entry), { recursive: true })
    }
  }
  const partialPath = join(legacyDir, 'partial-extraction.txt')
  if (await pathExists(partialPath)) {
    await cp(partialPath, join(outputDir, 'partial-extraction.txt'))
  }
  l.write('info', `Migrated OCR page fallback cache into ${outputDir}`)
}

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
  const hostedOcrScheduler = rawOpts.hostedOcrScheduler ?? createHostedOcrScheduler({
    mode: opts.ocrConcurrencyMode,
    fixedCap: opts.ocrConcurrency,
    pageCount: prepared.step1Metadata.pageCount
  })
  const optsWithPreparationCache: ExtractionOptions = {
    ...opts,
    ocrPreparationCache,
    hostedOcrScheduler
  }

  const { outputDir, step1Metadata, effectiveFilePath, tempCleanup, web } = prepared
  const extractFilePath = effectiveFilePath ?? filePath
  await maybeMigrateLegacyFallbackArtifacts(optsWithPreparationCache.outputDir, outputDir, extractFilePath)
  const effectiveOptsWithPreparationCache: ExtractionOptions = {
    ...optsWithPreparationCache,
    outputDir
  }

  const explicitTargets = effectiveOptsWithPreparationCache.preparedMarkdown ? [] : collectExplicitOcrTargets(effectiveOptsWithPreparationCache)
  const documentSource = buildDocumentSource(filePath, sourceRef)

  try {
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
