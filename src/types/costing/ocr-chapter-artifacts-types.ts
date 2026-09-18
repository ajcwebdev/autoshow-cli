import type { EpubExportSummary, PdfChapterDetectionSummary, PdfExportSummary, TextArtifactFile } from '~/types'

export type ChapterExportSummary = EpubExportSummary | PdfExportSummary

export type PdfChapterBuildResult = {
  files?: TextArtifactFile[]
  summary?: PdfExportSummary
  detection: PdfChapterDetectionSummary
}
