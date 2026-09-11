import type { HeadingCandidate, HeadingDetectionContext, HeadingKind, TextLine } from '~/types'
import { normalizeInlineWhitespace } from './text-split'
import { isGenericTocTitle, isPageLikeTocTitle, normalizeGenericTocKey } from './toc-classification'

const stripTrailingHeadingPunctuation = (value: string): string =>
  value.replace(/\s*[:.;-]\s*$/g, '').trim()

const chapterNumberPattern = '(?:\\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)'
const headingSubtitleSeparatorPattern = '(?:\\s*[:.;]\\s*|\\s+-\\s*)'
const chapterHeadingRegex = new RegExp(`^(chapter|chatper)\\s+(${chapterNumberPattern})(?:${headingSubtitleSeparatorPattern}(.*))?$`, 'i')
const standaloneChapterLabelRegex = /^(chapter|chatper)$/i
const standaloneChapterNumberRegex = new RegExp(`^${chapterNumberPattern}$`, 'i')
export const normalizedChapterBaseRegex = new RegExp(`^(chapter|chatper)\\s+(${chapterNumberPattern})\\b`, 'i')
const appendixHeadingRegex = new RegExp(`^appendix\\s+([a-z]|\\d+|[ivxlcdm]+)(?:${headingSubtitleSeparatorPattern}(.*))?$`, 'i')
const aboutAuthorHeadingRegex = new RegExp(`^(about\\s+(?:the\\s+)?author)(?:${headingSubtitleSeparatorPattern}(.*))?$`, 'i')
const namedHeadingRegex = new RegExp(`^(introduction|prologue|preface|foreword|afterword|epilogue|conclusion|finality)(?:${headingSubtitleSeparatorPattern}(.*))?$`, 'i')
const backmatterHeadingRegex = new RegExp(`^(notes|select bibliography|bibliography|references|index)(?:${headingSubtitleSeparatorPattern}(.*))?$`, 'i')
const numberedBookHeadingRegex = /^([1-9]\d{0,2})\s+(.+)$/
const numberedBookHeadingMaxNumber = 200
const numberedPageHeaderMinNumber = 20
const dateMonthRegex = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
const splitChapterSubtitleMaxLength = 100
const splitChapterSubtitleMaxWords = 12
const splitChapterSubtitleStopwords = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with'
])
const emptyHeadingDetectionContext: HeadingDetectionContext = {
  titleLikeKeys: new Set()
}

export const normalizeHeadingKey = (value: string): string =>
  normalizeGenericTocKey(value)
    .replace(/\bchatper\b/g, 'chapter')

const formatChapterNumber = (value: string): string =>
  /^[ivxlcdm]+$/i.test(value) ? value.toUpperCase() : value

const formatAppendixLabel = (value: string): string =>
  /^[a-z]$/i.test(value) ? value.toUpperCase() : formatChapterNumber(value)

