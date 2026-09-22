import type { CliCommandContext, CliParseResult, FetchFn, ReferenceTokenizerMetadata } from '~/types'

export type FetchUrlResult = {
  sourceUrl: string
  fetchUrl: string
  finalUrl?: string
  status: 'success' | 'empty' | 'failed'
  content: string
  markdownContent: string
  conversion?: LinksConversionCheck
  failedUrl?: string
  failureReason?: string
}

export type LinksConversionBackend = 'defuddle' | 'firecrawl'

// Identifiers (field names, camelCase names, prices) found in an HTML page's text, and those the converted markdown lost.
export type LinksConversionCheck = {
  backend: LinksConversionBackend
  identifierCount: number
  missingIdentifiers: string[]
}

export type LinksModelSourceKind = 'pricing' | 'catalog'

export type LinksModelSource = {
  url: string
  kinds: LinksModelSourceKind[]
  models: { step: string, service: string, model: string }[]
}

export type LinksSelection = {
  serviceSelections: Map<string, string[]>
  globalSections: string[]
  refresh: boolean
  inputFilePath?: string
  directUrl?: string
}

export type RunLinksOptions = {
  outputPath?: string | URL
  fetchImpl?: FetchFn
  modelSources?: readonly LinksModelSource[]
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
  contentHash: string | null
  byteCount: number
  characterCount: number
  lastRefreshAt: string
  lastSuccessfulRefreshAt?: string
  changeHash?: string | null
  previousHash?: string
  previousChangeHash?: string
  previousTokenCount?: number
  startLine?: number
  lineCount?: number
  linesAdded?: number
  linesRemoved?: number
  conversion?: LinksRefreshConversionMetadata
  modelSource?: LinksModelSourceKind[]
  failureReason?: string
}

export type LinksRefreshConversionMetadata = {
  backend: LinksConversionBackend
  identifierCount: number
  identifierRecall: number
  missingIdentifiers: string[]
  // Missing identifiers that the previous capture of this link held: what this run's conversion newly dropped.
  lostIdentifiers?: string[]
}

export type LinksRefreshFindingStatus =
  | 'http-error'
  | 'fetch-failed'
  | 'empty'
  | 'login-redirect'
  | 'duplicate-target'
  | 'redirect'
  | 'duplicate-content'
  | 'shrunk'
  | 'conversion-loss'
  | 'model-undocumented'

export type LinksRefreshFinding = {
  sourceUrl: string
  provider?: string
  section?: string
  status: LinksRefreshFindingStatus
  detail: string
}

export type LinksRefreshMetadata = {
  schemaVersion: 2
  command: 'links'
  selectionMode: LinksSelectionMode
  selection: {
    globalSections: string[]
    serviceSelections: Record<string, string[]>
    urls: string[]
    modelSourceUrls: string[]
    inputFilePath?: string
    directUrl?: string
  }
  outputPath: string
  sidecarPath: string
  changesPath?: string
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
    attentionCount: number
  }
  findings: LinksRefreshFinding[]
  links: LinksRefreshLinkMetadata[]
}

export type LinksParsedCommand = Pick<CliCommandContext, 'argv' | 'flags' | 'rawParsed'> | CliParseResult
