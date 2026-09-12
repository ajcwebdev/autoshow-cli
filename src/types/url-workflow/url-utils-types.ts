import type { WebArticleMetadata } from '~/types'

export type UrlRequestOptions = {
  /** Explicit credential for an injected endpoint; ambient keys stay on hosted endpoints. */
  apiKey?: string | undefined
  timeoutMs?: number | undefined
  requestAttempts?: number | undefined
  requestSignal?: AbortSignal | undefined
}

export type UrlArticleRunResult = {
  markdown: string
  web: WebArticleMetadata
  fileSize: number
  title: string
  author?: string
}

export type RemoteHtmlFetchResult = {
  html: string
  finalUrl: string
  fileSize: number
}



export type FetchRemoteHtmlOptions = {
  timeoutMs?: number | undefined
  signal?: AbortSignal | undefined
  providerLabel?: string | undefined
}

export type LocalHtmlReadResult = {
  html: string
  fileSize: number
  localFileUrl: string
}

export type UrlArticleScrapeRunner = (
  source: string,
  options?: UrlRequestOptions,
  baseUrl?: string
) => Promise<{ markdown: string, web: WebArticleMetadata }>

