import type { TtsOptions, TtsTargetSelection } from '~/types'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import {
  getGroqTtsVoicesForModel,
  validateGroqTtsVoice
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { resolveDialogueFormat } from '../dialogue-normalizer'
import { getMultiSpeakerStrategy } from './multi-speaker-capability'
import { getMistralProtectedSpeakerReferences } from '../voice-assets/mistral-protected-reference-binding'

const requireProviderSelectionMessage = (
  label: string,
  provider: string,
  detail: string
): string =>
  `${label} ${detail} require selecting ${provider} TTS with --provider/--tts ${provider}[=model] or an all-provider TTS run.`

export const validateTtsTargetSelection = (
  options: TtsOptions,
  selection: TtsTargetSelection
): void => {
  if (selection.multiSpeakerRequested) {
    resolveDialogueFormat(options)
    // multiSpeakerRequested is exactly "at least one --tts-speaker mapping parsed", so the registry
    // is always present and non-empty here; this only narrows the optional selection field.
    const registry = selection.speakerVoiceRegistry
    if (!registry) {
      throw InternalError('Multi-speaker TTS selection is missing its speaker registry', { stage: 'tts:targets' })
    }

    const allProviderModels = [
      { provider: 'kitten' as const, models: selection.kittenModels },
      { provider: 'elevenlabs' as const, models: selection.elevenlabsModels },
      { provider: 'minimax' as const, models: selection.minimaxModels },
      { provider: 'groq' as const, models: selection.groqModels },
      { provider: 'grok' as const, models: selection.grokModels },
      { provider: 'mistral' as const, models: selection.mistralModels },
      { provider: 'openai' as const, models: selection.openaiModels },
      { provider: 'gemini' as const, models: selection.geminiModels },
      { provider: 'deepgram' as const, models: selection.deepgramModels },
      { provider: 'speechify' as const, models: selection.speechifyModels },
      { provider: 'hume' as const, models: selection.humeModels },
      { provider: 'cartesia' as const, models: selection.cartesiaModels },
    ]
    const selectedProviders = allProviderModels.filter((p) => p.models.length > 0)
    if (selectedProviders.length === 0) {
      throw CLIUsageError('Multi-speaker TTS requires at least one TTS provider.')
    }
    if (selectedProviders.length !== 1) {
      throw CLIUsageError(
        'The current --tts-speaker SPEAKER=VOICE mapping is provider-specific and requires exactly one TTS provider. '
        + 'Run providers separately or use a provider-qualified cast record so voice identifiers cannot cross provider namespaces.'
      )
    }

    const hasCapable = selectedProviders.some((p) => getMultiSpeakerStrategy(p.provider) !== undefined)
    if (!hasCapable) {
      throw CLIUsageError('No selected TTS provider supports multi-speaker TTS.')
    }

    const refAudioSpeakers = registry.entries.filter((e) => e.voiceKind === 'ref-audio')
    if (refAudioSpeakers.length > 0) {
      const selected = selectedProviders[0]
      if (selected?.provider !== 'mistral') {
        throw CLIUsageError(
          `--tts-speaker SPEAKER=path is supported only by one explicitly selected Mistral TTS target, not ${selected?.provider ?? 'the selected provider'}.`,
          'Use existing provider voice IDs for this target, or run standalone `tts` with one Mistral provider and explicit reference paths.'
        )
      }
      const protectedReferences = getMistralProtectedSpeakerReferences(options)
      const protectedBySpeaker = new Map(protectedReferences?.entries.map((entry) => [entry.speakerKey, entry]) ?? [])
      if (
        !protectedReferences
        || protectedBySpeaker.size !== refAudioSpeakers.length
        || refAudioSpeakers.some((entry) => {
          const protectedReference = protectedBySpeaker.get(entry.normalizedSpeaker)
          return !protectedReference || entry.voice !== `ref_audio:${protectedReference.protectedAsset.assetId}`
        })
      ) {
        throw CLIUsageError(
          'Mistral dialogue reference paths must cross protected ingestion as exact per-speaker opaque assets before target collection.',
          'Pass every SPEAKER=path mapping explicitly to standalone `tts`; config, inherited paths, and copied runtime options are not authorized.'
        )
      }
    }
  }

  const hasMinimaxRequestControlFlags = Boolean(
    selection.minimaxLanguageBoost
    || typeof selection.minimaxSpeed === 'number'
    || typeof selection.minimaxVolume === 'number'
    || typeof selection.minimaxPitch === 'number'
    || selection.minimaxEmotion
    || selection.minimaxEnglishNormalization
    || (selection.minimaxPronunciations && selection.minimaxPronunciations.length > 0)
  )
  if (hasMinimaxRequestControlFlags && selection.minimaxModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('MiniMax TTS', 'minimax', 'request control flags'))
  }

  if ((selection.openaiInstructions || typeof selection.openaiSpeed === 'number') && selection.openaiModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('OpenAI TTS', 'openai', 'request control flags'))
  }
  if (selection.inworldInstructions && selection.inworldModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('Inworld TTS', 'inworld', 'request control flags'))
  }
  if (selection.openaiInstructions) {
    const incompatibleModels = selection.openaiModels.filter((model) => model !== 'gpt-4o-mini-tts-2025-12-15')
    if (incompatibleModels.length > 0) {
      throw CLIUsageError(`OpenAI TTS instructions are supported only by gpt-4o-mini-tts-2025-12-15; incompatible selected models: ${incompatibleModels.join(', ')}.`)
    }
  }

  if ((selection.grokLanguage || selection.grokTextNormalization) && selection.grokModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('Grok TTS', 'grok', 'request control flags'))
  }

  if (selection.groqVoiceId && selection.groqModels.length > 1) {
    const voice = validateGroqTtsVoice(selection.groqVoiceId)
    const matchingModel = selection.groqModels.find((model) =>
      getGroqTtsVoicesForModel(model as Parameters<typeof getGroqTtsVoicesForModel>[0]).includes(voice)
    )
    throw CLIUsageError(
      matchingModel
        ? `Groq TTS --tts-voice groq="${voice}" matches only ${matchingModel}; select --provider/--tts groq=${matchingModel}.`
        : `Groq TTS --tts-voice groq="${voice}" requires selecting a Groq TTS model with --provider/--tts groq[=model].`
    )
  }

  const hasDeepgramRequestControlFlags = Boolean(
    selection.deepgramEncoding
    || selection.deepgramContainer
    || typeof selection.deepgramBitRate === 'number'
    || typeof selection.deepgramSampleRate === 'number'
    || typeof selection.deepgramSpeed === 'number'
  )
  if (hasDeepgramRequestControlFlags && selection.deepgramModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('Deepgram TTS', 'deepgram', 'request control flags'))
  }

  const hasElevenLabsRequestControlFlags = Boolean(
    selection.elevenLabsOutputFormat
    || selection.elevenLabsLanguageCode
    || typeof selection.elevenLabsStability === 'number'
    || typeof selection.elevenLabsSimilarityBoost === 'number'
    || typeof selection.elevenLabsStyle === 'number'
    || selection.elevenLabsUseSpeakerBoost
    || typeof selection.elevenLabsSpeed === 'number'
    || typeof selection.elevenLabsSeed === 'number'
    || selection.elevenLabsTextNormalization
    || (selection.elevenLabsPronunciationDictionaryLocators && selection.elevenLabsPronunciationDictionaryLocators.length > 0)
    || typeof selection.elevenLabsOptimizeStreamingLatency === 'number'
  )
  if (hasElevenLabsRequestControlFlags && selection.elevenlabsModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('ElevenLabs TTS', 'elevenlabs', 'request control flags'))
  }
  if ((selection.speechifyAudioFormat || selection.speechifyLanguage) && selection.speechifyModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('Speechify TTS', 'speechify', 'request control flags'))
  }

  if ((selection.humeVoice || selection.humeVoiceProvider) && selection.humeModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('Hume TTS', 'hume', 'voice flags'))
  }

  if ((selection.cartesiaVoiceId || selection.cartesiaLanguage) && selection.cartesiaModels.length === 0) {
    throw CLIUsageError(requireProviderSelectionMessage('Cartesia TTS', 'cartesia', 'request control flags'))
  }

}
