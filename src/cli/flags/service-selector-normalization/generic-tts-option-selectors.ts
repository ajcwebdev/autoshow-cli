import { UsageError } from '~/utils/error-handler'
import type { CliFlagOccurrence, SelectorNormalizationResult, TtsOptions } from '~/types'
import { occurrenceValues } from './flag-helpers'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './provider-targets'

export const GENERIC_TTS_OPTION_PROVIDERS = {
  'tts-voice': {
    voiceIdentity: true,
    providers: [
      'groq', 'grok', 'mistral', 'openai', 'gemini', 'deepgram', 'speechify',
      'hume', 'cartesia', 'fish', 'inworld', 'deepinfra', 'replicate', 'fal',
      'minimax', 'elevenlabs'
    ]
  },
  'tts-speed': {
    voiceIdentity: false,
    providers: ['openai', 'deepgram', 'minimax', 'elevenlabs']
  },
  'tts-language': {
    voiceIdentity: false,
    providers: ['grok', 'speechify', 'cartesia', 'elevenlabs', 'minimax']
  },
  'tts-ref-audio': {
    voiceIdentity: true,
    providers: ['mistral']
  },
  'tts-text-normalization': {
    voiceIdentity: false,
    providers: ['grok', 'minimax', 'elevenlabs']
  },
  'tts-instructions': {
    voiceIdentity: false,
    providers: ['openai', 'fal', 'inworld']
  }
} as const satisfies Record<string, {
  voiceIdentity: boolean
  providers: readonly string[]
}>

export type GenericTtsOptionFlag = keyof typeof GENERIC_TTS_OPTION_PROVIDERS

const GENERIC_TTS_OPTION_FLAGS = Object.keys(GENERIC_TTS_OPTION_PROVIDERS) as GenericTtsOptionFlag[]
const BOOLEAN_TTS_TEXT_NORMALIZATION_PROVIDERS = new Set<string>(['grok', 'minimax'])

export const assertNoVoiceIdentityWithDialogue = (
  options: Pick<TtsOptions, 'ttsSpeakers'>,
  explicitFlags: ReadonlySet<string>
): void => {
  if ((options.ttsSpeakers?.length ?? 0) === 0) return

  if (explicitFlags.has('tts-voice')) {
    throw UsageError('--tts-voice cannot be combined with --tts-speaker/--tts-dialogue-format; per-speaker voices come from --tts-speaker mappings.')
  }

  if (explicitFlags.has('tts-ref-audio')) {
    throw UsageError('Voice identity options such as --tts-ref-audio cannot be combined with --tts-speaker/--tts-dialogue-format; per-speaker voices come from --tts-speaker mappings.')
  }
}

export const readSelectedTtsProviders = (
  flags: Record<string, unknown>,
  defaultProvider?: string | undefined
): string[] => {
  const allProvidersSelected = flags['all-tts'] === true
  if (allProvidersSelected) {
    return Object.keys(STANDALONE_TTS_PROVIDER_TARGETS)
  }

  const providers: string[] = []
  for (const [target, provider] of Object.entries(TTS_PROVIDER_BY_TARGET)) {
    if (occurrenceValues(flags[target]).length > 0) {
      providers.push(provider)
    }
  }

  if (providers.length === 0 && defaultProvider) {
    providers.push(defaultProvider)
  }

  return providers
}

const TTS_PROVIDER_BY_TARGET = Object.fromEntries(
  Object.entries(STANDALONE_TTS_PROVIDER_TARGETS).map(([provider, target]) => [target, provider])
) as Record<string, string>

export const parseGenericTtsOptionValue = (
  rawValue: string | boolean,
  flagName: string
): { provider?: string | undefined, value: string | boolean } => {
  if (typeof rawValue === 'boolean') {
    return { value: rawValue }
  }

  const eqIndex = rawValue.indexOf('=')
  if (eqIndex > 0) {
    const possibleProvider = rawValue.slice(0, eqIndex).trim().toLowerCase()
    if (possibleProvider in STANDALONE_TTS_PROVIDER_TARGETS) {
      const value = rawValue.slice(eqIndex + 1)
      if (value.length === 0) {
        throw UsageError(`--${flagName} requires a value after "${possibleProvider}=".`)
      }
      return { provider: possibleProvider, value }
    }
  }

  return { value: rawValue }
}

