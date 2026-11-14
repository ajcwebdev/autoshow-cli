import { expect, spyOn, test } from 'bun:test'
import { mkdir, symlink } from 'node:fs/promises'
import { hostname } from 'node:os'
import { relative } from 'node:path'
import {
  ensureDefuddleCliSetup,
  runDefuddleCliCapture,
  setupDefuddleCli
} from '~/cli/commands/text/url/url-local/defuddle/defuddle-cli'
import { configureBinDir, getBunBinary, IMMUTABLE_ASSET_ROOT, RUNTIME_DIR } from '~/utils/runtime-paths'
import * as managedJsRuntime from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-js-runtime'
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
import type { DocumentMetadata, ExtractionOptions } from '~/types'
import { requireDefined } from '../../../../../test-utils/value-assertions'
import { pathExists } from '~/utils/filesystem'

const streamFromText = (value: string): ReadableStream<Uint8Array> => {
  const stream = requireDefined(new Response(value).body, 'Response body stream')
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

test('Defuddle rejects escaping executable links before dispatch', async () => {
  const directory = await makeTempDir('autoshow-defuddle-escape-')
  await symlink('/bin/sh', join(directory, 'defuddle'))
  configureBinDir(directory)
  const spawn = spyOn(Bun, 'spawn').mockImplementation(() => { throw new Error('Escaping executable was dispatched') })
  try {
    await expect(ensureDefuddleCliSetup()).rejects.toThrow('inside the project runtime')
    expect(spawn).not.toHaveBeenCalled()
  } finally { spawn.mockRestore() }
})

test('Defuddle checks managed package provenance before probing its executable', async () => {
  const directory = await makeTempDir('autoshow-defuddle-unverified-')
  const binary = join(directory, 'node_modules/defuddle/dist/cli.js')
  await mkdir(join(directory, 'node_modules/defuddle/dist'), { recursive: true })
  await Bun.write(binary, 'throw new Error("unverified package executed")\n')
  const spawn = spyOn(Bun, 'spawn').mockImplementation(() => { throw new Error('Unverified package was dispatched') })
  try {
    await expect(runDefuddleCliCapture(binary, ['--version'])).rejects.toThrow()
    expect(spawn).not.toHaveBeenCalled()
  } finally { spawn.mockRestore() }
})

test('concurrent Defuddle setup callers share a single managed install', async () => {
  const directory = join(await makeTempDir('autoshow-defuddle-concurrent-'), 'defuddle')
  const managedDefuddleBin = join(
    directory,
    'node_modules',
    'defuddle',
    'dist',
    'cli.js'
  )
  const originalSpawn = Bun.spawn
  const ensureBun = spyOn(managedJsRuntime, 'ensureManagedBunRuntime').mockResolvedValue(undefined)
  const validateBun = spyOn(managedJsRuntime, 'validateManagedJsRuntime').mockResolvedValue({ ok: true, detail: 'isolated runtime fixture' })
  let installCalls = 0
  let activeInstalls = 0
  let maxActiveInstalls = 0

  ;(Bun as typeof Bun & { spawn: typeof Bun.spawn }).spawn = ((
    command: Parameters<typeof Bun.spawn>[0],
    options?: Parameters<typeof Bun.spawn>[1]
  ) => {
    const commandArgs = [...command]
    const executable = commandArgs[0] ?? ''
    const args = commandArgs.slice(1)
    if (executable === getBunBinary() && args.includes('install')) {
      expect(args).toEqual(['--no-env-file', 'install', '--frozen-lockfile', '--ignore-scripts'])
      installCalls += 1
      activeInstalls += 1
      maxActiveInstalls = Math.max(maxActiveInstalls, activeInstalls)
      const cwd = typeof options === 'object' && options !== null && 'cwd' in options
        ? String(options.cwd)
        : directory
      const exited = (async (): Promise<number> => {
        try {
          await Bun.sleep(25)
          await mkdir(join(cwd, 'node_modules', 'defuddle', 'dist'), { recursive: true })
          const stagedBinary = join(cwd, 'node_modules', 'defuddle', 'dist', 'cli.js')
          await writeFile(stagedBinary, '#!/usr/bin/env bun\n')
          await chmod(stagedBinary, 0o755)
          return 0
        } finally {
          activeInstalls -= 1
        }
      })()
      return spawnResult('', '', exited)
    }
    if (executable === getBunBinary() && args.some(arg => arg.endsWith('/node_modules/defuddle/dist/cli.js')) && args.includes('--version')) {
      return spawnResult('0.19.3\n', '', 0)
    }
    throw new Error(`Unexpected spawn: ${commandArgs.join(' ')}`)
  }) as typeof Bun.spawn

  try {
    await Promise.all(
      Array.from({ length: 8 }, async () => await setupDefuddleCli({ directory }))
    )
    expect(await pathExists(managedDefuddleBin)).toBe(true)
    expect(installCalls).toBe(1)
    expect(maxActiveInstalls).toBe(1)
  } finally {
    ;(Bun as typeof Bun & { spawn: typeof Bun.spawn }).spawn = originalSpawn
    ensureBun.mockRestore()
    validateBun.mockRestore()
  }
})

test('Defuddle setup recovers an interrupted activation before reusing the previous verified graph', async () => {
  const parent = await makeTempDir('autoshow-defuddle-recovery-')
  const destination = join(parent, 'defuddle'), id = crypto.randomUUID()
  const backup = `${destination}.backup-${id}`, staging = join(parent, '.defuddle.staging-candidate')
  const evidence = join(parent, `.defuddle.interrupted-${id}`), journal = join(parent, '.defuddle.transaction.json')
  const previousBinary = join(backup, 'node_modules/defuddle/dist/cli.js')
  await mkdir(join(backup, 'node_modules/defuddle/dist'), { recursive: true })
  await Bun.write(previousBinary, 'console.log("previous verified graph")\n')
  for (const name of ['package.json', 'bun.lock', 'bunfig.toml']) await Bun.write(join(backup, name), await Bun.file(join(IMMUTABLE_ASSET_ROOT, 'config/defuddle', name)).text())
  await Bun.write(join(backup, '.frozen-install'), '0.19.3\n')
  await managedJsRuntime.writeManagedPackageManifest(backup, 'defuddle@0.19.3')
  await mkdir(destination)
  await Bun.write(join(destination, 'candidate.txt'), 'preserve interrupted candidate\n')
  await mkdir(staging)
  await Bun.write(join(staging, 'stage.txt'), 'preserve staged evidence\n')
  await Bun.write(journal, JSON.stringify({ schemaVersion: 1, id, phase: 'candidate-promoted', ownerPid: 2147483647, ownerHost: hostname(), hadPreviousInstall: true,
    destination: relative(RUNTIME_DIR, destination), staging: relative(RUNTIME_DIR, staging), backup: relative(RUNTIME_DIR, backup), evidence: relative(RUNTIME_DIR, evidence) }))
  const ensureBun = spyOn(managedJsRuntime, 'ensureManagedBunRuntime').mockRejectedValue(new Error('Warm recovery attempted provisioning'))
  const validateBun = spyOn(managedJsRuntime, 'validateManagedJsRuntime').mockResolvedValue({ ok: true, detail: 'isolated runtime fixture' })
  const spawn = spyOn(Bun, 'spawn').mockImplementation((command) => {
    const args = Array.isArray(command) ? command : command.cmd
    expect(args).toEqual([getBunBinary(), '--no-env-file', join(destination, 'node_modules/defuddle/dist/cli.js'), '--version'])
    return spawnResult('0.19.3\n', '', 0)
  })
  try {
    await setupDefuddleCli({ directory: destination })
    expect(await Bun.file(join(destination, 'node_modules/defuddle/dist/cli.js')).text()).toBe('console.log("previous verified graph")\n')
    expect(await managedJsRuntime.validateManagedPackageManifest(destination, 'defuddle@0.19.3')).toBe(true)
    expect(await Bun.file(join(evidence, 'candidate.txt')).text()).toBe('preserve interrupted candidate\n')
    expect(await Bun.file(join(staging, 'stage.txt')).text()).toBe('preserve staged evidence\n')
    expect(await Bun.file(journal).exists()).toBe(false)
    expect(ensureBun).not.toHaveBeenCalled()
    expect(spawn).toHaveBeenCalledTimes(1)
  } finally { spawn.mockRestore(); validateBun.mockRestore(); ensureBun.mockRestore() }
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
