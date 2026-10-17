import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseWaveMetadata, wavePcmFormat } from '~/cli/commands/audio/tts/tts-utils/wave-metadata'
import { readObservedAudio } from '~/cli/commands/audio/tts/script-to-audio/attempt-io'
import { writeImmutableArtifactFile } from '~/cli/commands/audio/tts/script-to-audio/safe-artifact-store'
import { inspectSoundscapeAudio } from '~/cli/commands/audio/tts/soundscape/soundscape-audio'
import { withTempDir } from '../../../../test-utils/temp-dirs'

// These fixtures establish decoded WAV metadata integrity only, not spoken content or audio quality.
const riffChunk = (kind: string, body: Buffer, declaredSize = body.length): Buffer => {
  const header = Buffer.alloc(8)
  header.write(kind, 0, 'ascii')
  header.writeUInt32LE(declaredSize, 4)
  return Buffer.concat([header, body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
}

const fmtChunk = (options: { channels: number, sampleRate: number, bitsPerSample: number, byteRate?: number }): Buffer => {
  const body = Buffer.alloc(16)
  const blockAlign = options.channels * options.bitsPerSample / 8
  body.writeUInt16LE(1, 0)
  body.writeUInt16LE(options.channels, 2)
  body.writeUInt32LE(options.sampleRate, 4)
  body.writeUInt32LE(options.byteRate ?? options.sampleRate * blockAlign, 8)
  body.writeUInt16LE(blockAlign, 12)
  body.writeUInt16LE(options.bitsPerSample, 14)
  return riffChunk('fmt ', body)
}

const wave = (...chunks: Buffer[]): Buffer => {
  const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), ...chunks])
  const header = Buffer.alloc(8)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

// 24 kHz mono PCM16 is 48,000 bytes per second, so 48,000 data bytes last exactly one second.
const oneSecondMono16 = (): Buffer => wave(fmtChunk({ channels: 1, sampleRate: 24_000, bitsPerSample: 16 }), riffChunk('data', Buffer.alloc(48_000)))

describe('WAVE metadata parser contracts', () => {
  test('reads 16-bit mono format fields and audio bytes', () => {
    expect(parseWaveMetadata(oneSecondMono16())).toEqual({ sampleRate: 24_000, channels: 1, byteRate: 48_000, bitsPerSample: 16, dataBytes: 48_000 })
  })

  test('reports 24-bit stereo audio as pcm_s24le', () => {
    const metadata = parseWaveMetadata(wave(fmtChunk({ channels: 2, sampleRate: 48_000, bitsPerSample: 24 }), riffChunk('data', Buffer.alloc(288))))
    expect(metadata).toMatchObject({ sampleRate: 48_000, channels: 2, byteRate: 288_000, bitsPerSample: 24, dataBytes: 288 })
    expect(wavePcmFormat(metadata!)).toEqual({ codec: 'pcm_s24le', container: 'wav', sampleRate: 48_000, channels: 2 })
  })

  test('skips the pad byte after an odd-size chunk before reading audio', () => {
    const metadata = parseWaveMetadata(wave(
      fmtChunk({ channels: 1, sampleRate: 24_000, bitsPerSample: 16 }),
      riffChunk('LIST', Buffer.from('abc', 'ascii')),
      riffChunk('data', Buffer.alloc(100))
    ))
    expect(metadata?.dataBytes).toBe(100)
  })

  test('clamps a truncated data chunk to the bytes actually present', () => {
    const truncated = wave(fmtChunk({ channels: 1, sampleRate: 24_000, bitsPerSample: 16 }), riffChunk('data', Buffer.alloc(10), 1_000))
    expect(parseWaveMetadata(truncated)?.dataBytes).toBe(10)
  })

  test('a truncated fmt chunk yields no format fields', () => {
    const truncatedFormat = wave(riffChunk('data', Buffer.alloc(4)), Buffer.concat([Buffer.from('fmt ', 'ascii'), Buffer.from([16, 0, 0, 0]), Buffer.alloc(8)]))
    expect(parseWaveMetadata(truncatedFormat)).toEqual({ sampleRate: 0, channels: 0, byteRate: 0, bitsPerSample: 0, dataBytes: 4 })
  })

  test('non-WAVE input is not parsed', () => {
    expect(parseWaveMetadata(Buffer.from('ID3\u0004\u0000\u0000 mp3 frames', 'binary'))).toBeUndefined()
    expect(parseWaveMetadata(Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.alloc(4), Buffer.from('AVI ', 'ascii')]))).toBeUndefined()
    expect(parseWaveMetadata(Buffer.from('RIFF', 'ascii'))).toBeUndefined()
  })
})

describe('WAVE acceptance policy by caller', () => {
  const zeroByteRate = (): Buffer => wave(fmtChunk({ channels: 1, sampleRate: 24_000, bitsPerSample: 16, byteRate: 0 }), riffChunk('data', Buffer.alloc(480)))
  const emptyData = (): Buffer => wave(fmtChunk({ channels: 1, sampleRate: 24_000, bitsPerSample: 16 }), riffChunk('data', Buffer.alloc(0)))
  const missingFormat = (): Buffer => wave(riffChunk('data', Buffer.alloc(480)))

  const readRetained = async (bytes: Buffer) => await withTempDir('autoshow-wave-retained-', async (root) => {
    await writeImmutableArtifactFile(root, 'audio/slot.wav', bytes)
    const observed = await readObservedAudio(root, join(root, 'audio/slot.wav'))
    return { format: observed.format, durationMs: observed.durationMs }
  })

  const inspectSoundscape = async (bytes: Buffer) => await withTempDir('autoshow-wave-soundscape-', async (root) => {
    const path = join(root, 'sound.wav')
    await writeFile(path, bytes)
    return await inspectSoundscapeAudio(path)
  })

  test('both readers accept valid one-second PCM16 audio', async () => {
    const expected = { format: { codec: 'pcm_s16le', container: 'wav', sampleRate: 24_000, channels: 1 }, durationMs: 1_000 }
    expect(await readRetained(oneSecondMono16())).toEqual(expected)
    expect(await inspectSoundscape(oneSecondMono16())).toEqual(expected)
  })

  test('retained audio accepts a zero byte rate or empty data as 0 ms; soundscape audio rejects both', async () => {
    expect((await readRetained(zeroByteRate())).durationMs).toBe(0)
    expect((await readRetained(emptyData())).durationMs).toBe(0)
    await expect(inspectSoundscape(zeroByteRate())).rejects.toThrow('Soundscape WAV has invalid or empty audio metadata')
    await expect(inspectSoundscape(emptyData())).rejects.toThrow('Soundscape WAV has invalid or empty audio metadata')
  })

  test('both readers reject WAVE audio without a format chunk', async () => {
    await expect(readRetained(missingFormat())).rejects.toThrow('Retained TTS WAV output has no valid audio format metadata')
    await expect(inspectSoundscape(missingFormat())).rejects.toThrow('Soundscape WAV has invalid or empty audio metadata')
  })
})
