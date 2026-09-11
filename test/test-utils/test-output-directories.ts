import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { statPath as stat } from '~/utils/bun-file-io'
import { hasErrorCode } from '~/utils/error-handler'
import { isProcessingCliCommand } from './test-command-options'

const TEST_OUTPUT_ROOT = 'output/test-output'

export const sanitizeOutputRootSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'run'

export const testWorkerScratchSegment = (
  workerId = process.env['BUN_TEST_WORKER_ID'],
  pid = process.pid
): string => {
  const normalizedWorkerId = workerId?.trim()
  return normalizedWorkerId
    ? `w${sanitizeOutputRootSegment(normalizedWorkerId)}-p${pid}`
    : `p${pid}`
}

const resolveTestOutputDir = (): string => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']?.trim()
  if (artifactsDir) {
    return join(artifactsDir, 'outputs', testWorkerScratchSegment())
  }

  const explicit = process.env['AUTOSHOW_TEST_OUTPUT_DIR']?.trim()
  if (explicit) {
    return explicit
  }

  return join(TEST_OUTPUT_ROOT, 'local', testWorkerScratchSegment())
}

export const OUTPUT_DIR = resolveTestOutputDir()

const shouldPreserveArtifacts = (): boolean => process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] !== '0'

const sanitizeOutputSuffix = (titleSuffix: string): string =>
  titleSuffix.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]/g, '')

let commandOutputCounter = 0

const createCommandOutputRoot = async (args: string[], testName: string | null): Promise<string> => {
  const index = ++commandOutputCounter
  const command = args[1] ?? 'command'
  const label = testName ?? args.slice(1, 5).join('-')
  const segment = [
    String(index).padStart(4, '0'),
    Date.now().toString(36),
    sanitizeOutputRootSegment(command),
    sanitizeOutputRootSegment(label).slice(0, 80),
  ].filter(Boolean).join('-')
  const outputRoot = join(OUTPUT_DIR, segment)
  await mkdir(outputRoot, { recursive: true })
  return outputRoot
}

export const resolveCommandOutputRoot = async (
  args: string[],
  testName: string | null,
  env: Record<string, string | undefined> | undefined
): Promise<string> => {
  const explicitOutputRoot = env?.['AUTOSHOW_TEST_OUTPUT_DIR']?.trim()
  if (explicitOutputRoot) {
    return explicitOutputRoot
  }

  if (isProcessingCliCommand(args)) {
    return await createCommandOutputRoot(args, testName)
  }

  return OUTPUT_DIR
}

const listMatchingOutputDirs = async (titleSuffix: string, outputRoot = OUTPUT_DIR): Promise<string[]> => {
  const sanitizedSuffix = sanitizeOutputSuffix(titleSuffix)

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory() && entry.name.endsWith(`_${sanitizedSuffix}`))
      .map(entry => join(outputRoot, entry.name))
  } catch {
    return []
  }
}

const listMatchingOutputDirsRecursive = async (titleSuffix: string, outputRoot: string): Promise<string[]> => {
  const direct = await listMatchingOutputDirs(titleSuffix, outputRoot)

  try {
    const entries = await readdir(outputRoot, { withFileTypes: true })
    const nested = await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(entry => listMatchingOutputDirs(titleSuffix, join(outputRoot, entry.name)))
    )
    return [...direct, ...nested.flat()]
  } catch {
    return direct
  }
}

export const findLatestDirectory = async (
  titleSuffix: string,
  outputRoot?: string | null
): Promise<string | null> => {
  try {
    const directories = outputRoot
      ? await listMatchingOutputDirs(titleSuffix, outputRoot)
      : await listMatchingOutputDirsRecursive(titleSuffix, OUTPUT_DIR)

    if (directories.length === 0) {
      return null
    }

    const stats = await Promise.all(
      directories.map(async (dir) => {
        const s = await stat(dir)
        return { dir, mtimeMs: s.mtimeMs }
      })
    )

    stats.sort((a, b) => {
      if (a.mtimeMs !== b.mtimeMs) return a.mtimeMs - b.mtimeMs
      return a.dir.localeCompare(b.dir)
    })

    return stats[stats.length - 1]?.dir ?? null
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return null
    }
    throw error
  }
}

export const cleanupOutputDir = async (dir: string | null | undefined): Promise<void> => {
  if (!dir || shouldPreserveArtifacts()) {
    return
  }
  await rm(dir, { recursive: true, force: true }).catch(() => {})
}

export const cleanupTestOutput = async (titleSuffix: string): Promise<void> => {
  if (shouldPreserveArtifacts()) {
    return
  }

  try {
    const dirs = await listMatchingOutputDirs(titleSuffix)
    await Promise.all(dirs.map(d => rm(d, { recursive: true, force: true })))
  } catch {
  }
}
