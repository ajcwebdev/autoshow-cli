import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CATEGORY_D_CASE_PAGES, createCategoryDSpendingGuard } from '~/tools/ocr-category-d-spending-guard'
import type { CategoryDExecutionPlan, CategoryDManualReconciliation, CategoryDSpendingGuardOptions, CategoryDSpendingLedger } from '~/tools/ocr-category-d-spending-guard'
import { createCategoriesBcSpendingGuard, createApprovedOcrBenchmarkSpendingGuard } from '~/tools/ocr-categories-bc-spending-guard'
import { runOpenAIOcr } from '~/cli/commands/text/ocr/ocr-services/openai-ocr/run-openai-ocr'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { runMistralOcr } from '~/cli/commands/text/ocr/ocr-services/mistral-ocr/run-mistral-ocr'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const base = 'input/examples/document/ocr-category-d-run'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
// Native endpoint/output-control contracts; the benchmark adds its explicit OpenAI output ceiling.
const contracts: ReadonlyArray<[string, string, number]> = [
  ['openai', 'gpt-6.1-sol', 16384], ['openai', 'gpt-6-luna', 16384], ['openai', 'gpt-6-astra', 16384], ['openai', 'gpt-5.6-terra', 16384],
  ['anthropic', 'claude-opus-5-5', 64000], ['anthropic', 'claude-sonnet-5-5', 64000], ['anthropic', 'claude-haiku-5-5', 64000],
  ['anthropic', 'claude-fable-5-1', 64000], ['anthropic', 'claude-fable-5', 64000],
  ['gemini', 'gemini-4-argon', 32768], ['gemini', 'gemini-3.8-flash', 8192], ['gemini', 'gemini-3.5-flash', 8192], ['gemini', 'gemini-3.6-flash', 8192], ['gemini', 'gemini-3.5-flash-lite', 8192],
  ['grok', 'grok-4.7', 4096], ['grok', 'grok-4.5', 4096], ['deepinfra', 'google/gemma-4-31B-it', 8192], ['deepinfra', 'Qwen/Qwen3.8-27B', 8192], ['deepinfra', 'deepseek-ai/DeepSeek-V4.1-Flash', 8192], ['mistral', 'mistral-ocr-4-1', 0]
]
const endpoints: Record<string, string> = { openai: 'https://api.openai.com/v1/responses', anthropic: 'https://api.anthropic.com/v1/messages',
  grok: 'https://api.x.ai/v1/chat/completions', deepinfra: 'https://api.deepinfra.com/v1/openai/chat/completions', mistral: 'https://api.mistral.ai/v1/ocr' }
const usage = (provider: string): unknown => provider === 'openai'
  ? { service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } } }
  : provider === 'anthropic' ? { usage: { input_tokens: 1000, output_tokens: 200 } }
    : provider === 'gemini' ? { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100 } }
      : provider === 'mistral' ? { usage_info: { pages_processed: 1 } }
        : { usage: { prompt_tokens: 1000, completion_tokens: 200, completion_tokens_details: { reasoning_tokens: 150 } } }
const jpeg = await new Bun.Image(redDotPng).resize(16, 12).jpeg().bytes()

