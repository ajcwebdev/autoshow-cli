import { constants } from 'node:fs'
import { link, lstat, mkdir, open, rename, rm, rmdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ContainedArtifactFile, ImmutableArtifactFile, SafeArtifactDirectory } from '~/types'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { UsageError, hasErrorCode } from '~/utils/error-handler'
import { ARTIFACT_CONFLICT_STATE, DIRECTORY_MODE, FILE_MODE, inspectCreatedSafeDirectory, inspectExistingSafeArtifactDirectory, inspectSafeDirectory, inspectSafeRoot, normalizeSafeRelativePath, retryCreatedArtifactVisibility } from './safe-artifact-validation'

export const ensureSafeArtifactDirectory = async (
  rootDir: string,
  relativeDirectory: string
): Promise<SafeArtifactDirectory> => {
  const normalized = normalizeSafeRelativePath(relativeDirectory, 'Artifact directory', true)
  const root = await inspectSafeRoot(rootDir)
  let cursor = root.absolute
  let canonicalCursor = root.canonical

  for (const segment of normalized ? normalized.split('/') : []) {
    cursor = join(cursor, segment)
    try {
      await mkdir(cursor, { mode: DIRECTORY_MODE })
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) throw error
    }
    canonicalCursor = await inspectCreatedSafeDirectory(root.canonical, cursor, 'Artifact directory')
  }

  return {
    path: canonicalCursor,
    relativePath: normalized
  }
}

export const readExistingImmutableBytes = async (path: string): Promise<Buffer> => {
  const entry = await lstat(path)
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw UsageError(`Immutable artifact path is not a regular non-symlink file: ${path}`)
  }

  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile()) {
      throw UsageError(`Immutable artifact path is not a regular file: ${path}`)
    }
    return await handle.readFile()
  } catch (error) {
    if (hasErrorCode(error, 'ELOOP')) {
      throw UsageError(`Immutable artifact path cannot be a symbolic link: ${path}`, { cause: error })
    }
    throw error
  } finally {
    await handle?.close()
  }
}

export const readContainedArtifactFile = async (
  rootDir: string,
  relativeFile: string
): Promise<ContainedArtifactFile> => {
  const normalized = normalizeSafeRelativePath(relativeFile, 'Contained artifact file', false)
  const segments = normalized.split('/')
  const fileName = segments.pop() as string
  const parent = await inspectExistingSafeArtifactDirectory(
    rootDir,
    segments.join('/'),
    'Contained artifact directory'
  )
  const path = join(parent.path, fileName)
  const bytes = await readExistingImmutableBytes(path)
  return {
    path,
    relativePath: normalized,
    bytes,
    sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  }
}

export const writeImmutableArtifactFile = async (
  rootDir: string,
  relativeFile: string,
  value: string | Uint8Array
): Promise<ImmutableArtifactFile> => {
  const normalized = normalizeSafeRelativePath(relativeFile, 'Immutable artifact file', false)
  const segments = normalized.split('/')
  const fileName = segments.pop() as string
  const parentRelative = segments.join('/')
  const parent = await ensureSafeArtifactDirectory(rootDir, parentRelative)
  const path = join(parent.path, fileName)
  const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value)
  const temporaryPath = join(parent.path, `.immutable-${crypto.randomUUID()}.tmp`)
  let created = false
  let handle: Awaited<ReturnType<typeof open>> | undefined

  try {
    const openedHandle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      FILE_MODE
    )
    handle = openedHandle
    const opened = await retryCreatedArtifactVisibility(async () => await openedHandle.stat(), temporaryPath, 'Immutable artifact temporary destination')
    if (!opened.isFile()) {
      throw UsageError(`Immutable artifact temporary destination is not a regular file: ${temporaryPath}`)
    }
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.chmod(FILE_MODE)
    await handle.close()
    handle = undefined

    try {
      await retryCreatedArtifactVisibility(async () => await link(temporaryPath, path), temporaryPath, 'Immutable artifact temporary source')
      created = true
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) throw error
      const existing = await readExistingImmutableBytes(path)
      if (!existing.equals(bytes)) {
        throw Object.assign(
          UsageError(`Immutable artifact already exists with different bytes: ${path}`),
          { metadata: { artifactState: ARTIFACT_CONFLICT_STATE } }
        )
      }
    }
  } catch (error) {
    if (hasErrorCode(error, 'ELOOP')) {
      throw UsageError(`Immutable artifact destination cannot be a symbolic link: ${path}`, { cause: error })
    }
    throw error
  } finally {
    await handle?.close()
    await unlink(temporaryPath).catch(() => undefined)
  }

  return {
    path,
    relativePath: normalized,
    sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
    created
  }
}

export const writeReplaceableArtifactFile = async (
  rootDir: string,
  relativeFile: string,
  value: string | Uint8Array
): Promise<ImmutableArtifactFile> => {
  const normalized = normalizeSafeRelativePath(relativeFile, 'Replaceable artifact file', false)
  const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value)
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  try {
    const existing = await readContainedArtifactFile(rootDir, normalized)
    if (existing.bytes.equals(bytes)) {
      return { path: existing.path, relativePath: normalized, sha256: existing.sha256, created: false }
    }
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  const temporaryRelative = `${dirname(normalized)}/.archive-${crypto.randomUUID()}.tmp`
  const temporary = await writeImmutableArtifactFile(rootDir, temporaryRelative, bytes)
  const destination = join((await inspectSafeRoot(rootDir)).absolute, normalized)
  try {
    await rename(temporary.path, destination)
  } finally {
    await unlink(temporary.path).catch(() => undefined)
  }
  return { path: destination, relativePath: normalized, sha256, created: true }
}

