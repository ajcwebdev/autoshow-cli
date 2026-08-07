import type { TimingEntryLike, WriteStepKind } from '~/types'
import { formatCost } from '~/utils/app-logger/formatters'
import { resolveReverbModelLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-model-labels'

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const trimTrailingZeroes = (value: string): string =>
  value.replace(/\.0+($|[^0-9])/, '$1').replace(/(\.\d*?)0+($|[^0-9])/, '$1$2')

export const formatNumber = (value: number): string => {
  if (value >= 100) {
    return value.toFixed(0)
  }
  if (value >= 10) {
    return trimTrailingZeroes(value.toFixed(1))
  }
  return trimTrailingZeroes(value.toFixed(2))
}

export const formatCount = (value: number, singular: string, plural: string): string => {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : trimTrailingZeroes(value.toFixed(1))
  return `${rounded} ${value === 1 ? singular : plural}`
}

export const formatTokenCount = (value: number): string => {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : trimTrailingZeroes(value.toFixed(1))
  return `${rounded} tok`
}

export const formatSecondsShort = (value: number): string =>
  `${trimTrailingZeroes(value.toFixed(value >= 10 ? 0 : 1))}s`

export const resolveWhisperModel = (value: string): string => {
  const primary = value.split(' | ')[0] ?? value
  const match = primary.match(WHISPER_MODEL_PATH_PATTERN)
  if (match?.[1]) {
    return match[1]
  }
  return primary
}

const normalizeProviderForMatch = (step: WriteStepKind, provider: string): string => {
  if (step === 'llm' && provider === 'llama.cpp') {
    return 'llama'
  }
  return provider
}

const normalizeModelForMatch = (step: WriteStepKind, provider: string, model: string): string => {
  if (step === 'stt' && provider === 'whisper') {
    return resolveWhisperModel(model)
  }
  if (step === 'stt' && provider === 'reverb') {
    return 'reverb'
  }
  return model
}

export const buildMatchKey = (step: WriteStepKind, provider: string, model: string): string => {
  const normalizedProvider = normalizeProviderForMatch(step, provider)
  const normalizedModel = normalizeModelForMatch(step, normalizedProvider, model)
  return `${step}::${normalizedProvider}::${normalizedModel}`
}

export const buildProviderModelLabel = (provider: string, model: string): string => {
  const displayProvider = provider === 'whisper' ? 'whisper.cpp' : provider
  const displayModel = provider === 'reverb' ? resolveReverbModelLabel(model) : model
  return `${displayProvider}/${displayModel}`
}

export const formatPersistedWriteManifestThroughput = (
  throughputValue: number | undefined,
  throughputUnit: TimingEntryLike['throughputUnit'] | undefined
): string | null => {
  if (
    typeof throughputValue !== 'number'
    || !Number.isFinite(throughputValue)
    || throughputValue <= 0
    || !throughputUnit
  ) {
    return null
  }

  switch (throughputUnit) {
    case 'x':
      return `${formatNumber(throughputValue)}x`
    case 'tokensPerSecond':
      return `${formatNumber(throughputValue)} tok/s`
    case 'charactersPerSecond':
      return `${formatNumber(throughputValue)} char/s`
    case 'pagesPerMinute':
      return `${formatNumber(throughputValue)} p/min`
    case 'sectionsPerMinute':
      return `${formatNumber(throughputValue)} sections/min`
    case 'imagesPerMinute':
      return `${formatNumber(throughputValue)} img/min`
  }
}

export const formatPromptUsageTokenPair = (left: number, right: number): string =>
  `${formatTokenCount(left).replace(/ tok$/, '')}/${formatTokenCount(right).replace(/ tok$/, '')} tok`

export const getNumber = (record: Record<string, unknown>, key: string): number | undefined =>
  typeof record[key] === 'number' && Number.isFinite(record[key])
    ? record[key]
    : undefined

export const getRecord = (
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined =>
  typeof record[key] === 'object' && record[key] !== null && !Array.isArray(record[key])
    ? record[key] as Record<string, unknown>
    : undefined

export const formatInputSummary = (record: Record<string, unknown> | undefined): string | null => {
  if (!record) return null
  const promptTokens = getNumber(record, 'promptTokens')
  const completionTokens = getNumber(record, 'completionTokens')
  if (promptTokens !== undefined || completionTokens !== undefined) {
    return formatPromptUsageTokenPair(promptTokens ?? 0, completionTokens ?? 0)
  }

  const estimatedOutputChars = getNumber(record, 'estimatedOutputChars')
  if (estimatedOutputChars !== undefined) {
    return formatCount(estimatedOutputChars, 'char', 'chars')
  }

  const inputMetric = typeof record['inputMetric'] === 'string' ? record['inputMetric'] : undefined
  const inputValue = getNumber(record, 'inputValue')
  if (inputMetric && inputValue !== undefined) {
    switch (inputMetric) {
      case 'pages':
        return formatCount(inputValue, 'page', 'pages')
      case 'sections':
        return formatCount(inputValue, 'section', 'sections')
      case 'tokens':
        return formatTokenCount(inputValue)
      case 'outputCharacters':
      case 'characters':
        return formatCount(inputValue, 'char', 'chars')
      default:
        return `${formatNumber(inputValue)} ${inputMetric}`
    }
  }

  const pageCount = getNumber(record, 'pageCount')
  return pageCount !== undefined ? formatCount(pageCount, 'page', 'pages') : null
}

export const formatRatesSummary = (record: Record<string, unknown> | undefined): string | null => {
  if (!record) return null
  const formatRateCost = (value: number): string =>
    Number.isInteger(value) ? `${value}\u00A2` : formatCost(value)

  const parts = [
    getNumber(record, 'inputCostPer1MCents') !== undefined ? `${formatRateCost(getNumber(record, 'inputCostPer1MCents') as number)}/1M in` : null,
    getNumber(record, 'outputCostPer1MCents') !== undefined ? `${formatRateCost(getNumber(record, 'outputCostPer1MCents') as number)}/1M out` : null,
    getNumber(record, 'costPer1kPagesCents') !== undefined ? `${formatRateCost(getNumber(record, 'costPer1kPagesCents') as number)}/1k pages` : null,
    getNumber(record, 'costPer1kOutputCharsCents') !== undefined ? `${formatRateCost(getNumber(record, 'costPer1kOutputCharsCents') as number)}/1k chars` : null,
    getNumber(record, 'costMultiplier') !== undefined ? `x${formatNumber(getNumber(record, 'costMultiplier') as number)} estimate` : null
  ].filter((value): value is string => typeof value === 'string')
  return parts.length > 0 ? parts.join(' / ') : null
}
