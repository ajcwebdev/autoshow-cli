import type { AggregatedPriceEstimate, DocumentMetadata, ExtractionMetadata, OcrPoolLedger, OcrProviderMode, OcrRuntimeOptions, ProcessDocumentOutput, ProviderIdentityBase, ResolvedLLMModelOptions, SharedPipelineOptions, Step1SourceRef, Step3Metadata, WebArticleMetadata, WriteRuntimeOptions } from '~/types'

export type DocumentExtractionOptions = OcrRuntimeOptions
  & ResolvedLLMModelOptions
  & Pick<SharedPipelineOptions, 'outputRootDir' | 'configPath' | 'step2SelectionOrigins'>

export type WriteDocumentOutputMetadataOptions = {
  concurrencyMode?: import('~/types').HostedConcurrencyMode | undefined
  step1: DocumentMetadata
  step2: ExtractionMetadata | ExtractionMetadata[]
  step3: Step3Metadata | Step3Metadata[]
  preflightEstimate?: AggregatedPriceEstimate | undefined
  mistralOcrModel: string | undefined
  glmOcrModel: string | undefined
  kimiOcrModel: string | undefined
  openaiOcrModel: string | undefined
  grokOcrModel: string | undefined
  anthropicOcrModel: string | undefined
  geminiOcrModel: string | undefined
  deepinfraOcrModel: string | undefined
  llmService: string
  llmModel: string
  llmInputTokenCount: number
  llmOutputTokenCount: number
  artifactFiles: Record<string, string>
  completionStatus?: 'full' | 'incomplete' | 'failed' | undefined
  requestedProviders?: ProviderIdentityBase[] | undefined
  providerStates?: Array<Record<string, unknown>> | undefined
  missingProviders?: ProviderIdentityBase[] | undefined
  blockedProviders?: ProviderIdentityBase[] | undefined
  ocrProviderMode?: OcrProviderMode | undefined
  ocrPool?: OcrPoolLedger | undefined
  web?: WebArticleMetadata | undefined
  errors?: Array<ProviderIdentityBase & { message: string, category?: string, failureKind?: string, retryable?: boolean, quota?: boolean, providerWide?: boolean, blockedReason?: string, errorFile?: string }> | undefined
  ocrConcurrency?: number | undefined
  ocrConcurrencyMode?: OcrRuntimeOptions['ocrConcurrencyMode'] | undefined
  ocrProviderConcurrency?: number | undefined
  ocrLocalConcurrency?: number | undefined
}

export type RunExtractedDocumentWriteOptions = {
  target: string
  opts: WriteRuntimeOptions
  extraction: ProcessDocumentOutput
  sourceRef?: Step1SourceRef | undefined
  preflightEstimate?: AggregatedPriceEstimate | undefined
  extraArtifactFiles?: Record<string, string> | undefined
}
