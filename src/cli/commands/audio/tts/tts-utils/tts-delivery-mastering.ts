import { mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { TtsDeliveryMasteringInput, TtsDeliveryMasteringResult, TtsDeliveryPause, TtsDeliveryPlacement, TtsDeliveryProfile, TtsDeliverySeamBoundary, TtsMasteringProfile } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError, UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { inspectSoundscapeAudio } from '../soundscape/soundscape-audio'
import { createSilenceWav } from './audio-utils'
import { prepareDeliveryWav, deliveryPcmFrames } from './tts-delivery-pcm'

const SILENCE_THRESHOLD_DB = -50
const SILENCE_MIN_SECONDS = 0.05
const TRIM_GUARD_SECONDS = 0.03
const EDGE_FADE_SECONDS = 0.005
const EDGE_TOLERANCE_SECONDS = 0.02
const MIN_SPEECH_SECONDS = 0.05
const DETERMINISTIC_ARGS = ['-hide_banner', '-nostats', '-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1']

const runFfmpeg = async (args: string[], label: string, logLevel: 'error' | 'info', abortSignal?: AbortSignal | undefined): Promise<string> => {
  abortSignal?.throwIfAborted()
  const result = await exec(getFfmpegBinary(), [...DETERMINISTIC_ARGS, '-loglevel', logLevel, ...args], { signal: abortSignal })
  if (result.exitCode !== 0) throw InfraError(`Failed to master ${label}: ${result.stderr.trim()}`, { stage: 'tts:delivery-mastering' })
  return result.stderr
}

export const ttsSeamGapMs = (profile: TtsDeliveryProfile, boundary: TtsDeliverySeamBoundary): number => {
  switch (boundary) {
    case 'paragraph': return profile.gapsMs.paragraph
    case 'turn': return profile.gapsMs.turn
    case 'sentence': return profile.gapsMs.sentence
    case 'clause':
    case 'word': return profile.gapsMs.clause
    default: return 0
  }
}

export const parseSilenceDetectEdges = (stderr: string, durationSeconds: number): { leadEndSeconds: number, tailStartSeconds: number } => {
  const intact = { leadEndSeconds: 0, tailStartSeconds: durationSeconds }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return intact
  const events = [...stderr.matchAll(/silence_(start|end):[ \t]*(\S*)/gu)]
  const intervals: Array<{ start: number, end: number }> = []
  let open: number | undefined
  let previous = 0
  for (const event of events) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(event[2] ?? '')) return intact
    const at = Number(event[2])
    // Reject the whole detection if any interval is ambiguous, unordered or out of range.
    if (!Number.isFinite(at) || at < 0 || at > durationSeconds + 0.0001 || at < previous) return intact
    previous = at
    if (event[1] === 'start') {
      if (open !== undefined) return intact
      open = at
    } else {
      if (open === undefined || at <= open) return intact
      intervals.push({ start: open, end: Math.min(at, durationSeconds) })
      open = undefined
    }
  }
  if (open !== undefined) intervals.push({ start: open, end: durationSeconds })
  const lead = intervals[0]?.start !== undefined && intervals[0].start <= EDGE_TOLERANCE_SECONDS ? intervals[0] : undefined
  const last = intervals.at(-1)
  const tail = last && last.end >= durationSeconds - EDGE_TOLERANCE_SECONDS ? last : undefined
  if (lead && lead === tail) return intact
  const leadEndSeconds = lead?.end ?? 0
  const tailStartSeconds = tail?.start ?? durationSeconds
  if (tailStartSeconds - leadEndSeconds < MIN_SPEECH_SECONDS) return intact
  return { leadEndSeconds, tailStartSeconds }
}

const formatFilter = (sampleRate: number, channels: 1 | 2): string =>
  `aresample=${sampleRate}:osf=s16:dither_method=none,aformat=sample_fmts=s16:channel_layouts=${channels === 1 ? 'mono' : 'stereo'}`

