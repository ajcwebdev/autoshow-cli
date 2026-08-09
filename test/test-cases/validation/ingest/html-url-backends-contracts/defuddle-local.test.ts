import { expect, test } from 'bun:test'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import {
  defuddleRuntimeDir,
  ensureDefuddleCliSetup
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-local/defuddle/defuddle-cli'
import { configureBinDir } from '~/utils/runtime-paths'
import {
  chmod,
  extractHtmlToMarkdown,
  htmlDocument,
  join,
  longMarkdown,
  makeTempDir,
  runOcr,
  writeFile,
  writeFakeDefuddleBin
} from './shared'
import type { DocumentMetadata, ExtractionOptions } from './shared'

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const streamFromText = (value: string): ReadableStream<Uint8Array> => {
  const stream = new Response(value).body
  if (!stream) {
    throw new Error('Expected Response body stream')
  }
  return stream
}

const spawnResult = (
  stdout: string,
  stderr: string,
  exited: number | Promise<number>
): ReturnType<typeof Bun.spawn> => ({
  stdout: streamFromText(stdout),
  stderr: streamFromText(stderr),
  exited: Promise.resolve(exited)
}) as ReturnType<typeof Bun.spawn>

test('defuddle URL backend extracts markdown from supplied HTML', async () => {
  const { argsLog } = await writeFakeDefuddleBin()

  const result = await extractHtmlToMarkdown({
    html: htmlDocument,
    documentUrl: 'https://example.test/final',
    sourceUrl: 'https://example.test/source',
    finalUrl: 'https://example.test/final'
  })

  expect(result.markdown).toContain('meaningful markdown content')
  expect(result.markdown).toContain('Moved Backend Article')
  expect(result.markdown).not.toContain('SHOULD_NOT_USE_CONTENT')
  expect(result.title).toBe('CLI Title')
  expect(result.author).toBe('CLI Author')
  expect(result.web).toMatchObject({
    sourceUrl: 'https://example.test/source',
    finalUrl: 'https://example.test/final',
    title: 'CLI Title',
    author: 'CLI Author',
    site: 'CLI Site',
    published: '2026-05-01T00:00:00Z',
    language: 'en',
    description: 'CLI description',
    wordCount: 88
  })

  const [parseArgs] = (await Bun.file(argsLog).text()).trim().split('\n').map((line) => JSON.parse(line) as string[])
  expect(parseArgs?.[0]).toBe('parse')
  expect(parseArgs?.[1]?.endsWith('article.html')).toBe(true)
  expect(parseArgs?.slice(2)).toEqual(['--markdown', '--json'])
  expect(await Bun.file(parseArgs![1]!).exists()).toBe(false)
})

test('concurrent Defuddle setup callers share a single managed install', async () => {
  const managedDefuddleBin = join(
    defuddleRuntimeDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'defuddle.cmd' : 'defuddle'
  )
  const backupDir = `${defuddleRuntimeDir}.autoshow-test-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const hadRuntimeDir = await pathExists(defuddleRuntimeDir)
  const originalSpawn = Bun.spawn
  const fakeOverrideDir = await makeTempDir('autoshow-invalid-defuddle-')
  const fakeOverrideBin = join(fakeOverrideDir, 'defuddle')
  let installCalls = 0
  let activeInstalls = 0
  let maxActiveInstalls = 0

  await writeFile(fakeOverrideBin, '#!/usr/bin/env bun\nprocess.exit(1)\n')
  await chmod(fakeOverrideBin, 0o755)
  if (hadRuntimeDir) {
    await rename(defuddleRuntimeDir, backupDir)
  }
  await rm(defuddleRuntimeDir, { recursive: true, force: true })
  configureBinDir(fakeOverrideDir)

  ;(Bun as typeof Bun & { spawn: typeof Bun.spawn }).spawn = ((
    command: Parameters<typeof Bun.spawn>[0],
    options?: Parameters<typeof Bun.spawn>[1]
  ) => {
    const commandArgs = [...command]
    const executable = commandArgs[0] ?? ''
    const args = commandArgs.slice(1)
    if (executable === fakeOverrideBin && args[0] === '--version') {
      return spawnResult('', 'invalid override defuddle', 1)
    }
    if (executable === 'bun' && args[0] === 'install') {
      installCalls += 1
      activeInstalls += 1
      maxActiveInstalls = Math.max(maxActiveInstalls, activeInstalls)
      const cwd = typeof options === 'object' && options !== null && 'cwd' in options
        ? String(options.cwd)
        : defuddleRuntimeDir
      const exited = (async (): Promise<number> => {
        try {
          await Bun.sleep(25)
          await mkdir(join(cwd, 'node_modules', '.bin'), { recursive: true })
          await writeFile(managedDefuddleBin, '#!/usr/bin/env bun\n')
          await chmod(managedDefuddleBin, 0o755)
          return 0
        } finally {
          activeInstalls -= 1
        }
      })()
      return spawnResult('', '', exited)
    }
    if (executable === managedDefuddleBin && args[0] === '--version') {
      return spawnResult('0.17.0\n', '', 0)
    }
    throw new Error(`Unexpected spawn: ${commandArgs.join(' ')}`)
  }) as typeof Bun.spawn

  try {
    const results = await Promise.all(
      Array.from({ length: 8 }, async () => await ensureDefuddleCliSetup())
    )

    expect(new Set(results)).toEqual(new Set([managedDefuddleBin]))
    expect(installCalls).toBe(1)
    expect(maxActiveInstalls).toBe(1)
  } finally {
    ;(Bun as typeof Bun & { spawn: typeof Bun.spawn }).spawn = originalSpawn
    configureBinDir('')
    await rm(defuddleRuntimeDir, { recursive: true, force: true })
    if (hadRuntimeDir) {
      await rename(backupDir, defuddleRuntimeDir)
    }
  }
})

test('defuddle URL backend includes captured output for nonzero CLI failures', async () => {
  await writeFakeDefuddleBin()
  process.env['AUTOSHOW_FAKE_DEFUDDLE_MODE'] = 'nonzero'

  let error: unknown
  try {
    await extractHtmlToMarkdown({
      html: htmlDocument,
      documentUrl: 'https://example.test/final'
    })
  } catch (caught) {
    error = caught
  }

  expect(error).toBeInstanceOf(Error)
  const message = (error as Error).message
  expect(message).toContain('Defuddle CLI failed')
  expect(message).toContain('exit code 7')
  expect(message).toContain('partial stdout before failure')
  expect(message).toContain('fake defuddle failed')
})

test('defuddle URL backend includes captured output for invalid JSON', async () => {
  await writeFakeDefuddleBin()
  process.env['AUTOSHOW_FAKE_DEFUDDLE_MODE'] = 'invalid-json'
  process.env['AUTOSHOW_FAKE_DEFUDDLE_STDERR'] = 'fake diagnostic stderr'

  let error: unknown
  try {
    await extractHtmlToMarkdown({
      html: htmlDocument,
      documentUrl: 'https://example.test/final'
    })
  } catch (caught) {
    error = caught
  }

  expect(error).toBeInstanceOf(Error)
  const message = (error as Error).message
  expect(message).toContain('Defuddle CLI returned invalid JSON')
  expect(message).toContain('{not valid json')
  expect(message).toContain('fake diagnostic stderr')
})

test('prepared article markdown carries backend duration into extraction metadata', async () => {
  const step1Metadata: DocumentMetadata = {
    title: 'Zyte Article',
    slug: 'zyte-article',
    pageCount: 1,
    format: 'html',
    fileSize: longMarkdown.length
  }
  const opts: ExtractionOptions = {
    filePath: 'unused.html',
    outputDir: '/tmp/autoshow-html-duration-test',
    dpi: 300,
    languages: 'eng',
    outputFormat: 'text',
    ocrProviderConcurrency: 2,
    ocrLocalConcurrency: 1,
    pdfChapterMode: 'local',
    preparedMarkdown: longMarkdown,
    htmlArticleProcessingTimeMs: 4321,
    htmlArticleBackend: 'zyte'
  }

  const result = await runOcr('unused.html', step1Metadata, opts)

  expect(result.step2Metadata.extractionMethod).toBe('html+zyte')
  expect(result.step2Metadata.processingTime).toBeGreaterThanOrEqual(4321)
})
