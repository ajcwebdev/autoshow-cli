import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type { EpubTextSection, HeadingDetectionContext, LogicalChapterSource } from '~/types'
import { finalizeEpubText } from './cleanup'
import { CHAPTER_SLUG_MAX_LENGTH, hrefBasename, normalizeInlineWhitespace } from './text-split'
import {
  BODY_TEXT_TOC_RATIO,
  isGenericTocTitle,
  isPageLikeTocTitle,
  MIN_BODY_TEXT_TOC_STARTS,
  MIN_HEADING_FALLBACK_CHAPTERS,
  PAGE_LIKE_TOC_RATIO
} from './toc-classification'
import {
  extractSemanticHeadingTitle,
  filterNotesSubheadingCandidates,
  findHeadingCandidates,
  normalizedChapterBaseRegex
} from './heading-detection'

const normalizeSectionKey = (value: string): string =>
  sanitizeTitleSlug(value, CHAPTER_SLUG_MAX_LENGTH)

const isStandalonePartDivider = (section: EpubTextSection): boolean => {
  const normalizedText = normalizeInlineWhitespace(section.text)
  const normalizedTitle = normalizeInlineWhitespace(section.title)
  if (normalizedText.length === 0 || normalizedTitle.length === 0 || normalizedText !== normalizedTitle) {
    return false
  }

  const keys = [
    normalizeSectionKey(section.title),
    normalizeSectionKey(section.id),
    normalizeSectionKey(hrefBasename(section.href))
  ]

  return keys.some((key) => /^part(?:[0-9]+|-[a-z0-9-]+)?$/.test(key))
}

export const mergeDividerSections = (
  sections: EpubTextSection[]
): { sections: EpubTextSection[], dividerSectionsMerged: number } => {
  const merged: EpubTextSection[] = []
  const pendingDividers: EpubTextSection[] = []
  let dividerSectionsMerged = 0

  for (const section of sections) {
    if (isStandalonePartDivider(section)) {
      pendingDividers.push(section)
      continue
    }

    if (pendingDividers.length === 0) {
      merged.push(section)
      continue
    }

    dividerSectionsMerged += pendingDividers.length
    const prefix = pendingDividers.map((entry) => entry.text).join('\n\n')
    const pendingSourceIndexes = pendingDividers.flatMap((entry) => entry.sourceIndexes ?? [entry.index])
    pendingDividers.length = 0
    merged.push({
      ...section,
      sourceIndexes: [
        ...pendingSourceIndexes,
        ...(section.sourceIndexes ?? [section.index])
      ],
      text: finalizeEpubText(`${prefix}\n\n${section.text}`)
    })
  }

  if (pendingDividers.length > 0) {
    if (merged.length === 0) {
      merged.push(...pendingDividers)
    } else {
      dividerSectionsMerged += pendingDividers.length
      const suffix = pendingDividers.map((entry) => entry.text).join('\n\n')
      const lastSection = merged[merged.length - 1] as EpubTextSection
      merged[merged.length - 1] = {
        ...lastSection,
        sourceIndexes: [
          ...(lastSection.sourceIndexes ?? [lastSection.index]),
          ...pendingDividers.flatMap((entry) => entry.sourceIndexes ?? [entry.index])
        ],
        text: finalizeEpubText(`${lastSection.text}\n\n${suffix}`)
      }
    }
  }

  return { sections: merged, dividerSectionsMerged }
}

const appendSectionText = (target: EpubTextSection, section: EpubTextSection): EpubTextSection => ({
  ...target,
  text: finalizeEpubText(`${target.text}\n\n${section.text}`),
  sourceIndexes: [
    ...(target.sourceIndexes ?? [target.index]),
    ...(section.sourceIndexes ?? [section.index])
  ]
})

const appendSectionTextFragment = (
  target: EpubTextSection,
  section: EpubTextSection,
  text: string
): EpubTextSection => ({
  ...target,
  text: finalizeEpubText(`${target.text}\n\n${text}`),
  sourceIndexes: [
    ...(target.sourceIndexes ?? [target.index]),
    ...(section.sourceIndexes ?? [section.index])
  ]
})

const buildHeadingSection = (
  section: EpubTextSection,
  title: string,
  text: string
): EpubTextSection => ({
  index: section.index,
  id: section.id,
  title,
  href: section.href,
  text: finalizeEpubText(text),
  sourceIndexes: section.sourceIndexes ?? [section.index]
})

