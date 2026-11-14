import { lstatSync, readlinkSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { PROJECT_ROOT } from './project-root'

export const RUNTIME_ROOT_PATH = join(PROJECT_ROOT, 'runtime')

export const pathIsWithinRoot = (root: string, path: string): boolean => {
  const rel = relative(resolve(root), resolve(path))
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** Resolve missing descendants using their nearest existing physical ancestor. */
export const resolveRuntimePhysicalPath = (
  path: string,
  readRealpath: (path: string) => string = realpathSync,
  remainingLinks = 40
): string => {
  let current = resolve(path)
  const suffix: string[] = []
  for (;;) {
    try {
      return join(readRealpath(current), ...suffix)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error
      // realpath rejects dangling links. Resolve their target explicitly so a
      // future target cannot make an apparently contained path escape later.
      let linkTarget: string | undefined
      try {
        if (lstatSync(current).isSymbolicLink()) linkTarget = readlinkSync(current)
      } catch (entryError) {
        const entryCode = (entryError as NodeJS.ErrnoException).code
        if (entryCode !== 'ENOENT' && entryCode !== 'ENOTDIR') throw entryError
      }
      if (linkTarget !== undefined) {
        if (remainingLinks <= 0) throw new TypeError('Managed runtime paths contain an unresolved symbolic-link cycle.')
        return join(resolveRuntimePhysicalPath(resolve(dirname(current), linkTarget), readRealpath, remainingLinks - 1), ...suffix)
      }
      const parent = dirname(current)
      if (parent === current) return resolve(path)
      suffix.unshift(basename(current))
      current = parent
    }
  }
}

export const pathIsPhysicallyWithinRoot = (
  root: string,
  path: string,
  readRealpath?: (path: string) => string
): boolean => pathIsWithinRoot(root, path)
  && pathIsWithinRoot(resolveRuntimePhysicalPath(root, readRealpath), resolveRuntimePhysicalPath(path, readRealpath))

export const assertManagedRuntimePath = (path: string): string => {
  const resolved = resolve(path)
  if (!pathIsPhysicallyWithinRoot(RUNTIME_ROOT_PATH, resolved)) {
    throw new TypeError('Managed runtime paths must resolve inside the project runtime directory.')
  }
  return resolved
}
