import type { CliFlagsDefinition } from '~/types'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { isRecord } from '~/utils/rest-client'
import * as l from '~/utils/app-logger/app-logger'
import { evaluateWordTiming } from './step-2-stt/stt-utils/stt-word-metrics'
import { reconcileSttSpeakers } from './step-2-stt/stt-utils/reconcile-stt-speakers'
import { localTimingOutput, readLocalTimingResult, requireLocalTimingFile, writeLocalTimingFiles } from './stt-local-workspace'
import { splitSttChannels, mergeSttChannelResults } from './stt-channel-workflows'
import { calibrateWhisperTiming } from './calibrate-whisper-timing'
import { runLocalForcedAlignment } from './run-local-forced-alignment'

export const sttTimingFlags = {
  'timing-reference': { description: 'Compare saved word timing with this reference result.json (also used by --calibrate-whisper)', type: String },
  'calibrate-whisper': { description: 'Compare installed Whisper standard/DTW timing against --timing-reference using local audio', type: Boolean },
  'whisper-engine': { description: 'Calibration engine: whisper|whisperfile (default whisper)', type: String },
  'whisper-calibration-model': { description: 'Installed model for local timing calibration (default tiny)', type: String },
  'align-transcript': { description: 'Force-align this saved transcript to local input audio using an installed CTC model', type: String },
  'alignment-model': { description: 'Local Wav2Vec2 CTC model directory; never downloaded by alignment', type: String },
  'alignment-python': { description: 'Python executable with the local CTC alignment dependencies (default python3)', type: String },
  'alignment-min-confidence': { description: 'Reject aligned words below this confidence, from 0 to 1 (default 0.1)', type: String },
  'split-channels': { description: 'Save each local audio channel as verified float32 WAV with timeline offsets', type: Boolean },
  'merge-channel-results': { description: 'Merge per-channel results listed in the input channel-results.json, retaining channel labels', type: Boolean },
  'speaker-map-template': { description: 'Create a fingerprinted speaker-map.json from the saved result for review', type: Boolean },
  'speaker-map': { description: 'Apply a reviewed speaker-map.json to saved words, segments, and chunk evidence offline', type: String }
} as const satisfies CliFlagsDefinition

export const runSttTimingWorkflow = async (input: string | undefined, flags: Record<string, unknown>, explicitFlags: ReadonlySet<string>): Promise<boolean> => {
  const operations = [
    flags['calibrate-whisper'] === true ? 'calibrate-whisper' : flags['timing-reference'] !== undefined ? 'timing-reference' : undefined,
    flags['align-transcript'] !== undefined ? 'align-transcript' : undefined,
    flags['split-channels'] === true ? 'split-channels' : undefined,
    flags['merge-channel-results'] === true ? 'merge-channel-results' : undefined,
    flags['speaker-map-template'] === true ? 'speaker-map-template' : undefined,
    flags['speaker-map'] !== undefined ? 'speaker-map' : undefined
  ].filter((operation): operation is string => operation !== undefined)
  if (!operations.length) {
    if (Object.keys(sttTimingFlags).some(key => explicitFlags.has(key))) throw UsageError('Timing options require a timing comparison, alignment, calibration, channel, or speaker-map operation.')
    return false
  }
  if (operations.length !== 1) throw UsageError('Run timing comparison, alignment, calibration, channel handling, and speaker reconciliation as separate operations.')
  const operation = operations[0]!
  const allowed = new Set([operation, 'price', 'output-dir', 'output-root', 'json', 'quiet', 'verbose', 'log-level', 'color', 'config-path',
    ...(operation === 'calibrate-whisper' ? ['timing-reference', 'whisper-engine', 'whisper-calibration-model'] : []),
    ...(operation === 'align-transcript' ? ['alignment-model', 'alignment-python', 'alignment-min-confidence'] : [])])
  for (const flag of explicitFlags) if (!allowed.has(flag)) throw UsageError(`--${flag} cannot be combined with the local --${operation} operation.`)
  const source = await requireLocalTimingFile(input)
  if (operation === 'calibrate-whisper' && typeof flags['timing-reference'] !== 'string') throw UsageError('--calibrate-whisper requires --timing-reference result.json.')
  if (flags['price'] === true) {
    l.report.result({ dryRun: true, estimate: { steps: [], totalEstimatedCostCents: 0 } }, 'Local timing operation provider cost: 0 cents')
    return true
  }
  const output = localTimingOutput(operation)
  let files: Record<string, string>
  if (operation === 'timing-reference') {
    const candidate = await readLocalTimingResult(source), reference = await readLocalTimingResult(String(flags['timing-reference']))
    const measured = evaluateWordTiming(reference.result.evidence?.words ?? [], candidate.result.evidence?.words ?? [])
    files = await writeLocalTimingFiles(output, { 'timing-comparison.json': { ...measured, source: candidate.source, sourceSha256: candidate.sha256, reference: reference.source, referenceSha256: reference.sha256,
      referenceProvenance: isRecord(reference.data) ? reference.data['referenceProvenance'] ?? { kind: 'unverified' } : { kind: 'unverified' },
      note: 'Measures agreement with the supplied reference. Acoustic accuracy requires an independently verified acoustic reference. No inference is performed.' } })
  } else if (operation === 'calibrate-whisper') files = await calibrateWhisperTiming(source, String(flags['timing-reference']), flags, output)
  else if (operation === 'align-transcript') files = await runLocalForcedAlignment(source, String(flags['align-transcript']), flags, output)
  else if (operation === 'split-channels') files = await splitSttChannels(source, output)
  else if (operation === 'merge-channel-results') {
    const merged = await mergeSttChannelResults(source)
    files = await writeLocalTimingFiles(output, { 'result.json': merged.result, 'channel-merge.json': merged.provenance })
  } else {
    const saved = await readLocalTimingResult(source)
    if (operation === 'speaker-map-template') {
      const labels = new Set([...saved.result.segments, ...(saved.result.evidence?.words ?? []), ...(saved.result.evidence?.segments ?? [])].flatMap(segment => segment.speaker ? [segment.speaker] : []))
      files = await writeLocalTimingFiles(output, { 'speaker-map.json': { schemaVersion: 1, sourceSha256: saved.sha256, reason: '', speakers: Object.fromEntries([...labels].map(label => [label, label])) } })
    } else {
      const packet: unknown = await Bun.file(await requireLocalTimingFile(String(flags['speaker-map']))).json()
      if (!isRecord(packet) || packet['schemaVersion'] !== 1 || packet['sourceSha256'] !== saved.sha256 || typeof packet['reason'] !== 'string' || !packet['reason'].trim()) throw ValidationError('Speaker map must have schemaVersion 1, matching sourceSha256, a nonempty review reason, and a speakers object. Generate it with --speaker-map-template.')
      const result = reconcileSttSpeakers(saved.result, packet['speakers'])
      files = await writeLocalTimingFiles(output, { 'result.json': result, 'speaker-reconciliation.json': { ...packet, source: saved.source, method: 'reviewed-explicit-map', originalEvidenceUnmodified: true } })
    }
  }
  l.report.complete(output, files, { metrics: { providerCalls: 0 } })
  return true
}
