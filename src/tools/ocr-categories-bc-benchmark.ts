import { mkdir, open, readdir, realpath, rename } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PROJECT_ROOT, stripProjectRoot } from '~/utils/project-root'

export const CATEGORIES_BC_ROOT = 'input/examples/document/ocr-categories-bc-run'
export const CATEGORIES_BC_PLAN = `${CATEGORIES_BC_ROOT}/execution-plan.json`
const guardPath = 'src/tools/ocr-categories-bc-spending-guard.ts'
export interface BenchmarkScope { root: string, kind: string, budgetCents: number, approvalEvidence: string, cases: number, pages: number, targets: number, imageFormat: string, guardPath: string, envPrefix: string, excludedTargets: string[], reconciliationKind: string, label: string, concurrency?: number, providerConcurrency?: Readonly<Record<string, number>>, modelConcurrency?: Readonly<Record<string, number>>, requestTimeoutMs?: number, geminiBackloaded?: boolean, deferZeroCostBudgetRejections?: boolean }
const bcScope: BenchmarkScope = { root: CATEGORIES_BC_ROOT, kind: 'ocr-categories-bc-execution-plan', budgetCents: 3000, approvalEvidence: 'User approved up to $30', cases: 13, pages: 29, targets: 22, imageFormat: 'png', guardPath, envPrefix: 'AUTOSHOW_OCR_BC', excludedTargets: [], reconciliationKind: 'ocr-categories-bc-manual-reconciliation', label: 'categories-bc' }
export const OCR_CATEGORY_D_BENCHMARK_SCOPE: Readonly<BenchmarkScope> = { root: 'input/examples/document/ocr-category-d-run', kind: 'ocr-category-d-execution-plan', budgetCents: 2500, approvalEvidence: 'User approved up to $25 for category 4', cases: 6, pages: 6, targets: 21, imageFormat: 'jpeg', guardPath: 'src/tools/ocr-category-d-spending-guard.ts', envPrefix: 'AUTOSHOW_OCR_D', excludedTargets: ['mistral/mistral-ocr-4-0'], reconciliationKind: 'ocr-category-d-manual-reconciliation', label: 'category-d' }
export const OCR_CATEGORIES_EFG_BENCHMARK_SCOPE: Readonly<BenchmarkScope> = { root: 'input/examples/document/ocr-categories-efg-run', kind: 'ocr-categories-efg-execution-plan', budgetCents: 3000, approvalEvidence: 'User approved up to $30 for categories 5–7', cases: 19, pages: 19, targets: 21, imageFormat: 'mixed', guardPath: 'src/tools/ocr-categories-efg-spending-guard.ts', envPrefix: 'AUTOSHOW_OCR_EFG', excludedTargets: ['mistral/mistral-ocr-4-0'], reconciliationKind: 'ocr-categories-efg-manual-reconciliation', label: 'categories-efg', concurrency: 12, providerConcurrency: { anthropic: 3, openai: 4, gemini: 4, grok: 3, deepinfra: 4, mistral: 3, tesseract: 2 }, modelConcurrency: { 'deepinfra/google/gemma-4-31B-it': 1 }, requestTimeoutMs: 900000, geminiBackloaded: false }
export const OCR_NEWSPAPER_EXPANSION_BENCHMARK_SCOPE: Readonly<BenchmarkScope> = {
  root: 'input/examples/document/ocr-newspaper-expansion', kind: 'ocr-newspaper-expansion-execution-plan', budgetCents: 3000,
  approvalEvidence: 'User approved up to $30 for the 12-input newspaper expansion', cases: 12, pages: 12, targets: 21,
  imageFormat: 'png', guardPath: 'src/tools/ocr-newspaper-expansion-spending-guard.ts', envPrefix: 'AUTOSHOW_OCR_NEWSPAPER',
  excludedTargets: ['mistral/mistral-ocr-4-0'], reconciliationKind: 'ocr-newspaper-expansion-manual-reconciliation', label: 'newspaper-expansion',
  concurrency: 12, providerConcurrency: { anthropic: 3, openai: 4, gemini: 4, grok: 3, deepinfra: 4, mistral: 3, tesseract: 2 },
  modelConcurrency: { 'deepinfra/google/gemma-4-31B-it': 1 }, requestTimeoutMs: 900000, geminiBackloaded: false,
  deferZeroCostBudgetRejections: true
}
const hash = (bytes: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const stem = (value: string): string => value.replace(/[^a-zA-Z0-9_.-]/g, '-')
const atomicJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(resolve(PROJECT_ROOT, path)), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await Bun.write(temporary, JSON.stringify(value, null, 2) + '\n')
  await rename(temporary, path)
}
interface Target { provider: string, model: string }
interface Page { id: string, caseId: string, input: string, inputSha256: string, width: number, height: number, pageNumber: number, format?: 'png' | 'jpg' }
interface Case { id: string, input: string, inputSha256: string, reference: string, referenceSha256: string, pages: Page[] }
export interface CategoriesBcPlan {
  schemaVersion: number, kind: string, approval: { status: string, budgetCents: number, evidence: string },
  cases: Case[], pages: Page[], targets: Target[], planningCostCents?: { firstPassReferenceLength: number, firstPassExpanded: number, firstPassEmpirical: number }
}
export interface CategoriesBcPriceStep extends Target {
  totalCostCents: number, promptTokens?: number, completionTokens?: number,
  inputCostPer1MCents?: number, outputCostPer1MCents?: number
}
interface Receipt { id: string, caseId: string, provider: string, model: string, createdAt: string, status: string, httpStatus?: number, chargedCents: number }
interface Journal extends Target {
  caseId: string, documentCaseId: string, inputSha256: string, referenceSha256: string,
  directory: string, startedAt: string, status: string, completedAt?: string, exitCode?: number, manifestSha256?: string | null,
  artifactHashes?: Array<{ path: string, sha256: string }>, [key: string]: unknown
}
const child = async (argv: string[], env: Record<string, string | undefined> = process.env) => {
  const process = Bun.spawn(argv, { cwd: PROJECT_ROOT, env: { ...env, AUTOSHOW_PROJECT_ROOT: PROJECT_ROOT }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  return { stdout, stderr, exitCode }
}
export const buildCategoriesBcSlotCommand = (input: string, target: Target, directory: string, cliEntry = 'src/cli/create-cli.ts', guardEntry = guardPath): string[] => [
  process.execPath, '--preload', `./${guardEntry}`, cliEntry, 'extract', input,
  '--provider', target.provider === 'tesseract' ? 'tesseract' : `${target.provider}=${target.model}`, '--output-dir', directory, '--json'
]
export const estimateCategoriesBcPlanningCost = (steps: readonly CategoriesBcPriceStep[]) => {
  const nativeCents = steps.reduce((sum, step) => sum + step.totalCostCents, 0)
  const structuredCents = steps.filter(step => ['openai', 'anthropic', 'gemini'].includes(step.provider)).reduce((sum, step) => sum + step.totalCostCents, 0)
  const openAIInputCents = steps.filter(step => step.provider === 'openai').reduce((sum, step) => sum + (step.promptTokens ?? 0) * (step.inputCostPer1MCents ?? 0) / 1e6, 0)
  const gemmaCorrectionCents = steps.filter(step => step.provider === 'deepinfra' && step.model === 'google/gemma-4-31B-it')
    .reduce((sum, step) => sum + ((step.promptTokens ?? 0) * Math.max(0, 20 - (step.inputCostPer1MCents ?? 0)) + (step.completionTokens ?? 0) * Math.max(0, 40 - (step.outputCostPer1MCents ?? 0))) / 1e6, 0)
  return { nativeCents, adjustedCents: nativeCents + 0.25 * openAIInputCents + gemmaCorrectionCents,
    twoRepairCents: nativeCents + 2 * structuredCents + 0.75 * openAIInputCents + gemmaCorrectionCents }
}
export const readCategoriesBcPlan = async (scope: Readonly<BenchmarkScope> = bcScope): Promise<{ plan: CategoriesBcPlan, sha256: string }> => {
  const bytes = new Uint8Array(await Bun.file(`${scope.root}/execution-plan.json`).arrayBuffer())
  const plan = JSON.parse(new TextDecoder().decode(bytes)) as CategoriesBcPlan
  if (plan.schemaVersion !== 1 || plan.kind !== scope.kind || plan.approval?.status !== 'approved'
    || plan.approval.budgetCents !== scope.budgetCents || plan.approval.evidence !== scope.approvalEvidence
    || plan.cases.length !== scope.cases || plan.pages.length !== scope.pages || plan.targets.length !== scope.targets
    || new Set(plan.cases.map(row => row.id)).size !== scope.cases || new Set(plan.pages.map(row => row.id)).size !== scope.pages
    || new Set(plan.targets.map(row => `${row.provider}/${row.model}`)).size !== scope.targets) throw new Error('Unexpected approved OCR benchmark plan')
  const local = plan.targets.filter(row => row.provider === 'tesseract')
  if (local.length !== 1 || local[0]!.model !== 'tesseract') throw new Error('Expected exactly one local Tesseract target')
  for (const entry of plan.cases) {
    for (const [path, expected] of [[entry.input, entry.inputSha256], [entry.reference, entry.referenceSha256]]) {
      if (!path || !expected || isAbsolute(path) || path.split('/').includes('..')) throw new Error('Nonportable source path')
      const actual = await realpath(resolve(PROJECT_ROOT, path))
      if (relative(PROJECT_ROOT, actual).startsWith('..') || hash(new Uint8Array(await Bun.file(actual).arrayBuffer())) !== expected) throw new Error(`Pinned source changed: ${entry.id}`)
    }
    const pages = plan.pages.filter(page => page.caseId === entry.id).sort((a, b) => a.pageNumber - b.pageNumber)
    if (JSON.stringify(pages) !== JSON.stringify([...entry.pages].sort((a, b) => a.pageNumber - b.pageNumber))) throw new Error(`Document/page mapping differs: ${entry.id}`)
    for (const [index, page] of pages.entries()) {
      if (page.pageNumber !== index + 1 || page.id !== `${entry.id}-page-${String(index + 1).padStart(2, '0')}` || isAbsolute(page.input) || page.input.split('/').includes('..')) throw new Error('Invalid page identity')
      const actual = await realpath(resolve(PROJECT_ROOT, page.input))
      if (relative(PROJECT_ROOT, actual).startsWith('..')) throw new Error('Page escaped project root')
      const imageBytes = new Uint8Array(await Bun.file(actual).arrayBuffer())
      const image = new Bun.Image(imageBytes), metadata = await image.metadata()
      const format = scope.imageFormat === 'mixed' ? page.format === 'jpg' ? 'jpeg' : page.format === 'png' ? 'png' : undefined : scope.imageFormat
      const declaration = scope.kind === 'ocr-categories-efg-execution-plan' && page.caseId === 'efg-rerun-1-page-declaration'
        && page.format === 'jpg' && page.width === 3923 && page.height === 4656
      if (!format || hash(imageBytes) !== page.inputSha256 || metadata.format !== format || metadata.width !== page.width || metadata.height !== page.height || !declaration && Math.max(page.width, page.height) > 4096 || !(await image.png().bytes()).length) throw new Error(`Invalid pinned page: ${page.id}`)
    }
  }
  return { plan, sha256: hash(bytes) }
}
const snapshotCli = async (scope: Readonly<BenchmarkScope>) => {
  const built = await Bun.build({ entrypoints: [resolve(PROJECT_ROOT, 'src/cli/create-cli.ts')], target: 'bun', format: 'esm' })
  if (!built.success || built.outputs.length !== 1) throw new Error('CLI snapshot build failed before provider dispatch')
  const bytes = new Uint8Array(await built.outputs[0]!.arrayBuffer()), sha256 = hash(bytes)
  const path = `output/benchmark-cache/ocr-${scope.label}-cli-${sha256}.js`
  await Bun.write(path, bytes)
  return { path, sha256 }
}
const snapshotGuard = async (scope: Readonly<BenchmarkScope>) => {
  const built = await Bun.build({ entrypoints: [resolve(PROJECT_ROOT, scope.guardPath)], target: 'bun', format: 'esm' })
  if (!built.success || built.outputs.length !== 1) throw new Error('Spending-guard snapshot build failed before provider dispatch')
  const bytes = new Uint8Array(await built.outputs[0]!.arrayBuffer()), sha256 = hash(bytes)
  const path = `output/benchmark-cache/ocr-${scope.label}-guard-${sha256}.js`
  await Bun.write(path, bytes)
  return { path, sha256 }
}
const pricePages = async (plan: CategoriesBcPlan, cliEntry: string, scope: Readonly<BenchmarkScope>) => {
  const expected = plan.targets.map(row => `${row.provider}/${row.model}`).sort()
  const results = await Promise.all(plan.pages.map(async page => {
    const result = await child([process.execPath, cliEntry, 'extract', page.input, '--all-providers', '--all-local', '--price', '--json'])
    if (result.exitCode) throw new Error(`Price preflight failed: ${page.id}: ${stripProjectRoot(result.stderr || result.stdout)}`)
    const row = result.stdout.trim().split('\n').map(line => JSON.parse(line)).find(item => item.type === 'result')?.data
    const configuredSteps = row?.estimate?.steps as CategoriesBcPriceStep[] | undefined
    const steps = configuredSteps?.filter(step => !scope.excludedTargets.includes(`${step.provider}/${step.model}`))
    if (row?.dryRun !== true || !steps || !configuredSteps || JSON.stringify(configuredSteps.map(step => `${step.provider}/${step.model}`).sort()) !== JSON.stringify([...expected, ...scope.excludedTargets].sort()) || JSON.stringify(steps.map(step => `${step.provider}/${step.model}`).sort()) !== JSON.stringify(expected)) throw new Error('Price target inventory differs from the approved batch')
    return { pageId: page.id, estimate: row.estimate, selectedSteps: steps, ...estimateCategoriesBcPlanningCost(steps) }
  }))
  return { mode: 'price', pages: results, ...estimateCategoriesBcPlanningCost(results.flatMap(row => row.selectedSteps)) }
}
const readLedger = async (ledgerPath: string): Promise<{ receipts: Receipt[], reconciliations?: Array<{ path: string, sha256: string }> }> => await Bun.file(ledgerPath).exists() ? await Bun.file(ledgerPath).json() : { receipts: [] }
const unreconciledHold = async (ledger: Awaited<ReturnType<typeof readLedger>>, planSha256: string, scope: Readonly<BenchmarkScope>): Promise<boolean> => {
  const covered = new Set<string>()
  for (const link of ledger.reconciliations ?? []) {
    const bytes = new Uint8Array(await Bun.file(link.path).arrayBuffer())
    if (hash(bytes) !== link.sha256) throw new Error('Recovery record checksum changed')
    const record = JSON.parse(new TextDecoder().decode(bytes))
    const receipt = ledger.receipts.find(row => row.id === record.receiptId)
    if (scope.kind === 'ocr-newspaper-expansion-execution-plan' && record.kind === 'ocr-newspaper-expansion-final-breach-accounting-review') {
      const { readNewspaperFinalBreachAccountingReview } = await import('./ocr-newspaper-expansion-spending-guard')
      const plan = await Bun.file(`${scope.root}/execution-plan.json`).json()
      const proof = await readNewspaperFinalBreachAccountingReview({ projectRoot: PROJECT_ROOT, reviewPath: link.path,
        reviewSha256: link.sha256, ledger, plan, planSha256 })
      covered.add(proof.receiptId)
      continue
    }
    if (record.kind !== scope.reconciliationKind || record.action !== 'retain-full-reservation-and-authorize-one-recovery-invocation'
      || record.planSha256 !== planSha256 || record.approvalBudgetCents !== scope.budgetCents || record.approvalEvidence !== scope.approvalEvidence
      || !receipt || !['ambiguous', 'breach'].includes(receipt.status)
      || (receipt.httpStatus === undefined ? record.transportReview !== 'socket-closed-no-reported-usage'
        && !(['ocr-categories-efg-execution-plan', 'ocr-newspaper-expansion-execution-plan'].includes(scope.kind) && record.transportReview === 'timeout-no-reported-usage') : ![200, 503].includes(receipt.httpStatus))
      || receipt.chargedCents !== record.chargedCents
      || receipt.status === 'breach' && (receipt.provider !== 'grok' || record.reviewedPolicy !== 'grok-visible-4096-plus-unmeasured-reasoning-32768')) throw new Error('Invalid retained-reservation recovery record')
    covered.add(receipt.id)
  }
  return ledger.receipts.some(row => ['breach', 'ambiguous'].includes(row.status) && !covered.has(row.id))
}
const inventory = async (directory: string): Promise<Array<{ path: string, sha256: string }>> => {
  const result: Array<{ path: string, sha256: string }> = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) result.push(...await inventory(path))
    else if (entry.isFile() && entry.name !== 'dispatch.json') result.push({ path, sha256: hash(new Uint8Array(await Bun.file(path).arrayBuffer())) })
  }
  return result
}
const pause = async (ms: number) => await new Promise<void>(resolve => setTimeout(resolve, ms))
/** Only a pre-dispatch reservation rejection can wait for other requests to settle. */
export const shouldDeferOcrBudgetReservation = (
  failure: string, slotReceipts: ReadonlyArray<{ status: string, chargedCents: number }>, ledgerReceipts: ReadonlyArray<{ status: string }>
): boolean => /request reservation [\d.]+ cents exceeds the remaining cumulative approval/.test(failure)
  && slotReceipts.every(receipt => receipt.status === 'rejected' && receipt.chargedCents === 0)
  && ledgerReceipts.some(receipt => receipt.status === 'reserved')
