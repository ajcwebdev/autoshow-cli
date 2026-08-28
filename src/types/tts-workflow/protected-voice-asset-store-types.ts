import type { ProtectedAssetRef, ProtectedVoiceAssetPolicy, TtsCliReferenceInput, VoiceConsentRevocation } from '~/types'

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
  ingestManaged?: ((input: TtsCliReferenceInput, policy: ProtectedVoiceAssetPolicy, expected?: ProtectedAssetRef | undefined) => Promise<MaterializedProtectedVoiceAsset>) | undefined
  storeBytes?: ((bytes: Uint8Array, policy: ProtectedVoiceAssetPolicy, expectedSha256?: string | undefined) => Promise<ProtectedAssetRef>) | undefined
  resolve: (asset: ProtectedAssetRef) => Promise<string>
  readPolicies?: ((asset: ProtectedAssetRef) => Promise<ProtectedVoiceAssetPolicy[]>) | undefined
  recordConsentRevocation?: ((asset: ProtectedAssetRef, revocation: VoiceConsentRevocation) => Promise<void>) | undefined
  readConsentRevocations?: ((asset: ProtectedAssetRef) => Promise<VoiceConsentRevocation[]>) | undefined
  withWorkspace?: (<T>(attemptId: string, run: (workspace: string) => Promise<T>) => Promise<T>) | undefined
}

export type ReadReferenceInput = {
  bytes: Uint8Array
  byteLength: number
  sha256: string
}

export type ReadyStore = {
  canonicalStoreRoot: string
  canonicalAssetsRoot: string
  canonicalPoliciesRoot: string
  canonicalWorkRoot: string
}
