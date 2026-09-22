import { afterEach, expect, test } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FetchFn, LinksRefreshMetadata } from '~/types'
import {
  configureLinksRefreshRoot,
  getDefaultLinksDirectUrlOutputFileName,
  getLinksRefreshMetadataPath,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { commandAcceptsGlobalFlag } from '~/cli/native/global-flag-support'
import { commandCreatesRunDirectory } from '~/cli/native/run-directory-support'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const DIRECT_URL = 'blob:https://example.com/docs'
const DIRECT_FILE_NAME = getDefaultLinksDirectUrlOutputFileName(DIRECT_URL)

const markdownResponse = (content: string): Response =>
  new Response(content, {
    headers: { 'content-type': 'text/markdown' }
  })

const fetchImpl: FetchFn = async () => markdownResponse('# docs')

const tempDirs: string[] = []

afterEach(async () => {
  resetPinnedRunDir()
  configureOutputRoot('./output')
  configureLinksRefreshRoot('')
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const makeTempRoot = async (): Promise<string> => {
  const root = await makeTempDir('autoshow-links-output-')
  tempDirs.push(root)
  return root
}

test('links creates a run directory and accepts --output-dir', () => {
  expect(commandCreatesRunDirectory('links')).toBe(true)
  expect(commandAcceptsGlobalFlag('links', 'output-dir')).toBe(true)
})

test('links writes a timestamped run directory under the output root', async () => {
  const root = await makeTempRoot()
  configureOutputRoot(root)

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    DIRECT_URL
  ], { fetchImpl })

  const entries = await readdir(root)
  expect(entries).toHaveLength(1)
  const runDirName = entries[0]!
  expect(runDirName).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}_example-com-docs-links$/)
  expect(result.outputPath).toBe(join(root, runDirName, DIRECT_FILE_NAME))
  expect(await Bun.file(result.outputPath).exists()).toBe(true)
})

test('links writes into a pinned output directory', async () => {
  const root = await makeTempRoot()
  const pinnedDir = join(root, 'pinned-links')
  configurePinnedRunDir(pinnedDir)

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    DIRECT_URL
  ], { fetchImpl })

  expect(result.outputPath).toBe(join(pinnedDir, DIRECT_FILE_NAME))
  expect(await Bun.file(result.outputPath).text()).toContain('<!-- Source: blob:https://example.com/docs -->')
})

test('links --refresh against a pinned directory rewrites the bundle and compares with the earlier sidecar', async () => {
  const root = await makeTempRoot()
  const pinnedDir = join(root, 'refresh-links')
  const outputPath = join(pinnedDir, DIRECT_FILE_NAME)
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  await Bun.write(outputPath, 'stale bundle content\n')
  configurePinnedRunDir(pinnedDir)
  const argv = ['bun', 'src/cli/create-cli.ts', 'links', '--refresh', DIRECT_URL]

  const first = await runLinksWithArgv(argv, { fetchImpl })
  const firstMetadata = JSON.parse(await Bun.file(sidecarPath).text()) as LinksRefreshMetadata
  await runLinksWithArgv(argv, { fetchImpl })
  const secondMetadata = JSON.parse(await Bun.file(sidecarPath).text()) as LinksRefreshMetadata

  expect(first.outputPath).toBe(outputPath)
  expect(first.refreshMetadataPath).toBe(sidecarPath)
  expect(await Bun.file(outputPath).text()).toContain('<!-- Source: blob:https://example.com/docs -->')
  expect(firstMetadata.links[0]?.changeStatus).toBe('new')
  expect(secondMetadata.links[0]?.changeStatus).toBe('unchanged')
})

test('links --refresh without --output-dir reuses one directory per selection, so the second run compares with the first', async () => {
  const outputRoot = await makeTempRoot()
  const refreshRoot = await makeTempRoot()
  configureOutputRoot(outputRoot)
  configureLinksRefreshRoot(refreshRoot)
  const argv = ['bun', 'src/cli/create-cli.ts', 'links', '--refresh', DIRECT_URL]
  const stem = DIRECT_FILE_NAME.replace(/\.md$/, '')

  const first = await runLinksWithArgv(argv, { fetchImpl })
  const second = await runLinksWithArgv(argv, { fetchImpl })
  const metadata = JSON.parse(await Bun.file(getLinksRefreshMetadataPath(second.outputPath)).text()) as LinksRefreshMetadata

  expect(first.outputPath).toBe(join(refreshRoot, stem, DIRECT_FILE_NAME))
  expect(second.outputPath).toBe(first.outputPath)
  expect(await readdir(refreshRoot)).toEqual([stem])
  expect(await readdir(outputRoot)).toEqual([])
  expect(metadata.links[0]?.changeStatus).toBe('unchanged')
})

test('a pinned --output-dir still wins over the refresh directory, and a plain run stays timestamped', async () => {
  const outputRoot = await makeTempRoot()
  const refreshRoot = await makeTempRoot()
  configureOutputRoot(outputRoot)
  configureLinksRefreshRoot(refreshRoot)

  await runLinksWithArgv(['bun', 'src/cli/create-cli.ts', 'links', DIRECT_URL], { fetchImpl })
  expect(await readdir(refreshRoot)).toEqual([])
  expect(await readdir(outputRoot)).toHaveLength(1)

  const pinnedDir = join(outputRoot, 'pinned-refresh')
  configurePinnedRunDir(pinnedDir)
  const pinned = await runLinksWithArgv(['bun', 'src/cli/create-cli.ts', 'links', '--refresh', DIRECT_URL], { fetchImpl })
  expect(pinned.outputPath).toBe(join(pinnedDir, DIRECT_FILE_NAME))
  expect(await readdir(refreshRoot)).toEqual([])
})
