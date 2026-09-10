import { mkdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { TranscriptionResult } from '~/types'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { ValidationError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { captionTextKey, captionTimestampSeconds } from './step-2-stt/stt-utils/caption-word-coverage'
import { toTimestamp } from './step-2-stt/stt-utils/stt-utils'
import { mergeTranscriptionEvidence } from './step-2-stt/stt-utils/stt-evidence'
import { readLocalTimingResult, requireLocalTimingFile, runTimingCommand, writeLocalTimingFiles } from './stt-local-workspace'

export const splitSttChannels = async (input: string, output: string) => {
  const source = await requireLocalTimingFile(input)
  const probe = JSON.parse(await runTimingCommand(getFfprobeBinary(), ['-v', 'error', '-show_streams', '-of', 'json', source])) as { streams: Array<{ index: number; codec_type: string; channels?: number; sample_rate?: string; start_time?: string }> }
  const channels = probe.streams.filter(stream => stream.codec_type === 'audio').flatMap(stream => {
    if (!Number.isInteger(stream.channels) || !stream.channels || stream.channels < 1 || stream.channels > 16 || !Number.isInteger(Number(stream.sample_rate)) || Number(stream.sample_rate) <= 0) throw ValidationError('Channel extraction supports 1–16 channels per audio stream with a known sample rate.')
    return Array.from({ length: stream.channels }, (_, channel) => ({ id: `stream-${stream.index}-channel-${channel + 1}`, streamIndex: stream.index, channelIndex: channel, sampleRate: Number(stream.sample_rate), offsetSeconds: Number(stream.start_time ?? 0) }))
  })
  if (channels.length < 2 || channels.some(channel => !Number.isFinite(channel.offsetSeconds))) throw ValidationError('Channel separation requires at least two audio channels across the local media streams and valid source offsets.')
  for (const name of ['channels.json', 'channel-results.json', ...channels.map(channel => `${channel.id}.wav`)]) if (await stat(join(output, name)).catch(() => undefined)) throw ValidationError(`Channel output already exists at ${join(output, name)}. Choose a new --output-dir.`)
  await mkdir(output, { recursive: true })
  const completed = []
  for (const channel of channels) {
    const path = join(output, `${channel.id}.wav`)
    const filter = `pan=mono|c0=c${channel.channelIndex}`
    await runTimingCommand(getFfmpegBinary(), ['-v', 'error', '-nostdin', '-n', '-i', source, '-map', `0:${channel.streamIndex}`, '-af', filter, '-c:a', 'pcm_f32le', path])
    const expected = await runTimingCommand(getFfmpegBinary(), ['-v', 'error', '-nostdin', '-i', source, '-map', `0:${channel.streamIndex}`, '-af', filter, '-c:a', 'pcm_f32le', '-f', 'hash', '-hash', 'sha256', '-'])
    const actual = await runTimingCommand(getFfmpegBinary(), ['-v', 'error', '-nostdin', '-i', path, '-c:a', 'pcm_f32le', '-f', 'hash', '-hash', 'sha256', '-'])
    if (expected.trim() !== actual.trim()) throw ValidationError(`Channel ${channel.id} changed during extraction; retained outputs are at ${output}.`)
    completed.push({ ...channel, audio: path, decodedSha256: actual.trim() })
  }
  const files = await writeLocalTimingFiles(output, {
    'channels.json': { schemaVersion: 1, source, identity: 'Audio channel identity, not inferred person identity.', channels: completed },
    'channel-results.json': { schemaVersion: 1, source, channels: completed.map(channel => ({ id: channel.id, audio: channel.audio, offsetSeconds: channel.offsetSeconds, result: null })) }
  })
  return { ...files, ...Object.fromEntries(completed.map(channel => [channel.id, `${channel.id}.wav`])) }
}

export const mergeSttChannelResults = async (manifestPath: string): Promise<{ result: TranscriptionResult; provenance: unknown }> => {
  const source = await requireLocalTimingFile(manifestPath)
  const packet: unknown = await Bun.file(source).json()
  if (!isRecord(packet) || packet['schemaVersion'] !== 1 || !Array.isArray(packet['channels']) || !packet['channels'].length) throw ValidationError('Channel results require schemaVersion 1 and a nonempty channels array.')
  const seen = new Set<string>()
  const results = [], provenance = []
  for (const entry of packet['channels'] as unknown[]) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || !entry['id'].trim() || seen.has(entry['id']) || typeof entry['result'] !== 'string' || !entry['result'].trim() || typeof entry['offsetSeconds'] !== 'number' || !Number.isFinite(entry['offsetSeconds'])) throw ValidationError('Every channel needs a unique id, a local result path, and finite offsetSeconds. Fill in channel-results.json after transcription.')
    seen.add(entry['id'])
    const saved = await readLocalTimingResult(resolve(dirname(source), entry['result']))
    if (saved.result.evidence?.source === 'channel-merge') throw ValidationError('Cannot merge an already merged channel result; use the original per-channel results to avoid applying offsets twice.')
    if (captionTextKey(saved.result.segments.map(segment => segment.text).join(' ')) !== captionTextKey(saved.result.text)) throw ValidationError(`Channel ${entry['id']} segments do not cover its complete transcript text.`)
    const offset = entry['offsetSeconds'], id = entry['id']
    const speaker = (original?: string) => original ? `${id}/${original}` : id
    const segments = saved.result.segments.map(segment => ({ ...segment, start: toTimestamp(captionTimestampSeconds(segment.start) + offset), end: toTimestamp(captionTimestampSeconds(segment.end) + offset), speaker: speaker(segment.speaker) }))
    const shift = <T extends { startSeconds: number; endSeconds: number; speaker?: string | undefined }>(word: T): T => {
      if (!Number.isFinite(word.startSeconds) || !Number.isFinite(word.endSeconds) || word.endSeconds <= word.startSeconds || word.startSeconds + offset < 0) throw ValidationError(`Channel ${id} contains invalid or negative timing after its offset.`)
      return { ...word, startSeconds: word.startSeconds + offset, endSeconds: word.endSeconds + offset, speaker: speaker(word.speaker) }
    }
    if (saved.result.segments.some(segment => !Number.isFinite(captionTimestampSeconds(segment.start)) || !Number.isFinite(captionTimestampSeconds(segment.end)) || captionTimestampSeconds(segment.end) <= captionTimestampSeconds(segment.start) || captionTimestampSeconds(segment.start) + offset < 0)) throw ValidationError(`Channel ${id} contains invalid segment timing.`)
    results.push({ text: saved.result.text, segments, evidence: { ...saved.result.evidence,
      ...(saved.result.evidence?.words ? { words: saved.result.evidence.words.map(shift) } : {}),
      segments: saved.result.segments.map(segment => shift({ startSeconds: captionTimestampSeconds(segment.start), endSeconds: captionTimestampSeconds(segment.end), text: segment.text, speaker: segment.speaker })),
      source: id, sourceOffsetSeconds: offset,
      capabilities: { ...saved.result.evidence?.capabilities, hasSpeakerLabels: true }
    } })
    provenance.push({ id, result: saved.source, sha256: saved.sha256, appliedOffsetSeconds: offset })
  }
  const segments = results.flatMap(result => result.segments).sort((a, b) => captionTimestampSeconds(a.start) - captionTimestampSeconds(b.start))
  const evidence = mergeTranscriptionEvidence(results.map(result => result.evidence))!
  evidence.words?.sort((a, b) => a.startSeconds - b.startSeconds)
  evidence.segments?.sort((a, b) => a.startSeconds - b.startSeconds)
  return { result: { text: segments.map(segment => segment.text).join(' '), segments, evidence: { ...evidence, source: 'channel-merge' } }, provenance: { schemaVersion: 1, source, channels: provenance, identity: 'Channel-scoped labels; reconcile people only using a reviewed speaker map.' } }
}
