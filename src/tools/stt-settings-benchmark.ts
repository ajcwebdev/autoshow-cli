import { cp } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { UsageError } from '~/utils/error-handler'
import { SOURCE_ROOT } from '~/utils/project-root'
import { getSttLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { compactArchiveRun } from '../../.codex/skills/consensus/scripts/shared/compact_archive'
import {
  LEDGER_PATH, activeApproval, appendAttempt, assertApprovedBudget, assessLosslessFeasibility, buildExtractArgs, buildReferenceSource, buildRunFlags,
  buildVariantRecord, classifyDispatchFailure, computeCumulativeSpentCents, countReferenceSpeakers, findSkip, formatCommand, formatTable,
  isSucceededManifest, ledgerRunState, manifestActualCents, normalizeSingleProviderLayout, parseLedger, planRuns, readMp3Format, resolveAttempt,
  runDirectoryPath, runMaxCents, type PlannedRun, type SettingsManifestSnapshot, type SttSettingsLedger, type SttSettingsVariant
} from './stt-settings-benchmark-plan'

const USAGE = `Usage: bun src/tools/stt-settings-benchmark.ts [--price | --run] [--variant ID ...] [--approved-budget-cents N [--approval-note TEXT]] [--ledger PATH]
       bun src/tools/stt-settings-benchmark.ts --promote VARIANT_ID [--ledger PATH]
Defaults to no-cost pricing of every planned variant x recording through the CLI's own --price path, run with
an empty environment and no .env file so no provider can be authenticated. --approved-budget-cents is the
user-approved TOTAL cumulative ceiling for the ledger: --run requires recorded spend plus the --max-model-cents
headroom of every remaining run in the whole batch (not only --variant) to fit under it, records a new value in
the ledger approvals, re-checks before every dispatch, skips completed runs, stops on the first failure and
appends one attempt record per dispatch to ${LEDGER_PATH}. --promote copies an already-paid run listed in the
ledger (promotedFrom) into the layout without touching the original. Outputs are never deleted or overwritten.`

type Mode = 'price' | 'run' | 'promote'
const args = Bun.argv.slice(2)
let mode: Mode = 'price'
let ledgerPath = LEDGER_PATH
let approvedBudgetCents: number | undefined
let promoteVariant: string | undefined
let approvalNote: string | undefined
const variantIds: string[] = []
const takeValue = (index: number, flag: string): string => {
  const value = args[index]
  if (value === undefined || value.startsWith('--')) throw UsageError(`${flag} requires a value`)
  return value
}
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--help' || arg === '-h') break
  else if (arg === '--price') { if (mode === 'run') throw UsageError('Choose --run or --price') }
  else if (arg === '--run') { if (args.includes('--price')) throw UsageError('Choose --run or --price'); mode = 'run' }
  else if (arg === '--variant') variantIds.push(takeValue(++i, arg))
  else if (arg === '--ledger') ledgerPath = takeValue(++i, arg)
  else if (arg === '--approval-note') approvalNote = takeValue(++i, arg)
  else if (arg === '--promote') { promoteVariant = takeValue(++i, arg); mode = 'promote' }
  else if (arg === '--approved-budget-cents') {
    approvedBudgetCents = Number(takeValue(++i, arg))
    if (!Number.isFinite(approvedBudgetCents) || approvedBudgetCents < 0) throw UsageError('--approved-budget-cents must be a nonnegative number')
  } else throw UsageError(`Unknown argument: ${arg}`)
}
const helpOnly = args.includes('--help') || args.includes('-h')
if (helpOnly) console.log(USAGE)

// STT_SETTINGS_BENCHMARK_CLI_ENTRY exists only so contract tests can substitute a local fake CLI.
const CLI_ENTRY = Bun.env['STT_SETTINGS_BENCHMARK_CLI_ENTRY'] ?? resolve(SOURCE_ROOT, 'src/cli/create-cli.ts')
// Price-only children get no credentials: an empty environment and no .env file.
const PRICE_ENV = { PATH: Bun.env['PATH'] ?? '', HOME: Bun.env['HOME'] ?? '', BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }

