import type { ExtractionOptions, HostedExtractOcrEngine } from '~/types'

export const hasMistralOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.mistralOcrModel === 'string' && opts.mistralOcrModel.length > 0

export const hasGlmOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.glmOcrModel === 'string' && opts.glmOcrModel.length > 0

export const hasKimiOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.kimiOcrModel === 'string' && opts.kimiOcrModel.length > 0

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

export const hasReplicateOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.replicateOcrModel === 'string' && opts.replicateOcrModel.length > 0

export const hasFalOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.falOcrModel === 'string' && opts.falOcrModel.length > 0

export const hasHostedOcr = (opts: ExtractionOptions): boolean =>
  hasMistralOcr(opts)
  || hasGlmOcr(opts)
  || hasKimiOcr(opts)
  || hasOpenAIOcr(opts)
  || hasGrokOcr(opts)
  || hasAnthropicOcr(opts)
  || hasGeminiOcr(opts)
  || hasDeepinfraOcr(opts)
  || hasReplicateOcr(opts)
  || hasFalOcr(opts)

export const hasOcrFlag = (opts: ExtractionOptions): boolean =>
  opts.useTesseract === true || hasHostedOcr(opts)

export const hasEpubExportFlags = (opts: ExtractionOptions): boolean =>
  typeof opts.chapterFiles === 'boolean' || typeof opts.chapterChunkLimitChars === 'number'

export const countSelectedOcrEngines = (opts: ExtractionOptions): number =>
  [
    hasMistralOcr(opts),
    hasGlmOcr(opts),
    hasKimiOcr(opts),
    hasOpenAIOcr(opts),
    hasGrokOcr(opts),
    hasAnthropicOcr(opts),
    hasGeminiOcr(opts),
    hasDeepinfraOcr(opts),
    hasReplicateOcr(opts),
    hasFalOcr(opts)
  ].filter(Boolean).length

export const getHostedOcrEngine = (opts: ExtractionOptions): HostedExtractOcrEngine | undefined => {
  if (hasMistralOcr(opts)) return 'mistral-ocr'
  if (hasGlmOcr(opts)) return 'glm-ocr'
  if (hasKimiOcr(opts)) return 'kimi-ocr'
  if (hasOpenAIOcr(opts)) return 'openai-ocr'
  if (hasGrokOcr(opts)) return 'grok-ocr'
  if (hasAnthropicOcr(opts)) return 'anthropic-ocr'
  if (hasGeminiOcr(opts)) return 'gemini-ocr'
  if (hasDeepinfraOcr(opts)) return 'deepinfra-ocr'
  if (hasReplicateOcr(opts)) return 'replicate-ocr'
  if (hasFalOcr(opts)) return 'fal-ocr'
  return undefined
}
