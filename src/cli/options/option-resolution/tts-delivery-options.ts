import { UsageError } from '~/utils/error-handler'
import { formatQuotedChoiceList } from '~/utils/value-helpers'
import type { TtsChunkingOptions, TtsDeliveryProfile, TtsExportFormat, TtsExportOptions, TtsPronunciationLexicon } from '~/types'
import { loadTtsPronunciationLexicon } from '~/cli/commands/audio/tts/tts-utils/tts-pronunciation-lexicon'
import { DEFAULT_TTS_AUDIO_PROFILE, DEFAULT_TTS_CHUNK_BOUNDARY, DEFAULT_TTS_EXPORT_FORMAT, TTS_AUDIO_PROFILES, TTS_CHUNK_BOUNDARIES, TTS_DELIVERY_SAMPLE_RATES, TTS_EXPORT_FORMATS, TTS_METADATA_KEYS, ttsDeliveryPreset } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-profile'
import type { TtsAudioProfileName } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-profile'
import { parseOptionalNumberFlag, readBooleanFlag, readOptionalStringFlag, readOptionalStringListFlag } from './flag-readers'

export type ResolvedTtsDeliveryOptions = {
  ttsChunking: TtsChunkingOptions
  ttsDelivery?: TtsDeliveryProfile | undefined
  ttsExport?: TtsExportOptions | undefined
  ttsPronunciationsPath?: string | undefined
  ttsTextPreflight: boolean
}

const MASTERING_OVERRIDE_FLAGS = ['tts-sample-rate', 'tts-channels', 'tts-loudness', 'tts-true-peak', 'tts-trim-silence', 'tts-paragraph-pause', 'tts-sentence-pause', 'tts-lead-in', 'tts-lead-out'] as const

const readChoice = <T extends string>(flags: Record<string, unknown>, flagName: string, choices: readonly T[], fallback: T): T => {
  const value = readOptionalStringFlag(flags, flagName)
  if (value === undefined) return fallback
  if (!choices.includes(value as T)) throw UsageError(`Invalid --${flagName} value "${value}". Expected ${formatQuotedChoiceList(choices)}.`)
  return value as T
}

const readSwitch = (flags: Record<string, unknown>, flagName: string): boolean | undefined => {
  const value = readOptionalStringFlag(flags, flagName)
  if (value === undefined) return undefined
  if (value !== 'on' && value !== 'off') throw UsageError(`Invalid --${flagName} value "${value}". Expected ${formatQuotedChoiceList(['on', 'off'])}.`)
  return value === 'on'
}

const readMs = (flags: Record<string, unknown>, flagName: string): number | undefined =>
  parseOptionalNumberFlag(readOptionalStringFlag(flags, flagName), flagName, { min: 0, max: 10000, integer: true })

const resolveDelivery = (flags: Record<string, unknown>): TtsDeliveryProfile | undefined => {
  const profileName = readChoice<TtsAudioProfileName>(flags, 'tts-audio-profile', TTS_AUDIO_PROFILES, DEFAULT_TTS_AUDIO_PROFILE)
  if (profileName === 'legacy-16k') {
    const override = MASTERING_OVERRIDE_FLAGS.find((flagName) => readOptionalStringFlag(flags, flagName) !== undefined)
    if (override) throw UsageError(`--${override} cannot be combined with --tts-audio-profile legacy-16k.`)
    return undefined
  }
  const profile = ttsDeliveryPreset(profileName)
  const sampleRate = readOptionalStringFlag(flags, 'tts-sample-rate')
  if (sampleRate !== undefined) {
    if (!TTS_DELIVERY_SAMPLE_RATES.map(String).includes(sampleRate)) throw UsageError(`Invalid --tts-sample-rate value "${sampleRate}". Expected ${formatQuotedChoiceList(TTS_DELIVERY_SAMPLE_RATES.map(String))}.`)
    profile.sampleRate = Number(sampleRate)
  }
  const channels = readOptionalStringFlag(flags, 'tts-channels')
  if (channels !== undefined) {
    if (channels !== '1' && channels !== '2') throw UsageError(`Invalid --tts-channels value "${channels}". Expected ${formatQuotedChoiceList(['1', '2'])}.`)
    profile.channels = channels === '1' ? 1 : 2
  }
  const loudness = readOptionalStringFlag(flags, 'tts-loudness')
  const truePeakDb = parseOptionalNumberFlag(readOptionalStringFlag(flags, 'tts-true-peak'), 'tts-true-peak', { min: -9, max: 0 })
  if (loudness === 'off') {
    if (truePeakDb !== undefined) throw UsageError('--tts-true-peak requires loudness normalization; it cannot be combined with --tts-loudness off.')
    profile.loudness = { mode: 'none' }
  } else {
    const integratedLufs = parseOptionalNumberFlag(loudness, 'tts-loudness', { min: -40, max: -5 })
    if (integratedLufs !== undefined) {
      profile.loudness = { mode: 'ebu-r128', integratedLufs, truePeakDb: truePeakDb ?? (profile.loudness.mode === 'ebu-r128' ? profile.loudness.truePeakDb : -1.5) }
    } else if (truePeakDb !== undefined) {
      if (profile.loudness.mode !== 'ebu-r128') throw UsageError('--tts-true-peak requires --tts-loudness <LUFS> or a profile with loudness normalization.')
      profile.loudness = { ...profile.loudness, truePeakDb }
    }
  }
  profile.trimSilence = readSwitch(flags, 'tts-trim-silence') ?? profile.trimSilence
  const paragraphMs = readMs(flags, 'tts-paragraph-pause')
  if (paragraphMs !== undefined) profile.gapsMs = { ...profile.gapsMs, paragraph: paragraphMs, turn: paragraphMs }
  const sentenceMs = readMs(flags, 'tts-sentence-pause')
  if (sentenceMs !== undefined) profile.gapsMs = { ...profile.gapsMs, sentence: sentenceMs }
  profile.leadInMs = readMs(flags, 'tts-lead-in') ?? profile.leadInMs
  profile.leadOutMs = readMs(flags, 'tts-lead-out') ?? profile.leadOutMs
  return profile
}

