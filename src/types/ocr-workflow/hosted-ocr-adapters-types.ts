import type {
  DocumentMetadata,
  ExtractionOptions,
  HostedExtractOcrEngine,
  HostedOcrRun,
  HostedOcrSchedulerRetryPressureHandler,
  HostedOcrService,
  RunHostedOcrPdfChunkFallbackOptions
} from '~/types'

export type HostedOcrAdapterRequest = {
  inputPath: string
  inputMetadata: DocumentMetadata
  ocrModel: string
  opts: ExtractionOptions
  onRetryable?: HostedOcrSchedulerRetryPressureHandler | undefined
  pageNumber?: number | undefined
}

export type HostedOcrFallbackOptions = Pick<
  RunHostedOcrPdfChunkFallbackOptions,
  'createChunk' | 'chunkFormat' | 'chunkExtension' | 'forcePageMode'
>

export type HostedOcrAdapterDescriptor = {
  service: HostedOcrService
  engine: HostedExtractOcrEngine
  label: string
  limitSource: string
  directImageFormats: readonly string[]
  directImageSupportError: string
  selectModel: (opts: ExtractionOptions) => string | undefined
  ensureSetup: () => Promise<void>
  request: (request: HostedOcrAdapterRequest) => Promise<HostedOcrRun>
  fallbackOptions?: ((opts: ExtractionOptions, ocrModel: string) => HostedOcrFallbackOptions) | undefined
}
