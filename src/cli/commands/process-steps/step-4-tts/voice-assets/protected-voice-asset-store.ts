import { constants } from 'node:fs'
import { chmod, link, lstat, mkdir, open, readFile, realpath, rm, unlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import type { MaterializedProtectedVoiceAsset, PlannedProtectedVoiceAsset, ProtectedAssetRef, ProtectedVoiceAssetPolicy, ProtectedVoiceAssetStore, ProtectedVoiceAssetStoreConfig, ReadReferenceInput, ReadyStore, TtsCliReferenceInput, VoiceConsentRevocation } from '~/types'
import { AppValidationError, hasErrorCode, ValidationError } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalRecordWithout, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { isContainedPath } from '~/utils/filesystem'

const SAFE_OPAQUE_ID = /^[a-z0-9][a-z0-9_-]{0,127}$/
const SHA256 = /^[a-f0-9]{64}$/
const DIRECTORY_MODE = 0o700
const FILE_MODE = 0o600

export const assertSafeProtectedVoiceOpaqueId = (value: string, label: string): void => {
  if (!SAFE_OPAQUE_ID.test(value)) {
    throw ValidationError(`${label} must be an opaque lowercase identifier containing only letters, numbers, underscores, or hyphens.`, { stage: 'tts:protected-assets' })
  }
}

const assertSha256 = (value: string): void => {
  if (!SHA256.test(value)) {
    throw ValidationError('Protected asset checksum must be a lowercase SHA-256 digest.', { stage: 'tts:protected-assets' })
  }
}

export const assertValidProtectedAssetRef = (asset: ProtectedAssetRef): ProtectedAssetRef => {
  assertSafeProtectedVoiceOpaqueId(asset.storeId, 'Protected asset store ID')
  assertSafeProtectedVoiceOpaqueId(asset.assetId, 'Protected asset ID')
  assertSha256(asset.sha256)
  if (asset.assetId !== assetIdForSha256(asset.sha256)) {
    throw ValidationError('Protected asset ID does not match its checksum.', { stage: 'tts:protected-assets' })
  }
  return asset
}

const assetIdForSha256 = (sha256: string): string => `sha256_${sha256}`

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
    throw ValidationError('Unable to inspect the protected asset store.', {
      stage: 'tts:protected-assets',
      ...(error instanceof Error ? { cause: error } : {})
    })
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
  } catch (error) {
    // The message stays deliberately non-specific (it must not leak the protected path),
    // but the underlying fs error is preserved as the cause so diagnostics can see it.
    throw ValidationError(`Unable to prepare ${label.toLowerCase()}.`, {
      stage: 'tts:protected-assets',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }

  const after = await lstatIfPresent(path)
  if (!after?.isDirectory() || after.isSymbolicLink()) {
    throw ValidationError(`${label} must remain a real directory.`, { stage: 'tts:protected-assets' })
  }
  assertOwnerOnlyMode(after.mode, DIRECTORY_MODE, label)
}

const prepareStore = async (config: ProtectedVoiceAssetStoreConfig): Promise<ReadyStore> => {
  assertSafeProtectedVoiceOpaqueId(config.storeId, 'Protected store ID')
  const storeRoot = resolve(config.root)
  await prepareOwnerOnlyDirectory(storeRoot, 'Protected store root')
  const canonicalStoreRoot = await canonicalizeStorePath(storeRoot, 'Protected store root')

  const prepareChild = async (name: string, label: string): Promise<string> => {
    const path = join(storeRoot, name)
    if (!isContainedPath(storeRoot, path)) {
      throw ValidationError(`${label} escapes its registered store root.`, { stage: 'tts:protected-assets' })
    }
    await prepareOwnerOnlyDirectory(path, label)
    const canonical = await canonicalizeStorePath(path, label)
    if (!isContainedPath(canonicalStoreRoot, canonical)) {
      throw ValidationError(`${label} escapes its canonical store root.`, { stage: 'tts:protected-assets' })
    }
    return canonical
  }

  return {
    canonicalStoreRoot,
    canonicalAssetsRoot: await prepareChild('assets', 'Protected asset directory'),
    canonicalPoliciesRoot: await prepareChild('policies', 'Protected asset policy directory'),
    canonicalWorkRoot: await prepareChild('work', 'Protected asset work directory')
  }
}

const inspectStore = async (config: ProtectedVoiceAssetStoreConfig): Promise<ReadyStore> => {
  assertSafeProtectedVoiceOpaqueId(config.storeId, 'Protected store ID')
  const storeRoot = resolve(config.root)
  const storeEntry = await lstatIfPresent(storeRoot)
  if (!storeEntry?.isDirectory() || storeEntry.isSymbolicLink()) {
    throw ValidationError('Protected store root is missing or is not a real directory.', { stage: 'tts:protected-assets' })
  }
  assertOwnerOnlyMode(storeEntry.mode, DIRECTORY_MODE, 'Protected store root')
  const canonicalStoreRoot = await canonicalizeStorePath(storeRoot, 'Protected store root')

  const inspectChild = async (name: string, label: string): Promise<string> => {
    const path = join(storeRoot, name)
    const entry = await lstatIfPresent(path)
    if (!entry?.isDirectory() || entry.isSymbolicLink()) {
      throw ValidationError(`${label} is missing or is not a real directory.`, { stage: 'tts:protected-assets' })
    }
    assertOwnerOnlyMode(entry.mode, DIRECTORY_MODE, label)
    const canonical = await canonicalizeStorePath(path, label)
    if (!isContainedPath(canonicalStoreRoot, canonical)) {
      throw ValidationError(`${label} escapes its canonical store root.`, { stage: 'tts:protected-assets' })
    }
    return canonical
  }
  return {
    canonicalStoreRoot,
    canonicalAssetsRoot: await inspectChild('assets', 'Protected asset directory'),
    canonicalPoliciesRoot: await inspectChild('policies', 'Protected asset policy directory'),
    canonicalWorkRoot: await inspectChild('work', 'Protected asset work directory')
  }
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
    throw ValidationError('Unable to read the authorized reference audio.', {
      stage: 'tts:protected-assets',
      ...(error instanceof Error ? { cause: error } : {})
    })
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
  assertSafeProtectedVoiceOpaqueId(storeId, 'Protected store ID')
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
        throw ValidationError('Unable to atomically promote the protected asset.', {
      stage: 'tts:protected-assets',
      ...(error instanceof Error ? { cause: error } : {})
    })
      }
    }
  } catch (error) {
    if (error instanceof AppValidationError) throw error
    throw ValidationError('Unable to write the protected asset.', {
      stage: 'tts:protected-assets',
      ...(error instanceof Error ? { cause: error } : {})
    })
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
  assertSafeProtectedVoiceOpaqueId(config.storeId, 'Protected store ID')
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

const validateProtectedVoiceAssetPolicy = (policy: ProtectedVoiceAssetPolicy): void => {
  if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) throw ValidationError('Protected voice asset policy must be an object.', { stage: 'tts:protected-assets' })
  const allowedKeys = new Set(['schemaVersion', 'purpose', 'authorizationRef', 'retention', 'consentRecordRef', 'createdAt'])
  const unknownKeys = Object.keys(policy).filter(key => !allowedKeys.has(key))
  if (unknownKeys.length > 0) throw ValidationError(`Protected voice asset policy contains unsupported field(s): ${unknownKeys.join(', ')}.`, { stage: 'tts:protected-assets' })
  if (!['reference-audio', 'candidate-preview', 'audition-audio', 'consent-evidence', 'reconciliation-evidence'].includes(policy.purpose)) {
    throw ValidationError('Protected voice asset policy has an unsupported purpose.', { stage: 'tts:protected-assets' })
  }
  if (typeof policy.retention !== 'object' || policy.retention === null || Array.isArray(policy.retention)) throw ValidationError('Protected voice asset retention policy must be an object.', { stage: 'tts:protected-assets' })
  const retentionKeys = new Set(['mode', 'expiresAt', 'obligationRef'])
  const unknownRetentionKeys = Object.keys(policy.retention).filter(key => !retentionKeys.has(key))
  if (unknownRetentionKeys.length > 0 || !['retain-until', 'retain-until-revoked', 'delete-after-operation'].includes(policy.retention.mode)) {
    throw ValidationError('Protected voice asset policy has an unsupported retention policy.', { stage: 'tts:protected-assets' })
  }
  if (policy.schemaVersion !== 1 || !policy.authorizationRef.trim() || Number.isNaN(Date.parse(policy.createdAt))) {
    throw ValidationError('Protected voice asset policy requires schemaVersion 1, authorization, and a valid creation time.', { stage: 'tts:protected-assets' })
  }
  if (policy.retention.mode === 'retain-until') {
    if (!policy.retention.expiresAt || Number.isNaN(Date.parse(policy.retention.expiresAt)) || Date.parse(policy.retention.expiresAt) <= Date.parse(policy.createdAt)) {
      throw ValidationError('Protected voice asset retain-until policy requires an expiry after creation.', { stage: 'tts:protected-assets' })
    }
  } else if (policy.retention.expiresAt !== undefined) {
    throw ValidationError('Protected voice asset expiry is valid only for retain-until policy.', { stage: 'tts:protected-assets' })
  }
}

