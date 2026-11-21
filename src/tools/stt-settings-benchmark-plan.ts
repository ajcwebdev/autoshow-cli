import * as v from 'valibot'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, rename } from 'node:fs/promises'
import { UsageError } from '~/utils/error-handler'
import type { SttLimits } from '~/types'

// Pure plan, command, feasibility and ledger helpers for src/tools/stt-settings-benchmark.ts.
// Nothing here dispatches a provider request.

export const LEDGER_PATH = 'docs/benchmarks/stt/settings/benchmark-plan.json'
export const RUN_DIR_SEPARATOR = '__'
// ffmpeg's pcm_f32le WAV adds a few small chunks; bound the header generously.
const WAV_HEADER_BOUND_BYTES = 4096

const slug = v.pipe(v.string(), v.regex(/^[a-z0-9][a-z0-9-]*$/))
const repoPath = v.pipe(v.string(), v.minLength(1), v.check(value => !value.startsWith('/') && !value.includes('..'), 'must be repository-relative'))
const cents = v.pipe(v.number(), v.minValue(0))

const recordingSchema = v.strictObject({
  id: slug,
  source: repoPath,
  reference: repoPath,
  durationSeconds: v.pipe(v.number(), v.minValue(0.001))
})

const variantSchema = v.strictObject({
  id: slug,
  label: v.optional(v.string()),
  baseline: v.strictObject({ service: v.string(), model: v.string() }),
  provider: v.pipe(v.string(), v.regex(/^[a-z0-9-]+=[A-Za-z0-9_.@/-]+$/)),
  settings: v.array(v.string()),
  speakerCountFromReference: v.optional(v.boolean()),
  promotedFrom: v.optional(repoPath),
  note: v.optional(v.string())
})

const skipSchema = v.strictObject({ variantId: slug, recordingId: slug, reason: v.pipe(v.string(), v.minLength(1)) })

// One record per dispatch attempt; attempts are appended and never replaced, so cumulative spend always
// includes every billed or reserved attempt.
// - dispatched: the estimate is reserved; the CLI was started and its outcome is not recorded yet.
// - completed: actualCents is the manifest's actual cost.
// - failed: a provider request may have been made; the estimate stays reserved.
// - refused: the CLI refused before any billable provider request; recorded at 0¢ with its reason.
// An unresolved (dispatched/failed) attempt blocks the pair until it is reconciled with archivedPath.
const runSchema = v.strictObject({
  variantId: slug,
  recordingId: slug,
  attempt: v.pipe(v.number(), v.integer(), v.minValue(1)),
  status: v.picklist(['completed', 'failed', 'dispatched', 'refused']),
  estimatedCents: v.optional(cents),
  actualCents: v.optional(cents),
  recordedAt: v.string(),
  reason: v.optional(v.pipe(v.string(), v.minLength(1))),
  archivedPath: v.optional(repoPath),
  note: v.optional(v.string())
})

// Explicit user approvals of a TOTAL cumulative ceiling for this ledger (already-recorded spend included).
// The latest entry is the active approval.
const approvalSchema = v.strictObject({
  approvedAt: v.string(),
  approvedTotalCents: cents,
  scope: v.pipe(v.string(), v.minLength(1)),
  note: v.optional(v.string())
})

export const ledgerSchema = v.strictObject({
  schemaVersion: v.literal(2),
  note: v.optional(v.string()),
  benchmarkDate: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  outputBase: repoPath,
  cumulativeSpentCents: cents,
  approvals: v.array(approvalSchema),
  recordings: v.pipe(v.array(recordingSchema), v.minLength(1)),
  variants: v.pipe(v.array(variantSchema), v.minLength(1)),
  skips: v.array(skipSchema),
  runs: v.array(runSchema)
})

export type SttSettingsLedger = v.InferOutput<typeof ledgerSchema>
export type SttSettingsVariant = SttSettingsLedger['variants'][number]
export type SttSettingsRecording = SttSettingsLedger['recordings'][number]
export type SttSettingsRunRecord = SttSettingsLedger['runs'][number]

const RESERVED_FLAGS = new Set(['--provider', '--diarization', '--speaker-count', '--output-dir', '--price', '--max-model-cents', '--json'])

