import {
  SUPPORTED_MINIMAX_TTS_EMOTIONS,
  SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS,
  SUPPORTED_HUME_TTS_VOICE_PROVIDERS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { SPEECHIFY_CUSTOM_VOICE_GENDERS } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { batchFlags, booleanAllLocalFlag, booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatValueList, pickFlags, withHelpGroup } from './flag-utils'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import type { CliFlagsDefinition } from '~/types'

export const ttsFlags = {
  'minimax-tts-language-boost': {
    description: `MiniMax TTS language boost: ${formatValueList(SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)}`,
    type: String
  },
  'minimax-tts-volume': {
    description: 'MiniMax TTS speech volume greater than 0 and up to 10',
    type: String
  },
  'minimax-tts-pitch': {
    description: 'MiniMax TTS pitch adjustment from -12 to 12',
    type: String
  },
  'minimax-tts-emotion': {
    description: `MiniMax TTS emotion: ${formatValueList(SUPPORTED_MINIMAX_TTS_EMOTIONS)}`,
    type: String
  },
  'minimax-tts-pronunciation': {
    description: 'MiniMax pronunciation rule for pronunciation_dict.tone; repeatable, e.g. "omg/oh my god"',
    type: [String] as [StringConstructor]
  },
  'deepgram-tts-container': {
    description: 'Deepgram TTS output container, e.g. wav|mp3|ogg|flac|none',
    type: String
  },
  'deepgram-tts-bit-rate': {
    description: 'Deepgram TTS output bit rate in bits per second',
    type: String
  },
  'deepgram-tts-sample-rate': {
    description: 'Deepgram TTS output sample rate in Hz',
    type: String
  },
  'speechify-tts-voice-locale': {
    description: 'Speechify custom voice locale (default: en-US)',
    type: String
  },
  'speechify-tts-voice-gender': {
    description: `Speechify custom voice gender: ${formatValueList(SPEECHIFY_CUSTOM_VOICE_GENDERS)} (default: notSpecified)`,
    type: String
  },
  'hume-tts-voice-provider': {
    description: `Hume named voice provider: ${formatValueList(SUPPORTED_HUME_TTS_VOICE_PROVIDERS)} (default: HUME_AI)`,
    type: String
  },
  'tts-dialogue-format': {
    description: 'Dialogue input format for multi-speaker TTS: screenplay|labeled (requires --tts-speaker)',
    type: String
  },
  'tts-speaker': {
    description: 'Multi-speaker TTS voice mapping, SPEAKER=VOICE or SPEAKER=path; repeatable',
    type: [String] as [StringConstructor]
  },
  'elevenlabs-tts-clone-remove-background-noise': {
    description: 'Enable ElevenLabs IVC background noise removal for the reference audio',
    type: Boolean,
    default: false,
    negatable: false
  },
  'elevenlabs-tts-stability': {
    description: 'ElevenLabs voice_settings stability from 0 to 1',
    type: String
  },
  'elevenlabs-tts-similarity-boost': {
    description: 'ElevenLabs voice_settings similarity_boost from 0 to 1',
    type: String
  },
  'elevenlabs-tts-style': {
    description: 'ElevenLabs voice_settings style from 0 to 1',
    type: String
  },
  'elevenlabs-tts-use-speaker-boost': {
    description: 'Enable ElevenLabs voice_settings use_speaker_boost',
    type: Boolean,
    default: false,
    negatable: false
  },
  'elevenlabs-tts-seed': {
    description: 'ElevenLabs deterministic generation seed',
    type: String
  },
  'elevenlabs-tts-pronunciation-dictionary-locator': {
    description: 'ElevenLabs pronunciation dictionary locator; repeatable as dictionary_id or dictionary_id:version_id',
    type: [String] as [StringConstructor]
  },
  'elevenlabs-tts-optimize-streaming-latency': {
    description: 'ElevenLabs optimize_streaming_latency value from 0 to 4',
    type: String
  }
} as const satisfies CliFlagsDefinition

export const genericTtsOptionFlags = {
  'tts-voice': {
    description: 'Generic TTS voice selector. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-speed': {
    description: 'Generic TTS speed. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-language': {
    description: 'Generic TTS language. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-ref-audio': {
    description: 'Generic TTS reference audio path. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-voice-name': {
    description: 'Generic created/saved TTS voice label. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-consent-name': {
    description: 'Generic TTS consent recording name. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-consent-email': {
    description: 'Generic TTS consent email. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-text-normalization': {
    description: 'Generic TTS text normalization. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-instructions': {
    description: 'Generic TTS voice/style instructions. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-output-format': {
    description: 'Generic TTS output format. Use value with one selected provider, or provider=value with multiple providers.',
    type: [String] as [StringConstructor]
  },
  'tts-chunk-concurrency': {
    description: 'Hosted TTS chunk starts allowed in parallel per provider across the current run (default 30; Grok-only default 50)',
    type: String,
    default: DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE
  },
} as const satisfies CliFlagsDefinition

const ttsProviderSelectionFlags = {
  provider: {
    description: `TTS provider[=model]: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}; repeatable (default: kitten)`,
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...booleanAllLocalFlag,
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

const minimaxTtsCommandOptionNames = [
  'minimax-tts-language-boost',
  'minimax-tts-volume',
  'minimax-tts-pitch',
  'minimax-tts-emotion',
  'minimax-tts-pronunciation'
] as const

const deepgramTtsCommandOptionNames = [
  'deepgram-tts-container',
  'deepgram-tts-bit-rate',
  'deepgram-tts-sample-rate'
] as const

const speechifyTtsCommandOptionNames = [
  'speechify-tts-voice-locale',
  'speechify-tts-voice-gender'
] as const

const humeTtsCommandOptionNames = [
  'hume-tts-voice-provider'
] as const

export const dialogueTtsCommandOptionNames = [
  'tts-dialogue-format',
  'tts-speaker'
] as const

const elevenlabsTtsCommandOptionNames = [
  'elevenlabs-tts-clone-remove-background-noise',
  'elevenlabs-tts-stability',
  'elevenlabs-tts-similarity-boost',
  'elevenlabs-tts-style',
  'elevenlabs-tts-use-speaker-boost',
  'elevenlabs-tts-seed',
  'elevenlabs-tts-pronunciation-dictionary-locator',
  'elevenlabs-tts-optimize-streaming-latency'
] as const

export const ttsCommandFlags = {
  ...withHelpGroup(ttsProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(genericTtsOptionFlags, 'tts-options'),
  ...withHelpGroup(pickFlags(batchFlags, ['batch-concurrency']), 'batch-processing'),
  ...withHelpGroup(pickFlags(ttsFlags, minimaxTtsCommandOptionNames), 'tts-minimax'),
  ...withHelpGroup(pickFlags(ttsFlags, deepgramTtsCommandOptionNames), 'tts-deepgram'),
  ...withHelpGroup(pickFlags(ttsFlags, speechifyTtsCommandOptionNames), 'tts-speechify'),
  ...withHelpGroup(pickFlags(ttsFlags, humeTtsCommandOptionNames), 'tts-hume'),
  ...withHelpGroup(pickFlags(ttsFlags, dialogueTtsCommandOptionNames), 'tts-dialogue'),
  ...withHelpGroup(pickFlags(ttsFlags, elevenlabsTtsCommandOptionNames), 'tts-elevenlabs'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
