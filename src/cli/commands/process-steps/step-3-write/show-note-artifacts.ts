import { isRecord } from '~/utils/rest-client'
import { join } from 'node:path'
import type { ShowNoteArtifactResult, Step3Metadata, StructuredRunResult } from '~/types'
import { isSongLyricsPreset } from './structured-output/preset-registry'
import { isStructuredValidationFailureEnvelope } from './structured-output/validation-failure'

const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---/

const extractFrontmatter = (promptContent: string): string => {
  const match = promptContent.match(FRONTMATTER_PATTERN)
  return match?.[0] ?? ''
}

const appendTrailingNewline = (value: string): string => `${value.trimEnd()}\n`

const longestBacktickRun = (value: string): number => {
  const matches = value.match(/`+/g) ?? []
  return matches.reduce((max, current) => Math.max(max, current.length), 0)
}

const fencedTextBlock = (value: string): string => {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(value) + 1))
  const content = value.endsWith('\n') ? value : `${value}\n`
  return `${fence}text\n${content}${fence}`
}

const humanizeKey = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}


const renderPrimitiveList = (items: unknown[]): string | undefined => {
  if (!items.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
    return undefined
  }

  return items.map((item) => `- ${String(item)}`).join('\n')
}

const renderGenericValue = (key: string, value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return `## ${humanizeKey(key)}\n\n${value.trim()}`
  }

  if (Array.isArray(value)) {
    const renderedList = renderPrimitiveList(value)
    if (renderedList) {
      return `## ${humanizeKey(key)}\n\n${renderedList}`
    }
  }

  if (isRecord(value) || Array.isArray(value)) {
    return `## ${humanizeKey(key)}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
  }

  if (value !== null && value !== undefined) {
    return `## ${humanizeKey(key)}\n\n${String(value)}`
  }

  return undefined
}

const renderChapters = (chapters: unknown): string | undefined => {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return undefined
  }

  const renderedChapters = chapters
    .map((chapter) => {
      if (!isRecord(chapter)) {
        return undefined
      }

      const timestamp = typeof chapter['timestamp'] === 'string' ? chapter['timestamp'].trim() : ''
      const title = typeof chapter['title'] === 'string' ? chapter['title'].trim() : ''
      if (!timestamp || !title) {
        return undefined
      }

      const details: string[] = [`### ${timestamp} - ${title}`]
      if (typeof chapter['description'] === 'string' && chapter['description'].trim().length > 0) {
        details.push(chapter['description'].trim())
      }
      if (typeof chapter['quote'] === 'string' && chapter['quote'].trim().length > 0) {
        details.push(`> ${chapter['quote'].trim()}`)
      }

      return details.join('\n\n')
    })
    .filter((chapter): chapter is string => typeof chapter === 'string')

  return renderedChapters.length > 0
    ? `## Chapters\n\n${renderedChapters.join('\n\n')}`
    : undefined
}

const renderShowNoteRecord = (record: Record<string, unknown>): string[] => {
  const sections: string[] = []
  const consumedKeys = new Set<string>()

  if (typeof record['episodeDescription'] === 'string') {
    sections.push(`## Episode Description\n\n${record['episodeDescription'].trim()}`)
    consumedKeys.add('episodeDescription')
  }

  if (typeof record['episodeSummary'] === 'string') {
    sections.push(`## Episode Summary\n\n${record['episodeSummary'].trim()}`)
    consumedKeys.add('episodeSummary')
  }

  const renderedChapters = renderChapters(record['chapters'])
  if (renderedChapters) {
    sections.push(renderedChapters)
    consumedKeys.add('chapters')
  }

  if (typeof record['content'] === 'string') {
    sections.push(record['content'].trim())
    consumedKeys.add('content')
  }

  for (const [key, value] of Object.entries(record)) {
    if (consumedKeys.has(key)) {
      continue
    }
    const rendered = renderGenericValue(key, value)
    if (rendered) {
      sections.push(rendered)
    }
  }

  return sections
}

const looksLikePromptEnvelope = (record: Record<string, unknown>): boolean =>
  Object.values(record).some((value) => isRecord(value))
    && !('episodeDescription' in record)
    && !('episodeSummary' in record)
    && !('chapters' in record)

const hasSongLyricsPreset = (metadata: Pick<Step3Metadata, 'structuredPresetNames'>): boolean =>
  metadata.structuredPresetNames.some(isSongLyricsPreset)

const renderShowNoteBody = (
  parsedJson: unknown,
  fallbackRenderedText: string,
  metadata: Pick<Step3Metadata, 'structuredPresetNames'>
): string => {
  if (isStructuredValidationFailureEnvelope(parsedJson) || hasSongLyricsPreset(metadata)) {
    return fallbackRenderedText.trimEnd()
  }

  if (!isRecord(parsedJson)) {
    return fallbackRenderedText.trimEnd()
  }

  const sections = looksLikePromptEnvelope(parsedJson)
    ? Object.values(parsedJson).flatMap((value) =>
        isRecord(value) ? renderShowNoteRecord(value) : []
      )
    : renderShowNoteRecord(parsedJson)

  return sections.length > 0
    ? sections.join('\n\n')
    : fallbackRenderedText.trimEnd()
}

const buildShowNoteFileName = (
  metadata: Pick<Step3Metadata, 'outputFileName'>
): string => {
  const stem = metadata.outputFileName.replace(/\.json$/u, '')
  if (stem === 'text') {
    return 'show-note.md'
  }

  if (stem.startsWith('text-')) {
    return `show-note-${stem.slice('text-'.length)}.md`
  }
  return `show-note-${stem}.md`
}

const buildShowNoteArtifactKey = (fileName: string): string => {
  if (fileName === 'show-note.md') {
    return 'showNote'
  }

  return fileName
    .replace(/\.md$/u, '')
    .replace(/^show-note-/u, 'showNote-')
}

const buildShowNoteContent = (options: {
  frontmatter: string
  bodyContent: string
  sourceText: string
}): string => {
  const parts = [
    options.frontmatter,
    options.bodyContent.trimEnd(),
    `## Source\n\n${fencedTextBlock(options.sourceText)}`
  ].filter((part) => part.trim().length > 0)

  return appendTrailingNewline(parts.join('\n\n'))
}

export const writeShowNoteArtifacts = async (options: {
  outputDir: string
  results: StructuredRunResult[]
  sourceText: string
}): Promise<ShowNoteArtifactResult> => {
  const internalArtifacts: Record<string, string> = {}
  if (options.results.length === 0) {
    return { internalArtifacts }
  }

  const promptContent = await Bun.file(join(options.outputDir, 'prompt.md')).text()
  const frontmatter = extractFrontmatter(promptContent)

  for (const result of options.results) {
    const fileName = buildShowNoteFileName(result.metadata)
    const content = buildShowNoteContent({
      frontmatter,
      bodyContent: renderShowNoteBody(result.parsedJson, result.renderedText, result.metadata),
      sourceText: options.sourceText
    })
    await Bun.write(join(options.outputDir, fileName), content)
    internalArtifacts[buildShowNoteArtifactKey(fileName)] = fileName
  }

  return { internalArtifacts }
}
