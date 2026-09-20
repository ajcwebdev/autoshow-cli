import type { FetchUrlResult, LinksChangeStatus, LinksModelSource, LinksRefreshLinkMetadata, LinksRefreshMetadata, LinksSelection, LinksSelectionMode, ModelLinksData } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { isRecord } from '~/utils/rest-client'
import { countReferenceTokens, REFERENCE_TOKENIZER_METADATA } from '~/utils/reference-tokenizer'
import { formatErrorMessage } from '~/utils/value-helpers'
import { collectIdentifiers } from './links-conversion-check'
import { collectModelDocumentationFindings, getSourceCoverageKey } from './links-model-sources'
import type { LinksChangeDescriber } from './links-refresh-changes'
import { collectLinksRefreshFindings } from './links-refresh-findings'
import modelLinks from './model-links'

export const normalizeMarkdownForRefresh = (content: string): string =>
  content
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

export const hashRefreshContent = (content: string): string =>
  new Bun.CryptoHasher('sha256').update(content, 'utf8').digest('hex')

const VOLATILE_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g

// Some hosts serve the same document differently on every request: docs.x.ai shuffles its table rows, and Gladia's
// OpenAPI spec stamps the request time into its `example` fields. Change detection hashes a copy with timestamps
// masked and lines sorted, so those pages stop reporting `changed` on every run. `contentHash` still describes the
// exact bytes written to the bundle. A page whose only edit is a reorder or a timestamp reads as `unchanged`.
export const hashRefreshContentForChange = (content: string): string =>
  hashRefreshContent(content.replace(VOLATILE_TIMESTAMP, '<timestamp>').split('\n').sort().join('\n'))

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
      metadata: { sidecarPath }, error: error
    })
    return undefined
  }
}

export const getPreviousSuccessfulHash = (entry: LinksRefreshLinkMetadata | undefined): string | undefined => {
  if (!entry) return undefined
  if (typeof entry.contentHash === 'string' && entry.status !== 'failed') return entry.contentHash
  return typeof entry.previousHash === 'string' ? entry.previousHash : undefined
}

export const getPreviousSuccessfulChangeHash = (entry: LinksRefreshLinkMetadata | undefined): string | undefined => {
  if (!entry) return undefined
  if (typeof entry.changeHash === 'string' && entry.status !== 'failed') return entry.changeHash
  return typeof entry.previousChangeHash === 'string' ? entry.previousChangeHash : undefined
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
  previousTokenCount: number | undefined,
  changeHash?: string | null,
  previousChangeHash?: string
): LinksChangeStatus => {
  if (result.status === 'failed') return 'failed'
  if (previousHash === undefined || previousTokenCount === undefined || contentHash === null) return 'new'
  // Sidecars written before `changeHash` existed fall through to the exact comparison below.
  if (typeof changeHash === 'string' && changeHash === previousChangeHash) return 'unchanged'
  return contentHash === previousHash && tokenCount === previousTokenCount ? 'unchanged' : 'changed'
}

export type BuildLinksRefreshMetadataInput = {
  selection: LinksSelection
  links: string[]
  fetchResults: FetchUrlResult[]
  outputPath: string
  sidecarPath: string
  previousMetadata: LinksRefreshMetadata | undefined
  refreshedAt: string
  registry?: ModelLinksData
  modelSources?: readonly LinksModelSource[]
  modelSourceUrls?: readonly string[]
  describeChange?: LinksChangeDescriber
  previousBodies?: ReadonlyMap<string, string>
  changesPath?: string
}

// The bundle joins each link's section with one blank line, so a section starts one line after the previous
// section's last line plus that blank. An agent reads one page with `startLine` and `lineCount` instead of
// searching a file that runs to hundreds of thousands of lines.
export const getBundleLineRanges = (fetchResults: readonly FetchUrlResult[]): { startLine: number, lineCount: number }[] => {
  let nextLine = 1
  return fetchResults.map((result) => {
    const lineCount = result.content.split('\n').length
    const range = { startLine: nextLine, lineCount }
    nextLine += lineCount + 1
    return range
  })
}

