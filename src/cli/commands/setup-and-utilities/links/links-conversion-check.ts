import type { LinksConversionBackend, LinksConversionCheck } from '~/types'

const NON_CONTENT_ELEMENTS = /<(script|style|svg|noscript|template|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi
const IDENTIFIER = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b[a-z]+(?:[A-Z][a-z0-9]+)+\b|\b(?=[a-z0-9.-]*\d)[a-z][a-z0-9]*(?:\.\d+)*(?:-[a-z0-9]+(?:\.\d+)*)+\b|\$\d+(?:[.,]\d+)*/g
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&nbsp;': ' ', '&#36;': '$'
}

// Every text node the server sent, minus page chrome. CSS visibility is ignored on purpose: whether an element is
// "hidden" is the judgement the converter gets wrong, so this side must not share it.
export const extractHtmlPlainText = (html: string): string =>
  html
    .replace(NON_CONTENT_ELEMENTS, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|nbsp|#x27|#39|#36);/g, entity => HTML_ENTITIES[entity] ?? entity)

// snake_case and camelCase names, hyphenated IDs that carry a digit (`voxtral-mini-2602`, `gpt-5.6-luna`), and dollar
// prices: the tokens a reference page exists to convey, and ones that prose rarely contains by accident.
export const collectIdentifiers = (text: string): Set<string> => new Set(text.match(IDENTIFIER) ?? [])

// HTML to markdown conversion is the only lossy step in a links run, and hashes and token counts cannot see what
// it dropped. This records which identifiers the page text holds that the markdown does not. The absolute figure
// is noisy (a converter is right to drop a related-models carousel), so a finding needs the previous capture to
// have held the identifier.
// Text that a page renders in the browser from a script payload is invisible to both sides.
export const checkHtmlConversion = (
  html: string,
  markdown: string,
  backend: LinksConversionBackend
): LinksConversionCheck => {
  const expected = collectIdentifiers(extractHtmlPlainText(html))
  const converted = collectIdentifiers(markdown.replace(/\\_/g, '_'))
  return {
    backend,
    identifierCount: expected.size,
    missingIdentifiers: [...expected].filter(identifier => !converted.has(identifier)).sort()
  }
}
