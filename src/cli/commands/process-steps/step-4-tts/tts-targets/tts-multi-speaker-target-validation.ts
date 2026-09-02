import type { TtsOptions, TtsTargetSelection } from '~/types'
import { InternalError, UsageError } from '~/utils/error-handler'
import { resolveDialogueFormat } from '../dialogue-normalizer'
import { getMistralProtectedSpeakerReferences } from '../voice-assets/mistral-protected-reference-binding'
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
    { provider: 'elevenlabs' as const, models: selection.elevenlabsModels },
    { provider: 'grok' as const, models: selection.grokModels },
    { provider: 'mistral' as const, models: selection.mistralModels },
    { provider: 'openai' as const, models: selection.openaiModels },
    { provider: 'speechify' as const, models: selection.speechifyModels },
    { provider: 'hume' as const, models: selection.humeModels },
    { provider: 'cartesia' as const, models: selection.cartesiaModels },
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

  const selected = selectedProviders[0]
  if (selected?.provider !== 'mistral') {
    throw UsageError(
      `--tts-speaker SPEAKER=path is supported only by one explicitly selected Mistral TTS target, not ${selected?.provider ?? 'the selected provider'}.`,
      { hints: ['Use existing provider voice IDs for this target, or run standalone `tts` with one Mistral provider and explicit reference paths.'] }
    )
  }
  const protectedReferences = getMistralProtectedSpeakerReferences(options)
  const protectedBySpeaker = new Map(protectedReferences?.entries.map((entry) => [entry.speakerKey, entry]) ?? [])
  if (
    !protectedReferences
    || protectedBySpeaker.size !== referenceAudioSpeakers.length
    || referenceAudioSpeakers.some((entry) => {
      const protectedReference = protectedBySpeaker.get(entry.normalizedSpeaker)
      return !protectedReference || entry.voice !== `ref_audio:${protectedReference.protectedAsset.assetId}`
    })
  ) {
    throw UsageError(
      'Mistral dialogue reference paths must cross protected ingestion as exact per-speaker opaque assets before target collection.',
      { hints: ['Pass every SPEAKER=path mapping explicitly to standalone `tts`; config, inherited paths, and copied runtime options are not authorized.'] }
    )
  }
}
