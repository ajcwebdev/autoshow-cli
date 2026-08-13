import type { FetchFn, ReferenceTokenizerMetadata } from '~/types'

export type FetchUrlResult = {
  sourceUrl: string
  fetchUrl: string
  finalUrl?: string
  status: 'success' | 'empty' | 'failed'
  content: string
  markdownContent: string
  failedUrl?: string
  failureReason?: string
}

export type LinksSelection = {
  serviceSelections: Map<string, string[]>
  globalSections: string[]
  refresh: boolean
  refreshOnly?: boolean
  inputFilePath?: string
  directUrl?: string
}

export type RunLinksOptions = {
  outputPath?: string | URL
  fetchImpl?: FetchFn
}

export type LinksSelectionMode = 'curated' | 'direct-url' | 'input-file'

export type LinksChangeStatus = 'new' | 'unchanged' | 'changed' | 'failed'

export type LinksRefreshLinkMetadata = {
  sourceUrl: string
  fetchUrl: string
  finalUrl?: string
  status: FetchUrlResult['status']
  changeStatus: LinksChangeStatus
  tokenCount: number
  tokenizer: ReferenceTokenizerMetadata
  contentHash: string | null
  byteCount: number
  characterCount: number
  lastRefreshAt: string
  lastSuccessfulRefreshAt?: string
  previousHash?: string
  previousTokenCount?: number
  failureReason?: string
}

export type LinksRefreshMetadata = {
  schemaVersion: 1
  command: 'links'
  selectionMode: LinksSelectionMode
  selection: {
    globalSections: string[]
    serviceSelections: Record<string, string[]>
    urls: string[]
    inputFilePath?: string
    directUrl?: string
  }
  outputPath: string
  sidecarPath: string
  markdownWritten?: boolean
  refreshedAt: string
  tokenizer: ReferenceTokenizerMetadata
  totals: {
    linkCount: number
    successfulCount: number
    emptyCount: number
    failedCount: number
    newCount: number
    unchangedCount: number
    changedCount: number
    failedChangeCount: number
    tokenCount: number
    byteCount: number
    characterCount: number
  }
  links: LinksRefreshLinkMetadata[]
}
