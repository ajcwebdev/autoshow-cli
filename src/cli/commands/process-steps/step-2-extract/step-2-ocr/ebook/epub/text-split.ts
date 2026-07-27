import { basename, extname } from 'node:path'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type { EpubTextSection } from '~/types'

export const CHAPTER_SLUG_MAX_LENGTH = 60

export const normalizeInlineWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const stripFinalExtension = (value: string): string =>
  value.slice(0, value.length - extname(value).length)

export const hrefBasename = (href: string): string => {
  const withoutFragment = href.split(/[?#]/, 1)[0] ?? ''
  const fileName = basename(withoutFragment)
  return fileName.length > 0 ? stripFinalExtension(fileName) : ''
}

export const buildSectionSlug = (section: Pick<EpubTextSection, 'index' | 'title' | 'id' | 'href'>): string => {
  const candidates = [
    sanitizeTitleSlug(section.title, CHAPTER_SLUG_MAX_LENGTH),
    sanitizeTitleSlug(section.id, CHAPTER_SLUG_MAX_LENGTH),
    sanitizeTitleSlug(hrefBasename(section.href), CHAPTER_SLUG_MAX_LENGTH)
  ].filter((value) => value.length > 0)

  return candidates[0] ?? `section-${section.index}`
}

export const splitWithHardLimit = (text: string, maxChars: number): string[] => {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (trimmed.length === 0) {
      continue
    }

    const candidate = current.length > 0 ? `${current}\n\n${trimmed}` : trimmed
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current.length > 0) {
      chunks.push(current)
      current = ''
    }

    if (trimmed.length <= maxChars) {
      current = trimmed
      continue
    }

    const words = trimmed.split(/\s+/)
    let wordChunk = ''
    for (const word of words) {
      const next = wordChunk.length > 0 ? `${wordChunk} ${word}` : word
      if (next.length <= maxChars) {
        wordChunk = next
        continue
      }

      if (wordChunk.length > 0) {
        chunks.push(wordChunk)
        wordChunk = ''
      }

      if (word.length <= maxChars) {
        wordChunk = word
        continue
      }

      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars))
      }
    }

    if (wordChunk.length > 0) {
      current = wordChunk
    }
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}
