import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { masterTtsDelivery, parseSilenceDetectEdges, ttsSeamGapMs } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-mastering'
import { ttsDeliveryPreset } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-profile'
import { inspectSoundscapeAudio } from '~/cli/commands/audio/tts/soundscape/soundscape-audio'
import { sha256Bytes } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { withTempDir } from '../../../../test-utils/temp-dirs'

const SAMPLE_RATE = 24000

// Silence, then a tone, then silence: the shape of a provider chunk with padded edges.
const paddedToneWav = (leadSeconds: number, toneSeconds: number, tailSeconds: number, frequencyHz: number, amplitude = 0.4): Buffer => {
  const total = Math.round((leadSeconds + toneSeconds + tailSeconds) * SAMPLE_RATE)
  const buffer = Buffer.alloc(44 + total * 2)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + total * 2, 4)
  buffer.write('WAVEfmt ', 8, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(total * 2, 40)
  const toneStart = Math.round(leadSeconds * SAMPLE_RATE)
  const toneEnd = toneStart + Math.round(toneSeconds * SAMPLE_RATE)
  for (let index = toneStart; index < toneEnd; index += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequencyHz * index / SAMPLE_RATE) * amplitude * 32767), 44 + index * 2)
  }
  return buffer
}

const writeSegments = async (dir: string): Promise<Array<{ id: string, path: string, boundaryAfter: 'paragraph' | 'sentence' | 'end' }>> => {
  const paths = [join(dir, 'a.wav'), join(dir, 'b.wav'), join(dir, 'c.wav')]
  await Bun.write(paths[0] as string, paddedToneWav(0.4, 1, 0.6, 440))
  await Bun.write(paths[1] as string, paddedToneWav(0.2, 0.8, 0.3, 660))
  await Bun.write(paths[2] as string, paddedToneWav(0.1, 0.5, 0.5, 880))
  return [
    { id: 'a', path: paths[0] as string, boundaryAfter: 'paragraph' },
    { id: 'b', path: paths[1] as string, boundaryAfter: 'sentence' },
    { id: 'c', path: paths[2] as string, boundaryAfter: 'end' },
  ]
}

const measureIntegratedLufs = async (path: string): Promise<number> => {
  const result = await exec(getFfmpegBinary(), ['-hide_banner', '-nostats', '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'])
  const json = JSON.parse(result.stderr.slice(result.stderr.lastIndexOf('{'), result.stderr.lastIndexOf('}') + 1)) as { input_i: string }
  return Number(json.input_i)
}