export const parseLedger = (value: unknown): SttSettingsLedger => {
  const result = v.safeParse(ledgerSchema, value)
  if (!result.success) {
    const issue = result.issues[0]
    throw UsageError(`Invalid STT settings benchmark ledger: ${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`)
  }
  const ledger = result.output
  const unique = (label: string, ids: string[]): void => {
    if (new Set(ids).size !== ids.length) throw UsageError(`Duplicate ${label} in STT settings benchmark ledger`)
  }
  unique('recording id', ledger.recordings.map(r => r.id))
  unique('variant id', ledger.variants.map(variant => variant.id))
  unique('skip', ledger.skips.map(s => `${s.variantId}/${s.recordingId}`))
  unique('run attempt', ledger.runs.map(r => `${r.variantId}/${r.recordingId}#${r.attempt}`))
  unique('completed run', ledger.runs.filter(r => r.status === 'completed').map(r => `${r.variantId}/${r.recordingId}`))
  for (const run of ledger.runs) {
    const label = `${run.variantId}/${run.recordingId} attempt ${run.attempt}`
    if (run.status === 'completed' && run.actualCents === undefined) throw UsageError(`Completed ${label} needs actualCents`)
    if (run.status === 'refused' && (run.actualCents !== 0 || !run.reason)) throw UsageError(`Refused ${label} must record actualCents 0 and a reason`)
    if ((run.status === 'dispatched' || run.status === 'failed') && run.actualCents === undefined && run.estimatedCents === undefined) throw UsageError(`Unresolved ${label} must keep its reserved estimatedCents`)
  }
  const variantIds = new Set(ledger.variants.map(variant => variant.id))
  const recordingIds = new Set(ledger.recordings.map(r => r.id))
  for (const ref of [...ledger.skips, ...ledger.runs]) {
    if (!variantIds.has(ref.variantId) || !recordingIds.has(ref.recordingId)) throw UsageError(`Unknown variant/recording ${ref.variantId}/${ref.recordingId} in ledger`)
  }
  for (const variant of ledger.variants) {
    for (const flag of variant.settings.filter(arg => arg.startsWith('--'))) {
      if (RESERVED_FLAGS.has(flag)) throw UsageError(`Variant ${variant.id} settings must not include ${flag}; the runner adds it`)
    }
  }
  const recomputed = computeCumulativeSpentCents(ledger.runs)
  if (Math.abs(recomputed - ledger.cumulativeSpentCents) > 1e-6) throw UsageError(`Ledger cumulativeSpentCents ${ledger.cumulativeSpentCents} differs from its run records (${recomputed})`)
  return ledger
}

// Conservative: an unresolved or failed dispatch keeps its full reserved estimate; refused attempts count 0¢.
export const computeCumulativeSpentCents = (runs: readonly SttSettingsRunRecord[]): number =>
  runs.reduce((sum, run) => sum + (run.actualCents ?? run.estimatedCents ?? 0), 0)

export const attemptsFor = (ledger: Pick<SttSettingsLedger, 'runs'>, variantId: string, recordingId: string): SttSettingsRunRecord[] =>
  ledger.runs.filter(run => run.variantId === variantId && run.recordingId === recordingId).sort((a, b) => a.attempt - b.attempt)

// Appends a new attempt (never replaces an earlier one) and returns it.
export const appendAttempt = (ledger: SttSettingsLedger, record: Omit<SttSettingsRunRecord, 'attempt'>): SttSettingsRunRecord => {
  const attempt = Math.max(0, ...attemptsFor(ledger, record.variantId, record.recordingId).map(run => run.attempt)) + 1
  const appended = { ...record, attempt } as SttSettingsRunRecord
  ledger.runs.push(appended)
  return appended
}

// Resolves this invocation's own reserved attempt. An attempt that already records actualCents is final.
export const resolveAttempt = (ledger: SttSettingsLedger, key: Pick<SttSettingsRunRecord, 'variantId' | 'recordingId' | 'attempt'>, update: Partial<Omit<SttSettingsRunRecord, 'variantId' | 'recordingId' | 'attempt'>>): void => {
  const record = ledger.runs.find(run => run.variantId === key.variantId && run.recordingId === key.recordingId && run.attempt === key.attempt)
  if (!record) throw UsageError(`No ledger attempt ${key.variantId}/${key.recordingId}#${key.attempt}`)
  if (record.actualCents !== undefined || record.status === 'completed' || record.status === 'refused') throw UsageError(`Ledger attempt ${key.variantId}/${key.recordingId}#${key.attempt} is final and is never replaced`)
  Object.assign(record, update)
}

