import type { PageResult, TextArtifactFile } from '~/types'

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

type EpubExportPlan = {
  files: TextArtifactFile[]
  summary: {
    sourceFormat: 'epub'
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
    bodyTextTocStartsIgnored?: number
    prefaceSectionsDropped?: number
    filesWritten: number
    chapterFilesWritten?: number
    chunkFilesWritten?: number
    directories: string[]
  }
}

export type EpubTextOutput = {
  pages: PageResult[]
  text: string
  exportPlan?: EpubExportPlan
}
