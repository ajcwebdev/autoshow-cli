import { expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import type { FetchFn, LinksRefreshLinkMetadata, LinksRefreshMetadata } from '~/types'
import {
  getLinksRefreshMetadataPath,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { linksTestOutputPath } from './shared'

const DIRECT_REFRESH_URL = 'blob:https://example.com/docs'
const DIRECT_FETCH_URL = 'https://example.com/docs'
const ELEVENLABS_MODELS_URL = 'https://elevenlabs.io/docs/overview/models.md'

const markdownResponse = (content: string): Response =>
  new Response(content, {
    headers: { 'content-type': 'text/markdown' }
  })

const readRefreshMetadata = async (path: string): Promise<LinksRefreshMetadata> =>
  JSON.parse(await Bun.file(path).text()) as LinksRefreshMetadata

const firstRefreshLink = (metadata: LinksRefreshMetadata): LinksRefreshLinkMetadata => {
  const link = metadata.links[0]
  if (!link) {
    throw new Error('Expected refresh metadata to include at least one link')
  }
  return link
}

const refreshLinkAt = (metadata: LinksRefreshMetadata, index: number): LinksRefreshLinkMetadata => {
  const link = metadata.links[index]
  if (!link) {
    throw new Error(`Expected refresh metadata to include link at index ${index}`)
  }
  return link
}

const successfulContentHash = (link: LinksRefreshLinkMetadata): string => {
  if (link.contentHash === null) {
    throw new Error('Expected successful refresh metadata to include a content hash')
  }
  return link.contentHash
}

test('links refresh writes first sidecar metadata while normal links runs omit it', async () => {
  const outputPath = linksTestOutputPath('refresh-first')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const fetchImpl: FetchFn = async () => markdownResponse('alpha')

  const normalResult = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    DIRECT_REFRESH_URL
  ], { outputPath, fetchImpl })

  expect(normalResult.refreshMetadataPath).toBeUndefined()
  expect(await Bun.file(sidecarPath).exists()).toBe(false)

  const refreshResult = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath, fetchImpl })

  const metadata = await readRefreshMetadata(sidecarPath)
  const link = firstRefreshLink(metadata)
  expect(refreshResult.refreshMetadataPath).toBe(sidecarPath)
  expect(metadata.schemaVersion).toBe(1)
  expect(metadata.selectionMode).toBe('direct-url')
  expect(metadata.selection.directUrl).toBe(DIRECT_REFRESH_URL)
  expect(metadata.selection.urls).toEqual([DIRECT_REFRESH_URL])
  expect(metadata.outputPath).toBe(outputPath)
  expect(metadata.sidecarPath).toBe(sidecarPath)
  expect(metadata.tokenizer).toEqual({
    name: 'o200k_base',
    packageName: 'tiktoken',
    packageVersion: '1.0.22'
  })
  expect(metadata.totals.linkCount).toBe(1)
  expect(metadata.totals.successfulCount).toBe(1)
  expect(metadata.totals.newCount).toBe(1)
  expect(metadata.totals.tokenCount).toBe(link.tokenCount)
  expect(link.sourceUrl).toBe(DIRECT_REFRESH_URL)
  expect(link.fetchUrl).toBe(DIRECT_FETCH_URL)
  expect(link.finalUrl).toBe(DIRECT_FETCH_URL)
  expect(link.status).toBe('success')
  expect(link.changeStatus).toBe('new')
  expect(link.tokenCount).toBeGreaterThan(0)
  expect(link.contentHash).toMatch(/^[a-f0-9]{64}$/)
  expect(link.byteCount).toBe(Buffer.byteLength('alpha', 'utf8'))
  expect(link.characterCount).toBe(5)
  expect(link.lastSuccessfulRefreshAt).toBe(link.lastRefreshAt)
})

test('links refresh marks an unchanged second refresh', async () => {
  const outputPath = linksTestOutputPath('refresh-unchanged')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const fetchImpl: FetchFn = async () => markdownResponse('alpha')

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath, fetchImpl })
  const firstMetadata = await readRefreshMetadata(sidecarPath)

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath, fetchImpl })
  const secondMetadata = await readRefreshMetadata(sidecarPath)
  const firstLink = firstRefreshLink(firstMetadata)
  const secondLink = firstRefreshLink(secondMetadata)

  expect(secondMetadata.totals.unchangedCount).toBe(1)
  expect(secondMetadata.totals.changedCount).toBe(0)
  expect(secondLink.changeStatus).toBe('unchanged')
  expect(secondLink.previousHash).toBe(successfulContentHash(firstLink))
  expect(secondLink.previousTokenCount).toBe(firstLink.tokenCount)
})