const readJson = async (path: string): Promise<unknown> => await Bun.file(path).json()
const writeLedger = async (ledger: SttSettingsLedger): Promise<void> => {
  ledger.cumulativeSpentCents = computeCumulativeSpentCents(ledger.runs)
  await Bun.write(ledgerPath, JSON.stringify(ledger, null, 2) + '\n')
}

const speakerCountFor = async (planned: PlannedRun): Promise<number | undefined> =>
  planned.variant.speakerCountFromReference ? countReferenceSpeakers(await Bun.file(planned.recording.reference).text()) : undefined

const writeRunSidecars = async (planned: PlannedRun, flags: readonly string[]): Promise<void> => {
  await Bun.write(join(planned.directory, 'variant.json'), JSON.stringify(buildVariantRecord(planned.variant, flags), null, 2) + '\n')
  const reference = buildReferenceSource(planned.recording.reference, await Bun.file(planned.recording.reference).arrayBuffer())
  await Bun.write(join(planned.directory, 'reference-source.json'), JSON.stringify(reference, null, 2) + '\n')
}

const isLossless = (variant: SttSettingsVariant): boolean => {
  const index = variant.settings.indexOf('--stt-audio-profile')
  return index >= 0 && variant.settings[index + 1] === 'lossless'
}

type Assessment = PlannedRun & {
  status: 'planned' | 'completed' | 'skipped' | 'incomplete' | 'price-failed'
  flags: string[]
  estimatedCents?: number
  recordedCents?: number
  detail?: string
}

const priceRun = async (planned: PlannedRun, flags: readonly string[]): Promise<{ cents: number } | { error: string }> => {
  const child = Bun.spawn([process.execPath, '--no-env-file', CLI_ENTRY, ...buildExtractArgs(planned.recording.source, flags, planned.directory, 'price')], {
    cwd: process.cwd(), env: PRICE_ENV, stdout: 'pipe', stderr: 'pipe'
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  const lines = `${stdout}\n${stderr}`.split('\n').filter(line => line.startsWith('{'))
  const result = lines.map(line => { try { return JSON.parse(line) as Record<string, unknown> } catch { return undefined } }).filter(Boolean).reverse()
    .find(entry => entry?.['type'] === 'result') as { status?: string, message?: string, data?: { dryRun?: boolean, estimate?: { totalEstimatedCostCents?: number, steps?: Array<{ provider?: string, model?: string }> } } } | undefined
  if (code !== 0 || result?.status !== 'success') return { error: result?.message ?? (stderr.trim().split('\n').pop() || `exit ${code}`) }
  const estimate = result.data?.estimate
  const cents = estimate?.totalEstimatedCostCents
  if (result.data?.dryRun !== true || typeof cents !== 'number' || !Number.isFinite(cents) || cents < 0) return { error: 'price output had no complete dry-run estimate' }
  const steps = estimate?.steps ?? []
  if (steps.length !== 1 || steps[0]?.provider !== planned.variant.baseline.service || steps[0]?.model !== planned.variant.baseline.model) {
    return { error: `price selected ${steps.map(step => `${step.provider}/${step.model}`).join(', ') || 'no step'}, expected ${planned.variant.baseline.service}/${planned.variant.baseline.model}` }
  }
  return { cents }
}

const assess = async (ledger: SttSettingsLedger, planned: PlannedRun): Promise<Assessment> => {
  const state = ledgerRunState(ledger, planned.variant.id, planned.recording.id)
  const skip = findSkip(ledger, planned.variant.id, planned.recording.id)
  const base = { ...planned, flags: [] as string[] }
  if (skip) return { ...base, status: 'skipped', detail: skip.reason }
  const manifestPath = join(planned.directory, 'manifest.json')
  if (existsSync(planned.directory)) {
    const succeeded = existsSync(manifestPath) && isSucceededManifest(await readJson(manifestPath))
    if (succeeded) {
      if (state.kind === 'completed') return { ...base, status: 'completed', ...(state.record.actualCents !== undefined ? { recordedCents: state.record.actualCents } : {}), detail: 'recorded' }
      return { ...base, status: 'incomplete', detail: `${planned.directory} has a succeeded manifest that the ledger does not record as completed; reconcile its cost before continuing` }
    }
    return { ...base, status: 'incomplete', detail: `existing ${planned.directory} has no succeeded manifest; preserve and reconcile it before any paid retry` }
  }
  // Never re-dispatch a paid run because its directory moved or outputBase changed.
  if (state.kind === 'completed') return { ...base, status: 'incomplete', ...(state.record.actualCents !== undefined ? { recordedCents: state.record.actualCents } : {}), detail: `ledger records completed attempt ${state.record.attempt} but ${planned.directory} is missing; restore it or fix outputBase (a paid run is never re-dispatched)` }
  if (state.kind === 'unresolved') return { ...base, status: 'incomplete', detail: `ledger attempt ${state.record.attempt} is ${state.record.status} with no run directory and no archivedPath; reconcile it before retrying` }
  if (!existsSync(planned.recording.source)) return { ...base, status: 'price-failed', detail: `source audio missing: ${planned.recording.source}` }
  const flags = buildRunFlags(planned.variant, await speakerCountFor(planned))
  if (isLossless(planned.variant)) {
    const feasibility = assessLosslessFeasibility(planned.variant.baseline, {
      durationSeconds: planned.recording.durationSeconds,
      baselineBytes: statSync(planned.recording.source).size,
      format: readMp3Format(new Uint8Array(await Bun.file(planned.recording.source).slice(0, 1 << 20).arrayBuffer()))
    }, getSttLimits(planned.variant.baseline.service, planned.variant.baseline.model))
    if (!feasibility.feasible) throw UsageError(`Infeasible run is not recorded as skipped in the ledger: ${planned.variant.id}/${planned.recording.id}: ${feasibility.reason}`)
  }
  const priced = await priceRun(planned, flags)
  if ('error' in priced) return { ...base, flags, status: 'price-failed', detail: priced.error }
  return { ...base, flags, status: 'planned', estimatedCents: priced.cents }
}

const mapLimited = async <T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index]!)
    }
  }))
  return results
}

