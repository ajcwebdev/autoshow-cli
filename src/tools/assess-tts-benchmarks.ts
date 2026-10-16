import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { collectTtsDashboardSamples } from '../../.codex/skills/consensus/scripts/tts/build_tts_dashboard'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'
import { transcribeWhisperfile } from '~/cli/commands/stt/local/whisperfile/transcribe'
import { toProjectRelativePath } from '~/utils/project-root'

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T
const saveJson = (path: string, value: unknown) => writePortableFileSync(path, JSON.stringify(value, null, 2) + '\n')
const MODEL = 'runtime/bin/whisperfile/whisper-small.en.llamafile'
const VERSION = 'local-small-en-v1'

interface Ref { path: string; sha256: string }
interface Projection { selectedSuccess: { renderIdentity: string; resultIdentity: string }; archive: { finalRef: Ref; timelineRef: Ref } }
interface Manifest { items: Array<{ input: string; providers: Array<{ service: string; model: string; result?: { ttsAudio?: Projection }; metadata: { ttsAudio?: Projection } }> }> }
interface Turn { turnId: string; startMs: number; endMs: number }
interface Controls { spokenLines: string[]; lines: string[]; mechanism: string }
export interface AssessmentSource {
  id: string; suite: string; run: string; providerKey: string; manifest: string; manifestSha256: string;
  audio: string; audioSha256: string; input: string; inputSha256: string; reference: string;
  renderIdentity: string; resultIdentity: string; durationSeconds: number; turns: Turn[]; controls: Controls | null;
  bindings: Array<{ path: string; sha256: string }>; cacheKey: string;
}
interface Transcript { text: string; evidence?: { words?: Array<{ text: string; startSeconds: number; endSeconds: number }> } }
interface CachedTranscript { schemaVersion: number; cacheKey: string; engineSha256: string; elapsedMs: number; transcriptSha256: string }

export function collectAssessmentSources(root: string, engineSha256: string): AssessmentSource[] {
  const sources = collectTtsDashboardSamples(root).filter(row => row.status === 'succeeded').map(row => {
    if (!row.audioHref || row.durationSeconds === null) throw Error('Selected recording is unavailable')
    const manifest = join(dirname(root), row.manifestHref)
    const m = readJson<Manifest>(manifest), item = m.items[0]!
    const provider = item.providers.find(p => p.service + '/' + p.model === row.providerKey)!
    const p = provider.result?.ttsAudio ?? provider.metadata.ttsAudio
    if (!p?.archive || !p.selectedSuccess) throw Error('Assessment requires selected compact audio provenance')
    const runRoot = dirname(manifest), audio = join(dirname(root), row.audioHref)
    const input = item.input, controlsPath = join(runRoot, 'controls.json')
    const controls = existsSync(controlsPath) ? readJson<Controls>(controlsPath) : null
    const inputBytes = readFileSync(input)
    const timelinePath = join(runRoot, p.archive.timelineRef.path), timelineBytes = readFileSync(timelinePath)
    if (hash(timelineBytes) !== p.archive.timelineRef.sha256) throw Error('Assessment timeline hash mismatch')
    const timeline = JSON.parse(timelineBytes.toString()) as { timing: { turns?: Turn[] } }
    const bindings = [manifest, input, timelinePath, ...(controls ? [controlsPath] : [])].map(path => ({ path: toProjectRelativePath(path), sha256: hash(readFileSync(path)) }))
    const reference = controls ? controls.spokenLines.join('\n') : inputBytes.toString().trim()
    const id = `${row.suite}--${basename(row.run)}--${row.providerKey.replace(/[^a-zA-Z0-9.-]+/g, '-')}`
    const inputSha256 = hash(inputBytes), audioSha256 = hash(readFileSync(audio))
    const cacheKey = hash(JSON.stringify({ version: VERSION, audioSha256, inputSha256, reference, engineSha256, renderIdentity: p.selectedSuccess.renderIdentity }))
    return { id, suite: row.suite, run: row.run, providerKey: row.providerKey, manifest: toProjectRelativePath(manifest), manifestSha256: hash(readFileSync(manifest)),
      audio: toProjectRelativePath(audio), audioSha256, input, inputSha256, reference,
      renderIdentity: p.selectedSuccess.renderIdentity, resultIdentity: p.selectedSuccess.resultIdentity, durationSeconds: row.durationSeconds,
      turns: timeline.timing.turns ?? [], controls, bindings, cacheKey }
  })
  if (new Set(sources.map(source => source.id)).size !== sources.length) throw Error('Duplicate assessment case identifier')
  return sources
}

