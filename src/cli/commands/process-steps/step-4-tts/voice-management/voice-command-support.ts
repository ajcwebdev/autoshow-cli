import { join } from 'node:path'
import type { CliCommandContext, CloneProviderName, DesignProviderName, ManagedAdvancedProvider, TtsProvider, VoiceConsentAction, VoiceConsentRecord, VoiceProviderName, VoiceRegistration } from '~/types'
import { getCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { boolFlag, strFlag } from '~/cli/flags/flag-utils'
import * as l from '~/utils/app-logger/app-logger'
import { UsageError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { createCartesiaAdvancedProvider, CARTESIA_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/cartesia/cartesia-advanced-provider'
import { createFishAdvancedProvider, FISH_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/fish/fish-advanced-provider'
import { createInworldAdvancedProvider, INWORLD_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/inworld/inworld-advanced-provider'
import { createSpeechifyAdvancedProvider, SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/speechify/speechify-advanced-provider'
import { createElevenLabsAdvancedProvider, ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE } from '../tts-services/tts-elevenlabs/elevenlabs-advanced-provider'
import { loadCharacterVoiceBriefCatalog } from './character-voice-registry'
import { completePendingVoiceProvisioning } from './fish-voice-reconciliation'
import { managedVoiceAssetStore, MANAGED_VOICE_STORE_ROOT } from './managed-voice-store'
import { loadVoiceConsentRecord } from './voice-consent-store'

export const VOICE_PROVIDERS = ['elevenlabs', 'inworld', 'fish', 'cartesia', 'speechify'] as const satisfies readonly VoiceProviderName[]

export const CONSENT_ACTIONS: VoiceConsentAction[] = ['upload', 'new-synthesis', 'cache-reuse', 'resume', 'export', 'retention', 'deletion']

export const VOICE_ORIGINS = ['provider-stock', 'designed', 'remixed', 'instant-clone', 'professional-clone', 'imported-custom', 'saved-reference'] as const

export const PROFILE_DEFAULT = 'default'

export const VOICE_SYNTHESIS_MODELS = {
  elevenlabs: 'eleven_v3',
  inworld: 'realtime-tts-2',
  fish: 's2.1-pro',
  cartesia: 'sonic-3.5-2026-05-04',
  speechify: 'simba-3.2',
} as const

export const SPEECHIFY_CLONE_GENDERS = ['male', 'female', 'not_specified'] as const

export const DESIGN_PROVIDERS = ['elevenlabs', 'fish', 'inworld'] as const satisfies readonly DesignProviderName[]

export const CLONE_PROVIDERS = ['elevenlabs', 'inworld', 'fish', 'cartesia', 'speechify'] as const satisfies readonly CloneProviderName[]

export const isVoiceProvider = (provider: TtsProvider): provider is VoiceProviderName => VOICE_PROVIDERS.includes(provider as VoiceProviderName)

export const isDesignProvider = (provider: TtsProvider): provider is DesignProviderName => DESIGN_PROVIDERS.includes(provider as DesignProviderName)

export const isCloneProvider = (provider: TtsProvider): provider is CloneProviderName => CLONE_PROVIDERS.includes(provider as CloneProviderName)

export const advancedCapabilityFixtureHash = (provider: VoiceProviderName): string => {
  if (provider === 'elevenlabs') return ELEVENLABS_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'cartesia') return CARTESIA_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'fish') return FISH_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  if (provider === 'inworld') return INWORLD_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
  return SPEECHIFY_ADVANCED_CAPABILITY_FIXTURE.capabilityFixtureHash
}

export const advancedProvider = (provider: VoiceProviderName, options: {
  elevenLabsApiKey?: string | undefined
  inworldApiKey?: string | undefined
  resolveElevenLabsProtectedAsset?: Parameters<typeof createElevenLabsAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveFishProtectedAsset?: Parameters<typeof createFishAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveInworldProtectedAsset?: Parameters<typeof createInworldAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveCartesiaProtectedAsset?: Parameters<typeof createCartesiaAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveSpeechifyProtectedAsset?: Parameters<typeof createSpeechifyAdvancedProvider>[0]['resolveProtectedAsset'] | undefined
  resolveSpeechifyProtectedConsent?: Parameters<typeof createSpeechifyAdvancedProvider>[0]['resolveProtectedConsent'] | undefined
} = {}): ManagedAdvancedProvider => {
  if (provider === 'elevenlabs') return createElevenLabsAdvancedProvider({ apiKey: options.elevenLabsApiKey ?? resolveCredential('elevenlabs', 'require', { stage: 'voice:elevenlabs', description: 'ElevenLabs voice management' }), ...(options.resolveElevenLabsProtectedAsset ? { resolveProtectedAsset: options.resolveElevenLabsProtectedAsset } : {}) })
  if (provider === 'cartesia') return createCartesiaAdvancedProvider({ apiKey: resolveCredential('cartesia', 'require', { stage: 'voice:cartesia', description: 'Cartesia voice management' }), ...(options.resolveCartesiaProtectedAsset ? { resolveProtectedAsset: options.resolveCartesiaProtectedAsset } : {}) })
  if (provider === 'fish') return createFishAdvancedProvider({ apiKey: resolveCredential('fish', 'require', { stage: 'voice:fish', description: 'Fish voice management' }), ...(options.resolveFishProtectedAsset ? { resolveProtectedAsset: options.resolveFishProtectedAsset } : {}) })
  if (provider === 'inworld') return createInworldAdvancedProvider({ apiKey: options.inworldApiKey ?? resolveCredential('inworld', 'require', { stage: 'voice:inworld', description: 'Inworld voice management' }), ...(options.resolveInworldProtectedAsset ? { resolveProtectedAsset: options.resolveInworldProtectedAsset } : {}) })
  return createSpeechifyAdvancedProvider({
    apiKey: resolveCredential('speechify', 'require', { stage: 'voice:speechify', description: 'Speechify voice management' }),
    ...(options.resolveSpeechifyProtectedAsset ? { resolveProtectedAsset: options.resolveSpeechifyProtectedAsset } : {}),
    ...(options.resolveSpeechifyProtectedConsent ? { resolveProtectedConsent: options.resolveSpeechifyProtectedConsent } : {}),
  })
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
  if (!isVoiceProvider(provider as TtsProvider)) throw UsageError(`Unknown voice provider ${provider}. Expected: ${VOICE_PROVIDERS.join(', ')}.`)
  return provider as VoiceProviderName
}

export const requireVoiceModel = (provider: VoiceProviderName, model: string): string => {
  const expected = VOICE_SYNTHESIS_MODELS[provider]
  if (model !== expected) throw UsageError(`Voice management for ${provider} requires --model ${expected}.`)
  return model
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
    ...(ctx.flags['reconcile'] === true && registration.provider === 'fish'
      ? { apiKey: resolveCredential('fish', 'require', { stage: 'voice:fish', description: 'Fish model reconciliation' }) }
      : {}),
  })
}

export const cloneMediaType = (path: string): string => {
  const extension = path.toLowerCase().split('.').pop()
  if (extension === 'wav' || extension === 'wave') return 'audio/wav'
  if (extension === 'mp3') return 'audio/mpeg'
  if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4'
  if (extension === 'ogg') return 'audio/ogg'
  if (extension === 'flac') return 'audio/flac'
  if (extension === 'aac') return 'audio/aac'
  if (extension === 'webm') return 'audio/webm'
  throw UsageError('Voice audio samples must be mp3, wav, m4a/mp4, ogg, flac, aac, or webm audio.')
}
