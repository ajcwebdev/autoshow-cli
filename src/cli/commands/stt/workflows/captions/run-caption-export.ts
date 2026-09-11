import { embedCaptionTracks, probeCaptionMedia } from './embed-caption-tracks'
import * as l from '~/utils/app-logger/app-logger'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { getOutputRootAbsolute } from '../../../command-shared/output-root'
import { resolveRunDirectory } from '../../../command-shared/run-dir'
import { parseStoredTranscriptionResult } from '../../stt-utils/stt-result-artifacts'
import { resolveCaptionWordCoverage } from './caption-word-coverage'
import { buildTranscriptionCues, TRANSCRIPT_CUE_LIMITS } from '../../../audio/music/lyrics-video/cue-builder'
import { formatEditorCaptions, resolveCaptionFormats } from './caption-editor-formats'
import { UsageError, ValidationError } from '~/utils/error-handler'

export const runCaptionExport = async (input: string | undefined, flags: Record<string, unknown>, destination?: string, videoSource?: string): Promise<string> => {
  const source = flags['transcript-result'] ?? input
  if (typeof source !== 'string' || !source.trim()) throw UsageError('--captions requires a saved result.json file or a directory containing result.json.')
  let path = resolve(source)
  if ((await stat(path)).isDirectory()) path = join(path, 'result.json')
  const { formats, mode, lineWidth, maxLines, maxCps, limits } = validateCaptionOptions(flags)
  const result = parseStoredTranscriptionResult(await Bun.file(path).json())
  if (!result) throw ValidationError('Invalid saved STT result; expected text, segments, and optional evidence.')
  const coverage = resolveCaptionWordCoverage(result)
  if (coverage.uncoveredText) throw ValidationError('Some transcript text has no usable timed segment or word. Repair the saved result before exporting captions.')
  const exportResult = { ...result, evidence: { ...result.evidence, words: coverage.words } }
  const { cues } = buildTranscriptionCues(exportResult, limits)
  if (!cues.length) throw ValidationError('The saved result contains no usable caption timing.')
  const wrap = (text: string): string => {
    const lines: string[] = []
    for (const word of text.split(/\s+/)) {
      const previous = lines.at(-1)
      if (previous && previous.length + word.length + 1 <= lineWidth) lines[lines.length - 1] += ' ' + word
      else lines.push(word)
    }
    return lines.join('\n')
  }
  const embeddingSource = videoSource ?? (typeof flags['caption-video-source'] === 'string' ? flags['caption-video-source'] : input) ?? ''
  const sourceTimelineOffsetSeconds = flags['caption-offset'] !== undefined ? Number(flags['caption-offset']) : destination && flags['embed-captions'] === true
    ? Number((await probeCaptionMedia(embeddingSource)).streams.find(stream => stream.codec_type === 'audio')?.start_time ?? 0)
    : 0
  if (!Number.isFinite(sourceTimelineOffsetSeconds)) throw ValidationError('Unable to determine source audio timeline offset.')
  const captionCues = cues.map(cue => ({ ...cue, start: cue.start + sourceTimelineOffsetSeconds, end: cue.end + sourceTimelineOffsetSeconds })).map(cue => ({ ...cue, text: flags['caption-speakers'] === false || !cue.speaker ? cue.text : `[${cue.speaker}] ${cue.text}` })).map(cue => ({ ...cue, text: wrap(cue.text) }))
  const displayTimingAdjustments: { cue: number; originalEnd: number; end: number; reason: string }[] = []
  if (flags['embed-captions'] === true) {
    for (let index = 0; index < captionCues.length - 1; index++) {
      const cue = captionCues[index]!, next = captionCues[index + 1]!
      if (cue.end <= next.start) continue
      if (cue.end - next.start > .15 || next.start <= cue.start) throw ValidationError('Overlapping caption cues require manual layout before embedding; transcript evidence is unchanged.')
      displayTimingAdjustments.push({ cue: cue.index, originalEnd: cue.end, end: next.start, reason: 'End the display cue at the next cue start to prevent container-specific overlap truncation; word evidence is unchanged.' })
      cue.end = next.start
    }
  }
  if (flags['price'] === true) {
    l.report.result({ dryRun: true, estimate: { steps: [], totalEstimatedCostCents: 0 } }, 'Caption export provider cost: 0 cents')
    return path
  }
  const output = destination ?? resolve(resolveRunDirectory(getOutputRootAbsolute(), 'captions', 'captions'))
  const serialized = formats.map(format => ({ format, content: formatEditorCaptions(format, captionCues) }))
  for (const name of ['captions.json', ...formats.map(format => `captions.${format}`)]) {
    if (await stat(join(output, name)).catch(() => undefined)) throw ValidationError(`Caption export already exists at ${join(output, name)}; choose a new output directory.`)
  }
  await mkdir(output, { recursive: true })
  // Exclusive creation protects existing exports and provider artifacts.
  for (const { format, content } of serialized) await writeFile(join(output, `captions.${format}`), content, { flag: 'wx' })
  await writeFile(join(output, 'captions.json'), JSON.stringify({
    source: path, sourceTimelineOffsetSeconds, formats, mode, limits, lineWidth, maxLines, maxCps, displayTimingAdjustments,
    formatNotes: [...(formats.includes('lrc') ? ['LRC stores cue starts only, rounded to centiseconds. Full ranges remain in this sidecar.'] : []), ...(formats.includes('ass') ? ['ASS display times are rounded to centiseconds, with a minimum one-centisecond display duration. Full ranges remain in this sidecar.'] : [])],
    timingQuality: result.evidence?.timingQuality === 'generated' ? 'generated' : coverage.inferredWords > 0 ? ((result.evidence?.words?.length ?? 0) > 0 ? 'mixed' : 'segment_interpolated') : result.evidence?.timingQuality ?? 'coarse',
    layoutWarnings: captionCues.flatMap(cue => [
      ...(cue.text.length / (cue.end - cue.start) > maxCps ? [{ cue: cue.index, reason: 'reading-speed' }] : []),
      ...(cue.text.split('\n').length > maxLines ? [{ cue: cue.index, reason: 'line-count' }] : [])
    ]),
    inferredWords: coverage.inferredWords, invalidWords: coverage.invalidWords,
    note: 'Millisecond serialization does not imply millisecond acoustic accuracy. Interpolated and generated timings are estimates.',
    cues: captionCues
  }, null, 2) + '\n', { flag: 'wx' })
  const embedded = flags['embed-captions'] === true
    ? await embedCaptionTracks(embeddingSource, join(output, 'captions.srt'), output, flags['caption-container'])
    : {}
  if (!destination) l.report.complete(output, {
    ...embedded,
    json: 'captions.json',
    ...Object.fromEntries(formats.map(format => [format, `captions.${format}`]))
  }, { metrics: { cueCount: captionCues.length, inferredWords: coverage.inferredWords, invalidWords: coverage.invalidWords } })
  return output
}

