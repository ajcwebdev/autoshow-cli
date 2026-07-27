import type { WebArticleMetadata } from '~/types'

export type ExtractHtmlToMarkdownInput = {
  html: string
  documentUrl: string
  sourceUrl?: string
  finalUrl?: string
}

export type ExtractHtmlToMarkdownResult = {
  markdown: string
  web: WebArticleMetadata
  title?: string
  author?: string
}
