import { constants } from 'node:fs'
import { chmod, link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { ProtectedAssetRef, TtsCliReferenceInput } from '~/types'
import { AppValidationError, ValidationError } from '~/utils/error-handler'

const SAFE_OPAQUE_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/
const SHA256 = /^[a-f0-9]{64}$/
const DIRECTORY_MODE = 0o700
const FILE_MODE = 0o600

export type ProtectedVoiceAssetStoreConfig = {
  storeId: string
  root: string
}

export type PlannedProtectedVoiceAsset = {
  materialization: 'non-materialized'
  protectedAsset: ProtectedAssetRef
  authorizationRef: string
  byteLength: number
  speakerKey?: string | undefined
}

export type MaterializedProtectedVoiceAsset = {
  materialization: 'materialized'
  protectedAsset: ProtectedAssetRef
  authorizationRef: string
  byteLength: number
  speakerKey?: string | undefined
}

export type ProtectedVoiceAssetStore = {
  root?: string | undefined
  plan: (input: TtsCliReferenceInput) => Promise<PlannedProtectedVoiceAsset>
  ingest: (input: TtsCliReferenceInput, expected?: ProtectedAssetRef | undefined) => Promise<MaterializedProtectedVoiceAsset>
  resolve: (asset: ProtectedAssetRef) => Promise<string>
}

type ReadReferenceInput = {
  bytes: Uint8Array
  byteLength: number
  sha256: string
}

type ReadyStore = {
  canonicalAssetsRoot: string
}

const hasErrorCode = (error: unknown, code: string): boolean =>
  typeof error === 'object'
  && error !== null
  && 'code' in error
  && (error as { code?: unknown }).code === code

const assertSafeOpaqueId = (value: string, label: string): void => {
  if (!SAFE_OPAQUE_ID.test(value)) {
    throw ValidationError(`${label} must be an opaque lowercase identifier containing only letters, numbers, underscores, or hyphens.`, { stage: 'tts:protected-assets' })
  }
}

const assertSha256 = (value: string): void => {
  if (!SHA256.test(value)) {
    throw ValidationError('Protected asset checksum must be a lowercase SHA-256 digest.', { stage: 'tts:protected-assets' })
  }
}

const assetIdForSha256 = (sha256: string): string => `sha256_${sha256}`

const isContainedPath = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

const assertOwnerOnlyMode = (mode: number, expected: number, label: string): void => {
  if ((mode & 0o777) !== expected) {
    throw ValidationError(`${label} permissions are not owner-only.`, { stage: 'tts:protected-assets' })
  }
}

const lstatIfPresent = async (path: string) => {
  try {
    return await lstat(path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return undefined
    throw ValidationError('Unable to inspect the protected asset store.', { stage: 'tts:protected-assets' })
  }
}

const canonicalizeStorePath = async (path: string, label: string): Promise<string> => {
  try {
    return await realpath(path)
  } catch {
    throw ValidationError(`Unable to resolve ${label.toLowerCase()}.`, { stage: 'tts:protected-assets' })
  }
}

const prepareOwnerOnlyDirectory = async (path: string, label: string): Promise<void> => {
  const before = await lstatIfPresent(path)
  if (before?.isSymbolicLink()) {
    throw ValidationError(`${label} cannot be a symbolic link.`, { stage: 'tts:protected-assets' })
  }
  if (before && !before.isDirectory()) {
    throw ValidationError(`${label} must be a directory.`, { stage: 'tts:protected-assets' })
  }

  try {
    await mkdir(path, { recursive: true, mode: DIRECTORY_MODE })
    await chmod(path, DIRECTORY_MODE)
  } catch {
    throw ValidationError(`Unable to prepare ${label.toLowerCase()}.`, { stage: 'tts:protected-assets' })
  }

  const after = await lstatIfPresent(path)
  if (!after?.isDirectory() || after.isSymbolicLink()) {
    throw ValidationError(`${label} must remain a real directory.`, { stage: 'tts:protected-assets' })
  }
  assertOwnerOnlyMode(after.mode, DIRECTORY_MODE, label)
}

const prepareStore = async (config: ProtectedVoiceAssetStoreConfig): Promise<ReadyStore> => {
  assertSafeOpaqueId(config.storeId, 'Protected store ID')
  const storeRoot = resolve(config.root)
  await prepareOwnerOnlyDirectory(storeRoot, 'Protected store root')
  const canonicalStoreRoot = await canonicalizeStorePath(storeRoot, 'Protected store root')

  const assetsRoot = join(storeRoot, 'assets')
  if (!isContainedPath(storeRoot, assetsRoot)) {
    throw ValidationError('Protected asset directory escapes its registered store root.', { stage: 'tts:protected-assets' })
  }
  await prepareOwnerOnlyDirectory(assetsRoot, 'Protected asset directory')
  const canonicalAssetsRoot = await canonicalizeStorePath(assetsRoot, 'Protected asset directory')
  if (!isContainedPath(canonicalStoreRoot, canonicalAssetsRoot)) {
    throw ValidationError('Protected asset directory escapes its canonical store root.', { stage: 'tts:protected-assets' })
  }

  return { canonicalAssetsRoot }
}

const inspectStore = async (config: ProtectedVoiceAssetStoreConfig): Promise<ReadyStore> => {
  assertSafeOpaqueId(config.storeId, 'Protected store ID')
  const storeRoot = resolve(config.root)
  const storeEntry = await lstatIfPresent(storeRoot)
  if (!storeEntry?.isDirectory() || storeEntry.isSymbolicLink()) {
    throw ValidationError('Protected store root is missing or is not a real directory.', { stage: 'tts:protected-assets' })
  }
  assertOwnerOnlyMode(storeEntry.mode, DIRECTORY_MODE, 'Protected store root')
  const canonicalStoreRoot = await canonicalizeStorePath(storeRoot, 'Protected store root')

  const assetsRoot = join(storeRoot, 'assets')
  const assetsEntry = await lstatIfPresent(assetsRoot)
  if (!assetsEntry?.isDirectory() || assetsEntry.isSymbolicLink()) {
    throw ValidationError('Protected asset directory is missing or is not a real directory.', { stage: 'tts:protected-assets' })
  }
  assertOwnerOnlyMode(assetsEntry.mode, DIRECTORY_MODE, 'Protected asset directory')
  const canonicalAssetsRoot = await canonicalizeStorePath(assetsRoot, 'Protected asset directory')
  if (!isContainedPath(canonicalStoreRoot, canonicalAssetsRoot)) {
    throw ValidationError('Protected asset directory escapes its canonical store root.', { stage: 'tts:protected-assets' })
  }
  return { canonicalAssetsRoot }
}

const readAuthorizedReferenceInput = async (input: TtsCliReferenceInput): Promise<ReadReferenceInput> => {
  if (input.authorizationRef.trim().length === 0) {
    throw ValidationError('An authorization reference is required for protected reference audio.', { stage: 'tts:protected-assets' })
  }

  const sourcePath = resolve(input.sourcePath)
  let handle
  try {
    const sourceEntry = await lstat(sourcePath)
    if (sourceEntry.isSymbolicLink() || !sourceEntry.isFile()) {
      throw ValidationError('Authorized reference audio must be a regular non-symlink file.', { stage: 'tts:protected-assets' })
    }
    handle = await open(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW)
    const openedEntry = await handle.stat()
    if (!openedEntry.isFile()) {
      throw ValidationError('Authorized reference audio must be a regular file.', { stage: 'tts:protected-assets' })
    }
    const bytes = await handle.readFile()
    if (bytes.byteLength === 0) {
      throw ValidationError('Authorized reference audio cannot be empty.', { stage: 'tts:protected-assets' })
    }
    return {
      bytes,
      byteLength: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
  } catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError('Unable to read the authorized reference audio.', { stage: 'tts:protected-assets' })
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

const buildPlannedBinding = (
  storeId: string,
  input: TtsCliReferenceInput,
  source: ReadReferenceInput
): PlannedProtectedVoiceAsset => {
  const protectedAsset: ProtectedAssetRef = {
    storeId,
    assetId: assetIdForSha256(source.sha256),
    sha256: source.sha256
  }
  const speakerKey = input.speakerKey?.trim()
  return {
    materialization: 'non-materialized',
    protectedAsset,
    authorizationRef: input.authorizationRef.trim(),
    byteLength: source.byteLength,
    ...(speakerKey ? { speakerKey } : {})
  }
}

export const planProtectedVoiceAsset = async (
  storeId: string,
  input: TtsCliReferenceInput
): Promise<PlannedProtectedVoiceAsset> => {
  assertSafeOpaqueId(storeId, 'Protected store ID')
  const source = await readAuthorizedReferenceInput(input)
  return buildPlannedBinding(storeId, input, source)
}

const assertStoredAsset = async (
  canonicalAssetsRoot: string,
  assetPath: string,
  expectedSha256: string
): Promise<string> => {
  if (!isContainedPath(canonicalAssetsRoot, assetPath)) {
    throw ValidationError('Protected asset path escapes its registered store.', { stage: 'tts:protected-assets' })
  }

  const entry = await lstatIfPresent(assetPath)
  if (!entry || entry.isSymbolicLink() || !entry.isFile()) {
    throw ValidationError('Protected asset is missing or is not a regular file.', { stage: 'tts:protected-assets' })
  }
  assertOwnerOnlyMode(entry.mode, FILE_MODE, 'Protected asset')

  const canonicalAssetPath = await canonicalizeStorePath(assetPath, 'Protected asset')
  if (!isContainedPath(canonicalAssetsRoot, canonicalAssetPath)) {
    throw ValidationError('Protected asset resolves outside its registered store.', { stage: 'tts:protected-assets' })
  }

  let bytes: Buffer
  try {
    const handle = await open(canonicalAssetPath, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      bytes = await handle.readFile()
    } finally {
      await handle.close()
    }
  } catch {
    throw ValidationError('Unable to read the protected asset.', { stage: 'tts:protected-assets' })
  }
  const actualSha256 = createHash('sha256').update(bytes).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw ValidationError('Protected asset checksum does not match its content address.', { stage: 'tts:protected-assets' })
  }
  return canonicalAssetPath
}

const atomicallyStoreBytes = async (
  canonicalAssetsRoot: string,
  protectedAsset: ProtectedAssetRef,
  bytes: Uint8Array
): Promise<void> => {
  const assetPath = join(canonicalAssetsRoot, protectedAsset.assetId)
  if (!isContainedPath(canonicalAssetsRoot, assetPath)) {
    throw ValidationError('Protected asset path escapes its registered store.', { stage: 'tts:protected-assets' })
  }

  const temporaryPath = join(canonicalAssetsRoot, `.ingest-${randomUUID()}`)
  let temporaryCreated = false
  try {
    const handle = await open(temporaryPath, 'wx', FILE_MODE)
    temporaryCreated = true
    try {
      await handle.writeFile(bytes)
      await handle.sync()
      await handle.chmod(FILE_MODE)
    } finally {
      await handle.close()
    }

    try {
      await link(temporaryPath, assetPath)
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) {
        throw ValidationError('Unable to atomically promote the protected asset.', { stage: 'tts:protected-assets' })
      }
    }
  } catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError('Unable to write the protected asset.', { stage: 'tts:protected-assets' })
  } finally {
    if (temporaryCreated) await unlink(temporaryPath).catch(() => undefined)
  }

  await assertStoredAsset(canonicalAssetsRoot, assetPath, protectedAsset.sha256)
}

export const ingestProtectedVoiceAsset = async (
  config: ProtectedVoiceAssetStoreConfig,
  input: TtsCliReferenceInput,
  expected?: ProtectedAssetRef | undefined
): Promise<MaterializedProtectedVoiceAsset> => {
  assertSafeOpaqueId(config.storeId, 'Protected store ID')
  const source = await readAuthorizedReferenceInput(input)
  const planned = buildPlannedBinding(config.storeId, input, source)
  if (
    expected
    && (
      expected.storeId !== planned.protectedAsset.storeId
      || expected.assetId !== planned.protectedAsset.assetId
      || expected.sha256 !== planned.protectedAsset.sha256
    )
  ) {
    throw ValidationError('Authorized reference audio changed after protected planning; no asset was ingested.', { stage: 'tts:protected-assets' })
  }
  const { canonicalAssetsRoot } = await prepareStore(config)
  await atomicallyStoreBytes(canonicalAssetsRoot, planned.protectedAsset, source.bytes)
  return {
    ...planned,
    materialization: 'materialized'
  }
}

export const resolveProtectedVoiceAsset = async (
  config: ProtectedVoiceAssetStoreConfig,
  asset: ProtectedAssetRef
): Promise<string> => {
  assertSafeOpaqueId(config.storeId, 'Protected store ID')
  assertSafeOpaqueId(asset.storeId, 'Protected asset store ID')
  assertSafeOpaqueId(asset.assetId, 'Protected asset ID')
  assertSha256(asset.sha256)
  if (asset.storeId !== config.storeId) {
    throw ValidationError('Protected asset belongs to a different registered store.', { stage: 'tts:protected-assets' })
  }
  if (asset.assetId !== assetIdForSha256(asset.sha256)) {
    throw ValidationError('Protected asset ID does not match its checksum.', { stage: 'tts:protected-assets' })
  }

  const { canonicalAssetsRoot } = await inspectStore(config)
  return assertStoredAsset(
    canonicalAssetsRoot,
    join(canonicalAssetsRoot, asset.assetId),
    asset.sha256
  )
}

export const createProtectedVoiceAssetStore = (
  config: ProtectedVoiceAssetStoreConfig
): ProtectedVoiceAssetStore => ({
  root: resolve(config.root),
  plan: input => planProtectedVoiceAsset(config.storeId, input),
  ingest: (input, expected) => ingestProtectedVoiceAsset(config, input, expected),
  resolve: asset => resolveProtectedVoiceAsset(config, asset)
})
