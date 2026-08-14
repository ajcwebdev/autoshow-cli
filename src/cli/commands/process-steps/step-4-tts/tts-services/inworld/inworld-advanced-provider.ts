import type { AnyCapabilityRecord, TtsVoiceProvider } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'

const DOCS = {
  synthesis: 'https://docs.inworld.ai/docs/tts/tts',
  cloning: 'https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const unsupportedManagement = 'The AutoShow Inworld adapter has no verified remote voice-management API implementation; request-time voice selection is not a durable voice resource.'
const capabilityRecords = [
  { scope: { provider: 'inworld', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['mp3'] }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'The adapter sends one voiceId per synthesis request and does not implement a native multi-speaker request.', documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'voice-catalog' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { paginated: false, stableResourceIds: false }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'voice-design' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'instant-clone' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.cloning]) },
  { scope: { provider: 'inworld', feature: 'voice-delete' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { projectOwnedOnly: true }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.cloning]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const INWORLD_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

export type CreateInworldAdvancedProviderOptions = Readonly<{ apiKey: string }>

export const createInworldAdvancedProvider = (
  options: CreateInworldAdvancedProviderOptions
): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw CLIUsageError('Inworld AI API key is required for capability inspection.')
  return {
    provider: 'inworld',
    accountScopeHash: providerAccountScopeHash('inworld', apiKey),
    getDeclaredCapabilities: () => INWORLD_ADVANCED_CAPABILITY_FIXTURE.records,
  }
}
