import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildTtsFfmetadata, encodeTtsDelivery } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-encode'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { withTempDir } from '../../../../test-utils/temp-dirs'

type Probe = {
  format: { format_name: string, duration: string, tags?: Record<string, string> }
  streams: Array<{ codec_type: string, codec_name: string, sample_rate?: string, channels?: number, disposition?: { attached_pic?: number } }>
  chapters: Array<{ start_time: string, end_time: string, tags?: { title?: string } }>
}

const probe = async (path: string): Promise<Probe> => {
  const result = await exec(getFfprobeBinary(), ['-v', 'error', '-show_format', '-show_streams', '-show_chapters', '-of', 'json', path])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  return JSON.parse(result.stdout) as Probe
}

const tagsOf = (value: Probe): Record<string, string> =>
  Object.fromEntries(Object.entries(value.format.tags ?? {}).map(([key, tag]) => [key.toLowerCase(), tag]))

const writeMasters = async (dir: string): Promise<string[]> => {
  const paths = [join(dir, 'ch1.wav'), join(dir, 'ch2.wav')]
  await Bun.write(paths[0] as string, createSyntheticWavBytes({ sampleRate: 44100, durationSeconds: 2, frequencyHz: 440, amplitude: 0.3 }))
  await Bun.write(paths[1] as string, createSyntheticWavBytes({ sampleRate: 44100, durationSeconds: 3, frequencyHz: 660, amplitude: 0.3 }))
  return paths
}

const writeCover = async (dir: string): Promise<string> => {
  const path = join(dir, 'cover.png')
  const result = await exec(getFfmpegBinary(), ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=navy:s=64x64', '-frames:v', '1', '-y', path])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  return path
}

const CHAPTERS = [
  { title: 'Chapter One: Arrival', startMs: 0, endMs: 2000 },
  { title: 'Chapter Two; A = B', startMs: 2000, endMs: 5000 },
]
const METADATA = { title: 'Example Book', artist: 'Example Author', album: 'Example Book', genre: 'Audiobook' }

describe('TTS delivery export', () => {
  test('ffmetadata escapes reserved characters and writes millisecond chapters', () => {
    expect(buildTtsFfmetadata({ title: 'A=B; #1' }, [{ title: 'One\\Two', startMs: 0, endMs: 1500.4 }])).toBe([
      ';FFMETADATA1',
      'title=A\\=B\\; \\#1',
      '[CHAPTER]',
      'TIMEBASE=1/1000',
      'START=0',
      'END=1500',
      'title=One\\\\Two',
      '',
    ].join('\n'))
  })

  test('artifact-integrity: m4b book export carries AAC audio, tags, cover art, and one chapter per source', async () => {
    await withTempDir('tts-export-m4b-', async (dir) => {
      const outputPath = await encodeTtsDelivery({ sourcePaths: await writeMasters(dir), outputPath: join(dir, 'book.m4b'), options: { format: 'm4b', metadata: METADATA, coverPath: await writeCover(dir) }, chapters: CHAPTERS })
      const observed = await probe(outputPath)
      const audio = observed.streams.find((stream) => stream.codec_type === 'audio')
      expect(audio?.codec_name).toBe('aac')
      expect(audio?.sample_rate).toBe('44100')
      expect(observed.streams.some((stream) => stream.codec_type === 'video' && stream.disposition?.attached_pic === 1)).toBe(true)
      expect(observed.chapters.map((chapter) => chapter.tags?.title)).toEqual(CHAPTERS.map((chapter) => chapter.title))
      expect(observed.chapters.map((chapter) => Math.round(Number(chapter.start_time) * 1000))).toEqual([0, 2000])
      expect(tagsOf(observed)).toMatchObject({ title: 'Example Book', artist: 'Example Author', genre: 'Audiobook' })
      expect(Math.abs(Number(observed.format.duration) - 5)).toBeLessThan(0.1)
    })
  })

  test('artifact-integrity: mp3 export is MPEG audio at the requested bitrate with ID3 tags and cover art', async () => {
    await withTempDir('tts-export-mp3-', async (dir) => {
      const [first] = await writeMasters(dir)
      const outputPath = await encodeTtsDelivery({ sourcePaths: [first as string], outputPath: join(dir, 'chapter.mp3'), options: { format: 'mp3', bitrateKbps: 64, metadata: METADATA, coverPath: await writeCover(dir) } })
      const observed = await probe(outputPath)
      expect(observed.format.format_name).toBe('mp3')
      expect(observed.streams.find((stream) => stream.codec_type === 'audio')?.codec_name).toBe('mp3')
      expect(observed.streams.some((stream) => stream.disposition?.attached_pic === 1)).toBe(true)
      expect(tagsOf(observed)).toMatchObject({ title: 'Example Book', artist: 'Example Author' })
      const bytes = (await Bun.file(outputPath).arrayBuffer()).byteLength
      expect(bytes).toBeLessThan(2 * 64000 / 8 * 1.6)
    })
  })

  test('artifact-integrity: flac and m4a exports decode to the source duration', async () => {
    await withTempDir('tts-export-lossless-', async (dir) => {
      const [first] = await writeMasters(dir)
      for (const format of ['flac', 'm4a'] as const) {
        const observed = await probe(await encodeTtsDelivery({ sourcePaths: [first as string], outputPath: join(dir, `chapter.${format}`), options: { format, metadata: METADATA } }))
        expect(observed.streams[0]?.codec_name).toBe(format === 'flac' ? 'flac' : 'aac')
        expect(Math.abs(Number(observed.format.duration) - 2)).toBeLessThan(0.1)
        expect(tagsOf(observed)['title']).toBe('Example Book')
      }
    })
  })

  test('invalid artifact: an export without chapter input has no chapter markers, so a book check must fail it', async () => {
    await withTempDir('tts-export-nochapters-', async (dir) => {
      const observed = await probe(await encodeTtsDelivery({ sourcePaths: await writeMasters(dir), outputPath: join(dir, 'plain.m4b'), options: { format: 'm4b' } }))
      expect(observed.chapters).toEqual([])
    })
  })

  test('invalid artifact: a corrupt master fails the export and leaves no output file', async () => {
    await withTempDir('tts-export-corrupt-', async (dir) => {
      const broken = join(dir, 'broken.wav')
      await Bun.write(broken, 'not audio')
      const outputPath = join(dir, 'out.mp3')
      await expect(encodeTtsDelivery({ sourcePaths: [broken], outputPath, options: { format: 'mp3' } })).rejects.toThrow('Failed to export TTS delivery audio as mp3')
      expect(await Bun.file(outputPath).exists()).toBe(false)
      expect(await Bun.file(`${outputPath}.ffmeta`).exists()).toBe(false)
    })
  })

  test('a missing cover image is rejected before ffmpeg runs', async () => {
    await withTempDir('tts-export-nocover-', async (dir) => {
      const [first] = await writeMasters(dir)
      await expect(encodeTtsDelivery({ sourcePaths: [first as string], outputPath: join(dir, 'out.m4a'), options: { format: 'm4a', coverPath: join(dir, 'missing.png') } })).rejects.toThrow('cover image was not found')
    })
  })
})
