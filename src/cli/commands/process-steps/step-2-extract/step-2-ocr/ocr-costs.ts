import { isRecord } from '~/utils/rest-client'
import { getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { isTokenPricedOcrProvider } from '~/types'
import type { ActualCostBreakdown, AggregatedPriceEstimate, CollectEstimatedExtractTargetsOptions, EstimatedCostBreakdown, EstimatedStepEntry, ExtractEstimateProvider, ExtractEstimateTarget, ExtractionMetadata, OcrModelFallbackOptions, PartialExtractionMetadata, Step3Metadata } from '~/types'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { toArray } from '~/utils/text-utils'
import { computeObservedEstimateCosts, computePriceAlignedEstimatedCosts, preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { ANTHROPIC_OCR_PRICE_NOTE, DEEPINFRA_OCR_PRICE_NOTE, FIRECRAWL_PRICE_NOTE, GEMINI_OCR_PRICE_NOTE, GLM_OCR_PRICE_NOTE, GROK_OCR_PRICE_NOTE, KIMI_OCR_PRICE_NOTE, OPENAI_OCR_PRICE_NOTE } from '../extract-pricing/ocr-estimates'
import { resolveHostedOcrModeFromExtractionMethod } from './ocr-utils/hosted-ocr-token-profiles'
import { getUsageNumber } from './ocr-utils/hosted-ocr-utils'

const OCR_DIAGNOSTIC_PROVIDERS = new Set([
  'mistral',
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra'
])

const tokenProfileCostInput = (
  opts: OcrModelFallbackOptions
): Pick<OcrModelFallbackOptions, 'hostedOcrTokenProfilePath'> => ({
  ...(typeof opts.hostedOcrTokenProfilePath === 'string' ? { hostedOcrTokenProfilePath: opts.hostedOcrTokenProfilePath } : {})
})

export { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'


const isPartialExtractionMetadata = (
  entry: ExtractionMetadata | PartialExtractionMetadata
): entry is PartialExtractionMetadata =>
  (entry as PartialExtractionMetadata).status === 'failed_partial'

const getCompletedPageCount = (
  entry: ExtractionMetadata | PartialExtractionMetadata
): number =>
  isPartialExtractionMetadata(entry)
    ? Math.max(0, entry.completedPages)
    : Math.max(1, entry.totalPages)

const buildTokenTarget = (
  provider: Extract<'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra', ExtractEstimateProvider>,
  model: string,
  pageCount: number,
  ocrMode: string,
  effectiveReasoningEffort?: ExtractionMetadata['effectiveReasoningEffort'],
  note?: string
): ExtractEstimateTarget => ({
  provider,
  model,
  pageCount,
  ocrMode,
  ...(effectiveReasoningEffort !== undefined ? { effectiveReasoningEffort } : {}),
  estimateType: 'heuristic',
  ...(note ? { note } : {})
})

const withObservedTokenUsage = (
  target: ExtractEstimateTarget,
  entry: ExtractionMetadata,
  useObservedUsage: boolean | undefined
): ExtractEstimateTarget => {
  if (
    !useObservedUsage
    || !isTokenPricedOcrProvider(target.provider)
    || typeof entry.promptTokens !== 'number'
    || typeof entry.completionTokens !== 'number'
  ) {
    return target
  }

  return {
    ...target,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    ...(entry.effectiveReasoningEffort !== undefined ? { effectiveReasoningEffort: entry.effectiveReasoningEffort } : {}),
    tokenEstimateSource: 'exact',
    tokenEstimateConfidence: 'healthy',
    estimateType: 'exact'
  }
}

const getRasterizedPdfChunkPages = (entry: ExtractionMetadata): number | undefined => {
  const chunkPreparation = (entry as Record<string, unknown>)['pdfChunkPreparation']
  if (!isRecord(chunkPreparation) || typeof chunkPreparation['rasterizedPages'] !== 'number') {
    return undefined
  }
  const rasterizedPages = Math.max(0, Math.floor(chunkPreparation['rasterizedPages']))
  return rasterizedPages > 0 ? Math.min(rasterizedPages, Math.max(1, entry.totalPages)) : undefined
}

const getSinglePagePdfFallbackPages = (entry: ExtractionMetadata): number | undefined => {
  const chunkPreparation = (entry as Record<string, unknown>)['pdfChunkPreparation']
  if (!isRecord(chunkPreparation) || typeof chunkPreparation['strategy'] !== 'string') {
    return undefined
  }
  const hasPageFallbackWork = typeof chunkPreparation['directPageAttempts'] === 'number'
    || typeof chunkPreparation['rasterizedPages'] === 'number'
    || Array.isArray(chunkPreparation['tools'])
  return hasPageFallbackWork ? Math.max(1, entry.totalPages) : undefined
}

const withPdfChunkTiming = (
  entry: ExtractionMetadata,
  target: ExtractEstimateTarget
): ExtractEstimateTarget => {
  const rasterizedPages = getRasterizedPdfChunkPages(entry)
  const singlePagePdfFallbackPages = getSinglePagePdfFallbackPages(entry)
  return {
    ...target,
    ...(typeof rasterizedPages === 'number' ? { rasterizedPages } : {}),
    ...(typeof singlePagePdfFallbackPages === 'number' ? { singlePagePdfFallbackPages } : {})
  }
}

type TokenOcrEstimateProvider = Extract<'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra', ExtractEstimateProvider>

type TokenOcrEstimateDescriptor = Readonly<{
  fallbackModel: (opts: CollectEstimatedExtractTargetsOptions) => string
  note: string
}>

const TOKEN_OCR_ESTIMATE_DESCRIPTORS = {
  glm: { fallbackModel: opts => opts.glmOcrModels?.[0] || 'glm-ocr', note: GLM_OCR_PRICE_NOTE },
  kimi: { fallbackModel: opts => opts.kimiOcrModels?.[0] || 'kimi-ocr', note: KIMI_OCR_PRICE_NOTE },
  openai: { fallbackModel: opts => opts.openaiOcrModels?.[0] || 'openai-ocr', note: OPENAI_OCR_PRICE_NOTE },
  grok: { fallbackModel: opts => opts.grokOcrModels?.[0] || 'grok-4.3', note: GROK_OCR_PRICE_NOTE },
  anthropic: { fallbackModel: opts => opts.anthropicOcrModels?.[0] || 'anthropic-ocr', note: ANTHROPIC_OCR_PRICE_NOTE },
  gemini: { fallbackModel: opts => opts.geminiOcrModels?.[0] || 'gemini-ocr', note: GEMINI_OCR_PRICE_NOTE },
  deepinfra: { fallbackModel: opts => opts.deepinfraOcrModels?.[0] || 'deepinfra-ocr', note: DEEPINFRA_OCR_PRICE_NOTE },
} satisfies Record<TokenOcrEstimateProvider, TokenOcrEstimateDescriptor>

const isTokenEstimateProvider = (provider: string): provider is TokenOcrEstimateProvider =>
  provider in TOKEN_OCR_ESTIMATE_DESCRIPTORS

const poolUsageTargets = (entry: ExtractionMetadata | PartialExtractionMetadata): ExtractEstimateTarget[] | undefined => {
  if (entry.ocrProviderMode !== 'pool' || !Array.isArray(entry.ocrPoolTargetUsage)) return undefined
  return entry.ocrPoolTargetUsage.filter(isRecord).flatMap((usage): ExtractEstimateTarget[] => {
    const provider = typeof usage['provider'] === 'string' ? usage['provider'] : undefined
    const model = typeof usage['model'] === 'string' ? usage['model'] : undefined
    if (!provider || !model) return []
    const pageCount = typeof usage['attemptedPages'] === 'number' ? Math.max(0, Math.floor(usage['attemptedPages'])) : 0
    if (provider === 'tesseract') return [{ provider, model, pageCount, ocrMode: 'pool', ocrProviderMode: 'pool', estimateType: 'exact' as const }]
    if (provider === 'mistral') return [{ provider, model, pageCount, ocrMode: 'pool:pdf', ocrProviderMode: 'pool', estimateType: 'exact' as const }]
    if (!isTokenPricedOcrProvider(provider)) return []
    const promptTokens = typeof usage['promptTokens'] === 'number' ? usage['promptTokens'] : undefined
    const completionTokens = typeof usage['completionTokens'] === 'number' ? usage['completionTokens'] : undefined
    const effectiveReasoningEffort = typeof usage['effectiveReasoningEffort'] === 'string'
      ? usage['effectiveReasoningEffort'] as ExtractionMetadata['effectiveReasoningEffort']
      : undefined
    return [{
      provider,
      model,
      pageCount,
      ocrMode: 'pool',
      ocrProviderMode: 'pool',
      ...(promptTokens !== undefined ? { promptTokens } : {}),
      ...(completionTokens !== undefined ? { completionTokens } : {}),
      ...(effectiveReasoningEffort !== undefined ? { effectiveReasoningEffort } : {}),
      estimateType: promptTokens !== undefined && completionTokens !== undefined ? 'exact' as const : 'heuristic' as const,
    }]
  })
}

const HTML_EXACT_METHODS = new Set([
  'html+defuddle',
  'html+firecrawl',
  'html+glm-reader',
  'html+spider',
  'html+supadata',
  'html+zyte',
])

const htmlExtractionTarget = (entry: ExtractionMetadata): ExtractEstimateTarget | undefined => {
  if (!HTML_EXACT_METHODS.has(entry.extractionMethod)) return undefined
  const { provider, model } = resolveExtractionProviderModel(entry) as {
    provider: 'defuddle' | 'firecrawl' | 'glm-reader' | 'spider' | 'supadata' | 'zyte'
    model: string
  }
  return withPdfChunkTiming(entry, {
    provider,
    model,
    pageCount: Math.max(1, entry.totalPages),
    estimateType: 'exact',
    ...(provider === 'firecrawl' ? { note: FIRECRAWL_PRICE_NOTE } : {}),
  })
}

const hostedOcrTarget = (
  entry: ExtractionMetadata,
  opts: CollectEstimatedExtractTargetsOptions
): ExtractEstimateTarget | undefined => {
  const { provider, model } = resolveExtractionProviderModel(entry)
  const pageCount = Math.max(1, entry.totalPages)
  if (provider === 'mistral') return withPdfChunkTiming(entry, { provider, model: model || opts.mistralOcrModels?.[0] || 'mistral-ocr', pageCount, estimateType: 'exact' })
  if (provider === 'fal') return withPdfChunkTiming(entry, { provider, model: model || opts.falOcrModels?.[0] || 'fal-ai/got-ocr/v2', pageCount, estimateType: 'exact' })
  if (!isTokenEstimateProvider(provider)) return undefined
  const descriptor = TOKEN_OCR_ESTIMATE_DESCRIPTORS[provider]
  const target = buildTokenTarget(
    provider,
    model || descriptor.fallbackModel(opts),
    pageCount,
    resolveHostedOcrModeFromExtractionMethod(entry.extractionMethod, entry.inputFamily),
    entry.effectiveReasoningEffort,
    descriptor.note
  )
  return withPdfChunkTiming(entry, withObservedTokenUsage(target, entry, opts.useObservedUsage))
}

export const collectEstimatedExtractTargets = (
  metadata: ExtractionMetadata | PartialExtractionMetadata | Array<ExtractionMetadata | PartialExtractionMetadata>,
  opts: CollectEstimatedExtractTargetsOptions = {}
): ExtractEstimateTarget[] => toArray(metadata).flatMap(entry => {
  const poolTargets = poolUsageTargets(entry)
  if (poolTargets) return poolTargets
  const htmlTarget = htmlExtractionTarget(entry)
  if (htmlTarget) return [htmlTarget]
  if (entry.extractionMethod.startsWith('html+')) return []
  const hostedTarget = hostedOcrTarget(entry, opts)
  return hostedTarget ? [hostedTarget] : []
})

const buildMatchKey = (step: string, provider: string, model: string): string =>
  `${step}::${provider}::${model}`

const filterPreflightEstimate = (
  estimate: AggregatedPriceEstimate,
  allowedKeys: Set<string>
): AggregatedPriceEstimate => {
  const steps = estimate.steps.filter((step) => allowedKeys.has(buildMatchKey(step.step, step.provider, step.model)))
  return {
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0),
    ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
  }
}

export const resolveExtractEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  step2: ExtractionMetadata | PartialExtractionMetadata | Array<ExtractionMetadata | PartialExtractionMetadata>,
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => {
  const extractTargets = collectEstimatedExtractTargets(step2, opts)
  if (preflightEstimate) {
    const allowedKeys = new Set(extractTargets.map((target) => buildMatchKey('extract', target.provider, target.model)))
    return preflightToEstimated(filterPreflightEstimate(preflightEstimate, allowedKeys))
  }

  return computePriceAlignedEstimatedCosts(undefined, { extractTargets, ...tokenProfileCostInput(opts) })
}

export const resolveExtractObservedEstimateCosts = (
  step2: ExtractionMetadata | PartialExtractionMetadata | Array<ExtractionMetadata | PartialExtractionMetadata>,
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => computeObservedEstimateCosts({
  extractTargets: collectEstimatedExtractTargets(step2, {
    ...opts,
    useObservedUsage: true
  }),
  ...tokenProfileCostInput(opts)
})

export const resolveDocumentWriteEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  step2: ExtractionMetadata | ExtractionMetadata[],
  step3: Step3Metadata | Step3Metadata[],
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => {
  const extractTargets = collectEstimatedExtractTargets(step2, opts)
  const step3Entries = toArray(step3)

  if (preflightEstimate) {
    const allowedKeys = new Set([
      ...extractTargets.map((target) => buildMatchKey('extract', target.provider, target.model)),
      ...step3Entries.map((entry) => buildMatchKey('llm', entry.llmService, entry.llmModel))
    ])
    return preflightToEstimated(filterPreflightEstimate(preflightEstimate, allowedKeys))
  }

  return computePriceAlignedEstimatedCosts(undefined, {
    extractTargets,
    llmTargets: step3Entries.map((entry) => ({
      service: entry.llmService,
      model: entry.llmModel,
      inputTokens: entry.inputTokenCount,
      outputTokens: entry.outputTokenCount
    })),
    ...tokenProfileCostInput(opts)
  })
}

export const resolveDocumentWriteObservedEstimateCosts = (
  step2: ExtractionMetadata | ExtractionMetadata[],
  step3: Step3Metadata | Step3Metadata[],
  opts: OcrModelFallbackOptions = {}
): EstimatedCostBreakdown => {
  const extractTargets = collectEstimatedExtractTargets(step2, {
    ...opts,
    useObservedUsage: true
  })
  const step3Entries = toArray(step3)

  return computeObservedEstimateCosts({
    extractTargets,
    llmTargets: step3Entries.map((entry) => ({
      service: entry.llmService,
      model: entry.llmModel,
      inputTokens: entry.inputTokenCount,
      outputTokens: entry.outputTokenCount
    })),
    ...tokenProfileCostInput(opts)
  })
}

const rowsByKey = <T extends { step: string, provider: string, model: string }>(
  rows: T[]
): Map<string, T[]> => {
  const indexed = new Map<string, T[]>()
  for (const row of rows) {
    const key = buildMatchKey(row.step, row.provider, row.model)
    const existing = indexed.get(key) ?? []
    existing.push(row)
    indexed.set(key, existing)
  }
  return indexed
}

const getEstimatedInputMetric = (row: EstimatedStepEntry | undefined): string | undefined => {
  if (!row) return undefined
  if (typeof row.promptTokens === 'number' || typeof row.completionTokens === 'number') return 'tokens'
  if (typeof row.estimatedOutputChars === 'number') return 'outputCharacters'
  if (typeof row.pageCount === 'number') return 'pages'
  return undefined
}

const getEstimatedInputValue = (row: EstimatedStepEntry | undefined): number | undefined => {
  if (!row) return undefined
  if (typeof row.promptTokens === 'number' || typeof row.completionTokens === 'number') {
    return (row.promptTokens ?? 0) + (row.completionTokens ?? 0)
  }
  if (typeof row.estimatedOutputChars === 'number') return row.estimatedOutputChars
  if (typeof row.pageCount === 'number') return row.pageCount
  return undefined
}

const buildRatesUsed = (
  provider: string,
  model: string,
  estimated: EstimatedStepEntry | undefined
): Record<string, number> | undefined => {
  const registry = getExtractPricing(provider, model)
  const rates = {
    ...(typeof estimated?.inputCostPer1MCents === 'number'
      ? { inputCostPer1MCents: estimated.inputCostPer1MCents }
      : typeof registry.inputCostPer1MCents === 'number'
        ? { inputCostPer1MCents: registry.inputCostPer1MCents }
        : {}),
    ...(typeof estimated?.outputCostPer1MCents === 'number'
      ? { outputCostPer1MCents: estimated.outputCostPer1MCents }
      : typeof registry.outputCostPer1MCents === 'number'
        ? { outputCostPer1MCents: registry.outputCostPer1MCents }
        : {}),
    ...(typeof estimated?.costPer1kPagesCents === 'number'
      ? { costPer1kPagesCents: estimated.costPer1kPagesCents }
      : typeof registry.costPer1kPagesCents === 'number'
        ? { costPer1kPagesCents: registry.costPer1kPagesCents }
        : {}),
    ...(typeof estimated?.costMultiplier === 'number' ? { costMultiplier: estimated.costMultiplier } : {})
  }
  return Object.keys(rates).length > 0 ? rates : undefined
}

const getOcrProviderUsage = (entry: ExtractionMetadata): unknown[] | undefined => {
  const metadata = entry as Record<string, unknown>
  return Array.isArray(metadata['ocrProviderUsage']) ? metadata['ocrProviderUsage'] : undefined
}

const isSchemaRetryUsageEntry = (entry: unknown): entry is Record<string, unknown> =>
  isRecord(entry)
  && (
    entry['usageRole'] === 'schema-retry'
    || entry['purpose'] === 'ocr-schema-retry'
  )

const addSchemaRetryUsagePages = (
  pages: Set<number>,
  entry: Record<string, unknown>
): void => {
  const pageNumber = getUsageNumber(entry, ['pageNumber', 'page'])
  if (typeof pageNumber === 'number') {
    pages.add(Math.max(1, Math.floor(pageNumber)))
    return
  }

  const pageStart = getUsageNumber(entry, ['pageStart', 'startPage'])
  const pageEnd = getUsageNumber(entry, ['pageEnd', 'endPage'])
  if (typeof pageStart !== 'number') {
    return
  }

  const start = Math.max(1, Math.floor(pageStart))
  const end = typeof pageEnd === 'number'
    ? Math.max(start, Math.floor(pageEnd))
    : start
  for (let page = start; page <= end; page++) {
    pages.add(page)
  }
}

const buildSchemaRetryUsageSummary = (
  usageDetails: unknown[] | undefined
): Record<string, unknown> | undefined => {
  const retryEntries = (usageDetails ?? []).filter(isSchemaRetryUsageEntry)
  if (retryEntries.length === 0) {
    return undefined
  }

  const pages = new Set<number>()
  let promptTokens = 0
  let completionTokens = 0

  for (const entry of retryEntries) {
    addSchemaRetryUsagePages(pages, entry)
    promptTokens += getUsageNumber(entry, ['promptTokens', 'prompt_tokens']) ?? 0
    completionTokens += getUsageNumber(entry, ['completionTokens', 'completion_tokens']) ?? 0
  }

  const sortedPages = [...pages].sort((a, b) => a - b)
  return {
    count: retryEntries.length,
    ...(sortedPages.length > 0 ? { pages: sortedPages } : {}),
    promptTokens,
    completionTokens
  }
}

export const buildOcrCostDiagnostics = (
  step2: ExtractionMetadata | PartialExtractionMetadata | Array<ExtractionMetadata | PartialExtractionMetadata>,
  estimated: EstimatedCostBreakdown,
  actual: ActualCostBreakdown
): Record<string, unknown>[] => {
  const estimatedRows = rowsByKey(estimated.steps)
  const actualRows = rowsByKey(actual.steps)
  const occurrenceByKey = new Map<string, number>()
  const diagnostics: Record<string, unknown>[] = []

  for (const entry of toArray(step2)) {
    const { provider, model } = resolveExtractionProviderModel(entry)
    if (!OCR_DIAGNOSTIC_PROVIDERS.has(provider)) {
      continue
    }

    const key = buildMatchKey('extract', provider, model)
    const occurrence = occurrenceByKey.get(key) ?? 0
    occurrenceByKey.set(key, occurrence + 1)
    const predicted = estimatedRows.get(key)?.[occurrence]
    const actualRow = actualRows.get(key)?.[occurrence]
    const actualPromptTokens = actualRow?.promptTokens ?? entry.promptTokens
    const actualCompletionTokens = actualRow?.completionTokens ?? entry.completionTokens
    const predictedCostCents = predicted?.cost ?? 0
    const actualCostCents = actualRow?.cost ?? 0
    const ratesUsed = buildRatesUsed(provider, model, predicted)
    const usageDetails = getOcrProviderUsage(entry)
    const schemaRetryUsage = buildSchemaRetryUsageSummary(usageDetails)
    const retryUsageIncluded = schemaRetryUsage !== undefined
    const partial = isPartialExtractionMetadata(entry)
    const completedPages = getCompletedPageCount(entry)

    diagnostics.push({
      provider,
      model,
      pages: entry.totalPages,
      ...(partial
        ? {
            status: entry.status,
            completedPages,
            failedPages: entry.failedPages,
            artifactDir: entry.artifactDir,
            failure: entry.failure
          }
        : {}),
      predictedCostInputs: {
        costCents: predictedCostCents,
        ...(typeof predicted?.pageCount === 'number' ? { pageCount: predicted.pageCount } : { pageCount: entry.totalPages }),
        ...(getEstimatedInputMetric(predicted) ? { inputMetric: getEstimatedInputMetric(predicted) } : {}),
        ...(typeof getEstimatedInputValue(predicted) === 'number' ? { inputValue: getEstimatedInputValue(predicted) } : {}),
        ...(typeof predicted?.promptTokens === 'number' ? { promptTokens: predicted.promptTokens } : {}),
        ...(typeof predicted?.completionTokens === 'number' ? { completionTokens: predicted.completionTokens } : {}),
        ...(typeof predicted?.estimatedOutputChars === 'number' ? { estimatedOutputChars: predicted.estimatedOutputChars } : {}),
        ...(typeof predicted?.costMultiplier === 'number' ? { costMultiplier: predicted.costMultiplier } : {}),
        ...(typeof predicted?.estimateType === 'string' ? { estimateType: predicted.estimateType } : {})
      },
      actualCostInputs: {
        costCents: actualCostCents,
        pageCount: partial ? completedPages : entry.totalPages,
        ...(partial ? { status: entry.status, totalPages: entry.totalPages, failedPages: entry.failedPages } : {}),
        ...(typeof actualRow?.inputMetric === 'string' ? { inputMetric: actualRow.inputMetric } : {}),
        ...(typeof actualRow?.inputValue === 'number' ? { inputValue: actualRow.inputValue } : {}),
        ...(typeof actualPromptTokens === 'number' ? { promptTokens: actualPromptTokens } : {}),
        ...(typeof actualCompletionTokens === 'number' ? { completionTokens: actualCompletionTokens } : {}),
        ...(typeof actualRow?.costSource === 'string' ? { costSource: actualRow.costSource } : {}),
        ...(typeof entry.providerCostCents === 'number' ? { providerCostCents: entry.providerCostCents } : {}),
        ...(typeof entry.providerCostSource === 'string' ? { providerCostSource: entry.providerCostSource } : {}),
        ...(retryUsageIncluded ? { retryUsageIncluded: true } : {}),
        ...(schemaRetryUsage ? { schemaRetryUsage } : {}),
        ...(usageDetails ? { usageDetails } : {})
      },
      ...(ratesUsed ? { ratesUsed } : {}),
      delta: {
        costCents: actualCostCents - predictedCostCents,
        ...(predictedCostCents > 0 ? { percent: ((actualCostCents - predictedCostCents) / predictedCostCents) * 100 } : {})
      },
      source: isTokenPricedOcrProvider(provider)
        ? retryUsageIncluded ? 'token_usage_with_schema_retries' : 'token_usage'
        : 'page_pricing'
    })
  }

  return diagnostics
}
