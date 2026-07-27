import type { PdfChapterDetectionSummary, TextArtifactFile } from '~/types'

export type ChapterExportSummary = {
  sourceFormat: 'epub' | 'pdf'
  mode: 'chapters' | 'chunks'
  chunkLimitChars?: number
  sectionsKept: number
  sectionsDropped: number
  dividerSectionsMerged: number
  logicalChapterCount?: number
  logicalChapterSource?: 'toc' | 'spine' | 'heading'
  tocStartSections?: number
  pageLikeTocStartsIgnored?: number
  genericTocStartsIgnored?: number
  prefaceSectionsDropped?: number
  filesWritten: number
  chapterFilesWritten?: number
  chunkFilesWritten?: number
  directories: string[]
}

export type PdfChapterBuildResult = {
  files?: TextArtifactFile[]
  summary?: ChapterExportSummary
  detection: PdfChapterDetectionSummary
}
