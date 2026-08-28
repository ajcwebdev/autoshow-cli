import type { ChapterArtifactFilenamePart } from '~/types'

const chapterArtifactNumberWidth = (fileCount: number): number =>
  fileCount >= 100 ? 3 : 2

const coercePositiveInteger = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback
  }
  const integer = Math.trunc(value)
  return integer > 0 ? integer : fallback
}

const formatArtifactNumber = (value: number, width: number): string =>
  String(coercePositiveInteger(value, 1)).padStart(width, '0')

export const formatChapterArtifactSourceLocator = (value: number): string =>
  String(coercePositiveInteger(value, 1)).padStart(3, '0')

const buildUniquePath = (
  baseName: string,
  partSuffix: string,
  usedPaths: Set<string>
): string => {
  let collisionIndex = 1
  let relativePath = `chapters/${baseName}${partSuffix}.txt`

  while (usedPaths.has(relativePath)) {
    collisionIndex += 1
    relativePath = `chapters/${baseName}-${String(collisionIndex).padStart(2, '0')}${partSuffix}.txt`
  }

  usedPaths.add(relativePath)
  return relativePath
}

export const buildChapterArtifactRelativePaths = (
  parts: ChapterArtifactFilenamePart[]
): string[] => {
  const width = chapterArtifactNumberWidth(parts.length)
  const usedPaths = new Set<string>()

  return parts.map((part) => {
    const slug = part.slug.trim().length > 0 ? part.slug.trim() : 'chapter'
    const baseName = [
      formatArtifactNumber(part.ordinal, width),
      formatChapterArtifactSourceLocator(part.sourceLocator),
      slug
    ].join('-')
    const partSuffix = typeof part.partIndex === 'number'
      ? `-part-${formatArtifactNumber(part.partIndex, width)}`
      : ''

    return buildUniquePath(baseName, partSuffix, usedPaths)
  })
}
