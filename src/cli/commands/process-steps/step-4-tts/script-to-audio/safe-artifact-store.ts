import { constants } from 'node:fs'
import { link, lstat, mkdir, open, readdir, realpath, rename, rm, rmdir } from 'node:fs/promises'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { ContainedArtifactFile, ImmutableArtifactFile, ReservedInvocationAttemptDirectory, SafeArtifactDirectory } from '~/types'
import { AppInfrastructureError, CLIUsageError, extractErrorMetadata, hasErrorCode } from '~/utils/error-handler'

const DIRECTORY_MODE = 0o700
const FILE_MODE = 0o600
const SAFE_INVOCATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/
const ENCODED_PATH_SEPARATOR_OR_DOT = /%(?:2e|2f|5c)/i
const CLAIM_OWNER_FILE = /^owner-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.lock$/

export class ArtifactReservationConflictError extends AppInfrastructureError {
  readonly code = 'ARTIFACT_RESERVATION_CONFLICT'
  readonly relativePath: string

  constructor(relativePath: string) {
    super(`Immutable invocation attempt directory is already reserved: ${relativePath}`, {
      stage: 'tts:artifact-store',
      retryable: false,
      metadata: { relativePath }
    })
    this.name = 'ArtifactReservationConflictError'
    this.relativePath = relativePath
  }
}

const MISSING_ARTIFACT_STATE = 'missing'

const ARTIFACT_CONFLICT_STATE = 'conflict'

export const isArtifactConflictError = (error: unknown): boolean =>
  hasErrorCode(error, 'EEXIST')
  || extractErrorMetadata(error)['artifactState'] === ARTIFACT_CONFLICT_STATE

export const isMissingArtifactError = (error: unknown): boolean =>
  hasErrorCode(error, 'ENOENT')
  || extractErrorMetadata(error)['artifactState'] === MISSING_ARTIFACT_STATE

const normalizeSafeRelativePath = (
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
    throw CLIUsageError(`${label} must be a safe contained POSIX path.`)
  }

  const segments = value.length === 0 ? [] : value.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw CLIUsageError(`${label} must be a safe contained POSIX path.`)
  }
  return segments.join('/')
}

const isContainedOrEqual = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
}

const inspectSafeRoot = async (rootDir: string): Promise<{ absolute: string, canonical: string }> => {
  const absolute = resolve(rootDir)
  let entry
  try {
    entry = await lstat(absolute)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      throw Object.assign(
        CLIUsageError(`Safe artifact root does not exist: ${absolute}`, undefined, error instanceof Error ? { cause: error } : {}),
        { metadata: { artifactState: MISSING_ARTIFACT_STATE } }
      )
    }
    throw error
  }
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw CLIUsageError(`Safe artifact root must be a real directory, not a symbolic link: ${absolute}`)
  }
  return { absolute, canonical: await realpath(absolute) }
}

const inspectSafeDirectory = async (
  canonicalRoot: string,
  path: string,
  label: string
): Promise<string> => {
  const entry = await lstat(path)
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw CLIUsageError(`${label} must be a real directory and cannot traverse a symbolic link.`)
  }
  const canonical = await realpath(path)
  if (!isContainedOrEqual(canonicalRoot, canonical)) {
    throw CLIUsageError(`${label} resolves outside its safe artifact root.`)
  }
  return canonical
}

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
    canonicalCursor = await inspectSafeDirectory(root.canonical, cursor, 'Artifact directory')
  }

  return {
    path: canonicalCursor,
    relativePath: normalized
  }
}

