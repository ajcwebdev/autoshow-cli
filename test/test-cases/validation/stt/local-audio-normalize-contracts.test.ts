import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  prepareWhisperfileInput,
  transcribeWhisperfile,
  WHISPERFILE_REJECTED_SAMPLE_COUNT_MULTIPLE
} from '~/cli/commands/stt/local/whisperfile/transcribe'
import { exec } from '~/utils/cli-utils'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { assertDecodableMedia } from '../../../test-utils/assert-generated-content'

const SAMPLE_RATE = 16000

const preparedSampleCount = async (path: string): Promise<number> => {
  const result = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=duration_ts',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    path
  ])
  return Number.parseInt(result.stdout.trim(), 10)
}

describe('Whisperfile input preparation', () => {
  test('converts PCM WAV through the supported decoder and preserves source audio', async () => {
    await withTempDir('whisper-input-', async dir => {
      const source = join(dir, 'voice.wav')
      const bytes = createSyntheticWavBytes({ durationSeconds: 0.3, frequencyHz: 440, amplitude: 0.3 })
      await Bun.write(source, bytes)
      const prepared = await prepareWhisperfileInput(source)
      try {
        expect(prepared.audioPath).not.toBe(source)
        expect(prepared.audioPath.endsWith('.flac')).toBe(true)
        await assertDecodableMedia(prepared.audioPath, 'audio', { durationSeconds: 2 })
      } finally {
        await prepared.cleanup()
      }
      expect(await Bun.file(prepared.audioPath).exists()).toBe(false)
      expect(new Uint8Array(await Bun.file(source).arrayBuffer())).toEqual(new Uint8Array(bytes))
    })
  })

  // The pinned whisperfile executable fails with "failed to read audio file" whenever the decoded
  // length is an exact multiple of 0.16s, in every container tested, so preparation must move off it.
  for (const durationSeconds of [2.56, 3.2, 4.0, 9.28]) test(`pads a ${durationSeconds}s input off the rejected sample-count boundary`, async () => {
    await withTempDir('whisper-boundary-', async dir => {
      const source = join(dir, 'boundary.wav')
      await Bun.write(source, createSyntheticWavBytes({ durationSeconds, frequencyHz: 440, amplitude: 0.3 }))
      expect((durationSeconds * SAMPLE_RATE) % WHISPERFILE_REJECTED_SAMPLE_COUNT_MULTIPLE).toBe(0)

      const prepared = await prepareWhisperfileInput(source)
      try {
        const samples = await preparedSampleCount(prepared.audioPath)
        expect(samples % WHISPERFILE_REJECTED_SAMPLE_COUNT_MULTIPLE).not.toBe(0)
        expect(samples).toBeGreaterThanOrEqual(durationSeconds * SAMPLE_RATE)
        expect(samples).toBeLessThan(durationSeconds * SAMPLE_RATE + SAMPLE_RATE)
      } finally {
        await prepared.cleanup()
      }
    })
  })

  test('transcribes a boundary-length clip instead of failing to read it', async () => {
    await withTempDir('whisper-boundary-run-', async dir => {
      const source = join(dir, 'boundary.wav')
      await Bun.write(source, createSyntheticWavBytes({ durationSeconds: 9.28, frequencyHz: 440, amplitude: 0.2 }))
      const { result } = await transcribeWhisperfile(source, join(dir, 'out'), { model: 'tiny', segmentOffsetMinutes: 0 })
      expect(typeof result.text).toBe('string')
    })
  }, 120_000)
})
