import * as v from 'valibot'
import type { HostedOcrPagePayload, NormalizeHostedOcrPagesOptions, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import { ValidationError } from '~/utils/error-handler'

export const HostedOcrEnvelopeSchema = v.object({
  pages: v.array(v.object({
    pageNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
    text: v.string()
  }))
})

export const HOSTED_OCR_PAGES_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pageNumber', 'text'],
        properties: {
          pageNumber: {
            type: 'integer',
            minimum: 1
          },
          text: {
            type: 'string'
          }
        }
      }
    }
  }
} as const

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

export const createHostedOcrResponseParser = (
  providerLabel: string,
  stage: string
): ((rawText: string, expectedPageCount: number) => PageResult[]) => {
  const normalizePages = (value: unknown, expectedPageCount: number): PageResult[] => {
    const parsed = v.safeParse(HostedOcrEnvelopeSchema, value)
    if (!parsed.success) {
      throw ValidationError(`${providerLabel} response did not match the expected page schema.`, { stage })
    }

    return normalizeHostedOcrPages(parsed.output.pages, expectedPageCount, {
      emptyPagesMessage: `${providerLabel} returned no pages.`,
      countMismatchMessage: (actual, expected) => `${providerLabel} returned ${actual} pages, expected ${expected}.`,
      nonContiguousMessage: `${providerLabel} returned non-contiguous page numbers.`
    })
  }

  return (rawText: string, expectedPageCount: number): PageResult[] => {
    const validation = parseAndValidateStructured(HostedOcrEnvelopeSchema, rawText)
    if (!validation.success) {
      throw new OcrStructuredResponseError(validation.issue ?? `${providerLabel} response was not valid JSON.`, rawText)
    }

    try {
      return normalizePages(validation.value, expectedPageCount)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new OcrStructuredResponseError(message, rawText)
    }
  }
}
