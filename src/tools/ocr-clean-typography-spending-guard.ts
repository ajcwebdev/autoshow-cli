import { AppValidationError } from '~/utils/error-handler'
import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'
import { isRecord, readJsonResponse } from '~/utils/rest-client'
import { CLEAN_TYPOGRAPHY_SOURCE_PINS } from './ocr-clean-typography-admission'
import type { CleanTypographySourcePin } from './ocr-clean-typography-admission'

// Isolated benchmark authorization, never a general CLI spending guarantee.
// The input allowance is a deliberately generous assumption, not a measured token count.
export const CLEAN_TYPOGRAPHY_INPUT_ALLOWANCE = 64_000
export const CLEAN_TYPOGRAPHY_OPENAI_OUTPUT_CAP = 16_384
export const CLEAN_TYPOGRAPHY_BUDGET_CENTS = 500
const OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER = 1.25
const inputAssumption = 'Unmeasured conservative allowance: <=64,000 input tokens for one pinned PNG <=2000x1500 and <=8192 UTF-8 bytes of request text/schema; not a provider-enforced input-token ceiling. A reported breach stops further dispatch.'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')

interface Rate { input: number, output: number, outputCap: number, pageCents?: number, cachedInput?: number }
const rate = (input: number, output: number, outputCap: number): Rate => ({ input, output, outputCap })
export const CLEAN_TYPOGRAPHY_SPENDING_RATES: Readonly<Record<string, Rate>> = {
  'mistral/mistral-ocr-4-0': { input: 0, output: 0, outputCap: 0, pageCents: 0.4 },
  'mistral/mistral-ocr-4-1': { input: 0, output: 0, outputCap: 0, pageCents: 0.4 },
  'openai/gpt-6.1-sol': { ...rate(200, 1000, 16384), cachedInput: 10 },
  'openai/gpt-6-luna': { ...rate(10, 50, 16384), cachedInput: 1 },
  'openai/gpt-6-astra': { ...rate(1000, 5000, 16384), cachedInput: 100 },
  'openai/gpt-5.6-terra': { ...rate(200, 1200, 16384), cachedInput: 20 },
  'grok/grok-4.7': rate(200, 600, 4096),
  'grok/grok-4.5': rate(200, 600, 4096),
  'anthropic/claude-opus-5-5': rate(400, 2000, 64000),
  'anthropic/claude-sonnet-5-5': rate(200, 1000, 64000),
  'anthropic/claude-haiku-5-5': rate(10, 50, 64000),
  'anthropic/claude-fable-5-1': rate(1000, 5000, 64000),
  'anthropic/claude-fable-5': rate(1000, 5000, 64000),
  'gemini/gemini-4-argon': rate(400, 2000, 32768),
  'gemini/gemini-3.8-flash': rate(150, 750, 8192),
  'gemini/gemini-3.5-flash': rate(150, 900, 8192),
  'gemini/gemini-3.6-flash': rate(150, 750, 8192),
  'gemini/gemini-3.5-flash-lite': rate(30, 250, 8192),
  // Use the greater of configured and independently reviewed current standard rates.
  'deepinfra/google/gemma-4-31B-it': rate(20, 40, 8192),
  'deepinfra/Qwen/Qwen3.8-27B': rate(20, 250, 8192),
  'deepinfra/deepseek-ai/DeepSeek-V4.1-Flash': rate(20, 60, 8192)
}