const writePolicy = async (
  canonicalPoliciesRoot: string,
  asset: ProtectedAssetRef,
  policy: ProtectedVoiceAssetPolicy
): Promise<void> => {
  validateProtectedVoiceAssetPolicy(policy)
  const assetPolicyRoot = join(canonicalPoliciesRoot, asset.assetId)
  await prepareOwnerOnlyDirectory(assetPolicyRoot, 'Protected asset policy set')
  const canonicalPolicyRoot = await canonicalizeStorePath(assetPolicyRoot, 'Protected asset policy set')
  if (!isContainedPath(canonicalPoliciesRoot, canonicalPolicyRoot)) {
    throw ValidationError('Protected asset policy set escapes its registered store.', { stage: 'tts:protected-assets' })
  }
  const policyHash = hashCanonicalTtsValue(policy)
  const destination = join(canonicalPolicyRoot, `${policyHash}.json`)
  const bytes = `${canonicalTtsJson(policy)}\n`
  const temporary = join(canonicalPolicyRoot, `.policy-${randomUUID()}`)
  try {
    const handle = await open(temporary, 'wx', FILE_MODE)
    try {
      await handle.writeFile(bytes)
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await link(temporary, destination)
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) throw error
      const existing = await readFile(destination, 'utf8')
      if (existing !== bytes) {
        throw ValidationError('Protected asset policy identity conflicts with existing bytes.', {
      stage: 'tts:protected-assets',
      ...(error instanceof Error ? { cause: error } : {})
    })
      }
    }
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
}

