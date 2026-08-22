import type { AnyCapabilityRecord, CreateReplicateAdvancedProviderOptions, TtsVoiceProvider } from '~/types'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'
import { resolveCredential } from '~/utils/validate/env-utils'

const DOCS = {
  kokoro: 'https://replicate.com/jaaari/kokoro-82m',
  predictions: 'https://replicate.com/docs/reference/http#predictions.create',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const unsupportedManagement = 'Replicate predictions are ephemeral model runs; the AutoShow adapter has no verified durable voice resource catalog or lifecycle API.'
const capabilityRecords = [
  { scope: { provider: 'replicate', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['wav'] }, documentationEvidence: evidence([DOCS.kokoro, DOCS.predictions]) },
  { scope: { provider: 'replicate', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'The adapter runs one TTS prediction per turn and does not implement a native multi-speaker request.', documentationEvidence: evidence([DOCS.predictions]) },
  { scope: { provider: 'replicate', feature: 'voice-catalog' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { paginated: false, stableResourceIds: false }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.predictions]) },
  { scope: { provider: 'replicate', feature: 'voice-design' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.predictions]) },
  { scope: { provider: 'replicate', feature: 'instant-clone' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: false }, reason: 'The supported Kokoro adapter exposes provider-stock voices only; reference-audio cloning models require a separate protected-asset contract.', documentationEvidence: evidence([DOCS.kokoro]) },
  { scope: { provider: 'replicate', feature: 'voice-delete' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { projectOwnedOnly: true }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.predictions]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const REPLICATE_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

export const createReplicateAdvancedProvider = (
  options: CreateReplicateAdvancedProviderOptions
): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = resolveCredential('replicate', 'require', { stage: 'voice:replicate', providedValue: options.apiKey, useProvidedValue: true, description: 'Replicate capability inspection' })
  return {
    provider: 'replicate',
    accountScopeHash: providerAccountScopeHash('replicate', apiKey),
    getDeclaredCapabilities: () => REPLICATE_ADVANCED_CAPABILITY_FIXTURE.records,
  }
}
