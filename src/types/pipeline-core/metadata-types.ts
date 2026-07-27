import type {
BatchItem,
BatchSource,
ExtractRoute,
InputFamily,
PlannedBatchInput,
ResolvedBatch,
ResolvedStep2Execution
} from '../cli-surface/cli-dir-types'

export type MetadataScalar = string | number | boolean | null

export type YtDlpAuthMode = 'cookies-file' | 'cookies-from-browser' | 'none'

export type YtDlpListOptions = {
  limit?: number
  all?: boolean
  order?: 'newest' | 'oldest'
}

export type BatchOrder = 'newest' | 'oldest'


export type DocFormat =
  | 'pdf' | 'epub' | 'png' | 'jpg' | 'tif' | 'docx' | 'pptx' | 'xlsx' | 'odf'
  | 'mobi' | 'azw3' | 'fb2' | 'lit' | 'cbz' | 'rtf' | 'csv' | 'webp' | 'bmp' | 'gif'
  | 'html'


export type ParsedEpisode = {
  id: string | undefined
  enclosureUrl: string
  title: string | undefined
  pubDate: string | undefined
  duration: string | undefined
  description: string | undefined
}


export type ResolvedInputRouting = {
  family: InputFamily
  step2Route: 'stt' | 'ocr' | 'article' | 'native-document' | 'unsupported'
  resolvedStep2: ResolvedStep2Execution
  extractRoute?: ExtractRoute | undefined
  supported: boolean
  skipReason?: string | undefined
}


export type ResolvedProcessTargetPlan =
  | { kind: 'directory', targets: string[] }
  | { kind: 'input_list', resolvedBatch: ResolvedBatch }
  | { kind: 'resolved_batch', resolvedBatch: ResolvedBatch }
  | { kind: 'youtube_collection', targets: string[] }
  | { kind: 'single', target: string }

export type BatchExecutionPlan = {
  label: string
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: Record<string, unknown>[]
  resultEntryIndexes: number[]
  plannedInputs: PlannedBatchInput[]
  source?: BatchSource
  totalCount?: number
}
