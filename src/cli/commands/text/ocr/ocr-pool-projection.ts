import type { ExtractionMetadata, ExtractionResult, OcrBatchRunContext, OcrPoolAttemptUsage, OcrPoolLedger, OcrPoolTargetState, OcrProviderFailureSummary, ProcessDocumentOutput } from '~/types'
import { ExtractionMetadataSchema } from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { extractErrorMetadata } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { validateData } from '~/utils/validate/validation'
import { buildOcrOutput } from './ocr-result'
import { toRequestedProvider } from './ocr-run-state'
import { getOcrTargetDirectoryName } from './ocr-targets'

export const usageFromMetadata = (metadata: ExtractionMetadata): OcrPoolAttemptUsage => ({
  ...(typeof metadata.requestedReasoningEffort === 'string' ? { requestedReasoningEffort: metadata.requestedReasoningEffort } : {}),
  ...(typeof metadata.effectiveReasoningEffort === 'string' ? { effectiveReasoningEffort: metadata.effectiveReasoningEffort } : {}),
  ...(typeof metadata.promptTokens === 'number' ? { promptTokens: metadata.promptTokens } : {}),
  ...(typeof metadata.completionTokens === 'number' ? { completionTokens: metadata.completionTokens } : {}),
  ...(typeof metadata.providerCostCents === 'number' ? { providerCostCents: metadata.providerCostCents } : {}),
  ...(typeof metadata.providerCostSource === 'string' ? { providerCostSource: metadata.providerCostSource } : {}),
  ...(metadata.ocrProviderUsage ? { providerUsage: metadata.ocrProviderUsage } : {})
})

const numberFromRecord = (value: Record<string, unknown>, key: string): number | undefined =>
  typeof value[key] === 'number' && Number.isFinite(value[key]) ? value[key] as number : undefined

export const usageFromError = (error: unknown): OcrPoolAttemptUsage => {
  const metadata = extractErrorMetadata(error)
  const usage = isRecord(metadata['usage']) ? metadata['usage'] : metadata
  const providerUsage = Array.isArray(metadata['providerUsage'])
    ? metadata['providerUsage'].filter(isRecord)
    : undefined
  return {
    ...(numberFromRecord(usage, 'promptTokens') !== undefined ? { promptTokens: numberFromRecord(usage, 'promptTokens') } : {}),
    ...(numberFromRecord(usage, 'completionTokens') !== undefined ? { completionTokens: numberFromRecord(usage, 'completionTokens') } : {}),
    ...(numberFromRecord(usage, 'providerCostCents') !== undefined ? { providerCostCents: numberFromRecord(usage, 'providerCostCents') } : {}),
    ...(typeof usage['providerCostSource'] === 'string' ? { providerCostSource: usage['providerCostSource'] } : {}),
    ...(providerUsage && providerUsage.length > 0 ? { providerUsage } : {})
  }
}

const aggregateTargetUsage = (ledger: OcrPoolLedger): Array<Record<string, unknown>> =>
  ledger.targets.map((target) => {
    const attempts = ledger.pages.flatMap((page) => page.attempts.filter((attempt) =>
      attempt.provider === target.service && attempt.model === target.model && attempt.status !== 'running'
    ))
    const providerUsage = attempts.flatMap((attempt) => attempt.providerUsage ?? [])
    const promptTokens = attempts.reduce((sum, attempt) => sum + (attempt.promptTokens ?? 0), 0)
    const completionTokens = attempts.reduce((sum, attempt) => sum + (attempt.completionTokens ?? 0), 0)
    const providerCostCents = attempts.reduce((sum, attempt) => sum + (attempt.providerCostCents ?? 0), 0)
    const hasProviderCost = attempts.some((attempt) => typeof attempt.providerCostCents === 'number')
    const providerCostSources = [...new Set(attempts.flatMap((attempt) =>
      typeof attempt.providerCostSource === 'string' ? [attempt.providerCostSource] : []
    ))]
    const acceptedPages = ledger.pages.filter((page) =>
      page.accepted?.provider === target.service && page.accepted.model === target.model
    ).length
    const effectivePolicies = [...new Set(attempts.flatMap((attempt) =>
      typeof attempt.effectiveReasoningEffort === 'string' ? [attempt.effectiveReasoningEffort] : []
    ))]
    return {
      provider: target.service,
      model: target.model,
      attemptedPages: attempts.length,
      acceptedPages,
      failedOrAmbiguousAttempts: attempts.filter((attempt) => attempt.status !== 'accepted').length,
      promptTokens,
      completionTokens,
      ...(hasProviderCost ? { providerCostCents } : {}),
      ...(providerCostSources.length === 1 ? { providerCostSource: providerCostSources[0] } : {}),
      ...(providerUsage.length > 0 ? { providerUsage } : {}),
      ...(effectivePolicies.length === 1 ? { effectiveReasoningEffort: effectivePolicies[0] } : {}),
      ocrMode: 'pool'
    }
  })

