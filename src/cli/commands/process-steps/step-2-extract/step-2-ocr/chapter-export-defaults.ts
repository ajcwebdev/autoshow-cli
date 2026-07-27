import type { PdfChapterMode } from '~/types'

export const AUTO_PDF_CHAPTER_EXPORT_MIN_PAGES = 40

export const shouldExportEpubChapters = (
  chapterPreference: boolean | undefined
): boolean => chapterPreference !== false

export const shouldAttemptPdfChapterExport = (
  chapterPreference: boolean | undefined,
  totalPages: number
): boolean => {
  if (chapterPreference === false) {
    return false
  }
  if (chapterPreference === true) {
    return true
  }
  return totalPages >= AUTO_PDF_CHAPTER_EXPORT_MIN_PAGES
}

export const resolvePdfChapterDetectionMode = (
  chapterPreference: boolean | undefined,
  configuredMode: PdfChapterMode
): PdfChapterMode =>
  chapterPreference === true ? configuredMode : 'local'
