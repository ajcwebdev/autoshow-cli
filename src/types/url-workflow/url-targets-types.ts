import type { HtmlArticleBackend } from '~/types'

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