const fixture = async (provider = 'openai', model = 'gpt-6-astra') => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-d-budget-')); roots.push(root); await mkdir(join(root, base), { recursive: true })
  const pages = Object.keys(CATEGORY_D_CASE_PAGES).map(caseId => ({ id: `${caseId}-page-01`, caseId, pageNumber: 1,
    input: `${base}/pages/${caseId}.jpg`, inputSha256: hash(jpeg), width: 16, height: 12 }))
  const plan: CategoryDExecutionPlan = { schemaVersion: 1, kind: 'ocr-category-d-execution-plan', approval: { status: 'approved', budgetCents: 2500, evidence: 'User approved up to $25 for category 4' }, pages,
    targets: [...contracts.map(([provider, model]) => ({ provider, model })), { provider: 'tesseract', model: 'tesseract' }] }
  const planPath = `${base}/execution-plan.json`, ledgerPath = `${base}/spending-ledger.json`, bytes = JSON.stringify(plan, null, 2) + '\n'
  await Bun.write(join(root, planPath), bytes)
  const calls: Array<{ input: string, init: RequestInit }> = []; let respond: (init: RequestInit) => Promise<Response> = async () => json(usage(provider))
  const native = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => { calls.push({ input: String(input), init: init! }); return await respond(init!) }, { preconnect: fetch.preconnect }) as typeof fetch
  const options: CategoryDSpendingGuardOptions = { ledgerPath, planPath, planSha256: hash(bytes), pageId: pages[0]!.id, provider, model, projectRoot: root, fetchImplementation: native }
  const guard = createCategoryDSpendingGuard(options), data = Buffer.from(jpeg).toString('base64'), cap = contracts.find(([p, m]) => p === provider && m === model)![2]
  const endpoint = provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : endpoints[provider]!
  const body = (): Record<string, unknown> => {
    if (provider === 'openai') return { model, reasoning: { effort: 'high' }, input: [{ role: 'user', content: [{ type: 'input_text', text: 'Read the image.' }, { type: 'input_image', image_url: `data:image/jpeg;base64,${data}`, detail: 'high' }] }] }
    if (provider === 'anthropic') return { model, max_tokens: cap, output_config: { effort: 'high' }, messages: [{ role: 'user', content: [{ type: 'text', text: 'Read the image.' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }] }] }
    if (provider === 'gemini') return { contents: [{ role: 'user', parts: [{ text: 'Read the image.' }, { inlineData: { mimeType: 'image/jpeg', data } }] }], generationConfig: { maxOutputTokens: cap, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'LOW' } } }
    if (provider === 'mistral') return { model, document: { type: 'image_url', image_url: `data:image/jpeg;base64,${data}` }, include_image_base64: false }
    return { model, [provider === 'grok' ? 'max_completion_tokens' : 'max_tokens']: cap, messages: [{ role: 'user', content: [{ type: 'text', text: 'Read the image.' }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } }] }] }
  }
  const run = async (value = body(), target = endpoint, guarded = guard) => await guarded(target, { method: 'POST', body: JSON.stringify(value), headers: { authorization: 'test-secret' } })
  const ledger = async (): Promise<CategoryDSpendingLedger> => await Bun.file(join(root, ledgerPath)).json() as CategoryDSpendingLedger
  const rewrite = async (patch: Record<string, unknown>) => { const bytes = JSON.stringify({ ...plan, ...patch }); await Bun.write(join(root, planPath), bytes); return createCategoryDSpendingGuard({ ...options, planSha256: hash(bytes) }) }
  return { root, plan, options, calls, guard, body, run, ledger, rewrite, endpoint, respond: (next: typeof respond) => { respond = next } }
}

