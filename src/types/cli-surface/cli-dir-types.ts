import type { HostedOcrScheduler, PipelineItemRecord, ResolvedLLMModelOptions, ResolvedStep2Provider } from '~/types'

export type BatchItem = {
  id: string
  url: string
  title?: string
  author?: string
  publishedAt?: string
  duration?: string
  description?: string
  directDownload?: boolean
  meta?: Record<string, unknown>
}

export type BatchChildRunContext = {
  batchDir: string
  batchItem?: BatchItem
  outputDir?: string
  hostedOcrScheduler?: HostedOcrScheduler | undefined
}

export type BatchSource = {
  sourceKind: 'podcast_rss' | 'youtube_channel' | 'youtube_playlist' | 'url_list'
  sourceUrl: string
  title?: string
  author?: string
  image?: string
  link?: string
  items: BatchItem[]
}

export type BatchProcessResult = {
  ok: number
  partial: number
  incomplete: number
  fail: number
  batchDir?: string
  failureExitCode?: number
}

export type BatchRunOptions = {
  source?: BatchSource
  selectedItems?: Array<BatchItem | undefined>
  concurrency?: number
  totalCount?: number
  initialRecords?: PipelineItemRecord[]
  resultEntryIndexes?: number[]
  parentBatchDir?: string | undefined
  extractRoute?: ExtractRoute | undefined
}

export type ResolvedLLMConfig = ResolvedLLMModelOptions & {
  llmService: string | undefined
  llmModel: string | undefined
}

export type InputFamily = 'media' | 'document' | 'html_article' | 'x_space' | 'unsupported'
export type ExtractRoute = 'media' | 'document' | 'article' | 'x-space'

export type Step2Modality = 'media' | 'document' | 'article'

export type ResolvedStep2Execution =
  | {
      route: 'stt'
      sourceKind: 'media'
      providers: ResolvedStep2Provider[]
    }
  | {
      route: 'ocr'
      sourceKind: 'pdf' | 'image' | 'epub-pdf' | 'cbz-images'
      providers: ResolvedStep2Provider[]
    }
  | {
      route: 'article'
      sourceKind: 'article'
      providers: ResolvedStep2Provider[]
    }
  | {
      route: 'native-document'
      sourceKind: 'epub' | 'office' | 'rtf' | 'csv'
    }
  | {
      route: 'unsupported'
      sourceKind: 'unsupported'
    }

export type PlannedBatchInput = {
  input: string
  inputFamily: InputFamily
  resolvedStep2: ResolvedStep2Execution
  extractRoute?: ExtractRoute | undefined
  batchItem?: BatchItem | undefined
}

export type ResolvedBatch = {
  source: BatchSource
  selectedUrls: string[]
  selectedItems: BatchItem[]
  totalCount: number
}
