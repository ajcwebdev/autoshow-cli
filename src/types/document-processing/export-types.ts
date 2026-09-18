import type { PageResult, TextArtifactFile } from '~/types'
import type { ChapterExportSummaryEvidence } from '../pipeline-core/process-extraction-types'

export type LogicalChapterSource = 'toc' | 'spine' | 'heading'

export type TextLine = {
  index: number
  start: number
  trimmed: string
}

export type HeadingCandidate = {
  title: string
  key: string
  start: number
  lineIndex: number
  consumedThroughLineIndex: number
  kind?: string
}

export type DocumentExportSummaryEvidence = ChapterExportSummaryEvidence

export type EpubExportSummary = DocumentExportSummaryEvidence & {
  sourceFormat: 'epub'
}

export type PdfExportSummary = DocumentExportSummaryEvidence & {
  sourceFormat: 'pdf'
}

export type EpubExportPlan = {
  files: TextArtifactFile[]
  summary: EpubExportSummary
}

export type EpubTextOutput = {
  pages: PageResult[]
  text: string
  exportPlan?: EpubExportPlan
}
