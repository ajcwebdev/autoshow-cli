import type { DocumentMetadata, EpubArtifactFile, ExtractionOptions, HostedOcrRun, NormalizedReasoningEffort, PageResult } from '~/types'

export type OcrResultBuilderInput = {
  start: number
  pages: PageResult[]
  extractionMethod: string
  step1Metadata: DocumentMetadata
  opts: ExtractionOptions
  inputFamily: string | undefined
  normalizedFrom: string | undefined
  conversionChain: string[] | undefined
  outputFidelity: string | undefined
  canonicalText: string | undefined
  reportedTotalPages: number | undefined
  ocrService: string | undefined
  promptTokens: number | undefined
  completionTokens: number | undefined
  providerCostCents: number | undefined
  providerCostSource: HostedOcrRun['providerCostSource'] | undefined
  ocrProviderUsage: HostedOcrRun['providerUsage'] | undefined
  pdfChunkPreparation: HostedOcrRun['pdfChunkPreparation'] | undefined
  chapterExportSummary: Record<string, unknown> | undefined
  pdfChapterDetectionSummary: Record<string, unknown> | undefined
  artifactFiles: EpubArtifactFile[] | undefined
  requestedReasoningEffort?: NormalizedReasoningEffort | undefined
  effectiveReasoningEffort?: NormalizedReasoningEffort | undefined
}
