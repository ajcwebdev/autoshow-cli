import type { LinksSelection, RunLinksOptions } from '~/types'
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
import { collectModelSources, selectModelSourceLinks } from './links-model-sources'
import { getLinksRefreshChangesPath, getLinksRefreshMetadataPath, resolveDefaultLinksOutputPath } from './links-output'
import { createLinkChangeDescriber, renderLinksChangesReport, splitLinksBundle } from './links-refresh-changes'
import { renderLinksRefreshFindings } from './links-refresh-findings'
import { buildLinksRefreshMetadata, normalizeMarkdownForRefresh, readPreviousLinksRefreshMetadata } from './links-refresh-metadata'
import { assertKnownSections, collectLinks, knownProviders, knownSections, linksFlags, parseLinksSelection } from './links-selection'

export { configureLinksRefreshRoot, getDefaultLinksOutputFileName, getDefaultLinksInputOutputFileName, getDefaultLinksDirectUrlOutputFileName, getLinksRefreshChangesPath, getLinksRefreshMetadataPath } from './links-output'
export { collectLinks } from './links-selection'
export { readLinksInputFile } from './links-input-parser'

const runLinks = async (
  selection: LinksSelection,
  options: RunLinksOptions = {}
): Promise<{ outputPath: string, urlCount: number, lineCount: number, refreshMetadataPath?: string }> => {
  const { serviceSelections, globalSections, inputFilePath, directUrl, refresh } = selection
  assertKnownSections(serviceSelections, globalSections)
  const selectedLinks = directUrl
    ? [directUrl]
    : inputFilePath
    ? await readLinksInputFile(inputFilePath)
    : collectLinks(serviceSelections, globalSections)

  if (selectedLinks.length === 0) {
    throw UsageError('No documentation links matched the provided selections')
  }

  // A refresh of whole providers also re-reads the pages the model registry names as the source of its prices and
  // catalogs.
  const modelSources = refresh ? options.modelSources ?? collectModelSources() : []
  const modelSourceUrls = refresh ? selectModelSourceLinks(selection, selectedLinks, modelSources) : []
  const links = [...selectedLinks, ...modelSourceUrls]

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
      `Failed to fetch ${failedUrls.length}/${links.length} documentation URLs after retries`,
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
  // The bundle about to be overwritten is the only copy of the previous run's page bodies.
  const previousBundleFile = Bun.file(outputPath)
  const previousBodies = refresh && await previousBundleFile.exists()
    ? new Map([...splitLinksBundle(await previousBundleFile.text())].map(([url, body]) => [url, normalizeMarkdownForRefresh(body)]))
    : undefined

  await Bun.write(outputPath, combinedContent)
  l.write('info', `Wrote ${resolvedOutputPath} from ${links.length} URLs (${lineCount} lines)`, {
    category: 'artifact',
    metadata: { outputPath: resolvedOutputPath, urlCount: links.length, lineCount }
  })

  if (refresh) {
    const previousMetadata = await readPreviousLinksRefreshMetadata(refreshMetadataPath)
    const refreshedAt = new Date().toISOString()
    const changesPath = previousMetadata && previousBodies ? getLinksRefreshChangesPath(outputPath) : undefined
    const describeChange = createLinkChangeDescriber(
      previousBodies ?? new Map(),
      new Map(fetchResults.map(result => [result.sourceUrl, normalizeMarkdownForRefresh(result.markdownContent)]))
    )
    const metadata = buildLinksRefreshMetadata({
      selection,
      links,
      fetchResults,
      outputPath: resolvedOutputPath,
      sidecarPath: refreshMetadataPath,
      previousMetadata,
      refreshedAt,
      modelSources,
      modelSourceUrls,
      describeChange,
      ...(previousBodies ? { previousBodies } : {}),
      ...(changesPath ? { changesPath } : {})
    })
    await Bun.write(refreshMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
    if (changesPath && previousMetadata) {
      // Written on every comparison, including "0 changed", so the file never describes an older run.
      await Bun.write(changesPath, renderLinksChangesReport(
        metadata.links,
        describeChange,
        previousMetadata.links.map(link => link.sourceUrl),
        refreshedAt
      ))
      l.write('info', `Wrote ${changesPath} (diffs for ${metadata.totals.changedCount} changed link(s))`, {
        category: 'artifact',
        metadata: { changesPath, changedCount: metadata.totals.changedCount }
      })
    }
    l.write(
      'info',
      `Wrote ${refreshMetadataPath} (` +
      `${metadata.totals.newCount} new, ` +
      `${metadata.totals.changedCount} changed, ` +
      `${metadata.totals.unchangedCount} unchanged, ` +
      `${metadata.totals.failedChangeCount} failed, ` +
      `${metadata.totals.attentionCount} need attention, ` +
      `${metadata.totals.tokenCount} ${REFERENCE_TOKENIZER_METADATA.name} tokens)`,
      {
        category: 'artifact',
        metadata: { refreshMetadataPath, tokenizer: REFERENCE_TOKENIZER_METADATA.name, ...metadata.totals }
      }
    )
    if (metadata.findings.length > 0) {
      // The logger writes one line per call, so each finding is its own warning.
      for (const line of renderLinksRefreshFindings(metadata.findings).split('\n')) {
        l.warn(line.trim(), { category: 'pipeline', metadata: { refreshMetadataPath, attentionCount: metadata.findings.length } })
      }
    }
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
  parameters: [{ key: '[selection...]', description: `Documentation section(s) (${knownSections.join('|')}), one URL, or one .md/.txt URL list; sections after --provider <name> scope to that provider` }],
  flags: linksFlags,
  help: {
    topics: { providers: { description: 'Provider keys and positional section scoping', flags: ['provider'], notes: [`Known providers: ${knownProviders.join(', ')}.`, 'Sections before any provider selector apply globally. Each --provider selector scopes following sections until the next --provider.'] } },
    examples: [
      ['bun autoshow links', 'Fetch all provider documentation'],
      ['bun autoshow links stt', 'Fetch STT documentation across every provider'],
      ['bun autoshow links models', 'Fetch model documentation across every provider'],
      ['bun autoshow links llmstxt', 'Fetch root llms.txt indexes across every provider'],
      ['bun autoshow links --provider openai models --provider gemini text', 'Fetch distinct sections from two providers'],
      ['bun autoshow links --provider openai llmstxt', 'Fetch one provider root llms.txt index'],
      ['bun autoshow links --provider openai models', 'Fetch one provider section with a provider selector'],
      ['bun autoshow links https://example.com/docs', 'Fetch one documentation URL'],
      ['bun autoshow links urls.md', 'Fetch documentation URLs listed in a local file']
    ]
  }
}, async (ctx) => {
  const result = await runLinks(parseLinksSelection(ctx))
  l.report.result(result, 'Links complete')
})