export const validateCaptionOptions = (flags: Record<string, unknown>) => {
  const format = flags['caption-format'] ?? 'both'
  const formats = resolveCaptionFormats(format)
  if (flags['embed-captions'] === true && (!formats.includes('srt') || !formats.includes('vtt'))) throw UsageError('--embed-captions retains SRT and VTT; use --caption-format both or all.')
  const mode = flags['caption-mode'] ?? 'phrase'
  if (flags['caption-offset'] !== undefined && !Number.isFinite(Number(flags['caption-offset']))) throw UsageError('--caption-offset must be a finite number of seconds.')
  if (!['word', 'phrase'].includes(String(mode))) throw UsageError('--caption-mode must be word or phrase.')
  const positive = (key: string, fallback: number): number => {
    const value = flags[key] === undefined ? fallback : Number(flags[key])
    if (!Number.isFinite(value) || value <= 0) throw UsageError(`--${key} must be a positive number.`)
    return value
  }
  const lineWidth = positive('caption-line-width', 42)
  const maxLines = positive('caption-max-lines', 2)
  const maxCps = positive('caption-max-cps', 20)
  if (![lineWidth, maxLines].every(Number.isInteger)) throw UsageError('Caption line width and line count must be integers.')
  const limits = {
    ...TRANSCRIPT_CUE_LIMITS,
    maxCharactersPerLine: lineWidth,
    maxLinesPerCue: maxLines,
    maxWordsPerCue: mode === 'word' ? 1 : positive('caption-max-words', TRANSCRIPT_CUE_LIMITS.maxWordsPerCue),
    maxCharactersPerCue: Math.min(lineWidth * maxLines, positive('caption-max-characters', TRANSCRIPT_CUE_LIMITS.maxCharactersPerCue)),
    maxCueDurationSeconds: positive('caption-max-duration', TRANSCRIPT_CUE_LIMITS.maxCueDurationSeconds),
    hardBreakGapSeconds: positive('caption-break-gap', TRANSCRIPT_CUE_LIMITS.hardBreakGapSeconds)
  }
  if (![limits.maxWordsPerCue, limits.maxCharactersPerCue].every(Number.isInteger)) throw UsageError('Caption word and character limits must be integers.')
  return { format, formats, mode, lineWidth, maxLines, maxCps, limits }
}

// Run after provider success has been persisted, outside provider retry loops.
export const exportSttCaptions = async (outputDir: string, flags: Record<string, unknown> | undefined, directories: string[] = ['.'], videoSource?: string): Promise<Record<string, string>> => {
  if (!flags) return {}
  const files: Record<string, string> = {}
  for (const directory of new Set(directories)) {
    const destination = join(outputDir, directory)
    const source = join(destination, 'result.json')
    try {
      await runCaptionExport(source, flags, destination, videoSource)
    } catch (error) {
      const captionMetadata = await Bun.file(join(destination, 'captions.json')).json().catch(() => undefined) as { sourceTimelineOffsetSeconds?: number } | undefined
      const retry = flags['embed-captions'] === true ? `extract "${videoSource ?? flags['caption-video-source']}" --transcript-result "${source}" --captions --embed-captions --caption-container ${flags['caption-container'] ?? 'mkv'} --caption-offset ${captionMetadata?.sourceTimelineOffsetSeconds ?? 0} --output-dir <new-directory>` : `extract "${source}" --captions`
      throw ValidationError(`Caption export failed; transcription is preserved at ${source}. Retry locally with ${retry} and the desired formatting options. ${error instanceof Error ? error.message : String(error)}`)
    }
    if (flags['embed-captions'] === true) {
      files[`embeddingMetadata-${directory}`] = join(directory, 'caption-embedding.json')
      for (const container of ['mp4', 'mkv']) {
        if (await Bun.file(join(destination, `captioned.${container}`)).exists()) files[`${container}-${directory}`] = join(directory, `captioned.${container}`)
      }
    }
    const suffix = directory === '.' ? '' : `-${directory}`
    files[`captionExportMetadata${suffix}`] = join(directory, 'captions.json')
    for (const format of resolveCaptionFormats(flags['caption-format'])) files[`${format}${suffix}`] = join(directory, `captions.${format}`)
  }
  return files
}
