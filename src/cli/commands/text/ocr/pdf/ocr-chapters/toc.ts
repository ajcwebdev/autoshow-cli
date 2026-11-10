import type { PageResult, PdfTocEntry, TocPageAnalysis, TocScanOptions } from '~/types'
import {
  countWords,
  getTocCandidateLines,
  INDEX_PAGE_TITLE_RE,
  isCompactNumberedTocTitle,
  isLikelyArtifactText,
  isLikelyNoisyTocTitle,
  isPlausibleTocPageRef,
  isPlausibleTocTitle,
  isStandaloneTocTitle,
  isTocHeaderLine,
  MAX_TOC_TITLE_LENGTH,
  normalizeDecoratedLabel,
  normalizeInlineWhitespace,
  parsePrintedLabel,
  stripTocDotLeaders,
  stripTocHeaderPrefix,
  TOC_PAGE_TITLE_RE
} from './text'

const buildTocEntry = (
  title: string,
  tocPdfPage: number,
  parsed?: { style: 'arabic' | 'roman', raw: string, numericValue: number },
  options?: TocScanOptions
): PdfTocEntry | undefined => {
  const normalizedTitle = stripTocDotLeaders(stripTocHeaderPrefix(title))
  if (!isPlausibleTocTitle(normalizedTitle)) {
    return undefined
  }
  if (isLikelyNoisyTocTitle(normalizedTitle, {
    hasPrintedPage: typeof parsed !== 'undefined',
    ...(options?.allowUnnumbered !== undefined ? { allowUnnumbered: options.allowUnnumbered } : {})
  })) {
    return undefined
  }
  if (!parsed) {
    return {
      title: normalizedTitle,
      tocPdfPage
    }
  }
  if (!isPlausibleTocPageRef(parsed)) {
    return undefined
  }
  return {
    title: normalizedTitle,
    printedPage: parsed.raw,
    style: parsed.style,
    numericValue: parsed.numericValue,
    tocPdfPage
  }
}

const appendTocEntry = (entries: PdfTocEntry[], entry: PdfTocEntry | undefined): void => {
  if (entry) {
    entries.push(entry)
  }
}

const isSkippedTocLine = (line: string): boolean =>
  /^(chapter|chapters|page|pages)$/i.test(line) || isTocHeaderLine(line)

type TocScanState = { entries: PdfTocEntry[], pendingTitle: string }

const consumePageReferenceLine = (
  state: TocScanState,
  line: string,
  tocPdfPage: number,
  options: TocScanOptions | undefined
): boolean => {
  const inlineMatch = line.match(/^(.*?)(?:(?:[.·]\s*){2,}|\s{2,}|\s)\s*([0-9]+|[ivxlcdm]+)\s*$/i)
  if (inlineMatch) {
    const parsed = parsePrintedLabel(inlineMatch[2] ?? '')
    const titlePart = normalizeInlineWhitespace(`${state.pendingTitle} ${inlineMatch[1] ?? ''}`)
    state.pendingTitle = ''
    appendTocEntry(state.entries, parsed ? buildTocEntry(titlePart, tocPdfPage, parsed, options) : undefined)
    return true
  }

  const isolatedLine = normalizeDecoratedLabel(line)
  const isolatedPageRef = parsePrintedLabel(isolatedLine)
  if (!isolatedPageRef || !isPlausibleTocPageRef(isolatedPageRef)) {
    return false
  }
  if (state.pendingTitle.length > 0) {
    appendTocEntry(state.entries, buildTocEntry(state.pendingTitle, tocPdfPage, isolatedPageRef, options))
  }
  state.pendingTitle = ''
  return true
}

const consumeTitleLine = (
  state: TocScanState,
  line: string,
  tocPdfPage: number,
  options: TocScanOptions | undefined
): void => {
  if (!isPlausibleTocTitle(line)) {
    state.pendingTitle = ''
    return
  }

  if (state.pendingTitle.length === 0) {
    state.pendingTitle = line
    return
  }

  const combinedTitle = normalizeInlineWhitespace(`${state.pendingTitle} ${line}`)
  if (isStandaloneTocTitle(state.pendingTitle) && isStandaloneTocTitle(line)) {
    appendTocEntry(state.entries, buildTocEntry(state.pendingTitle, tocPdfPage, undefined, options))
    state.pendingTitle = line
    return
  }

  if (combinedTitle.length <= MAX_TOC_TITLE_LENGTH) {
    state.pendingTitle = combinedTitle
    return
  }

  appendTocEntry(state.entries, buildTocEntry(state.pendingTitle, tocPdfPage, undefined, options))
  state.pendingTitle = line
}

const scanTocEntries = (lines: string[], tocPdfPage: number, options?: TocScanOptions): PdfTocEntry[] => {
  const state: TocScanState = { entries: [], pendingTitle: '' }

  for (const rawLine of lines) {
    const line = normalizeInlineWhitespace(rawLine)
    if (line.length === 0) {
      continue
    }
    if (TOC_PAGE_TITLE_RE.test(line)) {
      state.pendingTitle = ''
      continue
    }
    if (isSkippedTocLine(line)) {
      continue
    }
    if (consumePageReferenceLine(state, line, tocPdfPage, options)) {
      continue
    }
    consumeTitleLine(state, line, tocPdfPage, options)
  }

  if (state.pendingTitle.length > 0) {
    appendTocEntry(state.entries, buildTocEntry(state.pendingTitle, tocPdfPage, undefined, options))
  }

  return state.entries
}