const inspectExistingSafeArtifactDirectory = async (
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

const readExistingImmutableBytes = async (path: string): Promise<Buffer> => {
  const entry = await lstat(path)
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw CLIUsageError(`Immutable artifact path is not a regular non-symlink file: ${path}`)
  }

  let handle
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const opened = await handle.stat()
    if (!opened.isFile()) {
      throw CLIUsageError(`Immutable artifact path is not a regular file: ${path}`)
    }
    return await handle.readFile()
  } catch (error) {
    if (hasErrorCode(error, 'ELOOP')) {
      throw CLIUsageError(`Immutable artifact path cannot be a symbolic link: ${path}`, undefined, error instanceof Error ? { cause: error } : {})
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
  let handle

  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      FILE_MODE
    )
    const opened = await handle.stat()
    if (!opened.isFile()) {
      throw CLIUsageError(`Immutable artifact temporary destination is not a regular file: ${temporaryPath}`)
    }
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.chmod(FILE_MODE)
    await handle.close()
    handle = undefined

    try {
      await link(temporaryPath, path)
      created = true
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) throw error
      const existing = await readExistingImmutableBytes(path)
      if (!existing.equals(bytes)) {
        throw Object.assign(
          CLIUsageError(`Immutable artifact already exists with different bytes: ${path}`),
          { metadata: { artifactState: ARTIFACT_CONFLICT_STATE } }
        )
      }
    }
  } catch (error) {
    if (hasErrorCode(error, 'ELOOP')) {
      throw CLIUsageError(`Immutable artifact destination cannot be a symbolic link: ${path}`, undefined, error instanceof Error ? { cause: error } : {})
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
    throw CLIUsageError(`Journal artifact must use a .jsonl suffix: ${normalized}`)
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
    const opened = await handle.stat()
    if (!opened.isFile()) {
      throw CLIUsageError(`Journal artifact destination is not a regular file: ${path}`)
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
        CLIUsageError(`Hardlinked artifact already exists with different bytes: ${path}`, undefined, error instanceof Error ? { cause: error } : {}),
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

export const releasePreparedInvocationAttemptClaim = async (
  rootDir: string,
  options: Readonly<{
    attemptsDirectory: string
    attempt: number
    invocationId: string
  }>
): Promise<void> => {
  if (!Number.isSafeInteger(options.attempt) || options.attempt < 1) {
    throw CLIUsageError('Invocation attempt number must be a positive safe integer.')
  }
  if (!SAFE_INVOCATION_ID.test(options.invocationId)) {
    throw CLIUsageError('Invocation ID must be an opaque path-safe identifier.')
  }

  const attemptsDirectory = normalizeSafeRelativePath(
    options.attemptsDirectory,
    'Invocation attempts directory',
    false
  )
  const claimName = `.attempt-${String(options.attempt).padStart(3, '0')}.claim`
  const claimRelativePath = `${attemptsDirectory}/${claimName}`
  const claim = await inspectExistingSafeArtifactDirectory(
    rootDir,
    claimRelativePath,
    'Invocation attempt claim'
  )
  const entries = await readdir(claim.path)
  const ownerMatch = entries.length === 1 ? CLAIM_OWNER_FILE.exec(entries[0] as string) : undefined
  if (!ownerMatch?.[1]) {
    throw CLIUsageError(`Invocation attempt claim has no unique immutable owner: ${claimRelativePath}`)
  }
  const ownerRelativePath = `${claimRelativePath}/${entries[0] as string}`
  const owner = await readContainedArtifactFile(rootDir, ownerRelativePath)
  const ownerFields = owner.bytes.toString('utf8').split('\n')
  if (
    ownerFields.length !== 3
    || ownerFields[2] !== ''
    || ownerFields[0] !== options.invocationId
    || ownerFields[1] !== ownerMatch[1]
  ) {
    throw CLIUsageError(`Invocation attempt claim belongs to a different immutable invocation: ${claimRelativePath}`)
  }

  try {
    await unlink(owner.path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return
    throw error
  }
  try {
    await rmdir(claim.path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTEMPTY')) return
    throw error
  }
}

export const reserveInvocationAttemptDirectory = async (
  rootDir: string,
  options: Readonly<{
    attemptsDirectory: string
    attempt: number
    invocationId: string
  }>
): Promise<ReservedInvocationAttemptDirectory> => {
  if (!Number.isSafeInteger(options.attempt) || options.attempt < 1) {
    throw CLIUsageError('Invocation attempt number must be a positive safe integer.')
  }
  if (!SAFE_INVOCATION_ID.test(options.invocationId)) {
    throw CLIUsageError('Invocation ID must be an opaque path-safe identifier.')
  }

  const attemptsDirectory = normalizeSafeRelativePath(
    options.attemptsDirectory,
    'Invocation attempts directory',
    false
  )
  const parent = await ensureSafeArtifactDirectory(rootDir, attemptsDirectory)
  const directoryName = `attempt-${String(options.attempt).padStart(3, '0')}-${options.invocationId}`
  const relativePath = `${attemptsDirectory}/${directoryName}`
  const path = join(parent.path, directoryName)
  const claimName = `.attempt-${String(options.attempt).padStart(3, '0')}.claim`
  const claimRelativePath = `${attemptsDirectory}/${claimName}`
  const claimPath = join(parent.path, claimName)
  const claimToken = crypto.randomUUID()
  const claimOwnerName = `owner-${claimToken}.lock`
  const claimOwnerRelativePath = `${claimRelativePath}/${claimOwnerName}`
  const claimOwnerPath = join(claimPath, claimOwnerName)
  const claimBytes = Buffer.from(`${options.invocationId}\n${claimToken}\n`)
  let claimOwnerCreated = false

  try {
    await mkdir(claimPath, { mode: DIRECTORY_MODE })
  } catch (error) {
    if (hasErrorCode(error, 'EEXIST')) {
      throw new ArtifactReservationConflictError(relativePath)
    }
    throw error
  }

  const releaseOwnedClaim = async (): Promise<void> => {
    if (claimOwnerCreated) {
      const owner = await readExistingImmutableBytes(claimOwnerPath)
      if (!owner.equals(claimBytes)) {
        throw CLIUsageError(`Invocation attempt claim owner changed unexpectedly: ${claimRelativePath}`)
      }
      await unlink(claimOwnerPath)
      claimOwnerCreated = false
    }
    await rmdir(claimPath)
  }

  try {
    const owner = await writeImmutableArtifactFile(rootDir, claimOwnerRelativePath, claimBytes)
    if (!owner.created) {
      throw CLIUsageError(`Invocation attempt claim was not created exclusively: ${claimRelativePath}`)
    }
    claimOwnerCreated = true
    await mkdir(path, { mode: DIRECTORY_MODE })
    await inspectSafeDirectory((await inspectSafeRoot(rootDir)).canonical, path, 'Invocation attempt directory')
  } catch (error) {
    await releaseOwnedClaim().catch(() => undefined)
    if (hasErrorCode(error, 'EEXIST')) {
      throw new ArtifactReservationConflictError(relativePath)
    }
    throw error
  }

  let releasePromise: Promise<void> | undefined
  const release = (): Promise<void> => {
    releasePromise ??= releaseOwnedClaim()
    return releasePromise
  }

  return {
    path,
    relativePath,
    attempt: options.attempt,
    invocationId: options.invocationId,
    claimRelativePath,
    release
  }
}