export const resolveGenericTtsOptionProvider = (
  flagName: string,
  parsedProvider: string | undefined,
  selectedProviders: string[],
  options: { allowUnscoped?: boolean } = {}
): string | undefined => {
  if (parsedProvider) {
    return parsedProvider
  }
  if (selectedProviders.length === 1) {
    return selectedProviders[0]
  }
  if (selectedProviders.length === 0) {
    if (options.allowUnscoped === true) return undefined
    throw UsageError(`--${flagName} requires one selected TTS provider or provider=value.`)
  }
  throw UsageError(`--${flagName} requires provider=value when multiple TTS providers are selected.`)
}

export const assertGenericTtsOptionSupported = (flagName: string, provider: string): void => {
  const definition = GENERIC_TTS_OPTION_PROVIDERS[flagName as GenericTtsOptionFlag]
  if (!definition || !(definition.providers as readonly string[]).includes(provider)) {
    throw UsageError(`--${flagName} does not apply to ${provider} TTS.`)
  }
}

export const requireGenericTtsOptionString = (flagName: string, value: string | boolean): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw UsageError(`--${flagName} requires a value.`)
  }
  return value
}

export const parseGenericTtsBooleanOption = (value: string | boolean): boolean =>
  value === true || (typeof value === 'string' && !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase()))

const assertGenericTtsOptionValue = (
  flagName: GenericTtsOptionFlag,
  provider: string | undefined,
  value: string | boolean
): void => {
  if (value !== true) return
  if (flagName === 'tts-text-normalization') {
    if (provider === undefined || BOOLEAN_TTS_TEXT_NORMALIZATION_PROVIDERS.has(provider)) return
  }
  throw UsageError(`--${flagName} requires a value.`)
}

const validateGenericTtsOption = (
  flagName: GenericTtsOptionFlag,
  rawValue: string | boolean,
  selectedProviders: string[]
): void => {
  const parsed = parseGenericTtsOptionValue(rawValue, flagName)
  const provider = resolveGenericTtsOptionProvider(flagName, parsed.provider, selectedProviders, { allowUnscoped: true })
  if (provider !== undefined) {
    assertGenericTtsOptionSupported(flagName, provider)
  }
  assertGenericTtsOptionValue(flagName, provider, parsed.value)
}

export const readGenericTtsOptionRawValues = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  flagName: string
): Array<string | boolean> => {
  const occurrenceValuesForFlag = flagOccurrences.flatMap((occurrence) => {
    if (occurrence.name !== flagName) return []
    if (typeof occurrence.value === 'string' || typeof occurrence.value === 'boolean') {
      return [occurrence.value]
    }
    return []
  })
  if (occurrenceValuesForFlag.length > 0) return occurrenceValuesForFlag

  const value = flags[flagName]
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string | boolean =>
      (typeof entry === 'string' && entry.length > 0) || typeof entry === 'boolean'
    )
  }
  if (typeof value === 'string' && value.length > 0) return [value]
  if (typeof value === 'boolean') return [value]
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)]
  return []
}

export type GenericTtsOptionAssignment = {
  provider: string
  value: string | boolean
}

export const resolveGenericTtsOptionAssignments = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  flagName: GenericTtsOptionFlag,
  selectedProviders: string[]
): GenericTtsOptionAssignment[] => {
  const rawValues = readGenericTtsOptionRawValues(flags, flagOccurrences, flagName)
  return rawValues.map((rawValue) => {
    const parsed = parseGenericTtsOptionValue(rawValue, flagName)
    const provider = resolveGenericTtsOptionProvider(flagName, parsed.provider, selectedProviders)
    if (provider === undefined) {
      throw UsageError(`--${flagName} requires one selected TTS provider or provider=value.`)
    }
    assertGenericTtsOptionSupported(flagName, provider)
    assertGenericTtsOptionValue(flagName, provider, parsed.value)
    return { provider, value: parsed.value }
  })
}

export const normalizeGenericTtsOptionFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  defaultProvider?: string | undefined
): SelectorNormalizationResult => {
  const selectedProviders = readSelectedTtsProviders(flags, defaultProvider)
  for (const occurrence of flagOccurrences) {
    if (!GENERIC_TTS_OPTION_FLAGS.includes(occurrence.name as GenericTtsOptionFlag)) continue
    if (typeof occurrence.value !== 'string' && typeof occurrence.value !== 'boolean') continue
    validateGenericTtsOption(occurrence.name as GenericTtsOptionFlag, occurrence.value, selectedProviders)
  }
  return { flags, explicitFlags, flagOccurrences: [...flagOccurrences] }
}
