import { firstStartTag, readAttr, scanTagBlocks } from '~/utils/xml-scan'
import type { EpubContentReader, EpubInspectionPayload } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { stripNsPrefixes } from './epub-inspection-markup'
import { normalizeEntryPath, normalizeRootRelativeHref } from './epub-package-paths'

const EPUB_UNREADABLE_CONTENT_ERROR = 'The EPUB content appears encrypted or unsupported, and AutoShow does not remove DRM. Provide a readable EPUB or PDF after your own authorized workflow.'

const EPUB_UNREADABLE_CONTENT_REASON = 'epub-unreadable-content'

const parseEncryptedEntryPaths = (encryptionXml: string): Set<string> => {
  const xml = stripNsPrefixes(encryptionXml)
  return new Set(
    scanTagBlocks(xml, 'CipherReference')
      .map(block => firstStartTag(block, 'CipherReference') ?? '')
      .map(startTag => readAttr(startTag, 'URI') ?? '')
      .map(normalizeRootRelativeHref)
      .filter(Boolean)
  )
}

export const readEncryptedEntryPaths = async (reader: EpubContentReader): Promise<Set<string>> => {
  if (!reader.hasEntry('META-INF/encryption.xml')) {
    return new Set()
  }

  return parseEncryptedEntryPaths(await reader.readText('META-INF/encryption.xml'))
}

const isHtmlSpineEntry = (spineItem: EpubInspectionPayload['spine'][number]): boolean => {
  const mediaType = spineItem.mediaType?.toLowerCase() ?? ''
  return mediaType.includes('html') || /\.(?:xhtml|html?|xml)$/i.test(spineItem.path ?? '')
}

const throwUnreadableEpubContent = (detail: string): never => {
  throw ValidationError(`${EPUB_UNREADABLE_CONTENT_ERROR} ${detail}`, {
    stage: 'ocr:epub',
    metadata: {
      reason: EPUB_UNREADABLE_CONTENT_REASON,
      detail
    }
  })
}

export const validateSpineEncryption = (
  spine: EpubInspectionPayload['spine'],
  encryptedEntryPaths: Set<string>
): void => {
  if (encryptedEntryPaths.size === 0) {
    return
  }

  const encryptedSpinePaths = spine
    .filter(spineItem => spineItem.path && isHtmlSpineEntry(spineItem))
    .map(spineItem => normalizeEntryPath(spineItem.path ?? ''))
    .filter(path => encryptedEntryPaths.has(path))

  if (encryptedSpinePaths.length === 0) {
    return
  }

  const uniquePaths = [...new Set(encryptedSpinePaths)]
  const listedPaths = uniquePaths.slice(0, 5).join(', ')
  const suffix = uniquePaths.length > 5 ? `, ... (${uniquePaths.length} total)` : ''
  throwUnreadableEpubContent(`Encrypted spine entries: ${listedPaths}${suffix}.`)
}

const EPUB_SPINE_CONTENT_MARKUP_RE = /<\s*(?:[a-z][\w.-]*:)?(?:html|head|body|title|section|article|main|nav|div|p|h[1-6]|span|ol|ul|li|table|tr|td|th|blockquote|br)\b/i

const isSuspiciousControlChar = (char: string): boolean => {
  const codePoint = char.codePointAt(0)
  if (codePoint === undefined) return false
  return (codePoint < 0x20 && char !== '\n' && char !== '\r' && char !== '\t')
    || (codePoint >= 0x7f && codePoint <= 0x9f)
}

export const validateReadableSpineContent = (html: string, spinePath: string): void => {
  const trimmed = html.trim()
  if (trimmed.length === 0) {
    return
  }

  const chars = Array.from(trimmed)
  const totalChars = Math.max(1, chars.length)
  const replacementCount = chars.filter(char => char === '\uFFFD').length
  const controlCount = chars.filter(isSuspiciousControlChar).length

  if (trimmed.includes('\0')) {
    throwUnreadableEpubContent(`Unreadable binary content found in spine entry: ${spinePath}.`)
  }
  if (replacementCount >= 3 && replacementCount / totalChars >= 0.01) {
    throwUnreadableEpubContent(`Unreadable replacement-character content found in spine entry: ${spinePath}.`)
  }
  if (controlCount >= 3 && controlCount / totalChars >= 0.02) {
    throwUnreadableEpubContent(`Unreadable control-character content found in spine entry: ${spinePath}.`)
  }
  if (!EPUB_SPINE_CONTENT_MARKUP_RE.test(trimmed)) {
    throwUnreadableEpubContent(`No recognizable XHTML/HTML markup found in spine entry: ${spinePath}.`)
  }
}
