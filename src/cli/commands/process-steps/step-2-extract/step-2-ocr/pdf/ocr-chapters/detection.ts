import type { PageResult, PdfOutlineEntry, PdfPageLabelEntry, PdfPageMapSpan, PdfTocEntry, ResolvedPdfChapter } from '~/types'
import {
  buildPageLabelSpans,
  buildTextPageMapSpans,
  extractPrintedPageCandidates,
  mergePageMapSpans
} from './page-map'
import {
  cleanDetectedChapterTitle,
  cleanExportLines,
  countWords,
  getOutlineRejectReason,
  isLikelyArtifactText,
  isMostlyUppercase,
  isPlausibleTocTitle,
  isTocHeaderLine,
  normalizeDecoratedLabel,
  normalizeInlineWhitespace,
  normalizeTitle,
  parsePrintedLabel,
  ROMAN_RE,
  scoreTitleMatchAgainstLines,
  scoreTitleMatchText,
  stripTocHeaderPrefix,
  TOC_PAGE_TITLE_RE
} from './text'
import { analyzeTocPage, selectPrimaryTocAnalyses } from './toc'

export const parsePdfOutline = (raw: string): PdfOutlineEntry[] => {
  const entries: PdfOutlineEntry[] = []
  const lines = raw.split('\n')
  for (const line of lines) {
    const match = line.match(/^([^\"]*)\"([^\"]*)\"\s+#page=(\d+)/)
    if (!match) {
      continue
    }
    const prefix = match[1] ?? ''
    const title = stripTocHeaderPrefix(match[2] ?? '')
    const pdfPage = Number.parseInt(match[3] ?? '0', 10)
    if (!title || !Number.isFinite(pdfPage) || pdfPage < 1) {
      continue
    }
    const depth = (prefix.match(/\t/g) ?? []).length
    entries.push({ title, pdfPage, depth })
  }
  return entries
}

const mapPrintedToPdfPage = (
  printedPage: string | undefined,
  spans: PdfPageMapSpan[],
  totalPages: number
): number | undefined => {
  if (typeof printedPage !== 'string') {
    return undefined
  }
  const parsed = parsePrintedLabel(printedPage)
  if (!parsed) {
    return undefined
  }

  for (const span of spans) {
    if (span.style !== parsed.style) {
      continue
    }

    const pdfPage = parsed.numericValue + span.offset
    if (pdfPage < span.pdfStartPage || pdfPage > span.pdfEndPage) {
      continue
    }
    if (pdfPage >= 1 && pdfPage <= totalPages) {
      return pdfPage
    }
  }

  return undefined
}

const mapPrintedToPdfPageFallback = (
  printedPage: string | undefined,
  spans: PdfPageMapSpan[],
  totalPages: number
): number | undefined => {
  if (spans.length > 0 || typeof printedPage !== 'string') {
    return undefined
  }
  const parsed = parsePrintedLabel(printedPage)
  if (!parsed || parsed.style !== 'arabic') {
    return undefined
  }
  return parsed.numericValue >= 1 && parsed.numericValue <= totalPages
    ? parsed.numericValue
    : undefined
}

const buildOutlineCandidates = (
  rawEntries: PdfOutlineEntry[],
  pages: PageResult[]
): { chapters: ResolvedPdfChapter[], rejectedTitles: string[] } => {
  const byPage = new Map<number, PdfOutlineEntry[]>()
  const rejectedTitles: string[] = []
  for (const entry of rawEntries) {
    const rejectReason = getOutlineRejectReason(entry.title)
    if (rejectReason) {
      rejectedTitles.push(`${entry.title} (${rejectReason})`)
      continue
    }
    const list = byPage.get(entry.pdfPage) ?? []
    list.push(entry)
    byPage.set(entry.pdfPage, list)
  }

  const chapters: ResolvedPdfChapter[] = []
  for (const [, entries] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const chosen = [...entries].sort((a, b) =>
      a.depth - b.depth || b.title.length - a.title.length
    )[0]
    if (!chosen) {
      continue
    }
    const anchoredPage = findDetectedHeadingAnchorPage(chosen.title, chosen.pdfPage, pages, { radius: 6 })
      ?? findTitleAnchorPage(chosen.title, chosen.pdfPage, pages, { radius: 6 })
    const resolvedPage = anchoredPage ?? chosen.pdfPage
    const confidence = anchoredPage
      ? (anchoredPage === chosen.pdfPage ? 0.84 : 0.78)
      : (resolvedPage <= 5 ? 0.34 : 0.58)
    chapters.push({
      title: chosen.title,
      pdfStartPage: resolvedPage,
      source: anchoredPage
        ? (anchoredPage === chosen.pdfPage ? 'outline+anchor' : 'outline+retarget')
        : 'outline',
      confidence
    })
  }

  return { chapters, rejectedTitles }
}

const buildAnchorCandidatePages = (
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: {
    radius?: number
    allowGlobal?: boolean
  }
): number[] => {
  const candidatePages: number[] = []
  const seen = new Set<number>()
  const radius = options?.radius ?? 2
  if (typeof predictedPage === 'number' && Number.isFinite(predictedPage)) {
    for (let delta = 0; delta <= radius; delta++) {
      for (const candidatePage of [predictedPage - delta, predictedPage + delta]) {
        if (seen.has(candidatePage)) {
          continue
        }
        seen.add(candidatePage)
        candidatePages.push(candidatePage)
      }
    }
  }
  if (options?.allowGlobal || candidatePages.length === 0) {
    for (const page of pages) {
      if (seen.has(page.pageNumber)) {
        continue
      }
      seen.add(page.pageNumber)
      candidatePages.push(page.pageNumber)
    }
  }

  return candidatePages
}

export const findDetectedHeadingAnchorPage = (
  title: string,
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: {
    radius?: number
    allowGlobal?: boolean
  }
): number | undefined => {
  const normalizedNeedle = normalizeTitle(title)
  if (normalizedNeedle.length === 0) {
    return predictedPage
  }
  const pageLookup = new Map(pages.map((page) => [page.pageNumber, page]))
  const candidatePages = buildAnchorCandidatePages(predictedPage, pages, options)

  let bestMatch: { pageNumber: number, score: number, distance: number } | undefined
  for (const candidatePage of candidatePages) {
    const page = pageLookup.get(candidatePage)
    if (!page) {
      continue
    }
    const heading = detectHeadingTitle(page)
    if (!heading) {
      continue
    }
    const headingScore = scoreTitleMatchText(title, heading)
    if (headingScore <= 0) {
      continue
    }
    const score = headingScore + 4
    const distance = typeof predictedPage === 'number' && Number.isFinite(predictedPage)
      ? Math.abs(candidatePage - predictedPage)
      : candidatePage
    if (!bestMatch
      || score > bestMatch.score
      || (score === bestMatch.score && distance < bestMatch.distance)
      || (score === bestMatch.score && distance === bestMatch.distance && candidatePage < bestMatch.pageNumber)) {
      bestMatch = { pageNumber: candidatePage, score, distance }
    }
  }

  return bestMatch?.pageNumber
}

const isLikelyTocPageText = (page: PageResult): boolean => {
  const topLines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0).slice(0, 12)
  const tocEntryLineCount = topLines.filter(isLikelyTocEntryHeadingLine).length
  return topLines.some((line) => TOC_PAGE_TITLE_RE.test(line))
    || tocEntryLineCount >= 2
    || (topLines.some(isTocHeaderLine) && tocEntryLineCount >= 1)
}

export const findTitleAnchorPage = (
  title: string,
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: {
    radius?: number
    allowGlobal?: boolean
  }
): number | undefined => {
  const normalizedNeedle = normalizeTitle(title)
  if (normalizedNeedle.length === 0) {
    return predictedPage
  }
  const pageLookup = new Map(pages.map((page) => [page.pageNumber, page]))
  const candidatePages = buildAnchorCandidatePages(predictedPage, pages, options)

  let bestMatch: { pageNumber: number, score: number, distance: number } | undefined
  for (const candidatePage of candidatePages) {
    const page = pageLookup.get(candidatePage)
    if (!page) {
      continue
    }
    if (isLikelyTocPageText(page)) {
      continue
    }
    const score = scoreTitleMatchAgainstLines(title, cleanExportLines(page.text))
    if (score <= 0) {
      continue
    }
    const distance = typeof predictedPage === 'number' && Number.isFinite(predictedPage)
      ? Math.abs(candidatePage - predictedPage)
      : candidatePage
    if (!bestMatch
      || score > bestMatch.score
      || (score === bestMatch.score && distance < bestMatch.distance)
      || (score === bestMatch.score && distance === bestMatch.distance && candidatePage < bestMatch.pageNumber)) {
      bestMatch = { pageNumber: candidatePage, score, distance }
    }
  }

  return bestMatch?.pageNumber
}

const buildTocCandidates = (
  tocEntries: PdfTocEntry[],
  pageMapSpans: PdfPageMapSpan[],
  pages: PageResult[]
): ResolvedPdfChapter[] => {
  const totalPages = pages.length > 0 ? Math.max(...pages.map((page) => page.pageNumber)) : 0
  const maxGlobalRetargetDistance = Math.max(12, Math.ceil(totalPages * 0.08))
  const resolved: ResolvedPdfChapter[] = []
  const seenPages = new Set<number>()

  for (const entry of tocEntries) {
    const mappedPage = mapPrintedToPdfPage(entry.printedPage, pageMapSpans, totalPages)
    const printedFallbackPage = mappedPage ?? mapPrintedToPdfPageFallback(entry.printedPage, pageMapSpans, totalPages)
    const usedPrintedFallback = mappedPage === undefined && typeof printedFallbackPage === 'number'
    const nearbyAnchor = typeof mappedPage === 'number'
      ? findDetectedHeadingAnchorPage(entry.title, mappedPage, pages, { radius: 10 })
        ?? findTitleAnchorPage(entry.title, mappedPage, pages, { radius: 10 })
      : typeof printedFallbackPage === 'number'
        ? findDetectedHeadingAnchorPage(entry.title, printedFallbackPage, pages, { radius: 10 })
          ?? findTitleAnchorPage(entry.title, printedFallbackPage, pages, { radius: 10 })
      : undefined
    const predictedPage = mappedPage ?? printedFallbackPage
    const titleSearchPage = findDetectedHeadingAnchorPage(entry.title, predictedPage, pages, {
      radius: 10,
      allowGlobal: true
    })
    const plausibleTitleSearchPage = typeof predictedPage === 'number'
      && typeof titleSearchPage === 'number'
      && Math.abs(titleSearchPage - predictedPage) > maxGlobalRetargetDistance
        ? undefined
        : titleSearchPage
    const resolvedPage = nearbyAnchor ?? plausibleTitleSearchPage ?? predictedPage
    if (!resolvedPage || seenPages.has(resolvedPage)) {
      continue
    }
    seenPages.add(resolvedPage)
    const hasPrintedPage = typeof entry.printedPage === 'string'
    const source = nearbyAnchor
      ? usedPrintedFallback
        ? (nearbyAnchor === printedFallbackPage ? 'toc-printed-page+anchor' : 'toc-printed-page+retarget')
        : (nearbyAnchor === mappedPage ? 'toc-page-map+anchor' : 'toc-page-map+retarget')
      : plausibleTitleSearchPage
        ? 'toc-title-search'
      : mappedPage
        ? 'toc-page-map'
        : usedPrintedFallback
          ? 'toc-printed-page'
          : 'toc'
    const confidence = nearbyAnchor
      ? (nearbyAnchor === mappedPage ? 0.84 : 0.88)
      : plausibleTitleSearchPage
        ? 0.82
      : mappedPage
        ? 0.76
        : usedPrintedFallback
          ? 0.7
          : hasPrintedPage
            ? 0.74
            : 0.81
    resolved.push({
      title: entry.title,
      pdfStartPage: resolvedPage,
      ...(entry.printedPage ? { printedStartPage: entry.printedPage } : {}),
      source,
      confidence
    })
  }

  return resolved.sort((a, b) => a.pdfStartPage - b.pdfStartPage)
}

const HEADING_ARTIFACT_RE = /\b(?:isbn|library of congress|copyright|all rights reserved|cover design|back cover|front cover|title page|printed in|published by|publisher|web\.archive|archive\.org|internet archive|digitized by)\b/i
const HEADING_NOISE_CHARACTER_RE = /[<>\\{}\[\]|]/

const isLikelyTocEntryHeadingLine = (line: string): boolean => {
  const normalized = normalizeInlineWhitespace(line)
  if (normalized.length === 0) {
    return false
  }
  if (/^(?:chapter|chap\.?|part|book|section)\s+([0-9ivxlcdm]+)\s*$/i.test(normalized)) {
    return false
  }
  return /(?:(?:[.·]\s*){2,}|\s{2,})\s*([0-9]+|[ivxlcdm]+)\s*$/i.test(normalized)
    || /^[A-Za-z][A-Za-z0-9'’",:;!?() -]{2,80}\s+([0-9]+|[ivxlcdm]+)\s*$/i.test(normalized)
}

const isLikelyHeadingArtifactPage = (topLines: string[]): boolean => {
  const artifactCount = topLines.filter((line) =>
    HEADING_ARTIFACT_RE.test(line) || isLikelyArtifactText(line)
  ).length
  return artifactCount >= 2
}

const rejectHeadingCandidate = (candidate: string, topLines: string[]): boolean => {
  const cleaned = stripTocHeaderPrefix(candidate)
  const normalized = normalizeTitle(cleaned)
  if (normalized.length === 0) {
    return true
  }
  if (
    TOC_PAGE_TITLE_RE.test(cleaned)
    || isTocHeaderLine(cleaned)
    || ['page', 'pages', 'chapter', 'chapters', 'front cover', 'back cover', 'title page'].includes(normalized)
  ) {
    return true
  }
  if (HEADING_NOISE_CHARACTER_RE.test(cleaned) || HEADING_ARTIFACT_RE.test(cleaned) || isLikelyArtifactText(cleaned)) {
    return true
  }
  if (isLikelyTocEntryHeadingLine(cleaned)) {
    return true
  }
  if (isLikelyHeadingArtifactPage(topLines)) {
    return true
  }
  return false
}

const resolveHeadingCandidate = (candidate: string | undefined, topLines: string[]): string | undefined => {
  if (!candidate) {
    return undefined
  }
  return rejectHeadingCandidate(candidate, topLines) ? undefined : candidate
}

const detectHeadingTitle = (page: PageResult): string | undefined => {
  const lines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0)
  const topLines = lines.slice(0, 12)
  if (
    topLines.some((line) => TOC_PAGE_TITLE_RE.test(line) || isTocHeaderLine(line))
    || topLines.filter(isLikelyTocEntryHeadingLine).length >= 2
  ) {
    return undefined
  }
  const first = topLines[0]
  const second = topLines[1]
  const third = topLines[2]
  const fourth = topLines[3]

  if (first && /^(acknowledg(?:e)?ment|prologue|epilogue|introduction|foreword|preface|appendix|footnotes?|selected bibliography|bibliography|index)\b/i.test(first)) {
    return resolveHeadingCandidate(first, topLines)
  }
  for (const line of topLines) {
    if (countWords(line) <= 4 && /^(acknowledg(?:e)?ment|prologue|epilogue|introduction|foreword|preface|appendix|footnotes?|selected bibliography|bibliography|index)\b/i.test(line)) {
      return resolveHeadingCandidate(line, topLines)
    }
  }
  if (first && ROMAN_RE.test(normalizeDecoratedLabel(first)) && second && isPlausibleTocTitle(second) && isMostlyUppercase(second)) {
    return resolveHeadingCandidate(second, topLines)
  }
  if (
    first
    && /^chapter$/i.test(normalizeDecoratedLabel(first))
    && second
    && /^([0-9]+|[ivxlcdm]+)$/i.test(normalizeDecoratedLabel(second))
    && third
    && isPlausibleTocTitle(third)
    && isMostlyUppercase(third)
  ) {
    const chapterLabel = normalizeDecoratedLabel(second)
    const title = ROMAN_RE.test(chapterLabel) ? `${second} ${third}` : third
    return resolveHeadingCandidate(title, topLines)
  }
  if (first && /^\d+$/.test(normalizeDecoratedLabel(first)) && second && ROMAN_RE.test(normalizeDecoratedLabel(second)) && third && isPlausibleTocTitle(third) && isMostlyUppercase(third)) {
    return resolveHeadingCandidate(third, topLines)
  }
  if (
    first
    && /^\d+$/.test(normalizeDecoratedLabel(first))
    && second
    && /^chapter$/i.test(normalizeDecoratedLabel(second))
    && third
    && ROMAN_RE.test(normalizeDecoratedLabel(third))
    && fourth
    && isPlausibleTocTitle(fourth)
    && isMostlyUppercase(fourth)
  ) {
    return resolveHeadingCandidate(`${third} ${fourth}`, topLines)
  }
  if (first && /^\d+$/.test(normalizeDecoratedLabel(first)) && second && isPlausibleTocTitle(second) && isMostlyUppercase(second)) {
    return resolveHeadingCandidate(second, topLines)
  }

  for (const line of topLines) {
    if (/^(chapter|chap\.|part|book|section)\s+([0-9ivxlcdm]+)\b/i.test(line)) {
      const lineIndex = topLines.indexOf(line)
      const next = topLines[lineIndex + 1]
      if (next && isPlausibleTocTitle(next) && isMostlyUppercase(next)) {
        return resolveHeadingCandidate(next, topLines)
      }
      return resolveHeadingCandidate(line, topLines)
    }
    if (/^(prologue|epilogue|introduction|foreword|preface|appendix)\b/i.test(line)) {
      return resolveHeadingCandidate(line, topLines)
    }
  }

  if (first && isPlausibleTocTitle(first) && isMostlyUppercase(first)) {
    return resolveHeadingCandidate(first, topLines)
  }

  return undefined
}

const buildHeadingCandidates = (
  pages: PageResult[]
): ResolvedPdfChapter[] => {
  const chapters: ResolvedPdfChapter[] = []
  for (const page of pages) {
    const heading = detectHeadingTitle(page)
    if (!heading) {
      continue
    }
    chapters.push({
      title: heading,
      pdfStartPage: page.pageNumber,
      source: 'heading',
      confidence: 0.58
    })
  }
  return chapters
}

export const dedupeResolvedChapters = (chapters: ResolvedPdfChapter[]): ResolvedPdfChapter[] => {
  const deduped: ResolvedPdfChapter[] = []
  const seenPages = new Set<number>()
  for (const chapter of [...chapters].sort((a, b) =>
    a.pdfStartPage - b.pdfStartPage
    || b.confidence - a.confidence
    || b.title.length - a.title.length
  )) {
    if (seenPages.has(chapter.pdfStartPage)) {
      continue
    }
    seenPages.add(chapter.pdfStartPage)
    deduped.push(chapter)
  }
  return deduped
}

const inferStrategyUsed = (strategyName: 'outline' | 'toc' | 'heading', chapters: ResolvedPdfChapter[]): string => {
  if (chapters.length === 0) {
    return 'none'
  }
  if (strategyName === 'toc') {
    const usedTitleSearch = chapters.some((chapter) => chapter.source.includes('title-search') || chapter.source.includes('retarget') || chapter.source.includes('anchor'))
    return usedTitleSearch ? 'toc+title-search' : 'toc-page-map'
  }
  return strategyName
}

const cleanResolvedChapterTitles = (chapters: ResolvedPdfChapter[]): ResolvedPdfChapter[] =>
  chapters.map((chapter) => ({
    ...chapter,
    title: cleanDetectedChapterTitle(chapter.title)
  }))

const extractChapterOrdinal = (title: string): number | undefined => {
  const cleaned = cleanDetectedChapterTitle(title)
  const match = cleaned.match(/^(?:chapter|chap\.?)\s+([0-9]+|[ivxlcdm]+)\b/i)
    ?? cleaned.match(/^(?:book|part|section)\s+[0-9ivxlcdm]+\s*[-:]\s*(?:chapter|chap\.?)\s+([0-9]+|[ivxlcdm]+)\b/i)
    ?? cleaned.match(/^([0-9]+)[.)\s:-]+/i)
    ?? cleaned.match(/^([ivxlcdm]+)\s+[A-Z]/)
  const raw = match?.[1]
  if (!raw) {
    return undefined
  }
  const parsed = parsePrintedLabel(raw)
  return parsed && parsed.numericValue > 0 ? parsed.numericValue : undefined
}

const analyzeNumberedChapterSequence = (
  chapters: ResolvedPdfChapter[]
): { missing: number[], expectedCount: number, penalty: number } | undefined => {
  const ordinals = [...new Set(
    chapters
      .map((chapter) => extractChapterOrdinal(chapter.title))
      .filter((ordinal): ordinal is number => typeof ordinal === 'number' && ordinal > 0)
  )].sort((left, right) => left - right)

  if (ordinals.length < 3) {
    return undefined
  }

  const first = ordinals[0]!
  const last = ordinals[ordinals.length - 1]!
  const expectedCount = last - first + 1
  if (expectedCount < 4) {
    return undefined
  }

  const seen = new Set(ordinals)
  const missing: number[] = []
  for (let ordinal = first; ordinal <= last; ordinal++) {
    if (!seen.has(ordinal)) {
      missing.push(ordinal)
    }
  }

  const missingRatio = missing.length / expectedCount
  if (missing.length < 2 || missingRatio < 0.25) {
    return undefined
  }

  return {
    missing,
    expectedCount,
    penalty: Math.min(0.28, 0.08 + missingRatio * 0.32)
  }
}

const applySequencePenalty = (
  chapters: ResolvedPdfChapter[],
  penalty: number
): ResolvedPdfChapter[] =>
  chapters.map((chapter) => ({
    ...chapter,
    confidence: Math.max(0.32, Math.round((chapter.confidence - penalty) * 100) / 100)
  }))

const formatSequenceWarning = (
  analysis: { missing: number[], expectedCount: number }
): string => {
  const preview = analysis.missing.slice(0, 8).join(', ')
  const suffix = analysis.missing.length > 8 ? ', ...' : ''
  return `TOC-derived chapter numbering appears incomplete; missing ${analysis.missing.length} of ${analysis.expectedCount} numbered chapter positions (${preview}${suffix}).`
}

export const scoreOverallConfidence = (chapters: ResolvedPdfChapter[]): number => {
  if (chapters.length === 0) {
    return 0
  }
  return chapters.reduce((sum, chapter) => sum + chapter.confidence, 0) / chapters.length
}

const scoreChapterStrategy = (
  chapters: ResolvedPdfChapter[],
  totalPages: number,
  strategyName: 'outline' | 'toc' | 'heading'
): number => {
  if (chapters.length === 0) {
    return -1
  }
  const averageConfidence = scoreOverallConfidence(chapters)
  const countScore = chapters.length <= 1 ? 0.15 : Math.min(chapters.length / 8, 1)
  const spanPages = chapters.length > 1
    ? chapters[chapters.length - 1]!.pdfStartPage - chapters[0]!.pdfStartPage
    : 0
  const spreadScore = totalPages > 1 ? Math.min(spanPages / Math.max(totalPages * 0.65, 1), 1) : 0
  const gaps = chapters.slice(1).map((chapter, index) => chapter.pdfStartPage - chapters[index]!.pdfStartPage)
  const tightGapRatio = gaps.length > 0
    ? gaps.filter((gap) => gap <= 3).length / gaps.length
    : 0
  const chapterDensity = chapters.length / Math.max(totalPages, 1)
  const frontMatterOnlyPenalty = chapters.length <= 2 && chapters.every((chapter) => chapter.pdfStartPage <= Math.max(10, Math.ceil(totalPages * 0.05)))
    ? 0.45
    : 0
  const denseGapPenalty = tightGapRatio > 0.4 ? Math.min((tightGapRatio - 0.4) * 0.9, 0.32) : 0
  const chapterDensityPenalty = chapterDensity > 0.06 ? Math.min((chapterDensity - 0.06) * 1.6, 0.26) : 0
  const strategyBonus = strategyName === 'toc'
    ? 0.06
    : strategyName === 'heading'
      ? -0.02
      : 0
  return averageConfidence * 0.55
    + countScore * 0.25
    + spreadScore * 0.2
    + strategyBonus
    - frontMatterOnlyPenalty
    - denseGapPenalty
    - chapterDensityPenalty
}

export const resolveLocalPdfChapterDetection = (input: {
  pages: PageResult[]
  outlineEntries?: PdfOutlineEntry[]
  labelEntries?: PdfPageLabelEntry[]
}): {
  chapters: ResolvedPdfChapter[]
  pageMapSpans: PdfPageMapSpan[]
  tocPages: number[]
  warnings: string[]
  strategyUsed: string
} => {
  const warnings: string[] = []
  const totalPages = input.pages.length > 0 ? Math.max(...input.pages.map((page) => page.pageNumber)) : 0
  const pageTextCandidates = extractPrintedPageCandidates(input.pages)
  const pageMapSpans = mergePageMapSpans([
    ...buildPageLabelSpans(input.labelEntries ?? [], totalPages),
    ...buildTextPageMapSpans(pageTextCandidates, totalPages)
  ])

  const rawTocAnalyses = input.pages.map(analyzeTocPage).filter((analysis) => analysis.isToc)
  const selectedTocAnalyses = selectPrimaryTocAnalyses(rawTocAnalyses, totalPages)
  const tocPages = selectedTocAnalyses.map((analysis) => analysis.pageNumber)
  const tocEntries = selectedTocAnalyses.flatMap((analysis) => analysis.entries)
  const droppedTocPages = rawTocAnalyses
    .map((analysis) => analysis.pageNumber)
    .filter((pageNumber) => !tocPages.includes(pageNumber))
  if (droppedTocPages.length > 0) {
    warnings.push(`Ignored ${droppedTocPages.length} TOC-like PDF page${droppedTocPages.length === 1 ? '' : 's'} outside the primary front-matter cluster.`)
  }

  const outlineResult = buildOutlineCandidates(input.outlineEntries ?? [], input.pages)
  if (outlineResult.rejectedTitles.length > 0) {
    warnings.push(`Ignored ${outlineResult.rejectedTitles.length} low-quality PDF outline entr${outlineResult.rejectedTitles.length === 1 ? 'y' : 'ies'} while resolving chapters.`)
  }

  const outlineCandidates = dedupeResolvedChapters(outlineResult.chapters)
  const rawTocCandidates = dedupeResolvedChapters(buildTocCandidates(tocEntries, pageMapSpans, input.pages))
  const tocSequenceAnalysis = analyzeNumberedChapterSequence(rawTocCandidates)
  if (tocSequenceAnalysis) {
    warnings.push(formatSequenceWarning(tocSequenceAnalysis))
  }
  const tocCandidates = tocSequenceAnalysis
    ? applySequencePenalty(rawTocCandidates, tocSequenceAnalysis.penalty)
    : rawTocCandidates
  const headingCandidates = dedupeResolvedChapters(buildHeadingCandidates(input.pages))

  const strategyOptions = [
    {
      name: 'outline' as const,
      chapters: outlineCandidates
    },
    {
      name: 'toc' as const,
      chapters: tocCandidates
    },
    {
      name: 'heading' as const,
      chapters: headingCandidates
    }
  ].map((option) => ({
    ...option,
    score: scoreChapterStrategy(option.chapters, totalPages, option.name),
    strategyUsed: inferStrategyUsed(option.name, option.chapters)
  }))

  const chosen = strategyOptions.sort((a, b) =>
    b.score - a.score
    || b.chapters.length - a.chapters.length
    || (b.name === 'toc' ? 1 : 0) - (a.name === 'toc' ? 1 : 0)
  )[0]

  return {
    chapters: cleanResolvedChapterTitles(chosen?.chapters ?? []),
    pageMapSpans,
    tocPages,
    warnings,
    strategyUsed: chosen?.strategyUsed ?? 'none'
  }
}