describe('category D fixed-scope dispatch and native JPEG handling', () => {
  for (const [provider, model] of contracts) test(`${provider}/${model} sends only the pinned JPEG to the documented native endpoint`, async () => {
    const f = await fixture(provider, model); expect((await f.run()).status).toBe(200); expect(f.calls).toHaveLength(1); expect(f.calls[0]!.input).toBe(f.endpoint)
    const sent = JSON.parse(f.calls[0]!.init.body as string); if (provider === 'openai') expect(sent).toMatchObject({ service_tier: 'default', max_output_tokens: 16384, prompt_cache_options: { mode: 'implicit', ttl: '30m' }, reasoning: { effort: 'high' } }); else expect(sent).toEqual(f.body())
    expect((await f.ledger())).toMatchObject({ kind: 'ocr-category-d-spending-ledger', budgetCents: 2500, planSha256: f.options.planSha256 }); expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'settled', inputSha256: hash(jpeg), documentCaseId: f.plan.pages[0]!.caseId })
    expect(JSON.stringify(await f.ledger())).not.toContain('test-secret')
  })
  test('all six actual native adapters preserve original JPEG bytes and decode mocked output through the D guard', async () => {
    const keys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'MISTRAL_API_KEY'], prior = Object.fromEntries(keys.map(k => [k, process.env[k]])), nativeFetch = globalThis.fetch
    const text = 'Synthetic advertisement contract text.', envelope = JSON.stringify({ pages: [{ pageNumber: 1, text }] })
    try { for (const key of keys) process.env[key] = 'nonbillable-mock-key'
      for (const [provider, model, run] of [['openai', 'gpt-6-luna', runOpenAIOcr], ['anthropic', 'claude-haiku-5-5', runAnthropicOcr], ['gemini', 'gemini-3.5-flash', runGeminiOcr], ['grok', 'grok-4.7', runGrokOcr], ['mistral', 'mistral-ocr-4-1', runMistralOcr]] as const) {
        const f = await fixture(provider, model); await mkdir(join(f.root, base, 'pages'), { recursive: true }); const image = join(f.root, f.plan.pages[0]!.input); await Bun.write(image, jpeg)
        f.respond(async () => json(provider === 'openai' ? { ...usage(provider) as object, status: 'completed', output_text: text, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }
          : provider === 'anthropic' ? { ...usage(provider) as object, content: [{ type: 'text', text: envelope }], stop_reason: 'end_turn' }
            : provider === 'gemini' ? { ...usage(provider) as object, candidates: [{ content: { parts: [{ text: envelope }] }, finishReason: 'STOP' }] }
              : provider === 'mistral' ? { ...usage(provider) as object, pages: [{ index: 0, markdown: text }] }
                : { ...usage(provider) as object, choices: [{ message: { content: text }, finish_reason: 'stop' }] }))
        globalThis.fetch = f.guard; const result = await run(image, { format: 'jpg', slug: 'synthetic', pageCount: 1, fileSize: jpeg.length }, model, { dpi: 300, outputDir: f.root })
        expect(result.pages[0]?.text).toBe(text); expect(f.calls).toHaveLength(1); expect((await f.ledger()).receipts[0]?.inputSha256).toBe(hash(jpeg))
      }
    } finally { globalThis.fetch = nativeFetch; for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key] } }
  })
  test('default, accepted Standard/cache override and reset retain native reasoning through actual fetch', async () => {
    const f = await fixture('openai', 'gpt-6-luna'); await f.run(); await f.run({ ...f.body(), service_tier: 'default', prompt_cache_options: { mode: 'explicit', ttl: '30m' } }); await f.run()
    const sent = f.calls.map(c => JSON.parse(c.init.body as string)); expect(sent.map(b => b.prompt_cache_options.mode)).toEqual(['implicit', 'explicit', 'implicit']); expect(sent.every(b => b.service_tier === 'default' && b.max_output_tokens === 16384 && b.reasoning.effort === 'high')).toBe(true)
    await expect(f.run()).rejects.toThrow('maximum request attempts'); expect(f.calls).toHaveLength(3)
  })
  test('Grok maintains the visible cap while valuing separate reasoning under the explicit unmeasured allowance', async () => {
    const f = await fixture('grok', 'grok-4.7'); f.respond(async () => json({ usage: { prompt_tokens: 3658, completion_tokens: 1167, completion_tokens_details: { reasoning_tokens: 4096 } } })); await f.run()
    expect((await f.ledger()).receipts[0]).toMatchObject({ reservedCents: 34.9184, status: 'settled', chargedCents: 3.8894, outputTokens: 5263, visibleOutputTokens: 1167, reasoningOutputTokens: 4096 })
    expect(JSON.parse(f.calls[0]!.init.body as string).max_completion_tokens).toBe(4096)
  })
})