const isTocLikeLine = (line: string): boolean =>
  /(?:\.{2,}|\s{2,})([0-9]+|[ivxlcdm]+)\s*$/i.test(line) || /^.+\s+([0-9]+|[ivxlcdm]+)\s*$/i.test(line)

const isLikelyIndexEntryLine = (line: string): boolean => {
  const normalized = normalizeInlineWhitespace(line)
  if (normalized.length === 0 || countWords(normalized) > 18) {
    return false
  }
  const inlineRefs = normalized.match(/,\s*\d+(?:\s*-\s*\d+)?/g) ?? []
  if (inlineRefs.length === 0) {
    return false
  }
  return /^[A-Za-z][A-Za-z'’(). -]{0,48},/.test(normalized) || inlineRefs.length >= 2
}

const isLikelyIndexPage = (lines: string[]): boolean => {
  const scanLines = lines.slice(0, 40)
  const headingInTopLines = lines.slice(0, 6).some((line) => INDEX_PAGE_TITLE_RE.test(line))
  const dividerCount = scanLines.filter((line) => /^-\s*[A-Za-z]\s*-$/.test(normalizeInlineWhitespace(line))).length
  const indexEntryCount = scanLines.filter(isLikelyIndexEntryLine).length
  if (headingInTopLines) {
    return indexEntryCount >= 2
  }
  return indexEntryCount >= 8 || (dividerCount >= 1 && indexEntryCount >= 4)
}

const isLikelyArtifactPage = (lines: string[]): boolean => {
  const scanLines = lines.slice(0, 12)
  const artifactLines = scanLines.filter(isLikelyArtifactText)
  return artifactLines.length >= 2 || (artifactLines.length >= 1 && scanLines.some((line) => /\b(?:printing|main branch)\b/i.test(line)))
}

export const analyzeTocPage = (page: PageResult): TocPageAnalysis => {
  const lines = getTocCandidateLines(page.text)
  if (lines.length === 0) {
    return {
      pageNumber: page.pageNumber,
      hasTocHeading: false,
      entries: [],
      tocLikeCount: 0,
      isToc: false
    }
  }
  const tocHeadingIndex = lines.findIndex((line) => TOC_PAGE_TITLE_RE.test(line))
  const hasTocHeading = tocHeadingIndex >= 0
  const scanLines = hasTocHeading ? lines.slice(tocHeadingIndex) : lines
  if (isLikelyIndexPage(scanLines) || (!hasTocHeading && isLikelyArtifactPage(scanLines))) {
    return {
      pageNumber: page.pageNumber,
      hasTocHeading,
      entries: [],
      tocLikeCount: 0,
      isToc: false
    }
  }
  const entries = scanTocEntries(scanLines, page.pageNumber, { allowUnnumbered: hasTocHeading })
  const numberedEntries = entries.filter((entry) => typeof entry.printedPage === 'string')
  const tocLikeCount = scanLines.filter(isTocLikeLine).length
  const compactNumberedEntries = numberedEntries.filter((entry) => isCompactNumberedTocTitle(entry.title))
  const isToc = hasTocHeading
    ? entries.length >= 2
    : numberedEntries.length >= 3 && compactNumberedEntries.length >= 3 && tocLikeCount >= 3

  return {
    pageNumber: page.pageNumber,
    hasTocHeading,
    entries,
    tocLikeCount,
    isToc
  }
}

export const parseTocEntriesFromPage = (page: PageResult): PdfTocEntry[] => {
  const analysis = analyzeTocPage(page)
  return analysis.isToc ? analysis.entries : []
}

export const selectPrimaryTocAnalyses = (
  analyses: TocPageAnalysis[],
  totalPages: number
): TocPageAnalysis[] => {
  if (analyses.length <= 1) {
    return analyses
  }

  const ordered = [...analyses].sort((a, b) => a.pageNumber - b.pageNumber)
  const clusters: TocPageAnalysis[][] = []
  let currentCluster: TocPageAnalysis[] = []

  for (const analysis of ordered) {
    const previous = currentCluster[currentCluster.length - 1]
    if (previous && analysis.pageNumber - previous.pageNumber > 2) {
      clusters.push(currentCluster)
      currentCluster = []
    }
    currentCluster.push(analysis)
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  const frontMatterLimit = Math.max(20, Math.ceil(totalPages * 0.18))
  const frontMatterClusters = clusters.filter((cluster) => (cluster[0]?.pageNumber ?? Number.POSITIVE_INFINITY) <= frontMatterLimit)
  const clusterPool = frontMatterClusters.length > 0 ? frontMatterClusters : clusters

  return clusterPool.find((cluster) => cluster.some((analysis) => analysis.hasTocHeading))
    ?? clusterPool[0]
    ?? []
}
