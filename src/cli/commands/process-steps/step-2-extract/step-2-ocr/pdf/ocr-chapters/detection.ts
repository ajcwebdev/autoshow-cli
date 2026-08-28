import type { PageResult, PdfOutlineEntry, PdfPageLabelEntry, PdfPageMapSpan, ResolvedPdfChapter } from '~/types'
import {
  buildPageLabelSpans,
  buildTextPageMapSpans,
  extractPrintedPageCandidates,
  mergePageMapSpans
} from './page-map'
import {
  cleanDetectedChapterTitle,
  getOutlineRejectReason,
  parsePrintedLabel,
  stripTocHeaderPrefix
} from './text'
import { analyzeTocPage, selectPrimaryTocAnalyses } from './toc'
import { buildHeadingCandidates } from './pdf-heading-detectors'
import {
  buildTocCandidates,
  findDetectedHeadingAnchorPage,
  findTitleAnchorPage
} from './pdf-toc-candidate-resolution'

export { findDetectedHeadingAnchorPage, findTitleAnchorPage } from './pdf-toc-candidate-resolution'

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
