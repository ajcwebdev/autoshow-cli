import { validateCartesiaTtsVoice, validateDeepgramTtsVoice, validateDeepinfraTtsVoice, validateElevenLabsTtsTextNormalization, validateFishTtsVoice, validateGeminiTtsVoice, validateGrokTtsLanguage, validateGrokTtsVoice, validateGroqTtsVoice, validateHumeTtsVoice, validateInworldTtsVoice, validateMinimaxTtsEmotion, validateMinimaxTtsLanguageBoost,   validateFalTtsVoice, validateReplicateTtsVoice, validateSpeechifyTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { CliFlagOccurrence, ResolvedModelOptions, TtsCliReferenceInput, TtsOptionResolutionAuthority, TtsOptionResolutionContext, TtsRuntimeOptionKey, TtsRuntimeOptions } from '~/types'
import { parseOptionalNumberFlag, parseTtsDialogueFormat, readBooleanFlag, readOptionalStringFlag, readOptionalStringListFlag } from './flag-readers'
import { validateCliValue } from './download-model-options'
import { pick } from '~/utils/cli-utils'
import { UsageError } from '~/utils/error-handler'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { parseSpeakerVoiceMappings } from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import {
  parseGenericTtsBooleanOption,
  parseGenericTtsOptionValue,
  readGenericTtsOptionRawValues,
  readSelectedTtsProviders,
  requireGenericTtsOptionString,
  resolveGenericTtsOptionAssignments
} from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'

const TTS_REF_AUDIO_FLAG = 'tts-ref-audio'

const readTtsRefAudioPath = (flags: Record<string, unknown>): string | undefined => {
  const values = readGenericTtsOptionRawValues(flags, [], TTS_REF_AUDIO_FLAG)
  if (values.length === 0) return undefined
  const parsed = parseGenericTtsOptionValue(values[values.length - 1] as string | boolean, TTS_REF_AUDIO_FLAG)
  if (parsed.provider && parsed.provider !== 'mistral') {
    throw UsageError(`--${TTS_REF_AUDIO_FLAG} does not apply to ${parsed.provider} TTS.`)
  }
  return requireGenericTtsOptionString(TTS_REF_AUDIO_FLAG, parsed.value).trim() || undefined
}

export const resolveStandaloneMistralTtsCliReferenceInput = (
  flags: Record<string, unknown>,
  context: TtsOptionResolutionContext = {}
): TtsCliReferenceInput | undefined => {
  const sourcePath = readTtsRefAudioPath(flags)
  if (!sourcePath) return undefined

  if (context.cliReferenceInput !== 'standalone-mistral') {
    throw UsageError(
      '--tts-ref-audio is an authorized edge input only for the standalone `tts` command.',
      'Use standalone `tts` with an explicit request reference, or create/import a voice with the shared `voice` command or `comic reference-voice` and synthesize with --tts-voice.'
    )
  }
  if (!context.explicitFlags?.has(TTS_REF_AUDIO_FLAG)) {
    const origin = context.configuredFlags?.has(TTS_REF_AUDIO_FLAG) ? 'Configured' : 'Inherited'
    throw UsageError(
      `${origin} --tts-ref-audio paths cannot be used as synthesis defaults.`,
      'Pass an authorized unnamed reference explicitly for this standalone Mistral TTS request, or create/import a voice with the shared `voice` command or `comic reference-voice` and synthesize with --tts-voice.'
    )
  }

  return {
    sourcePath,
    authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
  }
}

export const resolveStandaloneMistralTtsSpeakerReferenceInputs = (
  flags: Record<string, unknown>,
  context: TtsOptionResolutionContext & { flagOccurrences?: readonly CliFlagOccurrence[] | undefined } = {}
): TtsCliReferenceInput[] => {
  const values = readOptionalStringListFlag(flags, 'tts-speaker')
  const registry = parseSpeakerVoiceMappings(values)
  const referenceEntries = registry.entries.filter((entry) => entry.voiceKind === 'ref-audio')
  if (referenceEntries.length === 0) return []

  if (context.cliReferenceInput !== 'standalone-mistral') {
    throw UsageError(
      '--tts-speaker SPEAKER=path is an authorized edge input only for the standalone `tts` command.',
      'Use standalone `tts` with one explicitly selected Mistral provider, or create/import voices with the shared `voice` command or `comic reference-voice`.'
    )
  }

  const explicitOccurrences = (context.flagOccurrences ?? [])
    .filter((occurrence) => occurrence.name === 'tts-speaker' && typeof occurrence.value === 'string')
    .map((occurrence) => occurrence.value as string)
  const remainingExplicitValues = new Map<string, number>()
  for (const value of explicitOccurrences) {
    remainingExplicitValues.set(value, (remainingExplicitValues.get(value) ?? 0) + 1)
  }

  return registry.entries.flatMap((entry, index) => {
    if (entry.voiceKind !== 'ref-audio') return []
    const raw = values?.[index]
    const explicitCount = raw === undefined ? 0 : remainingExplicitValues.get(raw) ?? 0
    const explicitlyAuthorized = explicitOccurrences.length > 0
      ? explicitCount > 0
      : context.explicitFlags?.has('tts-speaker') === true
    if (!explicitlyAuthorized) {
      const origin = context.configuredFlags?.has('tts-speaker') ? 'Configured' : 'Inherited'
      throw UsageError(
        `${origin} --tts-speaker SPEAKER=path mappings cannot be used as synthesis defaults.`,
        'Pass each Mistral request reference explicitly to standalone `tts`, or create/import voices with the shared `voice` command or `comic reference-voice`.'
      )
    }
    if (raw !== undefined && explicitOccurrences.length > 0) {
      remainingExplicitValues.set(raw, explicitCount - 1)
    }
    return [{
      speakerKey: entry.normalizedSpeaker,
      sourcePath: entry.voice,
      authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
    }]
  })
}

const TTS_MODEL_KEYS = [
  'elevenlabsTtsModels', 'minimaxTtsModels',
  'groqTtsModels', 'grokTtsModels',
  'mistralTtsModels', 'openaiTtsModels',
  'geminiTtsModels', 'deepgramTtsModels',
  'speechifyTtsModels', 'humeTtsModels',
  'cartesiaTtsModels', 'fishTtsModels',
  'inworldTtsModels', 'deepinfraTtsModels',
  'replicateTtsModels', 'falTtsModels'
] as const satisfies readonly TtsRuntimeOptionKey[]

const TTS_SPEED_RANGES = {
  openai: { min: 0.25, max: 4 },
  deepgram: { min: 0.5, max: 2 },
  minimax: { min: 0.5, max: 2 },
  elevenlabs: { min: 0.7, max: 1.2 }
} as const

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
      case 'groq':
        options.groqVoiceId = readValidatedWhenSelected(voice, modelOptions.groqTtsModels, validateGroqTtsVoice)
        break
      case 'grok':
        options.grokTtsVoice = readValidatedWhenSelected(voice, modelOptions.grokTtsModels, validateGrokTtsVoice)
        break
      case 'mistral':
        options.mistralTtsVoice = voice
        break
      case 'openai':
        options.openaiVoiceId = voice
        break
      case 'gemini':
        options.geminiVoiceId = readValidatedWhenSelected(voice, modelOptions.geminiTtsModels, validateGeminiTtsVoice)
        break
      case 'deepgram':
        options.deepgramVoiceId = readValidatedWhenSelected(voice, modelOptions.deepgramTtsModels, validateDeepgramTtsVoice)
        break
      case 'speechify':
        options.speechifyVoice = readValidatedWhenSelected(voice, modelOptions.speechifyTtsModels, validateSpeechifyTtsVoice)
        break
      case 'hume':
        options.humeTtsVoice = readValidatedWhenSelected(voice, modelOptions.humeTtsModels, validateHumeTtsVoice)
        break
      case 'cartesia':
        options.cartesiaTtsVoice = readValidatedWhenSelected(voice, modelOptions.cartesiaTtsModels, validateCartesiaTtsVoice)
        break
      case 'fish':
        options.fishTtsVoice = readValidatedWhenSelected(voice, modelOptions.fishTtsModels, validateFishTtsVoice)
        break
      case 'inworld':
        options.inworldTtsVoice = readValidatedWhenSelected(voice, modelOptions.inworldTtsModels, validateInworldTtsVoice)
        break
      case 'deepinfra':
        options.deepinfraTtsVoice = readValidatedWhenSelected(voice, modelOptions.deepinfraTtsModels, validateDeepinfraTtsVoice)
        break
      case 'replicate':
        options.replicateTtsVoice = readValidatedWhenSelected(voice, modelOptions.replicateTtsModels, validateReplicateTtsVoice)
        break
      case 'fal':
        options.falTtsVoice = readValidatedWhenSelected(voice, modelOptions.falTtsModels, validateFalTtsVoice)
        break
      case 'minimax':
        options.minimaxTtsVoice = voice
        break
      case 'elevenlabs':
        options.elevenlabsVoiceId = voice
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-speed', selectedProviders)) {
    const speed = requireGenericTtsOptionString('tts-speed', value)
    const range = TTS_SPEED_RANGES[provider as keyof typeof TTS_SPEED_RANGES]
    if (range === undefined) {
      throw UsageError(`--tts-speed does not apply to ${provider} TTS.`)
    }
    const parsed = parseOptionalNumberFlag(speed, 'tts-speed', range)
    switch (provider) {
      case 'openai':
        options.openaiTtsSpeed = parsed
        break
      case 'deepgram':
        options.deepgramTtsSpeed = parsed
        break
      case 'minimax':
        options.minimaxTtsSpeed = parsed
        break
      case 'elevenlabs':
        options.elevenlabsTtsSpeed = parsed
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-language', selectedProviders)) {
    const language = requireGenericTtsOptionString('tts-language', value)
    switch (provider) {
      case 'grok':
        options.grokTtsLanguage = validateCliValue(validateGrokTtsLanguage, language)
        break
      case 'speechify':
        options.speechifyTtsLanguage = language
        break
      case 'cartesia':
        options.cartesiaTtsLanguage = language
        break
      case 'elevenlabs':
        options.elevenlabsTtsLanguageCode = language
        break
      case 'minimax':
        options.minimaxTtsLanguageBoost = validateCliValue(validateMinimaxTtsLanguageBoost, language)
        break
    }
  }

  for (const { provider, value } of resolveGenericTtsOptionAssignments(flags, flagOccurrences, 'tts-text-normalization', selectedProviders)) {
    switch (provider) {
      case 'grok':
        options.grokTtsTextNormalization = parseGenericTtsBooleanOption(value)
        break
      case 'minimax':
        options.minimaxTtsEnglishNormalization = parseGenericTtsBooleanOption(value)
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
    const instructions = requireGenericTtsOptionString('tts-instructions', value)
    switch (provider) {
      case 'openai':
        options.openaiTtsInstructions = instructions
        break
      case 'fal':
        options.falTtsInstructions = instructions
        break
      case 'inworld':
        options.inworldTtsInstructions = instructions
        break
    }
  }
}

export const buildTtsOptions = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  modelOptions: ResolvedModelOptions,
  originContext: {
    explicitFlags?: ReadonlySet<string> | undefined
    configuredFlags?: ReadonlySet<string> | undefined
  } & TtsOptionResolutionAuthority = {}
): TtsRuntimeOptions => {
  resolveStandaloneMistralTtsCliReferenceInput(flags, originContext)

  const ttsSpeakers = readOptionalStringListFlag(flags, 'tts-speaker')
  if (
    parseSpeakerVoiceMappings(ttsSpeakers).entries.some((entry) => entry.voiceKind === 'ref-audio')
    && originContext.mistralSpeakerReferences !== 'sanitized'
  ) {
    const origin = originContext.configuredFlags?.has('tts-speaker') ? 'Configured' : 'Inherited'
    throw UsageError(
      `${origin} --tts-speaker SPEAKER=path mappings cannot enter generic TTS runtime options.`,
      'Pass each path explicitly to standalone `tts` with one Mistral provider so it can cross protected ingestion, or use existing provider voice IDs.'
    )
  }

  const options: TtsRuntimeOptions = {
    ...pick(modelOptions, TTS_MODEL_KEYS),
    ttsAllowAmbiguousRedispatch: readBooleanFlag(flags, 'allow-ambiguous-redispatch'),
    grokTtsVoice: undefined,
    grokTtsLanguage: undefined,
    grokTtsTextNormalization: false,
    mistralTtsVoice: undefined,
    ttsDialogueFormat: parseTtsDialogueFormat(readOptionalStringFlag(flags, 'tts-dialogue-format')),
    ttsSpeakers,
    speechifyVoice: undefined,
    speechifyTtsLanguage: undefined,
    humeTtsVoice: undefined,
    cartesiaTtsVoice: undefined,
    cartesiaTtsLanguage: undefined,
    fishTtsVoice: undefined,
    inworldTtsVoice: undefined,
    inworldTtsInstructions: undefined,
    deepinfraTtsVoice: undefined,
    falTtsVoice: undefined,
    falTtsInstructions: undefined,
    replicateTtsVoice: undefined,
    groqVoiceId: undefined,
    openaiVoiceId: undefined,
    openaiTtsInstructions: undefined,
    openaiTtsSpeed: undefined,
    geminiVoiceId: undefined,
    deepgramVoiceId: undefined,
    deepgramTtsSpeed: undefined,
    elevenlabsTtsLanguageCode: undefined,
    elevenlabsTtsStability: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-stability'), 'elevenlabs-tts-stability', { min: 0, max: 1 }),
    elevenlabsTtsSimilarityBoost: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-similarity-boost'), 'elevenlabs-tts-similarity-boost', { min: 0, max: 1 }),
    elevenlabsTtsStyle: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-style'), 'elevenlabs-tts-style', { min: 0, max: 1 }),
    elevenlabsTtsUseSpeakerBoost: readBooleanFlag(flags, 'elevenlabs-tts-use-speaker-boost'),
    elevenlabsTtsSpeed: undefined,
    elevenlabsTtsSeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-seed'), 'elevenlabs-tts-seed', { min: 0, max: 4294967295, integer: true }),
    elevenlabsTtsTextNormalization: undefined,
    elevenlabsTtsPronunciationDictionaryLocators: readOptionalStringListFlag(flags, 'elevenlabs-tts-pronunciation-dictionary-locator'),
    minimaxTtsVoice: undefined,
    minimaxTtsLanguageBoost: undefined,
    minimaxTtsSpeed: undefined,
    minimaxTtsVolume: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-volume'), 'minimax-tts-volume', { min: 0, max: 10, exclusiveMin: true }),
    minimaxTtsPitch: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-pitch'), 'minimax-tts-pitch', { min: -12, max: 12, integer: true }),
    minimaxTtsEmotion: (() => {
      const value = readOptionalStringFlag(flags, 'minimax-tts-emotion')
      if (value === undefined) return undefined
      return validateCliValue(validateMinimaxTtsEmotion, value)
    })(),
    minimaxTtsEnglishNormalization: false,
    minimaxTtsPronunciations: readOptionalStringListFlag(flags, 'minimax-tts-pronunciation'),
    elevenlabsVoiceId: undefined,
  }

  applyGenericTtsRuntimeOptions(options, flags, flagOccurrences, modelOptions)
  return options
}
