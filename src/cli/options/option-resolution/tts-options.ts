import { validateSonioxTtsVoice, validateSonioxTtsLanguage, validateElevenLabsTtsTextNormalization, validateGrokTtsLanguage, validateGrokTtsVoice, validateInworldTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { CliFlagOccurrence, ResolvedModelOptions, TtsProvider, TtsRuntimeOptionKey, TtsRuntimeOptions } from '~/types'
import { parseTtsDialogueFormat, readBooleanFlag, readOptionalStringFlag, readOptionalStringListFlag } from './flag-readers'
import { validateCliValue } from './download-model-options'
import { pick } from '~/utils/cli-utils'
import { UsageError } from '~/utils/error-handler'
import { parseSpeakerVoiceMappings } from '~/cli/commands/audio/tts/dialogue-normalizer'
import { normalizeControlValue } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { ttsControlsForFlag } from '~/cli/flags/service-selector-normalization/generic-tts-controls'
import {
  parseGenericTtsBooleanOption,
  readSelectedTtsProviders,
  requireGenericTtsOptionString,
  resolveGenericTtsOptionAssignments
} from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'

const TTS_MODEL_KEYS = [
  'geminiTtsModels',
  'elevenlabsTtsModels',
  'sonioxTtsModels',
  'grokTtsModels',
  'openaiTtsModels',
  'inworldTtsModels'
] as const satisfies readonly TtsRuntimeOptionKey[]

// Bounds and allowed values come from CONTROL_SPECS via normalizeControlValue; the flag layer only
// supplies CLI wording for the failure.
const controlUsageError = (provider: string, key: string, detail: string): Error =>
  UsageError(`--${key} for ${provider}: ${detail}.`)

const coerceControlValue = (
  flagName: string,
  provider: string,
  value: string | boolean
): string | number | boolean | readonly string[] => {
  const control = ttsControlsForFlag(flagName)[provider]
  if (!control) throw UsageError(`--${flagName} does not apply to ${provider} TTS.`)
  const spec = control.spec
  const raw = spec.kind === 'number'
    ? Number(requireGenericTtsOptionString(flagName, value))
    : spec.kind === 'boolean'
      ? parseGenericTtsBooleanOption(value)
      : spec.kind === 'string-array'
        ? [requireGenericTtsOptionString(flagName, value)]
        : requireGenericTtsOptionString(flagName, value)
  return normalizeControlValue(
    provider as TtsProvider,
    flagName,
    raw as never,
    spec,
    controlUsageError as never
  ) as string | number | boolean | readonly string[]
}

const coerceNumberControl = (flagName: string, provider: string, value: string | boolean): number =>
  coerceControlValue(flagName, provider, value) as number

const readValidatedWhenSelected = (
  value: string,
  models: string[] | undefined,
  validator: (value: string) => string
): string => models === undefined ? value : validateCliValue(validator, value)

const applyGenericTtsRuntimeOptions = (
  options: TtsRuntimeOptions,
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  modelOptions: ResolvedModelOptions
): void => {
  const selectedProviders = readSelectedTtsProviders(flags)

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-voice', selectedProviders)) {
    const voice = requireGenericTtsOptionString('tts-voice', value)
    switch (provider) {
      case 'gemini': options.geminiTtsVoice = voice; break
      case 'soniox':
        options.sonioxTtsVoice = readValidatedWhenSelected(voice, modelOptions.sonioxTtsModels, validateSonioxTtsVoice)
        break
      case 'grok':
        options.grokTtsVoice = readValidatedWhenSelected(voice, modelOptions.grokTtsModels, validateGrokTtsVoice)
        break
      case 'openai':
        options.openaiVoiceId = voice
        break
      case 'inworld':
        options.inworldTtsVoice = readValidatedWhenSelected(voice, modelOptions.inworldTtsModels, validateInworldTtsVoice)
        break
      case 'elevenlabs':
        options.elevenlabsVoiceId = voice
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-speed', selectedProviders)) {
    const parsed = coerceNumberControl('tts-speed', provider, value)
    switch (provider) {
      case 'soniox': options.sonioxTtsSpeed = parsed; break
      case 'grok': options.grokTtsSpeed = parsed; break
      case 'inworld': options.inworldTtsSpeed = parsed; break
      case 'openai':
        options.openaiTtsSpeed = parsed
        break
      case 'elevenlabs':
        options.elevenlabsTtsSpeed = parsed
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-language', selectedProviders)) {
    const language = requireGenericTtsOptionString('tts-language', value)
    switch (provider) {
      case 'soniox':
        options.sonioxTtsLanguage = validateCliValue(validateSonioxTtsLanguage, language)
        break
      case 'grok':
        options.grokTtsLanguage = validateCliValue(validateGrokTtsLanguage, language)
        break
      case 'elevenlabs':
        options.elevenlabsTtsLanguageCode = language
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-text-normalization', selectedProviders)) {
    switch (provider) {
      case 'grok':
        options.grokTtsTextNormalization = parseGenericTtsBooleanOption(value)
        break
      case 'elevenlabs':
        options.elevenlabsTtsTextNormalization = validateCliValue(
          validateElevenLabsTtsTextNormalization,
          requireGenericTtsOptionString('tts-text-normalization', value)
        )
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-instructions', selectedProviders)) {
    const instructions = coerceControlValue('tts-instructions', provider, value) as string
    switch (provider) {
      case 'gemini': options.geminiTtsInstructions = instructions; break
      case 'openai':
        options.openaiTtsInstructions = instructions
        break
      case 'inworld':
        options.inworldTtsInstructions = instructions
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-stability', selectedProviders)) {
    if (provider === 'elevenlabs') options.elevenlabsTtsStability = coerceNumberControl('tts-stability', provider, value)
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-similarity', selectedProviders)) {
    if (provider === 'elevenlabs') options.elevenlabsTtsSimilarityBoost = coerceNumberControl('tts-similarity', provider, value)
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-style', selectedProviders)) {
    if (provider === 'elevenlabs') options.elevenlabsTtsStyle = coerceNumberControl('tts-style', provider, value)
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-speaker-boost', selectedProviders)) {
    if (provider === 'elevenlabs') options.elevenlabsTtsUseSpeakerBoost = coerceControlValue('tts-speaker-boost', provider, value) as boolean
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-seed', selectedProviders)) {
    if (provider === 'elevenlabs') options.elevenlabsTtsSeed = coerceNumberControl('tts-seed', provider, value)
  }

  const pronunciationLocators: string[] = []
  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-pronunciation-dictionary', selectedProviders)) {
    if (provider === 'elevenlabs') {
      pronunciationLocators.push(...coerceControlValue('tts-pronunciation-dictionary', provider, value) as readonly string[])
    }
  }
  if (pronunciationLocators.length > 0) options.elevenlabsTtsPronunciationDictionaryLocators = pronunciationLocators

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-response-format', selectedProviders)) {
    if (provider === 'gemini') options.geminiTtsResponseFormat = coerceControlValue('tts-response-format', provider, value) as string
    if (provider === 'elevenlabs') options.elevenlabsTtsResponseFormat = coerceControlValue('tts-response-format', provider, value) as string
  }
}

export const buildTtsOptions = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  modelOptions: ResolvedModelOptions
): TtsRuntimeOptions => {
  if (Object.keys(flags).some(key => /^(?:mistral-tts|mistralTts)/.test(key))) throw UsageError('Mistral TTS is no longer supported.')
  if (flags['tts-ref-audio'] !== undefined) throw UsageError('--tts-ref-audio is no longer supported.')

  const ttsSpeakers = readOptionalStringListFlag(flags, 'tts-speaker')
  if (
    parseSpeakerVoiceMappings(ttsSpeakers).entries.some((entry) => entry.voiceKind === 'ref-audio')
  ) {
    throw UsageError('--tts-speaker reference audio is no longer supported. Use existing provider voice IDs.')
  }

  const options: TtsRuntimeOptions = {
    ...pick(modelOptions, TTS_MODEL_KEYS),
    ttsAllProvidersSelected: readBooleanFlag(flags, 'all-tts'),
    ttsAllowAmbiguousRedispatch: readBooleanFlag(flags, 'allow-ambiguous-redispatch'),
    grokTtsVoice: undefined,
    grokTtsLanguage: undefined,
    grokTtsTextNormalization: false,
    ttsDialogueFormat: parseTtsDialogueFormat(readOptionalStringFlag(flags, 'tts-dialogue-format')),
    ttsSpeakers,
    inworldTtsVoice: undefined,
    inworldTtsInstructions: undefined,
    inworldTtsSpeed: undefined,
    openaiVoiceId: undefined,
    openaiTtsInstructions: undefined,
    openaiTtsSpeed: undefined,
    elevenlabsTtsLanguageCode: undefined,
    elevenlabsTtsStability: undefined,
    elevenlabsTtsSimilarityBoost: undefined,
    elevenlabsTtsStyle: undefined,
    elevenlabsTtsUseSpeakerBoost: false,
    elevenlabsTtsSpeed: undefined,
    elevenlabsTtsSeed: undefined,
    elevenlabsTtsTextNormalization: undefined,
    elevenlabsTtsPronunciationDictionaryLocators: undefined,
    elevenlabsVoiceId: undefined,
    elevenlabsTtsResponseFormat: undefined,
  }

  const mode = readOptionalStringFlag(flags, 'gemini-tts-mode')
  const wait = readOptionalStringFlag(flags, 'gemini-tts-batch-wait-seconds')
  if (mode !== undefined && !['unary', 'stream', 'batch'].includes(mode)) throw UsageError('--gemini-tts-mode must be unary, stream, or batch.')
  if ((mode !== undefined || wait !== undefined) && !options.geminiTtsModels?.length) throw UsageError('Gemini transport controls require an explicit Gemini TTS selection.')
  if (mode === 'batch' && options.ttsAllProvidersSelected) throw UsageError('Gemini remote Batch mode requires explicit --provider gemini selection.')
  if (wait !== undefined && (mode !== 'batch' || !Number.isSafeInteger(Number(wait)) || Number(wait) < 0 || Number(wait) > 86400)) throw UsageError('--gemini-tts-batch-wait-seconds requires batch mode and an integer from 0 to 86400.')
  if (mode) options.geminiTtsMode = mode as 'unary' | 'stream' | 'batch'
  if (wait !== undefined) options.geminiTtsBatchWaitSeconds = Number(wait)
  applyGenericTtsRuntimeOptions(options, flags, flagOccurrences, modelOptions)
  return options
}
