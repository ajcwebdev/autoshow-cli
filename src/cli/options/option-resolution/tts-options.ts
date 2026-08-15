import { validateCartesiaTtsVoice, validateDeepgramTtsVoice, validateDeepinfraTtsVoice, validateElevenLabsTtsTextNormalization, validateFishTtsVoice, validateGeminiTtsVoice, validateGrokTtsLanguage, validateGrokTtsVoice, validateGroqTtsVoice, validateHumeTtsVoice, validateHumeTtsVoiceProvider, validateInworldTtsVoice, validateMinimaxTtsEmotion, validateMinimaxTtsLanguageBoost,   validateFalTtsVoice, validateReplicateTtsVoice, validateSpeechifyTtsAudioFormat, validateSpeechifyTtsVoice } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { CliFlagOccurrence, ResolvedModelOptions, TtsCliReferenceInput, TtsLegacyCreationDiagnosticOptions, TtsOptionResolutionAuthority, TtsRuntimeOptionKey, TtsRuntimeOptions } from '~/types'
import { parseOptionalNumberFlag, parseTtsDialogueFormat, readBooleanFlag, readOptionalOccurrenceStringFlag, readOptionalStringFlag, readOptionalStringListFlag } from './flag-readers'
import { validateCliValue } from './download-model-options'
import { pick } from '~/utils/cli-utils'
import { validateTtsSynthesisCreationOptions } from '~/cli/commands/process-steps/step-4-tts/synthesis-creation-guard'
import { CLIUsageError } from '~/utils/error-handler'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { parseSpeakerVoiceMappings } from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'

type TtsOptionResolutionContext = TtsOptionResolutionAuthority & {
  explicitFlags?: ReadonlySet<string> | undefined
  configuredFlags?: ReadonlySet<string> | undefined
}

