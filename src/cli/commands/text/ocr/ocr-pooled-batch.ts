import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import type { DocumentMetadata, ExtractionOptions, OcrBatchRunContext, OcrPoolLedger, OcrTarget, ProcessDocumentOutput, RunOcrPagePoolOptions } from '~/types'
import { l, runWithLogContext } from '~/utils/app-logger/app-logger'
import { writeFile } from '~/utils/cli-utils'
import { UsageError } from '~/utils/error-handler'
import { writePipelineItemRecords } from '../../command-shared/pipeline-manifest'
import { resolveHostedDirectImageInputStrategy } from './hosted-ocr'
import { writeExtractionArtifact, writeProviderArtifacts } from './ocr-artifacts'
import { buildDocumentMetadataPayload, resolveRecordedOcrStep2 } from './ocr-document-metadata'
import { buildCompositeOutput, projectPooledOcrResult, targetProviderStates, usageFromError, usageFromMetadata } from './ocr-pool-projection'
import type { PooledPageInputProvider } from './ocr-pooled-page-inputs'
import { createPooledPageInputProvider, preflightPooledPageInputs, toHostedEngine } from './ocr-pooled-page-inputs'
import { defaultOcrPoolLaneKey, isLocalOcrTarget, runOcrPagePool } from './ocr-provider-pool'
import { classifyOcrProviderFailure, getOcrTargetKey, toRequestedProvider } from './ocr-run-state'
import { writeOcrProviderError } from './ocr-structured-response-error'
import { buildExtractionOptionsForTarget, getOcrTargetDirectoryName } from './ocr-targets'
import { runOcr } from './run-ocr'

const POOL_IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])

export const assertOcrPoolCompatible = (
  ctx: {
    step1Metadata: Pick<DocumentMetadata, 'format'>
    opts: Pick<ExtractionOptions, 'primaryOcr'>
    requestedTargets: OcrTarget[]
  }
): void => {
  if (ctx.opts.primaryOcr) {
    throw UsageError('--primary-ocr cannot be used with --ocr-provider-mode pool because the top-level extraction is the composite pooled result.')
  }
  const format = ctx.step1Metadata.format
  if (format !== 'pdf' && format !== 'cbz' && !POOL_IMAGE_FORMATS.has(format)) {
    throw UsageError(`--ocr-provider-mode pool requires a PDF or supported image input that can be normalized into independent page work units; received ${format}.`)
  }
  if (ctx.requestedTargets.length === 0) {
    throw UsageError('--ocr-provider-mode pool requires at least one selected OCR target.')
  }
  if (format !== 'pdf') {
    for (const target of ctx.requestedTargets) {
      if (isLocalOcrTarget(target)) continue
      if (resolveHostedDirectImageInputStrategy(format, toHostedEngine(target)) === 'unsupported') {
        throw UsageError(`${target.service}/${target.model} cannot normalize ${format.toUpperCase()} into a compatible pooled page work unit.`)
      }
    }
  }
}

const attemptRelativeDir = (pageNumber: number, target: OcrTarget, attempt: number): string =>
  `providers/${getOcrTargetDirectoryName(target)}/attempts/page-${String(pageNumber).padStart(6, '0')}/attempt-${String(attempt).padStart(3, '0')}`

export const getOcrPoolAttemptRelativeDir = attemptRelativeDir

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
    if (!resultPage) throw UsageError(`${target.service}/${target.model} returned no page result for pooled OCR page ${pageNumber}.`)
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
      l.warn(`Could not write OCR failure diagnostics to ${absoluteArtifactDir}`, { category: 'artifact', metadata: { artifactDir: absoluteArtifactDir }, error: writeError })
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

export { parseStoredOcrPoolLedger } from './ocr-pool-ledger-validation'

export { preflightPooledPageInputs } from './ocr-pooled-page-inputs'

export type { PooledPageInputProvider } from './ocr-pooled-page-inputs'
