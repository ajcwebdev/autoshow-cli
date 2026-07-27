import type { UrlArticleRunResult } from '~/types'

export type UrlArticleProviderRunWithStats = {
  article: UrlArticleRunResult
  attempts: number
}
