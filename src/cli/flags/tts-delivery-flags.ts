import { boolFlag, formatValueList, strFlag, strListFlag } from './flag-utils'
import { DEFAULT_TTS_AUDIO_PROFILE, DEFAULT_TTS_CHUNK_BOUNDARY, DEFAULT_TTS_EXPORT_BITRATE_KBPS, DEFAULT_TTS_EXPORT_FORMAT, TTS_AUDIO_PROFILES, TTS_CHUNK_BOUNDARIES, TTS_DELIVERY_SAMPLE_RATES, TTS_EXPORT_FORMATS, TTS_METADATA_KEYS } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-profile'
import type { CliFlagsDefinition } from '~/types'

export const ttsChunkingFlags = {
  'tts-chunk-boundary': strFlag(`TTS chunk boundary selection: ${formatValueList(TTS_CHUNK_BOUNDARIES)}; smart prefers paragraph, sentence, then clause breaks and balances chunk sizes`, DEFAULT_TTS_CHUNK_BOUNDARY),
  'tts-chunk-size': strFlag('Maximum characters per TTS chunk; clamped to each provider/model input limit'),
  'tts-pronunciations': strFlag('Path to a local JSON pronunciation lexicon of { match, alias, caseSensitive?, wordBoundary? } rules applied to the text before synthesis for every provider'),
  'tts-text-preflight': strFlag(`Reject unsupported speech markup before provider dispatch: ${formatValueList(['on', 'off'])}`, 'on'),
} as const satisfies CliFlagsDefinition

export const ttsMasteringFlags = {
  'tts-audio-profile': strFlag(`Final audio mastering profile: ${formatValueList(TTS_AUDIO_PROFILES)}; native keeps the provider sample rate, audiobook masters 44.1 kHz mono at -19 LUFS, legacy-16k reproduces 16 kHz mono output`, DEFAULT_TTS_AUDIO_PROFILE),
  'tts-sample-rate': strFlag(`Override the profile sample rate in Hz: ${formatValueList(TTS_DELIVERY_SAMPLE_RATES.map(String))}`),
  'tts-channels': strFlag(`Override the profile channel count: ${formatValueList(['1', '2'])}`),
  'tts-loudness': strFlag('Override the profile loudness target in LUFS from -40 to -5, or off to skip normalization'),
  'tts-true-peak': strFlag('Override the profile true-peak ceiling in dBTP from -9 to 0; needs loudness normalization'),
  'tts-trim-silence': strFlag(`Opt in to outer-edge silence trimming at chunk joins (default off; internal pauses are kept): ${formatValueList(['on', 'off'])}`),
  'tts-paragraph-pause': strFlag('Add silence in ms at paragraph and speaker-turn chunk joins, 0-10000; default 0; does not enable trimming'),
  'tts-sentence-pause': strFlag('Add silence in ms at sentence chunk joins, 0-10000; default 0; no clause or word padding'),
  'tts-lead-in': strFlag('Override the profile silence in ms before the first audio, 0-10000'),
  'tts-lead-out': strFlag('Override the profile silence in ms after the last audio, 0-10000'),
} as const satisfies CliFlagsDefinition

export const ttsExportFlags = {
  'tts-export-format': strFlag(`Delivered audio container: ${formatValueList(TTS_EXPORT_FORMATS)}`, DEFAULT_TTS_EXPORT_FORMAT),
  'tts-bitrate': strFlag(`Delivered audio bitrate in kbps for mp3, m4a, and m4b, 32-320 (default: ${Object.entries(DEFAULT_TTS_EXPORT_BITRATE_KBPS).map(([format, kbps]) => `${format} ${kbps}`).join(', ')})`),
  'tts-metadata': strListFlag(`Delivered audio tag as key=value: ${formatValueList(TTS_METADATA_KEYS)}; repeatable`),
  'tts-cover': strFlag('Cover image path (.jpg or .png) embedded in mp3, m4a, m4b, and flac output'),
  'tts-book': boolFlag('For directory input, also assemble one book file with a chapter marker per input file'),
} as const satisfies CliFlagsDefinition

export const ttsRunScopedDeliveryFlagNames = ['tts-metadata', 'tts-cover', 'tts-book', 'tts-pronunciations'] as const
