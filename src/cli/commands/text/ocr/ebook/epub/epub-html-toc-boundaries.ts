import { decodeXmlEntities } from '~/utils/xml-scan'
import type { EpubTocItem, TocBoundary } from '~/types'
import { collapseWhitespace, cleanEpubHtmlFragmentToText } from './epub-inspection-markup'
import { tryDecodeURIComponent } from './epub-package-paths'

const HEADING_ADJUST_BEFORE_CHARS = 1200

const HEADING_ADJUST_AFTER_CHARS = 4000

const HEADING_ADJUST_AFTER_FALLBACK_CHARS = 1600

const HEADING_ADJUST_BEFORE_FALLBACK_CHARS = 800

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20'
}

const NUMBER_WORD_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g

const normalizeComparableText = (value: string): string =>
  collapseWhitespace(
    decodeXmlEntities(value)
      .toLowerCase()
      .replace(NUMBER_WORD_RE, word => NUMBER_WORDS[word] ?? word)
      .replace(/[^a-z0-9]+/g, ' ')
  )

const isMeaningfulHeadingText = (text: string): boolean =>
  text.length > 0 && !/^[\d\s-]+$/.test(text)

const headingTitleMatches = (headingText: string, title: string): boolean => {
  const headingKey = normalizeComparableText(headingText)
  const titleKey = normalizeComparableText(title)
  if (!headingKey || !titleKey) return false
  return headingKey.includes(titleKey) || titleKey.includes(headingKey)
}

const isChapterHeadingKey = (key: string): boolean =>
  /^(?:chapter|chatper)\s+(?:\d+|[ivxlcdm]+)\b/i.test(key)

const isChapterHeadingText = (text: string): boolean =>
  isChapterHeadingKey(normalizeComparableText(text))

const isLikelyHeadingLine = (text: string, title: string, tagName: string): boolean => {
  if (!isMeaningfulHeadingText(text)) {
    return false
  }
  if (tagName.toLowerCase().startsWith('h')) {
    return true
  }
  if (headingTitleMatches(text, title)) {
    return true
  }

  const key = normalizeComparableText(text)
  return isChapterHeadingKey(key)
    || /^(?:introduction|prologue|epilogue|table of contents|contents)$/.test(key)
}

const findNearbyHeadingStart = async (html: string, anchorOffset: number, tocTitle: string): Promise<number | undefined> => {
  const minOffset = Math.max(0, anchorOffset - HEADING_ADJUST_BEFORE_CHARS)
  const maxOffset = Math.min(html.length, anchorOffset + HEADING_ADJUST_AFTER_CHARS)
  const headingRegex = /<(h[1-6]|p)\b[\s\S]*?<\/\1>/gi
  const candidates: Array<{ start: number, end: number, text: string }> = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(html)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (end < minOffset) continue
    if (start > maxOffset) break

    const text = await cleanEpubHtmlFragmentToText(match[0])
    if (!isLikelyHeadingLine(text, tocTitle, match[1] ?? '')) continue
    candidates.push({ start, end, text })
  }

  const containing = candidates.find(candidate => candidate.start <= anchorOffset && candidate.end >= anchorOffset)
  if (containing) return containing.start

  const tocTitleIsChapter = isChapterHeadingText(tocTitle)
  const titleMatches = candidates
    .filter(candidate => headingTitleMatches(candidate.text, tocTitle))
    .sort((a, b) => {
      if (tocTitleIsChapter) {
        const chapterRank = Number(isChapterHeadingText(b.text)) - Number(isChapterHeadingText(a.text))
        if (chapterRank !== 0) return chapterRank
      }
      return Math.abs(a.start - anchorOffset) - Math.abs(b.start - anchorOffset)
    })
  if (titleMatches[0]) return titleMatches[0].start

  const after = candidates
    .filter(candidate => candidate.start >= anchorOffset && candidate.start - anchorOffset <= HEADING_ADJUST_AFTER_FALLBACK_CHARS)
    .sort((a, b) => a.start - b.start)
  if (after[0]) return after[0].start

  const before = candidates
    .filter(candidate => candidate.start < anchorOffset && anchorOffset - candidate.start <= HEADING_ADJUST_BEFORE_FALLBACK_CHARS)
    .sort((a, b) => b.start - a.start)
  return before[0]?.start
}

const fragmentCandidates = (fragment: string): Set<string> => {
  const decodedEntities = decodeXmlEntities(fragment)
  const decodedUri = tryDecodeURIComponent(decodedEntities)
  return new Set([
    fragment,
    decodedEntities,
    decodedUri,
    tryDecodeURIComponent(fragment)
  ].filter(value => value.length > 0))
}

const findFragmentAnchorOffset = (html: string, fragment: string): number | undefined => {
  const candidates = fragmentCandidates(fragment)
  const tagRegex = /<[^!?/][^>]*\s(?:id|name|xml:id)\s*=\s*(["'])(.*?)\1[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(html)) !== null) {
    const value = decodeXmlEntities(match[2] ?? '').trim()
    if (candidates.has(value) || candidates.has(tryDecodeURIComponent(value))) {
      return match.index
    }
  }

  return undefined
}

const resolveTocBoundaryOffset = async (
  html: string,
  tocItem: EpubTocItem,
  spinePath: string,
  warnings: string[]
): Promise<number | undefined> => {
  const fragment = tocItem.fragment
  if (!fragment) {
    return 0
  }

  const anchorOffset = findFragmentAnchorOffset(html, fragment)
  if (anchorOffset === undefined) {
    warnings.push(`TOC fragment target not found in ${spinePath}: #${fragment}`)
    return undefined
  }

  return await findNearbyHeadingStart(html, anchorOffset, tocItem.title) ?? anchorOffset
}

export const buildTocBoundaries = async (
  html: string,
  spinePath: string,
  tocItems: EpubTocItem[],
  warnings: string[]
): Promise<TocBoundary[]> => {
  const boundaries: TocBoundary[] = []
  for (const [tocOrder, tocItem] of tocItems.entries()) {
    const startOffset = await resolveTocBoundaryOffset(html, tocItem, spinePath, warnings)
    if (startOffset !== undefined) {
      boundaries.push({ tocItem, startOffset, tocOrder })
    }
  }

  return boundaries.sort((a, b) => a.startOffset - b.startOffset || a.tocOrder - b.tocOrder)
}
