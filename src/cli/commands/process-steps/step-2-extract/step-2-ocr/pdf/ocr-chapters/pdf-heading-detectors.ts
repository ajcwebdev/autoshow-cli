import type { PageResult, ResolvedPdfChapter } from '~/types'
import {
  cleanExportLines,
  countWords,
  isLikelyArtifactText,
  isMostlyUppercase,
  isPlausibleTocTitle,
  isTocHeaderLine,
  normalizeDecoratedLabel,
  normalizeInlineWhitespace,
  normalizeTitle,
  ROMAN_RE,
  stripTocHeaderPrefix,
  TOC_PAGE_TITLE_RE
} from './text'

const HEADING_ARTIFACT_RE = /\b(?:isbn|library of congress|copyright|all rights reserved|cover design|back cover|front cover|title page|printed in|published by|publisher|web\.archive|archive\.org|internet archive|digitized by)\b/i
const HEADING_NOISE_CHARACTER_RE = /[<>\\{}\[\]|]/
const FRONT_MATTER_HEADING_RE = /^(acknowledg(?:e)?ment|prologue|epilogue|introduction|foreword|preface|appendix|footnotes?|selected bibliography|bibliography|index)\b/i

export const isLikelyTocEntryHeadingLine = (line: string): boolean => {
  const normalized = normalizeInlineWhitespace(line)
  if (normalized.length === 0) return false
  if (/^(?:chapter|chap\.?|part|book|section)\s+([0-9ivxlcdm]+)\s*$/i.test(normalized)) return false
  return /(?:(?:[.·]\s*){2,}|\s{2,})\s*([0-9]+|[ivxlcdm]+)\s*$/i.test(normalized)
    || /^[A-Za-z][A-Za-z0-9'’",:;!?() -]{2,80}\s+([0-9]+|[ivxlcdm]+)\s*$/i.test(normalized)
}

export const isLikelyTocPageText = (page: PageResult): boolean => {
  const topLines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0).slice(0, 12)
  const tocEntryLineCount = topLines.filter(isLikelyTocEntryHeadingLine).length
  return topLines.some((line) => TOC_PAGE_TITLE_RE.test(line))
    || tocEntryLineCount >= 2
    || (topLines.some(isTocHeaderLine) && tocEntryLineCount >= 1)
}

const isLikelyHeadingArtifactPage = (topLines: string[]): boolean =>
  topLines.filter((line) => HEADING_ARTIFACT_RE.test(line) || isLikelyArtifactText(line)).length >= 2

const resolveHeadingCandidate = (candidate: string | undefined, topLines: string[]): string | undefined => {
  if (!candidate) return undefined
  const cleaned = stripTocHeaderPrefix(candidate)
  const normalized = normalizeTitle(cleaned)
  const rejected = normalized.length === 0
    || TOC_PAGE_TITLE_RE.test(cleaned)
    || isTocHeaderLine(cleaned)
    || ['page', 'pages', 'chapter', 'chapters', 'front cover', 'back cover', 'title page'].includes(normalized)
    || HEADING_NOISE_CHARACTER_RE.test(cleaned)
    || HEADING_ARTIFACT_RE.test(cleaned)
    || isLikelyArtifactText(cleaned)
    || isLikelyTocEntryHeadingLine(cleaned)
    || isLikelyHeadingArtifactPage(topLines)
  return rejected ? undefined : candidate
}

type HeadingDetector = (lines: readonly string[]) => string | undefined

const detectFrontMatterHeading: HeadingDetector = (lines) => {
  const first = lines[0]
  if (first && FRONT_MATTER_HEADING_RE.test(first)) return first
  return lines.find((line) => countWords(line) <= 4 && FRONT_MATTER_HEADING_RE.test(line))
}

const detectRomanLabelHeading: HeadingDetector = ([first, second]) =>
  first && second && ROMAN_RE.test(normalizeDecoratedLabel(first)) && isPlausibleTocTitle(second) && isMostlyUppercase(second)
    ? second
    : undefined

const detectChapterStackHeading: HeadingDetector = ([first, second, third]) => {
  if (!first || !second || !third) return undefined
  if (!/^chapter$/i.test(normalizeDecoratedLabel(first))) return undefined
  if (!/^([0-9]+|[ivxlcdm]+)$/i.test(normalizeDecoratedLabel(second))) return undefined
  if (!isPlausibleTocTitle(third) || !isMostlyUppercase(third)) return undefined
  return ROMAN_RE.test(normalizeDecoratedLabel(second)) ? `${second} ${third}` : third
}

const detectNumberedPageHeading: HeadingDetector = ([first, second, third, fourth]) => {
  if (!first || !/^\d+$/.test(normalizeDecoratedLabel(first)) || !second) return undefined
  if (ROMAN_RE.test(normalizeDecoratedLabel(second)) && third && isPlausibleTocTitle(third) && isMostlyUppercase(third)) return third
  if (
    /^chapter$/i.test(normalizeDecoratedLabel(second))
    && third
    && ROMAN_RE.test(normalizeDecoratedLabel(third))
    && fourth
    && isPlausibleTocTitle(fourth)
    && isMostlyUppercase(fourth)
  ) return `${third} ${fourth}`
  return isPlausibleTocTitle(second) && isMostlyUppercase(second) ? second : undefined
}

const detectLabeledHeading: HeadingDetector = (lines) => {
  for (const [index, line] of lines.entries()) {
    if (/^(chapter|chap\.|part|book|section)\s+([0-9ivxlcdm]+)\b/i.test(line)) {
      const next = lines[index + 1]
      return next && isPlausibleTocTitle(next) && isMostlyUppercase(next) ? next : line
    }
    if (/^(prologue|epilogue|introduction|foreword|preface|appendix)\b/i.test(line)) return line
  }
  return undefined
}

const detectUppercaseHeading: HeadingDetector = ([first]) =>
  first && isPlausibleTocTitle(first) && isMostlyUppercase(first) ? first : undefined

const ORDERED_HEADING_DETECTORS: readonly HeadingDetector[] = [
  detectFrontMatterHeading,
  detectRomanLabelHeading,
  detectChapterStackHeading,
  detectNumberedPageHeading,
  detectLabeledHeading,
  detectUppercaseHeading
]

export const detectHeadingTitle = (page: PageResult): string | undefined => {
  const topLines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0).slice(0, 12)
  if (
    topLines.some((line) => TOC_PAGE_TITLE_RE.test(line) || isTocHeaderLine(line))
    || topLines.filter(isLikelyTocEntryHeadingLine).length >= 2
  ) return undefined
  for (const detector of ORDERED_HEADING_DETECTORS) {
    const heading = resolveHeadingCandidate(detector(topLines), topLines)
    if (heading) return heading
  }
  return undefined
}

export const buildHeadingCandidates = (pages: PageResult[]): ResolvedPdfChapter[] =>
  pages.flatMap((page) => {
    const heading = detectHeadingTitle(page)
    return heading
      ? [{ title: heading, pdfStartPage: page.pageNumber, source: 'heading' as const, confidence: 0.58 }]
      : []
  })
