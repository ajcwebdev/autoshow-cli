import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { masterTtsDelivery, parseSilenceDetectEdges } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-mastering'
import { ttsDeliveryPreset, TTS_DELIVERY_SAMPLE_RATES } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-profile'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { withTempDir } from '../../../../test-utils/temp-dirs'

// Exact local PCM fixtures test decoded integrity and timing, not spoken correctness or perception.
const pcmWav = (rate: number, channels: 1 | 2, frames: number, value: (frame: number, channel: number) => number): Buffer => {
  const bytes = Buffer.alloc(44 + frames * channels * 2)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels, 22)
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * channels * 2, 28)
  bytes.writeUInt16LE(channels * 2, 32); bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36); bytes.writeUInt32LE(frames * channels * 2, 40)
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channels; channel++) bytes.writeInt16LE(value(frame, channel), 44 + (frame * channels + channel) * 2)
  return bytes
}

const samples = async (path: string): Promise<number[]> => {
  const bytes = Buffer.from(await Bun.file(path).arrayBuffer())
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4)
    if (bytes.toString('ascii', offset, offset + 4) === 'data') return Array.from({ length: size / 2 }, (_, index) => bytes.readInt16LE(offset + 8 + index * 2))
    offset += 8 + size + size % 2
  }
  throw new Error('Missing decoded PCM data')
}

test('defaults and overrides: both profiles preserve pauses; additions and zero resets never enable trimming', () => {
  for (const preset of ['native', 'audiobook'] as const) {
    const base = resolveTtsDeliveryOptions({ 'tts-audio-profile': preset }).ttsDelivery!
    expect(base.trimSilence).toBe(false)
    expect(base.gapsMs).toEqual({ paragraph: 0, sentence: 0, clause: 0, turn: 0 })
    const added = resolveTtsDeliveryOptions({ 'tts-audio-profile': preset, 'tts-paragraph-pause': '750', 'tts-sentence-pause': '350' }).ttsDelivery!
    expect(added.trimSilence).toBe(false)
    expect(added.gapsMs).toEqual({ paragraph: 750, sentence: 350, clause: 0, turn: 750 })
    expect(resolveTtsDeliveryOptions({ 'tts-audio-profile': preset, 'tts-paragraph-pause': '0', 'tts-sentence-pause': '0' }).ttsDelivery).toEqual(base)
  }
})

test('decoded integrity: native joins preserve stereo edge silence and internal pauses, with additive gaps', async () => {
  await withTempDir('tts-natural-stereo-', async dir => {
    const rate = 24000
    const path = join(dir, 'provider.wav')
    // 200 ms quiet edge, tone, 400 ms internal pause, tone, 300 ms silent tail.
    await Bun.write(path, pcmWav(rate, 2, rate * 2, (frame, channel) => frame < rate * 0.2 ? 4 : frame >= rate * 1.7 || (frame >= rate * 0.8 && frame < rate * 1.2) ? 0 : channel ? -5000 : 5000))
    for (const gap of [0, 750]) {
      const profile = resolveTtsDeliveryOptions({ 'tts-paragraph-pause': String(gap) }).ttsDelivery!
      const result = await masterTtsDelivery({ segments: [{ id: 'a', path, boundaryAfter: 'paragraph' }, { id: 'b', path, boundaryAfter: 'end' }], profile, workDir: join(dir, String(gap)), providerLabel: 'fixture' })
      const pcm = await samples(result.path)
      expect(pcm.length / 2).toBe(rate * (4 + gap / 1000))
      expect(pcm[1000 * 2]).toBe(4)
      expect(pcm[1000 * 2 + 1]).toBe(4)
      expect(pcm[rate]).toBe(5000)
      expect(pcm[rate + 1]).toBe(-5000)
      expect(pcm.slice(rate * 0.8 * 2, rate * 1.2 * 2).every(value => value === 0)).toBe(true)
      expect(result.placements.map(p => [p.startMs, p.endMs, p.trimLeadMs, p.trimTailMs])).toEqual([[0, 2000, 0, 0], [2000 + gap, 4000 + gap, 0, 0]])
      expect(result.pauses.map(p => p.endMs - p.startMs)).toEqual(gap ? [750] : [])
    }
  })
}, 30_000)

