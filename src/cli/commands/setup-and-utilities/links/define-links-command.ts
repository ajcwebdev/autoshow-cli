import type { LinksRefreshMetadata, LinksSelection, RunLinksOptions } from '~/types'
import { defineCliCommand } from '~/cli/native/native-types'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import * as l from '~/utils/app-logger/app-logger'
import { UsageError } from '~/utils/error-handler'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { REFERENCE_TOKENIZER_METADATA } from '~/utils/reference-tokenizer'
import { fetchUrl } from './links-fetcher'
import { readLinksInputFile } from './links-input-parser'
import { getLinksRefreshMetadataPath, resolveDefaultLinksOutputPath } from './links-output'
import { buildLinksRefreshMetadata, hashRefreshContent, normalizeMarkdownForRefresh, readPreviousLinksRefreshMetadata } from './links-refresh-metadata'
import { assertKnownSections, collectLinks, knownSections, linksFlags, parseLinksSelection } from './links-selection'

export { getDefaultLinksOutputFileName, getDefaultLinksInputOutputFileName, getDefaultLinksDirectUrlOutputFileName, getLinksRefreshMetadataPath } from './links-output'
export { collectLinks } from './links-selection'
export { readLinksInputFile } from './links-input-parser'

const runLinks = async (
  selection: LinksSelection,
  options: RunLinksOptions = {}
): Promise<{ outputPath: string, urlCount: number, lineCount: number, refreshMetadataPath?: string }> => {
  const { serviceSelections, globalSections, inputFilePath, directUrl, refresh } = selection
  assertKnownSections(serviceSelections, globalSections)
  const links = directUrl
    ? [directUrl]
    : inputFilePath
    ? await readLinksInputFile(inputFilePath)
    : collectLinks(serviceSelections, globalSections)

  if (links.length === 0) {
    throw UsageError('No documentation links matched the provided selections')
  }

  const outputPath = options.outputPath ?? await resolveDefaultLinksOutputPath(selection)
  const fetchImpl = options.fetchImpl ?? fetch

  const fetchConcurrency = DEFAULT_CLI_CONCURRENCY
  l.write('info', `Fetching ${links.length} documentation URLs with concurrency ${fetchConcurrency}`, {
    category: 'pipeline',
    metadata: { urlCount: links.length, fetchConcurrency }
  })

  const fetchResults = await mapWithConcurrency(
    fetchConcurrency,
    links,
    async (url) => await fetchUrl(url, fetchImpl)
  )
  const failedUrls = fetchResults
    .map(result => result.failedUrl)
    .filter((url): url is string => typeof url === 'string')
  if (failedUrls.length > 0) {
    l.warn(
      `Failed to fetch ${failedUrls.length}/${links.length} documentation URL${failedUrls.length === 1 ? '' : 's'} after retries:\n` +
      failedUrls.map(url => `- ${url}`).join('\n'),
      { category: 'pipeline', metadata: { failedUrls, failedCount: failedUrls.length, urlCount: links.length } }
    )
  }

  const fetchedContents = fetchResults.map(result => result.content)
  const combinedContent = `${fetchedContents.join('\n\n')}\n`

  const resolvedOutputPath = typeof outputPath === 'string'
    ? outputPath
    : decodeURIComponent(outputPath.pathname)
  const lineCount = combinedContent.split('\n').length
  const refreshMetadataPath = getLinksRefreshMetadataPath(outputPath)

  const isRefreshOnly = selection.refreshOnly === true
  const outputFileExists = await Bun.file(outputPath).exists()
  let markdownWritten = true

  if (isRefreshOnly && outputFileExists) {
    markdownWritten = false
    const existingContent = await Bun.file(outputPath).text()
    const existingHash = hashRefreshContent(normalizeMarkdownForRefresh(existingContent))
    const freshHash = hashRefreshContent(normalizeMarkdownForRefresh(combinedContent))

    if (existingHash !== freshHash) {
      l.warn(
        `Documentation content updated on remote server; run without --refresh-only to update Markdown bundle at ${resolvedOutputPath}.`,
        { category: 'artifact', metadata: { outputPath: resolvedOutputPath, refreshOnly: true } }
      )
    }
  } else {
    await Bun.write(outputPath, combinedContent)
    l.write('success', `Wrote ${resolvedOutputPath} from ${links.length} URLs (${lineCount} lines)`, {
    category: 'artifact',
    metadata: { outputPath: resolvedOutputPath, urlCount: links.length, lineCount }
  })
  }

  if (refresh) {
    const previousMetadata = await readPreviousLinksRefreshMetadata(refreshMetadataPath)
    const refreshedAt = new Date().toISOString()
    const rawMetadata = buildLinksRefreshMetadata(
      selection,
      links,
      fetchResults,
      resolvedOutputPath,
      refreshMetadataPath,
      previousMetadata,
      refreshedAt
    )
    const metadata: LinksRefreshMetadata = {
      ...rawMetadata,
      markdownWritten
    }
    await Bun.write(refreshMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
    l.write(
      'success',
      `Wrote ${refreshMetadataPath} (` +
      `${metadata.totals.newCount} new, ` +
      `${metadata.totals.changedCount} changed, ` +
      `${metadata.totals.unchangedCount} unchanged, ` +
      `${metadata.totals.failedChangeCount} failed, ` +
      `${metadata.totals.tokenCount} ${REFERENCE_TOKENIZER_METADATA.name} tokens)`,
      {
        category: 'artifact',
        metadata: { refreshMetadataPath, tokenizer: REFERENCE_TOKENIZER_METADATA.name, ...metadata.totals }
      }
    )
  }

  return {
    outputPath: resolvedOutputPath,
    urlCount: links.length,
    lineCount,
    ...(refresh ? { refreshMetadataPath } : {})
  }
}

export const parseLinksArgv = (argv: string[]) => {
  const parsed = parseCommandInvocation(argv, linksCommand, GLOBAL_FLAG_DEFINITIONS)
  return parseLinksSelection(parsed)
}

export const runLinksWithArgv = async (
  argv: string[],
  options: RunLinksOptions = {}
): Promise<{ outputPath: string, urlCount: number, lineCount: number, refreshMetadataPath?: string }> =>
  await runLinks(parseLinksArgv(argv), options)

export const linksCommand = defineCliCommand({
  name: 'links',
  description: 'Fetch provider documentation markdown and write a combined file',
  parameters: [{ key: '[selection...]', description: `Documentation section(s) (${knownSections.join('|')}), one URL, or one .md/.txt URL list; sections listed after a --<provider> selector scope to that provider` }],
  flags: linksFlags,
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
  await runLinks(parseLinksSelection(ctx))
})