export type LedgerRunState =
  | { kind: 'none' }
  | { kind: 'completed', record: SttSettingsRunRecord }
  | { kind: 'unresolved', record: SttSettingsRunRecord }
  | { kind: 'retryable', attempts: number }

// Completed wins; an unresolved (dispatched/failed, not archived) attempt blocks; refused or archived
// failed attempts allow a new attempt while staying in cumulative spend.
export const ledgerRunState = (ledger: Pick<SttSettingsLedger, 'runs'>, variantId: string, recordingId: string): LedgerRunState => {
  const attempts = attemptsFor(ledger, variantId, recordingId)
  const completed = attempts.find(run => run.status === 'completed')
  if (completed) return { kind: 'completed', record: completed }
  const unresolved = attempts.find(run => (run.status === 'dispatched' || run.status === 'failed') && !run.archivedPath)
  if (unresolved) return { kind: 'unresolved', record: unresolved }
  return attempts.length ? { kind: 'retryable', attempts: attempts.length } : { kind: 'none' }
}

export const activeApproval = (ledger: Pick<SttSettingsLedger, 'approvals'>): SttSettingsLedger['approvals'][number] | undefined => ledger.approvals.at(-1)

type ManifestEvidence = { items?: Array<{ metadata?: { cost?: { actual?: { totalCost?: unknown } } }, providers?: Array<{ status?: unknown, attempts?: unknown, error?: { message?: unknown } }> }> }

// Remote job/asset ids or a completed create call mean a provider accepted work that may be billed.
const REMOTE_EVIDENCE = /"(?:remoteJobId|remoteAssetId|remoteAssetUrl|createCompletedAt)"\s*:/
// Credential rejections and missing keys: the provider performed no billable work.
const CREDENTIAL_REJECTION = /\((?:401|403)\)|INVALID_AUTH|API_KEY environment variable is required|missing api key/i

export type DispatchFailure = { refused: true, reason: string } | { refused: false, reason: string }

// Decides whether a failed dispatch can be recorded as a 0¢ refusal. Conservative: anything that is not a
// usage refusal with no provider attempt, or an all-credential rejection without remote evidence, keeps
// its reservation.
export const classifyDispatchFailure = (exitCode: number, manifest: unknown): DispatchFailure => {
  const text = manifest === undefined ? '' : JSON.stringify(manifest)
  const item = (manifest as ManifestEvidence | undefined)?.items?.[0]
  const actual = item?.metadata?.cost?.actual?.totalCost
  if (REMOTE_EVIDENCE.test(text)) return { refused: false, reason: `exit ${exitCode}; manifest records a remote provider job or asset` }
  if (typeof actual === 'number' && actual > 0) return { refused: false, reason: `exit ${exitCode}; manifest records ${actual}¢ actual cost` }
  const providers = item?.providers ?? []
  const attempted = providers.filter(provider => typeof provider.attempts === 'number' ? provider.attempts > 0 : provider.status === 'failed' || provider.status === 'succeeded')
  if (exitCode === 2 && attempted.length === 0) return { refused: true, reason: 'CLI usage refusal (exit 2) before any provider attempt' }
  const messages = attempted.map(provider => String(provider.error?.message ?? ''))
  if (attempted.length > 0 && attempted.every(provider => provider.status === 'failed') && messages.every(message => CREDENTIAL_REJECTION.test(message))) {
    return { refused: true, reason: `credential rejected before any provider job: ${messages.join('; ').slice(0, 300)}` }
  }
  return { refused: false, reason: `exit ${exitCode}; a provider request may have been made` }
}

export const runDirectoryName = (variantId: string, recordingId: string): string => `${variantId}${RUN_DIR_SEPARATOR}${recordingId}`

export const runDirectoryPath = (ledger: Pick<SttSettingsLedger, 'outputBase'>, variantId: string, recordingId: string): string =>
  join(ledger.outputBase, runDirectoryName(variantId, recordingId))

