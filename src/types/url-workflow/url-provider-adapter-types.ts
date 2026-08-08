import type { HtmlArticleBackend, UrlArticleRunResult, UrlRequestOptions } from '~/types'

export type UrlArticleProviderAdapter = {
  id: HtmlArticleBackend
  displayName: string
  run: (
    source: string,
    sourceUrl: string | undefined,
    options?: UrlRequestOptions
  ) => Promise<UrlArticleRunResult>
}