export const ingestManagedProtectedVoiceAsset = async (
  config: ProtectedVoiceAssetStoreConfig,
  input: TtsCliReferenceInput,
  policy: ProtectedVoiceAssetPolicy,
  expected?: ProtectedAssetRef | undefined
): Promise<MaterializedProtectedVoiceAsset> => {
  if (policy.authorizationRef !== input.authorizationRef.trim()) {
    throw ValidationError('Protected asset policy authorization must match the ingestion authorization.', { stage: 'tts:protected-assets' })
  }
  const planned = await planProtectedVoiceAsset(config.storeId, input)
  if (expected && canonicalTtsJson(expected) !== canonicalTtsJson(planned.protectedAsset)) {
    throw ValidationError('Authorized reference audio changed after protected planning; no asset was ingested.', { stage: 'tts:protected-assets' })
  }
  const { canonicalPoliciesRoot } = await prepareStore(config)
  // Persist policy authority before sensitive bytes. A crash can leave an harmless orphan policy,
  // but never a newly managed asset with no retention/authorization record.
  await writePolicy(canonicalPoliciesRoot, planned.protectedAsset, policy)
  const materialized = await ingestProtectedVoiceAsset(config, input, planned.protectedAsset)
  return materialized
}

export const storeManagedProtectedVoiceBytes = async (
  config: ProtectedVoiceAssetStoreConfig,
  bytes: Uint8Array,
  policy: ProtectedVoiceAssetPolicy,
  expectedSha256?: string | undefined
): Promise<ProtectedAssetRef> => {
  if (bytes.byteLength === 0) throw ValidationError('Protected voice asset cannot be empty.', { stage: 'tts:protected-assets' })
  validateProtectedVoiceAssetPolicy(policy)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (expectedSha256 !== undefined && expectedSha256 !== sha256) {
    throw ValidationError('Protected voice asset bytes do not match the expected checksum.', { stage: 'tts:protected-assets' })
  }
  const asset: ProtectedAssetRef = { storeId: config.storeId, assetId: assetIdForSha256(sha256), sha256 }
  const ready = await prepareStore(config)
  await writePolicy(ready.canonicalPoliciesRoot, asset, policy)
  await atomicallyStoreBytes(ready.canonicalAssetsRoot, asset, bytes)
  return asset
}