describe('TTS delivery mastering', () => {
  test('silencedetect parsing finds leading and trailing edge silence only', () => {
    const stderr = [
      '[silencedetect @ 0x1] silence_start: 0',
      '[silencedetect @ 0x1] silence_end: 0.4 | silence_duration: 0.4',
      '[silencedetect @ 0x1] silence_start: 0.9',
      '[silencedetect @ 0x1] silence_end: 1.0 | silence_duration: 0.1',
      '[silencedetect @ 0x1] silence_start: 1.4',
    ].join('\n')
    expect(parseSilenceDetectEdges(stderr, 2)).toEqual({ leadEndSeconds: 0.4, tailStartSeconds: 1.4 })
    expect(parseSilenceDetectEdges('', 2)).toEqual({ leadEndSeconds: 0, tailStartSeconds: 2 })
  })

  test('seam gaps follow the boundary kind and hard cuts get none', () => {
    const profile = ttsDeliveryPreset('native')
    expect(ttsSeamGapMs(profile, 'paragraph')).toBe(750)
    expect(ttsSeamGapMs(profile, 'turn')).toBe(750)
    expect(ttsSeamGapMs(profile, 'sentence')).toBe(350)
    expect(ttsSeamGapMs(profile, 'word')).toBe(120)
    expect(ttsSeamGapMs(profile, 'hard')).toBe(0)
  })

  test('artifact-integrity: native profile keeps the source sample rate, trims seam silence, and inserts boundary gaps', async () => {
    await withTempDir('tts-delivery-native-', async (dir) => {
      const segments = await writeSegments(dir)
      const result = await masterTtsDelivery({ segments, profile: ttsDeliveryPreset('native'), workDir: join(dir, 'work'), providerLabel: 'test' })
      const assembly = await Bun.file(join(dir, 'work', 'assembly.txt')).text()
      expect(assembly).not.toContain(dir)
      expect(assembly).not.toContain("file '/")
      const observed = await inspectSoundscapeAudio(result.path)
      expect(observed.format).toEqual({ codec: 'pcm_s16le', container: 'wav', sampleRate: SAMPLE_RATE, channels: 1 })
      expect(result.loudness).toBeUndefined()
      expect(result.placements.map((placement) => placement.id)).toEqual(['a', 'b', 'c'])
      // 0.4 s of lead silence minus the 30 ms guard pad.
      expect(Math.abs((result.placements[0]?.trimLeadMs ?? 0) - 370)).toBeLessThanOrEqual(15)
      expect(Math.abs((result.placements[0]?.trimTailMs ?? 0) - 570)).toBeLessThanOrEqual(15)
      expect(result.pauses.map((pause) => [pause.kind, pause.boundary, pause.endMs - pause.startMs])).toEqual([
        ['seam-gap', 'paragraph', 750],
        ['seam-gap', 'sentence', 350],
      ])
      const lastPlacement = result.placements.at(-1)
      expect(Math.abs(observed.durationMs - (lastPlacement?.endMs ?? 0))).toBeLessThanOrEqual(2)
      // Placements and pauses tile the final clock without overlap.
      const spans = [...result.placements.map((entry) => [entry.startMs, entry.endMs]), ...result.pauses.map((entry) => [entry.startMs, entry.endMs])].sort((left, right) => (left[0] as number) - (right[0] as number))
      for (let index = 1; index < spans.length; index += 1) expect(spans[index]?.[0]).toBe(spans[index - 1]?.[1] as number)
    })
  })

  test('artifact-integrity: audiobook profile resamples to 44.1 kHz mono, adds lead-in and lead-out, and reaches the loudness target', async () => {
    await withTempDir('tts-delivery-audiobook-', async (dir) => {
      const segments = await writeSegments(dir)
      const result = await masterTtsDelivery({ segments, profile: ttsDeliveryPreset('audiobook'), workDir: join(dir, 'work'), providerLabel: 'test' })
      const observed = await inspectSoundscapeAudio(result.path)
      expect(observed.format).toEqual({ codec: 'pcm_s16le', container: 'wav', sampleRate: 44100, channels: 1 })
      expect(result.pauses[0]).toMatchObject({ kind: 'lead-in', startMs: 0, endMs: 500 })
      expect(result.pauses.at(-1)?.kind).toBe('lead-out')
      expect((result.pauses.at(-1)?.endMs ?? 0) - (result.pauses.at(-1)?.startMs ?? 0)).toBe(1000)
      expect(result.loudness?.targetIntegratedLufs).toBe(-19)
      expect(Math.abs(await measureIntegratedLufs(result.path) - -19)).toBeLessThanOrEqual(0.5)
    })
  })

  test('artifact-integrity: mastering the same inputs twice yields identical bytes', async () => {
    await withTempDir('tts-delivery-deterministic-', async (dir) => {
      const segments = await writeSegments(dir)
      const first = await masterTtsDelivery({ segments, profile: ttsDeliveryPreset('audiobook'), workDir: join(dir, 'one'), providerLabel: 'test' })
      const second = await masterTtsDelivery({ segments, profile: ttsDeliveryPreset('audiobook'), workDir: join(dir, 'two'), providerLabel: 'test' })
      expect(sha256Bytes(new Uint8Array(await Bun.file(first.path).arrayBuffer()))).toBe(sha256Bytes(new Uint8Array(await Bun.file(second.path).arrayBuffer())))
    })
  })

  test('trim-silence off preserves provider edge silence', async () => {
    await withTempDir('tts-delivery-notrim-', async (dir) => {
      const segments = await writeSegments(dir)
      const result = await masterTtsDelivery({ segments, profile: { ...ttsDeliveryPreset('native'), trimSilence: false }, workDir: join(dir, 'work'), providerLabel: 'test' })
      expect(result.placements.every((placement) => placement.trimLeadMs === 0 && placement.trimTailMs === 0)).toBe(true)
      expect((result.placements[0]?.endMs ?? 0) - (result.placements[0]?.startMs ?? 0)).toBe(2000)
    })
  })

  test('invalid artifact: a truncated, non-audio segment fails mastering instead of producing output', async () => {
    await withTempDir('tts-delivery-invalid-', async (dir) => {
      const path = join(dir, 'broken.wav')
      await Bun.write(path, paddedToneWav(0.1, 0.5, 0.1, 440).subarray(0, 30))
      await expect(masterTtsDelivery({ segments: [{ id: 'broken', path, boundaryAfter: 'end' }], profile: ttsDeliveryPreset('native'), workDir: join(dir, 'work'), providerLabel: 'test' })).rejects.toThrow()
      expect(await Bun.file(join(dir, 'work', 'assembled.wav')).exists()).toBe(false)
    })
  })

  test('an all-silent assembly cannot be loudness normalized and says how to skip it', async () => {
    await withTempDir('tts-delivery-silent-', async (dir) => {
      const path = join(dir, 'silent.wav')
      await Bun.write(path, paddedToneWav(1, 0, 0, 440))
      await expect(masterTtsDelivery({ segments: [{ id: 'silent', path, boundaryAfter: 'end' }], profile: ttsDeliveryPreset('audiobook'), workDir: join(dir, 'work'), providerLabel: 'test' })).rejects.toThrow('--tts-loudness off')
    })
  })
})