const normalizeTocParagraphPrefix = (value: string): string =>
  normalizeInlineWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isLongBodyParagraph = (value: string): boolean => {
  const normalized = normalizeInlineWhitespace(value)
  return normalized.length >= 80
    && normalized.split(/\s+/).length >= 12
    && /[a-z]/.test(normalized)
    && /[.!?,"']/.test(normalized)
    && !extractSemanticHeadingTitle(normalized)
}

const firstTextParagraph = (text: string): string =>
  text
    .split(/\n\n+/)
    .map((paragraph) => normalizeInlineWhitespace(paragraph))
    .find((paragraph) => paragraph.length > 0) ?? ''

const isBodyTextTocStart = (section: EpubTextSection): boolean => {
  if (section.isTocStart !== true || isPageLikeTocTitle(section.title) || isGenericTocTitle(section.title)) {
    return false
  }

  const title = normalizeInlineWhitespace(section.title)
  const titleKey = normalizeTocParagraphPrefix(title)
  if (titleKey.length < 18 || extractSemanticHeadingTitle(title)) {
    return false
  }

  const paragraph = firstTextParagraph(section.text)
  if (!isLongBodyParagraph(paragraph)) {
    return false
  }

  const paragraphKey = normalizeTocParagraphPrefix(paragraph)
  return paragraphKey.startsWith(titleKey)
}

const stripIgnoredTocTitles = (
  sections: EpubTextSection[],
  options: { stripBodyTextTocStarts?: boolean } = {}
): EpubTextSection[] =>
  sections.map((section) => {
    if (section.isTocStart !== true) {
      return section
    }
    return isPageLikeTocTitle(section.title)
      || isGenericTocTitle(section.title)
      || (options.stripBodyTextTocStarts === true && isBodyTextTocStart(section))
      ? { ...section, title: '' }
      : section
  })

const buildIgnoredTocFallback = (
  sections: EpubTextSection[],
  metadata: {
    tocStartSections: number
    pageLikeTocStartsIgnored?: number
    genericTocStartsIgnored?: number
    bodyTextTocStartsIgnored?: number
  },
  context: HeadingDetectionContext
): {
  sections: EpubTextSection[]
  logicalChapterSource: LogicalChapterSource
  tocStartSections: number
  prefaceSectionsDropped: number
  pageLikeTocStartsIgnored?: number
  genericTocStartsIgnored?: number
  bodyTextTocStartsIgnored?: number
} => {
  const headingGrouped = groupSectionsByHeadingStarts(sections, context)
  if (headingGrouped.sections.length >= MIN_HEADING_FALLBACK_CHAPTERS) {
    return {
      ...headingGrouped,
      tocStartSections: metadata.tocStartSections,
      ...(typeof metadata.pageLikeTocStartsIgnored === 'number' ? { pageLikeTocStartsIgnored: metadata.pageLikeTocStartsIgnored } : {}),
      ...(typeof metadata.genericTocStartsIgnored === 'number' ? { genericTocStartsIgnored: metadata.genericTocStartsIgnored } : {}),
      ...(typeof metadata.bodyTextTocStartsIgnored === 'number' ? { bodyTextTocStartsIgnored: metadata.bodyTextTocStartsIgnored } : {})
    }
  }

  return {
    sections: stripIgnoredTocTitles(sections, {
      stripBodyTextTocStarts: typeof metadata.bodyTextTocStartsIgnored === 'number'
    }),
    logicalChapterSource: 'spine',
    tocStartSections: metadata.tocStartSections,
    prefaceSectionsDropped: 0,
    ...(typeof metadata.pageLikeTocStartsIgnored === 'number' ? { pageLikeTocStartsIgnored: metadata.pageLikeTocStartsIgnored } : {}),
    ...(typeof metadata.genericTocStartsIgnored === 'number' ? { genericTocStartsIgnored: metadata.genericTocStartsIgnored } : {}),
    ...(typeof metadata.bodyTextTocStartsIgnored === 'number' ? { bodyTextTocStartsIgnored: metadata.bodyTextTocStartsIgnored } : {})
  }
}

export const groupSectionsByTocStarts = (
  sections: EpubTextSection[],
  context: HeadingDetectionContext
): {
  sections: EpubTextSection[]
  logicalChapterSource: LogicalChapterSource
  tocStartSections: number
  prefaceSectionsDropped: number
  pageLikeTocStartsIgnored?: number
  genericTocStartsIgnored?: number
  bodyTextTocStartsIgnored?: number
} => {
  const tocStartSections = sections.filter((section) => section.isTocStart === true).length
  if (tocStartSections === 0) {
    return {
      sections,
      logicalChapterSource: 'spine',
      tocStartSections,
      prefaceSectionsDropped: 0
    }
  }

  const pageLikeTocStarts = sections.filter((section) => section.isTocStart === true && isPageLikeTocTitle(section.title)).length
  const genericTocStarts = sections.filter((section) => section.isTocStart === true && !isPageLikeTocTitle(section.title) && isGenericTocTitle(section.title)).length
  const bodyTextTocStarts = sections.filter(isBodyTextTocStart).length
  const usefulTocStarts = tocStartSections - pageLikeTocStarts - genericTocStarts
  const hasPageListToc = pageLikeTocStarts > 0
    && pageLikeTocStarts / tocStartSections >= PAGE_LIKE_TOC_RATIO
    && (pageLikeTocStarts >= 3 || pageLikeTocStarts === tocStartSections)
  const hasBodyTextToc = bodyTextTocStarts >= MIN_BODY_TEXT_TOC_STARTS
    && bodyTextTocStarts / tocStartSections >= BODY_TEXT_TOC_RATIO

  if (hasPageListToc) {
    return buildIgnoredTocFallback(sections, {
      tocStartSections,
      pageLikeTocStartsIgnored: pageLikeTocStarts
    }, context)
  }

  if (genericTocStarts > 0 && usefulTocStarts < MIN_HEADING_FALLBACK_CHAPTERS) {
    return buildIgnoredTocFallback(sections, {
      tocStartSections,
      genericTocStartsIgnored: genericTocStarts
    }, context)
  }

  if (hasBodyTextToc) {
    return buildIgnoredTocFallback(sections, {
      tocStartSections,
      bodyTextTocStartsIgnored: bodyTextTocStarts
    }, context)
  }

  if (tocStartSections === 1) {
    const headingGrouped = groupSectionsByHeadingStarts(sections, context)
    if (headingGrouped.sections.length >= MIN_HEADING_FALLBACK_CHAPTERS) {
      return {
        ...headingGrouped,
        tocStartSections
      }
    }
  }

  const grouped: EpubTextSection[] = []
  let current: EpubTextSection | undefined
  let prefaceSectionsDropped = 0

  for (const section of sections) {
    if (section.isTocStart === true) {
      if (current) {
        grouped.push({ ...current, index: grouped.length + 1 })
      }
      current = { ...section }
      continue
    }

    if (!current) {
      prefaceSectionsDropped += 1
      continue
    }

    current = appendSectionText(current, section)
  }

  if (current) {
    grouped.push({ ...current, index: grouped.length + 1 })
  }

  return {
    sections: grouped,
    logicalChapterSource: 'toc',
    tocStartSections,
    prefaceSectionsDropped
  }
}

const extractChapterHeadingBaseKey = (key: string): string | undefined => {
  const match = key.match(normalizedChapterBaseRegex)
  if (!match) {
    return undefined
  }

  return `chapter ${match[2] ?? ''}`.trim()
}

const repeatedHeadingKeysMatch = (candidateKey: string, currentHeadingKey: string | undefined): boolean => {
  if (!currentHeadingKey) {
    return false
  }
  if (candidateKey === currentHeadingKey) {
    return true
  }

  const candidateChapterBase = extractChapterHeadingBaseKey(candidateKey)
  const currentChapterBase = extractChapterHeadingBaseKey(currentHeadingKey)
  return candidateChapterBase !== undefined
    && currentChapterBase !== undefined
    && candidateChapterBase === currentChapterBase
}

const groupSectionsByHeadingStarts = (
  sections: EpubTextSection[],
  context: HeadingDetectionContext
): {
  sections: EpubTextSection[]
  logicalChapterSource: 'heading'
  prefaceSectionsDropped: number
} => {
  const grouped: EpubTextSection[] = []
  let current: EpubTextSection | undefined
  let currentHeadingKey: string | undefined
  let prefaceSectionsDropped = 0

  for (const section of sections) {
    const candidates = filterNotesSubheadingCandidates(
      findHeadingCandidates(section.text, context),
      currentHeadingKey === 'notes'
    )
    if (candidates.length === 0) {
      if (!current) {
        prefaceSectionsDropped += 1
        continue
      }
      current = appendSectionText(current, section)
      continue
    }

    const preludeText = finalizeEpubText(section.text.slice(0, candidates[0]?.start ?? 0))
    if (preludeText.length > 0) {
      if (current) {
        current = appendSectionTextFragment(current, section, preludeText)
      } else {
        prefaceSectionsDropped += 1
      }
    } else if (!current && candidates[0]?.start !== 0) {
      prefaceSectionsDropped += 1
    }

    for (const [index, candidate] of candidates.entries()) {
      const nextCandidate = candidates[index + 1]
      const candidateText = finalizeEpubText(section.text.slice(candidate.start, nextCandidate?.start ?? section.text.length))
      if (candidateText.length === 0) {
        continue
      }

      if (current && repeatedHeadingKeysMatch(candidate.key, currentHeadingKey)) {
        current = appendSectionTextFragment(current, section, candidateText)
        continue
      }

      if (current) {
        grouped.push({ ...current, index: grouped.length + 1 })
      }
      current = buildHeadingSection(section, candidate.title, candidateText)
      currentHeadingKey = candidate.key
    }
  }

  if (current) {
    grouped.push({ ...current, index: grouped.length + 1 })
  }

  return {
    sections: grouped,
    logicalChapterSource: 'heading',
    prefaceSectionsDropped
  }
}