export interface CleanTypographySpendingReceipt {
  id: string
  invocationId: string
  caseId: string
  provider: string
  model: string
  requestSha256: string
  inputSha256: string
  reservedCents: number
  chargedCents: number
  status: 'reserved' | 'settled' | 'rejected' | 'ambiguous' | 'breach'
  createdAt: string
  completedAt?: string
  httpStatus?: number
  inputTokens?: number
  outputTokens?: number
  costBasis?: 'conservative-upper-bound' | 'provider-usage-at-reviewed-rates'
  costNote?: string
  reason?: string
  recoveryOfReceiptId?: string
  recoveryReconciliationSha256?: string
}
export interface CleanTypographyManualReconciliation {
  schemaVersion: 1
  kind: 'ocr-clean-typography-manual-reconciliation'
  action: 'retain-full-reservation-and-authorize-one-recovery-invocation'
  approvalBudgetCents: 500
  approvalEvidence: 'User approved up to $5'
  receiptId: string
  caseId: string
  provider: string
  model: string
  inputSha256: string
  httpStatus: 503
  reservedCents: number
  chargedCents: number
  reason: string
  createdAt: string
}
export interface CleanTypographySpendingLedger {
  schemaVersion: 1
  kind: 'ocr-clean-typography-spending-ledger'
  budgetCents: number
  inputTokenAssumption: string
  receipts: CleanTypographySpendingReceipt[]
  reconciliations?: Array<{ path: string, sha256: string }>
}
export interface CleanTypographySpendingGuardOptions {
  ledgerPath: string
  caseId: string
  provider: string
  model: string
  projectRoot?: string
  fetchImplementation?: typeof fetch
  trustedSources?: readonly CleanTypographySourcePin[]
  budgetCents?: number
  planPath?: string
}

function fail(message: string): never { throw new AppValidationError(`OCR spending guard: ${message}`) }
const finiteNonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const tokenCount = (value: unknown): value is number => finiteNonnegative(value) && Number.isSafeInteger(value)
const roundedCents = (value: number): number => Math.ceil(value * 1_000_000) / 1_000_000
const totalHeld = (ledger: CleanTypographySpendingLedger): number => ledger.receipts.reduce((sum, receipt) => sum + receipt.chargedCents, 0)
const reconciliationRoot = 'input/examples/document/ocr-clean-typography/reconciliations/'

// Official OpenAI documentation, checked 2026-10-23:
// https://developers.openai.com/api/docs/guides/prompt-caching
// Implicit caching is enabled by default; 30-minute writes use 1.25x input rates.
// https://developers.openai.com/api/docs/guides/fast-mode
// An omitted service_tier can inherit the project's higher-priced Fast setting.
const applyOpenAIStandardBillingControls = (body: Record<string, unknown>): void => {
  if (body['service_tier'] !== undefined && body['service_tier'] !== 'default') fail('only the OpenAI default service tier is authorized')
  body['service_tier'] = 'default'
  if (body['prompt_cache_retention'] !== undefined || body['prompt_cache_key'] !== undefined) fail('unreviewed OpenAI cache options are not authorized')
  const options = body['prompt_cache_options']
  if (options !== undefined && (!isRecord(options)
    || Object.keys(options).some(key => key !== 'mode' && key !== 'ttl')
    || (options['mode'] !== undefined && options['mode'] !== 'implicit' && options['mode'] !== 'explicit')
    || (options['ttl'] !== undefined && options['ttl'] !== '30m'))) fail('only reviewed OpenAI implicit/explicit caching with 30m retention is authorized')
  body['prompt_cache_options'] = { mode: isRecord(options) ? options['mode'] ?? 'implicit' : 'implicit', ttl: '30m' }
  const inspectBreakpoints = (value: unknown): void => {
    if (Array.isArray(value)) { for (const child of value) inspectBreakpoints(child); return }
    if (!isRecord(value)) return
    if ('prompt_cache_breakpoint' in value) {
      const breakpoint = value['prompt_cache_breakpoint']
      if (!isRecord(breakpoint) || breakpoint['mode'] !== 'explicit'
        || Object.keys(breakpoint).some(key => key !== 'mode' && key !== 'ttl')
        || (breakpoint['ttl'] !== undefined && breakpoint['ttl'] !== '30m')) fail('only reviewed OpenAI explicit 30m cache breakpoints are authorized')
    }
    for (const child of Object.values(value)) inspectBreakpoints(child)
  }
  inspectBreakpoints(body['input'])
}

interface ReviewedUsage {
  inputTokens: number
  outputTokens: number
  cents: number
  costBasis?: CleanTypographySpendingReceipt['costBasis']
  costNote?: string
}