export const resolveStandaloneMistralTtsCliReferenceInput = (
  flags: Record<string, unknown>,
  context: TtsOptionResolutionContext = {}
): TtsCliReferenceInput | undefined => {
  const sourcePath = readOptionalStringFlag(flags, 'mistral-tts-ref-audio')?.trim()
  if (!sourcePath) return undefined

  if (context.cliReferenceInput !== 'standalone-mistral') {
    throw CLIUsageError(
      '--mistral-tts-ref-audio is an authorized edge input only for the standalone `tts` command.',
      'Use standalone `tts` with an explicit request reference, or create/import a voice with the shared `voice` command or `comic reference-voice` and synthesize with --mistral-tts-voice.'
    )
  }
  if (!context.explicitFlags?.has('mistral-tts-ref-audio')) {
    const origin = context.configuredFlags?.has('mistral-tts-ref-audio') ? 'Configured' : 'Inherited'
    throw CLIUsageError(
      `${origin} --mistral-tts-ref-audio paths cannot be used as synthesis defaults.`,
      'Pass an authorized unnamed reference explicitly for this standalone Mistral TTS request, or create/import a voice with the shared `voice` command or `comic reference-voice` and synthesize with --mistral-tts-voice.'
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
    throw CLIUsageError(
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
      throw CLIUsageError(
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

export const TTS_MODEL_KEYS = [
  'elevenlabsTtsModels', 'elevenlabsTtsModel', 'minimaxTtsModels', 'minimaxTtsModel',
  'groqTtsModels', 'groqTtsModel', 'grokTtsModels', 'grokTtsModel',
  'mistralTtsModels', 'mistralTtsModel', 'openaiTtsModels', 'openaiTtsModel',
  'geminiTtsModels', 'geminiTtsModel', 'deepgramTtsModels', 'deepgramTtsModel',
  'speechifyTtsModels', 'speechifyTtsModel', 'humeTtsModels', 'humeTtsModel',
  'cartesiaTtsModels', 'cartesiaTtsModel', 'fishTtsModels', 'fishTtsModel',
  'inworldTtsModels', 'inworldTtsModel', 'deepinfraTtsModels', 'deepinfraTtsModel',
  'replicateTtsModels', 'replicateTtsModel', 'falTtsModels', 'falTtsModel'
] as const satisfies readonly TtsRuntimeOptionKey[]

export const buildTtsOptions = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  modelOptions: ResolvedModelOptions,
  originContext: {
    explicitFlags?: ReadonlySet<string> | undefined
    configuredFlags?: ReadonlySet<string> | undefined
  } & TtsOptionResolutionAuthority = {}
): TtsRuntimeOptions => {
  const {
    groqTtsModels,
    grokTtsModels,
    deepgramTtsModels,
    speechifyTtsModels,
    humeTtsModels,
    cartesiaTtsModels,
  } = modelOptions

  const creationDiagnostics: TtsLegacyCreationDiagnosticOptions = {
    mistralTtsVoiceName: readOptionalOccurrenceStringFlag(flagOccurrences, 'mistral-tts-voice-name') ?? readOptionalStringFlag(flags, 'mistral-tts-voice-name'),
    elevenlabsTtsRefAudio: readOptionalStringFlag(flags, 'elevenlabs-tts-ref-audio'),
    elevenlabsTtsVoiceName: readOptionalOccurrenceStringFlag(flagOccurrences, 'elevenlabs-tts-voice-name') ?? readOptionalStringFlag(flags, 'elevenlabs-tts-voice-name'),
    elevenlabsTtsCloneRemoveBackgroundNoise: readBooleanFlag(flags, 'elevenlabs-tts-clone-remove-background-noise'),
    speechifyTtsRefAudio: readOptionalStringFlag(flags, 'speechify-tts-ref-audio'),
    speechifyTtsVoiceName: readOptionalOccurrenceStringFlag(flagOccurrences, 'speechify-tts-voice-name') ?? readOptionalStringFlag(flags, 'speechify-tts-voice-name'),
    speechifyTtsConsentName: readOptionalOccurrenceStringFlag(flagOccurrences, 'speechify-tts-consent-name') ?? readOptionalStringFlag(flags, 'speechify-tts-consent-name'),
    speechifyTtsConsentEmail: readOptionalStringFlag(flags, 'speechify-tts-consent-email'),
    speechifyTtsVoiceLocale: readOptionalStringFlag(flags, 'speechify-tts-voice-locale'),
    speechifyTtsVoiceGender: readOptionalStringFlag(flags, 'speechify-tts-voice-gender')
  }
  validateTtsSynthesisCreationOptions(creationDiagnostics, originContext)
  resolveStandaloneMistralTtsCliReferenceInput(flags, originContext)

  const ttsSpeakers = readOptionalStringListFlag(flags, 'tts-speaker')
  if (
    parseSpeakerVoiceMappings(ttsSpeakers).entries.some((entry) => entry.voiceKind === 'ref-audio')
    && originContext.mistralSpeakerReferences !== 'sanitized'
  ) {
    const origin = originContext.configuredFlags?.has('tts-speaker') ? 'Configured' : 'Inherited'
    throw CLIUsageError(
      `${origin} --tts-speaker SPEAKER=path mappings cannot enter generic TTS runtime options.`,
      'Pass each path explicitly to standalone `tts` with one Mistral provider so it can cross protected ingestion, or use existing provider voice IDs.'
    )
  }

  const options: TtsRuntimeOptions = {
    ...pick(modelOptions, TTS_MODEL_KEYS),
    ttsAllowAmbiguousRedispatch: readBooleanFlag(flags, 'tts-allow-ambiguous-redispatch'),
    grokTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'grok-tts-voice')
      if (value === undefined) return undefined
      if (grokTtsModels === undefined) return value
      return validateCliValue(validateGrokTtsVoice, value)
    })(),
    grokTtsLanguage: (() => {
      const value = readOptionalStringFlag(flags, 'grok-tts-language')
      if (value === undefined) return undefined
      return validateCliValue(validateGrokTtsLanguage, value)
    })(),
    grokTtsTextNormalization: readBooleanFlag(flags, 'grok-tts-text-normalization'),
    mistralTtsVoice: readOptionalStringFlag(flags, 'mistral-tts-voice'),
    ttsDialogueFormat: parseTtsDialogueFormat(readOptionalStringFlag(flags, 'tts-dialogue-format')),
    ttsSpeakers,
    speechifyVoice: (() => {
      const value = readOptionalStringFlag(flags, 'speechify-voice')
      if (value === undefined) return undefined
      if (speechifyTtsModels === undefined) return value
      return validateCliValue(validateSpeechifyTtsVoice, value)
    })(),
    speechifyTtsAudioFormat: (() => {
      const value = readOptionalStringFlag(flags, 'speechify-tts-audio-format')
      if (value === undefined) return undefined
      return validateCliValue(validateSpeechifyTtsAudioFormat, value)
    })(),
    speechifyTtsLanguage: readOptionalStringFlag(flags, 'speechify-tts-language'),
    humeTtsVoice: (() => {
      const value = readOptionalOccurrenceStringFlag(flagOccurrences, 'hume-tts-voice') ?? readOptionalStringFlag(flags, 'hume-tts-voice')
      if (value === undefined) return undefined
      if (humeTtsModels === undefined) return value
      return validateCliValue(validateHumeTtsVoice, value)
    })(),
    humeTtsVoiceProvider: (() => {
      const value = readOptionalStringFlag(flags, 'hume-tts-voice-provider')
      if (value === undefined) return undefined
      return validateCliValue(validateHumeTtsVoiceProvider, value)
    })(),
    cartesiaTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'cartesia-tts-voice')
      if (value === undefined) return undefined
      if (cartesiaTtsModels === undefined) return value
      return validateCliValue(validateCartesiaTtsVoice, value)
    })(),
    cartesiaTtsLanguage: readOptionalStringFlag(flags, 'cartesia-tts-language'),
    fishTtsModels: modelOptions.fishTtsModels,
    fishTtsModel: modelOptions.fishTtsModel,
    fishTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'fish-tts-voice')
      if (value === undefined) return undefined
      if (modelOptions.fishTtsModels === undefined) return value
      return validateCliValue(validateFishTtsVoice, value)
    })(),
    inworldTtsModels: modelOptions.inworldTtsModels,
    inworldTtsModel: modelOptions.inworldTtsModel,
    inworldTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'inworld-voice')
      if (value === undefined) return undefined
      if (modelOptions.inworldTtsModels === undefined) return value
      return validateCliValue(validateInworldTtsVoice, value)
    })(),
    inworldTtsInstructions: readOptionalOccurrenceStringFlag(flagOccurrences, 'inworld-tts-instructions') ?? readOptionalStringFlag(flags, 'inworld-tts-instructions'),
    deepinfraTtsModels: modelOptions.deepinfraTtsModels,
    deepinfraTtsModel: modelOptions.deepinfraTtsModel,
    deepinfraTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'deepinfra-voice')
      if (value === undefined) return undefined
      if (modelOptions.deepinfraTtsModels === undefined) return value
      return validateCliValue(validateDeepinfraTtsVoice, value)
    })(),
    falTtsModels: modelOptions.falTtsModels,
    falTtsModel: modelOptions.falTtsModel,
    falTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'fal-voice')
      if (value === undefined) return undefined
      if (modelOptions.falTtsModels === undefined) return value
      return validateCliValue(validateFalTtsVoice, value)
    })(),
    falTtsInstructions: readOptionalStringFlag(flags, 'fal-tts-instructions'),
    replicateTtsModels: modelOptions.replicateTtsModels,
    replicateTtsModel: modelOptions.replicateTtsModel,
    replicateTtsVoice: (() => {
      const value = readOptionalStringFlag(flags, 'replicate-voice')
      if (value === undefined) return undefined
      if (modelOptions.replicateTtsModels === undefined) return value
      return validateCliValue(validateReplicateTtsVoice, value)
    })(),
    groqVoiceId: (() => {
      const value = readOptionalStringFlag(flags, 'groq-voice')
      if (value === undefined) return undefined
      if (groqTtsModels === undefined) return value
      return validateCliValue(validateGroqTtsVoice, value)
    })(),
    openaiVoiceId: readOptionalStringFlag(flags, 'openai-voice'),
    openaiTtsInstructions: readOptionalOccurrenceStringFlag(flagOccurrences, 'openai-tts-instructions') ?? readOptionalStringFlag(flags, 'openai-tts-instructions'),
    openaiTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'openai-tts-speed'), 'openai-tts-speed', { min: 0.25, max: 4 }),
    geminiVoiceId: (() => {
      const value = readOptionalStringFlag(flags, 'gemini-voice')
      if (value === undefined) return undefined
      if (modelOptions.geminiTtsModels === undefined) return value
      return validateCliValue(validateGeminiTtsVoice, value)
    })(),
    deepgramVoiceId: (() => {
      const value = readOptionalStringFlag(flags, 'deepgram-voice')
      if (value === undefined) return undefined
      if (deepgramTtsModels === undefined) return value
      return validateCliValue(validateDeepgramTtsVoice, value)
    })(),
    deepgramTtsEncoding: readOptionalStringFlag(flags, 'deepgram-tts-encoding'),
    deepgramTtsContainer: readOptionalStringFlag(flags, 'deepgram-tts-container'),
    deepgramTtsBitRate: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'deepgram-tts-bit-rate'), 'deepgram-tts-bit-rate', { min: 1, max: 1000000, integer: true }),
    deepgramTtsSampleRate: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'deepgram-tts-sample-rate'), 'deepgram-tts-sample-rate', { min: 1, max: 192000, integer: true }),
    deepgramTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'deepgram-tts-speed'), 'deepgram-tts-speed', { min: 0.5, max: 2 }),
    elevenlabsTtsOutputFormat: readOptionalStringFlag(flags, 'elevenlabs-tts-output-format'),
    elevenlabsTtsLanguageCode: readOptionalStringFlag(flags, 'elevenlabs-tts-language-code'),
    elevenlabsTtsStability: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-stability'), 'elevenlabs-tts-stability', { min: 0, max: 1 }),
    elevenlabsTtsSimilarityBoost: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-similarity-boost'), 'elevenlabs-tts-similarity-boost', { min: 0, max: 1 }),
    elevenlabsTtsStyle: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-style'), 'elevenlabs-tts-style', { min: 0, max: 1 }),
    elevenlabsTtsUseSpeakerBoost: readBooleanFlag(flags, 'elevenlabs-tts-use-speaker-boost'),
    elevenlabsTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-speed'), 'elevenlabs-tts-speed', { min: 0.7, max: 1.2 }),
    elevenlabsTtsSeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'elevenlabs-tts-seed'), 'elevenlabs-tts-seed', { min: 0, max: 4294967295, integer: true }),
    elevenlabsTtsTextNormalization: (() => {
      const value = readOptionalStringFlag(flags, 'elevenlabs-tts-text-normalization')
      if (value === undefined) return undefined
      return validateCliValue(validateElevenLabsTtsTextNormalization, value)
    })(),
    elevenlabsTtsPronunciationDictionaryLocators: readOptionalStringListFlag(flags, 'elevenlabs-tts-pronunciation-dictionary-locator'),
    minimaxTtsVoice: readOptionalStringFlag(flags, 'minimax-tts-voice'),
    minimaxTtsLanguageBoost: (() => {
      const value = readOptionalStringFlag(flags, 'minimax-tts-language-boost')
      if (value === undefined) return undefined
      return validateCliValue(validateMinimaxTtsLanguageBoost, value)
    })(),
    minimaxTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-speed'), 'minimax-tts-speed', { min: 0.5, max: 2 }),
    minimaxTtsVolume: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-volume'), 'minimax-tts-volume', { min: 0, max: 10, exclusiveMin: true }),
    minimaxTtsPitch: parseOptionalNumberFlag(readOptionalStringFlag(flags, 'minimax-tts-pitch'), 'minimax-tts-pitch', { min: -12, max: 12, integer: true }),
    minimaxTtsEmotion: (() => {
      const value = readOptionalStringFlag(flags, 'minimax-tts-emotion')
      if (value === undefined) return undefined
      return validateCliValue(validateMinimaxTtsEmotion, value)
    })(),
    minimaxTtsEnglishNormalization: readBooleanFlag(flags, 'minimax-tts-english-normalization'),
    minimaxTtsPronunciations: readOptionalStringListFlag(flags, 'minimax-tts-pronunciation'),
    elevenlabsVoiceId: readOptionalStringFlag(flags, 'elevenlabs-voice'),
  }

  return options
}
