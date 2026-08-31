import { extname, join } from 'node:path'
import { VOICE_CAPABILITY_REGISTRY } from '~/types'
import type { CliCommandContext, CloneProviderName, DesignProviderName, ManagedAdvancedProvider, TtsProvider, VoiceCatalogProviderName, VoiceConsentAction, VoiceConsentRecord, VoiceLifecycleProviderName, VoiceProviderName, VoiceRegistration } from '~/types'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import {
  resolveOpenAITtsVoiceForModel,
  validateCartesiaTtsVoice,
  validateDeepinfraTtsVoice,
  validateFishTtsVoice,
  validateGrokTtsVoice,
  validateHumeTtsVoice,
  validateInworldTtsVoice,
  validateSpeechifyTtsVoiceForModel,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { boolFlag, strFlag } from '~/cli/flags/flag-utils'
import * as l from '~/utils/app-logger/app-logger'
import { UsageError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { createCartesiaAdvancedProvider, CARTESIA_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/cartesia/cartesia-advanced-provider'
import { createDeepinfraAdvancedProvider, DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-deepinfra/deepinfra-advanced-provider'
import { createFishAdvancedProvider, FISH_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/fish/fish-advanced-provider'
import { createGrokAdvancedProvider, GROK_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-grok/grok-advanced-provider'
import { createHumeAdvancedProvider, HUME_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/hume/hume-advanced-provider'
import { createInworldAdvancedProvider, INWORLD_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/inworld/inworld-advanced-provider'
import { createMiniMaxAdvancedProvider, MINIMAX_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-minimax/minimax-advanced-provider'
import { createMistralAdvancedProvider, MISTRAL_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-mistral/mistral-advanced-provider'
import { createSpeechifyAdvancedProvider, SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/speechify/speechify-advanced-provider'
import { createElevenLabsAdvancedProvider, ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-elevenlabs/elevenlabs-advanced-provider'
import { loadCharacterVoiceBriefCatalog } from './character-voice-registry'
import { completePendingVoiceProvisioning } from './fish-voice-reconciliation'
import { managedVoiceAssetStore, MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { loadVoiceConsentRecord } from './voice-consent-store'

const providersWith = <K extends 'import' | 'catalog' | 'design' | 'clone' | 'lifecycle'>(capability: K): Array<{
  import: VoiceProviderName
  catalog: VoiceCatalogProviderName
  design: DesignProviderName
  clone: CloneProviderName
  lifecycle: VoiceLifecycleProviderName
}[K]> => (Object.keys(VOICE_CAPABILITY_REGISTRY) as TtsProvider[]).filter(provider => VOICE_CAPABILITY_REGISTRY[provider][capability]) as Array<{
  import: VoiceProviderName
  catalog: VoiceCatalogProviderName
  design: DesignProviderName
  clone: CloneProviderName
  lifecycle: VoiceLifecycleProviderName
}[K]>

export const VOICE_PROVIDERS = providersWith('import')
export const VOICE_CATALOG_PROVIDERS = providersWith('catalog')
export const DESIGN_PROVIDERS = providersWith('design')
export const CLONE_PROVIDERS = providersWith('clone')
export const VOICE_LIFECYCLE_PROVIDERS = providersWith('lifecycle')

export const CONSENT_ACTIONS: VoiceConsentAction[] = ['upload', 'new-synthesis', 'cache-reuse', 'resume', 'export', 'retention', 'deletion']

export const VOICE_ORIGINS = ['provider-stock', 'designed', 'remixed', 'instant-clone', 'professional-clone', 'imported-custom', 'saved-reference'] as const

export const PROFILE_DEFAULT = 'default'

export const VOICE_SYNTHESIS_MODELS = Object.fromEntries(
  Object.entries(VOICE_CAPABILITY_REGISTRY).map(([provider, capabilities]) => [provider, capabilities.models])
) as { readonly [P in TtsProvider]: (typeof VOICE_CAPABILITY_REGISTRY)[P]['models'] }

export const isVoiceProvider = (provider: TtsProvider): provider is VoiceProviderName => VOICE_PROVIDERS.includes(provider as VoiceProviderName)

export const isDesignProvider = (provider: TtsProvider): provider is DesignProviderName => DESIGN_PROVIDERS.includes(provider as DesignProviderName)

export const isCloneProvider = (provider: TtsProvider): provider is CloneProviderName => CLONE_PROVIDERS.includes(provider as CloneProviderName)

export const isCatalogProvider = (provider: TtsProvider): provider is VoiceCatalogProviderName => VOICE_CATALOG_PROVIDERS.includes(provider as VoiceCatalogProviderName)

export const isLifecycleProvider = (provider: TtsProvider): provider is VoiceLifecycleProviderName => VOICE_LIFECYCLE_PROVIDERS.includes(provider as VoiceLifecycleProviderName)

export const advancedCapabilityFixtureHash = (provider: VoiceCatalogProviderName): string => {
  if (provider === 'elevenlabs') return ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'minimax') return MINIMAX_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'grok') return GROK_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'mistral') return MISTRAL_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'hume') return HUME_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'cartesia') return CARTESIA_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'fish') return FISH_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'inworld') return INWORLD_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'deepinfra') return DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  return SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
}

export const advancedProvider = (provider: VoiceCatalogProviderName, options: {
  elevenLabsApiKey?: string | undefined
  inworldApiKey?: string | undefined
  resolveElevenLabsProtectedAsset?: Parameters<typeof createElevenLabsAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveFishProtectedAsset?: Parameters<typeof createFishAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveInworldProtectedAsset?: Parameters<typeof createInworldAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveCartesiaProtectedAsset?: Parameters<typeof createCartesiaAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveMiniMaxProtectedAsset?: Parameters<typeof createMiniMaxAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveGrokProtectedAsset?: Parameters<typeof createGrokAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveMistralProtectedAsset?: Parameters<typeof createMistralAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveDeepinfraProtectedAsset?: Parameters<typeof createDeepinfraAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
} = {}): ManagedAdvancedProvider => {
  if (provider === 'elevenlabs') return createElevenLabsAdvancedProvider({ apiKey: options.elevenLabsApiKey ?? resolveCredential('elevenlabs', 'require', { stage: 'voice:elevenlabs', description: 'ElevenLabs voice management' }), ...(options.resolveElevenLabsProtectedAsset ? { resolveProtectedAsset: options.resolveElevenLabsProtectedAsset } : {}) })
  if (provider === 'minimax') return createMiniMaxAdvancedProvider({ apiKey: resolveCredential('minimax', 'require', { stage: 'voice:minimax', description: 'MiniMax voice management' }), ...(options.resolveMiniMaxProtectedAsset ? { resolveProtectedAsset: options.resolveMiniMaxProtectedAsset } : {}) })
  if (provider === 'grok') return createGrokAdvancedProvider({ apiKey: resolveCredential('grok', 'require', { stage: 'voice:grok', description: 'Grok voice management' }), ...(options.resolveGrokProtectedAsset ? { resolveProtectedAsset: options.resolveGrokProtectedAsset } : {}) })
  if (provider === 'mistral') return createMistralAdvancedProvider({ apiKey: resolveCredential('mistral', 'require', { stage: 'voice:mistral', description: 'Mistral voice management' }), ...(options.resolveMistralProtectedAsset ? { resolveProtectedAsset: options.resolveMistralProtectedAsset } : {}) })
  if (provider === 'hume') return createHumeAdvancedProvider({ apiKey: resolveCredential('hume', 'require', { stage: 'voice:hume', description: 'Hume voice management' }) })
  if (provider === 'cartesia') return createCartesiaAdvancedProvider({ apiKey: resolveCredential('cartesia', 'require', { stage: 'voice:cartesia', description: 'Cartesia voice management' }), ...(options.resolveCartesiaProtectedAsset ? { resolveProtectedAsset: options.resolveCartesiaProtectedAsset } : {}) })
  if (provider === 'fish') return createFishAdvancedProvider({ apiKey: resolveCredential('fish', 'require', { stage: 'voice:fish', description: 'Fish voice management' }), ...(options.resolveFishProtectedAsset ? { resolveProtectedAsset: options.resolveFishProtectedAsset } : {}) })
  if (provider === 'inworld') return createInworldAdvancedProvider({ apiKey: options.inworldApiKey ?? resolveCredential('inworld', 'require', { stage: 'voice:inworld', description: 'Inworld voice management' }), ...(options.resolveInworldProtectedAsset ? { resolveProtectedAsset: options.resolveInworldProtectedAsset } : {}) })
  if (provider === 'deepinfra') return createDeepinfraAdvancedProvider({ apiKey: resolveCredential('deepinfra', 'require', { stage: 'voice:deepinfra', description: 'DeepInfra voice management' }), ...(options.resolveDeepinfraProtectedAsset ? { resolveProtectedAsset: options.resolveDeepinfraProtectedAsset } : {}) })
  return createSpeechifyAdvancedProvider({ apiKey: resolveCredential('speechify', 'require', { stage: 'voice:speechify', description: 'Speechify voice management' }) })
}

export const commonRegistrationFlags = {
  provider: strFlag(`Voice provider: ${VOICE_PROVIDERS.join('|')}`),
  model: strFlag('Provider TTS model used by this registration'),
  profile: strFlag('Casting profile key', PROFILE_DEFAULT),
  'provenance-ref': strFlag('Opaque non-secret provenance record reference'),
  'consent-ref': strFlag('Protected consent-record reference when consent is required'),
  'capability-fixture-hash': strFlag('Optional pinned local capability fixture SHA-256'),
  price: boolFlag('Validate and estimate without provider calls or artifact writes')
} as const

export const requiredFlag = (ctx: CliCommandContext, name: string): string => {
  const value = ctx.flags[name]
  if (typeof value !== 'string' || !value.trim()) throw UsageError(`--${name} is required.`)
  return value.trim()
}

export const optionalFlag = (ctx: CliCommandContext, name: string): string | undefined => {
  const value = ctx.flags[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export const optionalParameter = (ctx: CliCommandContext, name: string): string | undefined => {
  const kebabName = name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  const value = ctx.parameters[name] ?? ctx.parameters[kebabName]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export const parameter = (ctx: CliCommandContext, name: string): string => {
  const value = optionalParameter(ctx, name)
  if (!value) throw UsageError(`${name} is required.`)
  return value
}

export const providerFlag = (ctx: CliCommandContext): VoiceProviderName => {
  const provider = requiredFlag(ctx, 'provider')
  if (['groq', 'gemini', 'deepgram', 'replicate', 'fal'].includes(provider)) throw UsageError(`${provider} is no longer supported for TTS or voice management. Select one of: ${VOICE_PROVIDERS.join(', ')}.`)
  if (!isVoiceProvider(provider as TtsProvider)) throw UsageError(`Unknown voice provider ${provider}. Expected: ${VOICE_PROVIDERS.join(', ')}.`)
  return provider as VoiceProviderName
}

export const catalogProviderFlag = (ctx: CliCommandContext): VoiceCatalogProviderName => {
  const provider = providerFlag(ctx)
  if (!isCatalogProvider(provider)) throw UsageError(`${provider} does not expose remote voice catalog or lifecycle operations. Supported providers: ${VOICE_CATALOG_PROVIDERS.join(', ')}.`)
  return provider
}

export const requireVoiceModel = (provider: VoiceProviderName, model: string): string => {
  const expected = VOICE_SYNTHESIS_MODELS[provider] as readonly string[]
  if (!expected.includes(model)) throw UsageError(`Voice management for ${provider} requires --model ${expected.join(' or ')}.`)
  return model
}

export const resolveVoiceImportResourceId = (provider: VoiceProviderName, model: string, resourceId: string): string => {
  requireVoiceModel(provider, model)
  const value = resourceId.trim()
  if (!value) throw UsageError('Voice import requires an existing provider resource ID.')
  if (provider === 'grok') return validateGrokTtsVoice(value)
  if (provider === 'openai') return resolveOpenAITtsVoiceForModel('gpt-4o-mini-tts-2025-12-15', value).voiceId
  if (provider === 'speechify') return validateSpeechifyTtsVoiceForModel('simba-3.2', value)
  if (provider === 'hume') return validateHumeTtsVoice(value)
  if (provider === 'cartesia') return validateCartesiaTtsVoice(value)
  if (provider === 'fish') return validateFishTtsVoice(value)
  if (provider === 'inworld') return validateInworldTtsVoice(value)
  if (provider === 'deepinfra') return validateDeepinfraTtsVoice(value)
  return value
}

export const positiveIntegerFlag = (ctx: CliCommandContext, name: string, fallback: number): number => {
  const raw = optionalFlag(ctx, name)
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) throw UsageError(`--${name} must be a positive integer.`)
  return value
}

export const nonNegativeNumberFlag = (ctx: CliCommandContext, name: string): number | undefined => {
  const raw = optionalFlag(ctx, name)
  if (!raw) return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw UsageError(`--${name} must be a non-negative number.`)
  return value
}

export const capabilityFixtureHash = (ctx: CliCommandContext, provider: TtsProvider, model: string): string => {
  const explicit = optionalFlag(ctx, 'capability-fixture-hash')
  if (explicit && !/^[a-f0-9]{64}$/.test(explicit)) throw UsageError('--capability-fixture-hash must be a lowercase SHA-256 digest.')
  return explicit ?? hashCanonicalTtsValue({ schemaVersion: 1, phase: 'adr-020-phase-1', provider, model, checkedAt: '2026-08-11' })
}

export const requireBrief = async (subjectKey: string, profileKey: string) => {
  const catalog = await loadCharacterVoiceBriefCatalog(getCharactersRoot())
  const brief = catalog.briefs.find(entry => entry.subjectKey === subjectKey && entry.profileKey === profileKey)
  if (!brief) throw UsageError(`No character voice brief exists for ${subjectKey}/${profileKey} in character-voices.json.`)
  return brief
}

export const reportVoiceResult = (message: string, data: Record<string, unknown>): void => {
  l.report.result(data, { message })
}

export const reportVoicePrice = (message: string, data: Record<string, unknown>): void => {
  l.report.result({ dryRun: true, ...data }, { message, category: 'pricing' })
}

export const optionalConsent = async (reference: string | undefined): Promise<VoiceConsentRecord | undefined> =>
  reference ? await loadVoiceConsentRecord(managedVoiceAssetStore, reference) : undefined

export const repeatableFlag = (ctx: CliCommandContext, name: string): string[] => {
  const value = ctx.flags[name]
  return (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim())
}

export const voiceJournalRoot = (): string => join(MANAGED_VOICE_STORE_ROOT, 'journals')

export const maybeCompleteRegistrationJournal = async (registration: VoiceRegistration, ctx: CliCommandContext) => {
  if (ctx.flags['price'] === true) return undefined
  return await completePendingVoiceProvisioning({
    charactersRoot: getCharactersRoot(),
    registration,
    journalRoot: voiceJournalRoot(),
    allowAmbiguous: ctx.flags['reconcile'] === true,
    ...(ctx.flags['reconcile'] === true && (registration.provider === 'fish' || registration.provider === 'grok')
      ? { apiKey: resolveCredential(registration.provider, 'require', { stage: `voice:${registration.provider}`, description: `${registration.provider === 'grok' ? 'Grok voice' : 'Fish model'} reconciliation` }) }
      : {}),
  })
}

const cloneMediaTypeFromBytes = (bytes: Uint8Array): string | undefined => {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav'
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') return 'audio/mpeg'
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) return (buffer[1]! & 0x16) === 0x10 ? 'audio/aac' : 'audio/mpeg'
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'fLaC') return 'audio/flac'
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg'
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4'
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'audio/webm'
  return undefined
}

export const cloneMediaType = (path: string, bytes?: Uint8Array): string => {
  const extension = extname(path).toLowerCase().slice(1)
  if (extension === 'wav' || extension === 'wave') return 'audio/wav'
  if (extension === 'mp3') return 'audio/mpeg'
  if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4'
  if (extension === 'ogg') return 'audio/ogg'
  if (extension === 'flac') return 'audio/flac'
  if (extension === 'aac') return 'audio/aac'
  if (extension === 'webm') return 'audio/webm'
  const detected = bytes ? cloneMediaTypeFromBytes(bytes) : undefined
  if (detected) return detected
  throw UsageError('Voice audio samples must be mp3, wav, m4a/mp4, ogg, flac, aac, or webm audio.')
}

export const cloneFileExtension = (mediaType: string): string => {
  if (mediaType === 'audio/wav') return 'wav'
  if (mediaType === 'audio/mpeg') return 'mp3'
  if (mediaType === 'audio/mp4') return 'm4a'
  if (mediaType === 'audio/ogg') return 'ogg'
  if (mediaType === 'audio/flac') return 'flac'
  if (mediaType === 'audio/aac') return 'aac'
  if (mediaType === 'audio/webm') return 'webm'
  throw UsageError(`Unsupported protected voice audio media type: ${mediaType}`)
}