test('decoded integrity: outputs of one slot remain continuous before outer trims and fades', async () => {
  await withTempDir('tts-slot-continuity-', async dir => {
    const a = join(dir, 'a.wav'), b = join(dir, 'b.wav')
    await Bun.write(a, pcmWav(24000, 1, 24000, frame => frame < 4800 ? 0 : 5000))
    await Bun.write(b, pcmWav(48000, 2, 48000, frame => frame < 38400 ? 5000 : 0))
    const result = await masterTtsDelivery({
      segments: [{ id: 'slot', path: a, boundaryAfter: 'hard' }, { id: 'slot', path: b, boundaryAfter: 'paragraph' }, { id: 'next', path: a, boundaryAfter: 'end' }],
      profile: { ...ttsDeliveryPreset('native'), trimSilence: true, gapsMs: { paragraph: 750, turn: 0, sentence: 0, clause: 0 } },
      workDir: join(dir, 'work'), providerLabel: 'fixture'
    })
    expect(result.placements).toHaveLength(2)
    const first = result.placements[0]!
    expect(first.sourceDurationMs).toBe(2000)
    expect(first.trimLeadMs).toBeCloseTo(170, 0)
    expect(first.trimTailMs).toBeCloseTo(170, 0)
    expect(result.pauses).toHaveLength(1)
    expect(result.pauses[0]).toMatchObject({ afterId: 'slot', startMs: first.endMs, endMs: first.endMs + 750 })
    const pcm = await samples(result.path)
    // The slot's internal output boundary is 830 ms after its trimmed start.
    expect(pcm.slice(19800, 20040).every(value => value > 4900)).toBe(true)
  })
}, 30_000)

for (const detected of [
  'silence_end: 0.2', 'silence_start: 0\nsilence_start: 0.2',
  'silence_start: 0.5\nsilence_end: 0.4', 'silence_start: -0.1\nsilence_end: 0.4',
  'silence_start: 0\nsilence_end: NaN', 'silence_start: Infinity',
  'silence_start: 0\nsilence_end: 2.1', 'silence_start: 0\nsilence_end: 2',
  'silence_start: 0\nsilence_end: 1\nsilence_start: 0.9', 'silence_start: 0\nsilence_end: 1.99',
  'silence_start: 0\nsilence_end: 0.2\nsilence_start:',
  'silence_start: 0\nsilence_end:\nsilence_start: 1.8',
  'silence_start: 0\nsilence_end: 0x1',
]) test(`ambiguous detection leaves audio intact: ${detected}`, () => {
  expect(parseSilenceDetectEdges(detected, 2)).toEqual({ leadEndSeconds: 0, tailStartSeconds: 2 })
})

test('decoded integrity: opt-in trimming retains short, silent, and quiet-edge clips and internal silence', async () => {
  await withTempDir('tts-edge-guards-', async dir => {
    for (const [name, frames, value] of [
      ['short', 240, () => 1000], ['silent', 24000, () => 0],
      ['quiet', 24000, (frame: number) => frame < 480 || frame >= 23520 ? 2 : frame > 8000 && frame < 16000 ? 0 : 5000],
    ] as const) {
      const path = join(dir, `${name}.wav`)
      await Bun.write(path, pcmWav(24000, 1, frames, value))
      const result = await masterTtsDelivery({ segments: [{ id: name, path, boundaryAfter: 'end' }], profile: { ...ttsDeliveryPreset('native'), trimSilence: true }, workDir: join(dir, name), providerLabel: 'fixture' })
      const pcm = await samples(result.path)
      expect(pcm.length).toBe(frames)
      expect(result.placements[0]).toMatchObject({ trimLeadMs: 0, trimTailMs: 0 })
      if (name === 'quiet') expect(pcm.slice(8001, 16000).every(value => value === 0)).toBe(true)
    }
  })
}, 30_000)

for (const rate of TTS_DELIVERY_SAMPLE_RATES) test(`frame accounting: cumulative positions do not drift at ${rate} Hz`, async () => {
  await withTempDir('tts-frame-clock-', async dir => {
    const path = join(dir, 'provider.wav')
    await Bun.write(path, pcmWav(rate, 1, 1001, () => 5000))
    const count = 25
    const result = await masterTtsDelivery({ segments: Array.from({ length: count }, (_, i) => ({ id: String(i), path, boundaryAfter: 'sentence' as const })), profile: ttsDeliveryPreset('native'), workDir: join(dir, 'work'), providerLabel: 'fixture' })
    expect((await samples(result.path)).length).toBe(count * 1001)
    expect(result.pauses).toEqual([])
    for (const [i, placement] of result.placements.entries()) {
      expect(placement.startMs).toBe(Math.round(i * 1001 / rate * 1000))
      expect(placement.endMs).toBe(Math.round((i + 1) * 1001 / rate * 1000))
    }
  })
}, 60_000)

test('invalid artifact: truncated PCM data is rejected and retained provider bytes stay intact', async () => {
  await withTempDir('tts-truncated-data-', async dir => {
    const path = join(dir, 'provider.wav')
    const bytes = pcmWav(24000, 1, 24000, () => 5000).subarray(0, 10000)
    await Bun.write(path, bytes)
    await expect(masterTtsDelivery({ segments: [{ id: 'slot', path, boundaryAfter: 'end' }], profile: ttsDeliveryPreset('native'), workDir: join(dir, 'work'), providerLabel: 'fixture' })).rejects.toThrow('truncated')
    expect(bytes.equals(Buffer.from(await Bun.file(path).arrayBuffer()))).toBe(true)
    expect(await Bun.file(join(dir, 'work', 'assembled.wav')).exists()).toBe(false)
  })
})
