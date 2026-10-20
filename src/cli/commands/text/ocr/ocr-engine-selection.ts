import type { ExtractionOptions, HostedExtractOcrEngine } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const assertNoRemovedOcrSelections = (options: object): void => {
  const values = options as Record<string, unknown>
  const removedKeys = ['glmOcrModel', 'glmOcrModels', 'kimiOcrModel', 'kimiOcrModels']
    .filter(key => values[key] !== undefined && values[key] !== null)
  if (removedKeys.length > 0) {
    throw UsageError('GLM and Kimi OCR models are no longer supported. Remove the obsolete selection and choose an active OCR provider explicitly.')
  }
}

export const hasMistralOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.mistralOcrModel === 'string' && opts.mistralOcrModel.length > 0

export const hasOpenAIOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.openaiOcrModel === 'string' && opts.openaiOcrModel.length > 0

export const hasGrokOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.grokOcrModel === 'string' && opts.grokOcrModel.length > 0

export const hasAnthropicOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.anthropicOcrModel === 'string' && opts.anthropicOcrModel.length > 0

export const hasGeminiOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.geminiOcrModel === 'string' && opts.geminiOcrModel.length > 0

export const hasDeepinfraOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.deepinfraOcrModel === 'string' && opts.deepinfraOcrModel.length > 0

export const hasHostedOcr = (opts: ExtractionOptions): boolean => {
  assertNoRemovedOcrSelections(opts)
  return hasMistralOcr(opts)
    || hasOpenAIOcr(opts)
    || hasGrokOcr(opts)
    || hasAnthropicOcr(opts)
    || hasGeminiOcr(opts)
    || hasDeepinfraOcr(opts)
}

export const hasOcrFlag = (opts: ExtractionOptions): boolean => {
  assertNoRemovedOcrSelections(opts)
  return opts.useTesseract === true || hasHostedOcr(opts)
}

export const hasEpubExportFlags = (opts: ExtractionOptions): boolean =>
  typeof opts.chapterFiles === 'boolean' || typeof opts.chapterChunkLimitChars === 'number'

export const countSelectedOcrEngines = (opts: ExtractionOptions): number => {
  assertNoRemovedOcrSelections(opts)
  return [
    hasMistralOcr(opts),
    hasOpenAIOcr(opts),
    hasGrokOcr(opts),
    hasAnthropicOcr(opts),
    hasGeminiOcr(opts),
    hasDeepinfraOcr(opts)
  ].filter(Boolean).length
}

export const getHostedOcrEngine = (opts: ExtractionOptions): HostedExtractOcrEngine | undefined => {
  assertNoRemovedOcrSelections(opts)
  if (hasMistralOcr(opts)) return 'mistral-ocr'
  if (hasOpenAIOcr(opts)) return 'openai-ocr'
  if (hasGrokOcr(opts)) return 'grok-ocr'
  if (hasAnthropicOcr(opts)) return 'anthropic-ocr'
  if (hasGeminiOcr(opts)) return 'gemini-ocr'
  if (hasDeepinfraOcr(opts)) return 'deepinfra-ocr'
  return undefined
}
