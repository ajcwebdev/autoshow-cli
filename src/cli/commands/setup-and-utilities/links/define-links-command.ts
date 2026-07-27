import { createHash } from 'node:crypto'
import { basename, extname } from 'node:path'
import { extractHtmlToMarkdown } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/run-defuddle-url'
import { runFirecrawlUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/firecrawl/run-firecrawl-url'
import { defineCliCommand } from '~/cli/native/native-types'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { stripDefinedGlobalArgs } from '~/cli/native/global-arg-stripper'
import type { FetchFn, FetchUrlResult, LinksChangeStatus, LinksRefreshLinkMetadata, LinksRefreshMetadata, LinksSelection, LinksSelectionMode, ModelLinksData, RunLinksOptions } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { countReferenceTokens, REFERENCE_TOKENIZER_METADATA } from '~/utils/reference-tokenizer'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { LINKS_FETCH_TIMEOUT_MS } from '~/utils/timeouts'
import modelLinks from './model-links'

const data = modelLinks as ModelLinksData
const LINKS_OUTPUT_DIR = new URL('../../../../../project/links/', import.meta.url)
const HTML_MIME_HINTS = ['text/html', 'application/xhtml+xml'] as const
const normalizeTokens = (tokens: string[]): string[] => [...new Set(tokens.map(token => token.toLowerCase()))].sort()
const isHtmlContentType = (contentType: string): boolean =>
  HTML_MIME_HINTS.some((hint) => contentType.includes(hint))
const looksLikeHtmlDocument = (content: string): boolean =>
  /^(?:<!doctype html\b|<html\b|<head\b|<body\b)/i.test(content.trimStart())
const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
const isRemoteUrlToken = (arg: string): boolean => /^(?:blob:)?https?:\/\//i.test(arg)
const isLinksInputFileArg = (arg: string): boolean =>
  !isRemoteUrlToken(arg) && /\.(?:md|txt)$/i.test(arg)
const parseBooleanFlagValue = (value: string | undefined): boolean =>
  value === undefined || !['false', '0', 'no'].includes(value.trim().toLowerCase())
const getFetchableDocumentationUrl = (url: string): string => {
  const match = /^blob:(https?:\/\/.+)$/i.exec(url)
  return match?.[1] ?? url
}
const normalizeMarkdownForRefresh = (content: string): string =>
  content
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
const hashRefreshContent = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex')
const countCharacters = (content: string): number =>
  Array.from(content).length
const mapWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapItem: (item: TItem, index: number) => Promise<TResult>
): Promise<TResult[]> => {
  if (items.length === 0) {
    return []
  }

  const results = new Array<TResult>(items.length)
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), items.length)
  let nextIndex = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) {
        return
      }
      results[index] = await mapItem(items[index] as TItem, index)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}
const createHttpFetchError = (response: Response): Error & { status: number, headers: Headers } => {
  const error = new Error(`HTTP ${response.status} ${response.statusText}`) as Error & { status: number, headers: Headers }
  error.status = response.status
  error.headers = response.headers
  return error
}
const sanitizeLinksOutputStem = (rawStem: string, fallback: string, maxLength: number): string => {
  const sanitized = rawStem
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)

  return sanitized.length > 0 ? sanitized : fallback
}

export const getDefaultLinksOutputFileName = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): string => {
  const groups = [
    ...(globalSections.length > 0 || serviceSelections.size === 0
      ? [['all', normalizeTokens(globalSections.length > 0 ? globalSections : ['all'])] as const]
      : []),
    ...[...serviceSelections.entries()].map(([serviceName, sections]) => [
      serviceName.toLowerCase(),
      normalizeTokens(sections.length > 0 ? sections : ['all'])
    ] as const)
  ]

  const stem = groups
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([serviceName, sections]) => [serviceName, ...sections].join('-'))
    .join('--')

  return `${stem}-links.md`
}

const getDefaultOutputPath = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): URL => new URL(getDefaultLinksOutputFileName(serviceSelections, globalSections), LINKS_OUTPUT_DIR)

const sanitizeInputFileStem = (inputFilePath: string): string => {
  const extension = extname(inputFilePath)
  const rawStem = basename(inputFilePath, extension)
  return sanitizeLinksOutputStem(rawStem, 'urls', 80)
}

export const getDefaultLinksInputOutputFileName = (inputFilePath: string): string =>
  `${sanitizeInputFileStem(inputFilePath)}-links.md`

const getDefaultInputFileOutputPath = (inputFilePath: string): URL =>
  new URL(getDefaultLinksInputOutputFileName(inputFilePath), LINKS_OUTPUT_DIR)