// Keep digits and diacritics literal: lexical differences such as 29 / twenty-nine
// remain visible for adjudication rather than silently guessing intended pronunciation.
export function normalizeAssessmentText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

export interface WordComparison { referenceWords: number; hypothesisWords: number; substitutions: number; deletions: number; insertions: number; wer: number; differences: Array<{ kind: string; reference: string; hypothesis: string }> }
export function compareWords(reference: string, hypothesis: string): WordComparison {
  const a = normalizeAssessmentText(reference).split(' ').filter(Boolean), b = normalizeAssessmentText(hypothesis).split(' ').filter(Boolean)
  if (!a.length) throw Error('Empty assessment reference')
  const width = b.length + 1, trace = new Uint8Array((a.length + 1) * width)
  let previous = Int32Array.from({ length: width }, (_, i) => i), current = new Int32Array(width)
  for (let j = 1; j < width; j++) trace[j] = 3
  for (let i = 1; i <= a.length; i++) {
    current[0] = i; trace[i * width] = 2
    for (let j = 1; j < width; j++) {
      const diagonal = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1), deletion = previous[j]! + 1, insertion = current[j - 1]! + 1
      current[j] = Math.min(diagonal, deletion, insertion)
      trace[i * width + j] = current[j] === diagonal ? 1 : current[j] === deletion ? 2 : 3
    }
    ;[previous, current] = [current, previous]
  }
  let i = a.length, j = b.length, substitutions = 0, deletions = 0, insertions = 0
  const differences: WordComparison['differences'] = []
  while (i || j) {
    const step = trace[i * width + j]
    if (step === 1) {
      if (a[i - 1] !== b[j - 1]) { substitutions++; differences.push({ kind: 'substitution', reference: a[i - 1]!, hypothesis: b[j - 1]! }) }
      i--; j--
    } else if (step === 2) { deletions++; differences.push({ kind: 'deletion', reference: a[--i]!, hypothesis: '' }) }
    else { insertions++; differences.push({ kind: 'insertion', reference: '', hypothesis: b[--j]! }) }
  }
  return { referenceWords: a.length, hypothesisWords: b.length, substitutions, deletions, insertions, wer: (substitutions + deletions + insertions) / a.length, differences: differences.reverse() }
}

// Supplemental only for this speed/pauses counting fixture. The strict result
// and original transcript remain authoritative and unchanged.
export function compareCountingWords(reference: string, hypothesis: string): WordComparison {
  const names: Record<string, string> = { '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five' }
  const fold = (text: string) => normalizeAssessmentText(text).split(' ').map(token => names[token] ?? token).join(' ')
  return compareWords(fold(reference), fold(hypothesis))
}

// Exact Levenshtein distance with common prefix/suffix trimming and a bounded
// diagonal expanded until its result is provably exact. Long mostly-equal books
// avoid a quadratic character matrix; a rolling row bounds memory in all cases.
export function characterErrorRate(reference: string, hypothesis: string): number {
  let a = Array.from(normalizeAssessmentText(reference)), b = Array.from(normalizeAssessmentText(hypothesis))
  const denominator = a.length
  if (!denominator) throw Error('Empty assessment reference')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  a = a.slice(start); b = b.slice(start)
  while (a.length && b.length && a.at(-1) === b.at(-1)) { a.pop(); b.pop() }
  if (!a.length || !b.length) return (a.length + b.length) / denominator
  let band = Math.max(32, Math.abs(a.length - b.length))
  const unreachable = a.length + b.length + 1
  for (;;) {
    let previous = new Int32Array(b.length + 1).fill(unreachable), current = new Int32Array(b.length + 1).fill(unreachable)
    for (let j = 0; j <= Math.min(band, b.length); j++) previous[j] = j
    for (let i = 1; i <= a.length; i++) {
      current.fill(unreachable); if (i <= band) current[0] = i
      for (let j = Math.max(1, i - band); j <= Math.min(b.length, i + band); j++) current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + Number(a[i - 1] !== b[j - 1]))
      ;[previous, current] = [current, previous]
    }
    if (previous[b.length]! <= band) return previous[b.length]! / denominator
    band *= 2
  }
}

