import type { AggregatedPriceEstimate, DocumentMetadata, ExtractionOptions, HostedOcrScheduler, OcrTarget, Step1SourceRef, WebArticleMetadata } from '~/types'

export type OcrSingleRunContext = {
  outputDir: string
  explicitTargets: OcrTarget[]
  opts: ExtractionOptions & { ocrConcurrencyMode: 'auto' | 'fixed' }
  effectiveOpts: ExtractionOptions
  hostedOcrScheduler: HostedOcrScheduler
  step1Metadata: DocumentMetadata
  web?: WebArticleMetadata | undefined
  documentSource: Step1SourceRef
  extractFilePath: string
  preparedMarkdown?: string | undefined
  preflightEstimate?: AggregatedPriceEstimate | undefined
}
