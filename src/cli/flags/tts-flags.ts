import { batchFlags, booleanAllProvidersFlag, modelCostFilterFlag, priceFlag, sharedConcurrencyFlags, stepConcurrencyFlag } from './shared-flags'
import { boolFlag, formatProviderList, formatValueList, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { genericTtsOptionDescription } from './service-selector-normalization/generic-tts-controls'
import { TTS_DIALOGUE_FORMATS } from '~/cli/options/option-resolution/flag-readers'
import { STANDALONE_TTS_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { ttsChunkingFlags, ttsExportFlags, ttsMasteringFlags } from './tts-delivery-flags'
import type { CliFlagsDefinition } from '~/types'

export const ttsFlags = {
  'tts-dialogue-format': strFlag(`Dialogue input format for multi-speaker TTS: ${formatValueList(TTS_DIALOGUE_FORMATS)} (requires --tts-speaker)`),
  'tts-speaker': strListFlag('Multi-speaker TTS voice mapping, SPEAKER=VOICE or SPEAKER=path; repeatable')
} as const satisfies CliFlagsDefinition

export const genericTtsOptionFlags = {
  'allow-ambiguous-redispatch': boolFlag('Explicitly authorize repurchasing a provider-admitted TTS slot that has no recoverable audio'),
  'tts-voice': strListFlag('Generic TTS voice selector. Use value with one selected provider, or provider=value with multiple providers.'),
  'tts-speed': strListFlag(genericTtsOptionDescription('tts-speed', 'Generic TTS speed')),
  'tts-language': strListFlag(genericTtsOptionDescription('tts-language', 'Generic TTS language')),
  'tts-text-normalization': strListFlag(genericTtsOptionDescription('tts-text-normalization', 'Generic TTS text normalization')),
  'tts-instructions': strListFlag(genericTtsOptionDescription('tts-instructions', 'Generic TTS voice/style instructions or free-form delivery description')),
  'tts-stability': strListFlag(genericTtsOptionDescription('tts-stability', 'Generic TTS voice stability')),
  'tts-similarity': strListFlag(genericTtsOptionDescription('tts-similarity', 'Generic TTS voice similarity boost')),
  'tts-style': strListFlag(genericTtsOptionDescription('tts-style', 'Generic TTS voice style exaggeration')),
  'tts-speaker-boost': strListFlag(genericTtsOptionDescription('tts-speaker-boost', 'Generic TTS speaker boost')),
  'tts-seed': strListFlag(genericTtsOptionDescription('tts-seed', 'Generic TTS deterministic generation seed')),
  'tts-pronunciation-dictionary': strListFlag(genericTtsOptionDescription('tts-pronunciation-dictionary', 'Generic TTS pronunciation dictionary locator as dictionary_id or dictionary_id:version_id')),
  'tts-trailing-silence': strListFlag(genericTtsOptionDescription('tts-trailing-silence', 'Generic TTS trailing silence in seconds')),
  'tts-response-format': strListFlag(genericTtsOptionDescription('tts-response-format', 'Generic TTS audio response format')),
} as const satisfies CliFlagsDefinition

const standaloneTtsOnlyFlags = {
  'tts-ref-audio': strListFlag('Explicit one-off Mistral TTS reference audio path')
} as const satisfies CliFlagsDefinition

const ttsProviderSelectionFlags = {
  provider: strListFlag(`TTS provider[=model]: ${formatProviderList(STANDALONE_TTS_PROVIDER_TARGETS)}; repeatable (default: cheapest hosted)`),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

export const dialogueTtsCommandOptionNames = [
  'tts-dialogue-format',
  'tts-speaker'
] as const

export const ttsCommandFlags = {
  ...withHelpGroup(ttsProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup({
    ...genericTtsOptionFlags,
    ...standaloneTtsOnlyFlags
  }, 'tts-options'),
  ...withHelpGroup({ ...ttsChunkingFlags, ...ttsMasteringFlags, ...ttsExportFlags }, 'tts-mastering'),
  ...withHelpGroup(stepConcurrencyFlag(['tts-chunk']), 'concurrency'),
  ...withHelpGroup(pickFlags(batchFlags, ['batch-concurrency']), 'batch-processing'),
  ...withHelpGroup(pickFlags(ttsFlags, dialogueTtsCommandOptionNames), 'tts-dialogue'),
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing')
} as const satisfies CliFlagsDefinition
