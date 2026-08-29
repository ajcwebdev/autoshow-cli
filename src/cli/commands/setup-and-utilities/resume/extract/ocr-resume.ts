import { partialCompletionError } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-batch-state'
import { isRecord } from '~/utils/rest-client'
import { DocumentMetadataSchema } from '~/types'
import { UsageError } from '~/utils/error-handler'
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
import type { AggregatedPriceEstimate, NormalizedReasoningEffort, OcrExtractionOptions, OcrPoolLedger, OcrProviderMode, OcrResumePassContext, OcrTarget, PipelineItemRecord, PreparedDocument, ProviderCompletionStatus, ProviderResumePassResult, ResolvedStep2Execution, ResumeDisplayOptions, ResumeOcrEntry, ResumeResult, ResumeTarget, Step1SourceRef, WebArticleMetadata } from '~/types'
import { resolveAdditiveResumeProviderSelection } from '../resume-provider-selection'
import { hasResumableProviderTargetWork, priceProviderResumeTarget, providerResumeSourceInput, resolveProviderResumeOutputDir, runProviderResumePass, selectedProviderTargetsComplete, selectedProvidersCompleteResult, toProviderResumeResult, toProviderResumeSource, withProviderResumeOutputDir } from '../provider-batch-resume'
import { buildExtractEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates'
import { isNormalizedReasoningEffort, resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { writeOcrBatchDiagnostics } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-batch-diagnostics'
import { getStep2ActiveModelsForService } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getOcrTargetKey } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import { parseStoredOcrPoolLedger } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-pooled-batch'

const storedOcrProviderMode = (record: Record<string, unknown>): OcrProviderMode =>
  record['ocrProviderMode'] === 'pool' ? 'pool' : 'fanout'

const assertStoredOcrProviderMode = (
  record: Record<string, unknown>,
  opts?: Pick<OcrExtractionOptions, 'ocrProviderMode' | 'ocrProviderModeExplicit'>
): OcrProviderMode => {
  const storedMode = storedOcrProviderMode(record)
  if (opts?.ocrProviderModeExplicit && opts.ocrProviderMode !== storedMode) {
    throw UsageError(`Cannot resume a ${storedMode} OCR run as ${opts.ocrProviderMode}. Resume preserves the OCR provider mode stored in manifest.json.`)
  }
  return storedMode
}

const poolTargetRetired = (ledger: OcrPoolLedger, target: OcrTarget): boolean =>
  ledger.targets.find((candidate) => candidate.targetKey === getOcrTargetKey(target))?.status === 'retired'

const pageAttemptedByTarget = (
  page: OcrPoolLedger['pages'][number],
  target: OcrTarget
): boolean => page.attempts.some((attempt) =>
  attempt.status !== 'interrupted'
  && attempt.status !== 'running'
  && attempt.provider === target.service
  && attempt.model === target.model
)

const uniqueTargets = (targets: readonly OcrTarget[]): OcrTarget[] => {
  const seen = new Set<string>()
  return targets.filter((target) => {
    const key = getOcrTargetKey(target)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const storedPoolRequestedReasoningEffort = (
  ledger: OcrPoolLedger
): NormalizedReasoningEffort | undefined => {
  const efforts = new Set(ledger.pages.flatMap((page) => page.attempts.flatMap((attempt) =>
    isNormalizedReasoningEffort(attempt.requestedReasoningEffort)
      ? [attempt.requestedReasoningEffort]
      : []
  )))
  if (efforts.size > 1) {
    throw UsageError(`Canonical pooled OCR manifest records conflicting requested reasoning policies: ${[...efforts].sort().join(', ')}.`)
  }
  return [...efforts][0]
}

const resolvePoolResumeTargets = (params: {
  ledger: OcrPoolLedger
  storedTargets: OcrTarget[]
  selectedTargets: OcrTarget[] | undefined
}): { requestedTargets: OcrTarget[], targetsToRun: OcrTarget[], reenabledTargets: OcrTarget[], unfinishedPageCount: number, onlyBlocked: boolean } => {
  const unfinishedPages = params.ledger.pages.filter((page) => page.status !== 'accepted')
  const selected = uniqueTargets(params.selectedTargets ?? [])
  const selectedKeys = new Set(selected.map(getOcrTargetKey))
  const requestedTargets = uniqueTargets([...params.storedTargets, ...selected])
  const storedEligible = params.storedTargets.filter((target) => !poolTargetRetired(params.ledger, target))
  const candidateTargets = uniqueTargets([...storedEligible, ...selected])
  const targetsToRun = candidateTargets.filter((target) =>
    unfinishedPages.some((page) =>
      selectedKeys.has(getOcrTargetKey(target)) || !pageAttemptedByTarget(page, target)
    )
  )
  return {
    requestedTargets,
    targetsToRun,
    reenabledTargets: selected,
    unfinishedPageCount: unfinishedPages.length,
    onlyBlocked: unfinishedPages.length > 0
      && targetsToRun.length === 0
      && params.storedTargets.some((target) => poolTargetRetired(params.ledger, target))
  }
}

const filterRunnableStoredOcrTargets = (
  targets: readonly OcrTarget[],
  selectedTargets: readonly OcrTarget[] | undefined
): OcrTarget[] => {
  const runnable: OcrTarget[] = []
  for (const target of targets) {
    if (target.service === 'tesseract' && target.model === 'tesseract') {
      runnable.push(target)
      continue
    }
    const activeModels = getStep2ActiveModelsForService('ocr', target.service)
    if (activeModels?.includes(target.model)) {
      runnable.push(target)
      continue
    }

    const replacement = getRetiredModelReplacement('extract', target.service, target.model)
    const selectedReplacement = replacement !== undefined && selectedTargets?.some((selected) =>
      selected.service === target.service && selected.model === replacement
    ) === true
    if (selectedReplacement) {
      continue
    }

    const nextStep = replacement !== undefined
      ? `Re-run with --provider ${target.service}=${replacement} to add the replacement as a distinct target.`
      : activeModels && activeModels.length > 0
        ? `Re-run with an explicit active ${target.service} model to add a distinct target.`
        : 'Re-run with an explicit active OCR provider to add a distinct target.'
    throw UsageError(
      `Stored OCR target ${target.service}/${target.model} is incomplete, but that model is no longer in the active registry. AutoShow will not substitute a different model because that would change the stored target identity. ${nextStep}`
    )
  }
  return runnable
}

const assertSelectedOcrReasoningCompatibility = (
  record: Record<string, unknown>,
  selectedTargets: OcrTarget[] | undefined,
  requestedReasoningEffort: NormalizedReasoningEffort | undefined,
  ocrProviderMode: OcrProviderMode,
  poolLedger?: OcrPoolLedger | undefined
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
    const policy = resolveReasoningPolicy({
      step: 'extract',
      service: target.service,
      model: target.model,
      requestedReasoningEffort
    })
    if (ocrProviderMode === 'pool') {
      const storedEffectivePolicies = new Set(poolLedger?.pages.flatMap((page) => [
        ...page.attempts.flatMap((attempt) =>
          attempt.provider === target.service
          && attempt.model === target.model
          && typeof attempt.effectiveReasoningEffort === 'string'
            ? [attempt.effectiveReasoningEffort]
            : []
        ),
        ...(page.accepted?.provider === target.service
        && page.accepted.model === target.model
        && typeof page.accepted.effectiveReasoningEffort === 'string'
          ? [page.accepted.effectiveReasoningEffort]
          : [])
      ]) ?? [])
      if ([...storedEffectivePolicies].some((stored) => stored !== policy.effective)) {
        throw UsageError(
          `OCR resume reasoning policy mismatch for ${target.service}/${target.model}: the pooled page ledger records ${[...storedEffectivePolicies].sort().join(', ')}, but the current request resolves to ${policy.effective}.`
        )
      }
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
    const metadata = isRecord(state['metadata']) ? state['metadata'] : undefined
    const storedEffective = metadata?.['effectiveReasoningEffort']
    if (storedEffective !== policy.effective) {
      throw UsageError(
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
    throw UsageError('Pipeline item record is missing source information and cannot be resumed.')
  }

  return toProviderResumeSource(url)
}

const parseResumeRecord = async (
  record: unknown,
  selectedTargets: OcrTarget[] | undefined,
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined,
  resumeOptions?: Pick<OcrExtractionOptions, 'ocrProviderMode' | 'ocrProviderModeExplicit'>
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

  const ocrProviderMode = assertStoredOcrProviderMode(record, resumeOptions)
  const poolLedger = ocrProviderMode === 'pool'
    ? parseStoredOcrPoolLedger(record['ocrPool'])
    : undefined
  if (ocrProviderMode === 'pool' && !poolLedger) {
    throw UsageError('Canonical pooled OCR manifest is missing a valid ocrPool page ledger.')
  }
  assertSelectedOcrReasoningCompatibility(
    record,
    ocrProviderMode === 'pool' ? uniqueTargets([...storedRequestedTargets, ...(selectedTargets ?? [])]) : selectedTargets,
    requestedReasoningEffort,
    ocrProviderMode,
    poolLedger
  )

  const source = toStoredSource(record)
  if (ocrProviderMode === 'pool') {
    const ledger = poolLedger as OcrPoolLedger
    const poolTargets = resolvePoolResumeTargets({
      ledger,
      storedTargets: storedRequestedTargets,
      selectedTargets
    })
    const runnableStored = filterRunnableStoredOcrTargets(poolTargets.targetsToRun, selectedTargets)
    const storedReasoningEffort = storedPoolRequestedReasoningEffort(ledger)
    return {
      outputDir,
      source,
      requestedTargets: poolTargets.requestedTargets,
      missingTargets: runnableStored,
      completionStatus: ledger.status === 'full' ? 'full' : 'incomplete',
      rawRecord: record,
      onlyBlockedMissingTargets: poolTargets.onlyBlocked,
      ocrProviderMode: 'pool',
      unfinishedPageCount: poolTargets.unfinishedPageCount,
      reenabledTargets: poolTargets.reenabledTargets,
      ...(storedReasoningEffort ? { storedReasoningEffort } : {})
    }
  }

  const storedMissingTargets = filterRunnableStoredOcrTargets(
    buildMissingTargetsFromEntry(record, storedRequestedTargets, {
      includeBlocked: selectedTargets !== undefined
    }),
    selectedTargets
  )
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
    ocrProviderMode: 'fanout',
    onlyBlockedMissingTargets: selectedTargets === undefined
      && hasOnlyBlockedMissingTargetsFromEntry(record, storedRequestedTargets)
  }
}

const readItemRecord = async (outputDir: string): Promise<PipelineItemRecord> => {
  const record = await readSinglePipelineItemRecord(outputDir, { command: 'extract', extractRoute: 'document' })
  if (!isRecord(record)) {
    throw UsageError(`Invalid OCR manifest at ${outputDir}/${PIPELINE_MANIFEST_FILE}`)
  }
  return record
}

const readPreparedDocument = async (outputDir: string): Promise<PreparedDocument> => {
  const record = await readItemRecord(outputDir)
  if (!isRecord(record['step1'])) {
    throw UsageError(`Invalid OCR manifest at ${outputDir}/${PIPELINE_MANIFEST_FILE}`)
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
  outputDir: string,
  entry: ResumeOcrEntry
) => {
  const step2SelectionOrigins = opts.step2SelectionOrigins
    ? Object.fromEntries(
        Object.entries(opts.step2SelectionOrigins).filter(([, value]) => value !== undefined)
      ) as Record<string, 'default' | 'explicit' | 'all-shortcut'>
    : undefined
  const reasoningEffort = opts.reasoningEffort ?? entry.storedReasoningEffort

  return {
    filePath: '',
    outputDir,
    dpi: opts.dpi,
    languages: opts.lang,
    outputFormat: opts.out,
    password: opts.password,
    ocrConcurrency: opts.ocrConcurrency,
    ocrConcurrencyMode: opts.ocrConcurrencyMode,
    ocrProviderMode: entry.ocrProviderMode,
    ocrProviderModeExplicit: opts.ocrProviderModeExplicit,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    chapterFiles: opts.chapterFiles,
    chapterChunkLimitChars: opts.chapterChunkLimitChars,
    pdfChapterMode: opts.pdfChapterMode,
    configPath: opts.configPath,
    ...(step2SelectionOrigins ? { step2SelectionOrigins } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {})
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
      parseRecord: async (record) => await parseResumeRecord(record, selectedTargets, opts.reasoningEffort, opts),
      getProviderLabels: (targets) => targets.map((runTarget) => `${runTarget.service}/${runTarget.model}`),
      normalizeAlreadyFullRecord: markItemRecordFull,
      classifyNoMatchingRecord: (record) =>
        storedOcrProviderMode(record) === 'fanout' && selectedOcrTargetsComplete(record, selectedTargets)
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
          throw UsageError('OCR resume entry is missing a resumable file path.')
        }

        try {
          await processOcr(
            resumeFilePath,
            buildResumeExtractionOpts(opts, entry.outputDir, entry),
            entry.source,
            preparedDocument,
            undefined,
            {
              outputDir: entry.outputDir,
              requestedTargets: entry.requestedTargets,
              targetsToRun: entry.missingTargets,
              ocrProviderMode: entry.ocrProviderMode,
              reenabledTargets: entry.reenabledTargets
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
          opts.reasoningEffort,
          opts
        )
        const hasRemainingResumableWork = (remainingResumableEntry?.missingTargets.length ?? 0) > 0
        const completionStatus = getOcrCompletionStatus(record)
        if (entry.ocrProviderMode === 'fanout' && selectedTargets !== undefined && !hasRemainingResumableWork && completionStatus !== 'full') {
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
    throw partialCompletionError(`OCR resume still has ${resumableStatus.resumableIncomplete} incomplete and ${resumableStatus.resumableFailed} failed item(s) with resumable providers`, {
      stage: 'resume:ocr',
      metadata: { incomplete: resumableStatus.resumableIncomplete, failed: resumableStatus.resumableFailed }
    })
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
    parseRecord: (record) => parseResumeRecord(record, selectedTargets, opts.reasoningEffort, opts),
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
          reasoningEffort: estimateOpts.reasoningEffort,
          ocrProviderMode: entry.ocrProviderMode,
          ...(entry.ocrProviderMode === 'pool' ? { poolPageCount: entry.unfinishedPageCount ?? 0 } : {})
        }
      )
  })
}
