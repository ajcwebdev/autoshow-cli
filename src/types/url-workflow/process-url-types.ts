import type { ExtractionMetadata, ExtractionResult, HtmlArticleBackend, ProviderRunStateBase, UrlArticleRunResult } from '~/types'

export type UrlProviderState = ProviderRunStateBase<HtmlArticleBackend, { message: string }>

export type UrlProviderSuccess = {
  backend: HtmlArticleBackend
  article: UrlArticleRunResult
  result: ExtractionResult
  metadata: ExtractionMetadata
  attempts: number
  relativeDir?: string | undefined
}

export type UrlProviderFailure = {
  backend: HtmlArticleBackend
  message: string
  attempts: number
}

export type UrlProviderRunOutcome =
  | { status: 'succeeded', success: UrlProviderSuccess }
  | { status: 'failed', backend: HtmlArticleBackend, message: string, attempts: number }
  | { status: 'skipped', backend: HtmlArticleBackend, message: string }