const stripOuterHeadingQuotes = (value: string): string =>
  value.replace(/^['"‘“]\s*/, '').replace(/\s*['"’”]$/, '').trim()

const looksLikeNumberedDate = (number: number, title: string): boolean =>
  dateMonthRegex.test(title) || /\b\d{4}\b/.test(title) || number > numberedBookHeadingMaxNumber

export const stripLeadingNumberedTitleKey = (value: string): string =>
  value.replace(/^([1-9]\d{0,2}|[ivxlcdm]+)\s+/, '').trim()

const containsWholeHeadingKey = (outer: string, inner: string): boolean =>
  outer === inner || ` ${outer} `.includes(` ${inner} `)

const titleKeyMatchesKnownTitle = (titleKey: string, knownTitleKeys: ReadonlySet<string>): boolean => {
  if (titleKey.length === 0 || isGenericTocTitle(titleKey)) {
    return false
  }

  for (const knownKey of knownTitleKeys) {
    if (
      knownKey.length > 0
      && !isGenericTocTitle(knownKey)
      && (containsWholeHeadingKey(knownKey, titleKey) || containsWholeHeadingKey(titleKey, knownKey))
    ) {
      return true
    }
  }

  return false
}

const looksLikeNumberedPageHeader = (
  number: number,
  title: string,
  context: HeadingDetectionContext
): boolean =>
  number >= numberedPageHeaderMinNumber
  && titleKeyMatchesKnownTitle(normalizeHeadingKey(title), context.titleLikeKeys)

const looksLikeNumberedListParagraph = (title: string): boolean => {
  const words = title.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 10) {
    return true
  }

  const first = words[0] ?? ''
  if (!/^['"‘“]?[A-Z]/.test(first)) {
    return true
  }

  if (/[.!?]\s*$/.test(title) || /[,;]\s/.test(title)) {
    return true
  }

  const key = normalizeHeadingKey(title)
  return /^(?:chapter|chatper|section|part|figure|table)\b/.test(key)
}

const extractSemanticHeading = (
  line: string,
  context = emptyHeadingDetectionContext
): { title: string, kind: HeadingKind } | undefined => {
  const normalized = normalizeInlineWhitespace(line)
  if (normalized.length === 0 || normalized.length > 140 || isPageLikeTocTitle(normalized)) {
    return undefined
  }

  const chapterMatch = normalized.match(chapterHeadingRegex)
  if (chapterMatch) {
    const prefix = `Chapter ${formatChapterNumber(chapterMatch[2] ?? '')}`.trim()
    const subtitle = normalizeInlineWhitespace(chapterMatch[3] ?? '')
    return {
      title: subtitle.length > 0 ? `${prefix}: ${subtitle}` : stripTrailingHeadingPunctuation(prefix),
      kind: 'chapter'
    }
  }

  const appendixMatch = normalized.match(appendixHeadingRegex)
  if (appendixMatch) {
    const prefix = `Appendix ${formatAppendixLabel(appendixMatch[1] ?? '')}`.trim()
    const subtitle = normalizeInlineWhitespace(appendixMatch[2] ?? '')
    return {
      title: subtitle.length > 0 ? `${prefix}: ${subtitle}` : stripTrailingHeadingPunctuation(prefix),
      kind: 'appendix'
    }
  }

  const aboutAuthorMatch = normalized.match(aboutAuthorHeadingRegex)
  if (aboutAuthorMatch) {
    const subtitle = normalizeInlineWhitespace(aboutAuthorMatch[2] ?? '')
    return {
      title: subtitle.length > 0 ? `About the Author: ${subtitle}` : 'About the Author',
      kind: 'about-author'
    }
  }

  const namedMatch = normalized.match(namedHeadingRegex)
  if (namedMatch) {
    const title = stripTrailingHeadingPunctuation(namedMatch[1] ?? normalized)
    const subtitle = normalizeInlineWhitespace(namedMatch[2] ?? '')
    return {
      title: subtitle.length > 0 ? `${title}: ${subtitle}` : title,
      kind: 'named'
    }
  }

  const backmatterMatch = normalized.match(backmatterHeadingRegex)
  if (backmatterMatch) {
    const title = stripTrailingHeadingPunctuation(backmatterMatch[1] ?? normalized)
    const subtitle = normalizeInlineWhitespace(backmatterMatch[2] ?? '')
    return {
      title: subtitle.length > 0 ? `${title}: ${subtitle}` : title,
      kind: 'backmatter'
    }
  }

  const numberedMatch = normalized.match(numberedBookHeadingRegex)
  if (numberedMatch) {
    const number = Number.parseInt(numberedMatch[1] ?? '', 10)
    const title = stripTrailingHeadingPunctuation(stripOuterHeadingQuotes(normalizeInlineWhitespace(numberedMatch[2] ?? '')))
    if (
      Number.isFinite(number)
      && title.length > 0
      && !looksLikeNumberedDate(number, title)
      && !looksLikeNumberedPageHeader(number, title, context)
      && !looksLikeNumberedListParagraph(title)
    ) {
      return {
        title: `${number} ${title}`,
        kind: 'numbered'
      }
    }
  }

  return undefined
}

export const extractSemanticHeadingTitle = (line: string, context = emptyHeadingDetectionContext): string | undefined =>
  extractSemanticHeading(line, context)?.title

const buildTextLines = (text: string): TextLine[] => {
  const rawLines = text.split('\n')
  const lines: TextLine[] = []
  let offset = 0

  for (const [index, raw] of rawLines.entries()) {
    const start = offset
    const end = start + raw.length
    lines.push({
      index,
      start,
      trimmed: raw.trim()
    })
    offset = end + 1
  }

  return lines
}

const nextNonEmptyLine = (lines: TextLine[], startIndex: number): TextLine | undefined => {
  for (let index = startIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    if (line && line.trimmed.length > 0) {
      return line
    }
  }
  return undefined
}

const cleanSplitChapterSubtitle = (value: string): string =>
  stripTrailingHeadingPunctuation(stripOuterHeadingQuotes(normalizeInlineWhitespace(value)))

const isLikelySplitChapterSubtitle = (value: string): boolean => {
  const normalized = cleanSplitChapterSubtitle(value)
  if (
    normalized.length === 0
    || normalized.length > splitChapterSubtitleMaxLength
    || isPageLikeTocTitle(normalized)
    || isGenericTocTitle(normalized)
    || /[.!?]\s*$/.test(normalized)
    || /(?:\.{2,}|\s{2,})\s*\d{1,4}$/.test(normalized)
  ) {
    return false
  }

  if (
    chapterHeadingRegex.test(normalized)
    || appendixHeadingRegex.test(normalized)
    || aboutAuthorHeadingRegex.test(normalized)
    || namedHeadingRegex.test(normalized)
    || backmatterHeadingRegex.test(normalized)
    || standaloneChapterLabelRegex.test(normalized)
    || standaloneChapterNumberRegex.test(normalized)
  ) {
    return false
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > splitChapterSubtitleMaxWords) {
    return false
  }

  const firstLetter = /[A-Za-z]/.exec(normalized)?.[0]
  if (!firstLetter || firstLetter !== firstLetter.toUpperCase()) {
    return false
  }

  const bodyCaseWords = words.filter((word) => {
    const cleanWord = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
    return cleanWord.length > 3
      && /^[a-z]/.test(cleanWord)
      && !splitChapterSubtitleStopwords.has(cleanWord.toLowerCase())
  })

  return bodyCaseWords.length <= 1
}

const buildSplitChapterHeading = (
  lines: TextLine[],
  prefix: string,
  lineIndex: number
): { title: string, consumedThroughLineIndex: number } => {
  const subtitleLine = nextNonEmptyLine(lines, lineIndex)
  if (!subtitleLine || !isLikelySplitChapterSubtitle(subtitleLine.trimmed)) {
    return {
      title: stripTrailingHeadingPunctuation(prefix),
      consumedThroughLineIndex: lineIndex
    }
  }

  return {
    title: `${stripTrailingHeadingPunctuation(prefix)}: ${cleanSplitChapterSubtitle(subtitleLine.trimmed)}`,
    consumedThroughLineIndex: subtitleLine.index
  }
}

const extractHeadingCandidateAtLine = (
  lines: TextLine[],
  lineIndex: number,
  context = emptyHeadingDetectionContext
): HeadingCandidate | undefined => {
  const line = lines[lineIndex]
  if (!line || line.trimmed.length === 0) {
    return undefined
  }

  const chapterMatch = line.trimmed.match(chapterHeadingRegex)
  if (chapterMatch) {
    const prefix = `Chapter ${formatChapterNumber(chapterMatch[2] ?? '')}`.trim()
    const subtitle = normalizeInlineWhitespace(chapterMatch[3] ?? '')
    const splitHeading = subtitle.length > 0
      ? {
          title: `${prefix}: ${subtitle}`,
          consumedThroughLineIndex: lineIndex
        }
      : buildSplitChapterHeading(lines, prefix, lineIndex)

    return {
      title: splitHeading.title,
      key: normalizeHeadingKey(splitHeading.title),
      start: line.start,
      lineIndex,
      consumedThroughLineIndex: splitHeading.consumedThroughLineIndex,
      kind: 'chapter'
    }
  }

  const semanticHeading = extractSemanticHeading(line.trimmed, context)
  if (semanticHeading) {
    return {
      title: semanticHeading.title,
      key: normalizeHeadingKey(semanticHeading.title),
      start: line.start,
      lineIndex,
      consumedThroughLineIndex: lineIndex,
      kind: semanticHeading.kind
    }
  }

  if (!standaloneChapterLabelRegex.test(line.trimmed)) {
    return undefined
  }

  const numberLine = nextNonEmptyLine(lines, lineIndex)
  if (!numberLine || !standaloneChapterNumberRegex.test(numberLine.trimmed)) {
    return undefined
  }

  const splitPrefix = `Chapter ${formatChapterNumber(numberLine.trimmed)}`
  const splitHeading = buildSplitChapterHeading(lines, splitPrefix, numberLine.index)
  return {
    title: splitHeading.title,
    key: normalizeHeadingKey(splitHeading.title),
    start: line.start,
    lineIndex,
    consumedThroughLineIndex: splitHeading.consumedThroughLineIndex,
    kind: 'chapter'
  }
}

const findPrintedTocLineIndex = (lines: TextLine[]): number | undefined =>
  lines.find((line) => /^(?:table of )?contents$/i.test(line.trimmed))?.index

const isPrintedTocPageRefLine = (line: string): boolean =>
  /(?:^|[\s.])\d{1,4}\s*$/.test(line)
  && /[A-Za-z]/.test(line)
  && normalizeInlineWhitespace(line).split(/\s+/).length <= 12

const isPrintedTocSegment = (lines: string[]): boolean => {
  const pageRefLines = lines.filter(isPrintedTocPageRefLine).length
  return pageRefLines >= 3 && pageRefLines / Math.max(lines.length, 1) >= 0.25
}

const isBodyLikeHeadingSegment = (text: string, candidate: HeadingCandidate, nextCandidate?: HeadingCandidate): boolean => {
  const segment = text.slice(candidate.start, nextCandidate?.start ?? text.length)
  const lines = segment
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(1)
  if (isPrintedTocSegment(lines)) {
    return false
  }

  return lines.some((line) =>
    line.length >= 70
    && /[a-z]/.test(line)
    && /[.!?,"']/.test(line)
    && !extractSemanticHeadingTitle(line)
  )
}

const filterPrintedTocCandidates = (
  text: string,
  candidates: HeadingCandidate[],
  tocLineIndex: number | undefined
): HeadingCandidate[] => {
  if (tocLineIndex === undefined) {
    return candidates
  }

  const filtered: HeadingCandidate[] = []
  let foundBodyStart = false

  for (const [index, candidate] of candidates.entries()) {
    if (candidate.lineIndex <= tocLineIndex || foundBodyStart) {
      filtered.push(candidate)
      continue
    }

    if (isBodyLikeHeadingSegment(text, candidate, candidates[index + 1])) {
      foundBodyStart = true
      filtered.push(candidate)
    }
  }

  return filtered
}

const isNotesHeadingCandidate = (candidate: HeadingCandidate): boolean =>
  candidate.kind === 'backmatter' && normalizeHeadingKey(candidate.title) === 'notes'

const isRealChapterAfterNotesCandidate = (candidate: HeadingCandidate): boolean =>
  candidate.kind === 'chapter' && candidate.title.includes(':')

const isAfterwordCandidate = (candidate: HeadingCandidate): boolean =>
  candidate.kind === 'named' && normalizeHeadingKey(candidate.title) === 'afterword'

const isChapterLocalNotesCandidate = (candidates: HeadingCandidate[], index: number): boolean => {
  const candidate = candidates[index]
  return candidate !== undefined
    && isNotesHeadingCandidate(candidate)
    && candidates.slice(index + 1).some((candidate) =>
      isRealChapterAfterNotesCandidate(candidate) || isAfterwordCandidate(candidate)
    )
}

export const filterNotesSubheadingCandidates = (
  candidates: HeadingCandidate[],
  insideNotesAtStart = false
): HeadingCandidate[] => {
  const filtered: HeadingCandidate[] = []
  let insideNotes = insideNotesAtStart

  for (const [index, candidate] of candidates.entries()) {
    if (isChapterLocalNotesCandidate(candidates, index)) {
      continue
    }

    if (insideNotes && (candidate.kind === 'chapter' || candidate.kind === 'numbered')) {
      if (isRealChapterAfterNotesCandidate(candidate)) {
        insideNotes = false
        filtered.push(candidate)
        continue
      }
      continue
    }

    filtered.push(candidate)
    if (candidate.kind === 'backmatter') {
      insideNotes = isNotesHeadingCandidate(candidate)
    }
  }

  return filtered
}

export const findHeadingCandidates = (
  text: string,
  context = emptyHeadingDetectionContext
): HeadingCandidate[] => {
  const lines = buildTextLines(text)
  const candidates: HeadingCandidate[] = []
  let skipThroughLineIndex = -1

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (lineIndex <= skipThroughLineIndex) {
      continue
    }

    const candidate = extractHeadingCandidateAtLine(lines, lineIndex, context)
    if (!candidate || candidate.key.length === 0 || isGenericTocTitle(candidate.title)) {
      continue
    }

    candidates.push(candidate)
    skipThroughLineIndex = candidate.consumedThroughLineIndex
  }

  const tocLineIndex = findPrintedTocLineIndex(lines)
  return filterNotesSubheadingCandidates(filterPrintedTocCandidates(text, candidates, tocLineIndex))
}
