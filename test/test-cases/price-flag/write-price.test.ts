import { afterAll, expect, test } from 'bun:test'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { stripAnsi } from '~/utils/terminal-colors'
import {
  fileExists,
  OUTPUT_DIR,
  runCommand
} from '../../test-utils/test-helpers'
import { E2E_TEST_TIMEOUT_MS } from '../../test-utils/budget'
import type { WritePriceLyricsProjectFixture } from '~/types'

const PROJECT_PREFIX = 'autoshow-write-lyrics'

const createdProjects: string[] = []

const toCliDisplayPath = (path: string): string => {
  const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path)
  const relativePath = relative(process.cwd(), absolutePath)
  if (relativePath.length === 0 || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return absolutePath.replace(/\\/g, '/')
  }
  return `./${relativePath.replace(/\\/g, '/')}`
}

const createWriteLyricsProject = async (): Promise<WritePriceLyricsProjectFixture> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const projectName = `${PROJECT_PREFIX}-${suffix}`
  const projectDir = join(OUTPUT_DIR, projectName)
  const textDir = join(projectDir, 'text')
  const lyricsDir = join(projectDir, 'lyrics')

  await mkdir(textDir, { recursive: true })
  await writeFile(join(projectDir, 'prompt.md'), 'Write song lyrics from the provided source text.\n')
  await writeFile(join(projectDir, 'tracks.md'), '1. Track One\n2. Track Two\n')
  await writeFile(join(textDir, `01-track-one-${suffix}.md`), 'The first source text describes a late-night drive through a small town.\n')
  await writeFile(join(textDir, `02-track-two-${suffix}.txt`), 'The second source text describes the aftermath and the feeling of being watched.\n')

  createdProjects.push(projectDir)
  return { textDir, lyricsDir }
}

const listOutputDirs = async (): Promise<string[]> => {
  try {
    const entries = await readdir(OUTPUT_DIR, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(OUTPUT_DIR, entry.name))
      .sort()
  } catch {
    return []
  }
}

afterAll(async () => {
  for (const projectDir of createdProjects) {
    await rm(projectDir, { recursive: true, force: true })
  }
})

test('write --price auto-detects prose .txt targets as text input instead of batch lists', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const fixtureDir = join(OUTPUT_DIR, `${PROJECT_PREFIX}-prose-${suffix}`)
  await mkdir(fixtureDir, { recursive: true })
  createdProjects.push(fixtureDir)

  const prosePath = join(fixtureDir, 'chapter.txt')
  await writeFile(prosePath, [
    'The warden crossed the yard before the morning bell rang out.',
    'Nobody spoke while the ledger changed hands in the records office.',
    'By nightfall the account of the transfer had already been rewritten.'
  ].join('\n'))

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    prosePath,
    '--price'
  ], { env: { AUTOSHOW_TEST_OUTPUT_DIR: OUTPUT_DIR } })

  const output = stripAnsi(`${result.stdout}\n${result.stderr}`)
  expect(result.exitCode).toBe(0)
  expect(output).toContain('running write in text-input mode')
  expect(output).not.toContain('No valid inputs found')
  expect(output).toContain('Expected files')
}, E2E_TEST_TIMEOUT_MS)

test('write --price errors on nonexistent local targets instead of estimating', async () => {
  const missingPath = join(OUTPUT_DIR, `${PROJECT_PREFIX}-missing-${Date.now()}.txt`)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    missingPath,
    '--price'
  ], { env: { AUTOSHOW_TEST_OUTPUT_DIR: OUTPUT_DIR } })

  const output = stripAnsi(`${result.stdout}\n${result.stderr}`)
  expect(result.exitCode).toBe(2)
  expect(output).toContain(`Input does not exist: ${missingPath}`)
  expect(output).not.toContain('Total estimated cost')
}, E2E_TEST_TIMEOUT_MS)

test('write project directory --price reports rendered lyric outputs without creating a run directory', async () => {
  const project = await createWriteLyricsProject()
  const dirsBefore = new Set(await listOutputDirs())

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'write',
    project.textDir,
    '--text-input',
    '--price'
  ], { env: { AUTOSHOW_TEST_OUTPUT_DIR: OUTPUT_DIR } })

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()

  const output = stripAnsi(`${result.stdout}\n${result.stderr}`)
  expect(output).toContain('Expected files')
  expect(output).toContain(`${toCliDisplayPath(project.lyricsDir)}/*.md`)
  expect(await fileExists(project.lyricsDir)).toBe(false)

  const dirsAfter = await listOutputDirs()
  const newRunDirs = dirsAfter.filter((dir) => !dirsBefore.has(dir) && basename(dir).endsWith('_text'))
  expect(newRunDirs).toEqual([])
}, E2E_TEST_TIMEOUT_MS)
