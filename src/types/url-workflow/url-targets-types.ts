import type { HostedConcurrencyRuntimeOptions, HtmlArticleBackend, OcrRuntimeOptions, UrlSelectionOptions } from '~/types'

export type UrlExtractionOptions = OcrRuntimeOptions & UrlSelectionOptions & HostedConcurrencyRuntimeOptions & {
  outputRootDir: string
  urlProviderConcurrency: number
  urlRequestTimeoutMs: number
  urlRequestAttempts: number
}

export type UrlArticleBackendPlan = {
  remote: boolean
  sourceRef: { url?: string, filePath?: string }
  sourceUrl: string | undefined
  allUrlMode: boolean
  selectedBackends: HtmlArticleBackend[]
  requestedBackends: HtmlArticleBackend[]
  runnableBackends: HtmlArticleBackend[]
  skippedBackends: HtmlArticleBackend[]
  ignoresHostedBackendForLocalHtml: boolean
}
