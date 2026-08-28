import type { PageResult, PdfPageMapSpan, PdfTocEntry, ResolvedPdfChapter } from '~/types'
import { cleanExportLines, normalizeTitle, parsePrintedLabel, scoreTitleMatchAgainstLines, scoreTitleMatchText } from './text'
import { detectHeadingTitle, isLikelyTocPageText } from './pdf-heading-detectors'

const mapPrintedToPdfPage = (
  printedPage: string | undefined,
  spans: PdfPageMapSpan[],
  totalPages: number
): number | undefined => {
  if (typeof printedPage !== 'string') return undefined
  const parsed = parsePrintedLabel(printedPage)
  if (!parsed) return undefined
  for (const span of spans) {
    if (span.style !== parsed.style) continue
    const pdfPage = parsed.numericValue + span.offset
    if (pdfPage < span.pdfStartPage || pdfPage > span.pdfEndPage) continue
    if (pdfPage >= 1 && pdfPage <= totalPages) return pdfPage
  }
  return undefined
}

const mapPrintedToPdfPageFallback = (
  printedPage: string | undefined,
  spans: PdfPageMapSpan[],
  totalPages: number
): number | undefined => {
  if (spans.length > 0 || typeof printedPage !== 'string') return undefined
  const parsed = parsePrintedLabel(printedPage)
  if (!parsed || parsed.style !== 'arabic') return undefined
  return parsed.numericValue >= 1 && parsed.numericValue <= totalPages ? parsed.numericValue : undefined
}

const buildAnchorCandidatePages = (
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: { radius?: number, allowGlobal?: boolean }
): number[] => {
  const candidatePages: number[] = []
  const seen = new Set<number>()
  const radius = options?.radius ?? 2
  if (typeof predictedPage === 'number' && Number.isFinite(predictedPage)) {
    for (let delta = 0; delta <= radius; delta++) {
      for (const candidatePage of [predictedPage - delta, predictedPage + delta]) {
        if (seen.has(candidatePage)) continue
        seen.add(candidatePage)
        candidatePages.push(candidatePage)
      }
    }
  }
  if (options?.allowGlobal || candidatePages.length === 0) {
    for (const page of pages) {
      if (seen.has(page.pageNumber)) continue
      seen.add(page.pageNumber)
      candidatePages.push(page.pageNumber)
    }
  }
  return candidatePages
}

type AnchorOptions = { radius?: number, allowGlobal?: boolean }

const selectBestAnchor = (
  predictedPage: number | undefined,
  candidatePages: readonly number[],
  scorePage: (pageNumber: number) => number
): number | undefined => {
  let best: { pageNumber: number, score: number, distance: number } | undefined
  for (const pageNumber of candidatePages) {
    const score = scorePage(pageNumber)
    if (score <= 0) continue
    const distance = typeof predictedPage === 'number' && Number.isFinite(predictedPage)
      ? Math.abs(pageNumber - predictedPage)
      : pageNumber
    if (!best || score > best.score || (score === best.score && distance < best.distance) || (score === best.score && distance === best.distance && pageNumber < best.pageNumber)) {
      best = { pageNumber, score, distance }
    }
  }
  return best?.pageNumber
}

export const findDetectedHeadingAnchorPage = (
  title: string,
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: AnchorOptions
): number | undefined => {
  if (normalizeTitle(title).length === 0) return predictedPage
  const pageLookup = new Map(pages.map((page) => [page.pageNumber, page]))
  return selectBestAnchor(predictedPage, buildAnchorCandidatePages(predictedPage, pages, options), (pageNumber) => {
    const page = pageLookup.get(pageNumber)
    const heading = page ? detectHeadingTitle(page) : undefined
    const score = heading ? scoreTitleMatchText(title, heading) : 0
    return score > 0 ? score + 4 : 0
  })
}

export const findTitleAnchorPage = (
  title: string,
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: AnchorOptions
): number | undefined => {
  if (normalizeTitle(title).length === 0) return predictedPage
  const pageLookup = new Map(pages.map((page) => [page.pageNumber, page]))
  return selectBestAnchor(predictedPage, buildAnchorCandidatePages(predictedPage, pages, options), (pageNumber) => {
    const page = pageLookup.get(pageNumber)
    return !page || isLikelyTocPageText(page) ? 0 : scoreTitleMatchAgainstLines(title, cleanExportLines(page.text))
  })
}