const readOpenAIStandardUsage = (usage: Record<string, unknown>, pricing: Rate): ReviewedUsage | undefined => {
  const inputTokens = usage['input_tokens'], outputTokens = usage['output_tokens']
  if (!tokenCount(inputTokens) || !tokenCount(outputTokens)) return undefined
  const details = usage['input_tokens_details']
  if (details !== undefined && !isRecord(details)) return undefined
  const reads = isRecord(details) ? details['cached_tokens'] : undefined
  const writes = isRecord(details) ? details['cache_write_tokens'] : undefined
  if ((reads !== undefined && !tokenCount(reads)) || (writes !== undefined && !tokenCount(writes))) return undefined
  if ((tokenCount(reads) && reads > inputTokens) || (tokenCount(writes) && writes > inputTokens)) return undefined
  const lifetimes = isRecord(details) ? details['cache_write_tokens_details'] : undefined
  if (lifetimes !== undefined && (!isRecord(lifetimes)
    || Object.keys(lifetimes).some(key => key !== 'ttl_30m_tokens' && key !== 'ttl_12h_tokens')
    || !tokenCount(lifetimes['ttl_30m_tokens']) || !tokenCount(lifetimes['ttl_12h_tokens'])
    || lifetimes['ttl_12h_tokens'] !== 0 || !tokenCount(writes)
    || lifetimes['ttl_30m_tokens'] !== writes)) return undefined
  if (tokenCount(reads) && tokenCount(writes)) {
    if (reads + writes > inputTokens || pricing.cachedInput === undefined) return undefined
    const ordinary = inputTokens - reads - writes
    return {
      inputTokens, outputTokens,
      cents: roundedCents((ordinary * pricing.input + reads * pricing.cachedInput
        + writes * pricing.input * OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER + outputTokens * pricing.output) / 1_000_000),
      costBasis: 'provider-usage-at-reviewed-rates',
      costNote: 'Provider-reported ordinary/read/30m-write input components and inclusive output tokens valued at reviewed Standard rates; not invoice-reconciled charges.'
    }
  }
  // Older/incomplete usage does not establish which input tokens incurred writes.
  // Value all input at the highest admitted input rate rather than assuming no writes.
  return {
    inputTokens, outputTokens,
    cents: roundedCents((inputTokens * pricing.input * OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER + outputTokens * pricing.output) / 1_000_000),
    costBasis: 'conservative-upper-bound',
    costNote: 'Cache component usage is incomplete; all OpenAI input valued at the 1.25x default 30m-write rate, output at Standard rates. Conservative budget accounting, not actual invoice cost.'
  }
}

const validateLedger = (value: unknown, budgetCents: number): CleanTypographySpendingLedger => {
  if (!isRecord(value) || value['schemaVersion'] !== 1 || value['kind'] !== 'ocr-clean-typography-spending-ledger'
    || value['budgetCents'] !== budgetCents || value['inputTokenAssumption'] !== inputAssumption || !Array.isArray(value['receipts'])) fail('invalid or changed cumulative ledger')
  const ledger = value as unknown as CleanTypographySpendingLedger
  const ids = new Set<string>()
  for (const receipt of ledger.receipts) {
    if (!isRecord(receipt) || typeof receipt.id !== 'string' || ids.has(receipt.id)
      || !finiteNonnegative(receipt.reservedCents) || !finiteNonnegative(receipt.chargedCents)
      || !['reserved', 'settled', 'rejected', 'ambiguous', 'breach'].includes(receipt.status)
      || typeof receipt.caseId !== 'string' || typeof receipt.provider !== 'string' || typeof receipt.model !== 'string'
      || typeof receipt.invocationId !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.requestSha256)
      || !/^[a-f0-9]{64}$/.test(receipt.inputSha256)) fail('invalid receipt in cumulative ledger')
    ids.add(receipt.id)
    if (receipt.status === 'rejected' && receipt.chargedCents !== 0) fail('rejected receipt carries unexpected spending')
    if (['reserved', 'ambiguous'].includes(receipt.status) && receipt.chargedCents !== receipt.reservedCents) fail('unresolved request reservation changed')
    if (receipt.recoveryOfReceiptId !== undefined && (typeof receipt.recoveryOfReceiptId !== 'string' || !receipt.recoveryOfReceiptId
      || typeof receipt.recoveryReconciliationSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.recoveryReconciliationSha256))) fail('invalid recovery receipt identity')
  }
  if (ledger.reconciliations !== undefined && (!Array.isArray(ledger.reconciliations)
    || ledger.reconciliations.some(entry => !isRecord(entry) || typeof entry.path !== 'string'
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)))) fail('invalid manual reconciliation overlay')
  return ledger
}

