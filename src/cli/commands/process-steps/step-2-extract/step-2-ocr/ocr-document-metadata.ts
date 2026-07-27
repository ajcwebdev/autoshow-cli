import type { AggregatedPriceEstimate, ExtractionOptions, OcrMetadataOptions, ProcessDocumentOutput, ResolvedStep2Execution, Step1SourceRef } from '~/types'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { serializeOneOrMany } from '../../target-runner'
import { resolveOcrStep2ExecutionFromFormat } from '../step-2-shared/resolved-step2'
import { buildOcrCostDiagnostics, collectEstimatedExtractTargets, resolveExtractEstimatedCosts, resolveExtractObservedEstimateCosts } from './ocr-costs'

export const buildDocumentSource = (
  filePath: string,
  sourceRef?: Step1SourceRef
): Step1SourceRef => {
  if (typeof sourceRef?.url === 'string' && sourceRef.url.length > 0) {
    return { url: sourceRef.url }
  }
  if (typeof sourceRef?.filePath === 'string' && sourceRef.filePath.length > 0) {
    return { filePath: sourceRef.filePath }
  }
  return { filePath }
}

const isRemoteDocumentSource = (
  source: Step1SourceRef
): boolean => typeof source.url === 'string' && /^https?:\/\//i.test(source.url)

export const resolveRecordedOcrStep2 = (
  format: ProcessDocumentOutput['step1Metadata']['format'],
  opts: ExtractionOptions,
  source: Step1SourceRef,
  requestedTargets?: Array<{ service: string, model: string }>,
  preparedMarkdown?: string
): ResolvedStep2Execution => {
  const resolved = resolveOcrStep2ExecutionFromFormat(format as Parameters<typeof resolveOcrStep2ExecutionFromFormat>[0], {
    ...opts,
    preparedMarkdown,
    localHtmlDocument: format === 'html' && !isRemoteDocumentSource(source)
  } as unknown as Parameters<typeof resolveOcrStep2ExecutionFromFormat>[1])

  if (resolved.route !== 'ocr' || !requestedTargets || requestedTargets.length === 0) {
    return resolved
  }

  return {
    ...resolved,
    providers: requestedTargets.map((target) => ({
      service: target.service,
      model: target.model,
      origin: resolved.providers.find((provider) =>
        provider.service === target.service && provider.model === target.model
      )?.origin
    }))
  }
}

export const toResolvedRequestedProviders = (
  resolvedStep2: ResolvedStep2Execution
): Array<{ service: string, model: string }> | undefined =>
  resolvedStep2.route === 'ocr'
    ? resolvedStep2.providers.map((provider) => ({
        service: provider.service,
        model: provider.model
      }))
    : undefined

export const buildSuccessfulResolvedProviderStates = (
  resolvedProviders: Array<{ service: string, model: string }>
): Array<Record<string, unknown>> =>
  resolvedProviders.map((provider) => ({
    service: provider.service,
    model: provider.model,
    artifactDir: '.',
    status: 'succeeded',
    attempts: 1
  }))

export const buildDocumentMetadataPayload = (
  step1Metadata: ProcessDocumentOutput['step1Metadata'],
  step2Metadata: ProcessDocumentOutput['step2Metadata'] | undefined,
  options: OcrMetadataOptions & { preflightEstimate?: AggregatedPriceEstimate | undefined } = {}
): Record<string, unknown> => {
  const normalizedStep2 = step2Metadata === undefined
    ? []
    : Array.isArray(step2Metadata)
      ? step2Metadata
      : [step2Metadata]
  const partialStep2 = options.partialStep2 ?? []
  const costStep2 = [...normalizedStep2, ...partialStep2]
  const failures = options.failures ?? []
  const extractTargets = collectEstimatedExtractTargets(costStep2)
  const estimated = resolveExtractEstimatedCosts(options.preflightEstimate, costStep2)
  const observedEstimate = resolveExtractObservedEstimateCosts(costStep2)
  const actual = computeActualCosts({ step2: normalizedStep2, partialStep2 })
  const ocrDiagnostics = buildOcrCostDiagnostics(costStep2, estimated, actual)
  const cost = {
    estimated,
    observedEstimate,
    actual,
    ...(ocrDiagnostics.length > 0 ? { ocrDiagnostics } : {})
  }

  const estimatedTiming = computeEstimatedProcessingTimes({
    extractTargets: extractTargets.map((target) => ({
      provider: target.provider,
      model: target.model,
      pageCount: target.pageCount ?? step1Metadata.pageCount,
      ...(typeof target.rasterizedPages === 'number' ? { rasterizedPages: target.rasterizedPages } : {}),
      ...(typeof target.singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages: target.singlePagePdfFallbackPages } : {})
    })),
    ...(typeof options.ocrConcurrency === 'number' ? { ocrConcurrency: options.ocrConcurrency } : {}),
    ...(options.ocrConcurrencyMode ? { ocrConcurrencyMode: options.ocrConcurrencyMode } : {}),
    ...(typeof options.ocrProviderConcurrency === 'number' ? { ocrProviderConcurrency: options.ocrProviderConcurrency } : {}),
    ...(typeof options.ocrLocalConcurrency === 'number' ? { ocrLocalConcurrency: options.ocrLocalConcurrency } : {})
  })
  const actualTiming = computeActualProcessingTimes({
    step1: step1Metadata,
    step2: normalizedStep2,
    partialStep2,
    ...(typeof options.ocrProviderConcurrency === 'number' ? { ocrProviderConcurrency: options.ocrProviderConcurrency } : {}),
    ...(typeof options.ocrLocalConcurrency === 'number' ? { ocrLocalConcurrency: options.ocrLocalConcurrency } : {}),
    ...(options.hostedOcrScheduler ? { hostedOcrScheduler: options.hostedOcrScheduler } : {})
  })
  const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
    ? { estimated: estimatedTiming, actual: actualTiming }
    : undefined
  const hostedOcrScheduler = options.hostedOcrScheduler
    && options.hostedOcrScheduler.lanes.length > 0
    ? options.hostedOcrScheduler
    : undefined

  return {
    step1: step1Metadata,
    step2: serializeOneOrMany(normalizedStep2),
    ...(partialStep2.length > 0 ? { partialStep2 } : {}),
    ...(options.web ? { web: options.web } : {}),
    ...(options.source ? { source: options.source } : {}),
    ...(options.resolvedStep2 ? { resolvedStep2: options.resolvedStep2 } : {}),
    cost,
    ...(timing ? { timing } : {}),
    ...(hostedOcrScheduler ? { hostedOcrScheduler } : {}),
    ...(options.completionStatus ? { completionStatus: options.completionStatus } : {}),
    ...(options.requestedProviders ? { requestedProviders: options.requestedProviders } : {}),
    ...(options.providerStates ? { providerStates: options.providerStates } : {}),
    ...(options.missingProviders ? { missingProviders: options.missingProviders } : {}),
    ...(options.blockedProviders ? { blockedProviders: options.blockedProviders } : {}),
    ...(options.primaryProvider ? { primaryProvider: options.primaryProvider } : {}),
    ...(failures.length > 0 ? { errors: failures } : {}),
  }
}
