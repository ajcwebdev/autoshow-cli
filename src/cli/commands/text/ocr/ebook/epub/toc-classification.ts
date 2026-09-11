import { normalizeInlineWhitespace } from './text-split'

export const PAGE_LIKE_TOC_RATIO = 0.8
export const BODY_TEXT_TOC_RATIO = 0.6
export const MIN_BODY_TEXT_TOC_STARTS = 2
export const MIN_HEADING_FALLBACK_CHAPTERS = 2

const normalizePageLikeKey = (value: string): string =>
  normalizeInlineWhitespace(value).toLowerCase().replace(/[\s_.-]+/g, '')

export const isPageLikeTocTitle = (value: string): boolean =>
  /^page(?:\d+|[ivxlcdm]+)$/.test(normalizePageLikeKey(value))

export const normalizeGenericTocKey = (value: string): string =>
  normalizeInlineWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const isGenericTocTitle = (value: string): boolean => {
  const key = normalizeGenericTocKey(value)
  if (key.length === 0) {
    return true
  }

  return [
    'body',
    'book',
    'contents',
    'cover',
    'cover page',
    'document',
    'main',
    'main body',
    'main text',
    'page',
    'pages',
    'start',
    'text',
    'title',
    'title page',
    'untitled',
    'toc',
    'table of contents'
  ].includes(key)
}