const renderSegment = async (input: {
  sourcePath: string
  outputPath: string
  sampleRate: number
  channels: 1 | 2
  trimSilence: boolean
  label: string
  abortSignal?: AbortSignal | undefined
}): Promise<{ trimLeadMs: number, trimTailMs: number, sourceDurationMs: number, frames: number }> => {
  const sourceFrames = await deliveryPcmFrames(input.sourcePath)
  const sourceSeconds = sourceFrames / input.sampleRate
  let startSeconds = 0
  let endSeconds = sourceSeconds
  if (input.trimSilence) {
    const detected = await runFfmpeg(['-i', input.sourcePath, '-af', `silencedetect=noise=${SILENCE_THRESHOLD_DB}dB:d=${SILENCE_MIN_SECONDS}`, '-f', 'null', '-'], `${input.label} silence detection`, 'info', input.abortSignal)
    const edges = parseSilenceDetectEdges(detected, sourceSeconds)
    const trimmedStart = Math.max(0, edges.leadEndSeconds - TRIM_GUARD_SECONDS)
    const trimmedEnd = Math.min(sourceSeconds, edges.tailStartSeconds + TRIM_GUARD_SECONDS)
    if (trimmedEnd - trimmedStart >= MIN_SPEECH_SECONDS) {
      startSeconds = trimmedStart
      endSeconds = trimmedEnd
    }
  }
  const startFrame = Math.round(startSeconds * input.sampleRate)
  const endFrame = Math.round(endSeconds * input.sampleRate)
  const lengthSeconds = (endFrame - startFrame) / input.sampleRate
  const fadeSeconds = Math.min(EDGE_FADE_SECONDS, lengthSeconds / 4)
  const filter = [
    `atrim=start_sample=${startFrame}:end_sample=${endFrame}`,
    'asetpts=PTS-STARTPTS',
    `afade=t=in:st=0:d=${fadeSeconds.toFixed(6)}`,
    `afade=t=out:st=${Math.max(0, lengthSeconds - fadeSeconds).toFixed(6)}:d=${fadeSeconds.toFixed(6)}`,
    formatFilter(input.sampleRate, input.channels),
  ].join(',')
  await runFfmpeg(['-i', input.sourcePath, '-vn', '-map', '0:a:0', '-af', filter, '-c:a', 'pcm_s16le', '-bitexact', '-y', input.outputPath], input.label, 'error', input.abortSignal)
  const frames = await deliveryPcmFrames(input.outputPath)
  return {
    trimLeadMs: Math.round(startFrame / input.sampleRate * 1000),
    trimTailMs: Math.round((sourceFrames - endFrame) / input.sampleRate * 1000),
    sourceDurationMs: Math.round(sourceSeconds * 1000),
    frames,
  }
}

const concatCopy = async (paths: readonly string[], outputPath: string, listPath: string, abortSignal?: AbortSignal | undefined): Promise<void> => {
  await Bun.write(listPath, `${paths.map((path) => `file '${relative(dirname(resolve(listPath)), resolve(path)).replace(/'/g, `'\\''`)}'`).join('\n')}\n`)
  await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c:a', 'copy', '-bitexact', '-y', outputPath], 'delivery assembly', 'error', abortSignal)
}

type LoudnormMeasurement = { input_i: string, input_tp: string, input_lra: string, input_thresh: string, target_offset: string, normalization_type?: string | undefined }

const readLoudnormJson = (stderr: string): LoudnormMeasurement => {
  const start = stderr.lastIndexOf('{')
  const end = stderr.lastIndexOf('}')
  if (start < 0 || end <= start) throw InfraError('Loudness measurement did not report loudnorm statistics.', { stage: 'tts:delivery-mastering' })
  return JSON.parse(stderr.slice(start, end + 1)) as LoudnormMeasurement
}

const normalizeLoudness = async (input: {
  sourcePath: string
  outputPath: string
  sampleRate: number
  channels: 1 | 2
  integratedLufs: number
  truePeakDb: number
  abortSignal?: AbortSignal | undefined
}): Promise<NonNullable<TtsDeliveryMasteringResult['loudness']>> => {
  const target = `loudnorm=I=${input.integratedLufs}:TP=${input.truePeakDb}:LRA=11`
  const measured = readLoudnormJson(await runFfmpeg(['-i', input.sourcePath, '-af', `${target}:print_format=json`, '-f', 'null', '-'], 'loudness measurement', 'info', input.abortSignal))
  if (![measured.input_i, measured.input_tp, measured.input_lra, measured.input_thresh, measured.target_offset].every((value) => Number.isFinite(Number(value)))) {
    throw UsageError('TTS loudness normalization could not measure the assembled audio; it may be silent. Pass --tts-loudness off to skip normalization.')
  }
  const limit = Math.min(1, 10 ** (input.truePeakDb / 20)).toFixed(6)
  const filter = [
    `${target}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`,
    `alimiter=limit=${limit}:level=disabled`,
    formatFilter(input.sampleRate, input.channels),
  ].join(',')
  const applied = readLoudnormJson(await runFfmpeg(['-i', input.sourcePath, '-af', filter, '-c:a', 'pcm_s16le', '-bitexact', '-y', input.outputPath], 'loudness normalization', 'info', input.abortSignal))
  const normalizationType = applied.normalization_type === 'linear' ? 'linear' as const : 'dynamic' as const
  if (normalizationType === 'dynamic') l.warn('TTS loudness normalization fell back to dynamic mode because a linear gain could not meet the loudness and true-peak targets together.', { category: 'pipeline' })
  return {
    targetIntegratedLufs: input.integratedLufs,
    targetTruePeakDb: input.truePeakDb,
    measuredIntegratedLufs: Number(measured.input_i),
    measuredTruePeakDb: Number(measured.input_tp),
    normalizationType,
  }
}

