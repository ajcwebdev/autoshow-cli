import { mkdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TranscriptionEvidenceWord } from '~/types'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { captionTextKey, captionTimestampSeconds } from '../captions/caption-word-coverage'
import { alignCtcWords, type CtcWordInput } from './ctc-word-alignment'
import { hashLocalTimingFile, readLocalTimingResult, requireLocalTimingFile, runTimingCommand, writeLocalTimingFiles } from './stt-local-workspace'

export const tokenizeAlignmentWords = (text: string): string[] => {
  const words: string[] = []
  let prefix = ''
  for (const token of text.match(/\S+/gu) ?? []) {
    if (/[\p{L}\p{N}]/u.test(token)) {
      words.push(prefix + token)
      prefix = ''
    } else if (words.length) words[words.length - 1] += ' ' + token
    else prefix += token + ' '
  }
  if (!words.length) throw ValidationError('Forced alignment needs spoken words in every transcript segment; punctuation alone cannot be aligned.')
  return words
}

export const runLocalForcedAlignment = async (audioInput: string, transcriptInput: string, flags: Record<string, unknown>, output: string) => {
  const audio = await requireLocalTimingFile(audioInput)
  const audioSha256 = await hashLocalTimingFile(audio)
  const saved = await readLocalTimingResult(transcriptInput)
  const model = flags['alignment-model'], python = flags['alignment-python'] ?? 'python3'
  if (typeof model !== 'string' || !(await stat(model).catch(() => undefined))?.isDirectory()) throw UsageError('--align-transcript requires --alignment-model pointing to a local Wav2Vec2 CTC model directory. See the STT guide for offline setup.')
  if (typeof python !== 'string' || !python.trim()) throw UsageError('--alignment-python must name a Python executable with the alignment dependencies installed.')
  const minimumConfidence = Number(flags['alignment-min-confidence'] ?? .1)
  if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) throw UsageError('--alignment-min-confidence must be between 0 and 1.')
  const segments = saved.result.segments.map(segment => ({ ...segment, begin: captionTimestampSeconds(segment.start), finish: captionTimestampSeconds(segment.end) }))
  if (!segments.length || segments.some(segment => !Number.isFinite(segment.begin) || !Number.isFinite(segment.finish) || segment.begin < 0 || segment.finish <= segment.begin || segment.finish - segment.begin > 30)) throw ValidationError('Forced alignment requires nonempty transcript segments with valid audio-relative ranges of at most 30 seconds.')
  if (captionTextKey(segments.map(segment => segment.text).join(' ')) !== captionTextKey(saved.result.text)) throw ValidationError('Transcript segments must cover the complete text before forced alignment.')
  const ordered = segments.toSorted((a, b) => a.begin - b.begin)
  if (ordered.some((segment, index) => index > 0 && segment.begin < ordered[index - 1]!.finish)) throw ValidationError('Forced alignment cannot resolve overlapping speech on one channel. Separate channels or provide non-overlapping reviewed spans.')
  const work = join(output, 'alignment-work')
  for (const path of [work, join(output, 'result.json'), join(output, 'alignment.json')]) if (await stat(path).catch(() => undefined)) throw ValidationError(`Alignment output already exists at ${path}; choose a new --output-dir.`)
  await mkdir(work, { recursive: true })
  const clips = []
  for (const [index, segment] of segments.entries()) {
    const clip = join(work, `${index}.wav`)
    await runTimingCommand(getFfmpegBinary(), ['-v', 'error', '-nostdin', '-n', '-i', audio, '-ss', String(segment.begin), '-t', String(segment.finish - segment.begin), '-map', '0:a:0', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', clip])
    clips.push({ audio: clip, words: tokenizeAlignmentWords(segment.text) })
  }
  const manifest = join(work, 'clips.json'), emissions = join(work, 'emissions.json')
  await writeLocalTimingFiles(work, { 'clips.json': clips })
  const script = fileURLToPath(new URL('../../../../../../scripts/stt-ctc-emissions.py', import.meta.url))
  await runTimingCommand(python, [script, resolve(model), manifest, emissions])
  const response = await Bun.file(emissions).json() as { schemaVersion: number; backend: string; torchVersion: string; modelHashes: Record<string, string>; clips: Array<{ frames: number[][]; words: CtcWordInput[]; blank: number; separator?: number; frameSeconds: number }> }
  if (response.schemaVersion !== 1 || response.clips.length !== segments.length) throw ValidationError('Local alignment backend returned an invalid clip count or schema.')
  const words: TranscriptionEvidenceWord[] = []
  const review = []
  for (const [index, clip] of response.clips.entries()) {
    const segment = segments[index]!
    if (clip.words.map(word => word.text).join(' ') !== clips[index]!.words.join(' ')) throw ValidationError('Alignment backend changed transcript text.')
    const aligned = alignCtcWords(clip.frames, clip.words, clip.blank, clip.frameSeconds, typeof clip.separator === 'number' ? clip.separator : undefined)
    for (const word of aligned) {
      if (word.confidence < minimumConfidence) review.push({ segment: index, text: word.text, confidence: word.confidence })
      words.push({ ...word, startSeconds: word.startSeconds + segment.begin, endSeconds: Math.min(word.endSeconds + segment.begin, segment.finish), normalized: word.text.toLowerCase(), timingSource: 'aligned', ...(segment.speaker ? { speaker: segment.speaker } : {}) })
    }
  }
  const provenance = { schemaVersion: 1, source: saved.source, sourceSha256: saved.sha256, audio, audioSha256, preparation: { sampleRate: 16000, channels: 1, sampleFormat: 'PCM16', segmentTimes: 'audio-relative seconds' }, model: resolve(model), modelHashes: response.modelHashes, backend: response.backend, torchVersion: response.torchVersion, minimumConfidence, review,
    lowConfidenceWords: words.flatMap((word, index) => (word.confidence ?? 0) < .1 ? [{ index, text: word.text, confidence: word.confidence }] : []),
    policy: 'CTC alignment of supplied text within non-overlapping source spans; text is not automatically verified. Unsupported letters/numbers are rejected; punctuation remains display text. Speaker labels are inherited, not inferred. Words below the requested confidence threshold prevent publication of an aligned result. Original evidence and working audio are retained.' }
  if (review.length) {
    await writeLocalTimingFiles(output, { 'alignment.json': provenance })
    throw ValidationError(`${review.length} aligned words fell below --alignment-min-confidence. Review ${join(output, 'alignment.json')}; original transcript and working files are preserved.`)
  }
  const result = { ...saved.result, referenceProvenance: { kind: 'automatic-alignment', manuallyVerified: false, source: saved.source, sourceSha256: saved.sha256, audio, audioSha256, backend: response.backend, modelHashes: response.modelHashes, minimumConfidence, lowConfidenceWordCount: provenance.lowConfidenceWords.length }, evidence: { ...saved.result.evidence, words, timingQuality: 'aligned', source: 'local-ctc-alignment', capabilities: { hasNativeWordTiming: false, hasConfidence: true, hasSpeakerLabels: words.some(word => word.speaker !== undefined) }, chunkEvidence: saved.result.evidence ? [saved.result.evidence] : [] } }
  return await writeLocalTimingFiles(output, { 'result.json': result, 'alignment.json': provenance })
}
