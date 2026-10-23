import { AppValidationError, AppUsageError, AppInfrastructureError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { mkdir, readdir, realpath, rename } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import * as v from 'valibot'
import { PROJECT_ROOT } from '~/utils/project-root'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'

const localRoot = 'input/examples/document/ocr-clean-typography'
const defaultPlan = 'docs/benchmarks/text/ocr/clean-typography-additions-plan.json'
const defaultLedger = `${localRoot}/spending-ledger.json`
const hash = (bytes: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const text = v.pipe(v.string(), v.nonEmpty())
const amount = v.pipe(v.number(), v.minValue(0), v.finite())
const targetSchema = v.object({ provider: text, model: text })
const entrySchema = v.object({
  id: v.pipe(v.string(), v.regex(/^clean-typography-[a-z-]+$/)), input: text, reference: text,
  inputSha256: digest, referenceSha256: digest, annotationURL: text, sourceURL: text, sourceRevision: text,
  runDir: text, localPilot: v.object({ directory: text }),
  rights: v.object({ license: text, notice: text, redistributable: v.boolean() })
})
const planSchema = v.object({
  schemaVersion: v.literal(1), category: v.literal('clean-typography'), caseCount: v.literal(5),
  targetCount: v.pipe(v.number(), v.integer(), v.minValue(2)), bundle: text, bundleSha256: digest,
  quote: v.object({ models: v.array(targetSchema) }), cases: v.pipe(v.array(entrySchema), v.length(5))
})
const receiptSchema = v.object({
  id: text, invocationId: text, caseId: text, provider: text, model: text, inputSha256: digest,
  reservedCents: amount, chargedCents: amount, createdAt: text,
  status: v.picklist(['reserved', 'settled', 'rejected', 'ambiguous', 'breach']),
  costBasis: v.optional(v.picklist(['conservative-upper-bound', 'provider-usage-at-reviewed-rates'])),
  costNote: v.optional(v.string()),
  httpStatus: v.optional(v.pipe(v.number(), v.integer(), v.minValue(100), v.maxValue(599)))
})
const ledgerSchema = v.object({
  schemaVersion: v.literal(1), kind: v.literal('ocr-clean-typography-spending-ledger'),
  budgetCents: amount, receipts: v.array(receiptSchema)
})
const journalSchema = v.object({
  caseId: text, provider: text, model: text, inputSha256: digest, referenceSha256: digest,
  status: v.picklist(['succeeded', 'failed', 'dispatch-started']), directory: text, startedAt: text,
  manifestSha256: v.optional(v.nullable(digest))
})
type Receipt = v.InferOutput<typeof receiptSchema>
type Entry = v.InferOutput<typeof entrySchema>
interface ProviderState {
  service: string, model: string, local: boolean, artifactDir: string, status: string, attempts: number,
  options: Record<string, unknown>, metadata: Record<string, unknown>, error?: Record<string, unknown>
}
interface SavedProvider { state: ProviderState, manifest: Record<string, unknown>, manifestSha256: string, directory: string, sourceArtifactDirectory: string, result: unknown, resultBytes: Uint8Array | null }
export interface CleanTypographyReportOptions {
  projectRoot?: string
  planPath?: string
  ledgerPath?: string
  /** Unit fixtures may supply a local consensus-command implementation. The CLI uses the skill entry point. */
  runConsensus?: (argv: readonly string[], caseId: string) => Promise<void>
}

const portable = (path: string): void => {
  if (isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new AppValidationError('Expected a normalized project-relative artifact path')
}
const safeStem = (value: string): string => value.replace(/[^a-zA-Z0-9_.-]/g, '-')
/** A flat directory is required by the consensus loader; model slashes are encoded, never directory separators. */
export const cleanTypographyReportArtifactDir = (provider: string, model: string): string => `providers/${encodeURIComponent(`${provider}-${model}`)}`

export const summarizeCleanTypographyReceipts = (receipts: readonly Receipt[]) => ({
  requestCount: receipts.length,
  providerReportedCents: receipts.filter(row => row.status === 'settled' && row.costBasis !== 'conservative-upper-bound').reduce((sum, row) => sum + row.chargedCents, 0),
  settledConservativeCents: receipts.filter(row => row.status === 'settled' && row.costBasis === 'conservative-upper-bound').reduce((sum, row) => sum + row.chargedCents, 0),
  settledAccountedCents: receipts.filter(row => row.status === 'settled').reduce((sum, row) => sum + row.chargedCents, 0),
  heldReservationCents: receipts.filter(row => ['reserved', 'ambiguous', 'breach'].includes(row.status)).reduce((sum, row) => sum + row.chargedCents, 0),
  accountedCents: receipts.reduce((sum, row) => sum + row.chargedCents, 0),
  rejectedRequests: receipts.filter(row => row.status === 'rejected').length,
  unresolvedRequests: receipts.filter(row => ['reserved', 'ambiguous', 'breach'].includes(row.status)).length,
  costPolicy: 'Provider-reported usage valued at reviewed rates, settled conservative upper bounds, and unresolved held reservations are separate. Price rows include all settled retry costs and retained reservations once; any conservative component makes the price an upper bound. Accounted cents are not invoice-reconciled charges.'
})

const numericMetadata = (metadata: unknown): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  if (record(metadata)) for (const key of ['processingTime', 'tokenEstimate', 'totalPages', 'ocrPages', 'textPages']) {
    const value = metadata[key]
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) result[key] = value
  }
  return result
}

const safeFailure = (receipts: readonly Receipt[], pending: boolean): Record<string, unknown> => {
  const last = receipts.at(-1)
  const status = last?.httpStatus
  const code = pending ? 'SLOT_PENDING' : status === 401 || status === 403 ? 'AUTHENTICATION_REJECTED'
    : status === 429 ? 'RATE_LIMITED' : status === 404 ? 'MODEL_OR_ENDPOINT_UNAVAILABLE'
      : last && ['reserved', 'ambiguous', 'breach'].includes(last.status) ? 'UNRESOLVED_PROVIDER_OUTCOME' : 'PROVIDER_RUN_FAILED'
  return { code, ...(status === undefined ? {} : { httpStatus: status }), message: pending
    ? 'No completed saved provider slot is available.' : 'The saved provider slot did not produce a successful OCR result; raw error evidence remains private.' }
}

const prepareReports = async (options: CleanTypographyReportOptions) => {
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const within = (path: string): string => { portable(path); return resolve(root, path) }
  const existing = async (path: string): Promise<string> => {
    const absolute = await realpath(within(path)).catch(() => { throw new AppValidationError(`Missing local artifact: ${path}`) })
    const rel = relative(root, absolute)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new AppValidationError('Source artifact escapes project root')
    return absolute
  }
  const read = async (path: string): Promise<Uint8Array> => new Uint8Array(await Bun.file(await existing(path)).arrayBuffer())
  const readJson = async (path: string): Promise<unknown> => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read(path))) as unknown
  const plan = v.parse(planSchema, await readJson(options.planPath ?? defaultPlan))
  if (new Set(plan.cases.map(entry => entry.id)).size !== 5) throw new AppValidationError('Duplicate planned case ID')
  const targets = plan.quote.models
  if (targets.length !== plan.targetCount || new Set(targets.map(row => `${row.provider}/${row.model}`)).size !== targets.length
    || targets.filter(row => row.provider === 'tesseract' && row.model === 'tesseract').length !== 1
    || targets.some(row => row.provider === 'tesseract' && row.model !== 'tesseract')) throw new AppValidationError('Invalid quoted target inventory')
  const bundleBytes = await read(plan.bundle)
  if (hash(bundleBytes) !== plan.bundleSha256) throw new AppValidationError('Prepared bundle hash changed')
  const bundle: unknown = JSON.parse(new TextDecoder().decode(bundleBytes))
  if (!record(bundle) || !Array.isArray(bundle['cases']) || bundle['cases'].length !== 5) throw new AppValidationError('Invalid prepared input bundle')
  const ledgerPath = options.ledgerPath ?? defaultLedger
  const ledger = v.parse(ledgerSchema, await readJson(ledgerPath))
  if (new Set(ledger.receipts.map(row => row.id)).size !== ledger.receipts.length) throw new AppValidationError('Duplicate spending receipt ID')
  for (const receipt of ledger.receipts) {
    const source = plan.cases.find(entry => entry.id === receipt.caseId)
    if (!source || source.inputSha256 !== receipt.inputSha256 || !targets.some(target => target.provider === receipt.provider && target.model === receipt.model)
      || receipt.status === 'rejected' && receipt.chargedCents !== 0
      || ['reserved', 'ambiguous'].includes(receipt.status) && receipt.chargedCents !== receipt.reservedCents
      || !Number.isFinite(Date.parse(receipt.createdAt))) throw new AppValidationError('Spending receipt does not match the declared batch')
  }
  const loadSaved = async (directory: string, provider: string, model: string, entry: Entry, manifestSha256?: string): Promise<SavedProvider> => {
    const bytes = await read(`${directory}/manifest.json`)
    if (manifestSha256 && hash(bytes) !== manifestSha256) throw new AppValidationError(`Saved manifest hash changed: ${entry.id}/${provider}/${model}`)
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!record(value) || value['command'] !== 'extract' || value['scope'] !== 'single' || !Array.isArray(value['items']) || value['items'].length !== 1) throw new AppValidationError('Invalid saved OCR manifest')
    const item: unknown = value['items'][0]
    if (!record(item) || item['extractRoute'] !== 'document' || !Array.isArray(item['providers']) || item['providers'].length !== 1 || !record(item['metadata'])) throw new AppValidationError('Invalid saved OCR item')
    const source = item['metadata']['source']
    if (!record(source) || source['filePath'] !== entry.input) throw new AppValidationError('Saved manifest source input differs from planned pair')
    const state: unknown = item['providers'][0]
    if (!record(state) || state['service'] !== provider || state['model'] !== model || typeof state['artifactDir'] !== 'string' || !record(state['metadata'])) throw new AppValidationError('Saved provider identity differs from slot')
    const artifact = state['artifactDir'] === '.' ? directory : `${directory}/${state['artifactDir']}`
    await existing(artifact)
    let resultBytes: Uint8Array | null = null
    if (await Bun.file(within(`${artifact}/result.json`)).exists()) resultBytes = await read(`${artifact}/result.json`)
    const inline = state['result']
    const sidecar: unknown = resultBytes ? JSON.parse(new TextDecoder().decode(resultBytes)) : undefined
    if (record(inline) && sidecar !== undefined && !isDeepStrictEqual(inline, sidecar)) throw new AppValidationError('Saved inline and sidecar OCR results disagree')
    const result = sidecar ?? inline
    if (state['status'] === 'succeeded' && (!record(result) || typeof result['text'] !== 'string' && !Array.isArray(result['pages']))) throw new AppValidationError('Successful slot is missing an OCR result artifact')
    return { directory, manifest: value, manifestSha256: hash(bytes), sourceArtifactDirectory: artifact, result, resultBytes,
      state: { service: provider, model, local: provider === 'tesseract', artifactDir: cleanTypographyReportArtifactDir(provider, model),
        status: String(state['status']), attempts: typeof state['attempts'] === 'number' ? state['attempts'] : 1,
        options: {}, metadata: numericMetadata(state['metadata']) } }
  }
  const prepared = []
  for (const entry of plan.cases) {
    if (entry.runDir !== `docs/benchmarks/text/ocr/${entry.id}` || entry.localPilot.directory !== `${localRoot}/local-pilot/${entry.id}`) throw new AppValidationError('Case destination differs from clean-typography scope')
    const pair = bundle['cases'].find((item: unknown) => record(item) && item['id'] === entry.id)
    if (!record(pair) || ['input', 'reference', 'inputSha256', 'referenceSha256'].some(key => pair[key] !== entry[key as keyof Entry])) throw new AppValidationError('Plan differs from immutable prepared input pair')
    if (hash(await read(entry.input)) !== entry.inputSha256 || hash(await read(entry.reference)) !== entry.referenceSha256) throw new AppValidationError('Input or publisher reference hash changed')
    const publicManifest = await readJson(`${entry.runDir}/manifest.json`)
    const source = record(publicManifest) && record(publicManifest['source']) ? publicManifest['source'] : undefined
    const pilotPin = source?.['localPilotManifestSha256']
    if (typeof pilotPin !== 'string' || !/^[a-f0-9]{64}$/.test(pilotPin)) throw new AppValidationError('Original local pilot manifest pin is missing')
    const pilot = await loadSaved(entry.localPilot.directory, 'tesseract', 'tesseract', entry, pilotPin)
    if (pilot.state.status !== 'succeeded') throw new AppValidationError('Saved local pilot is not successful')
    const providers: Array<{ state: ProviderState, saved: SavedProvider | null, receipts: Receipt[] }> = []
    for (const target of targets) {
      if (target.provider === 'tesseract') {
        providers.push({ state: { ...pilot.state, metadata: { ...pilot.state.metadata, reusedFrom: entry.localPilot.directory, originalManifestSha256: pilot.manifestSha256 } }, saved: pilot, receipts: [] })
        continue
      }
      const directory = `${localRoot}/slots/${entry.id}/${safeStem(`${target.provider}-${target.model}`)}`
      const dispatchPath = `${directory}/dispatch.json`
      const receipts = ledger.receipts.filter(row => row.caseId === entry.id && row.provider === target.provider && row.model === target.model)
      let saved: SavedProvider | null = null
      let status = 'missing'
      let currentReceipts: Receipt[] = []
      const hasJournal = await Bun.file(within(dispatchPath)).exists()
      if (hasJournal) {
        const journal = v.parse(journalSchema, await readJson(dispatchPath))
        if (journal.caseId !== entry.id || journal.provider !== target.provider || journal.model !== target.model || journal.inputSha256 !== entry.inputSha256
          || journal.referenceSha256 !== entry.referenceSha256 || journal.directory !== directory) throw new AppValidationError('Dispatch journal identity differs from the planned pair')
        const started = Date.parse(journal.startedAt)
        if (!Number.isFinite(started)) throw new AppValidationError('Dispatch journal start time is invalid')
        currentReceipts = receipts.filter(receipt => Date.parse(receipt.createdAt) >= started)
        status = journal.status === 'dispatch-started' ? 'running' : journal.status
        if (journal.manifestSha256) {
          saved = await loadSaved(directory, target.provider, target.model, entry, journal.manifestSha256)
          if (saved.state.status !== journal.status) throw new AppValidationError('Dispatch and saved provider completion disagree')
        } else if (status === 'succeeded' || await Bun.file(within(`${directory}/manifest.json`)).exists()) throw new AppValidationError('Saved slot manifest is not journal-pinned')
        if (status === 'succeeded' && !currentReceipts.some(receipt => receipt.status !== 'rejected')) throw new AppValidationError('Successful saved slot has no admitted current-attempt spending receipt')
      }
      const accounting = summarizeCleanTypographyReceipts(receipts)
      const state: ProviderState = { service: target.provider, model: target.model, local: false,
        artifactDir: cleanTypographyReportArtifactDir(target.provider, target.model), status, attempts: saved?.state.attempts ?? (hasJournal ? 1 : 0), options: {},
        metadata: { ...(saved?.state.metadata ?? {}), evidenceDirectory: directory, dispatchJournal: dispatchPath,
          ...(saved ? { originalManifestSha256: saved.manifestSha256 } : {}), spending: accounting },
        ...(status === 'succeeded' ? {} : { error: safeFailure(currentReceipts, status === 'missing' || status === 'running') }) }
      providers.push({ state, saved, receipts })
    }
    const caseReceipts = ledger.receipts.filter(row => row.caseId === entry.id)
    const spending = summarizeCleanTypographyReceipts(caseReceipts)
    const successfulHosted = providers.filter(row => !row.state.local && row.state.status === 'succeeded').length
    const pending = providers.filter(row => ['missing', 'running'].includes(row.state.status)).length
    const failed = providers.filter(row => row.state.status === 'failed').length
    const coverage = { status: pending ? 'in-progress' : failed ? 'partial-provider-failures' : 'complete', configuredModels: targets.length,
      attemptedModels: providers.filter(row => row.state.status !== 'missing').length, successfulModels: successfulHosted + 1,
      successfulLocalModels: 1, successfulHostedModels: successfulHosted, reusedLocalModels: 1,
      failedHostedModels: failed, pendingHostedModels: pending, hostedRequests: caseReceipts.length, spending,
      qualityCoverage: 'Only successful saved OCR outputs receive quality measurements; failed or pending slots have no OCR quality score.' }
    const reference = { kind: 'publisher-canonical', path: entry.reference, sha256: entry.referenceSha256,
      sourceUrl: entry.annotationURL, sourceRevision: entry.sourceRevision,
      description: 'Immutable publisher gold from the prepared source bundle; provider output and provider agreement did not author this reference.' }
    const timingSteps = providers.flatMap(({ state }) => typeof state.metadata['processingTime'] === 'number' && state.status === 'succeeded'
      ? [{ step: 'extract', provider: state.service, model: state.model, processingTimeMs: state.metadata['processingTime'] }] : [])
    const costSteps = providers.flatMap(({ state, receipts }) => {
      const spending = summarizeCleanTypographyReceipts(receipts)
      return state.local ? [{ step: 'extract', provider: state.service, model: state.model, cost: 0, costSource: 'local_zero' }]
        : receipts.some(receipt => receipt.status === 'settled') || spending.heldReservationCents > 0 ? [{ step: 'extract', provider: state.service, model: state.model,
          cost: spending.accountedCents, costSource: spending.settledConservativeCents > 0 || spending.heldReservationCents > 0 ? 'conservative_upper_bound' : 'provider_usage_at_reviewed_rates',
          costBreakdown: { reviewedUsageCents: spending.providerReportedCents, settledConservativeCents: spending.settledConservativeCents,
            heldReservationCents: spending.heldReservationCents, accountedCents: spending.accountedCents } }] : []
    })
    const privateDirectory = `${localRoot}/benchmark-runs/${entry.id}`
    const manifest = { command: 'extract', scope: 'single', createdAt: String(pilot.manifest['createdAt']), updatedAt: new Date().toISOString(), reference,
      source: { kind: 'ocr-clean-typography-benchmark-assembly', sourceRunDir: privateDirectory, execution: `${localRoot}/execution.json`, spendingLedger: ledgerPath,
        localPilot: entry.localPilot.directory, localPilotManifestSha256: pilot.manifestSha256, bundleSha256: plan.bundleSha256, coverage,
        providerResultsPublished: false, sourceContentStorage: 'Source documents, canonical text, packets and provider text remain in ignored local storage.' },
      items: [{ input: entry.input, inputFamily: 'image', extractRoute: 'document', outputDir: '.', status: coverage.status === 'complete' ? 'full' : 'incomplete',
        metadata: { step1: { title: entry.id, slug: entry.id, pageCount: 1, format: 'png' }, source: { filePath: entry.input }, coverage,
          resolvedStep2: { route: 'ocr', sourceKind: 'image', providers: targets.map(target => ({ service: target.provider, model: target.model })) },
          cost: { actual: { totalCost: spending.accountedCents, steps: costSteps }, accounting: spending,
            totalCostPolicy: 'The legacy actual cost container stores cumulative accounted cents, including retained reservations as conservative upper bounds; it is not an invoice total.' },
          timing: { actual: { totalProcessingTimeMs: timingSteps.reduce((sum, row) => sum + row.processingTimeMs, 0), steps: timingSteps } },
          step2: providers.filter(row => row.state.status === 'succeeded').map(row => row.state.metadata) },
        providers: providers.map(row => row.state) }] }
    const metadata = { schemaVersion: 1, kind: 'ocr-benchmark-case', caseId: entry.id, category: 'clean-typography', language: 'en', pageCount: 1,
      input: { path: entry.input, sha256: entry.inputSha256, sourceUrl: entry.sourceURL }, reference, rights: entry.rights, coverage,
      privateRunDir: privateDirectory, providerResultsPublished: false }
    prepared.push({ entry, privateDirectory, manifest, metadata, providers, coverage })
  }
  return { root, within, existing, prepared, ledger, overview: { mode: 'local-read-only-no-cost', cases: prepared.map(row => ({ id: row.entry.id, ...row.coverage })), spending: summarizeCleanTypographyReceipts(ledger.receipts) } }
}

