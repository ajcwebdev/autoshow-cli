import type { TtsOptions, TtsTargetSelection } from '~/types'
import { InternalError, UsageError } from '~/utils/error-handler'
import { resolveDialogueFormat } from '../dialogue-normalizer'
import { getMultiSpeakerStrategy } from './multi-speaker-capability'

export const validateMultiSpeakerTtsSelection = (
  options: TtsOptions,
  selection: TtsTargetSelection
): void => {
  if (!selection.multiSpeakerRequested) return

  resolveDialogueFormat(options)
  const registry = selection.speakerVoiceRegistry
  if (!registry) {
    throw InternalError('Multi-speaker TTS selection is missing its speaker registry', { stage: 'tts:targets' })
  }

  const allProviderModels = [
    { provider: 'gemini' as const, models: selection.geminiModels },
    { provider: 'elevenlabs' as const, models: selection.elevenlabsModels },
    { provider: 'soniox' as const, models: selection.sonioxModels ?? [] },
    { provider: 'grok' as const, models: selection.grokModels },
    { provider: 'openai' as const, models: selection.openaiModels },
    { provider: 'inworld' as const, models: selection.inworldModels },
  ]
  const selectedProviders = allProviderModels.filter((provider) => provider.models.length > 0)
  if (selectedProviders.length === 0) {
    throw UsageError('Multi-speaker TTS requires at least one TTS provider.')
  }
  if (selectedProviders.length !== 1) {
    throw UsageError(
      'The current --tts-speaker SPEAKER=VOICE mapping is provider-specific and requires exactly one TTS provider. '
      + 'Run providers separately or use a provider-qualified cast record so voice identifiers cannot cross provider namespaces.'
    )
  }
  if (!selectedProviders.some((provider) => getMultiSpeakerStrategy(provider.provider) !== undefined)) {
    throw UsageError('No selected TTS provider supports multi-speaker TTS.')
  }

  const referenceAudioSpeakers = registry.entries.filter((entry) => entry.voiceKind === 'ref-audio')
  if (referenceAudioSpeakers.length === 0) return

  throw UsageError('--tts-speaker reference audio is no longer supported. Use existing provider voice IDs.')
}