export const readProtectedVoiceAssetPolicies = async (
  config: ProtectedVoiceAssetStoreConfig,
  asset: ProtectedAssetRef
): Promise<ProtectedVoiceAssetPolicy[]> => {
  await resolveProtectedVoiceAsset(config, asset)
  const { canonicalPoliciesRoot } = await inspectStore(config)
  const policyRoot = join(canonicalPoliciesRoot, asset.assetId)
  const entry = await lstatIfPresent(policyRoot)
  if (!entry) return []
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw ValidationError('Protected asset policy set is not a real directory.', { stage: 'tts:protected-assets' })
  }
  const files = Array.from(new Bun.Glob('*.json').scanSync({ cwd: policyRoot, onlyFiles: true })).sort()
  const policies: ProtectedVoiceAssetPolicy[] = []
  for (const file of files) {
    if (file.startsWith('consent-revocation-')) continue
    const path = join(policyRoot, file)
    const stat = await lstatIfPresent(path)
    if (!stat?.isFile() || stat.isSymbolicLink()) throw ValidationError('Protected asset policy must be a regular file.', { stage: 'tts:protected-assets' })
    assertOwnerOnlyMode(stat.mode, FILE_MODE, 'Protected asset policy')
    let policy: ProtectedVoiceAssetPolicy
    try {
      policy = JSON.parse(await readFile(path, 'utf8')) as ProtectedVoiceAssetPolicy
    } catch {
      throw ValidationError('Protected asset policy contains invalid JSON.', { stage: 'tts:protected-assets' })
    }
    validateProtectedVoiceAssetPolicy(policy)
    if (`${hashCanonicalTtsValue(policy)}.json` !== file) {
      throw ValidationError('Protected asset policy file does not match its content identity.', { stage: 'tts:protected-assets' })
    }
    policies.push(policy)
  }
  return policies
}

const validateConsentRevocation = (revocation: VoiceConsentRevocation): void => {
  if (typeof revocation !== 'object' || revocation === null || Array.isArray(revocation)) throw ValidationError('Consent revocation must be an object.', { stage: 'tts:protected-assets' })
  const allowed = new Set(['schemaVersion', 'revocationId', 'consentRecordId', 'revokedAt', 'reason', 'revokedBy'])
  if (Object.keys(revocation).some(key => !allowed.has(key))
    || revocation.schemaVersion !== 1
    || !SHA256.test(revocation.revocationId)
    || !SHA256.test(revocation.consentRecordId)
    || Number.isNaN(Date.parse(revocation.revokedAt))
    || !revocation.reason.trim()
    || hashCanonicalRecordWithout(revocation as unknown as Record<string, unknown>, ['revocationId']) !== revocation.revocationId) {
    throw ValidationError('Consent revocation has an invalid schema or content identity.', { stage: 'tts:protected-assets' })
  }
  const actor = revocation.revokedBy
  if (!actor || !['local-user', 'project-role', 'automation'].includes(actor.namespace) || !SAFE_OPAQUE_ID.test(actor.actorId) || Object.keys(actor).some(key => !['namespace', 'actorId'].includes(key))) {
    throw ValidationError('Consent revocation requires an opaque audit actor.', { stage: 'tts:protected-assets' })
  }
}

export const readProtectedVoiceConsentRevocations = async (
  config: ProtectedVoiceAssetStoreConfig,
  asset: ProtectedAssetRef
): Promise<VoiceConsentRevocation[]> => {
  await resolveProtectedVoiceAsset(config, asset)
  const { canonicalPoliciesRoot } = await inspectStore(config)
  const policyRoot = join(canonicalPoliciesRoot, asset.assetId)
  const entry = await lstatIfPresent(policyRoot)
  if (!entry) return []
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw ValidationError('Protected consent revocation set is not a real directory.', { stage: 'tts:protected-assets' })
  const files = Array.from(new Bun.Glob('consent-revocation-*.json').scanSync({ cwd: policyRoot, onlyFiles: true })).sort()
  const revocations: VoiceConsentRevocation[] = []
  for (const file of files) {
    const path = join(policyRoot, file)
    const stat = await lstatIfPresent(path)
    if (!stat?.isFile() || stat.isSymbolicLink()) throw ValidationError('Protected consent revocation must be a regular file.', { stage: 'tts:protected-assets' })
    assertOwnerOnlyMode(stat.mode, FILE_MODE, 'Protected consent revocation')
    let revocation: VoiceConsentRevocation
    try {
      revocation = JSON.parse(await readFile(path, 'utf8')) as VoiceConsentRevocation
    } catch {
      throw ValidationError('Protected consent revocation contains invalid JSON.', { stage: 'tts:protected-assets' })
    }
    validateConsentRevocation(revocation)
    if (`consent-revocation-${revocation.revocationId}.json` !== file) throw ValidationError('Protected consent revocation filename does not match its content identity.', { stage: 'tts:protected-assets' })
    revocations.push(revocation)
  }
  if (revocations.length > 1) throw ValidationError('Protected consent record has conflicting revocation markers.', { stage: 'tts:protected-assets' })
  return revocations
}

