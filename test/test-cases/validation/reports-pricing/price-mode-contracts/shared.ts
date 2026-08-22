import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { getExtractEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { CommandPricingOptions, ExtractionMetadata, Step2Metadata } from '~/types'

import { isRecord } from '../../../../test-utils/test-helpers'
export { isRecord }

export const buildSttMetadata = (overrides: Partial<Step2Metadata> = {}): Step2Metadata => ({
  transcriptionService: 'deepgram',
  transcriptionModel: 'nova-3',
  processingTime: 1234,
  tokenCount: 0,
  ...overrides
})

export const buildOcrTimingMetadata = (input: {
  service: 'kimi' | 'gemini'
  model: string
  pageCount: number
  preparation: NonNullable<ExtractionMetadata['pdfChunkPreparation']>
}): ExtractionMetadata => ({
  extractionMethod: input.service === 'kimi' ? 'pdf+kimi-ocr' : 'pdf+gemini-ocr',
  totalPages: input.pageCount,
  ocrPages: input.pageCount,
  textPages: 0,
  processingTime: 1234,
  dpi: 300,
  languages: 'eng',
  tokenEstimate: 10_000,
  ocrService: input.service,
  ocrModel: input.model,
  pdfChunkPreparation: input.preparation
})

export const findPricingNoteKeys = (value: unknown): string[] => {
  const keys: string[] = []
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item)
      return
    }
    if (!isRecord(entry)) {
      return
    }
    for (const [key, child] of Object.entries(entry)) {
      if (key === 'note' || key === 'notes') {
        keys.push(key)
      }
      visit(child)
    }
  }

  visit(value)
  return keys
}

export const parseJsonLines = (text: string): unknown[] =>
  text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') && line.endsWith('}'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown]
      } catch {
        return []
      }
    })

export const MULTI_PAGE_PDF = 'input/examples/document/3-document.pdf'

export const missingHostedOcrProfilePath = (): string =>
  join(tmpdir(), `autoshow-missing-ocr-profile-${process.pid}-${Date.now()}-${Math.random()}.json`)

export const HOSTED_OCR_PROVIDER_CASES = [
  { provider: 'mistral', flagName: 'mistral-ocr', modelsKey: 'mistralOcrModels', model: 'mistral-ocr-2512' },
  { provider: 'glm', flagName: 'glm-ocr', modelsKey: 'glmOcrModels', model: 'glm-ocr' },
  { provider: 'kimi', flagName: 'kimi-ocr', modelsKey: 'kimiOcrModels', model: 'kimi-k2.6' },
  { provider: 'openai', flagName: 'openai-ocr', modelsKey: 'openaiOcrModels', model: 'gpt-5.4-nano' },
  { provider: 'grok', flagName: 'grok-ocr', modelsKey: 'grokOcrModels', model: 'grok-4.3' },
  { provider: 'anthropic', flagName: 'anthropic-ocr', modelsKey: 'anthropicOcrModels', model: 'claude-haiku-4-5' },
  { provider: 'gemini', flagName: 'gemini-ocr', modelsKey: 'geminiOcrModels', model: 'gemini-3.5-flash-lite' },
  { provider: 'deepinfra', flagName: 'deepinfra-ocr', modelsKey: 'deepinfraOcrModels', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' }
] as const

export const KIMI_OCR_PROVIDER_CASE = HOSTED_OCR_PROVIDER_CASES[2]

export const expectedOcrProcessingMs = (
  provider: string,
  model: string,
  pageCount: number,
  concurrency = DEFAULT_OCR_CONCURRENCY
): number => {
  const pageBatches = Math.ceil(pageCount / Math.min(pageCount, Math.max(1, concurrency)))
  return Math.round(pageBatches * getExtractEstimation(provider, model).msPerPage)
}

export const buildHostedOcrPricingOptions = (
  providerCases: readonly (typeof HOSTED_OCR_PROVIDER_CASES[number])[] = HOSTED_OCR_PROVIDER_CASES
): CommandPricingOptions => {
  const opts: Record<string, unknown> = {
    step2SelectionOrigins: Object.fromEntries(providerCases.map((providerCase) => [providerCase.flagName, 'explicit'])),
    useTesseract: false,
    urlBackend: 'defuddle',
    urlBackendExplicit: false,
    textInput: false
  }

  for (const providerCase of providerCases) {
    opts[providerCase.modelsKey] = [providerCase.model]
  }

  return opts as CommandPricingOptions
}
