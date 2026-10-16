import { afterAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { childEnv } from '~/utils/child-env'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { parseStoredTranscriptionResult } from '~/cli/commands/stt/stt-utils/stt-result-artifacts'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const VIDEO = 'input/examples/video/01-two-speaker-speech.mp4'
const STEREO = 'input/examples/audio/01-two-speaker-speech-stereo.wav'
const TRANSCRIPT = 'input/examples/video/01-two-speaker-speech.transcript.json'
const SUBTITLES = 'input/examples/video/01-two-speaker-speech.vtt'
const tempDirs = createTempDirTracker('autoshow-documentation-media-')
afterAll(async () => await tempDirs.cleanup())

type Captured = { exitCode: number; stdout: string; stderr: string }
type Probe = {
  format: { duration: string }
  streams: Array<{ codec_type: string; codec_name: string; channels?: number; sample_rate?: string; width?: number; height?: number }>
}

const capture = async (args: string[], environment = childEnv()): Promise<Captured> => {
  const child = Bun.spawn(args, {
    env: environment,
    stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
    signal: AbortSignal.timeout(20_000)
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()
  ])
  return { exitCode, stdout, stderr }
}

const successful = async (args: string[]): Promise<string> => {
  const result = await capture(args)
  if (result.exitCode !== 0) throw new Error(`Local media command failed: ${result.stderr}`)
  return result.stdout.trim()
}

const probe = async (path: string): Promise<Probe> => JSON.parse(await successful([
  getFfprobeBinary(), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path
])) as Probe

const seconds = (timestamp: string): number => {
  const [hours, minutes, value] = timestamp.split(':').map(Number)
  if (hours === undefined || minutes === undefined || value === undefined) throw new Error(`Invalid fixture timestamp ${timestamp}`)
  return hours * 3600 + minutes * 60 + value
}

const offlineWorkspace = async () => {
  const directory = await tempDirs.make()
  const preload = join(directory, 'network-forbidden.ts')
  const calls = join(directory, 'network-attempts.txt')
  const config = join(directory, 'empty-config.json')
  await Bun.write(config, '{}\n')
  await Bun.write(preload, `import { appendFileSync } from 'node:fs'
globalThis.fetch = () => {
  appendFileSync(${JSON.stringify(calls)}, 'attempt\\n')
  throw new Error('Network forbidden during documentation media verification')
}
`)
  return {
    directory,
    cli: async (args: string[]) => await capture([
      process.execPath, '--no-env-file', '--preload', preload,
      'src/cli/create-cli.ts', 'extract', ...args, '--json', '--config-path', config
    ], childEnv({ set: { HOME: directory } })),
    expectNoNetwork: async () => expect(await Bun.file(calls).exists()).toBe(false)
  }
}

test('portable speech media fully decodes and retains its documented duration and channel formats', async () => {
  const [video, stereo, mp3] = await Promise.all([probe(VIDEO), probe(STEREO), probe('input/examples/audio/1-audio.mp3')])
  expect(Number(video.format.duration)).toBeCloseTo(24, 3)
  expect(video.streams.find(stream => stream.codec_type === 'video')).toMatchObject({ codec_name: 'h264', width: 640, height: 268 })
  expect(video.streams.find(stream => stream.codec_type === 'audio')).toMatchObject({ codec_name: 'aac', channels: 2 })
  expect(Number(stereo.format.duration)).toBeCloseTo(24, 3)
  expect(stereo.streams).toMatchObject([{ codec_name: 'pcm_s16le', sample_rate: '16000', channels: 2 }])
  expect(Number(mp3.format.duration)).toBeGreaterThan(20)
  for (const input of [VIDEO, STEREO, 'input/examples/audio/1-audio.mp3']) {
    await successful([getFfmpegBinary(), '-v', 'error', '-nostdin', '-i', input, '-map', '0:a:0', ...(input === VIDEO ? ['-map', '0:v:0'] : []), '-f', 'null', '-'])
  }
}, 30_000)

test('saved subtitle text covers the two labelled characters within the excerpt timeline without claiming native word timing', async () => {
  const packet = await Bun.file(TRANSCRIPT).json()
  const transcript = parseStoredTranscriptionResult(packet)
  expect(transcript).toBeDefined()
  expect(transcript!.segments).toHaveLength(9)
  expect(transcript!.segments.map(segment => segment.text).join(' ')).toBe(transcript!.text)
  expect([...new Set(transcript!.segments.map(segment => segment.speaker))].sort()).toEqual(['Celia', 'Thom'])
  expect(transcript!.evidence).toMatchObject({ timingQuality: 'coarse', capabilities: { hasNativeWordTiming: false, hasSpeakerLabels: true } })
  expect(transcript!.evidence?.words).toBeUndefined()
  expect(packet.fixtureProvenance).toMatchObject({ sourceStartSeconds: 22, sourceEndSeconds: 46, durationSeconds: 24, license: 'https://creativecommons.org/licenses/by/3.0/' })
  const vtt = await Bun.file(SUBTITLES).text()
  expect(vtt.startsWith('WEBVTT\n')).toBe(true)
  expect(vtt).not.toContain('years later')
  let previousEnd = 0
  for (const segment of transcript!.segments) {
    const start = seconds(segment.start), end = seconds(segment.end)
    expect(Number.isFinite(start) && Number.isFinite(end)).toBe(true)
    expect(start).toBeGreaterThanOrEqual(previousEnd)
    expect(end).toBeGreaterThan(start)
    expect(end).toBeLessThanOrEqual(24)
    expect(vtt).toContain(`${segment.start} --> ${segment.end}\n[${segment.speaker}] ${segment.text}`)
    previousEnd = end
  }
})

test('actual offline caption CLI preserves fixture text and speakers while exposing interpolated word layouts', async () => {
  const workspace = await offlineWorkspace()
  const before = await Bun.file(TRANSCRIPT).text()
  const phraseDirectory = join(workspace.directory, 'phrase')
  const phrase = await workspace.cli([TRANSCRIPT, '--captions', '--caption-format', 'both', '--output-dir', phraseDirectory])
  expect(phrase).toMatchObject({ exitCode: 0 })
  expect(JSON.parse(phrase.stdout)).toMatchObject({ status: 'success' })
  const metadata = await Bun.file(join(phraseDirectory, 'captions.json')).json()
  expect(metadata).toMatchObject({ timingQuality: 'segment_interpolated', inferredWords: 67, invalidWords: 0, mode: 'phrase' })
  expect(metadata.cues[0]).toMatchObject({ start: 1, end: 2.5, speaker: 'Celia', text: "[Celia] You're a jerk, Thom." })
  expect(metadata.cues.at(-1)).toMatchObject({ start: 20.2, end: 23, speaker: 'Celia', text: "[Celia] Whatever, Thom. We're done." })
  expect(metadata.cues.some((cue: { speaker: string }) => cue.speaker === 'Thom')).toBe(true)
  for (const cue of metadata.cues as Array<{ start: number; end: number }>) {
    expect(cue.start).toBeGreaterThanOrEqual(0)
    expect(cue.end).toBeGreaterThan(cue.start)
    expect(cue.end).toBeLessThanOrEqual(24)
  }
  expect(await Bun.file(join(phraseDirectory, 'captions.srt')).text()).toContain("You're a jerk, Thom.")
  expect(await Bun.file(join(phraseDirectory, 'captions.vtt')).text()).toContain('[Thom]')

  const wordDirectory = join(workspace.directory, 'word')
  const word = await workspace.cli(['--captions', '--transcript-result', TRANSCRIPT, '--caption-mode', 'word', '--caption-format', 'vtt', '--no-caption-speakers', '--output-dir', wordDirectory])
  expect(word).toMatchObject({ exitCode: 0 })
  const wordMetadata = await Bun.file(join(wordDirectory, 'captions.json')).json()
  expect(wordMetadata).toMatchObject({ timingQuality: 'segment_interpolated', inferredWords: 67, invalidWords: 0, mode: 'word' })
  expect(wordMetadata.cues).toHaveLength(67)
  const wordVtt = await Bun.file(join(wordDirectory, 'captions.vtt')).text()
  expect(wordVtt).not.toContain('[Celia]')
  expect(wordVtt).not.toContain('[Thom]')
  expect(await Bun.file(join(wordDirectory, 'captions.srt')).exists()).toBe(false)
  expect(await Bun.file(TRANSCRIPT).text()).toBe(before)
  await workspace.expectNoNetwork()
}, 30_000)

test('actual offline channel split yields distinct mono files matching each decoded stereo source channel', async () => {
  const workspace = await offlineWorkspace()
  const output = join(workspace.directory, 'channels')
  const result = await workspace.cli([STEREO, '--split-channels', '--output-dir', output])
  expect(result).toMatchObject({ exitCode: 0 })
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'success', data: { metrics: { providerCalls: 0 } } })
  const manifest = await Bun.file(join(output, 'channels.json')).json() as {
    identity: string
    channels: Array<{ id: string; streamIndex: number; channelIndex: number; sampleRate: number; offsetSeconds: number; audio: string; decodedSha256: string }>
  }
  expect(manifest.identity).toContain('not inferred person identity')
  expect(manifest.channels).toHaveLength(2)
  const hashes: string[] = []
  for (const [index, channel] of manifest.channels.entries()) {
    expect(channel).toMatchObject({ id: `stream-0-channel-${index + 1}`, streamIndex: 0, channelIndex: index, sampleRate: 16000, offsetSeconds: 0 })
    const outputProbe = await probe(channel.audio)
    expect(outputProbe.streams).toMatchObject([{ codec_name: 'pcm_f32le', channels: 1, sample_rate: '16000' }])
    expect(Number(outputProbe.format.duration)).toBeCloseTo(24, 3)
    const expected = await successful([getFfmpegBinary(), '-v', 'error', '-nostdin', '-i', STEREO, '-map', '0:a:0', '-af', `pan=mono|c0=c${index}`, '-c:a', 'pcm_f32le', '-f', 'hash', '-hash', 'sha256', '-'])
    const actual = await successful([getFfmpegBinary(), '-v', 'error', '-nostdin', '-i', channel.audio, '-c:a', 'pcm_f32le', '-f', 'hash', '-hash', 'sha256', '-'])
    expect(actual).toBe(expected)
    expect(channel.decodedSha256).toBe(expected)
    hashes.push(actual)
  }
  expect(new Set(hashes).size).toBe(2)
  await workspace.expectNoNetwork()
}, 30_000)