export const masterTtsDelivery = async (input: TtsDeliveryMasteringInput): Promise<TtsDeliveryMasteringResult> => {
  if (input.segments.length === 0) throw UsageError('TTS delivery mastering requires at least one provider audio segment.')
  await mkdir(input.workDir, { recursive: true })
  const first = await inspectSoundscapeAudio(input.segments[0]?.path as string)
  const sampleRate = input.profile.sampleRate ?? first.format.sampleRate
  const channels: 1 | 2 = input.profile.channels ?? (first.format.channels >= 2 ? 2 : 1)
  const silenceProfile: TtsMasteringProfile = { schemaVersion: 1, sampleRate, channels, codec: 'pcm_s16le', container: 'wav' }
  const parts: string[] = []
  const placements: TtsDeliveryPlacement[] = []
  const pauses: TtsDeliveryPause[] = []
  let cursorFrames = 0
  const milliseconds = (frames: number): number => Math.round(frames / sampleRate * 1000)
  const pushSilence = async (name: string, durationMs: number, pause: Omit<TtsDeliveryPause, 'startMs' | 'endMs'>): Promise<void> => {
    if (durationMs <= 0) return
    const path = await createSilenceWav(join(input.workDir, name), durationMs, silenceProfile, input.abortSignal)
    const frames = await deliveryPcmFrames(path)
    parts.push(path)
    pauses.push({ ...pause, startMs: milliseconds(cursorFrames), endMs: milliseconds(cursorFrames + frames) })
    cursorFrames += frames
  }
  await pushSilence(`lead-in-${input.profile.leadInMs}ms.wav`, input.profile.leadInMs, { kind: 'lead-in' })
  // Adjacent outputs with the same purchased-slot identity form one continuous signal.
  const slots: Array<{ id: string, paths: string[], boundaryAfter: TtsDeliverySeamBoundary }> = []
  for (const segment of input.segments) {
    const previous = slots.at(-1)
    if (previous?.id === segment.id) {
      previous.paths.push(segment.path)
      previous.boundaryAfter = segment.boundaryAfter
    } else slots.push({ id: segment.id, paths: [segment.path], boundaryAfter: segment.boundaryAfter })
  }
  for (const [index, segment] of slots.entries()) {
    const ordinal = String(index + 1).padStart(4, '0')
    const outputPath = join(input.workDir, `segment-${ordinal}.wav`)
    const normalized: string[] = []
    for (const [partIndex, path] of segment.paths.entries()) {
      const sourcePath = await prepareDeliveryWav(path, join(input.workDir, `slot-${ordinal}-part-${partIndex}-finite.wav`))
      const normalizedPath = join(input.workDir, `slot-${ordinal}-part-${partIndex}.wav`)
      await runFfmpeg(['-xerror', '-err_detect', 'explode', '-i', sourcePath, '-vn', '-map', '0:a:0', '-af', formatFilter(sampleRate, channels), '-c:a', 'pcm_s16le', '-bitexact', '-y', normalizedPath], input.providerLabel, 'error', input.abortSignal)
      await deliveryPcmFrames(normalizedPath)
      normalized.push(normalizedPath)
    }
    const sourcePath = normalized.length === 1 ? normalized[0] as string : join(input.workDir, `slot-${ordinal}.wav`)
    if (normalized.length > 1) await concatCopy(normalized, sourcePath, join(input.workDir, `slot-${ordinal}.txt`), input.abortSignal)
    const rendered = await renderSegment({ sourcePath, outputPath, sampleRate, channels, trimSilence: input.profile.trimSilence, label: `${input.providerLabel} segment ${index + 1}`, abortSignal: input.abortSignal })
    parts.push(outputPath)
    placements.push({ id: segment.id, startMs: milliseconds(cursorFrames), endMs: milliseconds(cursorFrames + rendered.frames), trimLeadMs: rendered.trimLeadMs, trimTailMs: rendered.trimTailMs, sourceDurationMs: rendered.sourceDurationMs })
    cursorFrames += rendered.frames
    if (index < slots.length - 1) {
      const gapMs = ttsSeamGapMs(input.profile, segment.boundaryAfter)
      await pushSilence(`gap-${ordinal}-${gapMs}ms.wav`, gapMs, { kind: 'seam-gap', afterId: segment.id, boundary: segment.boundaryAfter })
    }
  }
  await pushSilence(`lead-out-${input.profile.leadOutMs}ms.wav`, input.profile.leadOutMs, { kind: 'lead-out' })
  const assembledPath = join(input.workDir, 'assembled.wav')
  await concatCopy(parts, assembledPath, join(input.workDir, 'assembly.txt'), input.abortSignal)
  if (input.profile.loudness.mode === 'none') return { path: assembledPath, sampleRate, channels, placements, pauses }
  const masteredPath = join(input.workDir, 'mastered.wav')
  const loudness = await normalizeLoudness({ sourcePath: assembledPath, outputPath: masteredPath, sampleRate, channels, integratedLufs: input.profile.loudness.integratedLufs, truePeakDb: input.profile.loudness.truePeakDb, abortSignal: input.abortSignal })
  return { path: masteredPath, sampleRate, channels, placements, pauses, loudness }
}