test('links refresh marks token-count changes and same-token hash changes as changed', async () => {
  const tokenChangePath = linksTestOutputPath('refresh-token-change')
  const tokenChangeSidecar = getLinksRefreshMetadataPath(tokenChangePath)
  let tokenContent = 'alpha'
  const tokenFetch: FetchFn = async () => markdownResponse(tokenContent)

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath: tokenChangePath, fetchImpl: tokenFetch })
  const firstTokenMetadata = await readRefreshMetadata(tokenChangeSidecar)
  tokenContent = 'alpha beta gamma'
  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath: tokenChangePath, fetchImpl: tokenFetch })
  const secondTokenMetadata = await readRefreshMetadata(tokenChangeSidecar)
  const firstTokenLink = firstRefreshLink(firstTokenMetadata)
  const secondTokenLink = firstRefreshLink(secondTokenMetadata)

  expect(secondTokenLink.changeStatus).toBe('changed')
  expect(secondTokenLink.previousHash).toBe(successfulContentHash(firstTokenLink))
  expect(secondTokenLink.previousTokenCount).toBe(firstTokenLink.tokenCount)
  expect(secondTokenLink.tokenCount).not.toBe(firstTokenLink.tokenCount)

  const sameTokenPath = linksTestOutputPath('refresh-same-token-hash-change')
  const sameTokenSidecar = getLinksRefreshMetadataPath(sameTokenPath)
  let sameTokenContent = 'alpha'
  const sameTokenFetch: FetchFn = async () => markdownResponse(sameTokenContent)

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath: sameTokenPath, fetchImpl: sameTokenFetch })
  const firstSameTokenMetadata = await readRefreshMetadata(sameTokenSidecar)
  sameTokenContent = 'beta'
  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath: sameTokenPath, fetchImpl: sameTokenFetch })
  const secondSameTokenMetadata = await readRefreshMetadata(sameTokenSidecar)
  const firstSameTokenLink = firstRefreshLink(firstSameTokenMetadata)
  const secondSameTokenLink = firstRefreshLink(secondSameTokenMetadata)

  expect(secondSameTokenLink.changeStatus).toBe('changed')
  expect(secondSameTokenLink.previousTokenCount).toBe(firstSameTokenLink.tokenCount)
  expect(secondSameTokenLink.tokenCount).toBe(firstSameTokenLink.tokenCount)
  expect(secondSameTokenLink.contentHash).not.toBe(firstSameTokenLink.contentHash)
})

test('links refresh marks failed fetches and preserves previous successful metadata', async () => {
  const outputPath = linksTestOutputPath('refresh-failed-preserve')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  let fail = false
  const fetchImpl: FetchFn = async () =>
    fail
      ? new Response('missing', { status: 404, statusText: 'Not Found' })
      : markdownResponse('alpha')

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath, fetchImpl })
  const firstMetadata = await readRefreshMetadata(sidecarPath)
  const firstLink = firstRefreshLink(firstMetadata)

  fail = true
  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    DIRECT_REFRESH_URL
  ], { outputPath, fetchImpl })
  const failedMetadata = await readRefreshMetadata(sidecarPath)
  const failedLink = firstRefreshLink(failedMetadata)

  expect(failedMetadata.totals.failedCount).toBe(1)
  expect(failedMetadata.totals.failedChangeCount).toBe(1)
  expect(failedMetadata.totals.tokenCount).toBe(0)
  expect(failedLink.status).toBe('failed')
  expect(failedLink.changeStatus).toBe('failed')
  expect(failedLink.contentHash).toBeNull()
  expect(failedLink.tokenCount).toBe(0)
  expect(failedLink.previousHash).toBe(successfulContentHash(firstLink))
  expect(failedLink.previousTokenCount).toBe(firstLink.tokenCount)
  expect(failedLink.lastSuccessfulRefreshAt).toBe(firstLink.lastSuccessfulRefreshAt)
  expect(failedLink.failureReason).toContain('HTTP 404 Not Found')
})

test('links refresh records input-file selections and deduped URLs', async () => {
  const outputPath = linksTestOutputPath('refresh-input-file')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const inputPath = `/tmp/autoshow-links-refresh-input-${Date.now()}-${Math.random().toString(16).slice(2)}.md`
  const fetchedUrls: string[] = []

  await Bun.write(inputPath, [
    'https://example.com/a.md',
    '[Page](https://example.com/page)',
    'https://example.com/a.md'
  ].join('\n'))

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    inputPath
  ], {
    outputPath,
    fetchImpl: async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      fetchedUrls.push(url)
      return markdownResponse(`docs for ${url}`)
    }
  })

  const metadata = await readRefreshMetadata(sidecarPath)
  expect(metadata.selectionMode).toBe('input-file')
  expect(metadata.selection.inputFilePath).toBe(inputPath)
  expect(metadata.selection.urls).toEqual([
    'https://example.com/a.md',
    'https://example.com/page'
  ])
  expect(fetchedUrls).toEqual(metadata.selection.urls)
  expect(metadata.totals.linkCount).toBe(2)
  expect(metadata.totals.newCount).toBe(2)
})

