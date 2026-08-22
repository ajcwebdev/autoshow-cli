import { chmod, readdir, rename, mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import type { WalkPathKind, WalkPathsOptions } from '~/types'
import { statPath as stat, writeFileExact } from '~/utils/bun-file-io'

const normalizeMaxDepth = (maxDepth: number | undefined): number => {
  if (maxDepth === undefined) return Number.POSITIVE_INFINITY
  if (!Number.isFinite(maxDepth)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor(maxDepth))
}

const shouldInclude = (kind: WalkPathKind, entryKind: Exclude<WalkPathKind, 'any'>): boolean =>
  kind === 'any' || kind === entryKind

export const makeExecutable = async (path: string, mode = 0o755): Promise<void> => {
  await chmod(path, mode)
}

/**
 * Permissive existence probe: any `stat` failure reads as "absent". Callers that need an
 * unexpected error (a permissions failure, say) to surface should use `fileExists` from
 * `~/utils/cli-utils`, which only swallows ENOENT/ENOTDIR/ENAMETOOLONG.
 */
export const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** True when `candidate` resolves strictly inside `root`. */
export const isContainedPath = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

/**
 * Writes pretty-printed JSON through a sibling temp file so readers never observe a partial
 * document. The parent directory is created first, so callers may target a fresh directory.
 */
export const atomicWriteJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${crypto.randomUUID()}`
  await writeFileExact(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await rename(temporary, path)
}

export const walkPaths = async (
  root: string,
  options: WalkPathsOptions = {}
): Promise<string[]> => {
  const kind = options.kind ?? 'any'
  const maxDepth = normalizeMaxDepth(options.maxDepth)
  const paths: string[] = []

  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth >= maxDepth) return

    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const fullPath = join(directory, entry.name)
      const entryDepth = depth + 1

      if (entry.isDirectory()) {
        if (shouldInclude(kind, 'directory')) {
          paths.push(fullPath)
        }
        if (entryDepth < maxDepth) {
          await visit(fullPath, entryDepth)
        }
      } else if (entry.isFile() && shouldInclude(kind, 'file')) {
        paths.push(fullPath)
      }
    }
  }

  await visit(root, 0)
  return paths
}
