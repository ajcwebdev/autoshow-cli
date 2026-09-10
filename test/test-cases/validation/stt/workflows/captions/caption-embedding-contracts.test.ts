import { test, expect } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { embedCaptionTracks, preflightCaptionEmbedding, probeCaptionMedia } from '~/cli/commands/stt/workflows/captions/embed-caption-tracks'
import { prepareSttMedia } from '~/cli/commands/stt/stt-media-acquisition'
import { decodedAudioHash } from '~/cli/commands/stt/workflows/captions/verify-caption-media'

const command = async (args: string[]) => {
  const child = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' })
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (code) throw new Error(err + out)
  return out
}

test('lossless preparation preserves distinct stereo float samples and records the audio timeline', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lossless audio '))
  try {
    const source = join(dir, 'source.mkv')
    await command(['runtime/bin/ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'aevalsrc=0.123456789*sin(440*2*PI*t)|0.987654321*sin(660*2*PI*t):s=48000:d=1', '-af', 'asetpts=PTS+0.04/TB', '-c:a', 'pcm_f32le', source])
    const prepared = await prepareSttMedia({ source: { filePath: source }, targets: [], audioProfile: 'lossless', outputDir: join(dir, 'prepared') })
    try {
      expect(await decodedAudioHash(prepared.outputArtifacts.sourceMediaPath)).toBe(await decodedAudioHash(source))
      const timeline = await Bun.file(join(dir, 'prepared', 'source-timeline.json')).json()
      expect(timeline).toMatchObject({ sampleFormat: 'float32', channels: 2, sampleRate: 48000, decodedSamplesMatch: true, audioToVideoOffsetSeconds: 0.04 })
      expect(prepared.durationSeconds).toBeCloseTo(1, 3)
    } finally { await prepared.cleanup?.() }
  } finally { await rm(dir, { recursive: true, force: true }) }
}, 30_000)

test('MP4/MKV embedding preserves streams and chapters, round trips cues, and refuses overwrite', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'caption tracks '))
  try {
    const source = join(dir, 'source video.mp4'), srt = join(dir, 'captions.srt')
    await Bun.write(srt, '1\n00:00:00,125 --> 00:00:00,875\nHello world.\n\n2\n00:00:01,040 --> 00:00:01,750\nSecond phrase.\n')
    const metadata = join(dir, 'chapters.txt')
    await Bun.write(metadata, ';FFMETADATA1\ntitle=Fixture\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=2000\ntitle=Opening\n')
    await command(['runtime/bin/ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=s=32x32:r=25', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-i', metadata, '-map', '0:v', '-map', '1:a', '-map_metadata', '2', '-map_chapters', '2', '-c:v', 'mpeg4', '-c:a', 'aac', '-t', '2', source])
    const files = await embedCaptionTracks(source, srt, dir, 'both')
    for (const container of ['mp4', 'mkv']) {
      const output = join(dir, files[container]!)
      const probe = await probeCaptionMedia(output)
      expect(probe.streams.find(s => s.codec_type === 'subtitle')).toMatchObject({ codec_name: container === 'mp4' ? 'mov_text' : 'subrip', tags: { language: 'eng' }, disposition: { forced: 0 } })
      expect(probe.chapters?.[0]?.tags?.['title']).toBe('Opening')
      const extracted = await command(['runtime/bin/ffmpeg', '-v', 'error', '-copyts', '-i', output, '-map', '0:s:0', '-f', 'srt', '-'])
      expect(extracted.trim()).toBe((await Bun.file(srt).text()).trim())
      for (const type of ['v', 'a']) {
        const hashArgs = ['-map', `0:${type}:0`, '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']
        expect(await command(['runtime/bin/ffmpeg', '-v', 'error', '-i', output, ...hashArgs])).toBe(await command(['runtime/bin/ffmpeg', '-v', 'error', '-i', source, ...hashArgs]))
      }
      const secondDir = join(dir, container + ' second')
      await Bun.write(join(secondDir, '.keep'), '')
      await embedCaptionTracks(output, srt, secondDir, container)
      expect((await probeCaptionMedia(join(secondDir, `captioned.${container}`))).streams.filter(s => s.codec_type === 'subtitle')).toHaveLength(2)
    }
    await expect(embedCaptionTracks(source, srt, dir, 'both')).rejects.toThrow('overwrite')
    await expect(preflightCaptionEmbedding(join(dir, 'captioned.mp4'), 'mkv')).rejects.toThrow('mov_text')
    await expect(preflightCaptionEmbedding(srt, 'both')).rejects.toThrow()
  } finally { await rm(dir, { recursive: true, force: true }) }
}, 30_000)

test('offline CLI embeds saved evidence with zero network calls and returns video paths', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'offline captions '))
  try {
    const source = join(dir, 'source.mp4'), saved = join(dir, 'result.json'), preload = join(dir, 'block.ts')
    await command(['runtime/bin/ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=s=32x32:r=25', '-t', '1', '-c:v', 'mpeg4', source])
    await Bun.write(preload, `globalThis.fetch = () => { throw new Error('NETWORK FORBIDDEN') }`)
    await Bun.write(saved, JSON.stringify({ text: 'Hello.', segments: [{ start: '00:00:00.125', end: '00:00:00.875', text: 'Hello.' }] }))
    const args = [process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', source, '--captions', '--transcript-result', saved, '--embed-captions', '--caption-container', 'both', '--caption-offset', '0.04', '--no-caption-speakers', '--json', '--output-dir', join(dir, 'out')]
    const output = JSON.parse(await command(args))
    expect(output.status).toBe('success')
    expect(output.data.files.mp4).toEndWith('captioned.mp4')
    expect(output.data.files.mkv).toEndWith('captioned.mkv')
    expect(await Bun.file(output.data.files.srt).text()).toContain('00:00:00,165 --> 00:00:00,915')
    expect(await Bun.file(saved).exists()).toBe(true)
    await expect(command(args)).rejects.toThrow()
    const invalid = args.filter(arg => arg !== '--captions')
    await expect(command(invalid)).rejects.toThrow('require --captions')
    const overlapSaved = join(dir, 'overlap.json')
    await Bun.write(overlapSaved, JSON.stringify({ text: 'Hello. Again.', segments: [
      { start: '00:00:00.125', end: '00:00:00.875', text: 'Hello.' },
      { start: '00:00:00.873', end: '00:00:00.975', text: 'Again.' }
    ] }))
    const overlapArgs = args.map(arg => arg === saved ? overlapSaved : arg === join(dir, 'out') ? join(dir, 'overlap-out') : arg)
    const overlapOutput = JSON.parse(await command([...overlapArgs, '--caption-mode', 'word']))
    const metadata = await Bun.file(overlapOutput.data.files.json).json()
    expect(metadata.displayTimingAdjustments).toHaveLength(1)
    expect(metadata.cues[0].end).toBe(metadata.cues[1].start)
    expect(await Bun.file(overlapSaved).json()).toMatchObject({ segments: [{ end: '00:00:00.875' }, { start: '00:00:00.873' }] })
    const failedDir = join(dir, 'failed')
    await Bun.write(join(failedDir, '.keep'), '')
    await expect(embedCaptionTracks(source, join(dir, 'missing.srt'), failedDir, 'both')).rejects.toThrow()
    expect(await Bun.file(join(failedDir, 'captioned.mp4')).exists()).toBe(false)
    expect(await Bun.file(saved).exists()).toBe(true)
  } finally { await rm(dir, { recursive: true, force: true }) }
}, 30_000)
