import { mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { TtsDeliveryMasteringInput, TtsDeliveryMasteringResult, TtsDeliveryPause, TtsDeliveryPlacement, TtsDeliveryProfile, TtsDeliverySeamBoundary, TtsMasteringProfile } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { InfraError, UsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { inspectSoundscapeAudio } from '../soundscape/soundscape-audio'
import { createSilenceWav } from './audio-utils'

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
  const events = [...stderr.matchAll(/silence_(start|end):\s*(-?\d+(?:\.\d+)?)/gu)].map((match) => ({ kind: match[1] as 'start' | 'end', at: Number(match[2]) }))
  const intervals: Array<{ start: number, end: number }> = []
  let open: number | undefined
  for (const event of events) {
    if (event.kind === 'start') open = Math.max(0, event.at)
    else if (open !== undefined) {
      intervals.push({ start: open, end: event.at })
      open = undefined
    }
  }
  if (open !== undefined) intervals.push({ start: open, end: durationSeconds })
  const lead = intervals.find((interval) => interval.start <= EDGE_TOLERANCE_SECONDS)
  const tail = [...intervals].reverse().find((interval) => interval.end >= durationSeconds - EDGE_TOLERANCE_SECONDS)
  return {
    leadEndSeconds: lead ? Math.min(lead.end, durationSeconds) : 0,
    tailStartSeconds: tail && tail !== lead ? tail.start : durationSeconds,
  }
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
}): Promise<{ trimLeadMs: number, trimTailMs: number, sourceDurationMs: number, durationMs: number }> => {
  const source = await inspectSoundscapeAudio(input.sourcePath)
  const sourceSeconds = source.durationMs / 1000
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
  const lengthSeconds = endSeconds - startSeconds
  const fadeSeconds = Math.min(EDGE_FADE_SECONDS, lengthSeconds / 4)
  const filter = [
    `atrim=start=${startSeconds.toFixed(6)}:end=${endSeconds.toFixed(6)}`,
    'asetpts=PTS-STARTPTS',
    `afade=t=in:st=0:d=${fadeSeconds.toFixed(6)}`,
    `afade=t=out:st=${Math.max(0, lengthSeconds - fadeSeconds).toFixed(6)}:d=${fadeSeconds.toFixed(6)}`,
    formatFilter(input.sampleRate, input.channels),
  ].join(',')
  await runFfmpeg(['-i', input.sourcePath, '-vn', '-map', '0:a:0', '-af', filter, '-c:a', 'pcm_s16le', '-bitexact', '-y', input.outputPath], input.label, 'error', input.abortSignal)
  const rendered = await inspectSoundscapeAudio(input.outputPath)
  return {
    trimLeadMs: Math.round(startSeconds * 1000),
    trimTailMs: Math.round((sourceSeconds - endSeconds) * 1000),
    sourceDurationMs: source.durationMs,
    durationMs: rendered.durationMs,
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
  let cursorMs = 0
  const pushSilence = async (name: string, durationMs: number, pause: Omit<TtsDeliveryPause, 'startMs' | 'endMs'>): Promise<void> => {
    if (durationMs <= 0) return
    parts.push(await createSilenceWav(join(input.workDir, name), durationMs, silenceProfile, input.abortSignal))
    pauses.push({ ...pause, startMs: cursorMs, endMs: cursorMs + durationMs })
    cursorMs += durationMs
  }
  await pushSilence(`lead-in-${input.profile.leadInMs}ms.wav`, input.profile.leadInMs, { kind: 'lead-in' })
  for (const [index, segment] of input.segments.entries()) {
    const ordinal = String(index + 1).padStart(4, '0')
    const outputPath = join(input.workDir, `segment-${ordinal}.wav`)
    const rendered = await renderSegment({ sourcePath: segment.path, outputPath, sampleRate, channels, trimSilence: input.profile.trimSilence, label: `${input.providerLabel} segment ${index + 1}`, abortSignal: input.abortSignal })
    parts.push(outputPath)
    placements.push({ id: segment.id, startMs: cursorMs, endMs: cursorMs + rendered.durationMs, trimLeadMs: rendered.trimLeadMs, trimTailMs: rendered.trimTailMs, sourceDurationMs: rendered.sourceDurationMs })
    cursorMs += rendered.durationMs
    if (index < input.segments.length - 1) {
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
