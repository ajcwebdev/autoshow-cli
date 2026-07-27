import { mkdir } from 'node:fs/promises'
import type { ExtractionMetadata, ExistingOcrRun, OcrBatchFinalization, OcrBatchRunContext, ProviderCompletionStatus, OcrMetadataOptions, OcrProviderFailureKind, OcrProviderFailureSummary, OcrProviderSuccess, OcrTarget, ProcessDocumentOutput, ResolvedStep2Execution } from '~/types'
import { l, runWithLogContext } from '~/utils/app-logger/app-logger'
import { logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { isEpubInspectMode, writeExtractionArtifact, writeProviderArtifacts } from './ocr-artifacts'
import { buildDocumentMetadataPayload, resolveRecordedOcrStep2 } from './ocr-document-metadata'
import { logOcrProviderLifecycle } from './ocr-logging'
import { writeOcrRunManifest } from './ocr-manifest'
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

export class OcrBatchCompletionError extends Error {
  outputDir: string
  completionStatus: ProviderCompletionStatus
  exitCode: number

  constructor(outputDir: string, completionStatus: ProviderCompletionStatus, message: string) {
    super(message)
    this.name = 'OcrBatchCompletionError'
    this.outputDir = outputDir
    this.completionStatus = completionStatus
    this.exitCode = 2
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
      const metadataErrors: NonNullable<OcrMetadataOptions['failures']> = buildMetadataErrorEntries(providerStates).map((value) => ({
        service: value['service'] as string,
        model: value['model'] as string,
        message: value['message'] as string,
        ...(typeof value['category'] === 'string' ? { category: value['category'] as string } : {}),
        ...(typeof value['failureKind'] === 'string' ? { failureKind: value['failureKind'] as OcrProviderFailureKind } : {}),
        ...(typeof value['retryable'] === 'boolean' ? { retryable: value['retryable'] as boolean } : {}),
        ...(typeof value['quota'] === 'boolean' ? { quota: value['quota'] as boolean } : {}),
        ...(typeof value['providerWide'] === 'boolean' ? { providerWide: value['providerWide'] as boolean } : {}),
        ...(typeof value['blockedReason'] === 'string' ? { blockedReason: value['blockedReason'] as string } : {}),
        ...(typeof value['errorFile'] === 'string' ? { errorFile: value['errorFile'] as string } : {})
      }))
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
        ocrProviderConcurrency: opts.ocrProviderConcurrency,
        ocrLocalConcurrency: opts.ocrLocalConcurrency,
        hostedOcrScheduler: hostedOcrScheduler.snapshot()
      })
      await writeOcrRunManifest(outputDir, checkpointMetadata)
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
        target,
        extracted.result,
        extracted.step2Metadata,
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

const finalizeOcrBatchManifest = async (params: {
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
  const metadataErrors: NonNullable<OcrMetadataOptions['failures']> = buildMetadataErrorEntries(providerStates).map((value) => ({
    service: value['service'] as string,
    model: value['model'] as string,
    message: value['message'] as string,
    ...(typeof value['category'] === 'string' ? { category: value['category'] as string } : {}),
    ...(typeof value['failureKind'] === 'string' ? { failureKind: value['failureKind'] as OcrProviderFailureKind } : {}),
    ...(typeof value['retryable'] === 'boolean' ? { retryable: value['retryable'] as boolean } : {}),
    ...(typeof value['quota'] === 'boolean' ? { quota: value['quota'] as boolean } : {}),
    ...(typeof value['providerWide'] === 'boolean' ? { providerWide: value['providerWide'] as boolean } : {}),
    ...(typeof value['blockedReason'] === 'string' ? { blockedReason: value['blockedReason'] as string } : {}),
    ...(typeof value['stage'] === 'string' ? { stage: value['stage'] as string } : {}),
    ...(typeof value['status'] === 'number' ? { status: value['status'] as number } : {}),
    ...(typeof value['retryAfterMs'] === 'number' ? { retryAfterMs: value['retryAfterMs'] as number } : {}),
    ...(typeof value['errorFile'] === 'string' ? { errorFile: value['errorFile'] as string } : {}),
    ...(typeof value['rawResponseFile'] === 'string' ? { rawResponseFile: value['rawResponseFile'] as string } : {})
  }))
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
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    hostedOcrScheduler: hostedOcrScheduler.snapshot()
  })
  await writeOcrRunManifest(outputDir, writtenMetadata)
  await persistHostedOcrThroughputProfiles(hostedOcrScheduler.snapshot(), {
    completionStatus
  }).catch((error) => {
    l.write('debug', `Failed to update hosted OCR throughput profiles: ${error instanceof Error ? error.message : String(error)}`)
  })
  await persistHostedOcrTokenUsageProfiles(step2Metadata, {
    completionStatus
  }).catch((error) => {
    l.write('debug', `Failed to update hosted OCR token profiles: ${error instanceof Error ? error.message : String(error)}`)
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
  } = await finalizeOcrBatchManifest({
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
      isEpubInspectMode(primary.metadata),
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