const getDirectUrlOutputStem = (directUrl: string): string => {
  try {
    const parsedUrl = new URL(getFetchableDocumentationUrl(directUrl))
    return `${parsedUrl.hostname}${parsedUrl.pathname}`
  } catch {
    return getFetchableDocumentationUrl(directUrl)
  }
}

export const getDefaultLinksDirectUrlOutputFileName = (directUrl: string): string =>
  `${sanitizeLinksOutputStem(getDirectUrlOutputStem(directUrl), 'url', 120)}-links.md`

const getDefaultDirectUrlOutputPath = (directUrl: string): URL =>
  new URL(getDefaultLinksDirectUrlOutputFileName(directUrl), LINKS_OUTPUT_DIR)

export const getLinksRefreshMetadataPath = (outputPath: string | URL): string => {
  const resolvedOutputPath = typeof outputPath === 'string'
    ? outputPath
    : decodeURIComponent(outputPath.pathname)

  return /\.md$/i.test(resolvedOutputPath)
    ? resolvedOutputPath.replace(/\.md$/i, '.refresh.json')
    : `${resolvedOutputPath}.refresh.json`
}

const serviceEntries = Object.entries(data)
const serviceKeySet = new Set(serviceEntries.map(([serviceName]) => serviceName.toLowerCase()))
const serviceSectionKeyMap = new Map(
  serviceEntries.map(([serviceName, sections]) => [
    serviceName.toLowerCase(),
    new Set(Object.keys(sections).map(sectionName => sectionName.toLowerCase()))
  ])
)
const globalSectionKeySet = new Set(
  serviceEntries.flatMap(([, sections]) => Object.keys(sections).map(sectionName => sectionName.toLowerCase()))
)
const knownProviders = [...serviceKeySet].sort()
const knownSections = [...globalSectionKeySet].sort()

export const parseLinksArgv = (argv: string[]): LinksSelection => {
  const linksIdx = argv.findIndex((a) => a === 'links')
  const args = linksIdx >= 0 ? argv.slice(linksIdx + 1) : []

  const serviceSelections = new Map<string, string[]>()
  const globalSections: string[] = []
  let currentService: string | null = null
  let refresh = false
  let inputFilePath: string | undefined
  let directUrl: string | undefined

  for (const arg of args) {
    if (arg === '--help' || arg === '-h' || arg === '--version' || arg === '-v') continue
    if (arg.startsWith('--')) {
      const rawFlag = arg.slice(2)
      const eqIndex = rawFlag.indexOf('=')
      const flag = (eqIndex === -1 ? rawFlag : rawFlag.slice(0, eqIndex)).toLowerCase()
      const flagValue = eqIndex === -1 ? undefined : rawFlag.slice(eqIndex + 1)
      if (flag === 'refresh') {
        refresh = parseBooleanFlagValue(flagValue)
        continue
      }
      if (serviceKeySet.has(flag)) {
        if (flagValue !== undefined) {
          const sectionHint = flagValue.trim() ? `, e.g. "--${flag} ${flagValue}"` : ''
          throw CLIUsageError(`links provider selector "--${flag}" does not accept inline values; pass sections as separate arguments after the provider selector${sectionHint}.`)
        }
        currentService = flag
        if (!serviceSelections.has(currentService)) {
          serviceSelections.set(currentService, [])
        }
      } else {
        throw CLIUsageError(`Unknown links selector "--${flag}". Known providers: ${knownProviders.join(', ')}. Known sections: ${knownSections.join(', ')}.`)
      }
    } else if (isRemoteUrlToken(arg)) {
      if (directUrl) {
        throw CLIUsageError('links direct URL mode cannot be combined with provider selectors, section selectors, input file mode, or another direct URL')
      }
      directUrl = arg
    } else if (isLinksInputFileArg(arg)) {
      if (inputFilePath) {
        throw CLIUsageError('links accepts only one input file')
      }
      inputFilePath = arg
    } else if (currentService) {
      serviceSelections.get(currentService)!.push(arg.toLowerCase())
    } else {
      globalSections.push(arg.toLowerCase())
    }
  }

  if (directUrl && (inputFilePath || serviceSelections.size > 0 || globalSections.length > 0)) {
    throw CLIUsageError('links direct URL mode cannot be combined with provider selectors, section selectors, input file mode, or another direct URL')
  }

  if (inputFilePath && (serviceSelections.size > 0 || globalSections.length > 0)) {
    throw CLIUsageError('links input file mode cannot be combined with provider or section selectors')
  }

  return {
    serviceSelections,
    globalSections,
    refresh,
    ...(inputFilePath ? { inputFilePath } : {}),
    ...(directUrl ? { directUrl } : {})
  }
}

