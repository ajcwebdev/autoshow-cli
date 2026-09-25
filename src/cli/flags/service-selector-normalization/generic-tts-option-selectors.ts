import { UsageError } from '~/utils/error-handler'
import type { CliFlagOccurrence, SelectorNormalizationResult, TtsOptions } from '~/types'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './provider-targets'
import {
  createGenericProviderOptionSelectors,
  providersForGenericOption,
  type GenericOptionAssignment,
  type GenericOptionDomain
} from './generic-provider-option-selectors'
import {
  GENERIC_TTS_CONTROL_FLAGS,
  GENERIC_TTS_IDENTITY_FLAGS,
  ttsControlsForFlag,
  ttsIdentityProvidersForFlag
} from './generic-tts-controls'

const RETIRED_TTS_PROVIDERS = new Set(['minimax', 'deepgram', 'replicate', 'fal', 'fish', 'deepinfra', 'mistral'])

export const TTS_OPTION_DOMAIN: GenericOptionDomain = {
  label: 'TTS',
  allSelectedFlag: 'all-tts',
  providerTargets: STANDALONE_TTS_PROVIDER_TARGETS,
  retiredProviders: RETIRED_TTS_PROVIDERS,
  flagNames: [...GENERIC_TTS_IDENTITY_FLAGS, ...GENERIC_TTS_CONTROL_FLAGS],
  strictProviderQualifierFlags: ['tts-voice'],
  controlsFor: ttsControlsForFlag,
  identityProviders: ttsIdentityProvidersForFlag
}

const selectors = createGenericProviderOptionSelectors(TTS_OPTION_DOMAIN)

// Retained for consumers that only need "which providers accept this flag"; now computed from the
// control and identity maps rather than restated beside them.
export const GENERIC_TTS_OPTION_PROVIDERS = Object.fromEntries(
  TTS_OPTION_DOMAIN.flagNames.map((flagName) => [flagName, {
    voiceIdentity: ttsIdentityProvidersForFlag(flagName).length > 0,
    providers: providersForGenericOption(TTS_OPTION_DOMAIN, flagName)
  }])
) as Record<string, { voiceIdentity: boolean, providers: readonly string[] }>

export type GenericTtsOptionFlag = string

export const assertNoVoiceIdentityWithDialogue = (
  options: Pick<TtsOptions, 'ttsSpeakers'>,
  explicitFlags: ReadonlySet<string>
): void => {
  if ((options.ttsSpeakers?.length ?? 0) === 0) return

  if (explicitFlags.has('tts-voice')) {
    throw UsageError('--tts-voice cannot be combined with --tts-speaker/--tts-dialogue-format; per-speaker voices come from --tts-speaker mappings.')
  }
}

export const readSelectedTtsProviders = (
  flags: Record<string, unknown>,
  defaultProvider?: string | undefined
): string[] => selectors.readSelectedProviders(flags, defaultProvider)

export const parseGenericTtsOptionValue = (
  rawValue: string | boolean,
  flagName: string
): { provider?: string | undefined, value: string | boolean } => selectors.parseOptionValue(rawValue, flagName)

export const resolveGenericTtsOptionProvider = (
  flagName: string,
  parsedProvider: string | undefined,
  selectedProviders: string[],
  options: { allowUnscoped?: boolean } = {}
): string | undefined => selectors.resolveOptionProvider(flagName, parsedProvider, selectedProviders, options)

export const assertGenericTtsOptionSupported = (flagName: string, provider: string): void =>
  selectors.assertOptionSupported(flagName, provider)

export const requireGenericTtsOptionString = (flagName: string, value: string | boolean): string =>
  selectors.requireString(flagName, value)

export const parseGenericTtsBooleanOption = (value: string | boolean): boolean =>
  selectors.parseBoolean(value)

export const readGenericTtsOptionRawValues = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  flagName: string
): Array<string | boolean> => selectors.readRawValues(flags, flagOccurrences, flagName)

export type GenericTtsOptionAssignment = GenericOptionAssignment

export const resolveGenericTtsOptionAssignments = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  flagName: GenericTtsOptionFlag,
  selectedProviders: string[]
): GenericTtsOptionAssignment[] => selectors.resolveAssignments(flags, flagOccurrences, flagName, selectedProviders)

export const normalizeGenericTtsOptionFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  defaultProvider?: string | undefined
): SelectorNormalizationResult => selectors.normalizeFlags(flags, explicitFlags, flagOccurrences, defaultProvider)
