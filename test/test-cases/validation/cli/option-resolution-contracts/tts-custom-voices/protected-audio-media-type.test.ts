import { describe, expect, test } from 'bun:test'
import { cloneFileExtension, cloneMediaType } from '~/cli/commands/process-steps/step-4-tts/voice-management/voice-command-support'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'

describe('protected voice audio media type resolution', () => {
  test('sniffs an extensionless managed WAV asset and supplies a provider-compatible name', () => {
    const bytes = new Uint8Array(createSyntheticWavBytes({ durationSeconds: 0.1, frequencyHz: 440, amplitude: 0.1 }))
    const mediaType = cloneMediaType('/runtime/protected-voice-assets/managed-v1/assets/sha256_abc', bytes)

    expect(mediaType).toBe('audio/wav')
    expect(cloneFileExtension(mediaType)).toBe('wav')
  })

  test('preserves ordinary extension-based resolution', () => {
    expect(cloneMediaType('/tmp/reference.mp3')).toBe('audio/mpeg')
    expect(cloneFileExtension('audio/mpeg')).toBe('mp3')
  })
})
