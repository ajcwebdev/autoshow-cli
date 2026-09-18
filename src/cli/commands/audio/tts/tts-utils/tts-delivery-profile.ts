import type { TtsChunkingOptions, TtsDeliveryProfile, TtsExportFormat } from '~/types'

export const TTS_AUDIO_PROFILES = ['native', 'audiobook', 'legacy-16k'] as const
export type TtsAudioProfileName = typeof TTS_AUDIO_PROFILES[number]
export const DEFAULT_TTS_AUDIO_PROFILE: TtsAudioProfileName = 'native'

export const TTS_CHUNK_BOUNDARIES = ['smart', 'legacy'] as const
export const DEFAULT_TTS_CHUNK_BOUNDARY: TtsChunkingOptions['boundary'] = 'smart'

export const TTS_EXPORT_FORMATS = ['wav', 'flac', 'mp3', 'm4a', 'm4b'] as const satisfies readonly TtsExportFormat[]
export const DEFAULT_TTS_EXPORT_FORMAT: TtsExportFormat = 'wav'
export const DEFAULT_TTS_EXPORT_BITRATE_KBPS: Partial<Record<TtsExportFormat, number>> = { mp3: 192, m4a: 96, m4b: 96 }

export const TTS_DELIVERY_SAMPLE_RATES = [16000, 22050, 24000, 32000, 44100, 48000] as const
export const TTS_METADATA_KEYS = ['title', 'artist', 'album', 'album_artist', 'composer', 'date', 'genre', 'comment', 'track', 'copyright'] as const

const SEAM_GAPS_MS = { paragraph: 750, sentence: 350, clause: 120, turn: 750 } as const

const PRESETS: Record<TtsDeliveryProfile['preset'], TtsDeliveryProfile> = {
  native: {
    schemaVersion: 1,
    preset: 'native',
    codec: 'pcm_s16le',
    container: 'wav',
    trimSilence: true,
    gapsMs: { ...SEAM_GAPS_MS },
    leadInMs: 0,
    leadOutMs: 0,
    loudness: { mode: 'none' },
  },
  audiobook: {
    schemaVersion: 1,
    preset: 'audiobook',
    sampleRate: 44100,
    channels: 1,
    codec: 'pcm_s16le',
    container: 'wav',
    trimSilence: true,
    gapsMs: { ...SEAM_GAPS_MS },
    leadInMs: 500,
    leadOutMs: 1000,
    loudness: { mode: 'ebu-r128', integratedLufs: -19, truePeakDb: -3 },
  },
}

export const ttsDeliveryPreset = (preset: TtsDeliveryProfile['preset']): TtsDeliveryProfile => structuredClone(PRESETS[preset])
