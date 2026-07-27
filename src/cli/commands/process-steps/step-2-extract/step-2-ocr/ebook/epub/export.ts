import type { EpubArtifactFile, EpubChapter, EpubTextOutput, EpubTextSection, HeadingDetectionContext, PageResult, TextArtifactFile } from '~/types'
import { buildChapterArtifactRelativePaths } from '../../chapter-artifact-filenames'
import { finalizeEpubText } from './cleanup'
import { buildSectionSlug, normalizeInlineWhitespace, splitWithHardLimit } from './text-split'
import { isGenericTocTitle } from './toc-classification'
import { normalizeHeadingKey, stripLeadingNumberedTitleKey } from './heading-detection'
import { groupSectionsByTocStarts, mergeDividerSections } from './chapter-grouping'

export { splitWithHardLimit } from './text-split'

const chapterSourceKey = (chapter: EpubChapter): string =>
  chapter.path || chapter.href || chapter.idref || `chapter:${chapter.index}`

const buildSections = (chapters: EpubChapter[]): EpubTextSection[] => {
  const sourceIndexByKey = new Map<string, number>()

  return chapters.map((chapter) => {
    const sourceKey = chapterSourceKey(chapter)
    let sourceIndex = sourceIndexByKey.get(sourceKey)
    if (sourceIndex === undefined) {
      sourceIndex = sourceIndexByKey.size + 1
      sourceIndexByKey.set(sourceKey, sourceIndex)
    }

    return {
      index: chapter.index,
      id: chapter.idref,
      title: chapter.title ?? '',
      href: chapter.href,
      text: finalizeEpubText(chapter.text),
      ...(chapter.isTocStart === true ? { isTocStart: true } : {}),
      sourceIndexes: [sourceIndex]
    }
  })
}

const prepareSections = (
  chapters: EpubChapter[]
): { sections: EpubTextSection[], sectionsDropped: number, dividerSectionsMerged: number } => {
  const cleanedSections = buildSections(chapters)
  const keptSections = cleanedSections.filter((section) => section.text.length > 0)
  const sectionsDropped = cleanedSections.length - keptSections.length
  const { sections, dividerSectionsMerged } = mergeDividerSections(keptSections)

  return { sections, sectionsDropped, dividerSectionsMerged }
}

const buildCombinedText = (sections: EpubTextSection[]): string =>
  finalizeEpubText(
    sections
      .map((section) => section.text.trim())
      .filter((text) => text.length > 0)
      .join('\n\n')
  )

const addTitleLikeKey = (keys: Set<string>, value: string): void => {
  const key = normalizeHeadingKey(value)
  if (key.length === 0 || isGenericTocTitle(key)) {
    return
  }

  keys.add(key)
  const withoutNumber = stripLeadingNumberedTitleKey(key)
  if (withoutNumber.length > 0 && withoutNumber !== key && !isGenericTocTitle(withoutNumber)) {
    keys.add(withoutNumber)
  }
}

const addDocumentTitleLikeKeys = (keys: Set<string>, value: string | undefined): void => {
  const normalized = normalizeInlineWhitespace(value ?? '')
  if (normalized.length === 0) {
    return
  }

  addTitleLikeKey(keys, normalized)
  for (const segment of normalized.split(/\s*[.:;|]\s+|\s+[-–—]\s+/)) {
    addTitleLikeKey(keys, segment)
  }
}

const collectTitlePageLikeLines = (sections: EpubTextSection[]): string[] =>
  sections
    .slice(0, 2)
    .flatMap((section) => section.text.split('\n'))
    .map(normalizeInlineWhitespace)
    .filter((line) => line.length > 0 && line.length <= 80)
    .slice(0, 8)

const buildHeadingDetectionContext = (
  sections: EpubTextSection[],
  options: {
    documentSlug: string
    documentTitle?: string
  }
): HeadingDetectionContext => {
  const titleLikeKeys = new Set<string>()
  addDocumentTitleLikeKeys(titleLikeKeys, options.documentTitle)
  addDocumentTitleLikeKeys(titleLikeKeys, options.documentSlug)

  for (const section of sections) {
    addDocumentTitleLikeKeys(titleLikeKeys, section.title)
  }

  for (const line of collectTitlePageLikeLines(sections)) {
    addDocumentTitleLikeKeys(titleLikeKeys, line)
  }

  return { titleLikeKeys }
}

const buildPages = (sections: EpubTextSection[]): PageResult[] =>
  sections.map((section) => ({
    pageNumber: section.index,
    method: 'text',
    text: section.text
  }))

