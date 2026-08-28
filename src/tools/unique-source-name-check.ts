import { statSync } from 'node:fs'
import type { SourceNameViolation, SourceNameViolationKind } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runSyncCommandOrThrow } from '~/utils/sync-subprocess'

const DEFAULT_SOURCE_ROOT = 'src'
const DEFAULT_ALLOWED_INDEX_PATH = 'src/types/index.ts'

const normalizeSourcePath = (sourcePath: string): string =>
  sourcePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')

const isUnderSourceRoot = (sourcePath: string, sourceRoot: string): boolean =>
  sourcePath === sourceRoot || sourcePath.startsWith(`${sourceRoot}/`)

const basename = (sourcePath: string): string => {
  const parts = sourcePath.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? sourcePath
}

const dirname = (sourcePath: string): string => {
  const parts = sourcePath.split('/').filter(Boolean)
  return parts.length > 1 ? parts.slice(0, -1).join('/') : ''
}

const directoryPathsForFile = (filePath: string, sourceRoot: string): string[] => {
  const directory = dirname(filePath)
  if (directory.length === 0) {
    return []
  }

  const parts = directory.split('/')
  const directories: string[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const directoryPath = parts.slice(0, index + 1).join('/')
    if (isUnderSourceRoot(directoryPath, sourceRoot)) {
      directories.push(directoryPath)
    }
  }
  return directories
}

const duplicateBasenameViolations = (
  paths: string[],
  kind: Extract<SourceNameViolationKind, 'file' | 'directory'>
): SourceNameViolation[] => {
  const groups = new Map<string, string[]>()
  for (const sourcePath of paths) {
    const name = basename(sourcePath).toLowerCase()
    const group = groups.get(name)
    if (group) {
      group.push(sourcePath)
    } else {
      groups.set(name, [sourcePath])
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([name, group]) => ({
      kind,
      name,
      paths: [...group].sort()
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export const findSourceNameViolations = (
  paths: string[]
): SourceNameViolation[] => {
  const sourceRoot = normalizeSourcePath(DEFAULT_SOURCE_ROOT)
  const allowedIndexPath = normalizeSourcePath(DEFAULT_ALLOWED_INDEX_PATH)
  const files = [...new Set(paths
    .map(normalizeSourcePath)
    .filter((sourcePath) => isUnderSourceRoot(sourcePath, sourceRoot)))]
    .sort()

  const directories = [...new Set(files.flatMap((filePath) => directoryPathsForFile(filePath, sourceRoot)))]
    .sort()
  const disallowedIndexPaths = files.filter((filePath) =>
    basename(filePath).toLowerCase() === 'index.ts' && filePath !== allowedIndexPath
  )

  const violations = [
    ...duplicateBasenameViolations(files, 'file'),
    ...duplicateBasenameViolations(directories, 'directory')
  ]

  if (disallowedIndexPaths.length > 0) {
    violations.push({
      kind: 'index',
      name: 'index.ts',
      paths: disallowedIndexPaths
    })
  }

  return violations
}

export const formatSourceNameViolations = (violations: SourceNameViolation[]): string => {
  if (violations.length === 0) {
    return 'Source name invariant passed.'
  }

  const lines = ['Source name invariant failed.']
  for (const violation of violations) {
    lines.push('')
    if (violation.kind === 'file') {
      lines.push(`Duplicate file basename: ${violation.name}`)
    } else if (violation.kind === 'directory') {
      lines.push(`Duplicate directory basename: ${violation.name}`)
    } else {
      lines.push('Disallowed index.ts file. Only src/types/index.ts may use this basename.')
    }
    for (const sourcePath of violation.paths) {
      lines.push(`  - ${sourcePath}`)
    }
  }
  return lines.join('\n')
}

const listSourceFiles = (): string[] => {
  const output = runSyncCommandOrThrow(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', DEFAULT_SOURCE_ROOT]
  )

  return output
    .split('\n')
    .filter(Boolean)
    .map(normalizeSourcePath)
    .filter((sourcePath) => {
      try {
        return statSync(sourcePath).isFile()
      } catch {
        return false
      }
    })
}

if (import.meta.main) {
  const violations = findSourceNameViolations(listSourceFiles())
  if (violations.length > 0) {
    l.error(formatSourceNameViolations(violations), { category: 'command' })
    process.exit(1)
  }
}
