import { isRecord } from '~/utils/rest-client'
import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DocumentMetadataSchema } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { validateData } from '~/utils/validate/validation'
import { processOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { downloadDocumentUrlToTempFile } from '~/cli/commands/process-steps/step-1-download/document/resolve-document-source'
import {
  buildMissingTargetsFromEntry,
  hasOnlyBlockedMissingTargetsFromEntry,
  inferStoredCompletionStatus,
  parseStoredRequestedTargets
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import { readOcrRunManifestEntry, writeOcrBatchManifest, writeOcrRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-manifest'
import type { AggregatedPriceEstimate, BatchManifestEntry, OcrResumePassContext, OcrTarget, PreparedDocument, ProviderCompletionStatus, ProviderResumePassResult, ResolvedStep2Execution, ResumeDisplayOptions, ResumeOcrEntry, ResumeResult, ResumeTarget, RuntimeOptions, Step1SourceRef, StepEstimate, WebArticleMetadata } from '~/types'
import { resolveAdditiveResumeProviderSelection } from '../resume-provider-selection'
import { hasResumableProviderTargetWork, readProviderResumeTargetManifest, runProviderResumePass, withProviderResumeOutputDir } from '../provider-batch-resume'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { buildExtractEstimates } from '~/utils/pricing/aggregate-pricing/extract-estimates'


const resolveStoredOutputDir = async (
  entry: Record<string, unknown>
): Promise<string | undefined> => {
  if (typeof entry['outputDir'] === 'string' && entry['outputDir'].length > 0) {
    return resolvePath(entry['outputDir'])
  }
  return undefined
}

const toStoredSource = (entry: Record<string, unknown>): Step1SourceRef => {
  const source = isRecord(entry['source']) ? entry['source'] : undefined
  const filePath = typeof source?.['filePath'] === 'string'
    ? source['filePath']
    : undefined
  const url = typeof source?.['url'] === 'string'
    ? source['url']
    : typeof entry['url'] === 'string'
      ? entry['url']
      : undefined

  if (filePath) {
    return { filePath }
  }

  if (!url) {
    throw CLIUsageError('Run entry is missing source information and cannot be resumed.')
  }

  if (url.startsWith('file://')) {
    try {
      return { filePath: fileURLToPath(url) }
    } catch {
      return { filePath: decodeURIComponent(url.replace(/^file:\/\/+/, '/')) }
    }
  }

  return { url }
}

const parseResumeEntry = async (
  entry: unknown,
  selectedTargets: OcrTarget[] | undefined
): Promise<ResumeOcrEntry | undefined> => {
  if (!isRecord(entry)) {
    return undefined
  }

  const outputDir = await resolveStoredOutputDir(entry)
  if (!outputDir) {
    return undefined
  }

  const storedRequestedTargets = parseStoredRequestedTargets(entry)
  if (storedRequestedTargets.length === 0 && (!selectedTargets || selectedTargets.length === 0)) {
    return undefined
  }

  const source = toStoredSource(entry)
  const storedMissingTargets = buildMissingTargetsFromEntry(entry, storedRequestedTargets, {
    includeBlocked: selectedTargets !== undefined
  })
  const resolvedTargets = resolveAdditiveResumeProviderSelection({
    storedProviders: storedRequestedTargets,
    runnableStoredProviders: storedMissingTargets,
    ...(selectedTargets ? { selectedProviders: selectedTargets } : {})
  })
  const requestedTargets = resolvedTargets.requestedProviders

  return {
    outputDir,
    source,
    requestedTargets,
    missingTargets: resolvedTargets.providersToRun,
    completionStatus: inferStoredCompletionStatus(entry, requestedTargets),
    rawEntry: entry,
    onlyBlockedMissingTargets: selectedTargets === undefined
      && hasOnlyBlockedMissingTargetsFromEntry(entry, storedRequestedTargets)
  }
}

const readOutputMetadata = async (outputDir: string): Promise<BatchManifestEntry> => {
  const raw = await readOcrRunManifestEntry(outputDir)
  if (!isRecord(raw)) {
    throw CLIUsageError(`Invalid OCR manifest at ${outputDir}/run.json`)
  }
  return raw
}

const readPreparedDocument = async (outputDir: string): Promise<PreparedDocument> => {
  const metadata = await readOutputMetadata(outputDir)
  if (!isRecord(metadata['step1'])) {
    throw CLIUsageError(`Invalid OCR manifest at ${outputDir}/run.json`)
  }

  const step1Metadata = validateData(DocumentMetadataSchema, metadata['step1'], 'stored OCR step1 metadata')
  const web = isRecord(metadata['web']) ? metadata['web'] as WebArticleMetadata : undefined

  return {
    outputDir,
    step1Metadata,
    ...(web ? { web } : {})
  }
}

const markEntryFull = (
  metadata: BatchManifestEntry
): BatchManifestEntry => ({
  ...metadata,
  completionStatus: 'full',
  missingProviders: [],
  blockedProviders: []
})

const toResumeResult = (
  result: ProviderResumePassResult
): ResumeResult => ({
  full: result.ok,
  incomplete: result.incomplete,
  failed: result.fail
})

const selectedOcrTargetsComplete = (
  metadata: BatchManifestEntry,
  selectedTargets: OcrTarget[] | undefined
): boolean => {
  if (selectedTargets === undefined) {
    return false
  }

  const storedRequestedTargets = parseStoredRequestedTargets(metadata)
  const storedMissingTargets = buildMissingTargetsFromEntry(metadata, storedRequestedTargets, {
    includeBlocked: true
  })
  const resolvedTargets = resolveAdditiveResumeProviderSelection({
    storedProviders: storedRequestedTargets,
    runnableStoredProviders: storedMissingTargets,
    selectedProviders: selectedTargets
  })
  return resolvedTargets.providersToRun.length === 0
}

export const hasResumableOcrTargetWork = async (
  target: ResumeTarget,
  selectedTargets: OcrTarget[] | undefined
): Promise<boolean> =>
  await hasResumableProviderTargetWork(target, {
    readOutputMetadata,
    parseEntry: async (entry) => await parseResumeEntry(entry, selectedTargets)
  })

const buildResumeExtractionOpts = (
  opts: RuntimeOptions,
  outputDir: string
) => {
  const step2SelectionOrigins = opts.step2SelectionOrigins
    ? Object.fromEntries(
        Object.entries(opts.step2SelectionOrigins).filter(([, value]) => value !== undefined)
      ) as Record<string, 'default' | 'explicit' | 'all-shortcut'>
    : undefined

  return {
    filePath: '',
    outputDir,
    dpi: opts.dpi,
    languages: opts.lang,
    outputFormat: opts.out,
    password: opts.password,
    ocrConcurrency: opts.ocrConcurrency,
    ocrConcurrencyMode: opts.ocrConcurrencyMode,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    chapterFiles: opts.chapterFiles,
    chapterChunkLimitChars: opts.chapterChunkLimitChars,
    pdfChapterMode: opts.pdfChapterMode,
    configPath: opts.configPath,
    ...(opts.useEpubBun ? { useEpubBun: true } : {}),
    ...(step2SelectionOrigins ? { step2SelectionOrigins } : {})
  }
}

const getOcrCompletionStatus = (
  metadata: BatchManifestEntry
): ProviderCompletionStatus => {
  if (metadata['completionStatus'] === 'failed' || metadata['completionStatus'] === 'full') {
    return metadata['completionStatus']
  }
  return 'incomplete'
}

const runResumeOcrTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: OcrTarget[],
  displayOptions: ResumeDisplayOptions = {}
): Promise<ProviderResumePassResult> => {
  const resumableStatus: OcrResumePassContext = {
    resumableIncomplete: 0,
    resumableFailed: 0
  }

  const result = await runProviderResumePass<OcrTarget, ResumeOcrEntry, OcrResumePassContext>(
    target,
    opts,
    {
      stepLabel: 'OCR',
      readOutputMetadata,
      writeBatchManifest: writeOcrBatchManifest,
      writeRunManifest: writeOcrRunManifest,
      parseEntry: async (entry) => await parseResumeEntry(entry, selectedTargets),
      getProviderLabels: (targets) => targets.map((runTarget) => `${runTarget.service}/${runTarget.model}`),
      normalizeAlreadyFullMetadata: markEntryFull,
      classifyNoMatchingMetadata: (metadata) =>
        selectedOcrTargetsComplete(metadata, selectedTargets)
          ? 'full'
          : getOcrCompletionStatus(metadata),
      createPassContext: () => resumableStatus,
      formatNoMatchingDetail: ({ entry }) =>
        selectedTargets !== undefined && entry.completionStatus !== 'full'
          ? 'selected providers complete; run manifest still incomplete'
          : entry.onlyBlockedMissingTargets
            ? 'only blocked OCR providers remain'
            : 'no matching failed or missing providers selected',
      processEntry: async ({ entry, opts }) => {
        const preparedDocument = await readPreparedDocument(entry.outputDir)
        let resumeFilePath = entry.source.filePath
        let cleanup: (() => Promise<void>) | undefined
        if (!resumeFilePath && entry.source.url) {
          const downloaded = await downloadDocumentUrlToTempFile(entry.source.url)
          resumeFilePath = downloaded.filePath
          cleanup = downloaded.cleanup
        }

        if (!resumeFilePath) {
          throw CLIUsageError('OCR resume entry is missing a resumable file path.')
        }

        try {
          await processOcr(
            resumeFilePath,
            buildResumeExtractionOpts(opts, entry.outputDir),
            entry.source,
            preparedDocument,
            undefined,
            {
              outputDir: entry.outputDir,
              requestedTargets: entry.requestedTargets,
              targetsToRun: entry.missingTargets
            }
          )
        } catch (error) {
          if (!(error instanceof Error) || typeof (error as Error & { outputDir?: unknown }).outputDir !== 'string') {
            throw error
          }
        } finally {
          if (cleanup) {
            await cleanup()
          }
        }

        const metadata = await readOutputMetadata(entry.outputDir)
        const remainingResumableEntry = await parseResumeEntry(
          withProviderResumeOutputDir(metadata, entry.outputDir),
          selectedTargets
        )
        const hasRemainingResumableWork = (remainingResumableEntry?.missingTargets.length ?? 0) > 0
        const completionStatus = getOcrCompletionStatus(metadata)
        if (selectedTargets !== undefined && !hasRemainingResumableWork && completionStatus !== 'full') {
          return {
            outputDir: entry.outputDir,
            metadata,
            completionStatus: 'full',
            detail: 'selected providers complete; run manifest still incomplete',
            level: 'success',
            hasRemainingResumableWork
          }
        }
        return {
          outputDir: entry.outputDir,
          metadata,
          completionStatus,
          detail: completionStatus === 'full'
            ? 'resume complete'
            : hasRemainingResumableWork
              ? completionStatus === 'failed' ? 'resume failed' : 'resume incomplete'
              : 'no resumable providers remain',
          level: completionStatus === 'failed'
            ? 'error'
            : completionStatus === 'full' ? 'success' : 'warn',
          hasRemainingResumableWork
        }
      },
      onProcessedResult: ({ result, context }) => {
        if (!result.hasRemainingResumableWork) {
          return
        }
        if (result.completionStatus === 'failed') {
          context.resumableFailed += 1
        } else if (result.completionStatus === 'incomplete') {
          context.resumableIncomplete += 1
        }
      }
    },
    1,
    1,
    displayOptions
  )

  if (resumableStatus.resumableIncomplete > 0 || resumableStatus.resumableFailed > 0) {
    throw InfraError(`OCR resume still has ${resumableStatus.resumableIncomplete} incomplete and ${resumableStatus.resumableFailed} failed item(s) with resumable providers`, { stage: 'resume:ocr', exitCode: 2 })
  }
  return result
}

export const resumeOcrTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: OcrTarget[],
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> => {
  const result = await runResumeOcrTarget(target, opts, selectedTargets, displayOptions)
  return toResumeResult(result)
}

const ocrSourceInput = (
  source: Step1SourceRef
): string => {
  const input = source.filePath ?? source.url
  if (!input) {
    throw CLIUsageError('OCR resume entry is missing a resumable source file or URL.')
  }
  return input
}

const buildResolvedOcrStep = (
  targets: OcrTarget[]
): Extract<ResolvedStep2Execution, { route: 'ocr' }> => ({
  route: 'ocr',
  sourceKind: 'pdf',
  providers: targets.map((target) => ({
    service: target.service,
    model: target.model
  }))
})

export const priceOcrTarget = async (
  target: ResumeTarget,
  opts: RuntimeOptions,
  selectedTargets?: OcrTarget[]
): Promise<AggregatedPriceEstimate> => {
  const manifest = await readProviderResumeTargetManifest(target, readOutputMetadata)
  if (!manifest) {
    throw CLIUsageError(
      target.scope === 'batch'
        ? `Invalid OCR batch manifest at ${target.dir}/batch.json`
        : `Invalid OCR manifest at ${target.dir}/run.json`
    )
  }

  const steps: StepEstimate[] = []
  for (const entry of manifest.entries) {
    const parsed = await parseResumeEntry(entry, selectedTargets)
    if (!parsed || parsed.missingTargets.length === 0) {
      continue
    }
    steps.push(...await buildExtractEstimates(
      ocrSourceInput(parsed.source),
      buildResolvedOcrStep(parsed.missingTargets),
      opts
    ))
  }

  return aggregateExplicitPriceEstimate(steps, opts)
}
