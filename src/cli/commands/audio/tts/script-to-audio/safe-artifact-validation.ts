import { lstat, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SafeArtifactDirectory } from '~/types'
import { InfraError, UsageError, extractErrorMetadata, hasErrorCode } from '~/utils/error-handler'
import { withRetry } from '~/utils/retries'

export const DIRECTORY_MODE = 0o700

export const FILE_MODE = 0o600

const ENCODED_PATH_SEPARATOR_OR_DOT = /%(?:2e|2f|5c)/i

const MISSING_ARTIFACT_STATE = 'missing'

export const ARTIFACT_CONFLICT_STATE = 'conflict'

export const isArtifactConflictError = (error: unknown): boolean =>
  hasErrorCode(error, 'EEXIST')
  || extractErrorMetadata(error)['artifactState'] === ARTIFACT_CONFLICT_STATE

export const isMissingArtifactError = (error: unknown): boolean =>
  hasErrorCode(error, 'ENOENT')
  || extractErrorMetadata(error)['artifactState'] === MISSING_ARTIFACT_STATE

export const normalizeSafeRelativePath = (
  value: string,
  label: string,
  allowEmpty: boolean
): string => {
  if (
    (!allowEmpty && value.length === 0)
    || value.includes('\\')
    || value.includes('\0')
    || isAbsolute(value)
    || ENCODED_PATH_SEPARATOR_OR_DOT.test(value)
  ) {
    throw UsageError(`${label} must be a safe contained POSIX path.`)
  }

  const segments = value.length === 0 ? [] : value.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw UsageError(`${label} must be a safe contained POSIX path.`)
  }
  return segments.join('/')
}

const isContainedOrEqual = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
}

export const inspectSafeRoot = async (rootDir: string): Promise<{ absolute: string, canonical: string }> => {
  const absolute = resolve(rootDir)
  let entry
  try {
    entry = await lstat(absolute)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      throw Object.assign(
        UsageError(`Safe artifact root does not exist: ${absolute}`, { cause: error }),
        { metadata: { artifactState: MISSING_ARTIFACT_STATE } }
      )
    }
    throw error
  }
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw UsageError(`Safe artifact root must be a real directory, not a symbolic link: ${absolute}`)
  }
  return { absolute, canonical: await realpath(absolute) }
}

export const inspectSafeDirectory = async (
  canonicalRoot: string,
  path: string,
  label: string
): Promise<string> => {
  const entry = await lstat(path)
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw UsageError(`${label} must be a real directory and cannot traverse a symbolic link.`)
  }
  const canonical = await realpath(path)
  if (!isContainedOrEqual(canonicalRoot, canonical)) {
    throw UsageError(`${label} resolves outside its safe artifact root.`)
  }
  return canonical
}

export const retryCreatedArtifactVisibility = async <T>(
  operation: () => Promise<T>,
  path: string,
  label: string
): Promise<T> => {
  return await withRetry({
    retryClass: 'filesystem_visibility',
    operationName: 'safe-artifact-visibility',
    retryLogMetadata: () => ({ path, label })
  }, async () => {
    try {
      return await operation()
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) throw error
      throw InfraError(`${label} is not visible for safe inspection yet`, {
        stage: 'tts:artifact-visibility',
        cause: error,
        retryable: true,
        metadata: { path, label }
      })
    }
  }, (error) => hasErrorCode(error, 'ENOENT')
    ? {
        shouldRetry: true,
        delayMs: 0,
        reasonCode: 'filesystem_not_visible',
        reason: `${label} is not visible yet`
      }
    : {
        shouldRetry: false,
        delayMs: 0,
        reasonCode: 'classifier_refused',
        reason: `${label} failed for a reason other than filesystem visibility`
      })
}

export const inspectCreatedSafeDirectory = async (
  canonicalRoot: string,
  path: string,
  label: string
): Promise<string> => await retryCreatedArtifactVisibility(
  async () => await inspectSafeDirectory(canonicalRoot, path, label),
  path,
  label
)

export const inspectExistingSafeArtifactDirectory = async (
  rootDir: string,
  relativeDirectory: string,
  label: string
): Promise<SafeArtifactDirectory> => {
  const normalized = normalizeSafeRelativePath(relativeDirectory, label, true)
  const root = await inspectSafeRoot(rootDir)
  let cursor = root.absolute

  for (const segment of normalized ? normalized.split('/') : []) {
    cursor = join(cursor, segment)
    await inspectSafeDirectory(root.canonical, cursor, label)
  }

  return { path: cursor, relativePath: normalized }
}