export const recordProtectedVoiceConsentRevocation = async (
  config: ProtectedVoiceAssetStoreConfig,
  asset: ProtectedAssetRef,
  revocation: VoiceConsentRevocation
): Promise<void> => {
  validateConsentRevocation(revocation)
  await resolveProtectedVoiceAsset(config, asset)
  const { canonicalPoliciesRoot } = await inspectStore(config)
  const policyRoot = join(canonicalPoliciesRoot, asset.assetId)
  await prepareOwnerOnlyDirectory(policyRoot, 'Protected asset policy set')
  const existing = await readProtectedVoiceConsentRevocations(config, asset)
  if (existing.length === 1) {
    if (canonicalTtsJson(existing[0]) === canonicalTtsJson(revocation)) return
    throw ValidationError('Protected consent record already has a different revocation marker.', { stage: 'tts:protected-assets' })
  }
  const destination = join(policyRoot, `consent-revocation-${revocation.revocationId}.json`)
  const temporary = join(policyRoot, `.consent-revocation-${randomUUID()}`)
  const bytes = `${canonicalTtsJson(revocation)}\n`
  try {
    const handle = await open(temporary, 'wx', FILE_MODE)
    try {
      await handle.writeFile(bytes)
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await link(temporary, destination)
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST') || await readFile(destination, 'utf8') !== bytes) throw error
    }
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
  await readProtectedVoiceConsentRevocations(config, asset)
}

export const withProtectedVoiceWorkspace = async <T>(
  config: ProtectedVoiceAssetStoreConfig,
  attemptId: string,
  run: (workspace: string) => Promise<T>
): Promise<T> => {
  assertSafeProtectedVoiceOpaqueId(attemptId, 'Protected work attempt ID')
  const { canonicalWorkRoot } = await prepareStore(config)
  const workspace = join(canonicalWorkRoot, attemptId)
  const existing = await lstatIfPresent(workspace)
  if (existing) throw ValidationError('Protected work attempt already exists.', { stage: 'tts:protected-assets' })
  await prepareOwnerOnlyDirectory(workspace, 'Protected voice workspace')
  try {
    return await run(workspace)
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
}

export const resolveProtectedVoiceAsset = async (
  config: ProtectedVoiceAssetStoreConfig,
  asset: ProtectedAssetRef
): Promise<string> => {
  assertSafeProtectedVoiceOpaqueId(config.storeId, 'Protected store ID')
  assertValidProtectedAssetRef(asset)
  if (asset.storeId !== config.storeId) {
    throw ValidationError('Protected asset belongs to a different registered store.', { stage: 'tts:protected-assets' })
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
  ingestManaged: (input, policy, expected) => ingestManagedProtectedVoiceAsset(config, input, policy, expected),
  storeBytes: (bytes, policy, expectedSha256) => storeManagedProtectedVoiceBytes(config, bytes, policy, expectedSha256),
  resolve: asset => resolveProtectedVoiceAsset(config, asset),
  readPolicies: asset => readProtectedVoiceAssetPolicies(config, asset),
  recordConsentRevocation: (asset, revocation) => recordProtectedVoiceConsentRevocation(config, asset, revocation),
  readConsentRevocations: asset => readProtectedVoiceConsentRevocations(config, asset),
  withWorkspace: (attemptId, run) => withProtectedVoiceWorkspace(config, attemptId, run)
})

export class ProtectedVoiceAssetStoreRegistry {
  readonly #stores = new Map<string, ProtectedVoiceAssetStore>()

  register(config: ProtectedVoiceAssetStoreConfig): ProtectedVoiceAssetStore {
    assertSafeProtectedVoiceOpaqueId(config.storeId, 'Protected store ID')
    if (this.#stores.has(config.storeId)) {
      throw ValidationError(`Protected store ${config.storeId} is already registered.`, { stage: 'tts:protected-assets' })
    }
    const store = createProtectedVoiceAssetStore(config)
    this.#stores.set(config.storeId, store)
    return store
  }

  require(storeId: string): ProtectedVoiceAssetStore {
    assertSafeProtectedVoiceOpaqueId(storeId, 'Protected store ID')
    const store = this.#stores.get(storeId)
    if (!store) throw ValidationError(`Protected store ${storeId} is not registered.`, { stage: 'tts:protected-assets' })
    return store
  }

  async resolve(asset: ProtectedAssetRef): Promise<string> {
    assertValidProtectedAssetRef(asset)
    return await this.require(asset.storeId).resolve(asset)
  }

  roots(): string[] {
    return [...this.#stores.values()].flatMap(store => store.root ? [store.root] : [])
  }
}