const settingsLabel = (assessment: Assessment): string => {
  if (assessment.flags.length === 0) return assessment.variant.label ?? assessment.variant.settings.join(' ')
  return assessment.flags.slice(3).join(' ')
}

const promote = async (ledger: SttSettingsLedger, variantId: string): Promise<void> => {
  const variant = ledger.variants.find(entry => entry.id === variantId)
  if (!variant?.promotedFrom) throw UsageError(`Variant ${variantId} has no promotedFrom source in the ledger`)
  const lines: string[] = []
  for (const recording of ledger.recordings) {
    const source = join(variant.promotedFrom, recording.id)
    const directory = runDirectoryPath(ledger, variant.id, recording.id)
    if (existsSync(directory)) throw UsageError(`Refusing to overwrite existing ${directory}`)
    if (ledgerRunState(ledger, variant.id, recording.id).kind === 'completed') throw UsageError(`Ledger already records ${variant.id}/${recording.id} as completed; restore its directory instead of promoting again`)
    const manifest = await readJson(join(source, 'manifest.json')) as SettingsManifestSnapshot
    const provider = manifest.items[0]?.providers[0]
    if (!isSucceededManifest(manifest) || provider?.service !== variant.baseline.service || provider.model !== variant.baseline.model || provider.options?.diarizationOptions?.enabled !== true) {
      throw UsageError(`${source} is not a succeeded diarized ${variant.baseline.service}/${variant.baseline.model} run`)
    }
    const actualCents = manifestActualCents(manifest)
    // Copy everything except source/prepared audio, which stays in the original (paid) directory.
    await cp(source, directory, { recursive: true, errorOnExist: true, force: false, filter: path => !['.mp3', '.wav'].includes(extname(path).toLowerCase()) })
    const changes = await normalizeSingleProviderLayout(directory)
    const planned = { variant, recording, directory }
    await writeRunSidecars(planned, buildRunFlags(variant, undefined))
    const compacted = compactArchiveRun(directory)
    appendAttempt(ledger, { variantId: variant.id, recordingId: recording.id, status: 'completed', actualCents, recordedAt: new Date().toISOString(), note: `Promoted from ${source}` })
    lines.push(`${directory}: ${actualCents.toFixed(3)}¢; ${changes.join('; ')}; compacted result.json ${compacted.resultBytesBefore} -> ${compacted.resultBytesAfter} B, manifest ${compacted.manifestBytesBefore} -> ${compacted.manifestBytesAfter} B (stripped ${compacted.strippedManifestResults} embedded result)`)
  }
  await writeLedger(ledger)
  console.log([...lines, `Ledger cumulative spend: ${ledger.cumulativeSpentCents.toFixed(3)}¢`].join('\n'))
}

