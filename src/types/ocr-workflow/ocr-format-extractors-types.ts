import type { EpubArtifactFile, HostedOcrRun, NormalizedReasoningEffort, PageResult } from '~/types'

export type FormatExtractionResult = {
  pages: PageResult[]
  extractionMethod: string
  inputFamily?: string | undefined
  normalizedFrom?: string | undefined
  conversionChain?: string[] | undefined
  outputFidelity?: string | undefined
  canonicalText?: string | undefined
  reportedTotalPages?: number | undefined
  ocrService?: string | undefined
  promptTokens?: number | undefined
  completionTokens?: number | undefined
  providerCostCents?: number | undefined
  providerCostSource?: HostedOcrRun['providerCostSource'] | undefined
  ocrProviderUsage?: HostedOcrRun['providerUsage'] | undefined
  pdfChunkPreparation?: HostedOcrRun['pdfChunkPreparation'] | undefined
  chapterExportSummary?: Record<string, unknown> | undefined
  pdfChapterDetectionSummary?: Record<string, unknown> | undefined
  artifactFiles?: EpubArtifactFile[] | undefined
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}