export const buildCompositeOutput = (
  ctx: OcrBatchRunContext,
  ledger: OcrPoolLedger,
  startedAtMs: number
): { result: ExtractionResult, metadata: ExtractionMetadata } => {
  const pages = ledger.pages
    .flatMap((page) => page.accepted ? [{ ...page.accepted.result, pageNumber: page.pageNumber }] : [])
    .sort((left, right) => left.pageNumber - right.pageNumber)
  const attempts = ledger.pages.flatMap((page) => page.attempts.filter((attempt) => attempt.status !== 'running'))
  const promptTokens = attempts.reduce((sum, attempt) => sum + (attempt.promptTokens ?? 0), 0)
  const completionTokens = attempts.reduce((sum, attempt) => sum + (attempt.completionTokens ?? 0), 0)
  const providerCostCents = attempts.reduce((sum, attempt) => sum + (attempt.providerCostCents ?? 0), 0)
  const hasProviderCost = attempts.some((attempt) => typeof attempt.providerCostCents === 'number')
  const providerUsage = attempts.flatMap((attempt) => (attempt.providerUsage ?? []).map((entry) => ({
    providerMode: 'pool',
    pageNumber: ledger.pages.find((page) => page.attempts.includes(attempt))?.pageNumber,
    attempt: attempt.attempt,
    accepted: attempt.status === 'accepted',
    provider: attempt.provider,
    model: attempt.model,
    ...entry
  })))
  const built = buildOcrOutput({
    start: startedAtMs,
    pages,
    extractionMethod: 'ocr-pool',
    step1Metadata: ctx.step1Metadata,
    opts: ctx.effectiveOpts,
    inputFamily: ctx.step1Metadata.format === 'pdf' ? 'pdf' : ctx.step1Metadata.format === 'cbz' ? 'cbz' : 'image',
    normalizedFrom: undefined,
    conversionChain: undefined,
    outputFidelity: 'composite-page-text',
    canonicalText: undefined,
    reportedTotalPages: ledger.totalPages,
    ocrService: undefined,
    promptTokens: attempts.length > 0 ? promptTokens : undefined,
    completionTokens: attempts.length > 0 ? completionTokens : undefined,
    providerCostCents: hasProviderCost ? providerCostCents : undefined,
    providerCostSource: hasProviderCost ? 'provider_usage' : undefined,
    ocrProviderUsage: providerUsage.length > 0 ? providerUsage : undefined,
    pdfChunkPreparation: undefined,
    chapterExportSummary: undefined,
    pdfChapterDetectionSummary: undefined,
    artifactFiles: undefined
  })
  return {
    result: built.result,
    metadata: validateData(ExtractionMetadataSchema, {
      ...built.step2Metadata,
      ocrProviderMode: 'pool',
      ocrPoolTargetUsage: aggregateTargetUsage(ledger)
    }, 'pooled OCR extraction metadata')
  }
}