/** The historical 503 receipt remains unchanged and charged in full. Only a pinned, explicit record can authorize recovery. */
const validateReconciliations = async (
  ledger: CleanTypographySpendingLedger,
  root: string,
  pins: readonly CleanTypographySourcePin[]
): Promise<Map<string, { sha256: string, record: CleanTypographyManualReconciliation }>> => {
  const authorized = new Map<string, { sha256: string, record: CleanTypographyManualReconciliation }>()
  const paths = new Set<string>()
  for (const link of ledger.reconciliations ?? []) {
    if (!link.path.startsWith(reconciliationRoot) || link.path.includes('\\') || link.path.split('/').includes('..') || paths.has(link.path)) fail('manual reconciliation must have a unique private project-relative path')
    paths.add(link.path)
    const actual = await realpath(resolve(root, link.path))
    const local = relative(await realpath(root), actual).replaceAll('\\', '/')
    if (!local.startsWith(reconciliationRoot)) fail('manual reconciliation escaped its private directory')
    const bytes = await readFile(actual)
    if (bytes.length > 16_384 || hash(bytes) !== link.sha256) fail('manual reconciliation checksum changed')
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (!isRecord(value) || value['schemaVersion'] !== 1 || value['kind'] !== 'ocr-clean-typography-manual-reconciliation'
      || value['action'] !== 'retain-full-reservation-and-authorize-one-recovery-invocation'
      || value['approvalBudgetCents'] !== CLEAN_TYPOGRAPHY_BUDGET_CENTS || ledger.budgetCents !== CLEAN_TYPOGRAPHY_BUDGET_CENTS
      || value['approvalEvidence'] !== 'User approved up to $5' || typeof value['receiptId'] !== 'string'
      || typeof value['reason'] !== 'string' || !value['reason'].trim() || typeof value['createdAt'] !== 'string'
      || !Number.isFinite(Date.parse(value['createdAt']))) fail('manual reconciliation does not establish the approved recovery action')
    const receipt = ledger.receipts.find(entry => entry.id === value['receiptId'])
    if (!receipt || receipt.status !== 'ambiguous' || receipt.httpStatus !== 503 || value['httpStatus'] !== 503
      || receipt.chargedCents !== receipt.reservedCents || receipt.reservedCents <= 0
      || value['reservedCents'] !== receipt.reservedCents || value['chargedCents'] !== receipt.chargedCents
      || value['caseId'] !== receipt.caseId || value['provider'] !== receipt.provider || value['model'] !== receipt.model
      || value['inputSha256'] !== receipt.inputSha256
      || !pins.some(pin => pin.id === receipt.caseId && pin.inputSha256 === receipt.inputSha256)
      || !CLEAN_TYPOGRAPHY_SPENDING_RATES[`${receipt.provider}/${receipt.model}`]
      || Date.parse(value['createdAt']) < Date.parse(receipt.completedAt ?? receipt.createdAt)
      || authorized.has(receipt.id)) fail('manual reconciliation differs from the retained HTTP 503 receipt')
    authorized.set(receipt.id, { sha256: link.sha256, record: value as unknown as CleanTypographyManualReconciliation })
  }
  const recoveries = new Map<string, Set<string>>()
  for (const [index, receipt] of ledger.receipts.entries()) {
    if (receipt.recoveryOfReceiptId === undefined) continue
    const authorization = authorized.get(receipt.recoveryOfReceiptId)
    const parentIndex = ledger.receipts.findIndex(entry => entry.id === receipt.recoveryOfReceiptId)
    const parent = ledger.receipts[parentIndex]
    if (!authorization || !parent || parentIndex >= index || receipt.invocationId === parent.invocationId
      || receipt.recoveryReconciliationSha256 !== authorization.sha256
      || receipt.caseId !== parent.caseId || receipt.provider !== parent.provider || receipt.model !== parent.model
      || receipt.inputSha256 !== parent.inputSha256 || Date.parse(receipt.createdAt) < Date.parse(authorization.record.createdAt)) fail('recovery request does not match its immutable manual authorization')
    const invocations = recoveries.get(parent.id) ?? new Set<string>()
    invocations.add(receipt.invocationId)
    if (invocations.size > 1) fail('a manual reconciliation cannot authorize a second recovery invocation')
    recoveries.set(parent.id, invocations)
  }
  return authorized
}

