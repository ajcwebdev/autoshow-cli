import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CONVERTIBLE_EBOOK_EXTENSIONS } from '~/cli/commands/sources/metadata/formats/metadata-convertible-ebooks'
import { InfraError } from '~/utils/error-handler'
import { sourceDownloadSignal, writeHttpPayloadToFile } from '~/utils/http-payload'
import { settleCleanups } from '~/utils/settle-cleanups'

type HeaderExtensionRule = {
  extension: string
  dispositionMarkers: readonly string[]
  contentTypeFragment?: string
  contentTypePrefix?: string
}

type PathnameExtensionRule = { extension: string, suffixes: readonly string[] }

const HEADER_RULES_BEFORE_EBOOKS: readonly HeaderExtensionRule[] = [
  { extension: '.epub', dispositionMarkers: ['.epub'], contentTypeFragment: 'application/epub+zip' },
  { extension: '.docx', dispositionMarkers: ['.docx'], contentTypeFragment: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { extension: '.pptx', dispositionMarkers: ['.pptx'], contentTypeFragment: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { extension: '.xlsx', dispositionMarkers: ['.xlsx'], contentTypeFragment: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { extension: '.odt', dispositionMarkers: ['.odt'], contentTypeFragment: 'application/vnd.oasis.opendocument.text' },
  { extension: '.ods', dispositionMarkers: ['.ods'], contentTypeFragment: 'application/vnd.oasis.opendocument.spreadsheet' },
  { extension: '.odp', dispositionMarkers: ['.odp'], contentTypeFragment: 'application/vnd.oasis.opendocument.presentation' }
]

const HEADER_RULES_AFTER_EBOOKS: readonly HeaderExtensionRule[] = [
  { extension: '.png', dispositionMarkers: ['.png'], contentTypePrefix: 'image/png' },
  { extension: '.jpg', dispositionMarkers: ['.jpg', '.jpeg'], contentTypePrefix: 'image/jpeg' },
  { extension: '.tif', dispositionMarkers: ['.tif', '.tiff'], contentTypePrefix: 'image/tiff' },
  { extension: '.pdf', dispositionMarkers: ['.pdf'], contentTypeFragment: 'application/pdf' }
]

const PATHNAME_RULES_BEFORE_EBOOKS: readonly PathnameExtensionRule[] = [
  { extension: '.pdf', suffixes: ['.pdf'] },
  { extension: '.epub', suffixes: ['.epub'] },
  { extension: '.docx', suffixes: ['.docx'] },
  { extension: '.pptx', suffixes: ['.pptx'] },
  { extension: '.xlsx', suffixes: ['.xlsx'] },
  { extension: '.odt', suffixes: ['.odt'] },
  { extension: '.ods', suffixes: ['.ods'] },
  { extension: '.odp', suffixes: ['.odp'] }
]

const PATHNAME_RULES_AFTER_EBOOKS: readonly PathnameExtensionRule[] = [
  { extension: '.png', suffixes: ['.png'] },
  { extension: '.jpg', suffixes: ['.jpg', '.jpeg'] },
  { extension: '.tif', suffixes: ['.tif', '.tiff'] }
]

const matchHeaderRule = (
  rules: readonly HeaderExtensionRule[],
  lowerContentDisposition: string,
  lowerContentType: string
): string | undefined => rules.find(rule =>
  rule.dispositionMarkers.some(marker => lowerContentDisposition.includes(marker))
  || (rule.contentTypeFragment !== undefined && lowerContentType.includes(rule.contentTypeFragment))
  || (rule.contentTypePrefix !== undefined && lowerContentType.startsWith(rule.contentTypePrefix))
)?.extension

const matchPathnameRule = (rules: readonly PathnameExtensionRule[], pathname: string): string | undefined =>
  rules.find(rule => rule.suffixes.some(suffix => pathname.endsWith(suffix)))?.extension

const extensionFromHeaders = (lowerContentDisposition: string, lowerContentType: string): string | undefined => {
  const leading = matchHeaderRule(HEADER_RULES_BEFORE_EBOOKS, lowerContentDisposition, lowerContentType)
  if (leading) return leading
  for (const extension of CONVERTIBLE_EBOOK_EXTENSIONS) {
    if (lowerContentDisposition.includes(extension)) return extension
  }
  return matchHeaderRule(HEADER_RULES_AFTER_EBOOKS, lowerContentDisposition, lowerContentType)
}

const extensionFromPathname = (url: string): string | undefined => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const leading = matchPathnameRule(PATHNAME_RULES_BEFORE_EBOOKS, pathname)
    if (leading) return leading
    for (const extension of CONVERTIBLE_EBOOK_EXTENSIONS) {
      if (pathname.endsWith(extension)) return extension
    }
    return matchPathnameRule(PATHNAME_RULES_AFTER_EBOOKS, pathname)
  } catch {
    return undefined
  }
}

const extensionFromUrl = (
  url: string,
  contentType?: string | null,
  contentDisposition?: string | null
): string => {
  const lowerContentType = contentType?.toLowerCase() ?? ''
  const lowerContentDisposition = contentDisposition?.toLowerCase() ?? ''

  return extensionFromHeaders(lowerContentDisposition, lowerContentType)
    ?? extensionFromPathname(url)
    ?? '.pdf'
}

export const downloadDocumentUrlToTempFile = async (
  url: string
): Promise<{ filePath: string, cleanup: () => Promise<void> }> => {
  const response = await fetch(url, { signal: sourceDownloadSignal() })
  if (!response.ok) {
    throw InfraError(`Failed to download document URL: ${url} (${response.status})`, { stage: 'download:document', status: response.status })
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-doc-url-'))
  const ext = extensionFromUrl(
    url,
    response.headers.get('content-type'),
    response.headers.get('content-disposition')
  )
  const filePath = join(tempDir, `document${ext}`)
  try {
    await writeHttpPayloadToFile(response, filePath, { payloadClass: 'source', stage: 'download:document' })
  } catch (error) {
    await settleCleanups([async () => await rm(tempDir, { recursive: true, force: true })], {
      label: 'Document download',
      stage: 'download:document',
      primaryFailed: true
    })
    throw error
  }

  return {
    filePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}