export const inspectCleanTypographyReports = async (options: CleanTypographyReportOptions = {}) => (await prepareReports(options)).overview

/** Assemble and score existing local artifacts only. Never invokes extraction or a provider. */
export const buildCleanTypographyReports = async (options: CleanTypographyReportOptions = {}) => {
  const context = await prepareReports(options)
  if (context.prepared.some(row => row.coverage.pendingHostedModels > 0)) throw new AppValidationError('Hosted slots are still missing or running; report assembly is deferred')
  const copyArtifacts = async (source: string, destination: string): Promise<void> => {
    await mkdir(context.within(destination), { recursive: true })
    for (const entry of await readdir(await context.existing(source), { withFileTypes: true })) {
      if (entry.name === '.DS_Store' || ['manifest.json', 'dispatch.json', 'failure.txt'].includes(entry.name)) continue
      if (entry.isSymbolicLink()) throw new AppValidationError('Provider artifact directories may not contain symlinks')
      const from = `${source}/${entry.name}`, to = `${destination}/${entry.name}`
      if (entry.isDirectory()) await copyArtifacts(from, to)
      else if (entry.isFile()) await Bun.write(context.within(to), Bun.file(await context.existing(from)))
    }
  }
  const writeJson = (path: string, value: unknown): void => writePortableFileSync(context.within(path), JSON.stringify(value) + '\n')
  const consensusRoot = resolve(PROJECT_ROOT, '.codex/skills/consensus')
  const runConsensus = options.runConsensus ?? (async (argv: readonly string[], caseId: string): Promise<void> => {
    const child = Bun.spawn([process.execPath, 'scripts/run.ts', ...argv], { cwd: consensusRoot, env: { ...process.env, AUTOSHOW_PROJECT_ROOT: context.root }, stdout: 'pipe', stderr: 'pipe' })
    const [, , exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    if (exit !== 0) throw new AppInfrastructureError(`Local consensus report command failed for ${caseId} (exit ${exit}); source artifacts are preserved`)
  })
  for (const row of context.prepared) {
    const stage = `${localRoot}/benchmark-runs/.${row.entry.id}.assembly-${randomUUID()}`
    await mkdir(context.within(stage), { recursive: true })
    for (const provider of row.providers) {
      if (provider.state.status !== 'succeeded' || !provider.saved) continue
      const destination = `${stage}/${provider.state.artifactDir}`
      await copyArtifacts(provider.saved.sourceArtifactDirectory, destination)
      if (!provider.saved.resultBytes) writeJson(`${destination}/result.json`, provider.saved.result)
    }
    writeJson(`${stage}/manifest.json`, row.manifest)
    if (await Bun.file(context.within(`${row.privateDirectory}/manifest.json`)).exists()) {
      const backup = `${localRoot}/prior-assemblies/${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}/${row.entry.id}`
      await mkdir(dirname(context.within(backup)), { recursive: true })
      await rename(await context.existing(row.privateDirectory), context.within(backup))
    }
    await rename(context.within(stage), context.within(row.privateDirectory))
    await mkdir(context.within(row.entry.runDir), { recursive: true })
    writeJson(`${row.entry.runDir}/manifest.json`, row.manifest)
    writeJson(`${row.entry.runDir}/case-metadata.json`, row.metadata)
    await runConsensus(['ocr', 'build-packet', context.within(row.privateDirectory), '--out', context.within(`${row.privateDirectory}/consensus-packet.json`)], row.entry.id)
    await runConsensus(['ocr', 'build-report', context.within(row.privateDirectory), '--markdown-out', context.within(`${row.entry.runDir}/provider-comparison-report.md`), '--json-out', context.within(`${row.entry.runDir}/provider-comparison-report.json`)], row.entry.id)
    const reportPath = `${row.entry.runDir}/provider-comparison-report.json`
    const report: unknown = await Bun.file(context.within(reportPath)).json()
    if (!record(report)) throw new AppValidationError('Generated metric report is invalid')
    const costs = new Map(row.providers.map(provider => {
      const spending = summarizeCleanTypographyReceipts(provider.receipts)
      return [`${provider.state.service}/${provider.state.model}`, { ...spending, costSource: provider.state.local ? 'local_zero'
        : spending.settledConservativeCents > 0 || spending.heldReservationCents > 0 ? 'conservative_upper_bound'
            : provider.receipts.some(receipt => receipt.status === 'settled') ? 'provider_usage_at_reviewed_rates' : 'unavailable' }]
    }))
    const addCost = (value: unknown): void => {
      if (!record(value) || typeof value['providerKey'] !== 'string') return
      const cost = costs.get(value['providerKey'])
      if (cost) {
        value['costSource'] = cost.costSource
        value['costAccounting'] = cost
        value['costBreakdown'] = { reviewedUsageCents: cost.providerReportedCents, settledConservativeCents: cost.settledConservativeCents,
          heldReservationCents: cost.heldReservationCents, accountedCents: cost.accountedCents }
      }
    }
    if (record(report['providerGroups'])) for (const group of Object.values(report['providerGroups'])) {
      if (record(group) && Array.isArray(group['providers'])) group['providers'].forEach(addCost)
    }
    if (record(report['metricRankings'])) for (const group of Object.values(report['metricRankings'])) {
      if (record(group) && Array.isArray(group['price'])) group['price'].forEach(addCost)
    }
    report['costPolicy'] = summarizeCleanTypographyReceipts([]).costPolicy
    const conservative = [...costs].filter(([, cost]) => cost.settledConservativeCents > 0 || cost.heldReservationCents > 0)
    const notes = ['Reported usage is valued at reviewed rates; prices include settled retry costs and retained unresolved reservations once and are not invoice-reconciled charges.',
      'Any settled conservative amount or retained unresolved reservation makes the price a conservative upper bound; billing uncertainty remains visible in the separate breakdown.',
      ...conservative.map(([key, cost]) => `${key}: accounted price is a conservative upper bound (${cost.providerReportedCents.toFixed(6)} cents of reviewed-rate usage, ${cost.settledConservativeCents.toFixed(6)} settled conservative cents, and ${cost.heldReservationCents.toFixed(6)} retained unresolved cents).`)]
    report['notes'] = [...(Array.isArray(report['notes']) ? report['notes'] : []), ...notes]
    writeJson(reportPath, report)
    const markdownPath = `${row.entry.runDir}/provider-comparison-report.md`
    const markdown = await Bun.file(context.within(markdownPath)).text()
    writePortableFileSync(context.within(markdownPath), markdown.replaceAll('| Actual Cost |', '| Accounted Cost |') + `\n## Cost accounting\n\n${notes.map(note => `- ${note}`).join('\n')}\n`)
  }
  return { ...context.overview, mode: 'built-local-reports-no-provider-calls' }
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2)
    if (args.length > 1 || args.some(arg => !['--help', '--build'].includes(arg))) throw new AppUsageError('Usage: bun src/tools/ocr-clean-typography-report.ts [--build]')
    if (args[0] === '--help') writeCommandPayload(('Usage: bun src/tools/ocr-clean-typography-report.ts [--build]\nDefaults to a read-only coverage/spending overview. --build assembles saved private OCR artifacts and generates metric-only public reports with the consensus skill. No network, OCR reruns or provider calls. Prior private assemblies are preserved.') + '\n')
    else writeCommandPayload((JSON.stringify(args[0] === '--build' ? await buildCleanTypographyReports() : await inspectCleanTypographyReports(), null, 2)) + '\n')
  } catch (error) {
    writeCommandPayload((error instanceof Error ? error.message : 'Local report assembly failed') + '\n', 'stderr')
    process.exitCode = 1
  }
}
