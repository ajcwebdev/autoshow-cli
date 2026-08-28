import type { FetchUrlResult, LinksChangeStatus, LinksRefreshLinkMetadata, LinksRefreshMetadata, LinksSelection, LinksSelectionMode } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { isRecord } from '~/utils/rest-client'
import { serializeDiagnosticError } from '~/utils/error-handler'
import { countReferenceTokens, REFERENCE_TOKENIZER_METADATA } from '~/utils/reference-tokenizer'
import { formatErrorMessage } from '~/utils/value-helpers'

export const normalizeMarkdownForRefresh = (content: string): string =>
  content
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

export const hashRefreshContent = (content: string): string =>
  new Bun.CryptoHasher('sha256').update(content, 'utf8').digest('hex')

export const countCharacters = (content: string): number =>
  Array.from(content).length

export const readPreviousLinksRefreshMetadata = async (
  sidecarPath: string
): Promise<LinksRefreshMetadata | undefined> => {
  const sidecarFile = Bun.file(sidecarPath)
  if (!await sidecarFile.exists()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(await sidecarFile.text()) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed['links'])) {
      l.warn(`Ignoring invalid links refresh metadata sidecar: ${sidecarPath}`, { category: 'artifact', metadata: { sidecarPath } })
      return undefined
    }
    return parsed as LinksRefreshMetadata
  } catch (error) {
    l.warn(`Ignoring unreadable links refresh metadata sidecar ${sidecarPath}: ${formatErrorMessage(error)}`, {
      category: 'artifact',
      metadata: { sidecarPath, error: serializeDiagnosticError(error) }
    })
    return undefined
  }
}

export const getPreviousSuccessfulHash = (entry: LinksRefreshLinkMetadata | undefined): string | undefined => {
  if (!entry) return undefined
  if (typeof entry.contentHash === 'string' && entry.status !== 'failed') return entry.contentHash
  return typeof entry.previousHash === 'string' ? entry.previousHash : undefined
}

export const getPreviousSuccessfulTokenCount = (entry: LinksRefreshLinkMetadata | undefined): number | undefined => {
  if (!entry) return undefined
  if (entry.status !== 'failed' && Number.isFinite(entry.tokenCount)) return entry.tokenCount
  return typeof entry.previousTokenCount === 'number' && Number.isFinite(entry.previousTokenCount)
    ? entry.previousTokenCount
    : undefined
}

export const getPreviousSuccessfulRefreshAt = (entry: LinksRefreshLinkMetadata | undefined): string | undefined => {
  if (!entry) return undefined
  if (entry.status !== 'failed') return entry.lastSuccessfulRefreshAt ?? entry.lastRefreshAt
  return entry.lastSuccessfulRefreshAt
}

export const getSelectionMode = (selection: LinksSelection): LinksSelectionMode => {
  if (selection.directUrl) return 'direct-url'
  if (selection.inputFilePath) return 'input-file'
  return 'curated'
}

export const getServiceSelectionRecord = (
  serviceSelections: Map<string, string[]>
): Record<string, string[]> =>
  Object.fromEntries(
    [...serviceSelections.entries()].map(([serviceName, sections]) => [
      serviceName,
      [...sections]
    ])
  )

export const getChangeStatus = (
  result: FetchUrlResult,
  contentHash: string | null,
  tokenCount: number,
  previousHash: string | undefined,
  previousTokenCount: number | undefined
): LinksChangeStatus => {
  if (result.status === 'failed') return 'failed'
  if (previousHash === undefined || previousTokenCount === undefined || contentHash === null) return 'new'
  return contentHash === previousHash && tokenCount === previousTokenCount ? 'unchanged' : 'changed'
}

export const buildLinksRefreshMetadata = (
  selection: LinksSelection,
  links: string[],
  fetchResults: FetchUrlResult[],
  outputPath: string,
  sidecarPath: string,
  previousMetadata: LinksRefreshMetadata | undefined,
  refreshedAt: string
): LinksRefreshMetadata => {
  const previousEntries = new Map(
    (previousMetadata?.links ?? []).map((entry) => [entry.sourceUrl, entry])
  )

  const linkEntries = fetchResults.map((result): LinksRefreshLinkMetadata => {
    const normalizedContent = normalizeMarkdownForRefresh(result.markdownContent)
    const hasCurrentContent = result.status !== 'failed'
    const contentHash = hasCurrentContent ? hashRefreshContent(normalizedContent) : null
    const tokenCount = hasCurrentContent ? countReferenceTokens(normalizedContent) : 0
    const byteCount = hasCurrentContent ? Buffer.byteLength(normalizedContent, 'utf8') : 0
    const characterCount = hasCurrentContent ? countCharacters(normalizedContent) : 0
    const previousEntry = previousEntries.get(result.sourceUrl)
    const previousHash = getPreviousSuccessfulHash(previousEntry)
    const previousTokenCount = getPreviousSuccessfulTokenCount(previousEntry)
    const previousLastSuccessfulRefreshAt = getPreviousSuccessfulRefreshAt(previousEntry)
    const changeStatus = getChangeStatus(result, contentHash, tokenCount, previousHash, previousTokenCount)
    const lastSuccessfulRefreshAt = hasCurrentContent
      ? refreshedAt
      : previousLastSuccessfulRefreshAt

    return {
      sourceUrl: result.sourceUrl,
      fetchUrl: result.fetchUrl,
      ...(result.finalUrl ? { finalUrl: result.finalUrl } : {}),
      status: result.status,
      changeStatus,
      tokenCount,
      tokenizer: REFERENCE_TOKENIZER_METADATA,
      contentHash,
      byteCount,
      characterCount,
      lastRefreshAt: refreshedAt,
      ...(lastSuccessfulRefreshAt ? { lastSuccessfulRefreshAt } : {}),
      ...(previousHash !== undefined ? { previousHash } : {}),
      ...(previousTokenCount !== undefined ? { previousTokenCount } : {}),
      ...(result.failureReason ? { failureReason: result.failureReason } : {})
    }
  })

  return {
    schemaVersion: 1,
    command: 'links',
    selectionMode: getSelectionMode(selection),
    selection: {
      globalSections: [...selection.globalSections],
      serviceSelections: getServiceSelectionRecord(selection.serviceSelections),
      urls: [...links],
      ...(selection.inputFilePath ? { inputFilePath: selection.inputFilePath } : {}),
      ...(selection.directUrl ? { directUrl: selection.directUrl } : {})
    },
    outputPath,
    sidecarPath,
    refreshedAt,
    tokenizer: REFERENCE_TOKENIZER_METADATA,
    totals: {
      linkCount: linkEntries.length,
      successfulCount: linkEntries.filter(entry => entry.status === 'success').length,
      emptyCount: linkEntries.filter(entry => entry.status === 'empty').length,
      failedCount: linkEntries.filter(entry => entry.status === 'failed').length,
      newCount: linkEntries.filter(entry => entry.changeStatus === 'new').length,
      unchangedCount: linkEntries.filter(entry => entry.changeStatus === 'unchanged').length,
      changedCount: linkEntries.filter(entry => entry.changeStatus === 'changed').length,
      failedChangeCount: linkEntries.filter(entry => entry.changeStatus === 'failed').length,
      tokenCount: linkEntries.reduce((sum, entry) => sum + entry.tokenCount, 0),
      byteCount: linkEntries.reduce((sum, entry) => sum + entry.byteCount, 0),
      characterCount: linkEntries.reduce((sum, entry) => sum + entry.characterCount, 0)
    },
    links: linkEntries
  }
}