type Pending = Assessment & { estimatedCents: number }
const capCents = (runs: readonly Pending[]): number => runs.reduce((sum, a) => sum + runMaxCents(a.estimatedCents), 0)

// Records the outcome as a new attempt; a CLI refusal before any billable request is recorded at 0¢. Throws on any failure.
const dispatch = async (ledger: SttSettingsLedger, assessment: Pending): Promise<void> => {
  const cliArgs = buildExtractArgs(assessment.recording.source, assessment.flags, assessment.directory, { maxCents: runMaxCents(assessment.estimatedCents) })
  // Reserve the estimate in a new attempt before dispatch: failure or interruption never resets spending.
  const attempt = appendAttempt(ledger, { variantId: assessment.variant.id, recordingId: assessment.recording.id, status: 'dispatched', estimatedCents: assessment.estimatedCents, recordedAt: new Date().toISOString() })
  await writeLedger(ledger)
  console.log(`$ ${formatCommand(cliArgs)}`)
  const child = Bun.spawn([process.execPath, CLI_ENTRY, ...cliArgs], { cwd: process.cwd(), env: { ...Bun.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' }, stdout: 'inherit', stderr: 'inherit' })
  const code = await child.exited
  const manifestPath = join(assessment.directory, 'manifest.json')
  const manifest = existsSync(manifestPath) ? await readJson(manifestPath) : undefined
  if (code !== 0 || !isSucceededManifest(manifest)) {
    const failure = classifyDispatchFailure(code, manifest)
    const outputs = existsSync(assessment.directory) ? `outputs preserved at ${assessment.directory}` : 'no run directory was created'
    if (failure.refused) {
      resolveAttempt(ledger, attempt, { status: 'refused', actualCents: 0, reason: failure.reason, recordedAt: new Date().toISOString(), note: outputs })
      await writeLedger(ledger)
      throw UsageError(`Run refused before dispatch (${failure.reason}): recorded at 0¢; ${outputs}; move any directory aside (see README) before retrying; remaining runs were not started`)
    }
    resolveAttempt(ledger, attempt, { status: 'failed', reason: failure.reason, recordedAt: new Date().toISOString(), note: outputs })
    await writeLedger(ledger)
    throw UsageError(`Run failed: ${assessment.directory} (${failure.reason}); ${outputs}, the estimate stays reserved, and remaining runs were not started`)
  }
  await normalizeSingleProviderLayout(assessment.directory)
  await writeRunSidecars(assessment, assessment.flags)
  resolveAttempt(ledger, attempt, { status: 'completed', actualCents: manifestActualCents(manifest), recordedAt: new Date().toISOString() })
  await writeLedger(ledger)
}

const recordApproval = (ledger: SttSettingsLedger, approvedTotalCents: number): void => {
  if (activeApproval(ledger)?.approvedTotalCents === approvedTotalCents) return
  ledger.approvals.push({
    approvedAt: new Date().toISOString(),
    approvedTotalCents,
    scope: 'cumulative ledger total (all variants and recordings, recorded spend included)',
    note: approvalNote ?? 'Recorded from --run --approved-budget-cents'
  })
}

const main = async (): Promise<void> => {
  const ledger = parseLedger(await readJson(ledgerPath))
  if (mode === 'promote') return await promote(ledger, promoteVariant!)
  const selectedIds = new Set(planRuns(ledger, variantIds).map(planned => planned.directory))
  // The whole batch is assessed so the approved ceiling covers runs outside the --variant selection too.
  const everything = await mapLimited(planRuns(ledger), 4, planned => assess(ledger, planned))
  const assessments = everything.filter(a => selectedIds.has(a.directory))
  const rows = assessments.map(a => ({
    Variant: a.variant.id,
    Recording: a.recording.id,
    Status: a.status,
    Settings: settingsLabel(a),
    'Estimate (¢)': a.estimatedCents !== undefined ? a.estimatedCents.toFixed(3) : '',
    'Recorded (¢)': a.recordedCents !== undefined ? a.recordedCents.toFixed(3) : ''
  }))
  const isPending = (a: Assessment): a is Pending => a.status === 'planned' && a.estimatedCents !== undefined
  const pending = assessments.filter(isPending)
  const batchPending = everything.filter(isPending)
  const remainingCents = pending.reduce((sum, a) => sum + a.estimatedCents, 0)
  const batchCapCents = capCents(batchPending)
  const blocked = assessments.filter(a => a.status === 'price-failed' || a.status === 'incomplete')
  const batchBlocked = everything.filter(a => !selectedIds.has(a.directory) && (a.status === 'price-failed' || a.status === 'incomplete'))
  const count = (status: Assessment['status']): number => assessments.filter(a => a.status === status).length
  const approval = activeApproval(ledger)
  console.log(formatTable(['Variant', 'Recording', 'Status', 'Settings', 'Estimate (¢)', 'Recorded (¢)'], rows, new Set(['Estimate (¢)', 'Recorded (¢)'])))
  console.log('')
  console.log(`Planned: ${pending.length}, completed: ${count('completed')}, skipped: ${count('skipped')}, incomplete: ${count('incomplete')}, price-failed: ${count('price-failed')}`)
  console.log(`Estimated remaining total: ${remainingCents.toFixed(3)}¢`)
  console.log(`Ledger cumulative spend: ${ledger.cumulativeSpentCents.toFixed(3)}¢ (pinned date ${ledger.benchmarkDate})`)
  console.log(`Cumulative spend after planned runs: ${(ledger.cumulativeSpentCents + remainingCents).toFixed(3)}¢`)
  console.log(`Whole-batch requirement (recorded spend + --max-model-cents headroom of ${batchPending.length} remaining run(s)): ${(ledger.cumulativeSpentCents + batchCapCents).toFixed(3)}¢`)
  console.log(`Active approval: ${approval ? `${approval.approvedTotalCents.toFixed(3)}¢ total (${approval.approvedAt})` : 'none recorded'}`)
  const notes = everything.filter(a => a.status !== 'planned' && a.detail && (selectedIds.has(a.directory) || a.status === 'incomplete' || a.status === 'price-failed'))
  if (notes.length) {
    console.log('\nNotes:')
    for (const a of notes) console.log(`- ${a.variant.id}/${a.recording.id} [${a.status}]: ${a.detail}`)
  }
  console.log(`\nCommands --run would execute (${pending.length}):`)
  for (const a of pending) console.log(formatCommand(buildExtractArgs(a.recording.source, a.flags, a.directory, { maxCents: runMaxCents(a.estimatedCents) })))
  if (mode !== 'run') {
    console.log('\nEstimate only: every price call ran with an empty environment and no provider request was dispatched.')
    return
  }
  if (blocked.length) throw UsageError(`--run refused: ${blocked.length} selected run(s) are incomplete or could not be priced; every selected run needs a complete estimate`)
  if (batchBlocked.length) throw UsageError(`--run refused: ${batchBlocked.length} run(s) outside the --variant selection are incomplete or could not be priced, so the batch total cannot be checked against the approval`)
  if (pending.length === 0) {
    console.log(`\nCompleted 0 run(s). Ledger cumulative spend: ${ledger.cumulativeSpentCents.toFixed(3)}¢`)
    return
  }
  assertApprovedBudget(approvedBudgetCents, { cumulativeSpentCents: ledger.cumulativeSpentCents, remainingCapCents: batchCapCents })
  recordApproval(ledger, approvedBudgetCents!)
  await writeLedger(ledger)
  const outstanding = new Set(batchPending)
  for (const assessment of pending) {
    // Re-check with actual recorded spend before every dispatch.
    assertApprovedBudget(approvedBudgetCents, { cumulativeSpentCents: ledger.cumulativeSpentCents, remainingCapCents: capCents([...outstanding]) })
    outstanding.delete(assessment)
    await dispatch(ledger, assessment)
  }
  console.log(`\nCompleted ${pending.length} run(s). Ledger cumulative spend: ${ledger.cumulativeSpentCents.toFixed(3)}¢`)
}

if (import.meta.main && !helpOnly) await main()
