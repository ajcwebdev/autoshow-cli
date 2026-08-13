import { isRecord } from '~/utils/rest-client'
import { DocumentMetadataSchema } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { validateData } from '~/utils/validate/validation'
import { processOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { downloadDocumentUrlToTempFile } from '~/cli/commands/process-steps/step-1-download/document/resolve-document-source'
import {
  buildMissingTargetsFromEntry,
  hasOnlyBlockedMissingTargetsFromEntry,
  resolveCanonicalCompletionStatus,
  parseStoredRequestedTargets
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import { PIPELINE_MANIFEST_FILE, readSinglePipelineItemRecord } from '~/cli/commands/process-steps/pipeline-manifest'
import type { AggregatedPriceEstimate, OcrExtractionOptions, OcrResumePassContext, OcrTarget, PipelineItemRecord, PreparedDocument, ProviderCompletionStatus, ProviderResumePassResult, ResolvedStep2Execution, ResumeDisplayOptions, ResumeOcrEntry, ResumeResult, ResumeTarget, Step1SourceRef, WebArticleMetadata } from '~/types'
import { resolveAdditiveResumeProviderSelection } from '../resume-provider-selection'
import { hasResumableProviderTargetWork, priceProviderResumeTarget, providerResumeSourceInput, resolveProviderResumeOutputDir, runProviderResumePass, selectedProviderTargetsComplete, selectedProvidersCompleteResult, toProviderResumeResult, toProviderResumeSource, withProviderResumeOutputDir } from '../provider-batch-resume'
import { buildExtractEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates'
import { resolveReasoningPolicy, type NormalizedReasoningEffort } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { writeOcrBatchDiagnostics } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-batch-diagnostics'

const assertSelectedOcrReasoningCompatibility = (
  record: Record<string, unknown>,
  selectedTargets: OcrTarget[] | undefined,
  requestedReasoningEffort: NormalizedReasoningEffort | undefined
): void => {
  if (selectedTargets === undefined || requestedReasoningEffort === undefined) {
    return
  }

  const providerStates = Array.isArray(record['providerStates'])
    ? record['providerStates'].filter(isRecord)
    : []
  for (const target of selectedTargets) {
    if (target.service === 'tesseract') {
      continue
    }
    const state = providerStates.find((candidate) =>
      candidate['service'] === target.service
      && candidate['model'] === target.model
      && candidate['status'] === 'succeeded'
    )
    if (!state) {
      continue
    }

    const policy = resolveReasoningPolicy({
      step: 'extract',
      service: target.service,
      model: target.model,
      requestedReasoningEffort
    })
    const metadata = isRecord(state['metadata']) ? state['metadata'] : undefined
    const storedEffective = metadata?.['effectiveReasoningEffort']
    if (storedEffective !== policy.effective) {
      throw CLIUsageError(
        `OCR resume reasoning policy mismatch for ${target.service}/${target.model}: manifest effective effort is ${typeof storedEffective === 'string' ? storedEffective : 'unrecorded'}, but the current request resolves to ${policy.effective}.`
      )
    }
  }
}

const toStoredSource = (record: PipelineItemRecord): Step1SourceRef => {
  const source = isRecord(record['source']) ? record['source'] : undefined
  const filePath = typeof source?.['filePath'] === 'string'
    ? source['filePath']
    : undefined
  const url = typeof source?.['url'] === 'string'
    ? source['url']
    : undefined

  if (filePath) {
    return { filePath }
  }

  if (!url) {
    throw CLIUsageError('Pipeline item record is missing source information and cannot be resumed.')
  }

  return toProviderResumeSource(url)
}

const parseResumeRecord = async (
  record: unknown,
  selectedTargets: OcrTarget[] | undefined,
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
): Promise<ResumeOcrEntry | undefined> => {
  if (!isRecord(record)) {
    return undefined
  }

  const outputDir = resolveProviderResumeOutputDir(record)
  if (!outputDir) {
    return undefined
  }

  const storedRequestedTargets = parseStoredRequestedTargets(record)
  if (storedRequestedTargets.length === 0 && (!selectedTargets || selectedTargets.length === 0)) {
    return undefined
  }

  assertSelectedOcrReasoningCompatibility(record, selectedTargets, requestedReasoningEffort)

  const source = toStoredSource(record)
  const storedMissingTargets = buildMissingTargetsFromEntry(record, storedRequestedTargets, {
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
    completionStatus: resolveCanonicalCompletionStatus(record, requestedTargets),
    rawRecord: record,
    onlyBlockedMissingTargets: selectedTargets === undefined
      && hasOnlyBlockedMissingTargetsFromEntry(record, storedRequestedTargets)
  }
}

const readItemRecord = async (outputDir: string): Promise<PipelineItemRecord> => {
  const record = await readSinglePipelineItemRecord(outputDir, { command: 'extract', extractRoute: 'document' })
  if (!isRecord(record)) {
    throw CLIUsageError(`Invalid OCR manifest at ${outputDir}/${PIPELINE_MANIFEST_FILE}`)
  }
  return record
}

const readPreparedDocument = async (outputDir: string): Promise<PreparedDocument> => {
  const record = await readItemRecord(outputDir)
  if (!isRecord(record['step1'])) {
    throw CLIUsageError(`Invalid OCR manifest at ${outputDir}/${PIPELINE_MANIFEST_FILE}`)
  }

  const step1Metadata = validateData(DocumentMetadataSchema, record['step1'], 'stored OCR step1 metadata')
  const web = isRecord(record['web']) ? record['web'] as WebArticleMetadata : undefined

  return {
    outputDir,
    step1Metadata,
    ...(web ? { web } : {})
  }
}

const markItemRecordFull = (
  record: PipelineItemRecord
): PipelineItemRecord => ({
  ...record,
  completionStatus: 'full',
  missingProviders: [],
  blockedProviders: []
})

const selectedOcrTargetsComplete = (
  record: PipelineItemRecord,
  selectedTargets: OcrTarget[] | undefined
): boolean => selectedProviderTargetsComplete(
  record,
  selectedTargets,
  parseStoredRequestedTargets,
  (entry, targets) => buildMissingTargetsFromEntry(entry, targets, { includeBlocked: true })
)

export const hasResumableOcrTargetWork = async (
  target: ResumeTarget,
  selectedTargets: OcrTarget[] | undefined
): Promise<boolean> =>
  await hasResumableProviderTargetWork(target, {
    readItemRecord,
    parseRecord: async (record) => await parseResumeRecord(record, selectedTargets)
  })

const buildResumeExtractionOpts = (
  opts: OcrExtractionOptions,
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
    ...(step2SelectionOrigins ? { step2SelectionOrigins } : {}),
    ...(opts.reasoningEffort ? { reasoningEffort: opts.reasoningEffort } : {})
  }
}

const getOcrCompletionStatus = (
  record: PipelineItemRecord
): ProviderCompletionStatus => {
  if (record['completionStatus'] === 'failed' || record['completionStatus'] === 'full') {
    return record['completionStatus']
  }
  return 'incomplete'
}

const runResumeOcrTarget = async (
  target: ResumeTarget,
  opts: OcrExtractionOptions,
  selectedTargets?: OcrTarget[],
  displayOptions: ResumeDisplayOptions = {}
): Promise<ProviderResumePassResult> => {
  const resumableStatus: OcrResumePassContext = {
    resumableIncomplete: 0,
    resumableFailed: 0
  }

  const result = await runProviderResumePass<OcrTarget, ResumeOcrEntry, OcrResumePassContext, OcrExtractionOptions>(
    target,
    opts,
    {
      stepLabel: 'OCR',
      readItemRecord,
      parseRecord: async (record) => await parseResumeRecord(record, selectedTargets, opts.reasoningEffort),
      getProviderLabels: (targets) => targets.map((runTarget) => `${runTarget.service}/${runTarget.model}`),
      normalizeAlreadyFullRecord: markItemRecordFull,
      classifyNoMatchingRecord: (record) =>
        selectedOcrTargetsComplete(record, selectedTargets)
          ? 'full'
          : getOcrCompletionStatus(record),
      createPassContext: () => resumableStatus,
      formatNoMatchingDetail: ({ entry }) =>
        selectedTargets !== undefined && entry.completionStatus !== 'full'
          ? 'selected providers complete; canonical item still incomplete'
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

        const record = await readItemRecord(entry.outputDir)
        const remainingResumableEntry = await parseResumeRecord(
          withProviderResumeOutputDir(record, entry.outputDir),
          selectedTargets,
          opts.reasoningEffort
        )
        const hasRemainingResumableWork = (remainingResumableEntry?.missingTargets.length ?? 0) > 0
        const completionStatus = getOcrCompletionStatus(record)
        if (selectedTargets !== undefined && !hasRemainingResumableWork && completionStatus !== 'full') {
          return {
            ...selectedProvidersCompleteResult(entry.outputDir, record),
            hasRemainingResumableWork
          }
        }
        return {
          outputDir: entry.outputDir,
          record,
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

  if (target.scope === 'batch') {
    await writeOcrBatchDiagnostics(target.dir)
  }

  if (resumableStatus.resumableIncomplete > 0 || resumableStatus.resumableFailed > 0) {
    throw InfraError(`OCR resume still has ${resumableStatus.resumableIncomplete} incomplete and ${resumableStatus.resumableFailed} failed item(s) with resumable providers`, { stage: 'resume:ocr', exitCode: 2 })
  }
  return result
}

export const resumeOcrTarget = async (
  target: ResumeTarget,
  opts: OcrExtractionOptions,
  selectedTargets?: OcrTarget[],
  displayOptions: ResumeDisplayOptions = {}
): Promise<ResumeResult> => {
  const result = await runResumeOcrTarget(target, opts, selectedTargets, displayOptions)
  return toProviderResumeResult(result)
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
  opts: OcrExtractionOptions,
  selectedTargets?: OcrTarget[]
): Promise<AggregatedPriceEstimate> => {
  return await priceProviderResumeTarget<OcrTarget, ResumeOcrEntry, OcrExtractionOptions>(target, opts, {
    stepLabel: 'OCR',
    readItemRecord,
    parseRecord: (record) => parseResumeRecord(record, selectedTargets, opts.reasoningEffort),
    getAggregateTimingOptions: (options) => ({
      ocrConcurrency: options.ocrConcurrency,
      ocrConcurrencyMode: options.ocrConcurrencyMode,
      ocrProviderConcurrency: options.ocrProviderConcurrency,
      ocrLocalConcurrency: options.ocrLocalConcurrency
    }),
    buildEstimates: (entry, estimateOpts) =>
      buildExtractEstimates(
        providerResumeSourceInput(entry.source, 'OCR'),
        buildResolvedOcrStep(entry.missingTargets),
        {
          hostedOcrTokenProfilePath: estimateOpts.hostedOcrTokenProfilePath,
          reasoningEffort: estimateOpts.reasoningEffort
        }
      )
  })
}
