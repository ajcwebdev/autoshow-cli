import { expect, test } from 'bun:test'
import {
  mkdtemp,
  rm
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import { writeFakeDefuddleBinIn } from '../../../../test-utils/fixtures/fake-defuddle-bin'
import type { ConsoleCapture } from '../../../../test-utils/console-capture'
import { captureConsole } from '../../../../test-utils/console-capture'
import { BLOB_PREFIXED_DOC_FETCH_LINK, BLOB_PREFIXED_DOC_LINK, linksTestOutputPath } from './shared'
import { withEnv } from '../../../../test-utils/rest-contract-helpers'

const LINKS_RETRY_TEST_URL = 'https://elevenlabs.io/docs/overview/models.md'

const withZeroRetryBackoff = async <T>(fn: () => Promise<T>): Promise<T> => {
  const previousSleep = Bun.sleep
  ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  try {
    return await fn()
  } finally {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
  }
}

const expectLinksRetryScenario = async (options: {
  outputSlug: string
  failure: Error | { body: string, status: number, statusText: string }
  alwaysFail?: boolean | undefined
  expectedAttempts: number
  expectSuccess: boolean
}): Promise<void> => {
  const outputPath = linksTestOutputPath(options.outputSlug)
  const attempts = new Map<string, number>()
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    const attempt = (attempts.get(url) ?? 0) + 1
    attempts.set(url, attempt)
    if (url === LINKS_RETRY_TEST_URL && (options.alwaysFail || attempt === 1)) {
      if (options.failure instanceof Error) throw options.failure
      return new Response(options.failure.body, options.failure)
    }
    return new Response(`# docs for ${url}\n`, { headers: { 'content-type': 'text/markdown' } })
  }
  await withZeroRetryBackoff(async () => {
    await runLinksWithArgv([
      'bun', 'src/cli/create-cli.ts', 'links', '--elevenlabs', 'models'
    ], { outputPath, fetchImpl })
  })
  const output = await Bun.file(outputPath).text()
  expect(attempts.get(LINKS_RETRY_TEST_URL)).toBe(options.expectedAttempts)
  const successMarker = `<!-- Source: ${LINKS_RETRY_TEST_URL} -->`
  const failureMarker = `<!-- Failed to fetch ${LINKS_RETRY_TEST_URL} -->`
  expect(output).toContain(options.expectSuccess ? successMarker : failureMarker)
  expect(output).not.toContain(options.expectSuccess ? failureMarker : successMarker)
}

const writeLinksFakeDefuddleBin = async (): Promise<{ dir: string, bin: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-links-fake-defuddle-'))
  const bin = await writeFakeDefuddleBinIn(dir, [
    "const html = readFileSync(args[1], 'utf8')",
    "const text = html.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim()",
    "console.log(JSON.stringify({ contentMarkdown: text, title: 'Links Defuddle Fixture', wordCount: text.split(/\\s+/).filter(Boolean).length }))"
  ], ["import { readFileSync } from 'node:fs'"])
  return { dir, bin }
}

test('links retries transient network failures before writing output', async () => {
  await expectLinksRetryScenario({
    outputSlug: 'socket-retry',
    failure: new Error('The socket connection was closed unexpectedly'),
    expectedAttempts: 2,
    expectSuccess: true
  })
})

test('links retries retryable HTTP status failures before writing output', async () => {
  await expectLinksRetryScenario({
    outputSlug: 'status-retry',
    failure: { body: 'temporary outage', status: 503, statusText: 'Service Unavailable' },
    expectedAttempts: 2,
    expectSuccess: true
  })
})

test('links does not retry non-retryable HTTP status failures', async () => {
  await expectLinksRetryScenario({
    outputSlug: 'non-retryable-status',
    failure: { body: 'missing', status: 404, statusText: 'Not Found' },
    alwaysFail: true,
    expectedAttempts: 1,
    expectSuccess: false
  })
})

test('links strips the blob prefix when fetching but cites the original URL', async () => {
  const outputPath = linksTestOutputPath('blob-prefix')
  const fetchedUrls: string[] = []

  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    fetchedUrls.push(url)

    return new Response(`# docs for ${url}\n`, {
      headers: { 'content-type': 'text/markdown' }
    })
  }

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    BLOB_PREFIXED_DOC_LINK
  ], { outputPath, fetchImpl })

  const output = await Bun.file(outputPath).text()
  expect(result.urlCount).toBe(1)
  expect(fetchedUrls).toEqual([BLOB_PREFIXED_DOC_FETCH_LINK])
  expect(output).toContain(`<!-- Source: ${BLOB_PREFIXED_DOC_LINK} -->`)
  expect(output).toContain(`# docs for ${BLOB_PREFIXED_DOC_FETCH_LINK}`)
  expect(output).not.toContain(`<!-- Source: ${BLOB_PREFIXED_DOC_FETCH_LINK} -->`)
})

test('links captures defuddle CLI diagnostics for fetched html', async () => {
  const outputPath = linksTestOutputPath('defuddle-diagnostic')
  const words = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')
  const html = `<!doctype html><html><body><div class="hidden bad[">${words}</div></body></html>`
  const previousBinDir = getConfiguredBinDir()
  const fakeDefuddle = await writeLinksFakeDefuddleBin()
  configureBinDir(fakeDefuddle.dir)
  let captured: ConsoleCapture = { stdout: [], stderr: [] }

  try {
    captured = await withEnv(
      { AUTOSHOW_FAKE_DEFUDDLE_STDERR: 'Defuddle Error processing document: captured by wrapper' },
      async () => await captureConsole(async () => {
        await runLinksWithArgv([
          'bun',
          'src/cli/create-cli.ts',
          'links',
          BLOB_PREFIXED_DOC_LINK
        ], {
          outputPath,
          fetchImpl: async (): Promise<Response> => new Response(html, {
            headers: { 'content-type': 'text/html' }
          })
        })
      })
    )
  } finally {
    configureBinDir(previousBinDir ?? '')
    await rm(fakeDefuddle.dir, { recursive: true, force: true })
  }

  const output = await Bun.file(outputPath).text()
  expect(output).toContain(`<!-- Source: ${BLOB_PREFIXED_DOC_LINK} -->`)
  expect(output).toContain('word0 word1 word2')
  expect(captured.stderr.join('\n')).not.toContain('Defuddle Error processing document')
})