export const newspaperFirstPassWithinBudget = (costs: CategoriesBcPlan['planningCostCents'], budgetCents: number): boolean =>
  costs !== undefined && Number.isFinite(budgetCents) && budgetCents > 0
  && [costs.firstPassReferenceLength, costs.firstPassExpanded, costs.firstPassEmpirical]
    .every(value => Number.isFinite(value) && value > 0 && value <= budgetCents)
/** Reserve lanes synchronously before journal I/O, so workers cannot race past provider limits. */
export const createOcrBenchmarkLanes = (concurrency: number, providerConcurrency: Readonly<Record<string, number>> = {}, modelConcurrency: Readonly<Record<string, number>> = {}) => {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 12
    || [...Object.values(providerConcurrency), ...Object.values(modelConcurrency)].some(value => !Number.isSafeInteger(value) || value < 1 || value > concurrency)) throw new Error('Invalid benchmark concurrency')
  const activeByProvider = new Map<string, number>(), activeByModel = new Map<string, number>(), pendingGroups = new Set<string>(), nextGemini = new Map<string, number>()
  let active = 0, peak = 0
  const group = (target: Target): string | undefined => target.provider !== 'gemini' ? undefined
    : ['gemini-3.5-flash', 'gemini-3.6-flash'].includes(target.model) ? 'gemini-flash-shared' : target.model
  const canStart = (target: Target, now = Date.now()): boolean => {
    const alias = group(target)
    return active < concurrency && (activeByProvider.get(target.provider) ?? 0) < (providerConcurrency[target.provider] ?? concurrency)
      && (activeByModel.get(`${target.provider}/${target.model}`) ?? 0) < (modelConcurrency[`${target.provider}/${target.model}`] ?? concurrency)
      && (!alias || !pendingGroups.has(alias) && (nextGemini.get(alias) ?? 0) <= now)
  }
  return { canStart, state: () => ({ active, peak, activeByProvider: Object.fromEntries(activeByProvider), activeByModel: Object.fromEntries(activeByModel) }),
    acquire(target: Target, now = Date.now()) {
      if (!canStart(target, now)) throw new Error('Benchmark lane is unavailable')
      const alias = group(target)
      active++; peak = Math.max(peak, active)
      activeByProvider.set(target.provider, (activeByProvider.get(target.provider) ?? 0) + 1)
      activeByModel.set(`${target.provider}/${target.model}`, (activeByModel.get(`${target.provider}/${target.model}`) ?? 0) + 1)
      if (alias) pendingGroups.add(alias)
      let committed = false, released = false
      return { commit(at = Date.now()) {
        if (released || committed) throw new Error('Benchmark lane cannot be started twice')
        committed = true
        if (alias) { nextGemini.set(alias, at + 15_500); pendingGroups.delete(alias) }
      }, release() {
        if (released) return
        released = true; active--
        activeByProvider.set(target.provider, activeByProvider.get(target.provider)! - 1)
        activeByModel.set(`${target.provider}/${target.model}`, activeByModel.get(`${target.provider}/${target.model}`)! - 1)
        if (alias && !committed) pendingGroups.delete(alias)
      } }
    } }
}
/** Slots are durable; only explicit zero-cost per-minute rejections receive a bounded delayed retry. */
export const runCategoriesBcBenchmark = async (plan: CategoriesBcPlan, planSha256: string, cliSnapshot: { path: string, sha256: string }, scope: Readonly<BenchmarkScope> = bcScope) => {
  const ledgerPath = `${scope.root}/spending-ledger.json`
  const guardSnapshot = await snapshotGuard(scope)
  const jobs = plan.pages.flatMap(page => plan.targets.map(target => ({ page, target, retries: 0, budgetDeferrals: 0, readyAt: 0 })))
    .sort((a, b) => scope.geminiBackloaded === false ? 0 : Number(a.target.provider === 'gemini') - Number(b.target.provider === 'gemini'))
  const results = new Map<string, Journal>(), concurrency = scope.concurrency ?? 3
  const lanes = createOcrBenchmarkLanes(concurrency, scope.providerConcurrency, scope.modelConcurrency)
  const key = (page: Page, target: Target) => `${page.id}/${target.provider}/${target.model}`
  let blockedReason: string | null = null, writes = Promise.resolve()
  const persist = () => {
    writes = writes.then(async () => {
      const ledger = await readLedger(ledgerPath)
      await atomicJson(`${scope.root}/execution.json`, { updatedAt: new Date().toISOString(), planSha256, cliSnapshot, guardSnapshot,
        budgetCents: scope.budgetCents, concurrency, modelConcurrency: scope.modelConcurrency, requestTimeoutMs: scope.requestTimeoutMs, lanes: lanes.state(), status: blockedReason ? 'blocked-retained-evidence' : jobs.length ? 'running' : 'finishing', blockedReason,
        completedSlots: results.size, intendedSlots: plan.pages.length * plan.targets.length, pendingSlots: jobs.length,
        accountedCents: ledger.receipts.reduce((sum, row) => sum + row.chargedCents, 0), slots: [...results.values()] })
    })
    return writes
  }
  const worker = async () => {
    while (jobs.length && !blockedReason) {
      const now = Date.now(), index = jobs.findIndex(job => job.readyAt <= now && lanes.canStart(job.target, now))
      if (index < 0) { await pause(500); continue }
      const job = jobs.splice(index, 1)[0]!, { page, target } = job
      const lane = lanes.acquire(target, now)
      try {
      const directory = `${scope.root}/slots/${page.id}/${stem(`${target.provider}-${target.model}`)}`, path = `${directory}/dispatch.json`
      if (await Bun.file(path).exists()) {
        const prior = await Bun.file(path).json() as Journal
        const parent = plan.cases.find(entry => entry.id === page.caseId)!
        if (prior.caseId !== page.id || prior.documentCaseId !== page.caseId || prior.referenceSha256 !== parent.referenceSha256
          || prior.directory !== directory || prior.provider !== target.provider || prior.model !== target.model || prior.inputSha256 !== page.inputSha256) throw new Error(`Prior slot identity differs: ${path}`)
        if (prior.status === 'dispatch-started') { blockedReason = `Interrupted slot requires reconciliation: ${path}`; jobs.unshift(job); break }
        if (!['succeeded', 'failed'].includes(prior.status) || !prior.artifactHashes?.length
          || prior.status === 'succeeded' && (!prior.manifestSha256 || !prior.artifactHashes.some(row => row.path === `${directory}/manifest.json` && row.sha256 === prior.manifestSha256))) throw new Error(`Prior slot lacks pinned completion evidence: ${path}`)
        for (const artifact of prior.artifactHashes ?? []) if (hash(new Uint8Array(await Bun.file(artifact.path).arrayBuffer())) !== artifact.sha256) throw new Error(`Saved artifact changed: ${artifact.path}`)
        results.set(key(page, target), { ...prior, reused: true }); continue
      }
      lane.commit()
      const entry = plan.cases.find(entry => entry.id === page.caseId)!
      await mkdir(directory, { recursive: true })
      const journal: Journal = { caseId: page.id, documentCaseId: page.caseId, provider: target.provider, model: target.model,
        inputSha256: page.inputSha256, referenceSha256: entry.referenceSha256, directory, startedAt: new Date().toISOString(), status: 'dispatch-started', cliSnapshot, guardSnapshot }
      const handle = await open(path, 'wx')
      try { await handle.writeFile(JSON.stringify(journal, null, 2) + '\n'); await handle.sync() } finally { await handle.close() }
      const output = await child(buildCategoriesBcSlotCommand(page.input, target, directory, cliSnapshot.path, guardSnapshot.path), {
        ...process.env, ...(scope.requestTimeoutMs === undefined ? {} : { AUTOSHOW_OCR_PAGE_REQUEST_TIMEOUT_MS: String(scope.requestTimeoutMs) }), AUTOSHOW_OCR_SPENDING_GUARD: undefined, AUTOSHOW_OCR_BC_GUARD: undefined, AUTOSHOW_OCR_D_GUARD: undefined, AUTOSHOW_OCR_EFG_GUARD: undefined, AUTOSHOW_OCR_NEWSPAPER_GUARD: undefined,
        [`${scope.envPrefix}_GUARD`]: target.provider === 'tesseract' ? undefined : '1',
        [`${scope.envPrefix}_PLAN`]: `${scope.root}/execution-plan.json`, [`${scope.envPrefix}_PLAN_SHA256`]: planSha256,
        [`${scope.envPrefix}_LEDGER`]: ledgerPath, [`${scope.envPrefix}_PAGE`]: page.id, [`${scope.envPrefix}_PROVIDER`]: target.provider, [`${scope.envPrefix}_MODEL`]: target.model
      })
      const manifestPath = `${directory}/manifest.json`, manifestExists = await Bun.file(manifestPath).exists()
      const manifest = manifestExists ? await Bun.file(manifestPath).json() : undefined
      const provider = manifest?.items?.[0]?.providers?.[0]
      journal.status = output.exitCode === 0 && provider?.status === 'succeeded' && provider.service === target.provider && provider.model === target.model ? 'succeeded' : 'failed'
      journal.completedAt = new Date().toISOString(); journal.exitCode = output.exitCode
      journal.manifestSha256 = manifestExists ? hash(new Uint8Array(await Bun.file(manifestPath).arrayBuffer())) : null
      if (journal.status !== 'succeeded') await Bun.write(`${directory}/failure.txt`, stripProjectRoot(output.stderr || output.stdout))
      journal.artifactHashes = await inventory(directory)
      await atomicJson(path, journal)
      results.set(key(page, target), journal)
      const ledger = await readLedger(ledgerPath), receipts = ledger.receipts.filter(row => row.caseId === page.id && row.provider === target.provider && row.model === target.model && row.createdAt >= journal.startedAt)
      if (await unreconciledHold(ledger, planSha256, scope)) blockedReason = 'Uncertain provider charge or allowance breach; retain all reservations and reconcile before resuming.'
      if (scope.deferZeroCostBudgetRejections && receipts.some(row => row.status === 'reserved')) blockedReason = 'Completed process retained an in-flight reservation; preserve evidence and reconcile before resuming.'
      const failure = output.stderr || output.stdout
      if (!blockedReason && scope.deferZeroCostBudgetRejections && journal.status === 'failed' && job.budgetDeferrals < 900
        && shouldDeferOcrBudgetReservation(failure, receipts, ledger.receipts)) {
        const archive = `${scope.root}/zero-dispatch-reservation-deferrals/${page.id}/${stem(`${target.provider}-${target.model}`)}/${randomUUID()}`
        await mkdir(dirname(archive), { recursive: true }); await rename(directory, archive)
        results.delete(key(page, target)); jobs.push({ ...job, budgetDeferrals: job.budgetDeferrals + 1, readyAt: Date.now() + 2_000 })
        console.log(JSON.stringify({ page: page.id, provider: target.provider, model: target.model, status: 'waiting-for-in-flight-reservations', budgetDeferrals: job.budgetDeferrals + 1 }))
        await persist(); continue
      }
      if (!blockedReason && journal.status === 'failed' && job.retries < 2 && receipts.length > 0
        && receipts.every(row => row.status === 'rejected' && row.httpStatus === 429 && row.chargedCents === 0)
        && !/limit:\s*0\b/.test(failure) && /limit:\s*[1-9]|per.?minute/i.test(failure)) {
        const archive = `${scope.root}/prior-attempts/${page.id}/${stem(`${target.provider}-${target.model}`)}/${randomUUID()}`
        await mkdir(dirname(archive), { recursive: true }); await rename(directory, archive)
        results.delete(key(page, target)); jobs.push({ ...job, retries: job.retries + 1, readyAt: Date.now() + 65_000 })
      }
      console.log(JSON.stringify({ page: page.id, provider: target.provider, model: target.model, status: journal.status,
        completed: results.size, remaining: jobs.length, accountedCents: ledger.receipts.reduce((sum, row) => sum + row.chargedCents, 0), blockedReason }))
      await persist()
      } catch (error) {
        blockedReason = error instanceof Error ? stripProjectRoot(error.message) : String(error)
        if (!results.has(key(page, target))) jobs.unshift(job)
        await persist()
      } finally { lane.release() }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker())); await persist()
  const ledger = await readLedger(ledgerPath), summary = { status: blockedReason ? 'blocked-retained-evidence' : 'completed', blockedReason,
    completedAt: new Date().toISOString(), planSha256, cliSnapshot, guardSnapshot, budgetCents: scope.budgetCents, concurrency, lanes: lanes.state(), intendedSlots: plan.pages.length * plan.targets.length,
    completedSlots: results.size, pendingSlots: jobs.length, successfulSlots: [...results.values()].filter(row => row.status === 'succeeded').length,
    failedSlots: [...results.values()].filter(row => row.status === 'failed').length,
    accountedCents: ledger.receipts.reduce((sum, row) => sum + row.chargedCents, 0), slots: [...results.values()] }
  await atomicJson(`${scope.root}/execution.json`, summary)
  return summary
}
export const categoriesBcBenchmarkMain = async (scope: Readonly<BenchmarkScope> = bcScope): Promise<void> => {
  try {
    const args = Bun.argv.slice(2)
    if (args.length > 1 || args.some(arg => !['--help', '--price', '--run'].includes(arg))) throw new Error(`Usage: bun src/tools/ocr-${scope.label}-benchmark.ts [--price | --run]`)
    if (args[0] === '--help') { console.log(`Price or execute the exact approved ${scope.cases}-file / ${scope.pages}-page / ${scope.targets}-target OCR batch. Default is price-only. --run requires recorded USD ${scope.budgetCents / 100} approval and the cumulative guard. At most ${scope.concurrency ?? 3} concurrent jobs. Existing journals are preserved and reused.`); process.exit(0) }
    const { plan, sha256 } = await readCategoriesBcPlan(scope), cliSnapshot = await snapshotCli(scope)
    const prices = await pricePages(plan, cliSnapshot.path, scope)
    await atomicJson(`${scope.root}/price-preflight.json`, { generatedAt: new Date().toISOString(), planSha256: sha256, cliSnapshot, ...prices })
    if (args[0] !== '--run') console.log(JSON.stringify({ ...prices,
      pages: prices.pages.map(({ pageId, nativeCents, adjustedCents, twoRepairCents }) => ({ pageId, nativeCents, adjustedCents, twoRepairCents })) }, null, 2))
    else {
      if (prices.twoRepairCents > plan.approval.budgetCents) throw new Error(`Fresh retry planning exceeds the approved USD ${scope.budgetCents / 100} ceiling; no dispatch`)
      if (scope.kind === 'ocr-newspaper-expansion-execution-plan'
        && !newspaperFirstPassWithinBudget(plan.planningCostCents, plan.approval.budgetCents)) throw new Error('Newspaper reference-length planning is absent or exceeds approval; no dispatch')
      const summary = await runCategoriesBcBenchmark(plan, sha256, cliSnapshot, scope)
      console.log(JSON.stringify({ ...summary, slots: undefined }, null, 2))
    }
  } catch (error) { console.error(error instanceof Error ? stripProjectRoot(error.message) : String(error)); process.exitCode = 1 }
}

if (import.meta.main) await categoriesBcBenchmarkMain()
