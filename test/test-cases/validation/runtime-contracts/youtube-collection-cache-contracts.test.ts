import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'

const CACHE_NAME = 'autoshow-yt-collection-cache.json'
const COLLECTION_URL = 'https://www.youtube.com/playlist?list=collection-cache-contract'
const VIDEO_URLS = ['https://www.youtube.com/watch?v=first', 'https://youtu.be/second']

// Keep module mocks and the fixed runtime-cache filename inside a separate process.
// The only subprocess dispatch performed by the source module is replaced locally.
const runCollectionProbe = async (
  root: string,
  url = COLLECTION_URL,
  options: { rows?: unknown[], failWrite?: boolean } = {}
): Promise<{ items?: string[] | null, calls: number, error?: string }> => {
  const cliUtilsPath = resolve('src/utils/cli-utils.ts')
  const collectionPath = resolve('src/cli/commands/sources/metadata/metadata-sources/metadata-youtube-collection-target.ts')
  const rows = options.rows ?? VIDEO_URLS.map(webpage_url => ({ webpage_url }))
  const source = [
    "import { mock } from 'bun:test';",
    "import { mkdir } from 'node:fs/promises';",
    'const cliUtils = await import(' + JSON.stringify(cliUtilsPath) + ');',
    'let calls = 0;',
    'mock.module(' + JSON.stringify(cliUtilsPath) + ', () => ({ ...cliUtils, exec: async () => {',
    'calls++;',
    options.failWrite ? 'await mkdir(' + JSON.stringify(join(root, 'cache', CACHE_NAME)) + ');' : '',
    'return { exitCode: 0, stdout: ' + JSON.stringify(rows.map(row => JSON.stringify(row)).join('\n')) + ", stderr: '' };",
    '} }));',
    'const { resolveYoutubeCollectionItems } = await import(' + JSON.stringify(collectionPath) + ');',
    'try {',
    'const items = await resolveYoutubeCollectionItems(' + JSON.stringify(url) + ');',
    'process.stdout.write(JSON.stringify({ items, calls }));',
    '} catch (error) {',
    'process.stdout.write(JSON.stringify({ error: error.code ?? error.message, calls }));',
    '}'
  ].join('\n')
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', source], {
    env: { PATH: process.env['PATH'], TMPDIR: root, AUTOSHOW_TEST_STATE_ROOT: root },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ])
  if (exitCode !== 0) throw new Error(stderr || 'Collection cache probe failed')
  return JSON.parse(stdout) as { items?: string[] | null, calls: number, error?: string }
}

describe('YouTube collection discovery cache', () => {
  test('reuses a valid cached collection without dispatching yt-dlp', async () => {
    await withTempDir('autoshow-collection-cache-valid-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      await writeFile(join(root, 'cache', CACHE_NAME), JSON.stringify({ [COLLECTION_URL]: VIDEO_URLS }))
      expect(await runCollectionProbe(root)).toEqual({ items: VIDEO_URLS, calls: 0 })
    })
  })

  for (const [label, contents] of [
    ['malformed JSON', '{'],
    ['invalid map', '[]'],
    ['invalid entry', JSON.stringify({ [COLLECTION_URL]: 'not-an-array' })],
    ['non-string item', JSON.stringify({ [COLLECTION_URL]: [1, VIDEO_URLS[1]] })],
    ['unrelated host', JSON.stringify({ [COLLECTION_URL]: ['https://youtube.com.evil.test/video', VIDEO_URLS[1]] })],
    ['unsupported protocol', JSON.stringify({ [COLLECTION_URL]: ['ftp://youtube.com/video', VIDEO_URLS[1]] })]
  ] as const) {
    test('treats ' + label + ' as a miss and replaces it with validated discovery', async () => {
      await withTempDir('autoshow-collection-cache-invalid-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
        await writeFile(join(root, 'cache', CACHE_NAME), contents)
        expect(await runCollectionProbe(root)).toEqual({ items: VIDEO_URLS, calls: 1 })
        expect(JSON.parse(await readFile(join(root, 'cache', CACHE_NAME), 'utf8'))).toEqual({ [COLLECTION_URL]: VIDEO_URLS })
      })
    })
  }

  test('creates a missing cache with distinct valid collection URLs', async () => {
    await withTempDir('autoshow-collection-cache-create-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      expect(await runCollectionProbe(root, COLLECTION_URL, {
        rows: [
          { webpage_url: VIDEO_URLS[0] },
          { webpage_url: VIDEO_URLS[0] },
          { webpage_url: VIDEO_URLS[1] },
          { webpage_url: 'https://youtube.com.evil.test/video' },
          { webpage_url: 42 },
          null
        ]
      })).toEqual({ items: VIDEO_URLS, calls: 1 })
      expect(JSON.parse(await readFile(join(root, 'cache', CACHE_NAME), 'utf8'))).toEqual({ [COLLECTION_URL]: VIDEO_URLS })
    })
  })

  test('preserves the URL-to-items relationship across concurrent process updates', async () => {
    await withTempDir('autoshow-collection-cache-concurrent-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      const entries = Array.from({ length: 8 }, (_, index) => ({
        url: COLLECTION_URL + '-' + index,
        items: ['https://youtu.be/first-' + index, 'https://youtu.be/second-' + index]
      }))
      const results = await Promise.all(entries.map(({ url, items }) => runCollectionProbe(root, url, {
        rows: items.map(webpage_url => ({ webpage_url }))
      })))
      expect(results).toEqual(entries.map(({ items }) => ({ items, calls: 1 })))
      expect(JSON.parse(await readFile(join(root, 'cache', CACHE_NAME), 'utf8')))
        .toEqual(Object.fromEntries(entries.map(({ url, items }) => [url, items])))
    })
  })

  test('propagates cache read I/O failures before dispatch', async () => {
    await withTempDir('autoshow-collection-cache-read-error-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      await mkdir(join(root, 'cache', CACHE_NAME))
      expect(await runCollectionProbe(root)).toEqual({ error: 'EISDIR', calls: 0 })
    })
  })

  test('propagates cache write I/O failures after discovery', async () => {
    await withTempDir('autoshow-collection-cache-write-error-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      expect(await runCollectionProbe(root, COLLECTION_URL, { failWrite: true }))
        .toEqual({ error: 'EISDIR', calls: 1 })
    })
  })

  test('rejects host lookalikes before reading the cache or dispatching', async () => {
    await withTempDir('autoshow-collection-cache-host-', async root => {
      await mkdir(join(root, 'cache'), { recursive: true })
      await mkdir(join(root, 'cache', CACHE_NAME))
      expect(await runCollectionProbe(root, 'https://youtube.com.evil.test/playlist?list=test'))
        .toEqual({ items: null, calls: 0 })
    })
  })
})
