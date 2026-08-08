import { CLIUsageError } from '~/utils/error-handler'
import type { SelectorNormalizationResult } from '~/types'
import { appendFlagValue, occurrenceValues } from './flag-helpers'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './provider-targets'

const TTS_PROVIDER_BY_TARGET = Object.fromEntries(
  Object.entries(STANDALONE_TTS_PROVIDER_TARGETS).map(([provider, target]) => [target, provider])
) as Record<string, string>
const LOCAL_TTS_PROVIDERS = new Set<string>(['kitten'])

const TTS_GENERIC_OPTION_TARGETS = {
  'tts-voice': {
    kitten: 'kitten-voice',
    groq: 'groq-voice',
    grok: 'grok-tts-voice',
    mistral: 'mistral-tts-voice',
    openai: 'openai-voice',
    gemini: 'gemini-voice',
    deepgram: 'deepgram-voice',
    speechify: 'speechify-voice',
    hume: 'hume-tts-voice',
    cartesia: 'cartesia-tts-voice',
    minimax: 'minimax-tts-voice',
    elevenlabs: 'elevenlabs-voice'
  },
  'tts-speed': {
    openai: 'openai-tts-speed',
    deepgram: 'deepgram-tts-speed',
    minimax: 'minimax-tts-speed',
    elevenlabs: 'elevenlabs-tts-speed'
  },
  'tts-language': {
    grok: 'grok-tts-language',
    speechify: 'speechify-tts-language',
    cartesia: 'cartesia-tts-language',
    elevenlabs: 'elevenlabs-tts-language-code'
  },
  'tts-ref-audio': {
    mistral: 'mistral-tts-ref-audio',
    speechify: 'speechify-tts-ref-audio',
    elevenlabs: 'elevenlabs-tts-ref-audio'
  },
  'tts-voice-name': {
    mistral: 'mistral-tts-voice-name',
    speechify: 'speechify-tts-voice-name',
    elevenlabs: 'elevenlabs-tts-voice-name'
  },
  'tts-consent-name': {
    speechify: 'speechify-tts-consent-name'
  },
  'tts-consent-email': {
    speechify: 'speechify-tts-consent-email'
  },
  'tts-text-normalization': {
    grok: 'grok-tts-text-normalization',
    minimax: 'minimax-tts-english-normalization',
    elevenlabs: 'elevenlabs-tts-text-normalization'
  },
  'tts-instructions': {
    openai: 'openai-tts-instructions'
  },
  'tts-output-format': {
    deepgram: 'deepgram-tts-encoding',
    speechify: 'speechify-tts-audio-format',
    elevenlabs: 'elevenlabs-tts-output-format'
  }
} as const satisfies Record<string, Record<string, string>>

// Every provider flag `--tts-voice` can normalize into. Derived so a provider added above is
// covered without a second list to keep in step.
export const TTS_VOICE_OPTION_TARGETS: readonly string[] = Object.values(TTS_GENERIC_OPTION_TARGETS['tts-voice'])

const genericTtsOptionFlags = Object.keys(TTS_GENERIC_OPTION_TARGETS)
const booleanTtsOptionTargets = new Set<string>(['grok-tts-text-normalization', 'minimax-tts-english-normalization'])

const readSelectedTtsProviders = (
  flags: Record<string, unknown>,
  defaultProvider?: string | undefined
): string[] => {
  const allProvidersSelected = flags['all-tts'] === true
  const allLocalSelected = flags['all-local-tts'] === true
  if (allProvidersSelected || allLocalSelected) {
    return Object.keys(STANDALONE_TTS_PROVIDER_TARGETS).filter((provider) =>
      (allProvidersSelected && !LOCAL_TTS_PROVIDERS.has(provider))
      || (allLocalSelected && LOCAL_TTS_PROVIDERS.has(provider))
    )
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

const parseGenericTtsOptionValue = (
  rawValue: string | true,
  flagName: string
): { provider?: string | undefined, value: string | boolean } => {
  if (rawValue === true) {
    return { value: true }
  }

  const eqIndex = rawValue.indexOf('=')
  if (eqIndex > 0) {
    const possibleProvider = rawValue.slice(0, eqIndex).trim().toLowerCase()
    if (possibleProvider in STANDALONE_TTS_PROVIDER_TARGETS) {
      const value = rawValue.slice(eqIndex + 1)
      if (value.length === 0) {
        throw CLIUsageError(`--${flagName} requires a value after "${possibleProvider}=".`)
      }
      return { provider: possibleProvider, value }
    }
  }

  return { value: rawValue }
}

const resolveGenericTtsOptionProvider = (
  flagName: string,
  parsedProvider: string | undefined,
  selectedProviders: string[]
): string => {
  if (parsedProvider) {
    return parsedProvider
  }
  if (selectedProviders.length === 1) {
    return selectedProviders[0] as string
  }
  if (selectedProviders.length === 0) {
    throw CLIUsageError(`--${flagName} requires one selected TTS provider or provider=value.`)
  }
  throw CLIUsageError(`--${flagName} requires provider=value when multiple TTS providers are selected.`)
}

const appendGenericTtsOption = (
  flags: Record<string, unknown>,
  flagName: string,
  provider: string,
  value: string | boolean
): string => {
  const providerTargets = TTS_GENERIC_OPTION_TARGETS[flagName as keyof typeof TTS_GENERIC_OPTION_TARGETS]
  const target = providerTargets?.[provider as keyof typeof providerTargets]
  if (!target) {
    throw CLIUsageError(`--${flagName} does not apply to ${provider} TTS.`)
  }

  if (booleanTtsOptionTargets.has(target)) {
    flags[target] = value === true || (typeof value === 'string' && !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase()))
    return target
  }

  if (value === true) {
    throw CLIUsageError(`--${flagName} requires a value.`)
  }

  appendFlagValue(flags, target, value)
  return target
}

export const normalizeGenericTtsOptionFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  defaultProvider?: string | undefined
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)
  const selectedProviders = readSelectedTtsProviders(normalizedFlags, defaultProvider)

  for (const flagName of genericTtsOptionFlags) {
    const values = occurrenceValues(normalizedFlags[flagName])
    if (values.length === 0) {
      continue
    }

    delete normalizedFlags[flagName]
    normalizedExplicitFlags.delete(flagName)
    for (const value of values) {
      const parsed = parseGenericTtsOptionValue(value, flagName)
      const provider = resolveGenericTtsOptionProvider(flagName, parsed.provider, selectedProviders)
      normalizedExplicitFlags.add(appendGenericTtsOption(normalizedFlags, flagName, provider, parsed.value))
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}
