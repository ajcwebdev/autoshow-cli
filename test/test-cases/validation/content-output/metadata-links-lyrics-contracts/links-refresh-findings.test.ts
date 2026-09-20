import { expect, test } from 'bun:test'
import type { FetchFn, LinksRefreshLinkMetadata, LinksRefreshMetadata, ModelLinksData } from '~/types'
import {
  getLinksRefreshMetadataPath,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import {
  collectLinksRefreshFindings,
  renderLinksRefreshFindings
} from '~/cli/commands/setup-and-utilities/links/links-refresh-findings'
import { linksTestOutputPath } from './shared'

const registry: ModelLinksData = {
  Acme: {
    LLMSTXT: ['https://docs.acme.test/llms.txt'],
    TTS: [
      'https://docs.acme.test/tts/old.md',
      'https://docs.acme.test/tts/new.md',
      'https://docs.acme.test/tts/gated.md',
      'https://docs.acme.test/tts/gone.md',
      'https://docs.acme.test/tts/moved.md',
      'https://docs.acme.test/pricing'
    ]
  },
  Other: { General: ['https://other.test/down.md', 'https://other.test/intro', 'https://other.test/v1/credit-balance'] }
}

const entry = (sourceUrl: string, overrides: Partial<LinksRefreshLinkMetadata> = {}): LinksRefreshLinkMetadata => ({
  sourceUrl,
  fetchUrl: sourceUrl,
  finalUrl: sourceUrl,
  status: 'success',
  changeStatus: 'new',
  tokenCount: 100,
  contentHash: `hash:${sourceUrl}`,
  byteCount: 400,
  characterCount: 400,
  lastRefreshAt: '2026-09-20T00:00:00.000Z',
  ...overrides
})

const failed = (sourceUrl: string, failureReason: string): LinksRefreshLinkMetadata => {
  const { finalUrl: _finalUrl, ...rest } = entry(sourceUrl, { status: 'failed', changeStatus: 'failed', contentHash: null, tokenCount: 0, failureReason })
  return rest
}

test('refresh findings classify redirects, duplicate targets, login walls, HTTP errors, and failed fetches', () => {
  const findings = collectLinksRefreshFindings([
    entry('https://docs.acme.test/llms.txt'),
    entry('https://docs.acme.test/tts/old.md', { finalUrl: 'https://docs.acme.test/tts/new.md' }),
    entry('https://docs.acme.test/tts/new.md'),
    entry('https://docs.acme.test/tts/gated.md', { finalUrl: 'https://platform.acme.test/docs-auth/login-redirect?redirect=x' }),
    failed('https://docs.acme.test/tts/gone.md', 'HTTP 404 Not Found'),
    entry('https://docs.acme.test/tts/moved.md', { finalUrl: 'https://docs.acme.test/tts/elsewhere.md' }),
    entry('https://docs.acme.test/pricing', { finalUrl: 'https://docs.acme.test/pricing/' }),
    entry('https://other.test/intro', { finalUrl: 'https://www.other.test/intro' }),
    failed('https://other.test/down.md', 'The operation timed out.')
  ], registry)

  expect(findings.map(finding => [finding.sourceUrl, finding.status, finding.detail])).toEqual([
    ['https://docs.acme.test/tts/old.md', 'duplicate-target', 'https://docs.acme.test/tts/new.md'],
    ['https://docs.acme.test/tts/gated.md', 'login-redirect', 'https://platform.acme.test/docs-auth/login-redirect?redirect=x'],
    ['https://docs.acme.test/tts/gone.md', 'http-error', 'HTTP 404 Not Found'],
    ['https://docs.acme.test/tts/moved.md', 'redirect', 'https://docs.acme.test/tts/elsewhere.md'],
    ['https://other.test/down.md', 'fetch-failed', 'The operation timed out.']
  ])
  expect(findings[0]).toMatchObject({ provider: 'Acme', section: 'TTS' })
})

test('refresh findings flag a fallback page served for another path, an empty body, and a collapsed page', () => {
  const findings = collectLinksRefreshFindings([
    entry('https://other.test/intro', { contentHash: 'same' }),
    entry('https://other.test/v1/credit-balance', { contentHash: 'same' }),
    entry('https://docs.acme.test/llms.txt', { status: 'empty', tokenCount: 0, contentHash: 'empty' }),
    entry('https://docs.acme.test/tts/new.md', { changeStatus: 'changed', tokenCount: 53, previousTokenCount: 2499 }),
    entry('https://docs.acme.test/pricing', { changeStatus: 'changed', tokenCount: 90, previousTokenCount: 100 })
  ], registry)

  expect(findings.map(finding => [finding.sourceUrl, finding.status, finding.detail])).toEqual([
    ['https://other.test/v1/credit-balance', 'duplicate-content', 'https://other.test/intro'],
    ['https://docs.acme.test/llms.txt', 'empty', 'The response body was empty.'],
    ['https://docs.acme.test/tts/new.md', 'shrunk', '2499 -> 53 tokens']
  ])
})

test('refresh findings report a page that keeps 60% of its tokens or fewer, and nothing above that', () => {
  const findings = collectLinksRefreshFindings([
    entry('https://docs.acme.test/halved', { changeStatus: 'changed', tokenCount: 2690, previousTokenCount: 5370 }),
    entry('https://docs.acme.test/at-threshold', { changeStatus: 'changed', tokenCount: 600, previousTokenCount: 1000 }),
    entry('https://docs.acme.test/above-threshold', { changeStatus: 'changed', tokenCount: 601, previousTokenCount: 1000 }),
    entry('https://docs.acme.test/first-seen', { changeStatus: 'new', tokenCount: 1 })
  ], registry)

  expect(findings.map(finding => [finding.sourceUrl, finding.detail])).toEqual([
    ['https://docs.acme.test/halved', '5370 -> 2690 tokens'],
    ['https://docs.acme.test/at-threshold', '1000 -> 600 tokens']
  ])
})

test('refresh findings leave an unconfigured direct URL without a provider and treat a sign-in path on the same page as ok', () => {
  const findings = collectLinksRefreshFindings([
    entry('https://docs.acme.test/authentication.md'),
    entry('blob:https://elsewhere.test/docs', { fetchUrl: 'https://elsewhere.test/docs', finalUrl: 'https://elsewhere.test/docs' }),
    failed('https://elsewhere.test/gone', 'HTTP 410 Gone')
  ], registry)

  expect(findings).toEqual([{ sourceUrl: 'https://elsewhere.test/gone', status: 'http-error', detail: 'HTTP 410 Gone' }])
})

test('refresh findings render a count by status and one line per link', () => {
  const rendered = renderLinksRefreshFindings([
    { sourceUrl: 'https://docs.acme.test/tts/old.md', provider: 'Acme', section: 'TTS', status: 'duplicate-target', detail: 'https://docs.acme.test/tts/new.md' },
    { sourceUrl: 'https://elsewhere.test/gone', status: 'http-error', detail: 'HTTP 410 Gone' }
  ])

  expect(rendered.split('\n')).toEqual([
    '2 link(s) need attention (1 duplicate-target, 1 http-error)',
    '  duplicate-target  Acme/TTS  https://docs.acme.test/tts/old.md -> https://docs.acme.test/tts/new.md',
    '  http-error        https://elsewhere.test/gone -> HTTP 410 Gone'
  ])
})

test('links --refresh records findings in the sidecar from a single run', async () => {
  const outputPath = linksTestOutputPath('refresh-findings')
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  const inputPath = linksTestOutputPath('refresh-findings-input')
  await Bun.write(inputPath, [
    'https://docs.acme.test/intro.md',
    'https://docs.acme.test/v1/credit-balance.md',
    'https://docs.acme.test/old.md',
    'https://docs.acme.test/gone.md'
  ].join('\n'))

  const respond = (body: string, url: string): Response => {
    const response = new Response(body, { headers: { 'content-type': 'text/markdown' } })
    Object.defineProperty(response, 'url', { value: url })
    return response
  }
  const fetchImpl: FetchFn = async (input) => {
    const url = String(input)
    if (url.endsWith('/gone.md')) return new Response('missing', { status: 404, statusText: 'Not Found' })
    if (url.endsWith('/old.md')) return respond('# Moved page', 'https://docs.acme.test/new.md')
    return respond('# Fallback introduction', url)
  }

  await runLinksWithArgv(['bun', 'src/cli/create-cli.ts', 'links', '--refresh', inputPath], { outputPath, fetchImpl })

  const metadata = JSON.parse(await Bun.file(sidecarPath).text()) as LinksRefreshMetadata
  expect(metadata.totals.attentionCount).toBe(3)
  expect(metadata.findings.map(finding => [finding.sourceUrl, finding.status])).toEqual([
    ['https://docs.acme.test/v1/credit-balance.md', 'duplicate-content'],
    ['https://docs.acme.test/old.md', 'redirect'],
    ['https://docs.acme.test/gone.md', 'http-error']
  ])
})