type TocCandidateResolution = {
  page: number | undefined
  mappedPage: number | undefined
  printedFallbackPage: number | undefined
  nearbyAnchor: number | undefined
  titleSearchPage: number | undefined
  usedPrintedFallback: boolean
}

const resolveTocCandidatePage = (
  entry: PdfTocEntry,
  pageMapSpans: PdfPageMapSpan[],
  pages: PageResult[],
  totalPages: number,
  maxGlobalRetargetDistance: number
): TocCandidateResolution => {
  const mappedPage = mapPrintedToPdfPage(entry.printedPage, pageMapSpans, totalPages)
  const printedFallbackPage = mappedPage ?? mapPrintedToPdfPageFallback(entry.printedPage, pageMapSpans, totalPages)
  const usedPrintedFallback = mappedPage === undefined && typeof printedFallbackPage === 'number'
  const predictedPage = mappedPage ?? printedFallbackPage
  const nearbyAnchor = typeof predictedPage === 'number'
    ? findDetectedHeadingAnchorPage(entry.title, predictedPage, pages, { radius: 10 })
      ?? findTitleAnchorPage(entry.title, predictedPage, pages, { radius: 10 })
    : undefined
  const globalTitleSearch = findDetectedHeadingAnchorPage(entry.title, predictedPage, pages, { radius: 10, allowGlobal: true })
  const titleSearchPage = typeof predictedPage === 'number'
    && typeof globalTitleSearch === 'number'
    && Math.abs(globalTitleSearch - predictedPage) > maxGlobalRetargetDistance
    ? undefined
    : globalTitleSearch
  return { page: nearbyAnchor ?? titleSearchPage ?? predictedPage, mappedPage, printedFallbackPage, nearbyAnchor, titleSearchPage, usedPrintedFallback }
}

const describeTocCandidate = (
  entry: PdfTocEntry,
  resolution: TocCandidateResolution
): Pick<ResolvedPdfChapter, 'source' | 'confidence'> => {
  const { mappedPage, printedFallbackPage, nearbyAnchor, titleSearchPage, usedPrintedFallback } = resolution
  const source = nearbyAnchor
    ? usedPrintedFallback
      ? (nearbyAnchor === printedFallbackPage ? 'toc-printed-page+anchor' : 'toc-printed-page+retarget')
      : (nearbyAnchor === mappedPage ? 'toc-page-map+anchor' : 'toc-page-map+retarget')
    : titleSearchPage
      ? 'toc-title-search'
      : mappedPage
        ? 'toc-page-map'
        : usedPrintedFallback
          ? 'toc-printed-page'
          : 'toc'
  const confidence = nearbyAnchor
    ? (nearbyAnchor === mappedPage ? 0.84 : 0.88)
    : titleSearchPage
      ? 0.82
      : mappedPage
        ? 0.76
        : usedPrintedFallback
          ? 0.7
          : typeof entry.printedPage === 'string'
            ? 0.74
            : 0.81
  return { source, confidence }
}

export const buildTocCandidates = (
  tocEntries: PdfTocEntry[],
  pageMapSpans: PdfPageMapSpan[],
  pages: PageResult[]
): ResolvedPdfChapter[] => {
  const totalPages = pages.length > 0 ? Math.max(...pages.map((page) => page.pageNumber)) : 0
  const maxGlobalRetargetDistance = Math.max(12, Math.ceil(totalPages * 0.08))
  const resolved: ResolvedPdfChapter[] = []
  const seenPages = new Set<number>()
  for (const entry of tocEntries) {
    const resolution = resolveTocCandidatePage(entry, pageMapSpans, pages, totalPages, maxGlobalRetargetDistance)
    if (!resolution.page || seenPages.has(resolution.page)) continue
    seenPages.add(resolution.page)
    resolved.push({
      title: entry.title,
      pdfStartPage: resolution.page,
      ...(entry.printedPage ? { printedStartPage: entry.printedPage } : {}),
      ...describeTocCandidate(entry, resolution)
    })
  }
  return resolved.sort((left, right) => left.pdfStartPage - right.pdfStartPage)
}
