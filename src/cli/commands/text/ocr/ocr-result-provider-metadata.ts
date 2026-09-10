import type { OcrResultBuilderInput } from '~/types'

const OCR_MODEL_FIELDS = [
  { method: 'mistral-ocr', field: 'mistralOcrModel' },
  { method: 'glm-ocr', field: 'glmOcrModel' },
  { method: 'kimi-ocr', field: 'kimiOcrModel' },
  { method: 'openai-ocr', field: 'openaiOcrModel' },
  { method: 'grok-ocr', field: 'grokOcrModel' },
  { method: 'anthropic-ocr', field: 'anthropicOcrModel' },
  { method: 'gemini-ocr', field: 'geminiOcrModel' },
  { method: 'deepinfra-ocr', field: 'deepinfraOcrModel' }
] as const

export const buildOcrProviderMetadata = (
  input: OcrResultBuilderInput
): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {}
  if (typeof input.ocrService === 'string') metadata['ocrService'] = input.ocrService
  const modelDescriptor = OCR_MODEL_FIELDS.find(({ method, field }) =>
    input.extractionMethod.includes(method) && typeof input.opts[field] === 'string'
  )
  if (modelDescriptor) metadata['ocrModel'] = input.opts[modelDescriptor.field]
  if (typeof input.providerCostCents === 'number') metadata['providerCostCents'] = input.providerCostCents
  if (input.providerCostSource) metadata['providerCostSource'] = input.providerCostSource
  if (input.ocrProviderUsage && input.ocrProviderUsage.length > 0) metadata['ocrProviderUsage'] = input.ocrProviderUsage
  if (typeof input.promptTokens === 'number') metadata['promptTokens'] = input.promptTokens
  if (typeof input.completionTokens === 'number') metadata['completionTokens'] = input.completionTokens
  if (input.requestedReasoningEffort !== undefined) metadata['requestedReasoningEffort'] = input.requestedReasoningEffort
  if (input.effectiveReasoningEffort !== undefined) metadata['effectiveReasoningEffort'] = input.effectiveReasoningEffort
  return metadata
}

export const buildOcrConversionMetadata = (
  input: OcrResultBuilderInput
): Record<string, unknown> => ({
  ...(input.pdfChunkPreparation ? { pdfChunkPreparation: input.pdfChunkPreparation } : {}),
  ...(input.chapterExportSummary ? { chapterExport: input.chapterExportSummary } : {}),
  ...(input.pdfChapterDetectionSummary ? { pdfChapterDetection: input.pdfChapterDetectionSummary } : {}),
  ...(input.inputFamily ? { inputFamily: input.inputFamily } : {}),
  ...(input.normalizedFrom ? { normalizedFrom: input.normalizedFrom } : {}),
  ...(input.conversionChain ? { conversionChain: input.conversionChain } : {}),
  ...(input.outputFidelity ? { outputFidelity: input.outputFidelity, outputFormat: input.opts.outputFormat } : {})
})
