import type { AnyCapabilityRecord, ProviderVoiceCatalogEntry, ProviderVoiceCatalogPage, TtsVoiceProvider, VoiceCatalogPort } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  buildAdvancedCapabilityFixture,
  buildCapabilityDocumentationEvidence,
  createAdvancedProviderJsonRequest,
  providerAccountScopeHash,
  type AdvancedProviderHttpRequest,
} from '../../script-to-audio/advanced-provider-contracts'

const DOCS = {
  synthesis: 'https://docs.inworld.ai/docs/tts/tts',
  catalog: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/list-voices',
  inspect: 'https://docs.inworld.ai/api-reference/voiceAPI/voiceservice/get-voice',
  cloning: 'https://docs.inworld.ai/docs/tutorial-basics/voice-cloning/',
} as const

const evidence = (refs: readonly string[]) => buildCapabilityDocumentationEvidence(refs)
const unsupportedMutation = 'The AutoShow Inworld adapter does not implement this remote voice mutation; catalog discovery and request-time stock voice selection remain read-only.'
const capabilityRecords = [
  { scope: { provider: 'inworld', feature: 'turn-synthesis' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], supportedOutputFormats: ['mp3'] }, documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'native-dialogue' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { voiceKinds: ['provider-id' as const], minSpeakers: 2, maxSpeakers: 2 }, reason: 'The adapter sends one voiceId per synthesis request and does not implement a native multi-speaker request.', documentationEvidence: evidence([DOCS.synthesis]) },
  { scope: { provider: 'inworld', feature: 'voice-catalog' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'implemented' as const, requirements: [], constraints: { paginated: false, stableResourceIds: true }, documentationEvidence: evidence([DOCS.catalog, DOCS.inspect]) },
  { scope: { provider: 'inworld', feature: 'voice-design' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: false, createsRemoteResource: true }, reason: unsupportedMutation, documentationEvidence: evidence([DOCS.catalog]) },
  { scope: { provider: 'inworld', feature: 'instant-clone' as const }, maturity: 'not-applicable' as const, channel: 'unsupported' as const, adapterSupport: 'unsupported' as const, requirements: [], constraints: { requiresConsent: true, createsRemoteResource: true }, reason: unsupportedMutation, documentationEvidence: evidence([DOCS.cloning]) },
  { scope: { provider: 'inworld', feature: 'voice-delete' as const }, maturity: 'stable' as const, channel: 'api' as const, adapterSupport: 'planned' as const, requirements: [], constraints: { projectOwnedOnly: true }, reason: unsupportedMutation, documentationEvidence: evidence([DOCS.inspect]) },
] as const satisfies readonly AnyCapabilityRecord[]

export const INWORLD_ADVANCED_CAPABILITY_FIXTURE = buildAdvancedCapabilityFixture(capabilityRecords)

type JsonRecord = Record<string, unknown>
const record = (value: unknown, label: string): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw CLIUsageError(`Inworld ${label} response is invalid.`)
  return value as JsonRecord
}
const string = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined

export const mapInworldVoice = (value: unknown): ProviderVoiceCatalogEntry => {
  const voice = record(value, 'voice')
  const resourceId = string(voice['voiceId'])
  const name = string(voice['displayName']) ?? string(voice['name'])
  if (!resourceId || !name) throw CLIUsageError('Inworld voice response omits voiceId or displayName.')
  const source = string(voice['source'])
  const providerStock = source === 'SYSTEM'
  const tags = Array.isArray(voice['tags']) ? voice['tags'].filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) : []
  const labels = Object.fromEntries([
    ['language', string(voice['langCode'])],
    ['gender', string(voice['gender'])],
    ['ageGroup', string(voice['ageGroup'])],
  ].flatMap(([key, item]) => item ? [[key as string, item]] : []))
  return {
    provider: 'inworld',
    resourceId,
    name,
    source: providerStock ? 'provider-library' : 'account',
    origin: providerStock ? 'provider-stock' : 'imported-custom',
    ...(string(voice['description']) ? { description: string(voice['description']) } : {}),
    labels: { ...labels, ...(tags.length > 0 ? { tags: tags.join(',') } : {}) },
    modelIds: ['realtime-tts-2', 'realtime-tts-2-flash'],
    state: 'available',
    sanitizedMetadata: { source: source ?? 'UNKNOWN' }
  }
}

export type CreateInworldAdvancedProviderOptions = Readonly<{
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  now?: (() => string) | undefined
}>

export const createInworldAdvancedProvider = (
  options: CreateInworldAdvancedProviderOptions
): Pick<TtsVoiceProvider, 'provider' | 'getDeclaredCapabilities' | 'catalog' | 'design' | 'clone' | 'lifecycle'> & { accountScopeHash: string } => {
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw CLIUsageError('Inworld AI API key is required for capability inspection.')
  const request = options.request ?? createAdvancedProviderJsonRequest({
    baseUrl: 'https://api.inworld.ai',
    apiKey: apiKey.startsWith('Basic ') ? apiKey : `Basic ${apiKey}`,
    apiKeyHeader: 'Authorization',
    providerLabel: 'Inworld'
  })
  const now = options.now ?? (() => new Date().toISOString())
  const catalog: VoiceCatalogPort = {
    list: async input => {
      if (input?.cursor) throw CLIUsageError('Inworld voice catalog is not paginated.')
      const requestedSource = input?.source
      const payload = record(await request({ method: 'GET', path: '/voices/v1/voices', query: { languages: 'EN_US' } }), 'voice catalog')
      const entries = (Array.isArray(payload['voices']) ? payload['voices'].map(mapInworldVoice) : [])
        .filter(entry => requestedSource === undefined || requestedSource === entry.source || (requestedSource === 'provider-library' && entry.source === 'provider-library'))
      const page: ProviderVoiceCatalogPage = { schemaVersion: 1, provider: 'inworld', entries, checkedAt: now() }
      return page
    }
  }
  return {
    provider: 'inworld',
    accountScopeHash: providerAccountScopeHash('inworld', apiKey),
    getDeclaredCapabilities: () => INWORLD_ADVANCED_CAPABILITY_FIXTURE.records,
    catalog,
  }
}
