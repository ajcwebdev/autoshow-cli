import type { WhisperModelIntegrity } from '~/types'

const WHISPER_MODEL_MIN_BYTES = 10_000_000

const WHISPER_MODEL_INTEGRITY: Record<string, WhisperModelIntegrity> = {
  tiny: {
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
    bytes: 77_691_713
  },
  'large-v3-turbo': {
    sha256: '1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69',
    bytes: 1_624_555_275
  }
}

export const getWhisperModelIntegrity = (modelName: string): WhisperModelIntegrity | undefined =>
  WHISPER_MODEL_INTEGRITY[modelName]

export const resolveWhisperModelMinBytes = (modelName: string): number =>
  WHISPER_MODEL_INTEGRITY[modelName]?.bytes ?? WHISPER_MODEL_MIN_BYTES