async function command(args: string[]): Promise<string> {
  const process = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, status] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (status !== 0) throw Error(`${args[0]} failed (${status}): ${stderr.slice(-2000)}`)
  return stderr + stdout
}

export async function verifyAssessmentAudio(path: string): Promise<void> {
  await command(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', path, '-f', 'null', '-'])
}

export async function transcribeAssessmentSource(source: AssessmentSource, cacheRoot: string, engineSha256: string): Promise<void> {
  const cache = join(cacheRoot, source.cacheKey), bindingPath = join(cache, 'binding.json'), transcriptPath = join(cache, 'transcript.txt')
  if (existsSync(bindingPath)) {
    const cached = readJson<CachedTranscript>(bindingPath)
    if (cached.cacheKey !== source.cacheKey || cached.engineSha256 !== engineSha256 || hash(readFileSync(transcriptPath)) !== cached.transcriptSha256) throw Error('Invalid local transcript cache')
    console.log(JSON.stringify({ case: source.id, status: 'reused', seconds: source.durationSeconds })); return
  }
  mkdirSync(cache, { recursive: true })
  // Read/decode the entire waveform; ffprobe success alone is insufficient.
  await verifyAssessmentAudio(source.audio)
  const started = Date.now()
  const { result } = await transcribeWhisperfile(source.audio, cache, { model: 'small.en', preserveJson: true, segmentOffsetMinutes: 0, audioDurationSeconds: source.durationSeconds })
  saveJson(join(cache, 'asr.json'), result)
  writePortableFileSync(transcriptPath, result.text + '\n')
  const elapsedMs = Date.now() - started
  saveJson(bindingPath, { schemaVersion: 1, cacheKey: source.cacheKey, engineSha256, elapsedMs, transcriptSha256: hash(readFileSync(transcriptPath)) })
  console.log(JSON.stringify({ case: source.id, status: 'transcribed', audioSeconds: source.durationSeconds, elapsedSeconds: elapsedMs / 1000, realtimeFactor: source.durationSeconds * 1000 / elapsedMs }))
}

export async function runAssessmentQueue(sources: AssessmentSource[], cacheRoot: string, engineSha256: string, concurrency: number): Promise<void> {
  const queue = [...sources].sort((a, b) => b.durationSeconds - a.durationSeconds)
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (;;) { const source = queue.shift(); if (!source) return; await transcribeAssessmentSource(source, cacheRoot, engineSha256) }
  }))
}

export interface Silence { start: number; end: number }
export function parseSilences(log: string, duration: number): Silence[] {
  const result: Silence[] = []; let start: number | null = null
  for (const line of log.split('\n')) {
    const begins = /silence_start:\s*([\d.-]+)/.exec(line), ends = /silence_end:\s*([\d.-]+)/.exec(line)
    if (begins) start = Math.max(0, Number(begins[1]))
    if (ends && start !== null) { result.push({ start, end: Math.min(duration, Number(ends[1])) }); start = null }
  }
  if (start !== null) result.push({ start, end: duration })
  if (result.some(s => !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end < s.start)) throw Error('Invalid detected silence interval')
  return result
}