const assertKnownSections = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): void => {
  const unknownGlobalSections = globalSections.filter(sectionName => !globalSectionKeySet.has(sectionName))
  if (unknownGlobalSections.length > 0) {
    throw CLIUsageError(`Unknown links section(s): ${unknownGlobalSections.join(', ')}. Known sections: ${knownSections.join(', ')}`)
  }

  for (const [serviceName, sections] of serviceSelections) {
    const serviceSections = serviceSectionKeyMap.get(serviceName)
    const unknownSections = sections.filter(sectionName => !serviceSections?.has(sectionName))
    if (unknownSections.length > 0) {
      throw CLIUsageError(`Unknown links section(s) for --${serviceName}: ${unknownSections.join(', ')}`)
    }
  }
}

export const collectLinks = (
  serviceSelections: Map<string, string[]>,
  globalSections: string[]
): string[] => {
  const links: string[] = []
  const hasServiceSelections = serviceSelections.size > 0
  const hasGlobalSections = globalSections.length > 0

  if (hasServiceSelections) {
    for (const [serviceName, sections] of Object.entries(data)) {
      const requested = serviceSelections.get(serviceName.toLowerCase())
      if (!requested) continue
      for (const [sectionName, urls] of Object.entries(sections)) {
        if (requested.length === 0 || requested.includes(sectionName.toLowerCase())) {
          links.push(...urls)
        }
      }
    }
  }

  if (hasGlobalSections) {
    for (const sections of Object.values(data)) {
      for (const [sectionName, urls] of Object.entries(sections)) {
        if (globalSections.includes(sectionName.toLowerCase())) {
          links.push(...urls)
        }
      }
    }
  }

  if (!hasServiceSelections && !hasGlobalSections) {
    for (const sections of Object.values(data)) {
      for (const urls of Object.values(sections)) {
        links.push(...urls)
      }
    }
  }

  return [...new Set(links)]
}

const stripLinksInputComments = (content: string): string =>
  content
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('//')
    })
    .join('\n')

const normalizeExtractedUrl = (url: string): string =>
  url
    .trim()
    .replace(/^<|>$/g, '')
    .replace(/[)\],.;!?]+$/g, '')