export const appendJsonlArtifactLine = async (
  rootDir: string,
  relativeFile: string,
  value: unknown
): Promise<ContainedArtifactFile> => {
  const normalized = normalizeSafeRelativePath(relativeFile, 'Journal artifact file', false)
  if (!normalized.endsWith('.jsonl')) {
    throw UsageError(`Journal artifact must use a .jsonl suffix: ${normalized}`)
  }
  const segments = normalized.split('/')
  const fileName = segments.pop() as string
  const parent = await ensureSafeArtifactDirectory(rootDir, segments.join('/'))
  const path = join(parent.path, fileName)
  const line = Buffer.from(`${JSON.stringify(value)}\n`)
  let existing: Buffer = Buffer.alloc(0)
  try {
    existing = Buffer.from(await readExistingImmutableBytes(path))
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  const bytes = Buffer.concat([existing, line])
  const handle = await open(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_APPEND | constants.O_NOFOLLOW,
    FILE_MODE
  )
  try {
    const opened = await retryCreatedArtifactVisibility(async () => await handle.stat(), path, 'Journal artifact destination')
    if (!opened.isFile()) {
      throw UsageError(`Journal artifact destination is not a regular file: ${path}`)
    }
    await handle.writeFile(line)
    await handle.sync()
    await handle.chmod(FILE_MODE)
  } finally {
    await handle.close()
  }
  return {
    path,
    relativePath: normalized,
    bytes,
    sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  }
}

export const hardlinkContainedArtifact = async (
  rootDir: string,
  sourceRelative: string,
  destinationRelative: string
): Promise<ContainedArtifactFile> => {
  const source = await readContainedArtifactFile(rootDir, sourceRelative)
  const destination = normalizeSafeRelativePath(destinationRelative, 'Hardlinked artifact file', false)
  const segments = destination.split('/')
  const fileName = segments.pop() as string
  const parent = await ensureSafeArtifactDirectory(rootDir, segments.join('/'))
  const path = join(parent.path, fileName)
  try {
    await link(source.path, path)
  } catch (error) {
    if (!hasErrorCode(error, 'EEXIST')) throw error
    const existing = await readExistingImmutableBytes(path)
    if (!existing.equals(source.bytes)) {
      throw Object.assign(
        UsageError(`Hardlinked artifact already exists with different bytes: ${path}`, { cause: error }),
        { metadata: { artifactState: ARTIFACT_CONFLICT_STATE } }
      )
    }
  }
  return {
    path,
    relativePath: destination,
    bytes: source.bytes,
    sha256: source.sha256
  }
}

export const replaceHardlinkContainedArtifact = async (
  rootDir: string,
  sourceRelative: string,
  destinationRelative: string
): Promise<ContainedArtifactFile> => {
  const source = await readContainedArtifactFile(rootDir, sourceRelative)
  const destination = normalizeSafeRelativePath(destinationRelative, 'Replaceable hardlinked artifact file', false)
  if (source.relativePath === destination) return source
  const segments = destination.split('/')
  const fileName = segments.pop() as string
  const parent = await ensureSafeArtifactDirectory(rootDir, segments.join('/'))
  const path = join(parent.path, fileName)
  try {
    const existing = await readExistingImmutableBytes(path)
    if (existing.equals(source.bytes)) {
      return { path, relativePath: destination, bytes: source.bytes, sha256: source.sha256 }
    }
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  const temporaryPath = join(parent.path, `.replacement-${crypto.randomUUID()}.tmp`)
  try {
    await link(source.path, temporaryPath)
    await rename(temporaryPath, path)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
  return {
    path,
    relativePath: destination,
    bytes: source.bytes,
    sha256: source.sha256
  }
}

export const removeContainedDirectory = async (
  rootDir: string,
  relativeDirectory: string
): Promise<void> => {
  const normalized = normalizeSafeRelativePath(relativeDirectory, 'Removable artifact directory', false)
  const parent = await inspectSafeRoot(rootDir)
  const path = join(parent.absolute, normalized)
  try {
    await inspectSafeDirectory(parent.canonical, path, 'Removable artifact directory')
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return
    throw error
  }
  await rm(path, { recursive: true, force: true })
}

export const removeContainedDirectoryIfEmpty = async (
  rootDir: string,
  relativeDirectory: string
): Promise<void> => {
  const normalized = normalizeSafeRelativePath(relativeDirectory, 'Removable empty artifact directory', false)
  const parent = await inspectSafeRoot(rootDir)
  const path = join(parent.absolute, normalized)
  try {
    await inspectSafeDirectory(parent.canonical, path, 'Removable empty artifact directory')
    await rmdir(path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTEMPTY') || hasErrorCode(error, 'EEXIST')) return
    throw error
  }
}
