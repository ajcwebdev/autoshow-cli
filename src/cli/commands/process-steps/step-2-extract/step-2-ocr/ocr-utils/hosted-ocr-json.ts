import type { HostedOcrPagePayload, NormalizeHostedOcrPagesOptions, PageResult } from '~/types'
import { ValidationError } from '~/utils/error-handler'

const ESCAPED_FORMATTING_PATTERN = /\\r\\n|\\n|\\r|\\t/g
const ESCAPED_LINE_BREAK_PATTERN = /\\r\\n|\\n|\\r/g
const ESCAPED_CHAPTER_HEADING_PATTERN = /(?:\\r\\n|\\n|\\r)\s*(?:chapter|part|book|section|[ivxlcdm]{1,12}\b)/i

const shouldDecodeEscapedFormatting = (text: string): boolean => {
  if (!text.match(ESCAPED_FORMATTING_PATTERN)) {
    return false
  }

  if (/\\t/.test(text)) {
    return true
  }

  const escapedLineBreaks = text.match(ESCAPED_LINE_BREAK_PATTERN)?.length ?? 0
  return escapedLineBreaks >= 2 || ESCAPED_CHAPTER_HEADING_PATTERN.test(text)
}

const normalizeHostedOcrPageText = (text: string): string => {
  if (!shouldDecodeEscapedFormatting(text)) {
    return text
  }

  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
}

export const buildHostedOcrJsonPrompt = (expectedPageCount: number): string => [
  'Perform OCR on the provided document or image.',
  'Return only JSON.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If a page is blank or unreadable, return that page with an empty string for text.',
  `Return exactly ${expectedPageCount} page objects with contiguous pageNumber values from 1 through ${expectedPageCount}.`
].join(' ')

export const normalizeHostedOcrPages = (
  value: readonly HostedOcrPagePayload[],
  expectedPageCount: number,
  options: NormalizeHostedOcrPagesOptions
): PageResult[] => {
  const pages = value
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => ({
      pageNumber: page.pageNumber,
      method: 'ocr' as const,
      text: normalizeHostedOcrPageText(page.text)
    }))

  if (pages.length === 0 && options.emptyPagesMessage) {
    throw ValidationError(options.emptyPagesMessage, { stage: 'ocr:hosted-json' })
  }

  if (pages.length !== expectedPageCount) {
    throw ValidationError(options.countMismatchMessage(pages.length, expectedPageCount), { stage: 'ocr:hosted-json' })
  }

  for (let i = 0; i < pages.length; i++) {
    const expectedPageNumber = i + 1
    if (pages[i]?.pageNumber !== expectedPageNumber) {
      throw ValidationError(options.nonContiguousMessage, { stage: 'ocr:hosted-json' })
    }
  }

  return pages
}
