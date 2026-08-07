import {
  CARTESIA_DEFAULT_TTS_VOICE,
  DEEPGRAM_DEFAULT_VOICE,
  ELEVENLABS_DEFAULT_VOICE_ID,
  GEMINI_DEFAULT_TTS_VOICE,
  GROK_DEFAULT_TTS_VOICE,
  GROQ_DEFAULT_TTS_VOICE,
  HUME_DEFAULT_TTS_VOICE,
  OPENAI_DEFAULT_TTS_VOICE,
  SPEECHIFY_DEFAULT_TTS_VOICE,
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_KITTEN_TTS_VOICES,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_EMOTIONS,
  SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_GROK_TTS_LANGUAGES,
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_DEEPGRAM_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_HUME_TTS_VOICE_PROVIDERS,
  SUPPORTED_CARTESIA_TTS_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { SPEECHIFY_CUSTOM_VOICE_GENDERS } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { batchFlags, booleanAllLocalFlag, booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { formatProviderList, formatValueList, pickFlags, withHelpGroup } from './flag-utils'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { DEFAULT_CONCURRENCY_FLAG_VALUE, DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import type { CliFlagsDefinition } from '~/types'

export const ttsFlags = {
  'all-tts': {
    description: 'Enable every supported TTS provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  'tts-provider-concurrency': {
    description: 'TTS: max hosted providers/models running in parallel for one item (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE
  },
  'tts-local-concurrency': {
    description: 'TTS: max local providers running in parallel for one item (default 10)',
    type: String,
    default: DEFAULT_CONCURRENCY_FLAG_VALUE
  },
  'kitten-voice': {
    description: `Kitten TTS speaker: ${formatValueList(SUPPORTED_KITTEN_TTS_VOICES)}`,
    type: String,
    default: 'Jasper'
  },
  'kitten-tts': {
    description: buildModelDescription('Kitten TTS model', SUPPORTED_KITTEN_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'elevenlabs-tts': {
    description: buildModelDescription('ElevenLabs TTS model', SUPPORTED_ELEVENLABS_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'minimax-tts': {
    description: buildModelDescription('MiniMax TTS model', SUPPORTED_MINIMAX_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'groq-tts': {
    description: buildModelDescription('Groq TTS model', SUPPORTED_GROQ_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'grok-tts': {
    description: buildModelDescription('xAI Grok TTS model', SUPPORTED_GROK_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'mistral-tts': {
    description: buildModelDescription('Mistral Voxtral TTS model', SUPPORTED_MISTRAL_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'openai-tts': {
    description: buildModelDescription('OpenAI TTS model', SUPPORTED_OPENAI_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'gemini-tts': {
    description: buildModelDescription('Gemini TTS model', SUPPORTED_GEMINI_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'deepgram-tts': {
    description: buildModelDescription('Deepgram TTS model', SUPPORTED_DEEPGRAM_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'speechify-tts': {
    description: buildModelDescription('Speechify TTS model', SUPPORTED_SPEECHIFY_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'hume-tts': {
    description: buildModelDescription('Hume TTS model', SUPPORTED_HUME_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'cartesia-tts': {
    description: buildModelDescription('Cartesia TTS model', SUPPORTED_CARTESIA_TTS_MODELS),
    type: [String] as [StringConstructor]
  },
  'minimax-tts-voice': {
    description: 'MiniMax TTS voice ID override (default: English_expressive_narrator)',
    type: String
  },
  'minimax-tts-language-boost': {
    description: `MiniMax TTS language boost: ${formatValueList(SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)}`,
    type: String
  },
  'minimax-tts-speed': {
    description: 'MiniMax TTS speech speed from 0.5 to 2.0',
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
  'minimax-tts-english-normalization': {
    description: 'Enable MiniMax English text normalization',
    type: Boolean,
    default: false,
    negatable: false
  },
  'minimax-tts-pronunciation': {
    description: 'MiniMax pronunciation rule for pronunciation_dict.tone; repeatable, e.g. "omg/oh my god"',
    type: [String] as [StringConstructor]
  },
  'openai-voice': {
    description: `OpenAI TTS voice ID override (default: ${OPENAI_DEFAULT_TTS_VOICE})`,
    type: String
  },
  'openai-tts-instructions': {
    description: 'OpenAI TTS voice/style instructions',
    type: String
  },
  'openai-tts-speed': {
    description: 'OpenAI TTS speed from 0.25 to 4.0',
    type: String
  },
  'gemini-voice': {
    description: `Gemini TTS voice name override (default: ${GEMINI_DEFAULT_TTS_VOICE})`,
    type: String
  },
  'deepgram-voice': {
    description: `Deepgram TTS voice/model override (default: ${DEEPGRAM_DEFAULT_VOICE})`,
    type: String
  },
  'deepgram-tts-encoding': {
    description: 'Deepgram TTS output encoding, e.g. linear16|mulaw|alaw|mp3|opus|flac',
    type: String
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
  'deepgram-tts-speed': {
    description: 'Deepgram TTS voice speed from 0.5 to 2.0',
    type: String
  },
  'speechify-voice': {
    description: `Speechify TTS voice ID override (default: ${SPEECHIFY_DEFAULT_TTS_VOICE})`,
    type: String
  },
  'speechify-tts-audio-format': {
    description: `Speechify TTS audio format: ${formatValueList(SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS)}`,
    type: String
  },
  'speechify-tts-language': {
    description: 'Speechify TTS language hint',
    type: String
  },
  'speechify-tts-ref-audio': {
    description: 'Speechify TTS source audio path used to create a custom voice',
    type: String
  },
  'speechify-tts-voice-name': {
    description: 'Created Speechify custom voice label; defaults to AutoShow_<timestamp>',
    type: String
  },
  'speechify-tts-consent-name': {
    description: 'Full name for Speechify custom voice consent',
    type: String
  },
  'speechify-tts-consent-email': {
    description: 'Email address for Speechify custom voice consent',
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
  'hume-tts-voice': {
    description: `Hume TTS voice name or voice ID override (default: ${HUME_DEFAULT_TTS_VOICE})`,
    type: String
  },
  'hume-tts-voice-provider': {
    description: `Hume named voice provider: ${formatValueList(SUPPORTED_HUME_TTS_VOICE_PROVIDERS)} (default: HUME_AI)`,
    type: String
  },
  'cartesia-tts-voice': {
    description: `Cartesia TTS voice ID override (default: ${CARTESIA_DEFAULT_TTS_VOICE})`,
    type: String
  },
  'cartesia-tts-language': {
    description: 'Cartesia TTS language code override',
    type: String
  },
  'groq-voice': {
    description: `Groq TTS voice ID override (default: ${GROQ_DEFAULT_TTS_VOICE})`,
    type: String
  },
  'grok-tts-voice': {
    description: `xAI Grok TTS voice override: built-in voice or 8-character custom voice ID (default: ${GROK_DEFAULT_TTS_VOICE})`,
    type: String
  },
  'grok-tts-language': {
    description: `xAI Grok TTS language code: ${formatValueList(SUPPORTED_GROK_TTS_LANGUAGES)}`,
    type: String
  },
  'grok-tts-text-normalization': {
    description: 'Enable xAI Grok TTS text normalization',
    type: Boolean,
    default: false,
    negatable: false
  },
  'mistral-tts-voice': {
    description: 'Mistral TTS saved/custom voice ID',
    type: String
  },
  'mistral-tts-ref-audio': {
    description: 'Mistral TTS reference audio path for one-off voice cloning',
    type: String
  },
  'mistral-tts-voice-name': {
    description: 'Mistral TTS saved voice name when creating a saved voice from --mistral-tts-ref-audio',
    type: String
  },
  'tts-dialogue-format': {
    description: 'Dialogue input format for multi-speaker TTS: screenplay|labeled',
    type: String
  },
  'tts-speaker': {
    description: 'Multi-speaker TTS voice mapping, SPEAKER=VOICE or SPEAKER=path; repeatable',
    type: [String] as [StringConstructor]
  },
  'elevenlabs-voice': {
    description: `ElevenLabs voice ID override (default: ${ELEVENLABS_DEFAULT_VOICE_ID})`,
    type: String
  },
  'elevenlabs-tts-ref-audio': {
    description: 'ElevenLabs TTS source audio path for Instant Voice Cloning',
    type: String
  },
  'elevenlabs-tts-voice-name': {
    description: 'ElevenLabs TTS cloned voice label; defaults to AutoShow_<timestamp>',
    type: String
  },
  'elevenlabs-tts-clone-remove-background-noise': {
    description: 'Enable ElevenLabs IVC background noise removal for the reference audio',
    type: Boolean,
    default: false,
    negatable: false
  },
  'elevenlabs-tts-output-format': {
    description: 'ElevenLabs TTS output format, e.g. mp3_44100_128|pcm_16000|ulaw_8000',
    type: String
  },
  'elevenlabs-tts-language-code': {
    description: 'ElevenLabs TTS language code override',
    type: String
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
  'elevenlabs-tts-speed': {
    description: 'ElevenLabs voice_settings speed from 0.7 to 1.2',
    type: String
  },
  'elevenlabs-tts-seed': {
    description: 'ElevenLabs deterministic generation seed',
    type: String
  },
  'elevenlabs-tts-text-normalization': {
    description: `ElevenLabs text normalization mode: ${formatValueList(SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS)}`,
    type: String
  },
  'elevenlabs-tts-pronunciation-dictionary-locator': {
    description: 'ElevenLabs pronunciation dictionary locator; repeatable as dictionary_id or dictionary_id:version_id',
    type: [String] as [StringConstructor]
  },
  'elevenlabs-tts-optimize-streaming-latency': {
    description: 'ElevenLabs optimize_streaming_latency value from 0 to 4',
    type: String
  },
  ...priceFlag
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