const buildChapterFiles = (
  sections: EpubTextSection[],
  chunkLimitChars?: number
): EpubArtifactFile[] => {
  const fileParts: Array<{
    section: EpubTextSection
    ordinal: number
    text: string
    partIndex?: number
  }> = []
  let emittedSectionOrdinal = 0

  for (const section of sections) {
    const parts = typeof chunkLimitChars === 'number'
      ? splitWithHardLimit(section.text, chunkLimitChars)
      : [section.text]
    const nonEmptyParts = parts.filter((part) => part.length > 0)
    if (nonEmptyParts.length === 0) {
      continue
    }

    emittedSectionOrdinal += 1

    if (nonEmptyParts.length <= 1) {
      const onlyPart = nonEmptyParts[0]
      if (onlyPart === undefined) {
        continue
      }
      fileParts.push({
        section,
        ordinal: emittedSectionOrdinal,
        text: onlyPart
      })
      continue
    }

    for (const [index, part] of nonEmptyParts.entries()) {
      fileParts.push({
        section,
        ordinal: emittedSectionOrdinal,
        partIndex: index + 1,
        text: part
      })
    }
  }

  const relativePaths = buildChapterArtifactRelativePaths(fileParts.map((filePart) => ({
    ordinal: filePart.ordinal,
    sourceLocator: filePart.section.sourceIndexes?.find((value) => Number.isFinite(value) && value > 0) ?? filePart.section.index,
    slug: buildSectionSlug(filePart.section),
    ...(typeof filePart.partIndex === 'number' ? { partIndex: filePart.partIndex } : {})
  })))

  return fileParts.map((filePart, index): TextArtifactFile => {
    const relativePath = relativePaths[index]
    if (relativePath === undefined) {
      throw new Error('Missing EPUB chapter artifact relative path')
    }

    return {
      relativePath,
      text: filePart.text
    }
  })
}

const buildChunkFiles = (
  documentSlug: string,
  text: string,
  chunkLimitChars: number
): EpubArtifactFile[] =>
  splitWithHardLimit(text, chunkLimitChars)
    .filter((chunk) => chunk.length > 0)
    .map((chunk, index) => ({
      relativePath: `chunks/${documentSlug}-${String(index + 1).padStart(3, '0')}.txt`,
      text: chunk
    }))

export const buildEpubTextOutput = (
  documentSlug: string,
  chapters: EpubChapter[],
  options: {
    chapterFiles?: boolean
    chunkLimitChars?: number
    documentTitle?: string
    normalizedFrom?: string
  }
): EpubTextOutput => {
  const { sections, sectionsDropped, dividerSectionsMerged } = prepareSections(chapters)
  const headingContext = buildHeadingDetectionContext(sections, {
    documentSlug,
    ...(options.documentTitle ? { documentTitle: options.documentTitle } : {})
  })
  const text = buildCombinedText(sections)
  const pages = buildPages(sections)

  if (options.chapterFiles) {
    const logicalChapters = groupSectionsByTocStarts(sections, headingContext)
    const files = buildChapterFiles(logicalChapters.sections, options.chunkLimitChars)
    return {
      pages,
      text,
      exportPlan: {
        files,
        summary: {
          sourceFormat: 'epub',
          ...(options.normalizedFrom ? { normalizedFrom: options.normalizedFrom } : {}),
          mode: 'chapters',
          ...(typeof options.chunkLimitChars === 'number' ? { chunkLimitChars: options.chunkLimitChars } : {}),
          sectionsKept: sections.length,
          sectionsDropped,
          dividerSectionsMerged,
          logicalChapterCount: logicalChapters.sections.length,
          logicalChapterSource: logicalChapters.logicalChapterSource,
          tocStartSections: logicalChapters.tocStartSections,
          prefaceSectionsDropped: logicalChapters.prefaceSectionsDropped,
          ...(typeof logicalChapters.pageLikeTocStartsIgnored === 'number' ? { pageLikeTocStartsIgnored: logicalChapters.pageLikeTocStartsIgnored } : {}),
          ...(typeof logicalChapters.genericTocStartsIgnored === 'number' ? { genericTocStartsIgnored: logicalChapters.genericTocStartsIgnored } : {}),
          ...(typeof logicalChapters.bodyTextTocStartsIgnored === 'number' ? { bodyTextTocStartsIgnored: logicalChapters.bodyTextTocStartsIgnored } : {}),
          filesWritten: files.length,
          chapterFilesWritten: files.length,
          directories: ['chapters']
        }
      }
    }
  }

  if (typeof options.chunkLimitChars === 'number') {
    const files = buildChunkFiles(documentSlug, text, options.chunkLimitChars)
    return {
      pages,
      text,
      exportPlan: {
        files,
        summary: {
          sourceFormat: 'epub',
          ...(options.normalizedFrom ? { normalizedFrom: options.normalizedFrom } : {}),
          mode: 'chunks',
          chunkLimitChars: options.chunkLimitChars,
          sectionsKept: sections.length,
          sectionsDropped,
          dividerSectionsMerged,
          filesWritten: files.length,
          chunkFilesWritten: files.length,
          directories: ['chunks']
        }
      }
    }
  }

  return { pages, text }
}
