import type { AggregatedPriceEstimate, DocumentMetadata, ExtractionMetadata, ExtractionOptions, HostedOcrScheduler, OcrPreparationCache, OcrProviderSuccess, OcrRequestedProvider, OcrTarget, PartialExtractionMetadata, ProviderCompletionStatus, Step1SourceRef, WebArticleMetadata } from '~/types'

export type OcrBatchRunContext = {
  outputDir: string
  requestedTargets: OcrTarget[]
  targetsToRun: OcrTarget[]
  opts: ExtractionOptions & { ocrConcurrencyMode: 'auto' | 'fixed' }
  effectiveOpts: ExtractionOptions
  ocrPreparationCache: OcrPreparationCache
  hostedOcrScheduler: HostedOcrScheduler
  step1Metadata: DocumentMetadata
  web?: WebArticleMetadata | undefined
  documentSource: Step1SourceRef
  extractFilePath: string
  preparedMarkdown?: string | undefined
  preflightEstimate?: AggregatedPriceEstimate | undefined
}

export type OcrBatchFinalization = {
  providerStates: Array<Record<string, unknown>>
  missingProviders: OcrRequestedProvider[]
  blockedProviders: OcrRequestedProvider[]
  completionStatus: ProviderCompletionStatus
  step2Metadata: ExtractionMetadata[]
  partialStep2: PartialExtractionMetadata[]
  primary: OcrProviderSuccess | undefined
  firstSuccess: OcrProviderSuccess | undefined
}
