import {
  SUPPORTED_MINIMAX_TTS_EMOTIONS,
  SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS,
  SUPPORTED_HUME_TTS_VOICE_PROVIDERS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { SPEECHIFY_CUSTOM_VOICE_GENDERS } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'
import { batchFlags, booleanAllLocalFlag, booleanAllProvidersFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { boolFlag, formatProviderList, formatValueList, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import type { CliFlagsDefinition } from '~/types'

export const ttsFlags = {
  'minimax-tts-language-boost': strFlag(`MiniMax TTS language boost: ${formatValueList(SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)}`),
  'minimax-tts-volume': strFlag('MiniMax TTS speech volume greater than 0 and up to 10'),
  'minimax-tts-pitch': strFlag('MiniMax TTS pitch adjustment from -12 to 12'),
  'minimax-tts-emotion': strFlag(`MiniMax TTS emotion: ${formatValueList(SUPPORTED_MINIMAX_TTS_EMOTIONS)}`),
  'minimax-tts-pronunciation': strListFlag('MiniMax pronunciation rule for pronunciation_dict.tone; repeatable, e.g. "omg/oh my god"'),
  'deepgram-tts-container': strFlag('Deepgram TTS output container, e.g. wav|mp3|ogg|flac|none'),
  'deepgram-tts-bit-rate': strFlag('Deepgram TTS output bit rate in bits per second'),
  'deepgram-tts-sample-rate': strFlag('Deepgram TTS output sample rate in Hz'),
  'speechify-tts-voice-locale': strFlag('Speechify custom voice locale (default: en-US)'),
  'speechify-tts-voice-gender': strFlag(`Speechify custom voice gender: ${formatValueList(SPEECHIFY_CUSTOM_VOICE_GENDERS)} (default: notSpecified)`),
  'hume-tts-voice-provider': strFlag(`Hume named voice provider: ${formatValueList(SUPPORTED_HUME_TTS_VOICE_PROVIDERS)} (default: HUME_AI)`),
  'tts-dialogue-format': strFlag('Dialogue input format for multi-speaker TTS: screenplay|labeled (requires --tts-speaker)'),
  'tts-speaker': strListFlag('Multi-speaker TTS voice mapping, SPEAKER=VOICE or SPEAKER=path; repeatable'),
  'elevenlabs-tts-clone-remove-background-noise': boolFlag('Enable ElevenLabs IVC background noise removal for the reference audio'),
  'elevenlabs-tts-stability': strFlag('ElevenLabs voice_settings stability from 0 to 1'),
  'elevenlabs-tts-similarity-boost': strFlag('ElevenLabs voice_settings similarity_boost from 0 to 1'),
  'elevenlabs-tts-style': strFlag('ElevenLabs voice_settings style from 0 to 1'),
  'elevenlabs-tts-use-speaker-boost': boolFlag('Enable ElevenLabs voice_settings use_speaker_boost'),
  'elevenlabs-tts-seed': strFlag('ElevenLabs deterministic generation seed'),
  'elevenlabs-tts-pronunciation-dictionary-locator': strListFlag('ElevenLabs pronunciation dictionary locator; repeatable as dictionary_id or dictionary_id:version_id'),
  'elevenlabs-tts-optimize-streaming-latency': strFlag('ElevenLabs optimize_streaming_latency value from 0 to 4')
} as const satisfies CliFlagsDefinition

export const genericTtsOptionFlags = {
  'tts-voice': strListFlag('Generic TTS voice selector. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-speed': strListFlag('Generic TTS speed. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-language': strListFlag('Generic TTS language. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-ref-audio': strListFlag('Generic TTS reference audio path. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-voice-name': strListFlag('Generic created/saved TTS voice label. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-consent-name': strListFlag('Generic TTS consent recording name. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-consent-email': strListFlag('Generic TTS consent email. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-text-normalization': strListFlag('Generic TTS text normalization. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-instructions': strListFlag('Generic TTS voice/style instructions. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-output-format': strListFlag('Generic TTS output format. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-chunk-concurrency': strFlag('Hosted TTS chunk starts allowed in parallel per provider across the current run (default 30; Grok-only default 50)', DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE),
} as const satisfies CliFlagsDefinition

const ttsProviderSelectionFlags = {
  provider: strListFlag(`TTS provider[=model]: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}; repeatable (default: kitten)`),
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
