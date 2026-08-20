import { lstat, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { CLIUsageError, hasErrorCode } from '~/utils/error-handler'

// Canonicalize the longest existing prefix, then reattach an unresolved suffix. This catches an
// overlap through a symlink even when the eventual output/store child does not exist yet.
const canonicalProspectivePath = async (input: string): Promise<string> => {
  let cursor = resolve(input)
  const suffix: string[] = []
  while (true) {
    let exists = false
    try {
      await lstat(cursor)
      exists = true
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) {
        throw CLIUsageError(
      'Unable to inspect the TTS output/protected-store path boundary.',
      undefined,
      error instanceof Error ? { cause: error } : {}
    )
      }
    }
    if (exists) {
      try {
        const canonicalPrefix = await realpath(cursor)
        return resolve(canonicalPrefix, ...suffix)
      } catch {
        throw CLIUsageError('Unable to resolve the TTS output/protected-store path boundary; dangling symbolic links are not allowed.')
      }
    } else {
      const parent = dirname(cursor)
      if (parent === cursor) {
        throw CLIUsageError('Unable to resolve the TTS output/protected-store path boundary.')
      }
      suffix.unshift(basename(cursor))
      cursor = parent
    }
  }
}

const isSameOrContained = (root: string, candidate: string): boolean => {
  if (root === candidate) return true
  const child = relative(root, candidate)
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

export const assertProtectedStoreOutputDisjoint = async (
  outputPath: string,
  protectedStoreRoot: string
): Promise<void> => {
  const [canonicalOutput, canonicalStore] = await Promise.all([
    canonicalProspectivePath(outputPath),
    canonicalProspectivePath(protectedStoreRoot)
  ])
  if (
    isSameOrContained(canonicalOutput, canonicalStore)
    || isSameOrContained(canonicalStore, canonicalOutput)
  ) {
    throw CLIUsageError(
      'Output and the protected voice asset store must be disjoint directories.',
      'Choose an --output-dir/--output-root outside the protected runtime store and do not connect them through a symbolic link.'
    )
  }
}

export const assertProtectedStoresOutputDisjoint = async (
  outputPath: string,
  protectedStoreRoots: readonly string[]
): Promise<void> => {
  for (const protectedStoreRoot of protectedStoreRoots) {
    await assertProtectedStoreOutputDisjoint(outputPath, protectedStoreRoot)
  }
}
