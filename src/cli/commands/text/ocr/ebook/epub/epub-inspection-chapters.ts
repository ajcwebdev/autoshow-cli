import { firstTagText } from '~/utils/xml-scan'
import type { EpubChapter, EpubContentReader, EpubInspectionPayload, EpubTocItem, TocBoundary } from '~/types'
import { cleanEpubHtmlToText, decodeLegacyPuaText } from './cleanup'
import { stripNsPrefixes, cleanEpubHtmlFragmentToText } from './epub-inspection-markup'
import { validateReadableSpineContent } from './epub-spine-readability'
import { buildTocItemsByPath } from './epub-inspection-navigation'
import { buildTocBoundaries } from './epub-html-toc-boundaries'

const appendChapter = (
  chapters: EpubChapter[],
  spineItem: EpubInspectionPayload['spine'][number],
  text: string,
  options: {
    path: string
    title?: string
    tocItem?: EpubTocItem
  }
): void => {
  const words = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length

  chapters.push({
    index: chapters.length + 1,
    idref: spineItem.idref,
    href: spineItem.href ?? '',
    path: options.path,
    ...(options.title ? { title: options.title } : {}),
    ...(options.tocItem ? { tocTitle: options.tocItem.title, isTocStart: true } : {}),
    text,
    wordCount: words,
    characterCount: text.length
  })
}

const buildChapterFromFullSpineItem = async (
  chapters: EpubChapter[],
  spineItem: EpubInspectionPayload['spine'][number],
  spinePath: string,
  html: string,
  tocItem?: EpubTocItem
): Promise<void> => {
  const titleRaw = tocItem?.title
    ?? firstTagText(html, 'h1')
    ?? firstTagText(html, 'title')
  const title = titleRaw ? decodeLegacyPuaText(titleRaw) : undefined
  const text = await cleanEpubHtmlToText(html)
  appendChapter(chapters, spineItem, text, {
    path: spinePath,
    ...(title ? { title } : {}),
    ...(tocItem ? { tocItem } : {})
  })
}

const buildChaptersFromTocBoundaries = async (
  chapters: EpubChapter[],
  spineItem: EpubInspectionPayload['spine'][number],
  spinePath: string,
  html: string,
  tocItems: EpubTocItem[],
  warnings: string[]
): Promise<boolean> => {
  if (tocItems.length === 0) {
    return false
  }

  const boundaries = await buildTocBoundaries(html, spinePath, tocItems, warnings)
  if (boundaries.length === 0) {
    return false
  }

  const firstBoundary = boundaries[0] as TocBoundary
  if (firstBoundary.startOffset > 0) {
    const preludeText = await cleanEpubHtmlFragmentToText(html.slice(0, firstBoundary.startOffset))
    if (preludeText.length > 0) {
      const title = firstTagText(html, 'title')
      appendChapter(chapters, spineItem, preludeText, {
        path: spinePath,
        ...(title ? { title } : {})
      })
    }
  }

  for (let index = 0; index < boundaries.length; index++) {
    const boundary = boundaries[index] as TocBoundary
    const nextBoundary = boundaries[index + 1]
    const endOffset = nextBoundary ? nextBoundary.startOffset : html.length
    const text = await cleanEpubHtmlFragmentToText(html.slice(boundary.startOffset, endOffset))
    appendChapter(chapters, spineItem, text, {
      path: spinePath,
      title: boundary.tocItem.title,
      tocItem: boundary.tocItem
    })
  }

  return true
}

export const buildChapters = async (
  reader: EpubContentReader,
  spine: EpubInspectionPayload['spine'],
  tocItems: EpubTocItem[],
  warnings: string[]
): Promise<EpubChapter[]> => {
  const tocByPath = buildTocItemsByPath(tocItems)
  const chapters: EpubChapter[] = []

  for (const spineItem of spine) {
    if (!spineItem.path || !spineItem.href) continue
    if (!reader.hasEntry(spineItem.path)) {
      warnings.push(`Missing chapter entry referenced in spine: ${spineItem.path}`)
      continue
    }

    const xhtml = await reader.readText(spineItem.path)
    validateReadableSpineContent(xhtml, spineItem.path)
    const stripped = stripNsPrefixes(xhtml)
    const tocForPath = tocByPath.get(spineItem.path) ?? []
    if (await buildChaptersFromTocBoundaries(chapters, spineItem, spineItem.path, stripped, tocForPath, warnings)) {
      continue
    }

    await buildChapterFromFullSpineItem(chapters, spineItem, spineItem.path, stripped, tocForPath[0])
  }

  return chapters
}

export const buildPageText = (chapters: EpubChapter[]): string =>
  chapters
    .map(chapter => chapter.text)
    .join('\n\n')
    .trim()