const atomicWrite = async (path: string, ledger: CleanTypographySpendingLedger): Promise<void> => {
  const temporary = `${path}.${randomUUID()}.tmp`
  const file = await open(temporary, 'wx', 0o600)
  try { await file.writeFile(JSON.stringify(ledger, null, 2) + '\n'); await file.sync() } finally { await file.close() }
  await rename(temporary, path)
  const directory = await open(dirname(path), 'r')
  try { await directory.sync() } finally { await directory.close() }
}

const endpoint = (provider: string, model: string): string => {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1/responses'
    case 'anthropic': return 'https://api.anthropic.com/v1/messages'
    case 'mistral': return 'https://api.mistral.ai/v1/ocr'
    case 'grok': return 'https://api.x.ai/v1/chat/completions'
    case 'deepinfra': return 'https://api.deepinfra.com/v1/openai/chat/completions'
    case 'gemini': return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    default: return fail('unrecognized provider')
  }
}

const validateImage = (body: Record<string, unknown>, pin: CleanTypographySourcePin): void => {
  let images = 0
  const check = (base64: string): string => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) fail('invalid image base64')
    const bytes = Buffer.from(base64, 'base64')
    if (hash(bytes) !== pin.inputSha256 || bytes.toString('base64') !== base64) fail('image does not match the authorized source hash')
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
      || bytes.readUInt32BE(16) !== pin.width || bytes.readUInt32BE(20) !== pin.height
      || pin.width > 2000 || pin.height > 1500) fail('image exceeds the reviewed PNG dimensions')
    images++
    return '<verified-png>'
  }
  const scrub = (value: unknown): unknown => {
    if (typeof value === 'string') {
      if (value.startsWith('data:image/png;base64,')) return check(value.slice('data:image/png;base64,'.length))
      if (/^(?:data:|https?:\/\/)/.test(value)) fail('unapproved remote or additional media input')
      return value
    }
    if (Array.isArray(value)) return value.map(scrub)
    if (!isRecord(value)) return value
    if (value['type'] === 'base64') {
      if (value['media_type'] !== 'image/png' || typeof value['data'] !== 'string') fail('unapproved inline image format')
      return { ...value, data: check(value['data']) }
    }
    if ('mimeType' in value && 'data' in value) {
      if (value['mimeType'] !== 'image/png' || typeof value['data'] !== 'string') fail('unapproved Gemini media input')
      return { ...value, data: check(value['data']) }
    }
    if ('fileData' in value || value['type'] === 'input_file' || value['type'] === 'document_url') fail('unapproved document or uploaded file')
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, scrub(child)]))
  }
  const scrubbed = scrub(body)
  if (images !== 1) fail('expected exactly one authorized PNG input')
  if (Buffer.byteLength(JSON.stringify(scrubbed), 'utf8') > 8192) fail('request text/schema exceeds the reviewed 8192-byte allowance')
}

