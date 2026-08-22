import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { statPath as stat } from '~/utils/bun-file-io'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join } from 'node:path'
import type { DocumentMetadata, ExtractionMetadata, ExtractionOptions, ExtractionResult, OcrBatchRunContext, OcrPoolAttemptUsage, OcrPoolLedger, OcrPoolTargetState, OcrProviderFailureSummary, OcrTarget, ProcessDocumentOutput, RunOcrPagePoolOptions } from '~/types'
import { ExtractionMetadataSchema } from '~/types'
import { l, runWithLogContext } from '~/utils/app-logger/app-logger'
import { CLIUsageError, extractErrorMetadata, serializeDiagnosticError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { validateData } from '~/utils/validate/validation'
import { writeFile } from '~/utils/cli-utils'
import { writePipelineItemRecords } from '../../pipeline-manifest'
import { buildDocumentMetadataPayload, resolveRecordedOcrStep2 } from './ocr-document-metadata'
import { writeExtractionArtifact, writeProviderArtifacts } from './ocr-artifacts'
import { buildOcrOutput } from './ocr-result'
import { classifyOcrProviderFailure, getOcrTargetKey, toRequestedProvider } from './ocr-run-state'
import { buildExtractionOptionsForTarget, getOcrTargetDirectoryName } from './ocr-targets'
import { defaultOcrPoolLaneKey, isLocalOcrTarget, runOcrPagePool } from './ocr-provider-pool'
import { runOcr } from './run-ocr'
import { createOcrPdfChunkWithLocalFallback } from './ocr-utils/pdf-chunk-fallback'
import { resolveHostedDirectImageInputStrategy } from './hosted-ocr'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { writeOcrProviderError } from './ocr-structured-response-error'
import { extractCbzImages } from './image/image-ocr'

const POOL_IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])
const OCR_POOL_SERVICES = new Set<OcrTarget['service']>(['tesseract', 'mistral', 'glm', 'kimi', 'openai', 'grok', 'anthropic', 'gemini', 'deepinfra'])

const isOcrPoolService = (value: unknown): value is OcrTarget['service'] =>
  typeof value === 'string' && OCR_POOL_SERVICES.has(value as OcrTarget['service'])

const toHostedEngine = (target: OcrTarget): Exclude<import('~/types').HostedExtractOcrEngine, never> =>
  `${target.service}-ocr` as import('~/types').HostedExtractOcrEngine

export const assertOcrPoolCompatible = (
  ctx: {
    step1Metadata: Pick<DocumentMetadata, 'format'>
    opts: Pick<ExtractionOptions, 'primaryOcr'>
    requestedTargets: OcrTarget[]
  }
): void => {
  if (ctx.opts.primaryOcr) {
    throw CLIUsageError('--primary-ocr cannot be used with --ocr-provider-mode pool because the top-level extraction is the composite pooled result.')
  }
  const format = ctx.step1Metadata.format
  if (format !== 'pdf' && format !== 'cbz' && !POOL_IMAGE_FORMATS.has(format)) {
    throw CLIUsageError(`--ocr-provider-mode pool requires a PDF or supported image input that can be normalized into independent page work units; received ${format}.`)
  }
  if (ctx.requestedTargets.length === 0) {
    throw CLIUsageError('--ocr-provider-mode pool requires at least one selected OCR target.')
  }
  if (format !== 'pdf') {
    for (const target of ctx.requestedTargets) {
      if (isLocalOcrTarget(target)) continue
      if (resolveHostedDirectImageInputStrategy(format, toHostedEngine(target)) === 'unsupported') {
        throw CLIUsageError(`${target.service}/${target.model} cannot normalize ${format.toUpperCase()} into a compatible pooled page work unit.`)
      }
    }
  }
}

const attemptRelativeDir = (pageNumber: number, target: OcrTarget, attempt: number): string =>
  `providers/${getOcrTargetDirectoryName(target)}/attempts/page-${String(pageNumber).padStart(6, '0')}/attempt-${String(attempt).padStart(3, '0')}`

export const getOcrPoolAttemptRelativeDir = attemptRelativeDir