export function turnSilenceMetrics(turn: Turn, silences: Silence[], reference: string) {
  const start = turn.startMs / 1000, end = turn.endMs / 1000
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw Error('Invalid assessment turn interval')
  const clipped = silences.filter(s => s.end > start && s.start < end).map(s => ({ start: Math.max(start, s.start), end: Math.min(end, s.end) }))
  const entireTurnBelowThreshold = clipped.some(s => s.start === start && s.end === end)
  const leading = clipped[0]?.start === start ? clipped[0].end - start : 0
  // A single silent interval covering the whole turn is removed once, rather
  // than counted as two disjoint edge trims or turned into a negative window.
  const trailing = !entireTurnBelowThreshold && clipped.at(-1)?.end === end ? end - clipped.at(-1)!.start : 0
  const window = Math.max(0, end - start - leading - trailing)
  const internal = clipped.filter(s => s.start > start + 0.03 && s.end < end - 0.03)
  return { turnId: turn.turnId, startSeconds: start, endSeconds: end, words: normalizeAssessmentText(reference).split(' ').filter(Boolean).length,
    entireTurnBelowThreshold, trimmedWindowSeconds: window, referenceWordsPerMinute: window > 0 ? normalizeAssessmentText(reference).split(' ').filter(Boolean).length * 60 / window : null,
    leadingSeconds: leading, trailingSeconds: trailing, internalSilences: internal, longestInternalSilenceSeconds: Math.max(0, ...internal.map(s => s.end - s.start)) }
}

