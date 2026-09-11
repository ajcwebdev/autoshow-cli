import { parseCaptionCues } from '../../../audio/music/lyrics-video/captions'
import { lstat, link, unlink, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { verifyCopiedCaptionStream } from './verify-caption-media'

type CaptionContainer = 'mp4' | 'mkv'
type CaptionStream = { index: number; start_time?: string; codec_type: string; codec_name: string; codec_tag_string?: string; nb_frames?: string; tags?: Record<string, string>; disposition?: Record<string, number> }
type CaptionProbe = { streams: CaptionStream[]; chapters?: { start_time: string; end_time: string; tags?: Record<string, string> }[] }

const capture = async (args: string[]): Promise<string> => {
  const child = Bun.spawn(args, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (code !== 0) throw ValidationError(`Caption media command failed (${code}): ${stderr.trim()}`)
  return stdout
}

export const probeCaptionMedia = async (source: string): Promise<CaptionProbe> => JSON.parse(await capture([getFfprobeBinary(), '-v', 'error', '-show_streams', '-show_chapters', '-of', 'json', resolve(source)])) as CaptionProbe

export const captionContainers = (source: string, requested: unknown): CaptionContainer[] => {
  if (requested === 'both') return ['mp4', 'mkv']
  if (requested !== undefined && requested !== 'mp4' && requested !== 'mkv') throw UsageError('--caption-container must be mp4, mkv, or both.')
  return [requested ?? (extname(source).toLowerCase() === '.mp4' ? 'mp4' : 'mkv')]
}

// Conservative stream-copy support. Reject unknown codecs explicitly instead of letting
// FFmpeg's automatic mapping discard streams or implicitly transcode them.
const chapterTrack = (stream: CaptionStream, probe: CaptionProbe): boolean => stream.codec_type === 'data' && stream.codec_name === 'bin_data' && stream.codec_tag_string === 'text' && Number(stream.nb_frames) === (probe.chapters?.length ?? 0) && (probe.chapters?.length ?? 0) > 0
const copiedStreams = (probe: CaptionProbe): CaptionStream[] => probe.streams.filter(stream => !chapterTrack(stream, probe))

const supported: Record<CaptionContainer, Record<string, string[]>> = {
  mp4: { video: ['h264', 'hevc', 'mpeg4', 'av1', 'vp9', 'mpeg2video', 'mjpeg'], audio: ['aac', 'mp3', 'ac3', 'eac3', 'alac', 'flac', 'opus'], subtitle: ['mov_text'] },
  mkv: { video: ['h264', 'hevc', 'mpeg4', 'av1', 'vp9', 'vp8', 'mpeg2video', 'mpeg1video', 'mjpeg', 'ffv1', 'theora', 'prores'], audio: ['aac', 'mp3', 'ac3', 'eac3', 'alac', 'flac', 'opus', 'vorbis', 'dts', 'truehd', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le', 'pcm_f32le'], subtitle: ['subrip', 'ass', 'ssa', 'webvtt', 'hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle'] }
}

export const preflightCaptionEmbedding = async (source: string | undefined, requested: unknown): Promise<CaptionProbe> => {
  if (!source || !(await lstat(source).catch(() => undefined))?.isFile()) throw UsageError('--embed-captions requires a local video file as input; use --transcript-result for saved transcripts.')
  const containers = captionContainers(source, requested)
  const probe = await probeCaptionMedia(source)
  if (!probe.streams.some(stream => stream.codec_type === 'video')) throw UsageError('--embed-captions requires a video stream.')
  for (const container of containers) {
    const incompatible = copiedStreams(probe).filter(stream => !(container === 'mkv' && stream.codec_type === 'attachment') && !supported[container][stream.codec_type]?.includes(stream.codec_name))
    if (incompatible.length) throw ValidationError(`Cannot copy to ${container}: incompatible or unsupported streams ${incompatible.map(stream => `#${stream.index} ${stream.codec_type}/${stream.codec_name}`).join(', ')}. Choose a compatible --caption-container or prepare a separate compatible source; no streams were dropped.`)
  }
  return probe
}

export const embedCaptionTracks = async (source: string, subtitle: string, outputDir: string, requested: unknown): Promise<Record<string, string>> => {
  const original = await preflightCaptionEmbedding(source, requested)
  const containers = captionContainers(source, requested)
  const streams = copiedStreams(original)
  if (await lstat(join(outputDir, 'caption-embedding.json')).catch(() => undefined)) throw ValidationError('Refusing to overwrite caption-embedding.json. Choose a new output directory.')
  for (const container of containers) {
    const destination = join(outputDir, `captioned.${container}`)
    if (await lstat(destination).catch(() => undefined)) throw ValidationError(`Refusing to overwrite ${destination}. Choose a new output directory.`)
  }
  const expectedCues = parseCaptionCues(await Bun.file(subtitle).text(), 'srt')
  if (!expectedCues.length) throw ValidationError('No usable subtitle cues to embed.')
  const files: Record<string, string> = {}
  const verification: Record<string, unknown> = {}
  for (const container of containers) {
    const name = `captioned.${container}`
    const temporary = join(outputDir, `.caption-${crypto.randomUUID()}.${container}`)
    const subtitleIndex = original.streams.filter(stream => stream.codec_type === 'subtitle').length
    const codec = container === 'mp4' ? 'mov_text' : 'subrip'
    try {
      await capture([getFfmpegBinary(), '-v', 'error', '-nostdin', '-n', '-copyts', '-i', resolve(source), '-i', resolve(subtitle),
        ...streams.flatMap(stream => ['-map', `0:${stream.index}`]), '-map', '1:0', '-map_metadata', '0', '-map_chapters', '0', '-c', 'copy',
        `-c:s:${subtitleIndex}`, codec, `-metadata:s:s:${subtitleIndex}`, 'language=eng', `-metadata:s:s:${subtitleIndex}`, 'title=English',
        `-metadata:s:s:${subtitleIndex}`, 'handler_name=English', `-disposition:s:${subtitleIndex}`, '0', '-avoid_negative_ts', 'disabled', ...(container === 'mp4' ? ['-movflags', 'use_metadata_tags'] : []), temporary])
      const result = await probeCaptionMedia(temporary)
      const added = result.streams.filter(stream => stream.codec_type === 'subtitle').at(-1)
      if (copiedStreams(result).length !== streams.length + 1 || streams.some((stream, index) => copiedStreams(result)[index]?.codec_name !== stream.codec_name || copiedStreams(result)[index]?.codec_type !== stream.codec_type)
        || added?.codec_name !== codec || added.tags?.['language'] !== 'eng' || added.disposition?.['forced'] !== 0
        || (result.chapters?.length ?? 0) !== (original.chapters?.length ?? 0) || original.chapters?.some((chapter, index) => Math.abs(Number(chapter.start_time) - Number(result.chapters?.[index]?.start_time)) > .001 || chapter.tags?.['title'] !== result.chapters?.[index]?.tags?.['title'])) throw ValidationError(`Embedded ${container} failed stream/chapter validation.`)
      const extractedCues = parseCaptionCues(await capture([getFfmpegBinary(), '-v', 'error', '-nostdin', '-copyts', '-i', temporary, '-map', `0:s:${subtitleIndex}`, '-f', 'srt', '-']), 'srt')
      if (extractedCues.length !== expectedCues.length || expectedCues.some((cue, index) => {
        const actual = extractedCues[index]
        return !actual || cue.text !== actual.text || Math.abs(cue.start - actual.start) > .001 || Math.abs(cue.end - actual.end) > .001
      })) throw ValidationError(`Embedded ${container} subtitle text/timing validation failed.`)
      const streamChecks = []
      for (const [index, stream] of streams.entries()) {
        if (stream.codec_type === 'audio' || stream.codec_type === 'video') streamChecks.push(await verifyCopiedCaptionStream(resolve(source), temporary, stream.index, copiedStreams(result)[index]!.index))
      }
      verification[container] = { subtitleCuesMatch: true, cueCount: expectedCues.length, chaptersPreserved: original.chapters?.length ?? 0, streams: streamChecks, playbackChecked: false }
      // Hard linking publishes atomically and refuses a destination created after preflight.
      await link(temporary, join(outputDir, name))
      files[container] = name
    } finally {
      await unlink(temporary).catch(() => undefined)
    }
  }
  await writeFile(join(outputDir, 'caption-embedding.json'), JSON.stringify({ source: resolve(source), files, verification, streamMapping: streams.map(stream => stream.index), chapterDataStreams: original.streams.filter(stream => chapterTrack(stream, original)).map(stream => stream.index), note: 'MP4 chapter data tracks are represented by mapped chapters in each output container. Audio/video and compatible subtitle streams are copied without re-encoding. Packet and cue checks do not establish acoustic transcription accuracy.' }, null, 2) + '\n', { flag: 'wx' })
  return { ...files, embeddingMetadata: 'caption-embedding.json' }
}
