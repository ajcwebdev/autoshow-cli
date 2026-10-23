import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdir, open, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { collectLlmTargets } from '~/cli/commands/text/write/run-llm'
import { buildTextInputPrompt, getTextInputTitle } from '~/cli/commands/text/write/text-input-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { buildStructuredInstructionSuffix, resolveStructuredSchema } from '~/cli/commands/text/write/structured-output/schema-resolver'
import { shouldApplyStrictMode } from '~/cli/commands/text/write/structured-output/capabilities'
import { parseAndValidateStructured } from '~/cli/commands/text/write/structured-output/validator'
import { renderToPlainText } from '~/cli/commands/text/write/structured-output/renderers'
import { buildStructuredValidationFailureEnvelope } from '~/cli/commands/text/write/structured-output/validation-failure'
import { getLlmCost, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { buildLlmEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/llm-estimates'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { createManifest, createPipelineItemFromRecord, readManifest, writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { sha256Bytes } from '~/utils/value-helpers'
import { stripProjectRoot, toProjectRelativePath } from '~/utils/project-root'
import { extractErrorMetadata, getErrorStatus, UsageError, ValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { sanitizeArtifactMetadata, sanitizeArtifactText } from '~/utils/app-logger/redaction'
import { buildStep3Metadata, runWithLLMInstrumentation } from '~/cli/commands/text/write/write-utils/llm-instrumentation'
import { normalizeGrokChatUsage } from '~/utils/openai/grok-chat-usage'
import { isRecord } from '~/utils/value-helpers'
import type { LLMOptions, LLMService, LLMTarget, ResolvedStructuredSchema, Step3Metadata, StructuredValidationContext } from '~/types'

export const WRITE_BENCHMARK_PLAN = 'docs/benchmarks/text/write/benchmark-plan.json'
export const WRITE_BENCHMARK_CASES = [
  { id: '01-short-summary', prompt: 'shortSummary', input: 'docs/benchmarks/text/write/2026-09-16_06-51-18-238_1-audio/transcription.txt' },
  { id: '02-long-summary', prompt: 'longSummary', input: 'docs/benchmarks/stt/with-speakers/2022-09-30-widgets-fsjam-40-minutes/consensus-transcription.txt' },
  { id: '03-medium-chapters', prompt: 'mediumChapters', input: 'docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/consensus-transcription.txt' },
  { id: '04-blog', prompt: 'blog', input: 'docs/benchmarks/stt/with-speakers/2023-04-05-jsjam-react-miami-2023-10-minutes/consensus-transcription.txt' },
  { id: '05-rap-song-chapter', prompt: 'rapSongChapter', input: 'input/examples/document/harborlight-field-notes.md' }
] as const

type BenchmarkProvider = { provider: Step3Metadata['llmService']; model: string; inputCostPer1MCents: number; outputCostPer1MCents: number }
export type BenchmarkTarget = Omit<LLMTarget, 'service'> & { service: Step3Metadata['llmService'] }
export type WriteBenchmarkCase = { id: string; prompt: string; input: string; runDir: string; estimatedCostCents: number; sourceSha256: string; promptSha256: string; schemaSha256: string }
export type WriteBenchmarkPlan = {
  schemaVersion: 1
  benchmarkDate: string
  repetitions: 1
  providerConcurrency: 2
  qualityProxy: { method: 'model-output-unit-price'; label: string; higherIsBetter: true }
  providers: BenchmarkProvider[]
  cases: WriteBenchmarkCase[]
  baseEstimatedCostCents: number
  approval: { estimatedCostCents: number; scope: string; evidence: string } | null
  policy: { validationRetries: 0; transportRetries: string; repetitions: 1; reasoningEffort: 'existing-cli-defaults'; estimateLimitations: string }
  fingerprint: string
}
export type BenchmarkSlot = {
  schemaVersion: 1
  planFingerprint: string
  caseId: string
  provider: Step3Metadata['llmService']
  model: string
  status: 'dispatch-started' | 'completed' | 'validation-failed' | 'failed'
  startedAt: string
  completedAt?: string
  wallTimeMs?: number
  networkAttempts?: number
  metadata?: Step3Metadata
  error?: string
  failureEvidenceError?: string
  billing?: { status: 'known' | 'estimated' | 'unresolved'; costCents?: number; note?: string }
  artifactHashes?: Record<string, string>
}
type PreparedCase = { source: string; prompt: string; schema: ResolvedStructuredSchema; context: StructuredValidationContext }
type FetchBudget = { requests: number; retryAdmitted: boolean }
const requestBudget = new AsyncLocalStorage<FetchBudget>()
const safeStem = (provider: string, model: string): string => `${provider}-${model}`.replace(/[/\\:*?"<>|]/g, '-')
const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`
const usageMetricKeys = new Set(['input_tokens', 'output_tokens', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'reasoning_tokens', 'thinking_tokens', 'cached_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'ephemeral_5m_input_tokens', 'ephemeral_1h_input_tokens', 'promptTokenCount', 'candidatesTokenCount', 'totalTokenCount', 'thoughtsTokenCount', 'cachedContentTokenCount', 'inputTokenCount', 'outputTokenCount', 'cachedInputTokenCount', 'tokenCount'])
const usageContainerKeys = new Set(['input_tokens_details', 'output_tokens_details', 'prompt_tokens_details', 'completion_tokens_details', 'promptTokensDetails', 'candidatesTokensDetails'])
const requestLimitKeys = new Set(['max_tokens', 'max_completion_tokens', 'max_output_tokens', 'maxOutputTokens', 'thinking_budget'])
const sanitizeFailureValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value === 'string') return stripProjectRoot(sanitizeArtifactText(value))
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map(entry => sanitizeFailureValue(entry, seen))
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const numericEvidence = (usageMetricKeys.has(key) || requestLimitKeys.has(key)) && typeof entry === 'number' && Number.isFinite(entry)
    const usageContainer = usageContainerKeys.has(key) && entry !== null && typeof entry === 'object'
    const sensitive = sanitizeArtifactMetadata({ [key]: null })[key] === 'REDACTED'
    return [key, sensitive && !numericEvidence && !usageContainer ? 'REDACTED' : sanitizeFailureValue(entry, seen)]
  }))
}
const setSlotBilling = (slot: BenchmarkSlot): void => {
  slot.billing = slot.metadata
    ? { status: slot.metadata.tokenCountSource === 'provider_usage' ? 'known' : 'estimated', costCents: computeActualCosts({ step3: slot.metadata }).totalCost }
    : { status: 'unresolved', note: 'No complete provider token usage was returned; any charge for this attempted slot is unresolved.' }
}

const selectedOptions = (): LLMOptions => {
  const llm = getModelRegistry().llm
  return {
    outputDir: '.',
    openaiModels: Object.keys(llm['openai']!.models), geminiModels: Object.keys(llm['gemini']!.models),
    anthropicModels: Object.keys(llm['anthropic']!.models), grokModels: Object.keys(llm['grok']!.models)
  }
}

export const prepareWriteBenchmarkCase = async (entry: { prompt: string; input: string }): Promise<PreparedCase> => {
  const source = await Bun.file(entry.input).text()
  if (!source.trim()) throw ValidationError(`Empty benchmark input: ${entry.input}`)
  const schema = await resolveStructuredSchema([entry.prompt])
  const instruction = [await resolvePromptNames([entry.prompt], { exampleFormat: 'json' }), buildStructuredInstructionSuffix(schema.leafPromptNames)].join('\n\n')
  const title = getTextInputTitle(entry.input)
  return {
    source, schema,
    prompt: buildTextInputPrompt(source, { title, sourcePath: entry.input, instruction }),
    context: { leafPromptNames: schema.leafPromptNames, presetNames: schema.presetNames, songLyricsTitle: title }
  }
}

export const buildWriteBenchmarkPlan = async (approval: WriteBenchmarkPlan['approval'] = null): Promise<WriteBenchmarkPlan> => {
  const options = selectedOptions()
  const providers = collectLlmTargets(options).map(target => {
    const rates = getLlmCost(target.service, target.model)
    if (!rates) throw ValidationError(`Unknown model price: ${target.service}/${target.model}`)
    return { provider: target.service, model: target.model, inputCostPer1MCents: rates.inputCostPer1MCents, outputCostPer1MCents: rates.outputCostPer1MCents }
  })
  const cases = []
  for (const entry of WRITE_BENCHMARK_CASES) {
    const prepared = await prepareWriteBenchmarkCase(entry)
    const estimates = await buildLlmEstimates({ ...options, prompts: [entry.prompt] }, prepared.source)
    cases.push({ ...entry, runDir: `docs/benchmarks/text/write/2026-10-18_${entry.id}`, estimatedCostCents: estimates.reduce((sum, estimate) => sum + estimate.totalCost, 0), sourceSha256: sha256Bytes(prepared.source), promptSha256: sha256Bytes(prepared.prompt), schemaSha256: sha256Bytes(JSON.stringify(prepared.schema.jsonSchema)) })
  }
  const content = {
    schemaVersion: 1 as const, benchmarkDate: '2026-10-18', repetitions: 1 as const, providerConcurrency: 2 as const,
    qualityProxy: { method: 'model-output-unit-price' as const, label: 'Price proxy ($ / 1M output tokens)', higherIsBetter: true as const },
    providers, cases, baseEstimatedCostCents: cases.reduce((sum, entry) => sum + entry.estimatedCostCents, 0),
    approval,
    policy: { validationRetries: 0 as const, transportRetries: 'Only explicit HTTP 429 admission responses may be retried; no retry after transport ambiguity or inference response.', repetitions: 1 as const, reasoningEffort: 'existing-cli-defaults' as const, estimateLimitations: 'Existing CLI/model defaults apply. Registry heuristic; generated reasoning, provider tokenization and caching may change actual cost. Estimate is not a hard spending cap.' }
  }
  return { ...content, fingerprint: sha256Bytes(JSON.stringify(content)) }
}

const atomicJson = async (path: string, value: unknown): Promise<void> => {
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`
  await Bun.write(temporary, json(value))
  await rename(temporary, path)
}

/** Install only while running this standalone benchmark; AsyncLocalStorage isolates concurrent slots. */
export const installWriteBenchmarkFetchGuard = (): (() => void) => {
  const original = globalThis.fetch
  const guarded = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const budget = requestBudget.getStore()
    if (!budget) return await original(...args)
    if (budget.requests > 0 && !budget.retryAdmitted) throw ValidationError('Benchmark inference redispatch blocked: a request was already sent for this slot.')
    budget.requests++
    budget.retryAdmitted = false
    const response = await original(...args)
    budget.retryAdmitted = response.status === 429
    return response
  }) as typeof fetch
  guarded.preconnect = original.preconnect
  globalThis.fetch = guarded
  return () => { globalThis.fetch = original }
}

export const runWriteBenchmarkSlot = async (plan: WriteBenchmarkPlan, entry: WriteBenchmarkCase, prepared: PreparedCase, target: BenchmarkTarget): Promise<BenchmarkSlot> => {
  if (sha256Bytes(prepared.source) !== entry.sourceSha256 || sha256Bytes(prepared.prompt) !== entry.promptSha256 || sha256Bytes(JSON.stringify(prepared.schema.jsonSchema)) !== entry.schemaSha256) {
    throw ValidationError(`Benchmark case inputs changed before dispatch: ${entry.id}`)
  }
  const stem = safeStem(target.service, target.model)
  const slotPath = join(entry.runDir, `slot-${stem}.json`)
  if (await Bun.file(slotPath).exists()) {
    const existing = await Bun.file(slotPath).json() as BenchmarkSlot
    if (existing.planFingerprint !== plan.fingerprint || existing.caseId !== entry.id || existing.provider !== target.service || existing.model !== target.model) throw ValidationError(`Cached slot identity changed: ${toProjectRelativePath(slotPath)}`)
    for (const [name, expected] of Object.entries(existing.artifactHashes ?? {})) {
      if (name !== name.split(/[/\\]/).pop()) throw ValidationError('Cached artifact must be a file within its run directory.')
      if (!await Bun.file(join(entry.runDir, name)).exists() || sha256Bytes(await Bun.file(join(entry.runDir, name)).text()) !== expected) throw ValidationError(`Cached artifact missing or changed: ${toProjectRelativePath(join(entry.runDir, name))}; redispatch is blocked.`)
    }
    return existing
  }
  const registeredModels = getModelRegistry().llm[target.service]?.models
  if (!['openai', 'gemini', 'anthropic', 'grok'].includes(target.service) || !registeredModels || !Object.hasOwn(registeredModels, target.model)) throw ValidationError(`Retired or unsupported benchmark model ${target.service}/${target.model}; new dispatch is blocked. Existing receipts remain available for cache verification.`)
  const activeService = target.service as LLMService
  await mkdir(entry.runDir, { recursive: true })
  const slot: BenchmarkSlot = { schemaVersion: 1, planFingerprint: plan.fingerprint, caseId: entry.id, provider: target.service, model: target.model, status: 'dispatch-started', startedAt: new Date().toISOString() }
  // Exclusive creation and fsync bind an irreversible attempt before any network request.
  const handle = await open(slotPath, 'wx')
  try { await handle.writeFile(json(slot)); await handle.sync() } finally { await handle.close() }
  const started = Date.now()
  const budget = { requests: 0, retryAdmitted: false }
  slot.artifactHashes = {}
  const saveArtifact = async (name: string, value: string): Promise<void> => {
    await Bun.write(join(entry.runDir, name), value)
    slot.artifactHashes![name] = sha256Bytes(value)
  }
  try {
    const response = await requestBudget.run(budget, async () => await target.run(prepared.prompt, target.model, { schemaName: prepared.schema.schemaName, schema: prepared.schema.jsonSchema, strict: shouldApplyStrictMode(activeService, true), strategy: 'native' }))
    const outputFileName = `text-${stem}.json`
    // Retain billable usage before any validation, rendering, or artifact operation can throw.
    slot.metadata = { ...response.metadata, outputFileName, outputFormat: 'json', structuredMode: 'native', structuredPresetNames: prepared.schema.presetNames, validationFailed: true }
    setSlotBilling(slot)
    const rawName = `raw-response-${stem}-attempt-1.json`
    await saveArtifact(rawName, json(response))
    const validation = parseAndValidateStructured(prepared.schema.schema, response.result, prepared.context)
    const parsedJson = validation.success ? validation.value : buildStructuredValidationFailureEnvelope(response.result, validation.issue ?? 'Schema validation failed')
    const renderedName = `text-${stem}.md`
    await saveArtifact(outputFileName, json(parsedJson))
    await saveArtifact(renderedName, `${renderToPlainText(parsedJson, prepared.schema.leafPromptNames).trimEnd()}\n`)
    slot.status = validation.success ? 'completed' : 'validation-failed'
    slot.metadata.validationFailed = !validation.success
  } catch (error) {
    slot.status = 'failed'
    slot.error = stripProjectRoot(sanitizeArtifactText(error instanceof Error ? error.message : String(error)))
    const errorMetadata = extractErrorMetadata(error)
    const rawResponse = errorMetadata['rawResponse']
    const rawUsage = errorMetadata['rawProviderUsage'] ?? (isRecord(rawResponse) ? rawResponse['usage'] ?? rawResponse['usageMetadata'] : undefined)
    if (!slot.metadata && rawUsage !== undefined) {
      const usage = target.service === 'grok' && isRecord(rawUsage) ? normalizeGrokChatUsage(rawUsage) : rawUsage
      const timing = await runWithLLMInstrumentation(prepared.prompt, async () => ({ text: '', usage, rawProviderUsage: sanitizeFailureValue(rawUsage), returnedModel: typeof errorMetadata['returnedModel'] === 'string' ? errorMetadata['returnedModel'] : undefined,
        requestSettings: isRecord(errorMetadata['requestSettings']) ? errorMetadata['requestSettings'] : undefined }))
      if (timing.tokenCountSource === 'provider_usage') {
        slot.metadata = { ...buildStep3Metadata(target.service, target.model, { ...timing, processingTime: Date.now() - started }), outputFileName: '', structuredMode: 'native', structuredPresetNames: prepared.schema.presetNames, validationFailed: true }
      }
    }
    setSlotBilling(slot)
    const failureName = `failure-${stem}.json`
    const failure = { schemaVersion: 1, provider: target.service, model: target.model, error: { name: error instanceof Error ? error.name : 'Error', message: slot.error, status: getErrorStatus(error), metadata: sanitizeFailureValue(errorMetadata) }, billing: slot.billing,
      responseRepresentation: 'Decoded adapter response; original HTTP bytes are unavailable. Credential redaction and project path normalization are applied; original decoded serialization hash is retained.',
      ...(rawResponse !== undefined ? { rawResponse: sanitizeFailureValue(rawResponse), originalDecodedResponseSha256: sha256Bytes(JSON.stringify(rawResponse)) } : {}),
      ...(rawUsage !== undefined ? { rawProviderUsage: sanitizeFailureValue(rawUsage) } : {}) }
    try { await saveArtifact(failureName, json(failure)) }
    catch (evidenceError) { slot.failureEvidenceError = stripProjectRoot(sanitizeArtifactText(evidenceError instanceof Error ? evidenceError.message : String(evidenceError))) }
  }
  slot.completedAt = new Date().toISOString()
  slot.wallTimeMs = Date.now() - started
  slot.networkAttempts = budget.requests
  await atomicJson(slotPath, slot)
  return slot
}

export const finalizeWriteBenchmarkCase = async (plan: WriteBenchmarkPlan, entry: WriteBenchmarkCase, prepared: PreparedCase, slots: BenchmarkSlot[]): Promise<void> => {
  const step3 = slots.flatMap(slot => slot.metadata ? [slot.metadata] : [])
  const llmTargets = step3.map(metadata => ({ service: metadata.llmService, model: metadata.llmModel, inputTokens: metadata.inputTokenCount, outputTokens: metadata.outputTokenCount }))
  const estimates = (await buildLlmEstimates({ ...selectedOptions(), prompts: [entry.prompt] }, prepared.source))
    .filter(estimate => plan.providers.some(provider => provider.provider === estimate.provider && provider.model === estimate.model))
  const estimated = { totalCost: entry.estimatedCostCents, steps: estimates.map(({ totalCost, ...estimate }) => ({ ...estimate, cost: totalCost })) }
  const observedEstimate = computeEstimatedCosts({ applyCostMultipliers: false, llmTargets })
  const actual = computeActualCosts({ step3 })
  const timing = { actual: computeActualProcessingTimes({ step3 }) }
  const providers = slots.map(slot => ({ service: slot.provider, model: slot.model, artifactDir: '.', status: slot.status === 'dispatch-started' ? 'running' : slot.status === 'failed' ? 'failed' : 'succeeded', attempts: 1, options: {}, metadata: {}, ...(slot.error ? { error: { message: slot.error } } : {}) }))
  const metadata = {
    title: entry.id, source: { kind: 'text-input', inputPath: entry.input, slug: entry.id, snapshot: { path: 'source.txt', sha256: entry.sourceSha256 } },
    benchmark: { plan: WRITE_BENCHMARK_PLAN, fingerprint: plan.fingerprint, caseId: entry.id, prompt: entry.prompt, repetitions: 1, qualityProxy: plan.qualityProxy, priceNote: 'Usage-derived registry cost; provider invoice is authoritative. Cached inputs and generated reasoning are retained in raw usage.' },
    step3, requestedProviders: plan.providers.map(provider => ({ service: provider.provider, model: provider.model })), providerStates: providers,
    cost: { estimated, observedEstimate, actual }, timing
  }
  const status = slots.length === plan.providers.length && slots.every(slot => slot.status === 'completed') ? 'full' : slots.some(slot => slot.status === 'completed' || slot.status === 'validation-failed') ? 'incomplete' : 'failed'
  const existing = await readManifest(entry.runDir)
  const manifest = createManifest('write', 'single', [createPipelineItemFromRecord(entry.runDir, metadata, { status })])
  await writeManifest(entry.runDir, { ...manifest, ...(existing ? { createdAt: existing.createdAt } : {}) })
}

export const executeWriteBenchmark = async (plan: WriteBenchmarkPlan): Promise<void> => {
  const current = await buildWriteBenchmarkPlan(plan.approval)
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw ValidationError('Benchmark inputs, prompts, schema, models, prices or plan contents changed; refusing to dispatch against the saved approval plan.')
  if (!plan.approval || !Number.isFinite(plan.approval.estimatedCostCents) || plan.approval.estimatedCostCents < 0 || !plan.approval.scope.trim() || !plan.approval.evidence.trim()) throw UsageError('The active benchmark plan requires its own explicit cost-specific approval; historical approval does not authorize a changed batch.')
  const restoreFetch = installWriteBenchmarkFetchGuard()
  try {
    const available = collectLlmTargets(selectedOptions())
    for (const entry of plan.cases) {
      const prepared = await prepareWriteBenchmarkCase(entry)
      await mkdir(entry.runDir, { recursive: true })
      await Bun.write(join(entry.runDir, 'source.txt'), prepared.source)
      await Bun.write(join(entry.runDir, 'prompt.md'), prepared.prompt)
      const slots: BenchmarkSlot[] = []
      // Each provider has its own two-request pool, matching production provider concurrency.
      await Promise.all([...new Set(plan.providers.map(provider => provider.provider))].map(async provider => {
        const queue = available.filter(target => target.service === provider)
        await Promise.all(Array.from({ length: plan.providerConcurrency }, async () => {
          for (let target = queue.shift(); target; target = queue.shift()) {
            const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
            slots.push(slot)
            writeCommandPayload(JSON.stringify({ case: entry.id, provider: slot.provider, model: slot.model, status: slot.status, elapsedMs: slot.wallTimeMs, ...(slot.error ? { error: slot.error } : {}) }) + '\n')
          }
        }))
      }))
      slots.sort((a, b) => `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`))
      await finalizeWriteBenchmarkCase(plan, entry, prepared, slots)
    }
  } finally { restoreFetch() }
}

/** Historical evidence is checked against its pinned plan without consulting the active model inventory or writing manifests. */
export const verifyWriteBenchmarkCache = async (plan: WriteBenchmarkPlan): Promise<BenchmarkSlot[]> => {
  const { fingerprint, ...content } = plan
  if (sha256Bytes(JSON.stringify(content)) !== fingerprint || plan.schemaVersion !== 1 || !plan.cases.length || !plan.providers.length) throw ValidationError('Saved benchmark plan contents changed or are unsupported.')
  const slots: BenchmarkSlot[] = []
  for (const entry of plan.cases) {
    const prepared = await prepareWriteBenchmarkCase(entry)
    for (const [name, expected] of [['source.txt', entry.sourceSha256], ['prompt.md', entry.promptSha256]]) {
      const path = join(entry.runDir, name!)
      if (!await Bun.file(path).exists() || sha256Bytes(await Bun.file(path).text()) !== expected) throw ValidationError(`Cached benchmark snapshot missing or changed: ${toProjectRelativePath(path)}`)
    }
    for (const provider of plan.providers) {
      const path = join(entry.runDir, `slot-${safeStem(provider.provider, provider.model)}.json`)
      if (!await Bun.file(path).exists()) throw ValidationError(`Missing benchmark cache receipt: ${entry.id}/${provider.provider}/${provider.model}; verification cannot dispatch.`)
      slots.push(await runWriteBenchmarkSlot(plan, entry, prepared, { service: provider.provider, model: provider.model, label: provider.provider, run: async () => { throw ValidationError('Provider dispatch is blocked during benchmark cache verification.') } }))
    }
  }
  return slots
}

const main = async (): Promise<void> => {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    writeCommandPayload('Usage: bun src/tools/write-benchmark.ts [--price | --prepare | --run | --resume | --verify-cache]\nDefault: price-only JSON for the current active model inventory, without inferred approval. --prepare pins this five-case plan without replacing historical plans. --run and --resume require approval for that exact plan and attempt only slots without a durable attempt record. --verify-cache reads existing historical receipts and artifacts without provider dispatch or manifest changes.' + '\n')
    return
  }
  if (args.some(arg => !['--price', '--prepare', '--run', '--resume', '--verify-cache'].includes(arg)) || args.length > 1) throw UsageError('Choose one of --price, --prepare, --run, --resume or --verify-cache.')
  if (args.includes('--run') || args.includes('--resume') || args.includes('--verify-cache')) {
    if (!await Bun.file(WRITE_BENCHMARK_PLAN).exists()) throw UsageError('Run --prepare before dispatch.')
    const plan = await Bun.file(WRITE_BENCHMARK_PLAN).json() as WriteBenchmarkPlan
    if (args.includes('--verify-cache')) writeCommandPayload(json({ verifiedSlots: (await verifyWriteBenchmarkCache(plan)).length, networkRequests: 0 }) + '\n')
    else await executeWriteBenchmark(plan)
    return
  }
  const plan = await buildWriteBenchmarkPlan()
  if (args.includes('--prepare')) {
    if (await Bun.file(WRITE_BENCHMARK_PLAN).exists()) {
      const existing = await Bun.file(WRITE_BENCHMARK_PLAN).json() as WriteBenchmarkPlan
      if (JSON.stringify(existing) !== JSON.stringify(plan)) throw ValidationError('Saved benchmark plan differs; preserve it and reconcile approval before changing the batch.')
    } else {
      await atomicJson(WRITE_BENCHMARK_PLAN, plan)
    }
  }
  writeCommandPayload(json(plan) + '\n')
}

if (import.meta.main) await main()