// Matches the providers/<service>-<model> artifact directories the consensus STT reports read.
export const providerDirectoryName = (service: string, model: string): string => `${service}-${model.replace(/\//g, '_')}`

const SPEAKER_LABEL = /^(?:\[[^\]]*\]\s*)?\[speaker-(\d+)\]/

export const countReferenceSpeakers = (reference: string): number => {
  const speakers = new Set<string>()
  for (const line of reference.split(/\r?\n/)) {
    const match = SPEAKER_LABEL.exec(line.trim())
    if (match?.[1]) speakers.add(match[1])
  }
  if (speakers.size === 0) throw UsageError('Reference transcript has no [speaker-N] labels')
  return speakers.size
}

export const sha256Hex = (bytes: ArrayBuffer | Uint8Array | string): string =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

export const buildReferenceSource = (referencePath: string, referenceBytes: ArrayBuffer | Uint8Array | string) => ({
  schemaVersion: 1 as const,
  path: referencePath,
  sha256: sha256Hex(referenceBytes)
})

export const buildRunFlags = (variant: SttSettingsVariant, speakerCount?: number): string[] => {
  if (variant.speakerCountFromReference && (speakerCount === undefined || !Number.isSafeInteger(speakerCount) || speakerCount < 1)) {
    throw UsageError(`Variant ${variant.id} needs a positive reference speaker count`)
  }
  return [
    '--provider', variant.provider,
    '--diarization',
    ...variant.settings,
    ...(variant.speakerCountFromReference ? ['--speaker-count', String(speakerCount)] : [])
  ]
}

export const buildVariantLabel = (variant: SttSettingsVariant, flags: readonly string[]): string => {
  if (variant.label) return variant.label
  const pairs: string[] = []
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i]!
    if (!flag.startsWith('--') || flag === '--provider' || flag === '--diarization') {
      if (flag === '--provider') i++
      continue
    }
    const next = flags[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      pairs.push(`${flag.slice(2)}=${next}`)
      i++
    } else pairs.push(`${flag.slice(2)}=true`)
  }
  return pairs.join(',')
}

export const buildVariantRecord = (variant: SttSettingsVariant, flags: readonly string[]) => ({
  schemaVersion: 1 as const,
  variantId: variant.id,
  label: buildVariantLabel(variant, flags),
  baseline: { service: variant.baseline.service, model: variant.baseline.model },
  flags: [...flags]
})

export const buildExtractArgs = (source: string, flags: readonly string[], outputDir: string, mode: 'price' | { maxCents: number }): string[] => [
  'extract', source, ...flags, '--output-dir', outputDir,
  ...(mode === 'price' ? ['--price', '--json'] : ['--max-model-cents', String(mode.maxCents)])
]

// Per-run --max-model-cents value: the preflight estimate plus 2% (the lossless WAV duration probe can
// differ slightly from the MP3's), rounded up to a whole cent. --max-model-cents is the CLI's pre-dispatch
// estimate filter (it drops a target whose estimate exceeds the value), not a hard spend cap; the runner
// also uses it as the per-run headroom when checking the approved cumulative ceiling.
export const runMaxCents = (estimatedCents: number): number => Math.max(1, Math.ceil(estimatedCents * 1.02 - 1e-9))

