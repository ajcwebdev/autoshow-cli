import { afterEach, expect, test } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FetchFn } from '~/types'
import {
  getDefaultLinksDirectUrlOutputFileName,
  getLinksRefreshMetadataPath,
  runLinksWithArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { commandAcceptsGlobalFlag } from '~/cli/native/global-flag-support'
import { commandCreatesRunDirectory } from '~/cli/native/run-directory-support'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
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

test('links --refresh-only against a pinned directory leaves existing markdown in place', async () => {
  const root = await makeTempRoot()
  const pinnedDir = join(root, 'refresh-links')
  const outputPath = join(pinnedDir, DIRECT_FILE_NAME)
  const sidecarPath = getLinksRefreshMetadataPath(outputPath)
  await Bun.write(outputPath, 'custom initial content\n')
  configurePinnedRunDir(pinnedDir)

  const result = await runLinksWithArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--refresh-only',
    DIRECT_URL
  ], { fetchImpl })

  expect(result.outputPath).toBe(outputPath)
  expect(result.refreshMetadataPath).toBe(sidecarPath)
  expect(await Bun.file(outputPath).text()).toBe('custom initial content\n')
  const metadata = JSON.parse(await Bun.file(sidecarPath).text()) as { markdownWritten?: boolean }
  expect(metadata.markdownWritten).toBe(false)
})
