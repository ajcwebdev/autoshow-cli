import type { AnyCapabilityRecord, TtsVoiceProvider } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  providerAccountScopeHash,
} from '../../script-to-audio/advanced-provider-contracts'

const DOCS = {
  api: 'https://docs.deepinfra.com/apis/text-to-speech',
  models: 'https://deepinfra.com/models/text-to-speech',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const unsupportedManagement = 'DeepInfra exposes model inference for these workflows, but the AutoShow adapter has no verified durable voice catalog or lifecycle API.'
const capabilityRecords = [
  { scope: { provider: 'deepinfra', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['wav'] }, documentationEvidence: evidence([DOCS.api, DOCS.models]) },
  { scope: { provider: 'deepinfra', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'The adapter sends one preset_voice per inference request and does not implement a native multi-speaker request.', documentationEvidence: evidence([DOCS.api]) },
  { scope: { provider: 'deepinfra', feature: 'voice-catalog' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { paginated: false, stableResourceIds: false }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.models]) },
  { scope: { provider: 'deepinfra', feature: 'voice-design' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: false }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.api]) },
  { scope: { provider: 'deepinfra', feature: 'instant-clone' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: false }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.api]) },
  { scope: { provider: 'deepinfra', feature: 'voice-delete' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { projectOwnedOnly: true }, reason: unsupportedManagement, documentationEvidence: evidence([DOCS.api]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

export type CreateDeepinfraAdvancedProviderOptions = Readonly<{ apiKey: string }>

export const createDeepinfraAdvancedProvider = (
  options: CreateDeepinfraAdvancedProviderOptions
): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw CLIUsageError('DeepInfra API key is required for capability inspection.')
  return {
    provider: 'deepinfra',
    accountScopeHash: providerAccountScopeHash('deepinfra', apiKey),
    getDeclaredCapabilities: () => DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.records,
  }
}