const resolveMetadata = (flags: Record<string, unknown>): Record<string, string> | undefined => {
  const entries = readOptionalStringListFlag(flags, 'tts-metadata')
  if (!entries) return undefined
  const metadata: Record<string, string> = {}
  for (const entry of entries) {
    const separator = entry.indexOf('=')
    const key = separator > 0 ? entry.slice(0, separator).trim() : ''
    const value = separator > 0 ? entry.slice(separator + 1).trim() : ''
    if (!key || !value) throw UsageError(`Invalid --tts-metadata value "${entry}". Expected key=value.`)
    if (!(TTS_METADATA_KEYS as readonly string[]).includes(key)) throw UsageError(`Invalid --tts-metadata key "${key}". Expected ${formatQuotedChoiceList(TTS_METADATA_KEYS)}.`)
    if (key in metadata) throw UsageError(`--tts-metadata key "${key}" was given more than once.`)
    metadata[key] = value
  }
  return metadata
}

const resolveExport = (flags: Record<string, unknown>, delivery: TtsDeliveryProfile | undefined): TtsExportOptions | undefined => {
  const format = readChoice<TtsExportFormat>(flags, 'tts-export-format', TTS_EXPORT_FORMATS, DEFAULT_TTS_EXPORT_FORMAT)
  const bitrateKbps = parseOptionalNumberFlag(readOptionalStringFlag(flags, 'tts-bitrate'), 'tts-bitrate', { min: 32, max: 320, integer: true })
  const metadata = resolveMetadata(flags)
  const coverPath = readOptionalStringFlag(flags, 'tts-cover')
  const book = readBooleanFlag(flags, 'tts-book')
  if (bitrateKbps !== undefined && (format === 'wav' || format === 'flac')) throw UsageError(`--tts-bitrate does not apply to --tts-export-format ${format}.`)
  if (coverPath !== undefined) {
    if (format === 'wav') throw UsageError('--tts-cover requires --tts-export-format flac, mp3, m4a, or m4b.')
    if (!/\.(?:jpe?g|png)$/iu.test(coverPath)) throw UsageError('--tts-cover must be a .jpg, .jpeg, or .png image.')
  }
  if (metadata && format === 'wav') throw UsageError('--tts-metadata requires --tts-export-format flac, mp3, m4a, or m4b.')
  if (format === 'wav' && !book) return undefined
  if (!delivery) throw UsageError('--tts-export-format, --tts-metadata, --tts-cover, and --tts-book require a mastered delivery profile; they cannot be combined with --tts-audio-profile legacy-16k.')
  return {
    format,
    ...(bitrateKbps !== undefined ? { bitrateKbps } : {}),
    ...(metadata ? { metadata } : {}),
    ...(coverPath !== undefined ? { coverPath } : {}),
    ...(book ? { book } : {}),
  }
}

export const resolveTtsDeliveryOptions = (flags: Record<string, unknown>): ResolvedTtsDeliveryOptions => {
  const boundary = readChoice(flags, 'tts-chunk-boundary', TTS_CHUNK_BOUNDARIES, DEFAULT_TTS_CHUNK_BOUNDARY)
  const maxChars = parseOptionalNumberFlag(readOptionalStringFlag(flags, 'tts-chunk-size'), 'tts-chunk-size', { min: 100, max: 100000, integer: true })
  const ttsDelivery = resolveDelivery(flags)
  const ttsExport = resolveExport(flags, ttsDelivery)
  const ttsPronunciationsPath = readOptionalStringFlag(flags, 'tts-pronunciations')
  return {
    ttsChunking: { boundary, ...(maxChars !== undefined ? { maxChars } : {}) },
    ...(ttsDelivery ? { ttsDelivery } : {}),
    ...(ttsExport ? { ttsExport } : {}),
    ...(ttsPronunciationsPath !== undefined ? { ttsPronunciationsPath } : {}),
    ttsTextPreflight: readSwitch(flags, 'tts-text-preflight') ?? true,
  }
}

const IDENTITY_DELIVERY_FLAGS = ['tts-chunk-boundary', 'tts-chunk-size', 'tts-audio-profile', ...MASTERING_OVERRIDE_FLAGS] as const

// Resume has no record of the chunking and delivery flags a run was created with. When none are
// given explicitly, planning may fall back to the pre-delivery defaults to match a retained plan.
export const resolveTtsResumeDeliveryOptions = async (
  flags: Record<string, unknown>,
  explicitFlags: ReadonlySet<string>
): Promise<Awaited<ReturnType<typeof resolveTtsDeliveryOptionsWithLexicon>> & { ttsDeliveryFallbackAllowed: boolean }> => ({
  ...await resolveTtsDeliveryOptionsWithLexicon(flags),
  ttsDeliveryFallbackAllowed: !IDENTITY_DELIVERY_FLAGS.some((flagName) => explicitFlags.has(flagName)),
})

export const resolveTtsDeliveryOptionsWithLexicon = async (
  flags: Record<string, unknown>
): Promise<ResolvedTtsDeliveryOptions & { ttsPronunciationLexicon?: TtsPronunciationLexicon }> => {
  const resolved = resolveTtsDeliveryOptions(flags)
  return resolved.ttsPronunciationsPath === undefined
    ? resolved
    : { ...resolved, ttsPronunciationLexicon: await loadTtsPronunciationLexicon(resolved.ttsPronunciationsPath) }
}
