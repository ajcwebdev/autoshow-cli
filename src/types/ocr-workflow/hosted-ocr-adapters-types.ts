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

/**
 * One hosted OCR provider's full contract: how it is selected, what it accepts directly,
 * where its published limits come from, how a request is made, and how its response maps
 * onto the shared `HostedOcrRun`. Dispatch, label lookup, limit lookup, and image-format
 * validation all read this registry, so a new provider cannot be wired into one of those
 * and forgotten in the others.
 */
export type HostedOcrAdapterDescriptor = {
  service: HostedOcrService
  engine: HostedExtractOcrEngine
  label: string
  /** Published-limits citation quoted in over-limit usage errors. */
  limitSource: string
  /** Formats the provider accepts without local normalization. */
  directImageFormats: readonly string[]
  /** Explains the accepted formats and normalization path when an input is rejected. */
  directImageSupportError: string
  /** Returns the configured model when this provider is the selected one. */
  selectModel: (opts: ExtractionOptions) => string | undefined
  ensureSetup: () => Promise<void>
  request: (request: HostedOcrAdapterRequest) => Promise<HostedOcrRun>
  /** Page-rendering strategy; providers that accept whole documents omit it. */
  fallbackOptions?: ((opts: ExtractionOptions, ocrModel: string) => HostedOcrFallbackOptions) | undefined
}
