import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { TranscriptionEvidenceWord, TranscriptionResult } from '~/types'
import { AppValidationError, ValidationError, UsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import { runWhisperTranscribe } from './step-2-stt/stt-local/whisper/run-whisper'
import { runWhisperfileTranscribe } from './step-2-stt/stt-local/whisperfile/run-whisperfile'
import { extractWhisperWords } from './step-2-stt/stt-local/whisper/parse-whisper-output'
import { evaluateWordTiming, validateMeasuredWords } from './step-2-stt/stt-utils/stt-word-metrics'
import { toTimestamp } from './step-2-stt/stt-utils/stt-utils'
import { hashLocalTimingFile, readLocalTimingResult, requireLocalTimingFile, writeLocalTimingFiles } from './stt-local-workspace'

export const dtwWordEvidence = (raw: unknown): TranscriptionEvidenceWord[] => {
  const data = raw as { transcription?: Array<{ offsets: { to: number }; tokens?: Array<{ text: string; t_dtw: number; p?: number }> }> }
  const tokens = (data.transcription ?? []).flatMap(segment => (segment.tokens ?? []).filter(token => token.text?.trim() && !/^\[.*\]$/.test(token.text.trim()) && Number.isFinite(token.t_dtw) && token.t_dtw >= 0).map(token => ({ ...token, center: token.t_dtw / 100, segmentEnd: segment.offsets.to / 1000 })))
  if (!tokens.length) throw ValidationError('Whisper returned no usable DTW token centers. Its installed bundle/model combination cannot be calibrated.')
  if (tokens.some((token, index) => index > 0 && token.center < tokens[index - 1]!.center)) throw ValidationError('Whisper returned non-monotonic DTW token centers; retain the raw result for review.')
  const transcription = tokens.map((token, index) => {
    const previous = tokens[index - 1], next = tokens[index + 1]
    const start = previous ? (previous.center + token.center) / 2 : Math.max(0, token.center - .01)
    const end = next ? (token.center + next.center) / 2 : Math.max(token.center + .01, token.segmentEnd)
    return { text: token.text, timestamps: { from: toTimestamp(start), to: toTimestamp(Math.max(start + .001, end)) }, offsets: { from: start * 1000, to: end * 1000 }, tokens: [{ p: token.p }] }
  })
  return extractWhisperWords(JSON.stringify({ transcription })).map(word => ({ text: word.word, normalized: word.word.toLowerCase(), startSeconds: word.start, endSeconds: word.end, ...(word.confidence !== undefined ? { confidence: word.confidence } : {}), timingSource: 'repaired' }))
}

export const calibrateWhisperTiming = async (audioInput: string, referencePath: string, flags: Record<string, unknown>, output: string) => {
  const audio = await requireLocalTimingFile(audioInput)
  const audioSha256 = await hashLocalTimingFile(audio)
  const reference = await readLocalTimingResult(referencePath)
  const referenceProvenance = isRecord(reference.data) && isRecord(reference.data['referenceProvenance']) ? reference.data['referenceProvenance'] : { kind: 'unverified' }
  if (typeof referenceProvenance['audioSha256'] === 'string' && referenceProvenance['audioSha256'] !== audioSha256) throw ValidationError('Calibration audio does not match the reference audio fingerprint. Use the matching source recording.')
  validateMeasuredWords(reference.result.evidence?.words ?? [], 'Calibration reference')
  const engine = flags['whisper-engine'] ?? 'whisper', model = flags['whisper-calibration-model'] ?? 'tiny'
  if (engine !== 'whisper' && engine !== 'whisperfile') throw UsageError('--whisper-engine must be whisper or whisperfile.')
  const presets: Record<string, string> = { tiny: 'tiny', 'tiny.en': 'tiny.en', base: 'base', 'base.en': 'base.en', small: 'small', 'small.en': 'small.en', medium: 'medium', 'medium.en': 'medium.en', 'large-v2': 'large.v2', 'large-v3': 'large.v3', 'large-v3-turbo': 'large.v3.turbo' }
  if (typeof model !== 'string' || !presets[model]) throw UsageError('--whisper-calibration-model must name a supported installed Whisper model.')
  for (const name of ['standard', 'dtw', 'calibration.json']) if (await stat(join(output, name)).catch(() => undefined)) throw ValidationError(`Calibration output already exists at ${join(output, name)}; choose a new --output-dir.`)
  const run = engine === 'whisper' ? runWhisperTranscribe : runWhisperfileTranscribe
  const variants = []
  const unsupportedVariants: Array<{ mode: string; reason: string }> = []
  const rejectedVariants: Array<{ mode: string; reason: string; result: string }> = []
  for (const mode of ['standard', 'dtw']) {
    if (mode === 'dtw') {
      const provenance = await Bun.file(join(output, 'standard', 'transcription.engine.json')).json() as { help: string }
      if (!/(?:^|\s)(?:-dtw|--dtw)(?:\s|$)/m.test(provenance.help)) {
        unsupportedVariants.push({ mode, reason: 'The installed executable does not advertise DTW support.' })
        continue
      }
    }
    const dir = join(output, mode)
    await mkdir(dir, { recursive: true })
    const started = performance.now()
    const completed = await run(audio, dir, { model, segmentOffsetMinutes: 0, preserveJson: true, nativeSubtitles: true, ...(mode === 'dtw' ? { dtwPreset: presets[model] } : {}) })
    const elapsedMs = performance.now() - started
    let words: TranscriptionEvidenceWord[]
    try { words = mode === 'dtw' ? dtwWordEvidence(completed.result.evidence?.rawResponse) : completed.result.evidence?.words ?? [] }
    catch (error) {
      if (!(error instanceof AppValidationError)) throw error
      await writeLocalTimingFiles(dir, { 'result.json': completed.result })
      rejectedVariants.push({ mode, reason: error.message, result: join(dir, 'result.json') })
      continue
    }
    const result: TranscriptionResult = { ...completed.result, evidence: { ...completed.result.evidence, words, timingQuality: mode === 'dtw' ? 'mixed' : completed.result.evidence?.timingQuality } }
    await writeLocalTimingFiles(dir, { 'result.json': result })
    try {
      const measurement = evaluateWordTiming(reference.result.evidence!.words!, words)
      variants.push({ mode, elapsedMs, result: join(dir, 'result.json'), ...measurement })
    } catch (error) {
      if (!(error instanceof AppValidationError)) throw error
      rejectedVariants.push({ mode, reason: error.message, result: join(dir, 'result.json') })
    }
  }
  const ranked = variants.toSorted((a, b) => b.referenceCoverage - a.referenceCoverage || ((a.startAbsoluteError.medianMs ?? Infinity) + (a.endAbsoluteError.medianMs ?? Infinity)) - ((b.startAbsoluteError.medianMs ?? Infinity) + (b.endAbsoluteError.medianMs ?? Infinity)))
  const files = await writeLocalTimingFiles(output, { 'calibration.json': { schemaVersion: 1, engine, model, audio, audioSha256, reference: reference.source, referenceSha256: reference.sha256,
    referenceProvenance,
    status: ranked.length ? rejectedVariants.length ? 'partial' : 'complete' : 'failed',
    recommendedForThisReference: ranked[0] && ranked[0].matchedWords > 0 ? ranked[0].mode : null, defaultsChanged: false,
    note: 'DTW provides token centers. Midpoint-derived word ranges are marked repaired. Ranking excludes rejected variants, first maximizes lexical coverage, then minimizes median boundary error; results apply only to this reference.', unsupportedVariants, rejectedVariants, variants } })
  if (!ranked.length) throw ValidationError(`No timing variant could be measured. Inspect ${join(output, 'calibration.json')}; raw results are preserved.`)
  return files
}