export const buildLinksRefreshMetadata = (input: BuildLinksRefreshMetadataInput): LinksRefreshMetadata => {
  const { selection, links, fetchResults, outputPath, sidecarPath, previousMetadata, refreshedAt } = input
  const registry = input.registry ?? modelLinks
  const modelSources = input.modelSources ?? []
  const modelSourceUrls = input.modelSourceUrls ?? []
  const previousEntries = new Map(
    (previousMetadata?.links ?? []).map((entry) => [entry.sourceUrl, entry])
  )
  const sourceKinds = new Map(modelSources.map(source => [getSourceCoverageKey(source.url), source.kinds]))
  const lineRanges = getBundleLineRanges(fetchResults)

  const linkEntries = fetchResults.map((result, index): LinksRefreshLinkMetadata => {
    const normalizedContent = normalizeMarkdownForRefresh(result.markdownContent)
    const hasCurrentContent = result.status !== 'failed'
    const contentHash = hasCurrentContent ? hashRefreshContent(normalizedContent) : null
    const changeHash = hasCurrentContent ? hashRefreshContentForChange(normalizedContent) : null
    const tokenCount = hasCurrentContent ? countReferenceTokens(normalizedContent) : 0
    const byteCount = hasCurrentContent ? Buffer.byteLength(normalizedContent, 'utf8') : 0
    const characterCount = hasCurrentContent ? countCharacters(normalizedContent) : 0
    const previousEntry = previousEntries.get(result.sourceUrl)
    const previousHash = getPreviousSuccessfulHash(previousEntry)
    const previousChangeHash = getPreviousSuccessfulChangeHash(previousEntry)
    const previousTokenCount = getPreviousSuccessfulTokenCount(previousEntry)
    const previousLastSuccessfulRefreshAt = getPreviousSuccessfulRefreshAt(previousEntry)
    const changeStatus = getChangeStatus(result, contentHash, tokenCount, previousHash, previousTokenCount, changeHash, previousChangeHash)
    const lastSuccessfulRefreshAt = hasCurrentContent
      ? refreshedAt
      : previousLastSuccessfulRefreshAt
    const conversion = result.conversion
    const change = changeStatus === 'changed' ? input.describeChange?.(result.sourceUrl) : undefined
    const modelSource = sourceKinds.get(getSourceCoverageKey(result.sourceUrl))
    const previousBody = input.previousBodies?.get(result.sourceUrl)
    const previouslyCaptured = conversion && previousBody !== undefined
      ? collectIdentifiers(previousBody.replace(/\\_/g, '_'))
      : undefined
    const lostIdentifiers = conversion?.missingIdentifiers.filter(identifier => previouslyCaptured?.has(identifier)) ?? []

    return {
      sourceUrl: result.sourceUrl,
      fetchUrl: result.fetchUrl,
      ...(result.finalUrl ? { finalUrl: result.finalUrl } : {}),
      status: result.status,
      changeStatus,
      tokenCount,
      contentHash,
      changeHash,
      byteCount,
      characterCount,
      ...lineRanges[index],
      lastRefreshAt: refreshedAt,
      ...(lastSuccessfulRefreshAt ? { lastSuccessfulRefreshAt } : {}),
      ...(previousHash !== undefined ? { previousHash } : {}),
      ...(previousChangeHash !== undefined ? { previousChangeHash } : {}),
      ...(previousTokenCount !== undefined ? { previousTokenCount } : {}),
      ...(change ? { linesAdded: change.linesAdded, linesRemoved: change.linesRemoved } : {}),
      ...(conversion ? {
        conversion: {
          backend: conversion.backend,
          identifierCount: conversion.identifierCount,
          identifierRecall: conversion.identifierCount === 0
            ? 1
            : Number((1 - conversion.missingIdentifiers.length / conversion.identifierCount).toFixed(4)),
          missingIdentifiers: conversion.missingIdentifiers,
          ...(lostIdentifiers.length > 0 ? { lostIdentifiers } : {})
        }
      } : {}),
      ...(modelSource ? { modelSource } : {}),
      ...(result.failureReason ? { failureReason: result.failureReason } : {})
    }
  })

  // A model source is labelled by what it is, since no link config names it.
  const labelledRegistry: ModelLinksData = modelSourceUrls.length > 0
    ? { ...registry, 'Model registry': { SOURCES: [...modelSourceUrls] } }
    : registry
  const findings = [
    ...collectLinksRefreshFindings(linkEntries, labelledRegistry),
    ...collectModelDocumentationFindings(selection, fetchResults, modelSources)
  ]

  return {
    schemaVersion: 2,
    command: 'links',
    selectionMode: getSelectionMode(selection),
    selection: {
      globalSections: [...selection.globalSections],
      serviceSelections: getServiceSelectionRecord(selection.serviceSelections),
      urls: [...links],
      modelSourceUrls: [...modelSourceUrls],
      ...(selection.inputFilePath ? { inputFilePath: selection.inputFilePath } : {}),
      ...(selection.directUrl ? { directUrl: selection.directUrl } : {})
    },
    outputPath,
    sidecarPath,
    ...(input.changesPath ? { changesPath: input.changesPath } : {}),
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
      characterCount: linkEntries.reduce((sum, entry) => sum + entry.characterCount, 0),
      attentionCount: findings.length
    },
    findings,
    links: linkEntries
  }
}
