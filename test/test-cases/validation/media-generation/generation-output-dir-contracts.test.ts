import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { createGenerationOutputDir } from '~/cli/commands/process-steps/generation-command-utils'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'

const tempDirs: string[] = []

afterEach(async () => {
  resetPinnedRunDir()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const makeTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-generation-output-dir-'))
  tempDirs.push(root)
  return root
}

test('explicit generation output directories are exact and reusable', async () => {
  const root = await makeTempRoot()
  const exactDir = join(root, 'exact-run')

  configurePinnedRunDir(exactDir)
  const createdDir = await createGenerationOutputDir('image-gen')

  expect(createdDir).toBe(exactDir)
  expect(basename(createdDir)).toBe('exact-run')
  expect((await stat(exactDir)).isDirectory()).toBe(true)

  const existingDir = join(root, 'existing-run')
  await mkdir(existingDir)

  configurePinnedRunDir(existingDir)
  await expect(createGenerationOutputDir('image-gen')).resolves.toBe(existingDir)

  const filePath = join(root, 'not-a-directory')
  await writeFile(filePath, 'not a directory')

  configurePinnedRunDir(filePath)
  await expect(createGenerationOutputDir('image-gen'))
    .rejects
    .toThrow(`Output path exists and is not a directory: ${filePath}`)
})

test('an empty pinned output directory is rejected', () => {
  expect(() => configurePinnedRunDir('   ')).toThrow('Output directory cannot be empty.')
})

test('a pinned output directory is claimed by a single run', async () => {
  const root = await makeTempRoot()
  const pinnedDir = join(root, 'pinned-run')

  configurePinnedRunDir(pinnedDir)
  await expect(createGenerationOutputDir('image-gen')).resolves.toBe(pinnedDir)

  // The same run resolving its directory again is idempotent.
  await expect(createGenerationOutputDir('image-gen')).resolves.toBe(pinnedDir)

  // A second, independent run cannot share one pinned directory.
  await expect(createGenerationOutputDir('video-gen'))
    .rejects
    .toThrow('--output-dir cannot be used for a run that creates more than one output directory')
})