test('offline media workflows reject untimed transcripts and invalid audio without writing success artifacts', async () => {
  const workspace = await offlineWorkspace()
  const untimed = join(workspace.directory, 'untimed.json')
  const invalidAudio = join(workspace.directory, 'invalid-stereo.wav')
  const captionsOutput = join(workspace.directory, 'invalid-captions')
  const channelsOutput = join(workspace.directory, 'invalid-channels')
  await Bun.write(untimed, JSON.stringify({ text: 'Deliberately untimed text.', segments: [] }))
  await Bun.write(invalidAudio, 'Deliberately invalid audio bytes.\n')
  const captions = await workspace.cli([untimed, '--captions', '--output-dir', captionsOutput])
  expect(captions.exitCode).not.toBe(0)
  expect(JSON.parse(captions.stdout)).toMatchObject({ status: 'failure' })
  expect(captions.stdout).toContain('no usable timed segment or word')
  expect(await Bun.file(join(captionsOutput, 'captions.vtt')).exists()).toBe(false)
  const channels = await workspace.cli([invalidAudio, '--split-channels', '--output-dir', channelsOutput])
  expect(channels.exitCode).not.toBe(0)
  expect(JSON.parse(channels.stdout)).toMatchObject({ status: 'failure' })
  expect(channels.stdout).toContain('Invalid data found when processing input')
  expect(await Bun.file(join(channelsOutput, 'channels.json')).exists()).toBe(false)
  expect(await Bun.file(untimed).exists()).toBe(true)
  expect(await Bun.file(invalidAudio).exists()).toBe(true)
  await workspace.expectNoNetwork()
}, 30_000)
