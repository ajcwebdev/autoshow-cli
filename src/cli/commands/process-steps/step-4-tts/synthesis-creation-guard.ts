import type { TtsLegacyCreationDiagnosticOptionKey } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export type TtsSynthesisCreationOptionOrigin = 'explicit' | 'configured' | 'resolved'

export type TtsSynthesisCreationGuardContext = {
  explicitFlags?: ReadonlySet<string> | undefined
  configuredFlags?: ReadonlySet<string> | undefined
}

type BlockedCreationOption = {
  optionKey: TtsLegacyCreationDiagnosticOptionKey
  flagName: string
  provider: 'ElevenLabs' | 'Speechify' | 'Mistral'
  operation: string
  existingVoiceFlag: string
}

const BLOCKED_CREATION_OPTIONS: readonly BlockedCreationOption[] = [
  {
    optionKey: 'elevenlabsTtsRefAudio',
    flagName: 'elevenlabs-tts-ref-audio',
    provider: 'ElevenLabs',
    operation: 'reference-audio cloning',
    existingVoiceFlag: '--elevenlabs-voice'
  },
  {
    optionKey: 'elevenlabsTtsVoiceName',
    flagName: 'elevenlabs-tts-voice-name',
    provider: 'ElevenLabs',
    operation: 'named voice creation',
    existingVoiceFlag: '--elevenlabs-voice'
  },
  {
    optionKey: 'elevenlabsTtsCloneRemoveBackgroundNoise',
    flagName: 'elevenlabs-tts-clone-remove-background-noise',
    provider: 'ElevenLabs',
    operation: 'clone preparation',
    existingVoiceFlag: '--elevenlabs-voice'
  },
  {
    optionKey: 'speechifyTtsRefAudio',
    flagName: 'speechify-tts-ref-audio',
    provider: 'Speechify',
    operation: 'reference-audio cloning',
    existingVoiceFlag: '--speechify-voice'
  },
  {
    optionKey: 'speechifyTtsVoiceName',
    flagName: 'speechify-tts-voice-name',
    provider: 'Speechify',
    operation: 'named voice creation',
    existingVoiceFlag: '--speechify-voice'
  },
  {
    optionKey: 'speechifyTtsConsentName',
    flagName: 'speechify-tts-consent-name',
    provider: 'Speechify',
    operation: 'clone consent submission',
    existingVoiceFlag: '--speechify-voice'
  },
  {
    optionKey: 'speechifyTtsConsentEmail',
    flagName: 'speechify-tts-consent-email',
    provider: 'Speechify',
    operation: 'clone consent submission',
    existingVoiceFlag: '--speechify-voice'
  },
  {
    optionKey: 'speechifyTtsVoiceLocale',
    flagName: 'speechify-tts-voice-locale',
    provider: 'Speechify',
    operation: 'custom-voice creation',
    existingVoiceFlag: '--speechify-voice'
  },
  {
    optionKey: 'speechifyTtsVoiceGender',
    flagName: 'speechify-tts-voice-gender',
    provider: 'Speechify',
    operation: 'custom-voice creation',
    existingVoiceFlag: '--speechify-voice'
  },
  {
    optionKey: 'mistralTtsVoiceName',
    flagName: 'mistral-tts-voice-name',
    provider: 'Mistral',
    operation: 'named saved-reference creation',
    existingVoiceFlag: '--mistral-tts-voice'
  }
]

const hasCreationValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'boolean') return value
  return value !== undefined && value !== null
}

const resolveOrigin = (
  option: BlockedCreationOption,
  context: TtsSynthesisCreationGuardContext
): TtsSynthesisCreationOptionOrigin => {
  if (context.explicitFlags?.has(option.flagName)) return 'explicit'
  if (context.configuredFlags?.has(option.flagName)) return 'configured'
  return 'resolved'
}

const originLabel = (origin: TtsSynthesisCreationOptionOrigin): string => {
  switch (origin) {
    case 'explicit': return 'Explicit synthesis option'
    case 'configured': return 'Configured synthesis default'
    case 'resolved': return 'Synthesis option'
  }
}

const migrationHint = (option: BlockedCreationOption): string =>
  option.provider === 'Mistral'
    ? `Use an existing Mistral voice ID via ${option.existingVoiceFlag}, or authorize a one-off --tts-ref-audio reference. The voice command does not create Mistral saved voices.`
    : `Create or import the ${option.provider} voice explicitly with the shared \`voice\` command or \`comic reference-voice\`, then synthesize with its existing voice ID via ${option.existingVoiceFlag}.`

export const validateTtsSynthesisCreationOptions = (
  options: object,
  context: TtsSynthesisCreationGuardContext = {}
): void => {
  const optionRecord = options as Partial<Record<TtsLegacyCreationDiagnosticOptionKey, unknown>>
  for (const blocked of BLOCKED_CREATION_OPTIONS) {
    if (!hasCreationValue(optionRecord[blocked.optionKey])) continue
    const origin = resolveOrigin(blocked, context)
    throw CLIUsageError(
      `${originLabel(origin)} --${blocked.flagName} cannot perform ${blocked.operation} during TTS synthesis.`,
      migrationHint(blocked)
    )
  }
}
