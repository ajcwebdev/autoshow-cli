import { mkdir, readdir, rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReservedInvocationAttemptDirectory } from '~/types'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import { AppInfrastructureError, UsageError, hasErrorCode } from '~/utils/error-handler'
import { ensureSafeArtifactDirectory, readContainedArtifactFile, readExistingImmutableBytes, writeImmutableArtifactFile } from './safe-artifact-files'
import { DIRECTORY_MODE, inspectCreatedSafeDirectory, inspectExistingSafeArtifactDirectory, inspectSafeRoot, normalizeSafeRelativePath } from './safe-artifact-validation'

const SAFE_INVOCATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/

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

export const releasePreparedInvocationAttemptClaim = async (
  rootDir: string,
  options: Readonly<{
    attemptsDirectory: string
    attempt: number
    invocationId: string
  }>
): Promise<void> => {
  if (!Number.isSafeInteger(options.attempt) || options.attempt < 1) {
    throw UsageError('Invocation attempt number must be a positive safe integer.')
  }
  if (!SAFE_INVOCATION_ID.test(options.invocationId)) {
    throw UsageError('Invocation ID must be an opaque path-safe identifier.')
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
    throw UsageError(`Invocation attempt claim has no unique immutable owner: ${claimRelativePath}`)
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
    throw UsageError(`Invocation attempt claim belongs to a different immutable invocation: ${claimRelativePath}`)
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
    throw UsageError('Invocation attempt number must be a positive safe integer.')
  }
  if (!SAFE_INVOCATION_ID.test(options.invocationId)) {
    throw UsageError('Invocation ID must be an opaque path-safe identifier.')
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
        throw UsageError(`Invocation attempt claim owner changed unexpectedly: ${claimRelativePath}`)
      }
      await unlink(claimOwnerPath)
      claimOwnerCreated = false
    }
    await rmdir(claimPath)
  }

  try {
    const owner = await writeImmutableArtifactFile(rootDir, claimOwnerRelativePath, claimBytes)
    if (!owner.created) {
      throw UsageError(`Invocation attempt claim was not created exclusively: ${claimRelativePath}`)
    }
    claimOwnerCreated = true
    await mkdir(path, { mode: DIRECTORY_MODE })
    await inspectCreatedSafeDirectory((await inspectSafeRoot(rootDir)).canonical, path, 'Invocation attempt directory')
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
