import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

const projectRootOverride = process.env['AUTOSHOW_PROJECT_ROOT']?.trim()
export const PROJECT_ROOT = projectRootOverride
  ? resolve(projectRootOverride)
  : Bun.isStandaloneExecutable
    ? dirname(process.execPath)
    : resolve(import.meta.dir, '../..')

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