export const formatCommand = (args: readonly string[]): string =>
  ['bun', 'autoshow', ...args].map(arg => /^[A-Za-z0-9_./=@:,+-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`).join(' ')

export type AudioFormat = { sampleRate: number, channels: number }

// Reads the first MPEG audio frame header (after any ID3v2 tag); the repository has no ffprobe dependency here.
export const readMp3Format = (bytes: Uint8Array): AudioFormat => {
  let offset = 0
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    offset = 10 + (((bytes[6]! & 0x7f) << 21) | ((bytes[7]! & 0x7f) << 14) | ((bytes[8]! & 0x7f) << 7) | (bytes[9]! & 0x7f))
  }
  for (; offset + 3 < bytes.length; offset++) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1]! & 0xe0) !== 0xe0) continue
    const version = (bytes[offset + 1]! >> 3) & 3
    const layer = (bytes[offset + 1]! >> 1) & 3
    const rateIndex = (bytes[offset + 2]! >> 2) & 3
    if (version === 1 || layer === 0 || rateIndex === 3) continue
    const base = [44100, 48000, 32000][rateIndex]!
    const sampleRate = version === 3 ? base : version === 2 ? base / 2 : base / 4
    const channels = ((bytes[offset + 3]! >> 6) & 3) === 3 ? 1 : 2
    return { sampleRate, channels }
  }
  throw UsageError('No MPEG audio frame header found')
}

export const losslessWavBytes = (durationSeconds: number, format: AudioFormat): number =>
  Math.ceil(durationSeconds * format.sampleRate) * format.channels * 4 + WAV_HEADER_BOUND_BYTES

type SplitInput = { bytes: number, durationSeconds: number }
const splitReasons = (input: SplitInput, limits: SttLimits): string[] => [
  ...(limits.effectiveBytes !== undefined && input.bytes > limits.effectiveBytes ? [`${input.bytes.toLocaleString('en-US')} B exceeds the ${limits.effectiveBytes.toLocaleString('en-US')} B upload cap`] : []),
  ...(limits.durationSeconds !== undefined && input.durationSeconds > limits.durationSeconds ? [`${input.durationSeconds}s exceeds the ${limits.durationSeconds}s duration cap`] : []),
  ...(limits.requestBudgetSeconds !== undefined && input.durationSeconds > limits.requestBudgetSeconds ? [`${input.durationSeconds}s exceeds the ${limits.requestBudgetSeconds}s request budget`] : [])
]

export type LosslessFeasibility = { feasible: boolean, wavBytes: number, reason?: string, sharedSplit?: boolean }

// The CLI auto-splits any input over a provider limit (src/cli/commands/stt/stt-split-policy.ts) and
// labels split speakers per chunk (chunk-N/speaker). A split that only the lossless WAV triggers would
// confound the audio-profile comparison with the unsplit default-profile baseline, so it is infeasible.
export const assessLosslessFeasibility = (
  target: { service: string, model: string },
  recording: { durationSeconds: number, baselineBytes: number, format: AudioFormat },
  limits: SttLimits
): LosslessFeasibility => {
  const wavBytes = losslessWavBytes(recording.durationSeconds, recording.format)
  const baseline = splitReasons({ bytes: recording.baselineBytes, durationSeconds: recording.durationSeconds }, limits)
  const lossless = splitReasons({ bytes: wavBytes, durationSeconds: recording.durationSeconds }, limits)
  if (lossless.length === 0 || baseline.length > 0) return { feasible: true, wavBytes, ...(baseline.length > 0 ? { sharedSplit: true } : {}) }
  return {
    feasible: false,
    wavBytes,
    reason: `Lossless float32 WAV (${recording.format.sampleRate} Hz, ${recording.format.channels} ch, ~${(wavBytes / 1e9).toFixed(2)} GB): ${lossless.join('; ')} for ${target.service}/${target.model}. The CLI would auto-split it into FLAC segments with chunk-scoped speaker labels, unlike the unsplit default-profile baseline, so the result would not isolate the audio profile.`
  }
}

export type PlannedRun = {
  variant: SttSettingsVariant
  recording: SttSettingsRecording
  directory: string
}

export const planRuns = (ledger: SttSettingsLedger, variantIds: readonly string[] = []): PlannedRun[] => {
  for (const id of variantIds) if (!ledger.variants.some(variant => variant.id === id)) throw UsageError(`Unknown --variant ${id}`)
  const variants = variantIds.length ? ledger.variants.filter(variant => variantIds.includes(variant.id)) : ledger.variants
  return variants.flatMap(variant => ledger.recordings.map(recording => ({ variant, recording, directory: runDirectoryPath(ledger, variant.id, recording.id) })))
}

export const findSkip = (ledger: SttSettingsLedger, variantId: string, recordingId: string) =>
  ledger.skips.find(skip => skip.variantId === variantId && skip.recordingId === recordingId)

type ManifestLike = { items?: Array<{ providers?: Array<{ status?: unknown }> }> }

export const isSucceededManifest = (manifest: unknown): boolean => {
  const items = (manifest as ManifestLike | null)?.items
  const providers = items?.[0]?.providers
  return Array.isArray(items) && items.length === 1 && Array.isArray(providers) && providers.length > 0 && providers.every(provider => provider.status === 'succeeded')
}

export const manifestActualCents = (manifest: unknown): number => {
  const value = (manifest as { items?: Array<{ metadata?: { cost?: { actual?: { totalCost?: unknown } } } }> } | null)?.items?.[0]?.metadata?.cost?.actual?.totalCost
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw UsageError('Manifest has no recorded actual cost')
  return value
}

// The approved ceiling is a TOTAL for the ledger: recorded spend (actuals and reservations) plus the
// --max-model-cents headroom of every remaining run in the whole batch, not only the --variant selection,
// so splitting a batch across invocations never resets the threshold.
export const assertApprovedBudget = (approvedTotalCents: number | undefined, spend: { cumulativeSpentCents: number, remainingCapCents: number }): void => {
  const required = spend.cumulativeSpentCents + spend.remainingCapCents
  if (approvedTotalCents === undefined || !Number.isFinite(approvedTotalCents) || approvedTotalCents + 1e-9 < required) {
    throw UsageError(`--run requires --approved-budget-cents (the approved cumulative total) of at least ${required.toFixed(3)}¢ = recorded spend ${spend.cumulativeSpentCents.toFixed(3)}¢ + remaining batch headroom ${spend.remainingCapCents.toFixed(3)}¢ (got ${approvedTotalCents ?? 'none'}); obtain explicit user approval first`)
  }
}

export type TableRow = Record<string, string>

export const formatTable = (headers: readonly string[], rows: readonly TableRow[], numeric: ReadonlySet<string> = new Set()): string => {
  const widths = headers.map(header => Math.max(header.length, ...rows.map(row => (row[header] ?? '').length), 3))
  const line = (cells: readonly string[]): string => `| ${cells.map((cell, i) => numeric.has(headers[i]!) ? cell.padStart(widths[i]!) : cell.padEnd(widths[i]!)).join(' | ')} |`
  const divider = `| ${headers.map((header, i) => numeric.has(header) ? `${'-'.repeat(widths[i]! - 1)}:` : '-'.repeat(widths[i]!)).join(' | ')} |`
  return [line(headers), divider, ...rows.map(row => line(headers.map(header => row[header] ?? '')))].join('\n')
}

export type ProviderState = { service: string, model: string, artifactDir: string, status: string, options?: { diarizationOptions?: { enabled?: boolean } } }
export type SettingsManifestSnapshot = { items: Array<{ outputDir: string, providers: ProviderState[] }> }

// A single-provider extract writes result.json and transcription.txt at the run root (artifactDir ".").
// The consensus STT reports read providers/<service>-<model>/result.json, so move them there and point
// the manifest at the new location. Returns a description of each change.
export const normalizeSingleProviderLayout = async (runDir: string): Promise<string[]> => {
  const manifestPath = join(runDir, 'manifest.json')
  const manifest = await Bun.file(manifestPath).json() as SettingsManifestSnapshot
  const item = manifest.items[0]
  const provider = item?.providers[0]
  if (manifest.items.length !== 1 || !item || item.providers.length !== 1 || !provider) throw UsageError(`${runDir} is not a single-provider extract run`)
  if (provider.artifactDir !== '.' || !existsSync(join(runDir, 'result.json'))) return []
  const directory = join('providers', providerDirectoryName(provider.service, provider.model))
  await mkdir(join(runDir, directory), { recursive: true })
  const changes: string[] = []
  for (const name of ['result.json', 'transcription.txt']) {
    if (!existsSync(join(runDir, name))) continue
    if (existsSync(join(runDir, directory, name))) throw UsageError(`Refusing to overwrite ${join(runDir, directory, name)}`)
    await rename(join(runDir, name), join(runDir, directory, name))
    changes.push(`moved ${name} -> ${directory}/${name}`)
  }
  changes.push(`manifest items[0].providers[0].artifactDir: "." -> "${directory}"`)
  provider.artifactDir = directory
  if (item.outputDir !== '.') {
    changes.push(`manifest items[0].outputDir: "${item.outputDir}" -> "."`)
    item.outputDir = '.'
  }
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  return changes
}
