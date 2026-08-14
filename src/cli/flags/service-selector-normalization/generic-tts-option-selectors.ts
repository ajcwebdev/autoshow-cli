import { CLIUsageError } from '~/utils/error-handler'
import type { CliFlagOccurrence, SelectorNormalizationResult, TtsOptions } from '~/types'
import { occurrenceValues } from './flag-helpers'
import { applyFlagOccurrenceNormalization, replaceFlagOccurrence } from './occurrence-normalization'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './provider-targets'

const TTS_PROVIDER_BY_TARGET = Object.fromEntries(
  Object.entries(STANDALONE_TTS_PROVIDER_TARGETS).map(([provider, target]) => [target, provider])
) as Record<string, string>
const LOCAL_TTS_PROVIDERS = new Set<string>(['kitten'])

const TTS_GENERIC_OPTION_TARGETS = {
  'tts-voice': {
    voiceIdentity: true,
    targets: {
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
      fish: 'fish-tts-voice',
      inworld: 'inworld-voice',
      deepinfra: 'deepinfra-voice',
      replicate: 'replicate-voice',
      minimax: 'minimax-tts-voice',
      elevenlabs: 'elevenlabs-voice'
    }
  },
  'tts-speed': {
    voiceIdentity: false,
    targets: {
      openai: 'openai-tts-speed',
      deepgram: 'deepgram-tts-speed',
      minimax: 'minimax-tts-speed',
      elevenlabs: 'elevenlabs-tts-speed'
    }
  },
  'tts-language': {
    voiceIdentity: false,
    targets: {
      grok: 'grok-tts-language',
      speechify: 'speechify-tts-language',
      cartesia: 'cartesia-tts-language',
      elevenlabs: 'elevenlabs-tts-language-code'
    }
  },
  'tts-ref-audio': {
    voiceIdentity: true,
    targets: {
      mistral: 'mistral-tts-ref-audio',
      speechify: 'speechify-tts-ref-audio',
      elevenlabs: 'elevenlabs-tts-ref-audio'
    }
  },
  'tts-voice-name': {
    voiceIdentity: true,
    targets: {
      mistral: 'mistral-tts-voice-name',
      speechify: 'speechify-tts-voice-name',
      elevenlabs: 'elevenlabs-tts-voice-name'
    }
  },
  'tts-consent-name': {
    voiceIdentity: false,
    targets: {
      speechify: 'speechify-tts-consent-name'
    }
  },
  'tts-consent-email': {
    voiceIdentity: false,
    targets: {
      speechify: 'speechify-tts-consent-email'
    }
  },
  'tts-text-normalization': {
    voiceIdentity: false,
    targets: {
      grok: 'grok-tts-text-normalization',
      minimax: 'minimax-tts-english-normalization',
      elevenlabs: 'elevenlabs-tts-text-normalization'
    }
  },
  'tts-instructions': {
    voiceIdentity: false,
    targets: {
      openai: 'openai-tts-instructions'
    }
  },
  'tts-output-format': {
    voiceIdentity: false,
    targets: {
      deepgram: 'deepgram-tts-encoding',
      speechify: 'speechify-tts-audio-format',
      elevenlabs: 'elevenlabs-tts-output-format'
    }
  }
} as const satisfies Record<string, {
  voiceIdentity: boolean
  targets: Record<string, string>
}>

// Every provider flag `--tts-voice` can normalize into. Derived so a provider added above is
// covered without a second list to keep in step.
const TTS_VOICE_OPTION_TARGETS = new Set<string>(Object.values(TTS_GENERIC_OPTION_TARGETS['tts-voice'].targets))

// Every generic row must classify itself above. The guard is then derived from that classification,
// so adding another voice-identity option cannot leave it outside the dialogue conflict check.
const TTS_VOICE_IDENTITY_OPTION_TARGETS = new Set<string>(
  Object.values(TTS_GENERIC_OPTION_TARGETS)
    .filter((definition) => definition.voiceIdentity)
    .flatMap((definition) => Object.values(definition.targets))
)

export const assertNoVoiceIdentityWithDialogue = (
  options: Pick<TtsOptions, 'ttsSpeakers'>,
  explicitFlags: ReadonlySet<string>
): void => {
  if ((options.ttsSpeakers?.length ?? 0) === 0) return

  const explicitIdentityTargets = [...TTS_VOICE_IDENTITY_OPTION_TARGETS]
    .filter((target) => explicitFlags.has(target))
  if (explicitIdentityTargets.length === 0) return

  if (explicitIdentityTargets.some((target) => TTS_VOICE_OPTION_TARGETS.has(target))) {
    throw CLIUsageError('--tts-voice cannot be combined with --tts-speaker/--tts-dialogue-format; per-speaker voices come from --tts-speaker mappings.')
  }

  throw CLIUsageError('Voice identity options such as --tts-ref-audio and --tts-voice-name cannot be combined with --tts-speaker/--tts-dialogue-format; per-speaker voices come from --tts-speaker mappings.')
}

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

const resolveGenericTtsOption = (
  flagName: string,
  provider: string,
  value: string | boolean
): { target: string, value: string | boolean, update: 'append' | 'set' } => {
  const providerTargets = TTS_GENERIC_OPTION_TARGETS[flagName as keyof typeof TTS_GENERIC_OPTION_TARGETS]?.targets
  const target = providerTargets?.[provider as keyof typeof providerTargets]
  if (!target) {
    throw CLIUsageError(`--${flagName} does not apply to ${provider} TTS.`)
  }

  if (booleanTtsOptionTargets.has(target)) {
    return {
      target,
      value: value === true || (typeof value === 'string' && !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase())),
      update: 'set'
    }
  }

  if (value === true) {
    throw CLIUsageError(`--${flagName} requires a value.`)
  }

  return { target, value, update: 'append' }
}

export const normalizeGenericTtsOptionFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  defaultProvider?: string | undefined
): SelectorNormalizationResult => {
  const selectedProviders = readSelectedTtsProviders(flags, defaultProvider)
  return applyFlagOccurrenceNormalization(flags, explicitFlags, flagOccurrences, (occurrence) => {
    if (!genericTtsOptionFlags.includes(occurrence.name)) {
      return undefined
    }
    const parsed = parseGenericTtsOptionValue(occurrence.value, occurrence.name)
    const provider = resolveGenericTtsOptionProvider(occurrence.name, parsed.provider, selectedProviders)
    const replacement = resolveGenericTtsOption(occurrence.name, provider, parsed.value)
    return [replaceFlagOccurrence(
      occurrence,
      replacement.target,
      replacement.value,
      replacement.update
    )]
  })
}
