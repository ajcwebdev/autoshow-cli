import type { HtmlArticleBackend, UrlArticleRunResult, UrlRequestOptions } from '~/types'
export type UrlArticleProviderCapability =
  | 'remote-html'
  | 'local-html'
  | 'main-content'
  | 'full-content'
  | 'selectors'
  | 'wait'
  | 'timeout'
  | 'geo'
  | 'locale'
  | 'structured-extraction'
  | 'screenshot'
  | 'batch'
  | 'crawl'
  | 'map'
  | 'search'
  | 'browser-actions'

export type UrlArticleRunOptions = UrlRequestOptions & {
  contentScope?: 'main' | 'full' | undefined
  includeSelectors?: string[] | undefined
  excludeSelectors?: string[] | undefined
  waitMs?: number | undefined
  geo?: {
    country?: string | undefined
    languages?: string[] | undefined
    locale?: string | undefined
  } | undefined
  structuredExtraction?: boolean | undefined
  screenshot?: boolean | undefined
  batch?: boolean | undefined
  crawl?: boolean | undefined
  map?: boolean | undefined
  search?: boolean | undefined
  browserActions?: unknown[] | undefined
}

export type UrlArticleProviderAdapter = {
  id: HtmlArticleBackend
  displayName: string
  capabilities: readonly UrlArticleProviderCapability[]
  run: (
    source: string,
    sourceUrl: string | undefined,
    options?: UrlArticleRunOptions
  ) => Promise<UrlArticleRunResult>
}

export type CapabilityTarget = Pick<UrlArticleProviderAdapter, 'displayName' | 'capabilities'>
