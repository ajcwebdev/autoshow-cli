import type { AnyReportField, EstimatedCopiedFields, EstimatedStepEntry, ReportFieldRegistry, ReportStepIdentity, ReportValue, StepEstimate, StepFieldRegistry } from '~/types'

const STEP_FIELDS = {
  stt: ['costMultiplier', 'durationSeconds', 'estimateType'],
  extract: [
    'costMultiplier',
    'costPer1kPagesCents',
    'pageCount',
    'rasterizedPages',
    'singlePagePdfFallbackPages',
    'estimatedOutputChars',
    'inputCostPer1MCents',
    'outputCostPer1MCents',
    'pricingBand',
    'pricingNote',
    'promptTokens',
    'completionTokens',
    'ocrMode',
    'requestedReasoningEffort',
    'effectiveReasoningEffort',
    'tokenEstimateSource',
    'tokenEstimateConfidence',
    'tokenProfileSampleCount',
    'tokenProfilePromptTokensPerPage',
    'tokenProfileCompletionTokensPerPage',
    'estimateType'
  ],
  llm: [
    'costMultiplier',
    'inputCostPer1MCents',
    'outputCostPer1MCents',
    'estimatedInputTokens',
    'estimatedOutputTokens',
    'requestedReasoningEffort',
    'effectiveReasoningEffort',
    'pricingBand',
    'pricingNote'
  ],
  tts: [
    'costMultiplier',
    'costPerRequestCents',
    'requestCount',
    'costPer1kCharactersCents',
    'inputCostPer1MCharactersCents',
    'outputCostPer1MCharactersCents',
    'setupCostCents',
    'estimateType'
  ],
  image: ['costMultiplier', 'imageCount'],
  video: ['costMultiplier', 'durationSeconds'],
  music: ['costMultiplier', 'durationSeconds']
} as const satisfies StepFieldRegistry

const pickDefined = <TOutput extends object>(
  source: object,
  fields: readonly (keyof TOutput)[]
): Partial<TOutput> => {
  const input = source as Record<PropertyKey, unknown>
  const output: Partial<TOutput> = {}
  const writableOutput = output as Record<PropertyKey, unknown>

  for (const field of fields) {
    const value = input[field]
    if (value !== undefined) writableOutput[field] = value
  }

  return output
}

export const stepEstimateToEstimated = (estimate: StepEstimate): EstimatedStepEntry => ({
  step: estimate.step,
  provider: estimate.provider,
  model: estimate.model,
  cost: estimate.totalCost,
  ...pickDefined<EstimatedCopiedFields>(estimate, STEP_FIELDS[estimate.step])
})

const STEP_REPORT_FIELDS = {
  stt: [],
  extract: [
    'costPer1kPagesCents',
    'inputCostPer1MCents',
    'outputCostPer1MCents',
    ['pageCount', 'pages'],
    ['estimatedOutputChars', 'estOutputChars'],
    'promptTokens',
    'completionTokens',
    'requestedReasoningEffort',
    'effectiveReasoningEffort',
    'tokenEstimateSource',
    'tokenEstimateConfidence',
    'pricingBand',
    'pricingNote',
    'estimateType'
  ],
  llm: [
    'inputCostPer1MCents',
    'outputCostPer1MCents',
    ['estimatedInputTokens', 'estInputTokens'],
    ['estimatedOutputTokens', 'estOutputTokens'],
    'requestedReasoningEffort',
    'effectiveReasoningEffort',
    'pricingBand',
    'pricingNote'
  ],
  tts: [
    ['characterCount', 'characters'],
    ['requestCount', 'requests'],
    'costPerRequestCents',
    'setupCostCents'
  ],
  image: [],
  video: [],
  music: []
} as const satisfies ReportFieldRegistry

const pickReportFields = (
  source: StepEstimate,
  fields: readonly AnyReportField[]
): Record<string, ReportValue> => {
  const input = source as unknown as Record<PropertyKey, unknown>
  const output: Record<string, ReportValue> = {}

  for (const field of fields) {
    const sourceKey = typeof field === 'string' ? field : field[0]
    const outputKey = typeof field === 'string' ? field : field[1]
    const value = input[sourceKey]
    if (typeof value === 'string' || typeof value === 'number') output[outputKey] = value
  }

  return output
}

export const stepEstimateToReport = (
  estimate: StepEstimate,
  identity: ReportStepIdentity = estimate
): Record<string, ReportValue> => ({
  step: estimate.step,
  provider: identity.provider,
  model: identity.model,
  ...pickReportFields(estimate, STEP_REPORT_FIELDS[estimate.step]),
  totalCostCents: estimate.totalCost
})