test('links refresh fetches with bounded concurrency while preserving output order and failures', async () => {
  const outputPath = linksTestOutputPath('refresh-bounded-concurrency')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const inputPath = linksTestOutputPath('refresh-bounded-concurrency-input')
  const urls = Array.from({ length: DEFAULT_CLI_CONCURRENCY + 3 }, (_, index) =>
    `https://example.com/bounded-${index}.md`
  )
  const failIndex = DEFAULT_CLI_CONCURRENCY + 1
  const failUrl = urls[failIndex]
  if (!failUrl) {
    throw new Error('Expected bounded concurrency fixture to include a failure URL')
  }

  const urlIndexes = new Map(urls.map((url, index) => [url, index]))
  const startedUrls: string[] = []
  let activeFetches = 0
  let maxActiveFetches = 0

  await Bun.write(inputPath, urls.join('\n'))
  try {
    await runLinksWithArgv([
      'bun',
      'src/cli/create-cli.ts',
      'links',
      '--refresh',
      inputPath
    ], {
      outputPath,
      fetchImpl: async (input: string | URL | Request): Promise<Response> => {
        const url = String(input)
        const urlIndex = urlIndexes.get(url) ?? 0
        startedUrls.push(url)
        activeFetches += 1
        maxActiveFetches = Math.max(maxActiveFetches, activeFetches)
        try {
          await Bun.sleep((urls.length - urlIndex) * 2)
          return url === failUrl
            ? new Response('missing', { status: 404, statusText: 'Not Found' })
            : markdownResponse(`docs for ${url}`)
        } finally {
          activeFetches -= 1
        }
      }
    })
  } finally {
    await rm(inputPath, { force: true })
  }

  const output = await Bun.file(outputPath).text()
  const metadata = await readRefreshMetadata(sidecarPath)
  const failedLink = refreshLinkAt(metadata, failIndex)
  const markerPositions = urls.map((url) => {
    const marker = url === failUrl
      ? `<!-- Failed to fetch ${url} -->`
      : `<!-- Source: ${url} -->`
    const markerIndex = output.indexOf(marker)
    expect(markerIndex).toBeGreaterThanOrEqual(0)
    return markerIndex
  })

  for (let index = 1; index < markerPositions.length; index += 1) {
    const previous = markerPositions[index - 1]
    const current = markerPositions[index]
    if (previous === undefined || current === undefined) {
      throw new Error('Expected output marker positions to be populated')
    }
    expect(current).toBeGreaterThan(previous)
  }

  expect(maxActiveFetches).toBe(DEFAULT_CLI_CONCURRENCY)
  expect(startedUrls.slice(0, DEFAULT_CLI_CONCURRENCY)).toEqual(urls.slice(0, DEFAULT_CLI_CONCURRENCY))
  expect(metadata.selection.urls).toEqual(urls)
  expect(metadata.links.map(link => link.sourceUrl)).toEqual(urls)
  expect(metadata.totals.failedCount).toBe(1)
  expect(failedLink.status).toBe('failed')
  expect(failedLink.changeStatus).toBe('failed')
  expect(failedLink.failureReason).toContain('HTTP 404 Not Found')
})

test('links refresh uses deduped curated links for overlapping selections', async () => {
  const outputPath = linksTestOutputPath('refresh-curated-dedupe')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const fetchedUrls: string[] = []

  await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh',
    'models',
    '--elevenlabs',
    'models'
  ], {
    outputPath,
    fetchImpl: async (input: string | URL | Request): Promise<Response> => {
      const url = String(input)
      fetchedUrls.push(url)
      return markdownResponse(`docs for ${url}`)
    }
  })

  const metadata = await readRefreshMetadata(sidecarPath)
  const elevenlabsFetchCount = fetchedUrls.filter(url => url === ELEVENLABS_MODELS_URL).length
  const elevenlabsMetadataCount = metadata.selection.urls.filter(url => url === ELEVENLABS_MODELS_URL).length
  expect(metadata.selectionMode).toBe('curated')
  expect(new Set(fetchedUrls).size).toBe(fetchedUrls.length)
  expect(new Set(metadata.selection.urls).size).toBe(metadata.selection.urls.length)
  expect(elevenlabsFetchCount).toBe(1)
  expect(elevenlabsMetadataCount).toBe(1)
  expect(metadata.totals.linkCount).toBe(fetchedUrls.length)
})
