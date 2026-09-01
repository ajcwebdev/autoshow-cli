import {
  SUPPORTED_MINIMAX_TTS_EMOTIONS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { batchFlags, booleanAllProvidersFlag, modelCostFilterFlag, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { boolFlag, formatProviderList, formatValueList, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import type { CliFlagsDefinition } from '~/types'

export const ttsFlags = {
  'minimax-tts-volume': strFlag('MiniMax TTS speech volume greater than 0 and up to 10'),
  'minimax-tts-pitch': strFlag('MiniMax TTS pitch adjustment from -12 to 12'),
  'minimax-tts-emotion': strFlag(`MiniMax TTS emotion: ${formatValueList(SUPPORTED_MINIMAX_TTS_EMOTIONS)}`),
  'minimax-tts-pronunciation': strListFlag('MiniMax pronunciation rule for pronunciation_dict.tone; repeatable, e.g. "omg/oh my god"'),
  'tts-dialogue-format': strFlag('Dialogue input format for multi-speaker TTS: screenplay|labeled (requires --tts-speaker)'),
  'tts-speaker': strListFlag('Multi-speaker TTS voice mapping, SPEAKER=VOICE or SPEAKER=path; repeatable'),
  'elevenlabs-tts-stability': strFlag('ElevenLabs voice_settings stability from 0 to 1'),
  'elevenlabs-tts-similarity-boost': strFlag('ElevenLabs voice_settings similarity_boost from 0 to 1'),
  'elevenlabs-tts-style': strFlag('ElevenLabs voice_settings style from 0 to 1'),
  'elevenlabs-tts-use-speaker-boost': boolFlag('Enable ElevenLabs voice_settings use_speaker_boost'),
  'elevenlabs-tts-seed': strFlag('ElevenLabs deterministic generation seed'),
  'elevenlabs-tts-pronunciation-dictionary-locator': strListFlag('ElevenLabs pronunciation dictionary locator; repeatable as dictionary_id or dictionary_id:version_id')
} as const satisfies CliFlagsDefinition

export const genericTtsOptionFlags = {
  'allow-ambiguous-redispatch': boolFlag('Explicitly authorize repurchasing a provider-admitted TTS slot that has no recoverable audio'),
  'tts-voice': strListFlag('Generic TTS voice selector. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-speed': strListFlag('Generic TTS speed. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-language': strListFlag('Generic TTS language. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-text-normalization': strListFlag('Generic TTS text normalization. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-instructions': strListFlag('Generic TTS voice/style instructions. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-chunk-concurrency': strFlag('Hosted TTS chunk starts allowed in parallel per provider across the current run (all-provider uses 2; Grok-only uses 50)', DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE),
} as const satisfies CliFlagsDefinition

const standaloneTtsOnlyFlags = {
  'tts-ref-audio': strListFlag('Explicit one-off Mistral TTS reference audio path')
} as const satisfies CliFlagsDefinition

const ttsProviderSelectionFlags = {
  provider: strListFlag(`TTS provider[=model]: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}; repeatable (default: cheapest hosted)`),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

const minimaxTtsCommandOptionNames = [
  'minimax-tts-volume',
  'minimax-tts-pitch',
  'minimax-tts-emotion',
  'minimax-tts-pronunciation'
] as const

export const dialogueTtsCommandOptionNames = [
  'tts-dialogue-format',
  'tts-speaker'
] as const

const elevenlabsTtsCommandOptionNames = [
  'elevenlabs-tts-stability',
  'elevenlabs-tts-similarity-boost',
  'elevenlabs-tts-style',
  'elevenlabs-tts-use-speaker-boost',
  'elevenlabs-tts-seed',
  'elevenlabs-tts-pronunciation-dictionary-locator'
] as const

export const ttsCommandFlags = {
  ...withHelpGroup(ttsProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup({
    ...genericTtsOptionFlags,
    ...standaloneTtsOnlyFlags
  }, 'tts-options'),
  ...withHelpGroup(pickFlags(batchFlags, ['batch-concurrency']), 'batch-processing'),
  ...withHelpGroup(pickFlags(ttsFlags, minimaxTtsCommandOptionNames), 'tts-minimax'),
  ...withHelpGroup(pickFlags(ttsFlags, dialogueTtsCommandOptionNames), 'tts-dialogue'),
  ...withHelpGroup(pickFlags(ttsFlags, elevenlabsTtsCommandOptionNames), 'tts-elevenlabs'),
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing')
} as const satisfies CliFlagsDefinition
