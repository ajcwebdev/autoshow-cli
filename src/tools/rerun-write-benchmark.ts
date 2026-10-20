import { mkdir, open } from 'node:fs/promises'
import { join } from 'node:path'
import { collectLlmTargets } from '~/cli/commands/text/write/run-llm'
import { buildLlmEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/llm-estimates'
import { getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { isRecord, sha256Bytes } from '~/utils/value-helpers'
import { toProjectRelativePath } from '~/utils/project-root'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { finalizeWriteBenchmarkCase, installWriteBenchmarkFetchGuard, prepareWriteBenchmarkCase, runWriteBenchmarkSlot, WRITE_BENCHMARK_PLAN } from '~/tools/write-benchmark'
import type { BenchmarkSlot, BenchmarkTarget, WriteBenchmarkCase, WriteBenchmarkPlan } from '~/tools/write-benchmark'
import type { LLMOptions, LLMTarget, Step3Metadata } from '~/types'

export const WRITE_BENCHMARK_RERUN_PLAN = 'docs/benchmarks/write/rerun-plan.json'
export const WRITE_BENCHMARK_RERUN_COMMAND = 'bun src/tools/rerun-write-benchmark.ts --run'
const attempt = '02'
const expectedFailures = 7
const stem = (provider: string, model: string): string => `${provider}-${model}`.replace(/[/\\:*?"<>|]/g, '-')
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

export type WriteBenchmarkRerunTarget = WriteBenchmarkPlan['providers'][number] & {
  originalReceiptPath: string
  originalReceiptSha256: string
  originalStatus: 'failed' | 'validation-failed'
  nativeEstimatedCostCents: number
  scenario: { inputTokens: number; outputTokens: number; costCents: number; basis: string }
}
export type WriteBenchmarkRerunCase = WriteBenchmarkCase & {
  originalRunDir: string
  providers: WriteBenchmarkRerunTarget[]
}
export type WriteBenchmarkRerunAuthorization = {
  command: typeof WRITE_BENCHMARK_RERUN_COMMAND
  planFingerprint: string
  approvedAt: string
  evidence: string
  acknowledgedScenarioCostCents: number
  acknowledgesUncappedReasoning: true
  acknowledgesPriorUnresolvedBilling: true
}
export type WriteBenchmarkRerunPlan = {
  schemaVersion: 1
  originalPlanPath: string
  originalPlanSha256: string
  originalPlanFingerprint: string
  attempt: '02'
  providerConcurrency: 2
  selectionSha256: string
  cases: WriteBenchmarkRerunCase[]
  requestCount: 7
  nativeEstimatedCostCents: number
  observedMaxOutputScenarioCostCents: number
  priorKnownCostCents: number
  priorUnresolvedSlots: number
  policy: {
    inferenceAttemptsPerTarget: 1
    validationRetries: 0
    requestControls: 'identical-to-original-cli-defaults'
    transportRetries: string
    spendingRisk: string
  }
  authorization: WriteBenchmarkRerunAuthorization | null
  fingerprint: string
}

const modelOptions = (providers: Array<{ provider: Step3Metadata['llmService']; model: string }>): LLMOptions => ({
  outputDir: '.',
  openaiModels: providers.filter(entry => entry.provider === 'openai').map(entry => entry.model),
  geminiModels: providers.filter(entry => entry.provider === 'gemini').map(entry => entry.model),
  anthropicModels: providers.filter(entry => entry.provider === 'anthropic').map(entry => entry.model),
  grokModels: providers.filter(entry => entry.provider === 'grok').map(entry => entry.model)
})

const assertCaseHashes = (entry: WriteBenchmarkCase, prepared: Awaited<ReturnType<typeof prepareWriteBenchmarkCase>>): void => {
  if (sha256Bytes(prepared.source) !== entry.sourceSha256 || sha256Bytes(prepared.prompt) !== entry.promptSha256 || sha256Bytes(JSON.stringify(prepared.schema.jsonSchema)) !== entry.schemaSha256) {
    throw ValidationError(`Original benchmark input, prompt or schema changed: ${entry.id}; rerun dispatch is blocked.`)
  }
}

const assertSnapshots = async (entry: WriteBenchmarkCase, prepared: Awaited<ReturnType<typeof prepareWriteBenchmarkCase>>): Promise<void> => {
  for (const [name, expected] of [['source.txt', sha256Bytes(prepared.source)], ['prompt.md', sha256Bytes(prepared.prompt)]]) {
    const path = join(entry.runDir, name!)
    if (!await Bun.file(path).exists() || sha256Bytes(await Bun.file(path).text()) !== expected) throw ValidationError(`Benchmark snapshot missing or changed: ${toProjectRelativePath(path)}`)
  }
}

const assertArtifacts = async (runDir: string, receipt: BenchmarkSlot): Promise<void> => {
  for (const [name, expected] of Object.entries(receipt.artifactHashes ?? {})) {
    if (name !== name.split(/[\\/]/).pop()) throw ValidationError('Receipt artifact must be a file within its run directory.')
    const path = join(runDir, name)
    if (!await Bun.file(path).exists() || sha256Bytes(await Bun.file(path).text()) !== expected) throw ValidationError(`Original artifact missing or changed: ${toProjectRelativePath(path)}; rerun dispatch is blocked.`)
  }
}

const readOriginal = async (path: string): Promise<{ plan: WriteBenchmarkPlan; sha256: string }> => {
  const bytes = await Bun.file(path).text()
  const plan = JSON.parse(bytes) as WriteBenchmarkPlan
  const { fingerprint, ...content } = plan
  if (sha256Bytes(JSON.stringify(content)) !== fingerprint) throw ValidationError('Original benchmark plan contents changed without a matching fingerprint.')
  if (plan.schemaVersion !== 1 || plan.repetitions !== 1 || !plan.cases.length || !plan.providers.length) throw ValidationError('Unsupported original benchmark plan.')
  return { plan, sha256: sha256Bytes(bytes) }
}

// Frozen request controls are retained only to reconstruct the already-purchased historical plan.
const scenarioFor = (provider: Step3Metadata['llmService'], receipt: BenchmarkSlot, nativeInput: number, nativeOutput: number, peers: BenchmarkSlot[]): { inputTokens: number; outputTokens: number; basis: string } => {
  if (provider === 'anthropic' && receipt.metadata) {
    return { inputTokens: receipt.metadata.inputTokenCount, outputTokens: receipt.metadata.outputTokenCount, basis: 'Original returned input/output usage; this is an observed scenario, not the Anthropic maximum.' }
  }
  if (provider === 'grok') {
    const observed = peers.filter(peer => peer.provider === 'grok' && peer.metadata).sort((left, right) => right.metadata!.outputTokenCount - left.metadata!.outputTokenCount)[0]?.metadata
    return { inputTokens: observed?.inputTokenCount ?? nativeInput, outputTokens: observed?.outputTokenCount ?? nativeOutput, basis: 'Largest observed same-case Grok billed output, including reasoning. The original request has no output-token cap.' }
  }
  if (provider === 'glm') {
    return { inputTokens: Math.max(nativeInput, ...peers.filter(peer => peer.provider === 'glm').map(peer => peer.metadata?.inputTokenCount ?? 0)), outputTokens: 16000, basis: 'Maximum native GLM max_tokens=16000; input is the larger of native preflight and returned same-case GLM usage.' }
  }
  if (provider === 'together') return { inputTokens: nativeInput, outputTokens: receipt.model === 'kimi-k3' ? 131072 : 32768, basis: 'Native Together max_tokens with native preflight input; this scenario excludes additional input-tokenization variation.' }
  throw ValidationError(`No reviewed rerun spending scenario for ${provider}/${receipt.model}.`)
}

/** A retired route has no live reasoning policy; its purchased run retains the original estimate snapshot. */
const historicalEstimate = async (entry: WriteBenchmarkCase, provider: WriteBenchmarkPlan['providers'][number]): Promise<{ totalCost: number; estimatedInputTokens: number; estimatedOutputTokens: number }> => {
  const manifest = await readManifest(entry.runDir)
  const cost = manifest?.items[0]?.metadata['cost']
  const estimated = isRecord(cost) ? cost['estimated'] : undefined
  const steps = isRecord(estimated) ? estimated['steps'] : undefined
  const snapshot = Array.isArray(steps) ? steps.find(row => isRecord(row) && row['provider'] === provider.provider && row['model'] === provider.model) : undefined
  const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
  if (!isRecord(snapshot) || !numeric(snapshot['cost']) || !numeric(snapshot['estimatedInputTokens']) || !numeric(snapshot['estimatedOutputTokens']) || snapshot['inputCostPer1MCents'] !== provider.inputCostPer1MCents || snapshot['outputCostPer1MCents'] !== provider.outputCostPer1MCents) {
    throw ValidationError(`Missing or invalid historical native estimate snapshot for ${entry.id}/${provider.provider}/${provider.model}; historical verification cannot use live retired-model dispatch settings.`)
  }
  return { totalCost: snapshot['cost'], estimatedInputTokens: snapshot['estimatedInputTokens'], estimatedOutputTokens: snapshot['estimatedOutputTokens'] }
}

/** Local-only: discover failed original receipts and price exactly one additional attempt each. */
export const buildWriteBenchmarkRerunPlan = async (originalPlanPath = WRITE_BENCHMARK_PLAN): Promise<WriteBenchmarkRerunPlan> => {
  const original = await readOriginal(originalPlanPath)
  const cases: WriteBenchmarkRerunCase[] = []
  let knownCostCents = 0
  let unresolvedSlots = 0
  for (const entry of original.plan.cases) {
    const prepared = await prepareWriteBenchmarkCase(entry)
    assertCaseHashes(entry, prepared)
    await assertSnapshots(entry, prepared)
    const receipts: Array<{ provider: WriteBenchmarkPlan['providers'][number]; receipt: BenchmarkSlot; path: string; sha256: string }> = []
    for (const provider of original.plan.providers) {
      const price = getLlmCost(provider.provider, provider.model)
      if (!price || price.inputCostPer1MCents !== provider.inputCostPer1MCents || price.outputCostPer1MCents !== provider.outputCostPer1MCents) throw ValidationError(`Original model or tariff changed: ${provider.provider}/${provider.model}.`)
      const path = join(entry.runDir, `slot-${stem(provider.provider, provider.model)}.json`)
      const bytes = await Bun.file(path).text()
      const receipt = JSON.parse(bytes) as BenchmarkSlot
      if (receipt.planFingerprint !== original.plan.fingerprint || receipt.caseId !== entry.id || receipt.provider !== provider.provider || receipt.model !== provider.model) throw ValidationError(`Original receipt identity changed: ${toProjectRelativePath(path)}`)
      if (!['completed', 'failed', 'validation-failed'].includes(receipt.status)) throw ValidationError(`Original receipt is unfinished: ${toProjectRelativePath(path)}; reconcile it before rerunning.`)
      await assertArtifacts(entry.runDir, receipt)
      if (typeof receipt.billing?.costCents === 'number') knownCostCents += receipt.billing.costCents
      else unresolvedSlots++
      receipts.push({ provider, receipt, path, sha256: sha256Bytes(bytes) })
    }
    const failed = receipts.filter(item => item.receipt.status === 'failed' || item.receipt.status === 'validation-failed')
    if (!failed.length) continue
    const active = failed.filter(item => getModelRegistry().llm[item.provider.provider]?.models[item.provider.model])
    const estimates = active.length ? await buildLlmEstimates({ ...modelOptions(active.map(item => item.provider)), prompts: [entry.prompt] }, prepared.source) : []
    const providers = await Promise.all(failed.map(async item => {
      const estimate = getModelRegistry().llm[item.provider.provider]?.models[item.provider.model]
        ? estimates.find(row => row.provider === item.provider.provider && row.model === item.provider.model)
        : await historicalEstimate(entry, item.provider)
      if (!estimate) throw ValidationError(`Missing native rerun estimate for ${item.provider.provider}/${item.provider.model}.`)
      const scenario = scenarioFor(item.provider.provider, item.receipt, estimate.estimatedInputTokens ?? 0, estimate.estimatedOutputTokens ?? 0, receipts.map(row => row.receipt))
      return {
        ...item.provider, originalReceiptPath: toProjectRelativePath(item.path), originalReceiptSha256: item.sha256,
        originalStatus: item.receipt.status as 'failed' | 'validation-failed', nativeEstimatedCostCents: estimate.totalCost,
        scenario: { ...scenario, costCents: (scenario.inputTokens * item.provider.inputCostPer1MCents + scenario.outputTokens * item.provider.outputCostPer1MCents) / 1_000_000 }
      }
    }))
    cases.push({ ...entry, originalRunDir: entry.runDir, runDir: toProjectRelativePath(join(entry.runDir, 'reruns', attempt)), providers, estimatedCostCents: providers.reduce((sum, provider) => sum + provider.nativeEstimatedCostCents, 0) })
  }
  const targets = cases.flatMap(entry => entry.providers.map(provider => ({ caseId: entry.id, ...provider })))
  if (targets.length !== expectedFailures) throw ValidationError(`Expected exactly ${expectedFailures} original failed or schema-invalid slots; found ${targets.length}. Reconcile the selection before dispatch.`)
  const content = {
    schemaVersion: 1 as const, originalPlanPath: toProjectRelativePath(originalPlanPath), originalPlanSha256: original.sha256,
    originalPlanFingerprint: original.plan.fingerprint, attempt: attempt as '02', providerConcurrency: original.plan.providerConcurrency, selectionSha256: sha256Bytes(JSON.stringify(targets)), cases, requestCount: expectedFailures as 7,
    nativeEstimatedCostCents: targets.reduce((sum, provider) => sum + provider.nativeEstimatedCostCents, 0),
    observedMaxOutputScenarioCostCents: targets.reduce((sum, provider) => sum + provider.scenario.costCents, 0),
    priorKnownCostCents: knownCostCents, priorUnresolvedSlots: unresolvedSlots,
    policy: {
      inferenceAttemptsPerTarget: 1 as const, validationRetries: 0 as const, requestControls: 'identical-to-original-cli-defaults' as const,
      transportRetries: original.plan.policy.transportRetries,
      spendingRisk: 'The native preflight excludes potentially large thinking usage. The observed/max-output scenario is not a hard cap: Grok has no output-token cap, provider tokenization can vary, and HTTP 429 admission retries are not priced as billable inference. Prior unresolved requests may already have been billed. Costs are cumulative with the original batch; preserve all original artifacts and do not dispatch until the exact command and spending risk have explicit approval.'
    }
  }
  return { ...content, authorization: null, fingerprint: sha256Bytes(JSON.stringify(content)) }
}

const assertCurrentPlan = async (plan: WriteBenchmarkRerunPlan): Promise<WriteBenchmarkPlan> => {
  const current = await buildWriteBenchmarkRerunPlan(plan.originalPlanPath)
  const { authorization: _authorization, ...saved } = plan
  const { authorization: _currentAuthorization, ...expected } = current
  if (JSON.stringify(saved) !== JSON.stringify(expected)) throw ValidationError('Rerun plan selection, inputs, receipts, schema, tariffs or spending scenario changed; dispatch is blocked.')
  return (await readOriginal(plan.originalPlanPath)).plan
}

const assertAuthorization = (plan: WriteBenchmarkRerunPlan): void => {
  const approved = plan.authorization
  if (!approved || approved.command !== WRITE_BENCHMARK_RERUN_COMMAND || approved.planFingerprint !== plan.fingerprint || !approved.evidence.trim() || !Number.isFinite(Date.parse(approved.approvedAt)) || !Number.isFinite(approved.acknowledgedScenarioCostCents) || approved.acknowledgedScenarioCostCents < plan.observedMaxOutputScenarioCostCents || approved.acknowledgesUncappedReasoning !== true || approved.acknowledgesPriorUnresolvedBilling !== true) {
    throw UsageError(`Explicit cost-specific authorization is required for ${WRITE_BENCHMARK_RERUN_COMMAND}; the saved rerun plan is not approved.`)
  }
}

const casePlan = (original: WriteBenchmarkPlan, entry: WriteBenchmarkRerunCase): WriteBenchmarkPlan => ({
  ...original, cases: [entry], providers: entry.providers.map(({ provider, model, inputCostPer1MCents, outputCostPer1MCents }) => ({ provider, model, inputCostPer1MCents, outputCostPer1MCents })),
  baseEstimatedCostCents: entry.estimatedCostCents
})

/** Existing native slot receipts block a second attempt, including failed or interrupted attempts. */
export const executeWriteBenchmarkRerun = async (plan: WriteBenchmarkRerunPlan, targets?: LLMTarget[]): Promise<BenchmarkSlot[]> => {
  const original = await assertCurrentPlan(plan)
  assertAuthorization(plan)
  for (const entry of plan.cases) {
    for (const provider of entry.providers) {
      if (!getModelRegistry().llm[provider.provider]?.models[provider.model]) throw ValidationError(`Retired or unsupported rerun model ${provider.provider}/${provider.model}; this historical plan is available through --verify-cache only.`)
    }
  }
  const available = targets ?? collectLlmTargets(modelOptions(plan.cases.flatMap(entry => entry.providers)))
  const restore = installWriteBenchmarkFetchGuard()
  const result: BenchmarkSlot[] = []
  try {
    for (const entry of plan.cases) {
      const prepared = await prepareWriteBenchmarkCase(entry)
      assertCaseHashes(entry, prepared)
      await mkdir(entry.runDir, { recursive: true })
      for (const [name, value] of [['source.txt', prepared.source], ['prompt.md', prepared.prompt]]) {
        const path = join(entry.runDir, name!)
        if (await Bun.file(path).exists()) {
          if (await Bun.file(path).text() !== value) throw ValidationError(`Rerun snapshot changed: ${toProjectRelativePath(path)}`)
        } else await Bun.write(path, value!)
      }
      const selected = casePlan(original, entry)
      const slots: BenchmarkSlot[] = []
      const exactTargets = entry.providers.map(provider => {
        const target = available.find(target => target.service === provider.provider && target.model === provider.model)
        if (!target) throw ValidationError(`Missing exact rerun target: ${provider.provider}/${provider.model}.`)
        return target
      })
      const outcomes = await Promise.allSettled([...new Set(exactTargets.map(target => target.service))].map(async provider => {
        const queue = exactTargets.filter(target => target.service === provider)
        const workers = await Promise.allSettled(Array.from({ length: plan.providerConcurrency }, async () => {
          for (let target = queue.shift(); target; target = queue.shift()) {
            const slot = await runWriteBenchmarkSlot(selected, entry, prepared, target)
            slots.push(slot)
            writeCommandPayload(JSON.stringify({ case: entry.id, attempt, provider: slot.provider, model: slot.model, status: slot.status, elapsedMs: slot.wallTimeMs, ...(slot.error ? { error: slot.error } : {}) }) + '\n')
          }
        }))
        const failed = workers.find(worker => worker.status === 'rejected')
        if (failed?.status === 'rejected') throw failed.reason
      }))
      // Keep the global inference guard installed until all concurrent slots settle.
      const failed = outcomes.find(outcome => outcome.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
      slots.sort((left, right) => entry.providers.findIndex(provider => provider.provider === left.provider && provider.model === left.model) - entry.providers.findIndex(provider => provider.provider === right.provider && provider.model === right.model))
      result.push(...slots)
      await finalizeWriteBenchmarkCase(selected, entry, prepared, slots)
    }
  } finally { restore() }
  return result
}

/** Read-only cache validation: a missing receipt is an error, never a new dispatch. */
export const verifyWriteBenchmarkRerunCache = async (plan: WriteBenchmarkRerunPlan): Promise<BenchmarkSlot[]> => {
  const original = await assertCurrentPlan(plan)
  for (const entry of plan.cases) {
    for (const provider of entry.providers) {
      if (!await Bun.file(join(entry.runDir, `slot-${stem(provider.provider, provider.model)}.json`)).exists()) throw ValidationError(`Missing rerun cache receipt: ${entry.id}/${provider.provider}/${provider.model}; verification cannot dispatch.`)
    }
  }
  const result: BenchmarkSlot[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = Object.assign(async () => { throw ValidationError('Network access is blocked during rerun cache verification.') }, { preconnect: originalFetch.preconnect }) as typeof fetch
  try {
    for (const entry of plan.cases) {
      const prepared = await prepareWriteBenchmarkCase(entry)
      await assertSnapshots(entry, prepared)
      const manifest = await readManifest(entry.runDir)
      const requested = manifest?.items[0]?.providers.map(provider => `${provider.service}/${provider.model}`).sort()
      const expected = entry.providers.map(provider => `${provider.provider}/${provider.model}`).sort()
      if (JSON.stringify(requested) !== JSON.stringify(expected)) throw ValidationError(`Rerun manifest target selection changed: ${entry.id}.`)
      for (const provider of entry.providers) {
        const target: BenchmarkTarget = { service: provider.provider, model: provider.model, label: provider.provider, run: async () => { throw ValidationError('Provider dispatch is blocked during rerun cache verification.') } }
        result.push(await runWriteBenchmarkSlot(casePlan(original, entry), entry, prepared, target))
      }
    }
  } finally { globalThis.fetch = originalFetch }
  return result
}

const main = async (): Promise<void> => {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    writeCommandPayload('Usage: bun src/tools/rerun-write-benchmark.ts [--price | --prepare | --run | --verify-cache]\nDefault: local price-only JSON for exactly seven original failed or schema-invalid slots. --prepare pins an unapproved plan without creating new attempts. --run requires an explicit cost-specific authorization record and preserves originals. Existing rerun receipts always block repurchase. --verify-cache validates all existing rerun receipts and artifacts with network access blocked.' + '\n')
    return
  }
  if (args.length > 1 || args.some(arg => !['--price', '--prepare', '--run', '--verify-cache'].includes(arg))) throw UsageError('Choose one of --price, --prepare, --run or --verify-cache.')
  if (args.includes('--run') || args.includes('--verify-cache')) {
    if (!await Bun.file(WRITE_BENCHMARK_RERUN_PLAN).exists()) throw UsageError('Run --prepare to pin the rerun plan first.')
    const plan = await Bun.file(WRITE_BENCHMARK_RERUN_PLAN).json() as WriteBenchmarkRerunPlan
    if (args.includes('--run')) await executeWriteBenchmarkRerun(plan)
    else writeCommandPayload(json({ verified: (await verifyWriteBenchmarkRerunCache(plan)).length, networkAccess: 'blocked' }) + '\n')
    return
  }
  const plan = await buildWriteBenchmarkRerunPlan()
  if (args.includes('--prepare')) {
    if (await Bun.file(WRITE_BENCHMARK_RERUN_PLAN).exists()) {
      await assertCurrentPlan(await Bun.file(WRITE_BENCHMARK_RERUN_PLAN).json() as WriteBenchmarkRerunPlan)
    } else {
      const handle = await open(WRITE_BENCHMARK_RERUN_PLAN, 'wx')
      try { await handle.writeFile(json(plan)); await handle.sync() } finally { await handle.close() }
    }
  }
  writeCommandPayload(json(plan) + '\n')
}

if (import.meta.main) await main()