const usageFromMetadata = (metadata: ExtractionMetadata): OcrPoolAttemptUsage => ({
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

const usageFromError = (error: unknown): OcrPoolAttemptUsage => {
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

const finiteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const nonNegativeNumber = (value: unknown): value is number =>
  finiteNumber(value) && value >= 0

const containedArtifactDir = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length > 0
  && !isAbsolute(value)
  && !value.split(/[\\/]/u).some((segment) => segment === '..')

const validStoredAttempt = (value: unknown): boolean =>
  isRecord(value)
  && Number.isInteger(value['attempt'])
  && nonNegativeNumber(value['attempt'])
  && typeof value['claimId'] === 'string'
  && isOcrPoolService(value['provider'])
  && typeof value['model'] === 'string'
  && typeof value['laneKey'] === 'string'
  && ['running', 'accepted', 'failed', 'ambiguous', 'interrupted'].includes(String(value['status']))
  && nonNegativeNumber(value['startedAtMs'])
  && containedArtifactDir(value['artifactDir'])

const validStoredAcceptedPage = (value: unknown): boolean =>
  isRecord(value)
  && isOcrPoolService(value['provider'])
  && typeof value['model'] === 'string'
  && Number.isInteger(value['attempt'])
  && nonNegativeNumber(value['attempt'])
  && nonNegativeNumber(value['acceptedAtMs'])
  && nonNegativeNumber(value['durationMs'])
  && containedArtifactDir(value['artifactDir'])
  && isRecord(value['result'])
  && Number.isInteger(value['result']['pageNumber'])
  && ['text', 'ocr', 'skipped'].includes(String(value['result']['method']))
  && typeof value['result']['text'] === 'string'

const validStoredPage = (value: unknown): boolean => {
  if (!isRecord(value) || !Number.isInteger(value['pageNumber']) || !nonNegativeNumber(value['pageNumber']) || !Array.isArray(value['attempts']) || !value['attempts'].every(validStoredAttempt)) return false
  const status = value['status']
  if (!['pending', 'claimed', 'accepted', 'exhausted'].includes(String(status))) return false
  if (status === 'accepted') return validStoredAcceptedPage(value['accepted'])
  if (value['accepted'] !== undefined) return false
  if (status !== 'claimed') return value['claim'] === undefined
  const claim = value['claim']
  return isRecord(claim)
    && typeof claim['claimId'] === 'string'
    && typeof claim['targetKey'] === 'string'
    && typeof claim['laneKey'] === 'string'
    && Number.isInteger(claim['attempt'])
    && nonNegativeNumber(claim['claimedAtMs'])
}

const validStoredTarget = (value: unknown): boolean =>
  isRecord(value)
  && isOcrPoolService(value['service'])
  && typeof value['model'] === 'string'
  && typeof value['targetKey'] === 'string'
  && typeof value['laneKey'] === 'string'
  && typeof value['local'] === 'boolean'
  && ['eligible', 'running', 'succeeded', 'retired'].includes(String(value['status']))
  && nonNegativeNumber(value['attempts'])
  && nonNegativeNumber(value['acceptedPages'])
  && nonNegativeNumber(value['active'])
  && nonNegativeNumber(value['activePeak'])

const validStoredLane = (value: unknown): boolean =>
  isRecord(value)
  && typeof value['laneKey'] === 'string'
  && isOcrPoolService(value['service'])
  && typeof value['local'] === 'boolean'
  && Number.isInteger(value['cap'])
  && finiteNumber(value['cap'])
  && value['cap'] > 0
  && ['eligible', 'retired'].includes(String(value['status']))
  && nonNegativeNumber(value['active'])
  && nonNegativeNumber(value['activePeak'])

const validStoredTelemetry = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  const numberKeys = ['queueDepth', 'queueDepthPeak', 'claims', 'acceptedPages', 'requeues', 'handoffs', 'exhaustedPages', 'duplicateCommitsPrevented', 'ambiguousAttempts', 'interruptedClaimsRecovered', 'retryPressure', 'pauseTimeMs']
  const mapKeys = ['targetActivePeaks', 'laneCaps', 'targetPageShare', 'targetThroughputPagesPerMinute']
  return numberKeys.every((key) => nonNegativeNumber(value[key]))
    && Array.isArray(value['retiredTargets'])
    && value['retiredTargets'].every((entry) => typeof entry === 'string')
    && Array.isArray(value['retiredLanes'])
    && value['retiredLanes'].every((entry) => typeof entry === 'string')
    && mapKeys.every((key) => isRecord(value[key]))
}

const storedPoolLedger = (value: unknown): OcrPoolLedger | undefined => {
  if (!isRecord(value)
    || value['mode'] !== 'pool'
    || !Number.isInteger(value['totalPages'])
    || !finiteNumber(value['totalPages'])
    || value['totalPages'] < 1
    || !['running', 'full', 'incomplete'].includes(String(value['status']))
    || !Array.isArray(value['pages'])
    || value['pages'].length !== value['totalPages']
    || !value['pages'].every(validStoredPage)
    || new Set(value['pages'].map((page) => (page as Record<string, unknown>)['pageNumber'])).size !== value['totalPages']
    || !value['pages'].every((page) => Number((page as Record<string, unknown>)['pageNumber']) >= 1 && Number((page as Record<string, unknown>)['pageNumber']) <= Number(value['totalPages']))
    || !Array.isArray(value['targets'])
    || !value['targets'].every(validStoredTarget)
    || !Array.isArray(value['lanes'])
    || !value['lanes'].every(validStoredLane)
    || !validStoredTelemetry(value['telemetry'])) {
    return undefined
  }
  const ledger = structuredClone(value) as OcrPoolLedger
  const targetByKey = new Map(ledger.targets.map((target) => [target.targetKey, target]))
  const laneByKey = new Map(ledger.lanes.map((lane) => [lane.laneKey, lane]))
  if (targetByKey.size !== ledger.targets.length || laneByKey.size !== ledger.lanes.length) return undefined
  const internallyConsistent = ledger.pages.every((page) => {
    const attemptsValid = page.attempts.every((attempt, index) => {
      const target = targetByKey.get(getOcrTargetKey({ service: attempt.provider, model: attempt.model }))
      return attempt.attempt === index + 1 && target?.laneKey === attempt.laneKey
    })
    if (!attemptsValid) return false
    if (page.status === 'accepted') {
      const acceptedTarget = page.accepted
        ? targetByKey.get(getOcrTargetKey({ service: page.accepted.provider, model: page.accepted.model }))
        : undefined
      return acceptedTarget !== undefined
        && page.accepted?.result.pageNumber === page.pageNumber
        && page.attempts.some((attempt) =>
          attempt.status === 'accepted'
          && attempt.attempt === page.accepted?.attempt
          && attempt.provider === page.accepted?.provider
          && attempt.model === page.accepted?.model
        )
    }
    if (page.status === 'claimed') {
      const claimedTarget = page.claim ? targetByKey.get(page.claim.targetKey) : undefined
      return claimedTarget?.laneKey === page.claim?.laneKey
        && page.attempts.some((attempt) =>
        attempt.status === 'running'
        && attempt.claimId === page.claim?.claimId
        && attempt.attempt === page.claim?.attempt
        && getOcrTargetKey({ service: attempt.provider, model: attempt.model }) === page.claim?.targetKey
      )
    }
    return page.attempts.every((attempt) => attempt.status !== 'running')
  })
  const targetStateConsistent = ledger.targets.every((target) => {
    const lane = laneByKey.get(target.laneKey)
    const attempts = ledger.pages.flatMap((page) => page.attempts.filter((attempt) =>
      attempt.provider === target.service && attempt.model === target.model
    ))
    const acceptedPagesForTarget = ledger.pages.filter((page) =>
      page.accepted?.provider === target.service && page.accepted.model === target.model
    ).length
    return target.targetKey === getOcrTargetKey(target)
      && lane?.service === target.service
      && lane.local === target.local
      && target.attempts === attempts.length
      && target.acceptedPages === acceptedPagesForTarget
  })
  const acceptedPages = ledger.pages.filter((page) => page.status === 'accepted').length
  const exhaustedPages = ledger.pages.filter((page) => page.status === 'exhausted').length
  if (!internallyConsistent
    || !targetStateConsistent
    || ledger.telemetry.acceptedPages !== acceptedPages
    || ledger.telemetry.exhaustedPages !== exhaustedPages
    || (ledger.status === 'full' && acceptedPages !== ledger.totalPages)) {
    return undefined
  }
  return ledger
}

export const parseStoredOcrPoolLedger = storedPoolLedger

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

const buildCompositeOutput = (
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

const targetProviderStates = (
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
  ...(target.lastFailure ? { lastError: target.lastFailure } : {})
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

const mergeHostedSchedulerTelemetry = (
  ctx: OcrBatchRunContext & { restoredLedger?: OcrPoolLedger | undefined },
  ledger: OcrPoolLedger
): void => {
  const hosted = ctx.hostedOcrScheduler.snapshot()
  const historicalRetryPressure = ctx.restoredLedger?.telemetry.retryPressure ?? 0
  const historicalPauseTimeMs = ctx.restoredLedger?.telemetry.pauseTimeMs ?? 0
  ledger.telemetry.retryPressure = historicalRetryPressure + hosted.lanes.reduce((sum, lane) => sum + lane.retryPressureCount, 0)
  ledger.telemetry.pauseTimeMs = historicalPauseTimeMs + hosted.lanes.reduce((sum, lane) => sum + lane.pauseTimeMs, 0)
  for (const lane of hosted.lanes) {
    ledger.telemetry.laneCaps[lane.laneKey] = lane.currentCap
    const storedLane = ledger.lanes.find((candidate) => candidate.laneKey === lane.laneKey)
    if (storedLane) storedLane.cap = lane.currentCap
  }
}

type PooledOcrContext = OcrBatchRunContext & {
  restoredLedger?: OcrPoolLedger | undefined
  reenabledTargets?: OcrTarget[] | undefined
}

type PreparedPageInput = { path: string, metadata: OcrBatchRunContext['step1Metadata'] }

type PooledPageInputProvider = {
  totalPages: number
  preparePage: (pageNumber: number) => Promise<PreparedPageInput>
}

const normalizedImageFormat = (path: string): DocumentMetadata['format'] => {
  const extension = extname(path).slice(1).toLowerCase()
  if (extension === 'jpeg') return 'jpg'
  if (extension === 'tiff') return 'tif'
  return extension as DocumentMetadata['format']
}

const createPooledPageInputProvider = async (
  ctx: PooledOcrContext,
  pageWorkspace: string
): Promise<PooledPageInputProvider> => {
  const cbzImages = ctx.step1Metadata.format === 'cbz'
    ? await extractCbzImages(ctx.extractFilePath, join(pageWorkspace, 'cbz-pages'))
    : undefined
  if (cbzImages?.length === 0) throw CLIUsageError('--ocr-provider-mode pool requires the CBZ input to contain at least one supported image page.')
  if (cbzImages) {
    for (const imagePath of cbzImages) {
      const imageFormat = normalizedImageFormat(imagePath)
      for (const target of ctx.requestedTargets) {
        if (!isLocalOcrTarget(target) && resolveHostedDirectImageInputStrategy(imageFormat, toHostedEngine(target)) === 'unsupported') {
          throw CLIUsageError(`${target.service}/${target.model} cannot normalize a ${imageFormat.toUpperCase()} CBZ page into a compatible pooled page work unit.`)
        }
      }
    }
  }
  const promises = new Map<number, Promise<PreparedPageInput>>()
  const preparePage = (pageNumber: number): Promise<PreparedPageInput> => {
    const existing = promises.get(pageNumber)
    if (existing) return existing
    const promise = (async (): Promise<PreparedPageInput> => {
      if (cbzImages) {
        const imagePath = cbzImages[pageNumber - 1]
        if (!imagePath) throw CLIUsageError(`CBZ pooled OCR page ${pageNumber} does not exist.`)
        const imageStats = await stat(imagePath)
        return { path: imagePath, metadata: { ...ctx.step1Metadata, pageCount: 1, fileSize: imageStats.size, format: normalizedImageFormat(imagePath) } }
      }
      if (ctx.step1Metadata.format !== 'pdf') return { path: ctx.extractFilePath, metadata: { ...ctx.step1Metadata, pageCount: 1 } }
      const pageDir = join(pageWorkspace, 'page-inputs')
      await mkdir(pageDir, { recursive: true })
      const pagePath = join(pageDir, `page-${String(pageNumber).padStart(6, '0')}.pdf`)
      await createOcrPdfChunkWithLocalFallback({
        inputPath: ctx.extractFilePath,
        outputPath: pagePath,
        range: { startPage: pageNumber, endPage: pageNumber },
        password: ctx.effectiveOpts.password,
        dpi: ctx.effectiveOpts.dpi,
        splitLogMode: 'debug',
        logLabel: 'pooled OCR page preparation',
      })
      const pageStats = await stat(pagePath)
      return { path: pagePath, metadata: { ...ctx.step1Metadata, pageCount: 1, fileSize: pageStats.size, format: 'pdf' } }
    })()
    promises.set(pageNumber, promise)
    promise.catch(() => {
      if (promises.get(pageNumber) === promise) promises.delete(pageNumber)
    })
    return promise
  }
  return { totalPages: cbzImages?.length ?? Math.max(1, ctx.step1Metadata.pageCount), preparePage }
}

const preflightPooledPageInputs = async (provider: PooledPageInputProvider): Promise<void> => {
  for (let pageNumber = 1; pageNumber <= provider.totalPages; pageNumber++) {
    try {
      await provider.preparePage(pageNumber)
    } catch (error) {
      const detail = error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : String(error)
      throw CLIUsageError(
        `--ocr-provider-mode pool could not normalize page ${pageNumber} into a compatible work unit: ${detail}`,
        undefined,
        error instanceof Error ? { cause: error } : {}
      )
    }
  }
}

const validatePooledReasoningPolicies = (ctx: PooledOcrContext): void => {
  for (const target of ctx.requestedTargets) {
    if (isLocalOcrTarget(target)) continue
    resolveReasoningPolicy({ step: 'extract', service: target.service, model: target.model, requestedReasoningEffort: ctx.effectiveOpts.reasoningEffort })
  }
}

const createPooledCheckpointWriter = (
  ctx: PooledOcrContext,
  startedAtMs: number,
  resolvedStep2: ReturnType<typeof resolveRecordedOcrStep2>
): ((ledger: OcrPoolLedger) => Promise<void>) => async ledger => {
  mergeHostedSchedulerTelemetry(ctx, ledger)
  const composite = buildCompositeOutput(ctx, ledger, startedAtMs)
  const retiredTargets = ledger.targets.filter(target => target.status === 'retired')
  const payload = buildDocumentMetadataPayload(ctx.step1Metadata, composite.metadata, {
    web: ctx.web,
    source: ctx.documentSource,
    completionStatus: ledger.status === 'full' ? 'full' : 'incomplete',
    resolvedStep2,
    requestedProviders: ctx.requestedTargets.map(toRequestedProvider),
    providerStates: targetProviderStates(ledger),
    missingProviders: [],
    blockedProviders: retiredTargets.map(target => ({ service: target.service, model: target.model })),
    preflightEstimate: ctx.preflightEstimate,
    ocrConcurrency: ctx.opts.ocrConcurrency,
    ocrConcurrencyMode: ctx.opts.ocrConcurrencyMode,
    concurrencyMode: ctx.opts.concurrencyMode,
    ocrProviderConcurrency: ctx.opts.ocrProviderConcurrency,
    ocrLocalConcurrency: ctx.opts.ocrLocalConcurrency,
    hostedOcrScheduler: ctx.hostedOcrScheduler.snapshot(),
  })
  await writeExtractionArtifact(ctx.outputDir, composite.result, ctx.opts.outputFormat ?? 'text', 'result.json')
  await writePipelineItemRecords(ctx.outputDir, 'extract', 'single', [{ ...payload, ocrProviderMode: 'pool', ocrPool: ledger }], { extractRoute: 'document' })
}

const createPooledPageAttemptRunner = (
  ctx: PooledOcrContext,
  pageInputs: PooledPageInputProvider
): RunOcrPagePoolOptions['processPage'] => async ({ pageNumber, target, attempt, artifactDir }) => {
  const prepared = await pageInputs.preparePage(pageNumber)
  const absoluteArtifactDir = join(ctx.outputDir, artifactDir)
  await mkdir(absoluteArtifactDir, { recursive: true })
  const providerOpts = buildExtractionOptionsForTarget({
    ...ctx.effectiveOpts,
    outputDir: absoluteArtifactDir,
    chapterFiles: false,
    chapterChunkLimitChars: undefined,
    pdfChapterMode: 'local',
    ocrProviderMode: 'pool',
    ocrPoolDocumentPageNumber: pageNumber,
    ocrPreparationCache: ctx.ocrPreparationCache,
  }, target)
  try {
    const extracted = await runWithLogContext({ step: 'step-2-ocr', provider: getOcrTargetDirectoryName(target), page: pageNumber, attempt }, async () => await runOcr(prepared.path, prepared.metadata, providerOpts))
    const resultPage = extracted.result.pages[0]
    if (!resultPage) throw CLIUsageError(`${target.service}/${target.model} returned no page result for pooled OCR page ${pageNumber}.`)
    await writeProviderArtifacts(absoluteArtifactDir, extracted.result, ctx.opts.outputFormat ?? 'text', extracted.artifactFiles)
    await writeFile(join(absoluteArtifactDir, 'usage.json'), `${JSON.stringify({ providerMode: 'pool', pageNumber, attempt, provider: target.service, model: target.model, ...usageFromMetadata(extracted.step2Metadata) }, null, 2)}\n`)
    return {
      result: { ...resultPage, pageNumber },
      ...usageFromMetadata(extracted.step2Metadata),
      ...(extracted.step2Metadata.requestedReasoningEffort ? { requestedReasoningEffort: extracted.step2Metadata.requestedReasoningEffort } : {}),
      ...(extracted.step2Metadata.effectiveReasoningEffort ? { effectiveReasoningEffort: extracted.step2Metadata.effectiveReasoningEffort } : {}),
    }
  } catch (error) {
    await writeOcrProviderError(absoluteArtifactDir, error, classifyOcrProviderFailure(error)).catch((writeError: unknown) => {
      l.warn(`Could not write OCR failure diagnostics to ${absoluteArtifactDir}`, { category: 'artifact', metadata: { artifactDir: absoluteArtifactDir, error: serializeDiagnosticError(writeError) } })
    })
    const failedUsage = usageFromError(error)
    await writeFile(join(absoluteArtifactDir, 'usage.json'), `${JSON.stringify({ providerMode: 'pool', pageNumber, attempt, provider: target.service, model: target.model, accepted: false, ...failedUsage }, null, 2)}\n`)
    throw error
  }
}

const classifyPooledPageFailure: (
  ctx: PooledOcrContext
) => RunOcrPagePoolOptions['classifyFailure'] = ctx => (error, target) => {
  const failure = classifyOcrProviderFailure(error)
  const reasoning = isLocalOcrTarget(target) ? undefined : resolveReasoningPolicy({ step: 'extract', service: target.service, model: target.model, requestedReasoningEffort: ctx.effectiveOpts.reasoningEffort })
  return {
    scope: failure.providerWide ? 'lane' : failure.retryable === false ? 'target' : 'page',
    ambiguous: failure.category === 'network' || failure.category === 'timeout',
    failure: { service: target.service, model: target.model, ...failure },
    ...(reasoning?.requested ? { requestedReasoningEffort: reasoning.requested } : {}),
    ...(reasoning ? { effectiveReasoningEffort: reasoning.effective } : {}),
    ...usageFromError(error),
  }
}

const projectPooledOcrResult = (
  ctx: PooledOcrContext,
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

export const runOcrPooledBatch = async (ctx: PooledOcrContext): Promise<ProcessDocumentOutput> => {
  assertOcrPoolCompatible(ctx)
  const startedAtMs = Date.now()
  const pageWorkspace = await mkdtemp(join(tmpdir(), 'autoshow-ocr-pool-'))
  try {
    const pageInputs = await createPooledPageInputProvider(ctx, pageWorkspace)
    const resolvedStep2 = resolveRecordedOcrStep2(ctx.step1Metadata.format, ctx.effectiveOpts, ctx.documentSource, ctx.requestedTargets, ctx.preparedMarkdown)
    validatePooledReasoningPolicies(ctx)
    await preflightPooledPageInputs(pageInputs)
    const writeCheckpoint = createPooledCheckpointWriter(ctx, startedAtMs, resolvedStep2)
    const ledger = await runOcrPagePool({
      totalPages: pageInputs.totalPages,
      requestedTargets: ctx.requestedTargets,
      targetsToRun: ctx.targetsToRun,
      providerConcurrency: ctx.opts.ocrProviderConcurrency,
      localConcurrency: ctx.opts.ocrLocalConcurrency,
      restoredLedger: ctx.restoredLedger,
      reenabledTargets: ctx.reenabledTargets,
      getLaneKey: defaultOcrPoolLaneKey,
      getTargetConcurrency: target => isLocalOcrTarget(target)
        ? ctx.opts.ocrConcurrency ?? 10
        : ctx.hostedOcrScheduler.getMaxConcurrency({ service: target.service as import('~/types').HostedOcrService, model: target.model, targetKey: getOcrTargetKey(target), pageCount: 1, documentPageCount: ctx.step1Metadata.pageCount }),
      getAttemptArtifactDir: attemptRelativeDir,
      onCheckpoint: writeCheckpoint,
      processPage: createPooledPageAttemptRunner(ctx, pageInputs),
      classifyFailure: classifyPooledPageFailure(ctx),
    })
    mergeHostedSchedulerTelemetry(ctx, ledger)
    await writeCheckpoint(ledger)
    return projectPooledOcrResult(ctx, ledger, startedAtMs)
  } finally {
    await rm(pageWorkspace, { recursive: true, force: true })
  }
}
