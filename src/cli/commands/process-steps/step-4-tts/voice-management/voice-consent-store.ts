import type { AuditActorRef, ProtectedAssetRef, ProtectedVoiceAssetPolicy, ProtectedVoiceAssetStore, VoiceConsentRecord, VoiceConsentRevocation } from '~/types'
import { CLIUsageError, ValidationError } from '~/utils/error-handler'
import { canonicalTtsJson, hashCanonicalRecordWithout } from '../script-to-audio/contract-identity'
import { validateAuditActorRef, validateVoiceConsentRecord } from './voice-management-contracts'

const CONSENT_REF_PREFIX = 'protected-consent:v1:'

const encodeVoiceConsentRecordRef = (asset: ProtectedAssetRef): string =>
  `${CONSENT_REF_PREFIX}${asset.storeId}:${asset.assetId}:${asset.sha256}`

const parseVoiceConsentRecordRef = (value: string): ProtectedAssetRef => {
  const parts = value.split(':')
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}:` !== CONSENT_REF_PREFIX) throw CLIUsageError('Consent record reference is not a protected consent v1 locator.')
  const [, , storeId, assetId, sha256] = parts
  if (!storeId || !assetId || !sha256) throw CLIUsageError('Consent record reference is incomplete.')
  return { storeId, assetId, sha256 }
}

export const storeVoiceConsentRecord = async (
  store: ProtectedVoiceAssetStore,
  record: VoiceConsentRecord
): Promise<string> => {
  validateVoiceConsentRecord(record)
  if (!store.storeBytes) throw CLIUsageError('Registered protected store does not support managed consent records.')
  const policy: ProtectedVoiceAssetPolicy = {
    schemaVersion: 1,
    purpose: 'consent-evidence',
    authorizationRef: `voice-consent-record:${record.consentRecordId}`,
    retention: { mode: 'retain-until-revoked', obligationRef: record.provenanceRef },
    createdAt: record.recordedAt
  }
  const asset = await store.storeBytes(Buffer.from(`${canonicalTtsJson(record)}\n`, 'utf8'), policy)
  return encodeVoiceConsentRecordRef(asset)
}

const loadVoiceConsentRecordBytes = async (
  store: ProtectedVoiceAssetStore,
  reference: string
): Promise<{ asset: ProtectedAssetRef, record: VoiceConsentRecord }> => {
  const asset = parseVoiceConsentRecordRef(reference)
  const path = await store.resolve(asset)
  let record: VoiceConsentRecord
  try {
    record = JSON.parse(await Bun.file(path).text()) as VoiceConsentRecord
  } catch (error) {
    throw ValidationError('Protected consent record contains invalid JSON.', { stage: 'voice:consent', ...(error instanceof Error ? { cause: error } : {}) })
  }
  return { asset, record: validateVoiceConsentRecord(record) }
}

export const loadVoiceConsentRecord = async (
  store: ProtectedVoiceAssetStore,
  reference: string
): Promise<VoiceConsentRecord> => {
  const { asset, record } = await loadVoiceConsentRecordBytes(store, reference)
  const revocations = store.readConsentRevocations ? await store.readConsentRevocations(asset) : []
  if (revocations.length > 0) throw CLIUsageError(`Voice consent record ${record.consentRecordId} is revoked; all consent-gated actions are denied.`)
  return record
}

export const revokeVoiceConsentRecord = async (input: {
  store: ProtectedVoiceAssetStore
  reference: string
  reason: string
  revokedBy: AuditActorRef
  revokedAt?: string | undefined
}): Promise<VoiceConsentRevocation> => {
  if (!input.store.recordConsentRevocation) throw CLIUsageError('Registered protected store does not support consent revocation markers.')
  if (!input.reason.trim()) throw CLIUsageError('Consent revocation requires a reason.')
  validateAuditActorRef(input.revokedBy)
  const { asset, record } = await loadVoiceConsentRecordBytes(input.store, input.reference)
  const withoutId = {
    schemaVersion: 1 as const,
    consentRecordId: record.consentRecordId,
    revokedAt: input.revokedAt ?? new Date().toISOString(),
    reason: input.reason.trim(),
    revokedBy: input.revokedBy
  }
  const revocation: VoiceConsentRevocation = { ...withoutId, revocationId: hashCanonicalRecordWithout(withoutId, []) }
  await input.store.recordConsentRevocation(asset, revocation)
  return revocation
}