const extractLinksInputUrls = (content: string): string[] => {
  const searchableContent = stripLinksInputComments(content)
  const urls: string[] = []
  const seen = new Set<string>()
  const addUrl = (rawUrl: string): void => {
    const url = normalizeExtractedUrl(rawUrl)
    if (!/^(?:blob:)?https?:\/\/\S+$/i.test(url)) return
    if (seen.has(url)) return
    seen.add(url)
    urls.push(url)
  }

  for (const match of searchableContent.matchAll(/(?:blob:)?https?:\/\/[^\s<>"'`]+/gi)) {
    addUrl(match[0])
  }

  return urls
}

export const readLinksInputFile = async (inputFilePath: string): Promise<string[]> => {
  const inputFile = Bun.file(inputFilePath)
  const exists = await inputFile.exists()
  if (!exists) {
    throw CLIUsageError(`Links input file not found: ${inputFilePath}`)
  }

  let content: string
  try {
    content = await inputFile.text()
  } catch (error) {
    throw CLIUsageError(`Failed to read links input file ${inputFilePath}: ${formatErrorMessage(error)}`)
  }

  if (content.trim().length === 0) {
    throw CLIUsageError(`Links input file is empty: ${inputFilePath}`)
  }

  const urls = extractLinksInputUrls(content)
  if (urls.length === 0) {
    throw CLIUsageError(`No valid remote URLs found in links input file: ${inputFilePath}`)
  }

  return urls
}

const downloadUrl = async (
  url: string,
  fetchImpl: FetchFn
): Promise<{ contentType: string, finalUrl: string, fetchedText: string, requestUrl: string }> => withRetry(
  {
    retryClass: 'runtime_http_read',
    operationName: `links fetch ${url}`,
    timeoutMs: LINKS_FETCH_TIMEOUT_MS
  },
  async (signal) => {
    const requestUrl = getFetchableDocumentationUrl(url)
    const response = await fetchImpl(requestUrl, signal ? { signal } : undefined)
    if (!response.ok) {
      throw createHttpFetchError(response)
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    const fetchedText = (await response.text()).trim()

    return {
      contentType,
      finalUrl: response.url || requestUrl,
      fetchedText,
      requestUrl
    }
  },
  (error) => classifyFetchRetry(error, 'runtime_http_read')
)

const fetchUrl = async (url: string, fetchImpl: FetchFn): Promise<FetchUrlResult> => {
  const fetchUrl = getFetchableDocumentationUrl(url)
  try {
    const { contentType, finalUrl, fetchedText, requestUrl } = await downloadUrl(url, fetchImpl)
    if (fetchedText.length === 0) {
      l.warn(`Fetched empty response from ${url}`)
      return {
        sourceUrl: url,
        fetchUrl: requestUrl,
        finalUrl,
        status: 'empty',
        content: `<!-- Empty response from ${url} -->`,
        markdownContent: ''
      }
    }

    let content: string
    if (isHtmlContentType(contentType) || looksLikeHtmlDocument(fetchedText)) {
      try {
        content = (await extractHtmlToMarkdown({
          html: fetchedText,
          documentUrl: finalUrl,
          sourceUrl: url,
          finalUrl
        })).markdown
      } catch (defuddleError) {
        l.warn(`Defuddle failed for ${url}; falling back to Firecrawl: ${formatErrorMessage(defuddleError)}`)
        try {
          content = (await runFirecrawlUrl(requestUrl, url)).markdown
        } catch (firecrawlError) {
          throw InfraError(
            `Defuddle failed and Firecrawl fallback failed. ` +
            `Defuddle: ${formatErrorMessage(defuddleError)} Firecrawl: ${formatErrorMessage(firecrawlError)}`,
            { stage: 'links:fetch' }
          )
        }
      }
    } else {
      content = fetchedText
    }

    return {
      sourceUrl: url,
      fetchUrl: requestUrl,
      finalUrl,
      status: 'success',
      content: `<!-- Source: ${url} -->\n\n${content}`,
      markdownContent: content
    }
  } catch (error) {
    l.warn(`Failed to fetch ${url}: ${formatErrorMessage(error)}`)
    return {
      sourceUrl: url,
      fetchUrl,
      status: 'failed',
      content: `<!-- Failed to fetch ${url} -->`,
      markdownContent: '',
      failedUrl: url,
      failureReason: formatErrorMessage(error)
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readPreviousLinksRefreshMetadata = async (
  sidecarPath: string
): Promise<LinksRefreshMetadata | undefined> => {
  const sidecarFile = Bun.file(sidecarPath)
  if (!await sidecarFile.exists()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(await sidecarFile.text()) as unknown
    if (!isRecord(parsed) || !Array.isArray(parsed['links'])) {
      l.warn(`Ignoring invalid links refresh metadata sidecar: ${sidecarPath}`)
      return undefined
    }
    return parsed as LinksRefreshMetadata
  } catch (error) {
    l.warn(`Ignoring unreadable links refresh metadata sidecar ${sidecarPath}: ${formatErrorMessage(error)}`)
    return undefined
  }
}

const getPreviousSuccessfulHash = (entry: LinksRefreshLinkMetadata | undefined): string | undefined => {
  if (!entry) return undefined
  if (typeof entry.contentHash === 'string' && entry.status !== 'failed') return entry.contentHash
  return typeof entry.previousHash === 'string' ? entry.previousHash : undefined
}

const getPreviousSuccessfulTokenCount = (entry: LinksRefreshLinkMetadata | undefined): number | undefined => {
  if (!entry) return undefined
  if (entry.status !== 'failed' && Number.isFinite(entry.tokenCount)) return entry.tokenCount
  return typeof entry.previousTokenCount === 'number' && Number.isFinite(entry.previousTokenCount)
    ? entry.previousTokenCount
    : undefined
}

const getPreviousSuccessfulRefreshAt = (entry: LinksRefreshLinkMetadata | undefined): string | undefined => {
  if (!entry) return undefined
  if (entry.status !== 'failed') return entry.lastSuccessfulRefreshAt ?? entry.lastRefreshAt
  return entry.lastSuccessfulRefreshAt
}

const getSelectionMode = (selection: LinksSelection): LinksSelectionMode => {
  if (selection.directUrl) return 'direct-url'
  if (selection.inputFilePath) return 'input-file'
  return 'curated'
}

const getServiceSelectionRecord = (
  serviceSelections: Map<string, string[]>
): Record<string, string[]> =>
  Object.fromEntries(
    [...serviceSelections.entries()].map(([serviceName, sections]) => [
      serviceName,
      [...sections]
    ])
  )

const getChangeStatus = (
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

const buildLinksRefreshMetadata = (
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

export const runLinksWithArgv = async (
  argv: string[],
  options: RunLinksOptions = {}
): Promise<{ outputPath: string, urlCount: number, lineCount: number, refreshMetadataPath?: string }> => {
  const selection = parseLinksArgv(argv)
  const { serviceSelections, globalSections, inputFilePath, directUrl, refresh } = selection
  assertKnownSections(serviceSelections, globalSections)
  const links = directUrl
    ? [directUrl]
    : inputFilePath
    ? await readLinksInputFile(inputFilePath)
    : collectLinks(serviceSelections, globalSections)

  if (links.length === 0) {
    throw CLIUsageError('No documentation links matched the provided selections')
  }

  const outputPath = options.outputPath ?? (
    directUrl
      ? getDefaultDirectUrlOutputPath(directUrl)
      : inputFilePath
      ? getDefaultInputFileOutputPath(inputFilePath)
      : getDefaultOutputPath(serviceSelections, globalSections)
  )
  const fetchImpl = options.fetchImpl ?? fetch

  const fetchConcurrency = DEFAULT_CLI_CONCURRENCY
  l.write('info', `Fetching ${links.length} documentation URLs with concurrency ${fetchConcurrency}`)

  const fetchResults = await mapWithConcurrency(
    links,
    fetchConcurrency,
    async (url) => await fetchUrl(url, fetchImpl)
  )
  const failedUrls = fetchResults
    .map(result => result.failedUrl)
    .filter((url): url is string => typeof url === 'string')
  if (failedUrls.length > 0) {
    l.warn(
      `Failed to fetch ${failedUrls.length}/${links.length} documentation URL${failedUrls.length === 1 ? '' : 's'} after retries:\n` +
      failedUrls.map(url => `- ${url}`).join('\n')
    )
  }

  const fetchedContents = fetchResults.map(result => result.content)
  const combinedContent = `${fetchedContents.join('\n\n')}\n`
  await Bun.write(outputPath, combinedContent)

  const resolvedOutputPath = typeof outputPath === 'string'
    ? outputPath
    : decodeURIComponent(outputPath.pathname)
  const lineCount = combinedContent.split('\n').length
  const refreshMetadataPath = getLinksRefreshMetadataPath(outputPath)

  if (refresh) {
    const previousMetadata = await readPreviousLinksRefreshMetadata(refreshMetadataPath)
    const refreshedAt = new Date().toISOString()
    const metadata = buildLinksRefreshMetadata(
      selection,
      links,
      fetchResults,
      resolvedOutputPath,
      refreshMetadataPath,
      previousMetadata,
      refreshedAt
    )
    await Bun.write(refreshMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
    l.write(
      'success',
      `Wrote ${refreshMetadataPath} (` +
      `${metadata.totals.newCount} new, ` +
      `${metadata.totals.changedCount} changed, ` +
      `${metadata.totals.unchangedCount} unchanged, ` +
      `${metadata.totals.failedChangeCount} failed, ` +
      `${metadata.totals.tokenCount} ${REFERENCE_TOKENIZER_METADATA.name} tokens)`
    )
  }

  l.write('success', `Wrote ${resolvedOutputPath} from ${links.length} URLs (${lineCount} lines)`)

  return {
    outputPath: resolvedOutputPath,
    urlCount: links.length,
    lineCount,
    ...(refresh ? { refreshMetadataPath } : {})
  }
}

export const linksCommand = defineCliCommand({
  name: 'links',
  description: 'Fetch provider documentation markdown and write a combined file',
  parameters: [{ key: '[selection...]', description: `Documentation section(s) (${knownSections.join('|')}), one URL, or one .md/.txt URL list; sections listed after a --<provider> selector scope to that provider` }],
  flags: {
    refresh: {
      description: 'Write refresh metadata sidecar with per-link hashes and token counts',
      type: Boolean,
      default: false,
      negatable: false
    },
    '<provider>': {
      description: `Provider selector, passed as a flag: ${knownProviders.map((provider) => `--${provider}`).join('|')}`,
      type: Boolean,
      negatable: false
    }
  },
  allowUnknownFlags: true,
  allowExcessParameters: true,
  help: {
    examples: [
      ['bun autoshow links', 'Fetch all provider documentation'],
      ['bun autoshow links stt', 'Fetch STT documentation across every provider'],
      ['bun autoshow links models', 'Fetch model documentation across every provider'],
      ['bun autoshow links --openai models', 'Fetch one provider section with a provider selector'],
      ['bun autoshow links https://example.com/docs', 'Fetch one documentation URL'],
      ['bun autoshow links urls.md', 'Fetch documentation URLs listed in a local file']
    ]
  }
}, async (ctx) => {
  await runLinksWithArgv(['links', ...stripDefinedGlobalArgs(ctx.argv.slice(1), GLOBAL_FLAG_DEFINITIONS, {
    preserve: ['help', 'version']
  })])
})