const readUsage = (provider: string, payload: unknown, pricing: Rate): ReviewedUsage | undefined => {
  if (!isRecord(payload)) return undefined
  if (pricing.pageCents !== undefined) {
    const usage = payload['usage_info']
    if (!isRecord(usage) || usage['pages_processed'] !== 1) return undefined
    return { inputTokens: 0, outputTokens: 0, cents: pricing.pageCents }
  }
  const usage = provider === 'gemini' ? payload['usageMetadata'] : payload['usage']
  if (!isRecord(usage)) return undefined
  if (provider === 'openai') return readOpenAIStandardUsage(usage, pricing)
  let inputTokens: unknown, outputTokens: unknown
  if (provider === 'gemini') {
    inputTokens = usage['promptTokenCount']
    const candidates = usage['candidatesTokenCount'], thoughts = usage['thoughtsTokenCount'] ?? 0
    if (!tokenCount(candidates) || !tokenCount(thoughts)) return undefined
    outputTokens = candidates + thoughts
  } else if (provider === 'anthropic') {
    const input = usage['input_tokens'], cached = usage['cache_read_input_tokens'] ?? 0, created = usage['cache_creation_input_tokens'] ?? 0
    if (!tokenCount(input) || !tokenCount(cached) || !tokenCount(created) || cached !== 0 || created !== 0) return undefined
    inputTokens = input; outputTokens = usage['output_tokens']
  } else if (provider === 'grok') {
    inputTokens = usage['prompt_tokens']
    const visible = usage['completion_tokens'], details = usage['completion_tokens_details']
    const reasoning = isRecord(details) ? details['reasoning_tokens'] ?? 0 : 0
    if (!tokenCount(visible) || !tokenCount(reasoning)) return undefined
    outputTokens = visible + reasoning
  } else {
    inputTokens = usage['prompt_tokens']; outputTokens = usage['completion_tokens']
    // OpenAI-compatible completion_tokens already includes reasoning; never add it again.
  }
  if (!tokenCount(inputTokens) || !tokenCount(outputTokens)) return undefined
  return { inputTokens, outputTokens, cents: roundedCents((inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000) }
}

export const createCleanTypographySpendingGuard = (options: CleanTypographySpendingGuardOptions): typeof fetch => {
  const root = resolve(options.projectRoot ?? PROJECT_ROOT)
  if (isAbsolute(options.ledgerPath) || options.ledgerPath.split(/[\\/]/).includes('..')) fail('ledger must use a project-relative path')
  const path = resolve(root, options.ledgerPath)
  if (relative(root, path).startsWith('..')) fail('ledger escaped the project')
  const budgetCents = options.budgetCents ?? CLEAN_TYPOGRAPHY_BUDGET_CENTS
  if (!finiteNonnegative(budgetCents) || budgetCents > CLEAN_TYPOGRAPHY_BUDGET_CENTS) fail('approval ceiling cannot exceed 500 cents')
  const pin = (options.trustedSources ?? CLEAN_TYPOGRAPHY_SOURCE_PINS).find(entry => entry.id === options.caseId)
  const pricing = CLEAN_TYPOGRAPHY_SPENDING_RATES[`${options.provider}/${options.model}`]
  if (!pin || !pricing) fail('case/provider/model is outside the approved benchmark')
  const expectedEndpoint = endpoint(options.provider, options.model)
  const originalFetch = options.fetchImplementation ?? globalThis.fetch
  const invocationId = randomUUID()
  const planPath = options.planPath ?? 'docs/benchmarks/ocr/clean-typography-additions-plan.json'
  if (isAbsolute(planPath) || planPath.split(/[\\/]/).includes('..')) fail('approval plan must use a project-relative path')
  const update = async <T>(operation: (ledger: CleanTypographySpendingLedger) => T | Promise<T>): Promise<T> => {
    await mkdir(dirname(path), { recursive: true })
    const lock = await open(`${path}.lock`, 'wx', 0o600).catch(() => fail('ledger locked; another process or an interrupted writer requires reconciliation'))
    try {
      let value: unknown
      try { value = JSON.parse(await readFile(path, 'utf8')) } catch (error) {
        if (!isRecord(error) || error['code'] !== 'ENOENT') throw error
        value = { schemaVersion: 1, kind: 'ocr-clean-typography-spending-ledger', budgetCents, inputTokenAssumption: inputAssumption, receipts: [] }
      }
      const ledger = validateLedger(value, budgetCents)
      const result = await operation(ledger)
      await atomicWrite(path, ledger)
      return result
    } finally { await lock.close(); await unlink(`${path}.lock`) }
  }
  const guarded = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const plan: unknown = JSON.parse(await readFile(resolve(root, planPath), 'utf8'))
    const approval = isRecord(plan) ? plan['approval'] : undefined
    if (!isRecord(approval) || approval['status'] !== 'approved' || approval['budgetCents'] !== CLEAN_TYPOGRAPHY_BUDGET_CENTS
      || approval['evidence'] !== 'User approved up to $5') fail('the persisted plan does not contain the explicit user approval')
    if (input instanceof Request || typeof init?.body !== 'string' || (init.method ?? 'GET') !== 'POST') fail('only explicit JSON generation POST requests are authorized')
    const url = new URL(String(input))
    if (url.href !== expectedEndpoint || url.username || url.password) fail('unapproved provider host, path, query, or model')
    let parsed: unknown
    try { parsed = JSON.parse(init.body) } catch { return fail('request body is not JSON') }
    if (!isRecord(parsed)) fail('request body is not an object')
    const body = parsed
    if (options.provider !== 'gemini' && body['model'] !== options.model) fail('request model differs from the approved target')
    if (body['stream'] === true || body['tools'] !== undefined || (options.provider !== 'openai' && body['service_tier'] !== undefined) || body['n'] !== undefined) fail('streaming, tools, alternate tiers, or multiple outputs are not authorized')
    if (options.provider === 'openai') {
      applyOpenAIStandardBillingControls(body)
      if (body['max_output_tokens'] !== undefined && body['max_output_tokens'] !== CLEAN_TYPOGRAPHY_OPENAI_OUTPUT_CAP) fail('unexpected OpenAI output cap')
      body['max_output_tokens'] = CLEAN_TYPOGRAPHY_OPENAI_OUTPUT_CAP
    } else if (options.provider === 'gemini') {
      const config = body['generationConfig']
      if (!isRecord(config) || config['maxOutputTokens'] !== pricing.outputCap || config['candidateCount'] !== undefined) fail('unexpected Gemini output cap or candidate count')
    } else if (pricing.pageCents === undefined) {
      const field = options.provider === 'grok' ? 'max_completion_tokens' : 'max_tokens'
      if (body[field] !== pricing.outputCap) fail('unexpected native output cap')
    }
    validateImage(body, pin)
    const bodyText = JSON.stringify(body)
    const inputRate = pricing.input * (options.provider === 'openai' ? OPENAI_DEFAULT_CACHE_WRITE_MULTIPLIER : 1)
    const reserve = pricing.pageCents ?? roundedCents((CLEAN_TYPOGRAPHY_INPUT_ALLOWANCE * inputRate + pricing.outputCap * pricing.output) / 1_000_000)
    const receipt: CleanTypographySpendingReceipt = {
      id: randomUUID(), invocationId, caseId: options.caseId, provider: options.provider, model: options.model,
      requestSha256: hash(bodyText), inputSha256: pin.inputSha256, reservedCents: reserve, chargedCents: reserve,
      status: 'reserved', createdAt: new Date().toISOString(),
      ...(options.provider === 'openai' ? { costBasis: 'conservative-upper-bound' as const,
        costNote: 'Reservation uses the unmeasured 64k input allowance at the 1.25x default 30m-write rate and the output cap at Standard rates; not actual invoice cost.' } : {})
    }
    await update(async ledger => {
      const authorized = await validateReconciliations(ledger, root, options.trustedSources ?? CLEAN_TYPOGRAPHY_SOURCE_PINS)
      if (ledger.receipts.some(entry => entry.status === 'reserved' || entry.status === 'breach'
        || (entry.status === 'ambiguous' && !authorized.has(entry.id)))) fail('unresolved admitted request or allowance breach requires reconciliation')
      const slot = ledger.receipts.filter(entry => entry.caseId === options.caseId && entry.provider === options.provider && entry.model === options.model)
      if (slot.some(entry => entry.invocationId !== invocationId && !authorized.has(entry.id)
        && (entry.status !== 'rejected' || entry.recoveryOfReceiptId !== undefined))) fail('this slot already has admitted evidence or consumed its recovery invocation; automatic redispatch is blocked')
      const priorAmbiguous = slot.filter(entry => authorized.has(entry.id)).reverse()
      if (priorAmbiguous.length > 0) {
        const parent = priorAmbiguous.find(entry => {
          const attempts = slot.filter(attempt => attempt.recoveryOfReceiptId === entry.id)
          return entry.invocationId !== invocationId && (attempts.length === 0 || attempts.every(attempt => attempt.invocationId === invocationId))
        })
        if (!parent) fail('the one manually authorized recovery invocation was already consumed')
        receipt.recoveryOfReceiptId = parent.id
        receipt.recoveryReconciliationSha256 = authorized.get(parent.id)!.sha256
      }
      if (slot.filter(entry => entry.status === 'settled').length >= 3 || slot.length >= 12) fail('maximum request attempts reached')
      if (totalHeld(ledger) + reserve > budgetCents + 1e-9) fail(`request reservation ${reserve.toFixed(6)} cents exceeds the remaining cumulative approval`)
      ledger.receipts.push(receipt)
    })
    const finish = async (change: Partial<CleanTypographySpendingReceipt>): Promise<void> => {
      await update(ledger => {
        const found = ledger.receipts.find(entry => entry.id === receipt.id)
        if (!found || found.status !== 'reserved') fail('request reservation is missing or already settled')
        Object.assign(found, change, { completedAt: new Date().toISOString() })
      })
    }
    let response: Response
    try { response = await originalFetch(input, { ...init, body: bodyText, redirect: 'error' }) } catch (error) {
      await finish({ status: 'ambiguous', reason: 'transport outcome unknown; full reservation retained' })
      throw error
    }
    // These explicit rejection statuses do not indicate a generated inference response.
    if ([400, 401, 403, 404, 405, 413, 415, 422, 429].includes(response.status)) {
      let rejectedPayload: unknown
      try { rejectedPayload = await readJsonResponse(response.clone() as Response, 'OCR rejected admission', { maxBytes: 8 * 1024 * 1024 }) } catch { rejectedPayload = undefined }
      if (isRecord(rejectedPayload) && (rejectedPayload['usage'] !== undefined || rejectedPayload['usageMetadata'] !== undefined || rejectedPayload['usage_info'] !== undefined)) {
        await finish({ status: 'ambiguous', httpStatus: response.status, reason: 'rejected HTTP status included inference usage; full reservation retained' })
        return fail('rejected status included inference usage; further dispatch blocked')
      }
      await finish({ status: 'rejected', chargedCents: 0, httpStatus: response.status, reason: 'explicit pre-admission rejection' })
      return response
    }
    let payload: unknown
    try { payload = await readJsonResponse(response.clone() as Response, 'OCR spending receipt', { maxBytes: 8 * 1024 * 1024 }) } catch {
      await finish({ status: 'ambiguous', httpStatus: response.status, reason: 'unreadable provider usage; full reservation retained' })
      return fail('provider usage was unreadable; further dispatch blocked')
    }
    if (response.ok && options.provider === 'openai' && (!isRecord(payload) || payload['service_tier'] !== 'default')) {
      await finish({ status: 'ambiguous', httpStatus: response.status, reason: 'OpenAI response did not confirm the Standard default service tier; full reservation retained' })
      return fail('OpenAI response did not confirm the Standard default service tier; further dispatch blocked')
    }
    const usage = response.ok ? readUsage(options.provider, payload, pricing) : undefined
    if (!usage) {
      await finish({ status: 'ambiguous', httpStatus: response.status, reason: 'missing complete usage or ambiguous HTTP status; full reservation retained' })
      return fail('provider response did not establish complete usage; further dispatch blocked')
    }
    const breach = usage.inputTokens > CLEAN_TYPOGRAPHY_INPUT_ALLOWANCE || usage.outputTokens > pricing.outputCap || usage.cents > reserve + 1e-9
    await finish({ status: breach ? 'breach' : 'settled', chargedCents: Math.max(breach ? reserve : 0, usage.cents),
      httpStatus: response.status, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      ...(breach ? { costBasis: 'conservative-upper-bound' as const,
        costNote: 'Allowance breach: retain the greater of the reservation and locally valued usage; not invoice-reconciled charges.' }
        : usage.costBasis ? { costBasis: usage.costBasis, costNote: usage.costNote } : {}),
      ...(breach ? { reason: 'reported usage exceeded the reserved allowance; further dispatch blocked' } : {}) })
    if (breach) return fail('reported usage exceeded the reserved allowance; further dispatch blocked')
    return response
  }) as typeof fetch
  guarded.preconnect = originalFetch.preconnect
  return guarded
}

if (process.env['AUTOSHOW_OCR_SPENDING_GUARD'] === '1') {
  const required = (name: string): string => process.env[name]?.trim() || fail(`missing ${name}`)
  globalThis.fetch = createCleanTypographySpendingGuard({
    ledgerPath: required('AUTOSHOW_OCR_SPENDING_LEDGER'), caseId: required('AUTOSHOW_OCR_SPENDING_CASE'),
    provider: required('AUTOSHOW_OCR_SPENDING_PROVIDER'), model: required('AUTOSHOW_OCR_SPENDING_MODEL')
  })
}
