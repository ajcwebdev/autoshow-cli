import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { runSingleTtsInput, runTtsDirectoryBatch } from '~/cli/commands/audio/tts/define-tts-command'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { ttsBookChapterTitle } from '~/cli/commands/audio/tts/tts-book-assembly'
import { exec } from '~/utils/cli-utils'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import type { Step4Metadata } from '~/types'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY'], tempPrefix: 'autoshow-tts-delivery-book-' })

type Probe = {
  format: { format_name: string, duration: string, tags?: Record<string, string> }
  streams: Array<{ codec_type: string, codec_name: string, sample_rate?: string }>
  chapters: Array<{ start_time: string, end_time: string, tags?: { title?: string } }>
}

const probe = async (path: string): Promise<Probe> => {
  const result = await exec(getFfprobeBinary(), ['-v', 'error', '-show_format', '-show_streams', '-show_chapters', '-of', 'json', path])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  return JSON.parse(result.stdout) as Probe
}

const commandOptions = (deliveryFlags: Record<string, unknown>): Parameters<typeof runSingleTtsInput>[1] => ({
  ...buildOptsFromFlags({ 'openai-tts': 'gpt-4o-mini-tts-2025-12-15' }),
  ...resolveTtsDeliveryOptions(deliveryFlags),
  batchConcurrency: 2,
  price: false,
  allowOverBudget: false,
})

const installProviderAudio = () => installMockFetch(() => new Response(
  createSyntheticWavBytes({ sampleRate: 24000, durationSeconds: 1, frequencyHz: 440, amplitude: 0.4 }),
  { status: 200, headers: { 'content-type': 'audio/wav' } }
))

afterEach(() => resetPinnedRunDir())

describe('TTS delivery export and book contracts', () => {
  test('chapter titles come from input file stems', () => {
    expect(ttsBookChapterTitle('/books/example/01_the-first-day.txt')).toBe('01 the first day')
    expect(ttsBookChapterTitle('chapter.md')).toBe('chapter')
  })

  test('artifact-integrity: a single file exports mp3 beside the retained WAV master and records it in the manifest', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    installProviderAudio()
    const dir = await tempDirs.make()
    const inputPath = join(dir, 'chapter.txt')
    const outputDir = join(dir, 'run')
    await Bun.write(inputPath, 'One short chapter, read aloud. It has two sentences.')
    configurePinnedRunDir(outputDir)
    const options = commandOptions({ 'tts-export-format': 'mp3', 'tts-bitrate': '96', 'tts-metadata': ['title=Short Chapter', 'artist=Test Author'] })
    await runSingleTtsInput(inputPath, options, collectTtsTargets(options), undefined)
    const manifest = await readManifest(outputDir)
    const recorded = (manifest?.items[0]?.metadata?.['tts'] as Step4Metadata[] | undefined)?.[0]
    expect(recorded?.audioFileName).toBe('speech.wav')
    expect(recorded?.deliveryExport).toMatchObject({ fileName: 'speech.mp3', format: 'mp3', bitrateKbps: 96 })
    expect(await Bun.file(join(outputDir, 'speech.wav')).exists()).toBe(true)
    const observed = await probe(join(outputDir, 'speech.mp3'))
    expect(observed.streams[0]?.codec_name).toBe('mp3')
    expect(observed.streams[0]?.sample_rate).toBe('24000')
    expect(Object.fromEntries(Object.entries(observed.format.tags ?? {}).map(([key, value]) => [key.toLowerCase(), value]))).toMatchObject({ title: 'Short Chapter', artist: 'Test Author' })
  }, 60_000)

  test('artifact-integrity: a directory batch assembles one m4b with a chapter per input in filename order', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const calls = installProviderAudio()
    const dir = await tempDirs.make()
    const inputDir = join(dir, 'book')
    const outputDir = join(dir, 'run')
    await mkdir(inputDir)
    await Bun.write(join(inputDir, '02-second.txt'), 'The second chapter follows the first.')
    await Bun.write(join(inputDir, '01-first.txt'), 'The first chapter opens the book.')
    await Bun.write(join(inputDir, '10-tenth.txt'), 'The tenth chapter sorts after the second.')
    configurePinnedRunDir(outputDir)
    const options = commandOptions({ 'tts-audio-profile': 'audiobook', 'tts-export-format': 'm4b', 'tts-book': true, 'tts-metadata': ['title=Example Book', 'album=Example Book'] })
    await runTtsDirectoryBatch(inputDir, options, collectTtsTargets(options), undefined)
    expect(calls.length).toBe(3)
    const observed = await probe(join(outputDir, 'book.m4b'))
    expect(observed.streams.find((stream) => stream.codec_type === 'audio')?.codec_name).toBe('aac')
    expect(observed.streams.find((stream) => stream.codec_type === 'audio')?.sample_rate).toBe('44100')
    expect(observed.chapters.map((chapter) => chapter.tags?.title)).toEqual(['01 first', '02 second', '10 tenth'])
    const chapterEnds = observed.chapters.map((chapter) => Number(chapter.end_time))
    expect(Math.abs(Number(observed.format.duration) - (chapterEnds.at(-1) ?? 0))).toBeLessThan(0.1)
    // Each chapter: 500 ms lead-in + ~0.9 s trimmed speech + 1000 ms lead-out.
    for (const chapter of observed.chapters) expect(Math.abs(Number(chapter.end_time) - Number(chapter.start_time) - 2.4)).toBeLessThan(0.1)
    for (const stem of ['01-first', '02-second', '10-tenth']) {
      expect(await Bun.file(join(outputDir, `${stem}.wav`)).exists()).toBe(true)
      expect(await Bun.file(join(outputDir, `${stem}.m4b`)).exists()).toBe(true)
    }
    const manifest = await readManifest(outputDir)
    const books = manifest?.source?.['books'] as Array<{ fileName: string, chapters: unknown[] }> | undefined
    expect(books?.[0]?.fileName).toBe('book.m4b')
    expect(books?.[0]?.chapters).toHaveLength(3)

    // Rerunning in the same directory rebuilds the book with new tags and buys nothing.
    const retagged = commandOptions({ 'tts-audio-profile': 'audiobook', 'tts-export-format': 'm4b', 'tts-book': true, 'tts-metadata': ['title=Retitled Book'] })
    await runTtsDirectoryBatch(inputDir, retagged, collectTtsTargets(retagged), undefined)
    expect(calls.length).toBe(3)
    const rebuilt = await probe(join(outputDir, 'book.m4b'))
    expect(Object.fromEntries(Object.entries(rebuilt.format.tags ?? {}).map(([key, value]) => [key.toLowerCase(), value]))['title']).toBe('Retitled Book')
    const rebuiltChapter = await probe(join(outputDir, '01-first.m4b'))
    expect(Object.fromEntries(Object.entries(rebuiltChapter.format.tags ?? {}).map(([key, value]) => [key.toLowerCase(), value]))['title']).toBe('Retitled Book')
  }, 120_000)
})