export async function publishAssessment(root: string, sources: AssessmentSource[], cacheRoot: string, engineSha256: string): Promise<void> {
  const stage = join(cacheRoot, '..', 'evidence', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(join(stage, 'transcripts'), { recursive: true }); mkdirSync(join(stage, 'inputs'), { recursive: true })
  const evidenceFiles: string[] = []
  const addEvidence = (path: string, bytes: Uint8Array | string) => {
    if (path === 'assessment.json' && typeof bytes === 'string') writePortableFileSync(join(stage, path), bytes)
    else writeFileSync(join(stage, path), bytes)
    evidenceFiles.push(path)
  }
  const rows = []
  for (const source of sources) {
    const cache = join(cacheRoot, source.cacheKey), transcriptBytes = readFileSync(join(cache, 'transcript.txt'))
    const binding = readJson<CachedTranscript>(join(cache, 'binding.json'))
    if (binding.cacheKey !== source.cacheKey || binding.engineSha256 !== engineSha256 || hash(transcriptBytes) !== binding.transcriptSha256) throw Error('Stale assessment transcript')
    const asr = readJson<Transcript>(join(cache, 'asr.json'))
    if (asr.text.trim() !== transcriptBytes.toString().trim()) throw Error('ASR timing text does not match retained transcript')
    const comparison = compareWords(source.reference, asr.text), cer = characterErrorRate(source.reference, asr.text)
    const countingNumberFoldComparison = source.suite === 'speed-pauses' ? compareCountingWords(source.reference, asr.text) : null
    const transcript = `transcripts/${source.id}.txt`, rawTranscript = `transcripts/${source.id}.whisper.json`, inputSnapshot = `inputs/${source.id}.txt`
    addEvidence(transcript, transcriptBytes); addEvidence(rawTranscript, readFileSync(join(cache, 'transcription.json'))); addEvidence(inputSnapshot, readFileSync(source.input))
    let silences: Silence[] = []
    if (source.suite !== 'narration') silences = parseSilences(await command(['ffmpeg', '-nostdin', '-hide_banner', '-i', source.audio, '-af', 'silencedetect=noise=-40dB:d=0.08', '-f', 'null', '-']), source.durationSeconds)
    const perTurn = source.controls && source.turns.length === source.controls.spokenLines.length
      ? source.turns.map((turn, i) => turnSilenceMetrics(turn, silences, source.controls!.spokenLines[i]!)) : []
    const speedOrder = source.suite === 'speed-pauses' && perTurn.length === 5
      ? { normalReferenceWpm: perTurn[0]!.referenceWordsPerMinute, slowReferenceWpm: perTurn[1]!.referenceWordsPerMinute, fastReferenceWpm: perTurn[2]!.referenceWordsPerMinute,
        directionConsistent: perTurn[0]!.referenceWordsPerMinute !== null && perTurn[1]!.referenceWordsPerMinute !== null && perTurn[2]!.referenceWordsPerMinute !== null && perTurn[1]!.referenceWordsPerMinute! < perTurn[0]!.referenceWordsPerMinute! && perTurn[0]!.referenceWordsPerMinute! < perTurn[2]!.referenceWordsPerMinute! } : null
    const exactPause = source.suite === 'speed-pauses' && (source.controls?.lines.some(line => /<break\s+time=/.test(line)) ?? false)
    const pauseMeasurement = (source.suite === 'speed-pauses' ? perTurn.slice(3) : []).map((turn, i) => {
      const native = source.controls!.lines[i + 3]!, match = /<break\s+time="([\d.]+)(ms|s)"/.exec(native)
      const requestedSeconds = match ? Number(match[1]) / (match[2] === 'ms' ? 1000 : 1) : null
      return { turnId: turn.turnId, mechanism: requestedSeconds === null ? 'qualitative cue' : 'exact SSML request', requestedSeconds, longestInternalSilenceSeconds: turn.longestInternalSilenceSeconds,
        deltaSeconds: requestedSeconds === null ? null : turn.longestInternalSilenceSeconds - requestedSeconds,
        status: 'Signal-only longest internal gap; semantic location and audibility require listening.' }
    })
    rows.push({ ...source, comparison, countingNumberFoldComparison, cer, transcript, rawTranscript, inputSnapshot, transcriptSha256: hash(transcriptBytes), engineElapsedMs: binding.elapsedMs,
      fullDecode: 'succeeded', asrDisposition: comparison.wer === 0 ? 'No normalized ASR differences' : 'ASR differences require adjudication',
      speechCorrectness: 'ASR screening only; no acoustic adjudication', humanSpeechScore: null,
      unscoredDimensions: ['Pronunciation listening ratings', 'Speaker identity listening ratings', 'Seams and prosody ratings', ...(source.suite === 'narration' ? [] : ['Audible native-control ratings', 'Emotional/delivery ratings']), 'Perceptual quality ratings'],
      subjectiveDisposition: 'Excluded and unscored at the user’s explicit instruction; not a blocker to the accepted offline assessment scope',
      controlEffectiveness: source.suite === 'narration' ? 'Not a controls case' : 'Signal measurements only; subjective ratings excluded and unscored',
      mechanism: source.controls?.mechanism ?? 'narration', silences, perTurn,
      perLineMeasurementLimitation: source.controls && !perTurn.length ? 'Five source lines share one assembled turn; per-line rate and exact pause attribution unavailable without acoustic alignment.' : null,
      speedOrder, exactPause, pauseMeasurement })
    console.log(JSON.stringify({ assessed: source.id, wer: comparison.wer, cer }))
  }
  const sourcesBinding = [...new Map(sources.flatMap(s => [...s.bindings, { path: s.audio, sha256: s.audioSha256 }]).map(ref => [ref.path, ref])).values()].map(ref => {
    const within = relative(resolve(root), resolve(ref.path)).split('\\').join('/')
    return !within.startsWith('..') ? { ...ref, path: within, scope: 'benchmark' } : { ...ref, scope: 'project' }
  })
  const pilotPath = 'output/2026-09-18_tts-delivery-pilot'
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), version: VERSION, engine: { provider: 'whisperfile', model: 'small.en', path: MODEL, sha256: engineSha256, referencePrompt: false },
    normalization: 'Unicode NFKC, lower-case, curly apostrophes folded, punctuation/hyphens/apostrophes become spaces, Unicode letters/digits/diacritics retained, whitespace collapsed. Strict WER keeps digits literal; no number expansion or pronunciation guessing. Controls use saved spokenLines excluding native tags and narrator labels; narration uses the exact input text. WER uses token Levenshtein S+D+I / reference words; CER uses normalized Unicode code-point Levenshtein including spaces. Speed/pause cases additionally show a separately labeled counting-number-fold WER: only normalized tokens exactly 1, 2, 3, 4, 5 become one, two, three, four, five in both strings; no other numbers or words change. Strict scores and exact transcripts are preserved, and omissions remain counted.',
    limitations: ['One English-only local ASR engine; recognition errors and number expansion can create differences unrelated to TTS errors. No reference prompt supplied.', 'The user explicitly excluded subjective ratings. Human listening, pronunciation ratings, speaker-identity ratings, emotion, seam/prosody ratings and perceptual quality remain excluded and unscored for every recording; no human listening is claimed.', 'Reference-word throughput divides expected words by the amplitude-trimmed waveform window, not independently verified spoken words; omissions can inflate it. The self-describing lines differ, and there is no repeated identical-text baseline. Ordering is descriptive screening, not proof of numeric speed calibration.', 'Silence means below -40 dB for at least 80 ms; fricatives/breaths/noise and threshold sensitivity affect boundaries. Longest internal gaps are not automatically the requested semantic pause.', 'Historical provider cost/usage and request identities are preserved; historical OpenAI character estimates are not retrospectively corrected.'],
    exclusions: ['OpenAI controls absent from the inherited plans; no synthesis purchased.', 'Eleven v3 pacing skipped because exact native tags were unverified; no fallback tags or synthesis added.', existsSync(pilotPath)
      ? `Earlier Eleven v3 pilot ${pilotPath} exists but has no verified selected identity in this benchmark corpus; it is excluded until its source/control compatibility is established. Selected Eleven narration/emotion remain included.`
      : `Earlier Eleven v3 pilot ${pilotPath} is absent in the bounded local check; maintained docs/benchmarks/tts has no separate compatible pilot. Selected Eleven narration/emotion remain included; missing pilot evidence is excluded rather than repurchased.`],
    sources: sourcesBinding, rows }
  addEvidence('assessment.json', JSON.stringify(report, null, 2) + '\n')
  const checksums = evidenceFiles.map(path => `${hash(readFileSync(join(stage, path)))}  ${path}`).join('\n') + '\n'
  writePortableFileSync(join(stage, 'SHA256SUMS'), checksums)
  const archiveTemp = resolve(stage, '..', basename(stage) + '.zip')
  const zip = Bun.spawnSync(['zip', '-q', '-r', archiveTemp, ...evidenceFiles, 'SHA256SUMS'], { cwd: stage })
  if (zip.exitCode !== 0) throw Error('Could not archive TTS assessment evidence')
  const integrity = Bun.spawnSync(['unzip', '-tq', archiveTemp])
  if (integrity.exitCode !== 0) throw Error('Invalid TTS assessment evidence archive')
  renameSync(archiveTemp, join(root, 'assessment.evidence.zip'))
  const fmt = (n: number) => (100 * n).toFixed(2) + '%'
  const table = (headings: string[], values: string[][]) => {
    const widths = headings.map((h, i) => Math.max(h.length, ...values.map(row => row[i]!.length)))
    return [headings, widths.map(n => '-'.repeat(n)), ...values].map(row => '| ' + row.map((cell, i) => cell.padEnd(widths[i]!)).join(' | ') + ' |').join('\n')
  }
  let markdown = `# Retained TTS recordings: offline assessment\n\nUpdated ${report.generatedAt}. Assessed ${rows.length} selected recordings (${(sources.reduce((n, s) => n + s.durationSeconds, 0) / 3600).toFixed(3)} audio hours) with installed Whisper small.en and local ffmpeg. No provider calls, model downloads, or new synthesis.\n\n[Checksummed original transcripts, source snapshots, complete differences, measurements, and provenance](assessment.evidence.zip) contains assessment.json, transcripts/*.txt, exact raw transcripts/*.whisper.json, inputs/*.txt and SHA256SUMS. Per-case transcript paths below refer to entries in this archive.\n\n## Method and limits\n\n${report.normalization}\n\n${report.limitations.map(line => '- ' + line).join('\n')}\n\n${report.exclusions.map(line => '- ' + line).join('\n')}\n\nAll accepted recordings receive an automated assessment below. Subjective listening ratings are excluded and unscored by the user's instruction for every recording; no controls or perceptual quality pass is asserted.\n\n## Selected recordings\n\n`
  markdown += table(['Case', 'Provider/model', 'Suite', 'WER', 'CER', 'S/D/I', 'Disposition'], rows.map(row => [`[${row.run}](#${row.id.toLowerCase()})`, row.providerKey, row.suite, fmt(row.comparison.wer), fmt(row.cer), `${row.comparison.substitutions}/${row.comparison.deletions}/${row.comparison.insertions}`, row.asrDisposition])) + '\n\n'
  for (const row of rows) {
    const relativeAudio = row.audio.replace(/^docs\/benchmarks\/tts\//, ''), relativeManifest = row.manifest.replace(/^docs\/benchmarks\/tts\//, '')
    markdown += `<a id="${row.id.toLowerCase()}"></a>\n### ${row.run} — ${row.providerKey}\n\n[Selected WAV](${relativeAudio}); [manifest](${relativeManifest}); source: ${row.input}. Audio SHA-256: \`${row.audioSha256}\`. Input SHA-256: \`${row.inputSha256}\`. Render: \`${row.renderIdentity}\`; result: \`${row.resultIdentity}\`. Transcript: \`${row.transcript}\` (SHA-256 \`${row.transcriptSha256}\`).\n\nFull waveform decoding succeeded. ASR WER ${fmt(row.comparison.wer)}, CER ${fmt(row.cer)}, substitutions/deletions/insertions ${row.comparison.substitutions}/${row.comparison.deletions}/${row.comparison.insertions} over ${row.comparison.referenceWords} reference words. ${row.asrDisposition}. These differences are ASR evidence, not confirmed synthesis errors.\n\n`
    if (row.comparison.differences.length) markdown += `First differences: ${row.comparison.differences.slice(0, 12).map(d => `${d.kind} ${JSON.stringify(d.reference)} → ${JSON.stringify(d.hypothesis)}`).join('; ')}. Complete ordered differences are in assessment.json.\n\n`
    if (row.suite !== 'narration') {
      markdown += `Native mechanism: ${row.mechanism}. ${row.perLineMeasurementLimitation ?? 'The five lines have separate assembled-turn timing.'}\n\n`
      if (row.countingNumberFoldComparison) markdown += `Supplemental counting-number-fold WER: ${fmt(row.countingNumberFoldComparison.wer)}; substitutions/deletions/insertions ${row.countingNumberFoldComparison.substitutions}/${row.countingNumberFoldComparison.deletions}/${row.countingNumberFoldComparison.insertions}. This limited spelling equivalence is separate from the strict score and preserves missing words.\n\n`
      markdown += `Below-threshold intervals: ${row.silences.length}; total ${(row.silences.reduce((n, s) => n + s.end - s.start, 0)).toFixed(3)} seconds. Complete signal intervals are in assessment.json; these are not independently verified semantic pauses.\n\n`
      if (row.perTurn.length) markdown += table(['Turn', 'Trimmed seconds', 'Reference WPM', 'Longest internal silence'], row.perTurn.map(t => [t.turnId, t.trimmedWindowSeconds.toFixed(3), t.referenceWordsPerMinute?.toFixed(2) ?? 'unavailable', t.longestInternalSilenceSeconds.toFixed(3) + 's'])) + '\n\n'
      if (row.speedOrder) markdown += `Slow < normal < fast reference-word throughput: ${row.speedOrder.directionConsistent ? 'consistent in signal measurements' : 'not consistently ordered in signal measurements'}. This does not establish speech correctness or exact numeric calibration.\n\n`
      if (row.pauseMeasurement.length) markdown += table(['Turn', 'Mechanism', 'Requested seconds', 'Longest internal gap', 'Delta seconds'], row.pauseMeasurement.map(p => [p.turnId, p.mechanism, p.requestedSeconds?.toFixed(3) ?? 'qualitative', p.longestInternalSilenceSeconds.toFixed(3), p.deltaSeconds?.toFixed(3) ?? 'not applicable'])) + '\n\n'
    }
    markdown += `Human speech score: excluded and unscored. User-excluded dimensions: ${row.unscoredDimensions.join('; ')}. ${row.controlEffectiveness}.\n\n`
  }
  markdown += '## Reproduce\n\nInspect without writes: `bun src/tools/assess-tts-benchmarks.ts`. Run/reuse installed local ASR and update this report/archive: `bun src/tools/assess-tts-benchmarks.ts --run --concurrency 2`. Each cache key binds the audio, original input, expected spoken text, ASR engine hash, version and selected render; complete cached transcripts are reused. Cache and interrupted diagnostics remain under runtime/tts-benchmark-assessment/. No provider fallback or model download is implemented.\n'
  writePortableFileSync(join(root, 'assessment.md'), markdown)
  for (const row of rows) {
    const note = join(dirname(row.manifest), 'consensus-evaluation.txt')
    if (!existsSync(note)) continue
    const previous = readFileSync(note, 'utf8')
    const text = `Offline ASR assessment (${report.generatedAt}): ${row.id}. See ${toProjectRelativePath(join(root, 'assessment.md'))}#${row.id.toLowerCase()} and assessment.evidence.zip.\n\nInstalled Whisper small.en screening: strict WER ${fmt(row.comparison.wer)}, CER ${fmt(row.cer)}, substitutions/deletions/insertions ${row.comparison.substitutions}/${row.comparison.deletions}/${row.comparison.insertions}.${row.countingNumberFoldComparison ? ` Supplemental counting-number-fold WER ${fmt(row.countingNumberFoldComparison.wer)} (normalized tokens 1–5 only; omissions preserved).` : ''} Differences require adjudication and do not establish TTS errors. Full waveform decoding succeeded. ${row.perTurn.length ? 'Separate assembled-turn signal measurements are recorded.' : 'Per-line timing attribution is unavailable; full-file signal intervals are recorded.'}\n\nSubjective pronunciation, speaker identity, emotional/control effect, seam/prosody, and perceptual ratings are excluded and unscored at the user’s instruction. No human listening or perceptual pass is claimed. No provider calls or synthesis reruns were made.\n`
    if (previous.startsWith('Transport completed and local audio integrity was verified.') || previous.startsWith('Offline ASR assessment (')) writePortableFileSync(note, text)
    else if (!previous.includes(text)) writePortableFileSync(note, previous.trimEnd() + '\n\n' + text)
  }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: bun src/tools/assess-tts-benchmarks.ts [--run | --transcribe-only] [--concurrency 2] [--limit N]\nDefault: inspect selected recordings without writes. --run uses installed small.en/ffmpeg offline and updates fixed assessment.md/evidence.zip. Reuses hash-bound caches; never downloads models or calls providers.')
  } else {
    if (args.includes('--run') && args.includes('--limit')) throw Error('Partial queues cannot publish the benchmark assessment; use --transcribe-only --limit N')
    const allowed = new Set(['--run', '--transcribe-only', '--concurrency', '--limit'])
    for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i]!)) throw Error('Unknown assessment option'); if (args[i] !== '--transcribe-only' && args[i] !== '--run') i++ }
    const option = (name: string, fallback: number) => { const index = args.indexOf(name); const value = index < 0 ? fallback : Number(args[index + 1]); if (!Number.isInteger(value) || value < 1) throw Error('Expected positive integer ' + name); return value }
    const engineSha256 = hash(readFileSync(MODEL)), root = 'docs/benchmarks/tts', cacheRoot = 'runtime/tts-benchmark-assessment/v1'
    let sources = collectAssessmentSources(root, engineSha256)
    if (args.includes('--limit')) sources = sources.sort((a, b) => b.durationSeconds - a.durationSeconds).slice(0, option('--limit', 42))
    console.log(JSON.stringify({ selected: sources.length, audioSeconds: sources.reduce((n, s) => n + s.durationSeconds, 0), model: MODEL, engineSha256 }))
    if (args.includes('--run') || args.includes('--transcribe-only')) {
      await runAssessmentQueue(sources, cacheRoot, engineSha256, Math.min(option('--concurrency', 2), 4))
      if (args.includes('--run')) await publishAssessment(root, sources, cacheRoot, engineSha256)
      console.log('Offline assessment complete.')
    } else console.log(JSON.stringify(sources.map(s => ({ id: s.id, audio: s.audio, input: s.input, cacheKey: s.cacheKey })), null, 2))
  }
}
