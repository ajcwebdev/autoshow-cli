import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { existsSync } from 'node:fs'

const projectRootOverride = process.env['AUTOSHOW_PROJECT_ROOT']?.trim()
// Source bundles can live below output/ or runtime/. Locate their checkout assets
// independently of the mutable project root used by an isolated invocation.
const findSourceRoot = (start: string): string | undefined => {
  let candidate = resolve(start)
  while (true) {
    if (existsSync(resolve(candidate, 'package.json')) && existsSync(resolve(candidate, 'src/cli/create-cli.ts'))) return candidate
    const parent = dirname(candidate)
    if (parent === candidate) return undefined
    candidate = parent
  }
}
export const SOURCE_ROOT = findSourceRoot(import.meta.dir)
  ?? (projectRootOverride ? findSourceRoot(projectRootOverride) : undefined)
  ?? findSourceRoot(process.cwd())
  ?? resolve(import.meta.dir, '../..')
export const PROJECT_ROOT = projectRootOverride
  ? resolve(projectRootOverride)
  : Bun.isStandaloneExecutable
    ? dirname(process.execPath)
    : SOURCE_ROOT

const toPosix = (value: string): string => value.replace(/\\/g, '/')

const relativeToProjectRoot = (absolutePath: string): string | undefined => {
  const rel = relative(PROJECT_ROOT, absolutePath)
  if (rel.length === 0) return '.'
  if (rel.startsWith('..') || isAbsolute(rel)) return undefined
  return toPosix(rel)
}

// Persisted artifacts store project paths relative to PROJECT_ROOT so they never embed a machine-specific checkout location.
export const toProjectRelativePath = (path: string): string => {
  const resolved = resolve(path)
  return relativeToProjectRoot(resolved) ?? toPosix(resolved)
}

export const toProjectRelativeArg = (value: string): string =>
  isAbsolute(value) ? toProjectRelativePath(value) : value

export const toLocalSourceRef = (filePath: string): string => {
  const resolved = resolve(filePath)
  return relativeToProjectRoot(resolved) ?? Bun.pathToFileURL(resolved).href
}

const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i

export const isProjectRelativeSourceRef = (value: string): boolean =>
  value.trim().length > 0 && !URL_SCHEME_PATTERN.test(value) && !isAbsolute(value)

export const stripProjectRoot = (text: string): string => {
  const root = PROJECT_ROOT.endsWith(sep) ? PROJECT_ROOT : `${PROJECT_ROOT}${sep}`
  const fileUrlRoot = Bun.pathToFileURL(root).href
  return text.split(fileUrlRoot).join('').split(root).join('')
}
