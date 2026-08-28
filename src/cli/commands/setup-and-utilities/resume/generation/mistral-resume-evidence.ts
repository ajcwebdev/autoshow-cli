import { validateProviderVoiceRef } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { UsageError } from '~/utils/error-handler'
import type { PipelineProviderState, ProtectedAssetRef, ProtectedVoiceAssetStore, ProviderVoiceRef } from '~/types'
import { readRetainedTtsResolvedVoices } from './tts-resume-source-context'

export const sameProtectedAsset = (left: ProtectedAssetRef, right: ProtectedAssetRef): boolean => (
  left.storeId === right.storeId
  && left.assetId === right.assetId
  && left.sha256 === right.sha256
)

export const protectedReferenceVoice = (
  voice: ProviderVoiceRef
): Extract<ProviderVoiceRef, { kind: 'reference-asset' }> | undefined => {
  const validated = validateProviderVoiceRef(voice)
  if (validated.provider !== 'mistral') {
    throw UsageError('Stored Mistral resume voice evidence names a different provider. Rebuild this output before resuming it.')
  }
  if (validated.kind !== 'reference-asset') return undefined
  if (
    validated.origin !== 'request-reference-audio'
    || validated.authorizationRef !== MISTRAL_CLI_REFERENCE_AUTHORIZATION
  ) {
    throw UsageError('Stored Mistral reference voice evidence lacks the exact request authorization. Rebuild this output before resuming it.')
  }
  return validated
}

export const loadMistralResumeEvidence = async (
  rootDir: string,
  state: PipelineProviderState,
  protectedStore: ProtectedVoiceAssetStore
) => {
  const voices = await readRetainedTtsResolvedVoices(rootDir, state)
  const references = voices.flatMap((voice) => {
    const reference = protectedReferenceVoice(voice)
    return reference ? [reference] : []
  })
  const uniqueAssets = references
    .map((entry) => entry.protectedAsset)
    .filter((asset, index, assets) => assets.findIndex((candidate) => sameProtectedAsset(candidate, asset)) === index)
  for (const asset of uniqueAssets) {
    try {
      await protectedStore.resolve(asset)
    } catch {
      throw UsageError(
        `Stored protected Mistral reference ${asset.assetId} is missing or fails its content checksum. Restore the exact owner-only protected asset before recovery; interrupted reference synthesis cannot be redispatched by resume.`
      )
    }
  }
  return { voices, references, uniqueAssets }
}

export const materializedSpeakerBinding = (
  entries: Array<{ speakerKey: string, protectedAsset: ProtectedAssetRef }>,
  store: ProtectedVoiceAssetStore
) => ({
  materialization: 'materialized' as const,
  entries: entries.map((entry) => ({
    ...entry,
    sourceExtension: '',
    resolve: async () => await store.resolve(entry.protectedAsset)
  }))
})
