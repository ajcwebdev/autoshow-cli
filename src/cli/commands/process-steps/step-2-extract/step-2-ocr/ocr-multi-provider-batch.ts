import { mkdir } from 'node:fs/promises'
import type { ExtractionMetadata, ExistingOcrRun, OcrBatchFinalization, OcrBatchRunContext, ProviderCompletionStatus, OcrMetadataOptions, OcrProviderFailureSummary, OcrProviderSuccess, OcrTarget, ProcessDocumentOutput, ResolvedStep2Execution } from '~/types'
import { l, runWithLogContext } from '~/utils/app-logger/app-logger'
import { logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { writeExtractionArtifact, writeProviderArtifacts } from './ocr-artifacts'
import { buildDocumentMetadataPayload, resolveRecordedOcrStep2 } from './ocr-document-metadata'
import { logOcrProviderLifecycle } from './ocr-logging'
import { writePipelineItemRecords } from '../../pipeline-manifest'
import { collectPartialStep2Metadata } from './ocr-partial-step2'
import { runOcrProviderTargetPools } from './ocr-provider-pool'
import {
  buildMetadataErrorEntries,
  buildBlockedProviders,
  buildMissingProviders,
  buildProviderStates,
  classifyOcrProviderFailure,
  readExistingOcrRun,
  resolveCompletionStatus,
  toRequestedProvider
} from './ocr-run-state'
import { writeOcrProviderError } from './ocr-structured-response-error'
import {
  buildExtractionOptionsForTarget,
  getOcrTargetDirectoryName,
  resolvePrimaryOcrTarget
} from './ocr-targets'
import { readFallbackAuditRollup } from './ocr-utils/pdf-chunk-fallback'
import { persistHostedOcrTokenUsageProfiles } from './ocr-utils/hosted-ocr-token-profiles'
import { persistHostedOcrThroughputProfiles } from './ocr-utils/hosted-ocr-throughput-profiles'
import { runOcr } from './run-ocr'
import { ProviderBatchCompletionError } from '../step-2-shared/provider-batch-state'
import { resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { serializeDiagnosticError } from '~/utils/error-handler'

export class OcrBatchCompletionError extends ProviderBatchCompletionError {
  constructor(outputDir: string, completionStatus: ProviderCompletionStatus, message: string) {
    super('OcrBatchCompletionError', outputDir, completionStatus, message)
  }
}

const createOcrCheckpointWriter = (params: {
  ctx: OcrBatchRunContext
  resolvedStep2: ResolvedStep2Execution
  primaryTarget: OcrTarget | undefined
  existingRun: ExistingOcrRun
  successes: Array<OcrProviderSuccess | undefined>
  failuresByIndex: Map<number, OcrProviderFailureSummary>
  collectSuccessMetadata: (currentSuccesses: Array<OcrProviderSuccess | undefined>) => Array<ExtractionMetadata | undefined>
}): { queue: () => void, drain: () => Promise<void> } => {
  const { ctx, resolvedStep2, primaryTarget, existingRun, successes, failuresByIndex, collectSuccessMetadata } = params
  const { outputDir, requestedTargets, opts, step1Metadata, web, documentSource, preflightEstimate, hostedOcrScheduler } = ctx
  let checkpointWrite = Promise.resolve()

  const queue = (): void => {
    const snapshotSuccesses = [...successes]
    const snapshotSuccessMetadata = collectSuccessMetadata(snapshotSuccesses)
    const snapshotFailuresByIndex = new Map(failuresByIndex)
    checkpointWrite = checkpointWrite.then(async () => {
      const providerStates = buildProviderStates(
        requestedTargets,
        snapshotSuccesses,
        snapshotFailuresByIndex,
        existingRun.providerStates,
        snapshotSuccessMetadata
      )
      const missingProviders = buildMissingProviders(providerStates, requestedTargets)
      const blockedProviders = buildBlockedProviders(providerStates, requestedTargets)
      const completionStatus = resolveCompletionStatus(providerStates)
      const metadataErrors = buildMetadataErrorEntries(providerStates)
      const step2Metadata = snapshotSuccessMetadata
        .filter((entry): entry is ExtractionMetadata => entry !== undefined)
      const partialStep2 = await collectPartialStep2Metadata({
        outputDir,
        requestedTargets,
        failuresByIndex: snapshotFailuresByIndex,
        dpi: opts.dpi,
        languages: opts.languages
      })
      const checkpointMetadata = buildDocumentMetadataPayload(step1Metadata, step2Metadata, {
        failures: metadataErrors,
        web,
        source: documentSource,
        completionStatus,
        resolvedStep2,
        requestedProviders: requestedTargets.map(toRequestedProvider),
        providerStates,
        missingProviders,
        blockedProviders,
        partialStep2,
        ...(primaryTarget ? { primaryProvider: toRequestedProvider(primaryTarget) } : {}),
        preflightEstimate,
        ocrConcurrency: opts.ocrConcurrency,
        ocrConcurrencyMode: opts.ocrConcurrencyMode,
        concurrencyMode: opts.concurrencyMode,
        ocrProviderConcurrency: opts.ocrProviderConcurrency,
        ocrLocalConcurrency: opts.ocrLocalConcurrency,
        hostedOcrScheduler: hostedOcrScheduler.snapshot()
      })
      await writePipelineItemRecords(outputDir, 'extract', 'single', [checkpointMetadata], { extractRoute: 'document' })
    })
  }

  return { queue, drain: () => checkpointWrite }
}

const createOcrProviderTargetRunner = (params: {
  ctx: OcrBatchRunContext
  providersDir: string
  successes: Array<OcrProviderSuccess | undefined>
  failuresByIndex: Map<number, OcrProviderFailureSummary>
  failures: NonNullable<OcrMetadataOptions['failures']>
  queueCheckpointWrite: () => void
}): ((requestedIndex: number, target: OcrTarget) => Promise<void>) => {
  const { ctx, providersDir, successes, failuresByIndex, failures, queueCheckpointWrite } = params
  const { effectiveOpts, ocrPreparationCache, extractFilePath, step1Metadata, opts } = ctx

  return async (requestedIndex, target) => {
    const providerDirName = getOcrTargetDirectoryName(target)
    const providerDir = `${providersDir}/${providerDirName}`
    const providerStartedAt = Date.now()
    await mkdir(providerDir, { recursive: true })

    logOcrProviderLifecycle(l, {
      provider: target.service,
      model: target.model,
      status: 'started'
    })
    try {
      const providerOpts = buildExtractionOptionsForTarget({
        ...effectiveOpts,
        outputDir: providerDir,
        ocrPreparationCache
      }, target)
      const extracted = await runWithLogContext({ step: 'step-2-ocr', provider: providerDirName }, async () =>
        await runOcr(extractFilePath, step1Metadata, providerOpts)
      )

      await writeProviderArtifacts(
        providerDir,
        extracted.result,
        opts.outputFormat ?? 'text',
        extracted.artifactFiles
      )

      successes[requestedIndex] = {
        target,
        result: extracted.result,
        metadata: extracted.step2Metadata,
        relativeDir: `providers/${providerDirName}`
      }
      failuresByIndex.delete(requestedIndex)
      queueCheckpointWrite()
      logOcrProviderLifecycle(l, {
        provider: target.service,
        model: target.model,
        status: 'succeeded',
        elapsedMs: Date.now() - providerStartedAt
      })
    } catch (error) {
      const failure = classifyOcrProviderFailure(error)
      const errorArtifacts = await writeOcrProviderError(providerDir, error, failure)
      const fallbackAudit = target.service === 'tesseract'
        ? undefined
        : await readFallbackAuditRollup(providerDir)
      const providerElapsedMs = Date.now() - providerStartedAt
      const failureWithArtifact: OcrProviderFailureSummary = {
        ...failure,
        ...errorArtifacts,
        elapsedMs: providerElapsedMs
      }
      failuresByIndex.set(requestedIndex, failureWithArtifact)
      failures.push({
        service: target.service,
        model: target.model,
        message: failure.message,
        category: failure.category,
        failureKind: failure.failureKind,
        retryable: failure.retryable,
        ...(failure.quota ? { quota: true } : {}),
        ...(failure.providerWide ? { providerWide: true } : {}),
        ...(failure.blockedReason ? { blockedReason: failure.blockedReason } : {}),
        ...(typeof failure.attemptsMade === 'number' ? { attemptsMade: failure.attemptsMade } : {}),
        ...(fallbackAudit?.pageStatusCounts ? { fallbackPages: fallbackAudit.pageStatusCounts } : {}),
        ...(fallbackAudit?.terminalReason ? { fallbackTerminalReason: fallbackAudit.terminalReason } : {}),
        ...(failure.stage ? { stage: failure.stage } : {}),
        ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
        ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
        errorFile: `providers/${providerDirName}/${errorArtifacts.errorFile}`,
        ...(errorArtifacts.rawResponseFile ? { rawResponseFile: `providers/${providerDirName}/${errorArtifacts.rawResponseFile}` } : {})
      })
      queueCheckpointWrite()
      logOcrProviderLifecycle(l, {
        provider: target.service,
        model: target.model,
        status: 'failed',
        elapsedMs: providerElapsedMs,
        reason: failure.category,
        detail: failure.message
      })
    }
  }
}

const finalizeOcrProviderBatch = async (params: {
  ctx: OcrBatchRunContext
  resolvedStep2: ResolvedStep2Execution
  primaryTarget: OcrTarget | undefined
  existingRun: ExistingOcrRun
  successes: Array<OcrProviderSuccess | undefined>
  failuresByIndex: Map<number, OcrProviderFailureSummary>
}): Promise<OcrBatchFinalization> => {
  const { ctx, resolvedStep2, primaryTarget, existingRun, successes, failuresByIndex } = params
  const { outputDir, requestedTargets, opts, step1Metadata, web, documentSource, preflightEstimate, hostedOcrScheduler } = ctx

  const providerStates = buildProviderStates(
    requestedTargets,
    successes,
    failuresByIndex,
    existingRun.providerStates,
    successes.map((entry, index) => entry?.metadata ?? existingRun.successMetadata[index])
  )
  const missingProviders = buildMissingProviders(providerStates, requestedTargets)
  const blockedProviders = buildBlockedProviders(providerStates, requestedTargets)
  const completionStatus = resolveCompletionStatus(providerStates)
  const metadataErrors = buildMetadataErrorEntries(providerStates)
  const step2Metadata = successes
    .map((entry, index) => entry?.metadata ?? existingRun.successMetadata[index])
    .filter((entry): entry is ExtractionMetadata => entry !== undefined)
  const partialStep2 = await collectPartialStep2Metadata({
    outputDir,
    requestedTargets,
    failuresByIndex,
    dpi: opts.dpi,
    languages: opts.languages
  })
  const primary = primaryTarget
    ? successes.find((entry) => entry?.target.service === primaryTarget.service && entry.target.model === primaryTarget.model)
    : undefined
  const firstSuccess = successes.find((entry): entry is OcrProviderSuccess => entry !== undefined)

  const writtenMetadata = buildDocumentMetadataPayload(step1Metadata, step2Metadata, {
    failures: metadataErrors,
    web,
    source: documentSource,
    completionStatus,
    resolvedStep2,
    requestedProviders: requestedTargets.map(toRequestedProvider),
    providerStates,
    missingProviders,
    blockedProviders,
    partialStep2,
    ...(primaryTarget ? { primaryProvider: toRequestedProvider(primaryTarget) } : {}),
    preflightEstimate,
    ocrConcurrency: opts.ocrConcurrency,
    ocrConcurrencyMode: opts.ocrConcurrencyMode,
    concurrencyMode: opts.concurrencyMode,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    hostedOcrScheduler: hostedOcrScheduler.snapshot()
  })
  await writePipelineItemRecords(outputDir, 'extract', 'single', [writtenMetadata], { extractRoute: 'document' })
  await persistHostedOcrThroughputProfiles(hostedOcrScheduler.snapshot(), {
    completionStatus
  }).catch((error) => {
    l.write('debug', `Failed to update hosted OCR throughput profiles: ${error instanceof Error ? error.message : String(error)}`, {
      category: 'artifact',
      metadata: { profile: 'throughput', error: serializeDiagnosticError(error) }
    })
  })
  await persistHostedOcrTokenUsageProfiles(step2Metadata, {
    completionStatus
  }).catch((error) => {
    l.write('debug', `Failed to update hosted OCR token profiles: ${error instanceof Error ? error.message : String(error)}`, {
      category: 'artifact',
      metadata: { profile: 'token', error: serializeDiagnosticError(error) }
    })
  })
  logExtractManifestConsoleSummary(outputDir, writtenMetadata)

  return {
    providerStates,
    missingProviders,
    blockedProviders,
    completionStatus,
    step2Metadata,
    partialStep2,
    primary,
    firstSuccess
  }
}

export const runOcrMultiProviderBatch = async (ctx: OcrBatchRunContext): Promise<ProcessDocumentOutput> => {
  const { outputDir, requestedTargets, targetsToRun, opts, step1Metadata, web, documentSource, effectiveOpts, preparedMarkdown } = ctx
  for (const target of targetsToRun) {
    if (target.service === 'tesseract') {
      continue
    }
    resolveReasoningPolicy({
      step: 'extract',
      service: target.service,
      model: target.model,
      requestedReasoningEffort: effectiveOpts.reasoningEffort
    })
  }
  const primaryTarget = resolvePrimaryOcrTarget(requestedTargets, opts.primaryOcr)
  const resolvedStep2 = resolveRecordedOcrStep2(
    step1Metadata.format,
    effectiveOpts,
    documentSource,
    requestedTargets,
    preparedMarkdown
  )
  const providersDir = `${outputDir}/providers`
  await mkdir(providersDir, { recursive: true })

  const existingRun = await readExistingOcrRun(outputDir, requestedTargets)
  const successes: Array<OcrProviderSuccess | undefined> = [...existingRun.successes]
  const failuresByIndex = new Map<number, OcrProviderFailureSummary>()
  const failures: NonNullable<OcrMetadataOptions['failures']> = []
  const collectSuccessMetadata = (
    currentSuccesses: Array<OcrProviderSuccess | undefined>
  ): Array<ExtractionMetadata | undefined> =>
    currentSuccesses.map((entry, index) => entry?.metadata ?? existingRun.successMetadata[index])

  const checkpointWriter = createOcrCheckpointWriter({
    ctx,
    resolvedStep2,
    primaryTarget,
    existingRun,
    successes,
    failuresByIndex,
    collectSuccessMetadata
  })

  const runOcrProviderTargetAtIndex = createOcrProviderTargetRunner({
    ctx,
    providersDir,
    successes,
    failuresByIndex,
    failures,
    queueCheckpointWrite: checkpointWriter.queue
  })

  await runOcrProviderTargetPools(
    requestedTargets,
    targetsToRun,
    {
      provider: opts.ocrProviderConcurrency,
      local: opts.ocrLocalConcurrency
    },
    runOcrProviderTargetAtIndex
  )
  await checkpointWriter.drain()

  const {
    providerStates,
    missingProviders,
    blockedProviders,
    completionStatus,
    step2Metadata,
    partialStep2,
    primary,
    firstSuccess
  } = await finalizeOcrProviderBatch({
    ctx,
    resolvedStep2,
    primaryTarget,
    existingRun,
    successes,
    failuresByIndex
  })

  if (!firstSuccess) {
    throw new OcrBatchCompletionError(
      outputDir,
      completionStatus,
      `No extract outputs were generated. ${failures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`
    )
  }

  if (primary) {
    await writeExtractionArtifact(
      outputDir,
      primary.result,
      opts.outputFormat ?? 'text',
      'result.json'
    )
  }

  return {
    result: (primary ?? firstSuccess).result,
    step1Metadata,
    step2Metadata,
    ...(partialStep2.length > 0 ? { partialStep2 } : {}),
    completionStatus,
    requestedProviders: requestedTargets.map(toRequestedProvider),
    providerStates,
    missingProviders,
    blockedProviders,
    ...(web ? { web } : {}),
    ...(failures.length > 0 ? { step2Errors: failures } : {}),
    outputDir
  }
}