export const targetProviderStates = (
  ledger: OcrPoolLedger
): Array<Record<string, unknown>> => ledger.targets.map((target) => ({
  service: target.service,
  model: target.model,
  artifactDir: `providers/${getOcrTargetDirectoryName(target)}`,
  status: target.status === 'retired'
    ? 'failed'
    : ledger.status === 'running' ? 'running' : 'succeeded',
  attempts: target.attempts,
  metadata: {},
  ...(target.lastFailure ? { error: target.lastFailure } : {})
}))

const targetFailure = (target: OcrPoolTargetState): OcrProviderFailureSummary | undefined => {
  if (target.status !== 'retired' || !target.lastFailure) return undefined
  const failure = target.lastFailure
  return {
    message: typeof failure['message'] === 'string' ? failure['message'] : `${target.service}/${target.model} retired from the OCR pool`,
    category: typeof failure['category'] === 'string' ? failure['category'] as OcrProviderFailureSummary['category'] : 'unknown',
    failureKind: typeof failure['failureKind'] === 'string' ? failure['failureKind'] as OcrProviderFailureSummary['failureKind'] : 'unknown',
    retryable: failure['retryable'] === true,
    ...(failure['quota'] === true ? { quota: true } : {}),
    ...(failure['providerWide'] === true ? { providerWide: true } : {}),
    ...(typeof failure['blockedReason'] === 'string' ? { blockedReason: failure['blockedReason'] } : {}),
    ...(typeof failure['attemptsMade'] === 'number' ? { attemptsMade: failure['attemptsMade'] } : {}),
    ...(typeof failure['elapsedMs'] === 'number' ? { elapsedMs: failure['elapsedMs'] } : {}),
    ...(typeof failure['errorFile'] === 'string' ? { errorFile: failure['errorFile'] } : {})
  }
}

export const projectPooledOcrResult = (
  ctx: OcrBatchRunContext,
  ledger: OcrPoolLedger,
  startedAtMs: number
): ProcessDocumentOutput => {
  const composite = buildCompositeOutput(ctx, ledger, startedAtMs)
  const failures: NonNullable<ProcessDocumentOutput['step2Errors']> = ledger.targets.flatMap(target => {
    const failure = targetFailure(target)
    return failure ? [{
      service: target.service,
      model: target.model,
      message: failure.message,
      category: failure.category,
      failureKind: failure.failureKind,
      retryable: failure.retryable,
      ...(failure.quota === true ? { quota: true } : {}),
      ...(failure.providerWide === true ? { providerWide: true } : {}),
      ...(failure.blockedReason ? { blockedReason: failure.blockedReason } : {}),
      ...(typeof failure.attemptsMade === 'number' ? { attemptsMade: failure.attemptsMade } : {}),
      ...(failure.errorFile ? { errorFile: failure.errorFile } : {}),
    }] : []
  })
  l.write(ledger.status === 'full' ? 'info' : 'warn', `Pooled OCR ${ledger.status}: ${ledger.telemetry.acceptedPages}/${ledger.totalPages} pages accepted`, {
    category: 'pipeline',
    metadata: { status: ledger.status, acceptedPages: ledger.telemetry.acceptedPages, totalPages: ledger.totalPages },
  })
  return {
    result: composite.result,
    step1Metadata: ctx.step1Metadata,
    step2Metadata: composite.metadata,
    completionStatus: ledger.status === 'full' ? 'full' : 'incomplete',
    requestedProviders: ctx.requestedTargets.map(toRequestedProvider),
    providerStates: targetProviderStates(ledger),
    missingProviders: [],
    blockedProviders: ledger.targets.filter(target => target.status === 'retired').map(target => toRequestedProvider(target)),
    ocrProviderMode: 'pool',
    ocrPool: ledger,
    ...(ctx.web ? { web: ctx.web } : {}),
    ...(failures.length > 0 ? { step2Errors: failures } : {}),
    outputDir: ctx.outputDir,
  }
}