describe('category D scope and input mutations fail before provider dispatch', () => {
  for (const patch of [{ model: 'other' }, { max_output_tokens: 999999 }, { service_tier: 'fast' }, { service_tier: 'priority' }, { stream: true }, { tools: [] }, { n: 2 }, { prompt_cache_options: { ttl: '12h' } }, { prompt_cache_retention: '24h' }, { previous_response_id: 'other' }, { search_parameters: {} }]) test(`rejects controls ${JSON.stringify(patch)}`, async () => {
    const f = await fixture(); await expect(f.run({ ...f.body(), ...patch })).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(0)
  })
  test('the D authorization cannot become BC, raise its budget, execute later categories, or add retired Mistral', async () => {
    for (const patch of [ { kind: 'ocr-categories-bc-execution-plan' }, { approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30' } },
      { approval: { status: 'approved', budgetCents: 2501, evidence: 'User approved up to $25 for category 4' } } ]) {
      const f = await fixture(), guard = await f.rewrite(patch); await expect(f.run(f.body(), f.endpoint, guard)).rejects.toThrow('explicit approved'); expect(f.calls).toHaveLength(0)
    }
    const f = await fixture(); expect(() => createCategoryDSpendingGuard({ ...f.options, provider: 'mistral', model: 'mistral-ocr-4-0' })).toThrow('outside')
    expect(() => createCategoriesBcSpendingGuard(f.options)).toThrow('private project-relative'); expect(() => createApprovedOcrBenchmarkSpendingGuard('unknown' as 'category-d', f.options)).toThrow('unknown approved')
    await expect(f.run(f.body(), f.endpoint, createCategoryDSpendingGuard({ ...f.options, pageId: 'handwriting-marker-prose-page-01' }))).rejects.toThrow('outside'); expect(f.calls).toHaveLength(0)
  })
  test('requires the original plan checksum and rejects changed case, page population, model inventory and dimensions', async () => {
    const f = await fixture(); await Bun.write(join(f.root, f.options.planPath!), JSON.stringify({ ...f.plan, extra: true })); await expect(f.run()).rejects.toThrow('checksum changed'); expect(f.calls).toHaveLength(0)
    for (const patch of [{ pages: [] }, { pages: f.plan.pages.map((p, i) => i ? p : { ...p, caseId: 'handwriting-marker-prose' }) },
      { targets: [...f.plan.targets, { provider: 'mistral', model: 'mistral-ocr-4-0' }] }, { pages: f.plan.pages.map((p, i) => i ? p : { ...p, width: 4097 }) }]) {
      const guard = await f.rewrite(patch); await expect(f.run(f.body(), f.endpoint, guard)).rejects.toThrow('OCR spending guard')
    }
  })
  test('rejects swapped, duplicated, mislabeled or truncated JPEGs and remote inputs before actual fetch', async () => {
    const f = await fixture(); const content = (body: Record<string, unknown>) => (body['input'] as Array<{ content: Array<Record<string, unknown>> }>)[0]!.content
    for (const image of ['data:image/jpeg;base64,YWJj', `data:image/png;base64,${Buffer.from(jpeg).toString('base64')}`, 'https://example.com/source.jpg']) { const body = f.body(); content(body)[1]!['image_url'] = image; await expect(f.run(body)).rejects.toThrow('OCR spending guard') }
    const duplicate = f.body(); content(duplicate).push(content(duplicate)[1]!); await expect(f.run(duplicate)).rejects.toThrow('exactly one')
    const changedDimensions = await f.rewrite({ pages: f.plan.pages.map((p, i) => i ? p : { ...p, width: 17 }) }); await expect(f.run(f.body(), f.endpoint, changedDimensions)).rejects.toThrow('dimensions differ')
    const truncated = jpeg.slice(0, 20), corrupted = await f.rewrite({ pages: f.plan.pages.map((p, i) => i ? p : { ...p, inputSha256: hash(truncated) }) }); const body = f.body(); content(body)[1]!['image_url'] = `data:image/jpeg;base64,${Buffer.from(truncated).toString('base64')}`
    await expect(f.run(body, f.endpoint, corrupted)).rejects.toThrow(); expect(f.calls).toHaveLength(0)
  })
  test('an approved-looking PNG cannot replace D JPEGs and higher-priced native output overrides are rejected', async () => {
    const f = await fixture(), guard = await f.rewrite({ pages: f.plan.pages.map((p, i) => i ? p : { ...p, inputSha256: hash(redDotPng), width: 1, height: 1 }) }); const body = f.body(); (body['input'] as Array<{ content: Array<Record<string, unknown>> }>)[0]!.content[1]!['image_url'] = `data:image/jpeg;base64,${Buffer.from(redDotPng).toString('base64')}`
    await expect(f.run(body, f.endpoint, guard)).rejects.toThrow('JPEG bytes'); expect(f.calls).toHaveLength(0)
    const a = await fixture('anthropic', 'claude-fable-5'); await expect(a.run({ ...a.body(), max_tokens: 128000 })).rejects.toThrow('native output cap'); expect(a.calls).toHaveLength(0)
  })
  test('wrong endpoint, upward-scope ledger path and prior-context extras are rejected', async () => {
    const f = await fixture(); await expect(f.run(f.body(), 'https://api.openai.com/v1/responses?other=1')).rejects.toThrow('unapproved provider host')
    for (const ledgerPath of ['../ledger.json', 'input/examples/document/ocr-categories-bc-run/spending-ledger.json', `${base}/../ledger.json`]) expect(() => createCategoryDSpendingGuard({ ...f.options, ledgerPath })).toThrow('private project-relative')
    expect(f.calls).toHaveLength(0)
  })
})

describe('category D cumulative accounting and retained-charge recovery', () => {
  test('three page requests reserve together and settle without losing any shared-$25 ledger rows', async () => {
    const f = await fixture(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve }); f.respond(async () => { await gate; return json(usage('openai')) })
    const running = [0, 1, 2].map(i => f.run(f.body(), f.endpoint, createCategoryDSpendingGuard({ ...f.options, pageId: f.plan.pages[i]!.id })))
    while (f.calls.length < 3) await Bun.sleep(5); expect((await f.ledger()).receipts.map(r => r.status)).toEqual(['reserved', 'reserved', 'reserved']); expect((await f.ledger()).receipts.reduce((s, r) => s + r.chargedCents, 0)).toBeCloseTo(485.76)
    release(); await Promise.all(running); expect((await f.ledger()).receipts.map(r => r.status)).toEqual(['settled', 'settled', 'settled'])
  })
  test('accumulated reviewed usage plus an outstanding reservation cannot exceed $25', async () => {
    const f = await fixture('anthropic', 'claude-fable-5'); f.respond(async () => json({ usage: { input_tokens: 64000, output_tokens: 64000 } }))
    for (const p of f.plan.pages) await f.run(f.body(), f.endpoint, createCategoryDSpendingGuard({ ...f.options, pageId: p.id }))
    const unattemptedModel = 'claude-fable-5-1'
    await expect(f.run({ ...f.body(), model: unattemptedModel }, f.endpoint, createCategoryDSpendingGuard({ ...f.options, model: unattemptedModel }))).rejects.toThrow('remaining cumulative approval')
    expect(f.calls).toHaveLength(6); expect((await f.ledger()).receipts.reduce((s, r) => s + r.chargedCents, 0)).toBe(2304)
  })
  test('HTTP 429 admission rejection remains zero; a later accepted request is charged once', async () => {
    const f = await fixture(); f.respond(async () => json({ error: 'rate limited' }, 429)); expect((await f.run()).status).toBe(429); expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'rejected', chargedCents: 0 })
    f.respond(async () => json(usage('openai'))); await f.run(); expect((await f.ledger()).receipts[1]?.status).toBe('settled')
  })
  test('D HTTP503 recovery preserves its entire uncertain charge and requires the D approval rather than BC', async () => {
    const f = await fixture('gemini', 'gemini-3.5-flash-lite'); f.respond(async () => json({ error: 'temporary' }, 503)); await expect(f.run()).rejects.toThrow('did not establish complete usage'); const original = structuredClone((await f.ledger()).receipts[0]!)
    const record: CategoryDManualReconciliation = { schemaVersion: 1, kind: 'ocr-category-d-manual-reconciliation', action: 'retain-full-reservation-and-authorize-one-recovery-invocation', approvalBudgetCents: 2500, approvalEvidence: 'User approved up to $25 for category 4', planSha256: f.options.planSha256,
      receiptId: original.id, caseId: original.caseId, documentCaseId: original.documentCaseId, provider: original.provider, model: original.model, inputSha256: original.inputSha256, httpStatus: 503, reservedCents: original.reservedCents, chargedCents: original.chargedCents, reason: 'Retain all unknown cost and authorize one separately counted D recovery.', createdAt: new Date().toISOString() }
    const path = `${base}/reconciliations/503.json`; await mkdir(join(f.root, base, 'reconciliations'), { recursive: true })
    const authorize = async (value: unknown) => { const bytes = JSON.stringify(value); await Bun.write(join(f.root, path), bytes); const l = await f.ledger(); l.reconciliations = [{ path, sha256: hash(bytes) }]; await Bun.write(join(f.root, f.options.ledgerPath), JSON.stringify(l)) }
    await authorize({ ...record, kind: 'ocr-categories-bc-manual-reconciliation', approvalBudgetCents: 3000, approvalEvidence: 'User approved up to $30' }); await expect(f.run(f.body(), f.endpoint, createCategoryDSpendingGuard(f.options))).rejects.toThrow('approved recovery')
    await authorize(record); f.respond(async () => json(usage('gemini'))); await f.run(f.body(), f.endpoint, createCategoryDSpendingGuard(f.options))
    expect((await f.ledger()).receipts[0]).toEqual(original); expect((await f.ledger()).receipts[1]).toMatchObject({ status: 'settled', recoveryOfReceiptId: original.id }); await expect(f.run(f.body(), f.endpoint, createCategoryDSpendingGuard(f.options))).rejects.toThrow('automatic redispatch')
  })
})
