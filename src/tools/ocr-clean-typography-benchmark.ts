import { AppValidationError, AppUsageError, AppInfrastructureError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { mkdir, open, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { validateCleanTypographyBundleFile } from './ocr-clean-typography-admission'
import { PROJECT_ROOT, stripProjectRoot } from '~/utils/project-root'

export const CLEAN_TYPOGRAPHY_PLAN = 'docs/benchmarks/ocr/clean-typography-additions-plan.json'
const localRoot = 'input/examples/document/ocr-clean-typography'
const ledgerPath = `${localRoot}/spending-ledger.json`
const guardPath = 'src/tools/ocr-clean-typography-spending-guard.ts'
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'
const safeStem = (value: string): string => value.replace(/[^a-zA-Z0-9_.-]/g, '-')
const atomicJson = async (path: string, value: unknown): Promise<void> => {
  const temporary = `${path}.${process.pid}.tmp`
  await Bun.write(temporary, json(value))
  await rename(temporary, path)
}

interface PriceStep {
  provider: string
  model: string
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  totalCostCents: number
}
interface BenchmarkCase {
  id: string
  input: string
  reference: string
  inputSha256: string
  referenceSha256: string
  sourceURL: string
  sourceRevision: string
  annotationURL: string
  runDir: string
  localPilot: { directory: string }
}
interface BenchmarkPlan {
  schemaVersion: number
  category: string
  caseCount: number
  targetCount: number
  approval: null | { budgetCents: number, evidence: string }
  quote: { models: PriceStep[] }
  cases: BenchmarkCase[]
}

const runChild = async (argv: string[], env?: Record<string, string | undefined>) => {
  const child = Bun.spawn(argv, { cwd: PROJECT_ROOT, env: { ...(env ?? process.env), AUTOSHOW_PROJECT_ROOT: PROJECT_ROOT }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited
  ])
  return { stdout, stderr, exitCode }
}

export const buildCleanTypographySlotCommand = (input: string, provider: string, model: string, directory: string, cliEntry = 'src/cli/create-cli.ts'): string[] => [
  process.execPath, '--preload', `./${guardPath}`, cliEntry, 'extract', input,
  '--provider', `${provider}=${model}`, '--output-dir', directory, '--json'
]

/** Freeze CLI imports once so unrelated workspace edits cannot break a partially paid batch. */
export const createCleanTypographyCliSnapshot = async () => {
  const built = await Bun.build({ entrypoints: [resolve(PROJECT_ROOT, 'src/cli/create-cli.ts')], target: 'bun', format: 'esm' })
  if (!built.success || built.outputs.length !== 1) throw new AppInfrastructureError('Cannot build the OCR benchmark CLI snapshot; no provider requests were sent')
  const bytes = new Uint8Array(await built.outputs[0]!.arrayBuffer())
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  const path = `output/benchmark-cache/ocr-clean-typography-cli-${sha256}.js`
  await mkdir(dirname(resolve(PROJECT_ROOT, path)), { recursive: true })
  await Bun.write(resolve(PROJECT_ROOT, path), bytes)
  return { path, sha256 }
}

/** Always prices the exact five files and checks the approved inventory before any paid execution. */
export const priceCleanTypographyBenchmark = async (plan: BenchmarkPlan, cliEntry = 'src/cli/create-cli.ts') => {
  const admitted = await validateCleanTypographyBundleFile()
  if (plan.schemaVersion !== 1 || plan.category !== 'clean-typography' || plan.cases.length !== 5 || plan.caseCount !== 5 || plan.targetCount !== 22) throw new AppValidationError('Unexpected benchmark plan')
  for (const entry of plan.cases) {
    const actual = admitted.cases.find(item => item.id === entry.id)
    if (!actual || actual.input !== entry.input || actual.reference !== entry.reference) throw new AppValidationError(`Plan differs from admitted pair: ${entry.id}`)
    for (const [path, expected] of [[entry.input, entry.inputSha256], [entry.reference, entry.referenceSha256]]) {
      if (new Bun.CryptoHasher('sha256').update(await Bun.file(path!).arrayBuffer()).digest('hex') !== expected) throw new AppValidationError(`Plan source hash mismatch: ${entry.id}`)
    }
  }
  if (new Set(plan.cases.map(entry => entry.id)).size !== 5) throw new AppValidationError('Duplicate planned case')
  const expectedTargets = plan.quote.models.map(row => `${row.provider}/${row.model}`).sort()
  if (expectedTargets.length !== 22 || new Set(expectedTargets).size !== 22) throw new AppValidationError('Invalid quoted target inventory')
  const prices = []
  for (const entry of plan.cases) {
    const result = await runChild([process.execPath, cliEntry, 'extract', entry.input, '--all-providers', '--all-local', '--price', '--json'])
    if (result.exitCode !== 0) throw new AppInfrastructureError(`Price preflight failed for ${entry.id}: ${stripProjectRoot(result.stderr || result.stdout)}`)
    const terminal = result.stdout.trim().split('\n').map(line => JSON.parse(line)).find(row => row.type === 'result')
    const estimate = terminal?.data?.estimate ?? terminal?.result?.estimate
    if (!estimate || !Number.isFinite(estimate.totalEstimatedCostCents)) throw new AppValidationError(`Missing price estimate: ${entry.id}`)
    const targets = estimate.steps.map((row: PriceStep) => `${row.provider}/${row.model}`).sort()
    if (JSON.stringify(targets) !== JSON.stringify(expectedTargets)) throw new AppValidationError('Current model inventory differs from the approved batch')
    prices.push({ id: entry.id, estimatedCents: estimate.totalEstimatedCostCents })
  }
  return { mode: 'price', cases: prices, estimatedCents: prices.reduce((sum, row) => sum + row.estimatedCents, 0), targets: 22 }
}

const reservePriority = (model: PriceStep): number => {
  const outputTokens = model.provider === 'anthropic' ? 64_000 : model.model === 'gemini-4-argon' ? 32_768 : model.provider === 'openai' ? 16_384 : model.provider === 'grok' ? 4096 : 8192
  return (64_000 * (model.inputCostPer1MCents ?? 0) + outputTokens * (model.outputCostPer1MCents ?? 0)) / 1_000_000
}

/** Serial slots keep request reservations cumulative and preserve completed evidence on interruption. */
export const runCleanTypographyBenchmark = async (plan: BenchmarkPlan) => {
  const cliSnapshot = await createCleanTypographyCliSnapshot()
  const prices = await priceCleanTypographyBenchmark(plan, cliSnapshot.path)
  if (plan.approval?.budgetCents !== 500 || !plan.approval.evidence.trim()) throw new AppValidationError('This batch requires the recorded user approval for 500 cents')
  if (prices.estimatedCents > plan.approval.budgetCents) throw new AppValidationError('Fresh batch estimate exceeds approved budget')
  if (!await Bun.file(guardPath).exists()) throw new AppValidationError('Request-level spending guard is missing')
  const targets = plan.quote.models.filter(row => row.provider !== 'tesseract').sort((a, b) => reservePriority(b) - reservePriority(a) || `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`))
  const results = []
  for (const target of targets) for (const entry of plan.cases) {
    const directory = `${localRoot}/slots/${entry.id}/${safeStem(target.provider + '-' + target.model)}`
    const journalPath = `${directory}/dispatch.json`
    if (await Bun.file(journalPath).exists()) {
      const journal = await Bun.file(journalPath).json()
      if (journal.caseId !== entry.id || journal.provider !== target.provider || journal.model !== target.model || journal.inputSha256 !== entry.inputSha256 || journal.referenceSha256 !== entry.referenceSha256) throw new AppValidationError(`Prior slot identity changed: ${directory}`)
      if (journal.status === 'succeeded') {
        const manifest = Bun.file(`${directory}/manifest.json`)
        if (!journal.manifestSha256 || !await manifest.exists() || new Bun.CryptoHasher('sha256').update(await manifest.arrayBuffer()).digest('hex') !== journal.manifestSha256) throw new AppValidationError(`Completed slot artifact is missing or changed: ${directory}; preserve evidence before reconciliation`)
      }
      results.push({ ...journal, reused: true })
      writeCommandPayload((json({ case: entry.id, provider: target.provider, model: target.model, status: journal.status, reused: true }).trim()) + '\n')
      continue
    }
    await mkdir(directory, { recursive: true })
    const started = { caseId: entry.id, provider: target.provider, model: target.model, inputSha256: entry.inputSha256, referenceSha256: entry.referenceSha256, cliSnapshot, status: 'dispatch-started', startedAt: new Date().toISOString(), directory }
    const handle = await open(journalPath, 'wx')
    try { await handle.writeFile(json(started)); await handle.sync() } finally { await handle.close() }
    const output = await runChild(buildCleanTypographySlotCommand(entry.input, target.provider, target.model, directory, cliSnapshot.path),
      { ...process.env, AUTOSHOW_OCR_SPENDING_GUARD: '1', AUTOSHOW_OCR_SPENDING_LEDGER: ledgerPath,
      AUTOSHOW_OCR_SPENDING_CASE: entry.id, AUTOSHOW_OCR_SPENDING_PROVIDER: target.provider, AUTOSHOW_OCR_SPENDING_MODEL: target.model })
    let status = 'failed'
    const manifestPath = `${directory}/manifest.json`
    if (await Bun.file(manifestPath).exists()) {
      const manifest = await Bun.file(manifestPath).json()
      const provider = manifest.items?.[0]?.providers?.[0]
      if (provider?.status === 'succeeded' && provider.service === target.provider && provider.model === target.model) status = 'succeeded'
    }
    const manifestSha256 = await Bun.file(manifestPath).exists() ? new Bun.CryptoHasher('sha256').update(await Bun.file(manifestPath).arrayBuffer()).digest('hex') : null
    const finished = { ...started, status, exitCode: output.exitCode, manifestSha256, completedAt: new Date().toISOString() }
    await atomicJson(journalPath, finished)
    if (status !== 'succeeded') await Bun.write(`${directory}/failure.txt`, stripProjectRoot(output.stderr || output.stdout))
    if (output.exitCode === 2 && !await Bun.file(ledgerPath).exists()) throw new AppValidationError(`CLI rejected the slot before provider dispatch: ${directory}; reconcile the preserved attempt before continuing`)
    results.push(finished)
    const ledger = await Bun.file(ledgerPath).exists() ? await Bun.file(ledgerPath).json() : { receipts: [] }
    writeCommandPayload((json({ case: entry.id, provider: target.provider, model: target.model, status,
      accountedCents: ledger.receipts.reduce((sum: number, row: { chargedCents: number }) => sum + row.chargedCents, 0), receipts: ledger.receipts.length }).trim()) + '\n')
  }
  await atomicJson(`${localRoot}/execution.json`, { completedAt: new Date().toISOString(), budgetCents: 500, localReused: 5, cliSnapshot, hostedSlots: results })
  return { mode: 'run', hostedSucceeded: results.filter(row => row.status === 'succeeded').length, hostedSlots: results.length, localReused: 5, budgetCents: 500 }
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2)
    if (args.length > 1 || args.some(arg => !['--help', '--price', '--run'].includes(arg))) throw new AppUsageError('Usage: bun src/tools/ocr-clean-typography-benchmark.ts [--price | --run]')
    if (args[0] === '--help') writeCommandPayload(('Usage: bun src/tools/ocr-clean-typography-benchmark.ts [--price | --run]\nDefaults to read-only admission and native price preflight. --run requires recorded $5 user approval and the cumulative request guard; completed slots are preserved. No automatic failed-slot redispatch.') + '\n')
    else {
      const plan = await Bun.file(CLEAN_TYPOGRAPHY_PLAN).json() as BenchmarkPlan
      writeCommandPayload((json(args[0] === '--run' ? await runCleanTypographyBenchmark(plan) : await priceCleanTypographyBenchmark(plan))) + '\n')
    }
  } catch (error) {
    writeCommandPayload((stripProjectRoot(error instanceof Error ? error.message : String(error))) + '\n', 'stderr')
    process.exitCode = 1
  }
}
