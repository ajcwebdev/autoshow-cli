import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  createNewspaperExpansionSpendingGuard, NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE,
  NEWSPAPER_EXPANSION_CASE_PAGES, validateNewspaperFinalBreachAccountingReview, readNewspaperFinalBreachAccountingReview
} from '~/tools/ocr-newspaper-expansion-spending-guard'
import type {
  NewspaperExpansionExecutionPlan, NewspaperExpansionManualReconciliation, NewspaperExpansionSpendingGuardOptions, NewspaperExpansionSpendingLedger,
  NewspaperFinalBreachAccountingReview
} from '~/tools/ocr-newspaper-expansion-spending-guard'
import { CATEGORIES_EFG_CASE_PAGES, createCategoriesEfgSpendingGuard } from '~/tools/ocr-categories-efg-spending-guard'
import { CATEGORIES_BC_CASE_PAGES, createCategoriesBcSpendingGuard } from '~/tools/ocr-categories-bc-spending-guard'
import { CATEGORY_D_CASE_PAGES, createCategoryDSpendingGuard } from '~/tools/ocr-category-d-spending-guard'
import { runOpenAIOcr } from '~/cli/commands/text/ocr/ocr-services/openai-ocr/run-openai-ocr'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { runDeepinfraOcr } from '~/cli/commands/text/ocr/ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { runMistralOcr } from '~/cli/commands/text/ocr/ocr-services/mistral-ocr/run-mistral-ocr'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const base = 'input/examples/document/ocr-newspaper-expansion'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Independently specified native endpoint/control expectations, not the guard's rate table.
// Responses: https://platform.openai.com/docs/api-reference/responses/create
// Messages: https://docs.anthropic.com/en/api/messages
// GenerateContent: https://ai.google.dev/api/generate-content
// xAI: https://docs.x.ai/developers/rest-api-reference/inference/chat-completions
// DeepInfra: https://deepinfra.com/docs/openai_api
// Mistral: https://docs.mistral.ai/api/endpoint/ocr
const contracts: ReadonlyArray<[string, string, number]> = [
  ['openai', 'gpt-6.1-sol', 16384], ['openai', 'gpt-6-luna', 16384], ['openai', 'gpt-6-astra', 16384], ['openai', 'gpt-5.6-terra', 16384],
  ['anthropic', 'claude-opus-5-5', 64000], ['anthropic', 'claude-sonnet-5-5', 64000], ['anthropic', 'claude-haiku-5-5', 64000],
  ['anthropic', 'claude-fable-5-1', 64000], ['anthropic', 'claude-fable-5', 64000],
  ['gemini', 'gemini-4-argon', 32768], ['gemini', 'gemini-3.8-flash', 8192], ['gemini', 'gemini-3.5-flash', 8192], ['gemini', 'gemini-3.6-flash', 8192], ['gemini', 'gemini-3.5-flash-lite', 8192],
  ['grok', 'grok-4.7', 4096], ['grok', 'grok-4.5', 4096], ['deepinfra', 'google/gemma-4-31B-it', 8192], ['deepinfra', 'Qwen/Qwen3.8-27B', 8192], ['deepinfra', 'deepseek-ai/DeepSeek-V4.1-Flash', 8192], ['mistral', 'mistral-ocr-4-1', 0]
]
const endpoints: Record<string, string> = {
  openai: 'https://api.openai.com/v1/responses', anthropic: 'https://api.anthropic.com/v1/messages',
  grok: 'https://api.x.ai/v1/chat/completions', deepinfra: 'https://api.deepinfra.com/v1/openai/chat/completions', mistral: 'https://api.mistral.ai/v1/ocr'
}
const usage = (provider: string): unknown => provider === 'openai'
  ? { service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } } }
  : provider === 'anthropic' ? { usage: { input_tokens: 1000, output_tokens: 200 } }
    : provider === 'gemini' ? { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100 } }
      : provider === 'mistral' ? { usage_info: { pages_processed: 1 } }
        : { usage: { prompt_tokens: 1000, completion_tokens: 200, completion_tokens_details: { reasoning_tokens: 150 } } }

const fixture = async (provider = 'openai', model = 'gpt-6-luna', imageBytes: Uint8Array = redDotPng) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-newspaper-budget-')); roots.push(root)
  await mkdir(join(root, base), { recursive: true })
  const dimensions = await new Bun.Image(imageBytes).metadata()
  const pages = Object.keys(NEWSPAPER_EXPANSION_CASE_PAGES).map(caseId => ({ id: `${caseId}-page-01`, caseId, pageNumber: 1,
    input: `${base}/cases/${caseId}/input.png`, inputSha256: hash(imageBytes), width: dimensions.width, height: dimensions.height, format: 'png' as const }))
  const plan: NewspaperExpansionExecutionPlan = { schemaVersion: 1, kind: 'ocr-newspaper-expansion-execution-plan',
    approval: { status: 'approved', budgetCents: 3000, evidence: NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE }, pages,
    targets: [...contracts.map(([provider, model]) => ({ provider, model })), { provider: 'tesseract', model: 'tesseract' }] }
  const planPath = `${base}/execution-plan.json`, ledgerPath = `${base}/spending-ledger.json`, bytes = JSON.stringify(plan, null, 2) + '\n'
  await Bun.write(join(root, planPath), bytes)
  const calls: Array<{ input: string, init: RequestInit }> = []
  let respond: (init: RequestInit) => Promise<Response> = async () => json(usage(provider))
  const native = Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    calls.push({ input: String(input), init: init! }); return await respond(init!)
  }, { preconnect: fetch.preconnect }) as typeof fetch
  const options: NewspaperExpansionSpendingGuardOptions = { ledgerPath, planPath, planSha256: hash(bytes), pageId: pages[0]!.id,
    provider, model, projectRoot: root, fetchImplementation: native }
  const guard = createNewspaperExpansionSpendingGuard(options), data = Buffer.from(imageBytes).toString('base64')
  const cap = contracts.find(([p, m]) => p === provider && m === model)![2]
  const endpoint = provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : endpoints[provider]!
  const body = (): Record<string, unknown> => {
    if (provider === 'openai') return { model, reasoning: { effort: 'high' }, input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Read the image.' }, { type: 'input_image', image_url: `data:image/png;base64,${data}`, detail: 'high' }] }] }
    if (provider === 'anthropic') return { model, max_tokens: cap, output_config: { effort: 'high' }, messages: [{ role: 'user', content: [
      { type: 'text', text: 'Read the image.' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data } }] }] }
    if (provider === 'gemini') return { contents: [{ role: 'user', parts: [{ text: 'Read the image.' }, { inlineData: { mimeType: 'image/png', data } }] }],
      generationConfig: { maxOutputTokens: cap, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'LOW' } } }
    if (provider === 'mistral') return { model, document: { type: 'image_url', image_url: `data:image/png;base64,${data}` }, include_image_base64: false }
    return { model, [provider === 'grok' ? 'max_completion_tokens' : 'max_tokens']: cap, messages: [{ role: 'user', content: [
      { type: 'text', text: 'Read the image.' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${data}` } }] }] }
  }
  const run = async (value = body(), target = endpoint, guarded = guard) => await guarded(target, { method: 'POST', body: JSON.stringify(value), headers: { authorization: 'nonbillable-test-secret' } })
  const ledger = async (): Promise<NewspaperExpansionSpendingLedger> => await Bun.file(join(root, ledgerPath)).json() as NewspaperExpansionSpendingLedger
  const rewrite = async (patch: Record<string, unknown>) => { const bytes = JSON.stringify({ ...plan, ...patch }); await Bun.write(join(root, planPath), bytes)
    return createNewspaperExpansionSpendingGuard({ ...options, planSha256: hash(bytes) }) }
  return { root, plan, options, calls, guard, body, run, ledger, rewrite, endpoint, respond: (next: typeof respond) => { respond = next } }
}

describe('newspaper fixed authorization and native transport, with mocked providers only', () => {
  for (const [provider, model] of contracts) test(`${provider}/${model} dispatches the pinned PNG under its native control contract`, async () => {
    const f = await fixture(provider, model); expect((await f.run()).status).toBe(200); expect(f.calls).toHaveLength(1)
    expect(f.calls[0]!.input).toBe(f.endpoint)
    const sent = JSON.parse(f.calls[0]!.init.body as string)
    if (provider === 'openai') expect(sent).toMatchObject({ service_tier: 'default', max_output_tokens: 16384, reasoning: { effort: 'high' }, prompt_cache_options: { mode: 'implicit', ttl: '30m' } })
    else expect(sent).toEqual(f.body())
    expect(await f.ledger()).toMatchObject({ kind: 'ocr-newspaper-expansion-spending-ledger', budgetCents: 3000, planSha256: f.options.planSha256 })
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'settled', inputSha256: hash(redDotPng), documentCaseId: f.plan.pages[0]!.caseId })
    expect(JSON.stringify(await f.ledger())).not.toContain('nonbillable-test-secret')
  })
  test('OpenAI default, accepted cache override and reset preserve the fixed output ceiling through actual dispatch', async () => {
    const f = await fixture(); await f.run(); await f.run({ ...f.body(), max_output_tokens: 16384, service_tier: 'default', prompt_cache_options: { mode: 'explicit', ttl: '30m' } }); await f.run()
    const bodies = f.calls.map(c => JSON.parse(c.init.body as string))
    expect(bodies.map(b => b.prompt_cache_options.mode)).toEqual(['implicit', 'explicit', 'implicit'])
    expect(bodies.every(b => b.service_tier === 'default' && b.max_output_tokens === 16384 && b.reasoning.effort === 'high')).toBe(true)
    await expect(f.run()).rejects.toThrow('maximum request attempts'); expect(f.calls).toHaveLength(3)
  })
  test('six native adapters transport a decoded largest-new-input PNG and decode valid mocked text artifacts', async () => {
    const png = await new Bun.Image(redDotPng).resize(1920, 2418).png().bytes()
    const keys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'DEEPINFRA_API_KEY', 'MISTRAL_API_KEY']
    const previous = Object.fromEntries(keys.map(k => [k, process.env[k]])), nativeFetch = globalThis.fetch
    const text = 'Synthetic transport and artifact-decoding fixture; not an OCR accuracy result.', envelope = JSON.stringify({ pages: [{ pageNumber: 1, text }] })
    try {
      for (const key of keys) process.env[key] = 'nonbillable-mock-key'
      for (const [provider, model, run] of [
        ['openai', 'gpt-6-luna', runOpenAIOcr], ['anthropic', 'claude-haiku-5-5', runAnthropicOcr], ['gemini', 'gemini-3.5-flash-lite', runGeminiOcr],
        ['grok', 'grok-4.7', runGrokOcr], ['deepinfra', 'google/gemma-4-31B-it', runDeepinfraOcr], ['mistral', 'mistral-ocr-4-1', runMistralOcr]
      ] as const) {
        const f = await fixture(provider, model, png), input = join(f.root, f.plan.pages[0]!.input)
        await mkdir(join(input, '..'), { recursive: true }); await Bun.write(input, png)
        f.respond(async () => json(provider === 'openai' ? { ...usage(provider) as object, status: 'completed', output_text: text, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }
          : provider === 'anthropic' ? { ...usage(provider) as object, content: [{ type: 'text', text: envelope }], stop_reason: 'end_turn' }
            : provider === 'gemini' ? { ...usage(provider) as object, candidates: [{ content: { parts: [{ text: envelope }] }, finishReason: 'STOP' }] }
              : provider === 'mistral' ? { ...usage(provider) as object, pages: [{ index: 0, markdown: text }] }
                : { ...usage(provider) as object, choices: [{ message: { content: text }, finish_reason: 'stop' }] }))
        globalThis.fetch = f.guard
        const result = await run(input, { format: 'png', slug: 'newspaper-contract', pageCount: 1, fileSize: png.length }, model, { dpi: 300, outputDir: f.root })
        expect(result.pages[0]?.text).toBe(text); expect(f.calls).toHaveLength(1)
        expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'settled', inputSha256: hash(png) })
      }
    } finally { globalThis.fetch = nativeFetch; for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } }
  }, 20000)
})

describe('newspaper scope, control and image failures reject before mocked transport', () => {
  for (const patch of [ { max_output_tokens: 999999 }, { model: 'other' }, { service_tier: 'fast' }, { stream: true }, { tools: [] }, { n: 2 },
    { prompt_cache_options: { ttl: '12h' } }, { previous_response_id: 'other' }, { search_parameters: {} } ]) test(`rejects unapproved controls ${JSON.stringify(patch)}`, async () => {
    const f = await fixture(); await expect(f.run({ ...f.body(), ...patch })).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(0)
  })
  test('requires this exact approval, fixed 12-case population and 21-target inventory', async () => {
    for (const patch of [ { kind: 'ocr-categories-efg-execution-plan' },
      { approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30 for categories 5–7' } },
      { approval: { status: 'approved', budgetCents: 3001, evidence: NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE } },
      { approval: null }, { pages: [] } ]) {
      const f = await fixture(), guard = await f.rewrite(patch); await expect(f.run(f.body(), f.endpoint, guard)).rejects.toThrow('explicit approved'); expect(f.calls).toHaveLength(0)
    }
    const f = await fixture()
    for (const patch of [
      { pages: f.plan.pages.map((p, i) => i ? p : { ...p, caseId: 'newspapers-expansion-north-star-1847-12-03-p2' }) },
      { pages: f.plan.pages.map((p, i) => i ? p : { ...p, caseId: 'constructor', id: 'constructor-page-01', input: `${base}/cases/constructor/input.png` }) },
      { pages: f.plan.pages.map((p, i) => i ? p : { ...p, id: 'another-page-01' }) },
      { pages: f.plan.pages.map((p, i) => i ? p : { ...p, input: `${base}/originals/other.png` }) },
      { pages: f.plan.pages.map((p, i) => i ? p : { ...p, format: undefined }) },
      { targets: f.plan.targets.map((t, i) => i ? t : { provider: 'mistral', model: 'mistral-ocr-4-0' }) }
    ]) { const guard = await f.rewrite(patch); await expect(f.run(f.body(), f.endpoint, guard)).rejects.toThrow('OCR spending guard') }
    expect(() => createNewspaperExpansionSpendingGuard({ ...f.options, provider: 'mistral', model: 'mistral-ocr-4-0' })).toThrow('outside')
    expect(() => createCategoriesEfgSpendingGuard(f.options)).toThrow('private project-relative')
    expect(() => createCategoriesBcSpendingGuard(f.options)).toThrow('private project-relative')
    expect(f.calls).toHaveLength(0)
  })
  test('changed plan checksums, provider host and earlier ledgers cannot be reused', async () => {
    const f = await fixture(); await expect(f.run(f.body(), f.endpoint + '?other=1')).rejects.toThrow('unapproved provider host')
    expect(() => createNewspaperExpansionSpendingGuard({ ...f.options, ledgerPath: 'input/examples/document/ocr-categories-efg-run/spending-ledger.json' })).toThrow('private project-relative')
    await Bun.write(join(f.root, f.options.planPath!), JSON.stringify({ ...f.plan, changed: true })); await expect(f.run()).rejects.toThrow('checksum changed')
    expect(f.calls).toHaveLength(0)
  })
  test('rejects oversized dimensions, oversized bytes, truncated PNGs, mismatched MIME and multiple images before dispatch', async () => {
    const f = await fixture(); const image = (body: Record<string, unknown>) => (body['input'] as Array<{ content: Array<Record<string, unknown>> }>)[0]!.content
    const dimensionGuard = await f.rewrite({ pages: f.plan.pages.map((p, i) => i ? p : { ...p, width: 3073 }) })
    await expect(f.run(f.body(), f.endpoint, dimensionGuard)).rejects.toThrow('approved page identity')
    for (const bytes of [redDotPng.slice(0, 24), Buffer.concat([redDotPng, Buffer.alloc(5 * 1024 * 1024)])]) {
      const guard = await f.rewrite({ pages: f.plan.pages.map((p, i) => i ? p : { ...p, inputSha256: hash(bytes) }) }), body = f.body()
      image(body)[1]!['image_url'] = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
      await expect(f.run(body, f.endpoint, guard)).rejects.toThrow()
    }
    const guard = await f.rewrite({})
    for (const url of ['https://example.com/source.png', `data:image/jpeg;base64,${Buffer.from(redDotPng).toString('base64')}`]) {
      const body = f.body(); image(body)[1]!['image_url'] = url; await expect(f.run(body, f.endpoint, guard)).rejects.toThrow('unapproved remote or additional media')
    }
    const duplicate = f.body(); image(duplicate).push(image(duplicate)[1]!); await expect(f.run(duplicate, f.endpoint, guard)).rejects.toThrow('exactly one')
    expect(f.calls).toHaveLength(0)
  })
  test('native cap overrides are rejected before dispatch for every metered non-OpenAI family', async () => {
    for (const [provider, model] of [['anthropic', 'claude-fable-5'], ['gemini', 'gemini-4-argon'], ['grok', 'grok-4.7'], ['deepinfra', 'google/gemma-4-31B-it']]) {
      const f = await fixture(provider, model), body = f.body()
      if (provider === 'gemini') (body['generationConfig'] as Record<string, unknown>)['maxOutputTokens'] = 999999
      else body[provider === 'grok' ? 'max_completion_tokens' : 'max_tokens'] = 999999
      await expect(f.run(body)).rejects.toThrow('output cap'); expect(f.calls).toHaveLength(0)
    }
  })
})

describe('newspaper cumulative reservations and unknown outcomes', () => {
  test('twelve concurrent page requests preserve all reservations and settlements', async () => {
    const f = await fixture(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve })
    f.respond(async () => { await gate; return json(usage('openai')) })
    const running = f.plan.pages.map(p => f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard({ ...f.options, pageId: p.id })))
    const done = Promise.all(running), deadline = performance.now() + 5000
    while (f.calls.length < 12 && performance.now() < deadline) await Bun.sleep(5)
    expect(f.calls).toHaveLength(12); const pending = await f.ledger()
    expect(pending.receipts).toHaveLength(12); expect(pending.receipts.every(r => r.status === 'reserved')).toBe(true)
    expect(pending.receipts.reduce((n, r) => n + r.chargedCents, 0)).toBeCloseTo(19.4304)
    release(); await done; const settled = await f.ledger()
    expect(settled.receipts).toHaveLength(12); expect(new Set(settled.receipts.map(r => r.id)).size).toBe(12)
    expect(settled.receipts.every(r => r.status === 'settled')).toBe(true)
    expect(settled.receipts.reduce((n, r) => n + r.chargedCents, 0)).toBeCloseTo(0.24)
  })
  test('concurrent expensive reservations stop before the $30 ceiling and can resume after settlement', async () => {
    const f = await fixture('anthropic', 'claude-fable-5'); let release!: () => void, blocked = 0; const gate = new Promise<void>(resolve => { release = resolve })
    f.respond(async () => { await gate; return json(usage('anthropic')) })
    const running = f.plan.pages.slice(0, 8).map(p => f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard({ ...f.options, pageId: p.id }))
      .catch(error => { blocked++; throw error }))
    const done = Promise.allSettled(running), deadline = performance.now() + 5000
    while ((f.calls.length < 7 || blocked < 1) && performance.now() < deadline) await Bun.sleep(5)
    const pending = await f.ledger()
    try {
      expect(f.calls).toHaveLength(7); expect(blocked).toBe(1)
      expect(pending.receipts).toHaveLength(7); expect(pending.receipts.reduce((n, r) => n + r.chargedCents, 0)).toBe(2688)
    } finally { release() }
    const settled = await done; expect(settled.filter(r => r.status === 'rejected')).toHaveLength(1)
    const missing = f.plan.pages.find(p => !pending.receipts.some(r => r.caseId === p.id))!
    f.respond(async () => json(usage('anthropic')))
    await f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard({ ...f.options, pageId: missing.id }))
    expect(f.calls).toHaveLength(8)
  })
  test('settled usage and outstanding full reservations cannot exceed the approval', async () => {
    const f = await fixture('anthropic', 'claude-fable-5'); f.respond(async () => json({ usage: { input_tokens: 64000, output_tokens: 64000 } }))
    for (const p of f.plan.pages.slice(0, 7)) await f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard({ ...f.options, pageId: p.id }))
    const model = 'claude-fable-5-1'; await expect(f.run({ ...f.body(), model }, f.endpoint, createNewspaperExpansionSpendingGuard({ ...f.options, model }))).rejects.toThrow('remaining cumulative approval')
    expect(f.calls).toHaveLength(7); expect((await f.ledger()).receipts.reduce((n, r) => n + r.chargedCents, 0)).toBe(2688)
  })
  test('HTTP rejection releases its hold; ambiguous usage retains the entire hold and blocks redispatch', async () => {
    const f = await fixture(); f.respond(async () => json({ error: 'rate limited' }, 429)); await f.run()
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'rejected', chargedCents: 0 })
    f.respond(async () => json({ error: 'unknown' }, 503)); await expect(f.run()).rejects.toThrow('did not establish complete usage')
    const held = (await f.ledger()).receipts[1]!; expect(held.status).toBe('ambiguous'); expect(held.chargedCents).toBe(held.reservedCents)
    f.respond(async () => json(usage('openai'))); await expect(f.run()).rejects.toThrow('requires reconciliation'); expect(f.calls).toHaveLength(2)
  })
  test('Grok reasoning is separately charged once and breaches retain the strict component allowance', async () => {
    const f = await fixture('grok', 'grok-4.7')
    f.respond(async () => json({ usage: { prompt_tokens: 1000, completion_tokens: 200, completion_tokens_details: { reasoning_tokens: 1000 } } }))
    await f.run(); expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'settled', outputTokens: 1200, visibleOutputTokens: 200, reasoningOutputTokens: 1000, chargedCents: 0.92 })
    f.respond(async () => json({ usage: { prompt_tokens: 1000, completion_tokens: 100, completion_tokens_details: { reasoning_tokens: 32769 } } }))
    await expect(f.run()).rejects.toThrow('exceeded the reserved allowance')
    const breach = (await f.ledger()).receipts[1]!; expect(breach).toMatchObject({ status: 'breach', reasoningOutputTokens: 32769 })
    expect(breach.chargedCents).toBe(breach.reservedCents)
    await expect(f.run()).rejects.toThrow('requires reconciliation'); expect(f.calls).toHaveLength(2)
  })
  test('the prior 33381-reasoning-token pattern remains a breach even below the combined reservation', async () => {
    const f = await fixture('grok', 'grok-4.7')
    const payload = { usage: { prompt_tokens: 3717, completion_tokens: 2896, completion_tokens_details: { reasoning_tokens: 33381 } } }
    f.respond(async () => json(payload)); await expect(f.run()).rejects.toThrow('exceeded the reserved allowance')
    const receipt = (await f.ledger()).receipts[0]!
    expect(receipt).toMatchObject({ status: 'breach', httpStatus: 200, inputTokens: 3717, outputTokens: 36277,
      visibleOutputTokens: 2896, reasoningOutputTokens: 33381, reservedCents: 34.9184, chargedCents: 34.9184 })
    expect(receipt.outputTokens!).toBeLessThan(4096 + 32768)
    const evidenceBytes = new Uint8Array(await Bun.file(join(f.root, receipt.responseEvidencePath!)).arrayBuffer())
    expect(hash(evidenceBytes)).toBe(receipt.responseEvidenceSha256!)
    expect(JSON.parse(new TextDecoder().decode(evidenceBytes)).response).toEqual(payload)
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard({ ...f.options, pageId: f.plan.pages[1]!.id }))).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })
})

const timeoutRecoveryFixture = async () => {
  const f = await fixture('grok', 'grok-4.7')
  f.respond(async () => { throw new DOMException('The operation timed out.', 'AbortError') })
  await expect(f.run()).rejects.toThrow('The operation timed out.')
  const original = structuredClone((await f.ledger()).receipts[0]!)
  const authorize = async (patch: Record<string, unknown> = {}, errorPatch: Record<string, unknown> = {}, retained = original) => {
    const stem = `${retained.provider}-${retained.model}`
    const archive = `${base}/prior-attempts/native-timeout-${retained.id}/slots/${retained.caseId}/${stem}`
    const proofPath = `${archive}/failure.txt`, recordPath = `${base}/reconciliations/${retained.id}.json`
    await mkdir(join(f.root, archive), { recursive: true }); await mkdir(join(f.root, base, 'reconciliations'), { recursive: true })
    const evidence = JSON.stringify({ type: 'log', level: 'error', timestamp: retained.completedAt,
      error: { name: 'AbortError', message: 'The operation timed out.', ...errorPatch } }) + '\n'
    await Bun.write(join(f.root, proofPath), evidence)
    const directory = `${base}/slots/${retained.caseId}/${stem}`
    await Bun.write(join(f.root, archive, 'dispatch.json'), JSON.stringify({ caseId: retained.caseId, documentCaseId: retained.documentCaseId,
      provider: retained.provider, model: retained.model, inputSha256: retained.inputSha256, directory, status: 'failed',
      startedAt: retained.createdAt, completedAt: retained.completedAt, artifactHashes: [{ path: `${directory}/failure.txt`, sha256: hash(evidence) }] }))
    const record: NewspaperExpansionManualReconciliation = { schemaVersion: 1, kind: 'ocr-newspaper-expansion-manual-reconciliation',
      action: 'retain-full-reservation-and-authorize-one-recovery-invocation', approvalBudgetCents: 3000,
      approvalEvidence: NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE, planSha256: f.options.planSha256,
      receiptId: retained.id, caseId: retained.caseId, documentCaseId: retained.documentCaseId, provider: retained.provider,
      model: retained.model, inputSha256: retained.inputSha256, reservedCents: retained.reservedCents, chargedCents: retained.chargedCents,
      transportReview: 'timeout-no-reported-usage', failureEvidencePath: proofPath, failureEvidenceSha256: hash(evidence),
      reason: 'Retain the complete unknown charge and authorize one recovery after exact archived native timeout review.', createdAt: new Date().toISOString() }
    const bytes = JSON.stringify({ ...record, ...patch }); await Bun.write(join(f.root, recordPath), bytes)
    const ledger = await f.ledger(); ledger.reconciliations = [...(ledger.reconciliations ?? []).filter(link => link.path !== recordPath), { path: recordPath, sha256: hash(bytes) }]
    await Bun.write(join(f.root, f.options.ledgerPath), JSON.stringify(ledger))
  }
  return { ...f, original, authorize }
}

describe('newspaper exact archived native-timeout recovery', () => {
  test('one reviewed recovery retains the original full charge and cannot authorize a second invocation', async () => {
    const f = await timeoutRecoveryFixture(); await f.authorize(); f.respond(async () => json(usage('grok')))
    await f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))
    const ledger = await f.ledger(); expect(ledger.receipts[0]).toEqual(f.original)
    expect(ledger.receipts[1]).toMatchObject({ status: 'settled', recoveryOfReceiptId: f.original.id })
    expect(ledger.receipts.reduce((n, r) => n + r.chargedCents, 0)).toBeGreaterThan(f.original.reservedCents)
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))).rejects.toThrow('automatic redispatch')
    expect(f.calls).toHaveLength(2)
  })
  test('a recovery timeout needs its own receipt-specific review and retains both prior charges', async () => {
    const f = await timeoutRecoveryFixture(); await f.authorize()
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))).rejects.toThrow('The operation timed out.')
    const recovery = structuredClone((await f.ledger()).receipts[1]!)
    expect(recovery).toMatchObject({ status: 'ambiguous', recoveryOfReceiptId: f.original.id, chargedCents: f.original.reservedCents })
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))).rejects.toThrow('requires reconciliation')
    await f.authorize({}, {}, recovery); f.respond(async () => json(usage('grok')))
    await f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))
    const ledger = await f.ledger(); expect(ledger.receipts.slice(0, 2)).toEqual([f.original, recovery])
    expect(ledger.reconciliations).toHaveLength(2); expect(ledger.receipts[2]).toMatchObject({ status: 'settled', recoveryOfReceiptId: recovery.id })
    expect(ledger.receipts.reduce((n, r) => n + r.chargedCents, 0)).toBeGreaterThan(2 * f.original.reservedCents)
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))).rejects.toThrow('automatic redispatch')
  })
  for (const patch of [
    { transportReview: 'generic-timeout' }, { httpStatus: 503 }, { chargedCents: 0 }, { failureEvidenceSha256: '0'.repeat(64) },
    { kind: 'ocr-categories-efg-manual-reconciliation', approvalEvidence: 'User approved up to $30 for categories 5–7' }
  ]) test(`rejects altered timeout approval ${JSON.stringify(patch)}`, async () => {
    const f = await timeoutRecoveryFixture(); await f.authorize(patch)
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))).rejects.toThrow('OCR spending guard')
    expect(f.calls).toHaveLength(1)
  })
  for (const patch of [{ name: 'TimeoutError' }, { name: 'TypeError' }, { message: 'Another request timed out.' }]) test(`rejects altered native timeout evidence ${JSON.stringify(patch)}`, async () => {
    const f = await timeoutRecoveryFixture(); await f.authorize({}, patch)
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))).rejects.toThrow('OCR spending guard')
    expect(f.calls).toHaveLength(1)
  })
})

const finalAccountingFixture = async () => {
  const f = await fixture('grok', 'grok-4.7'), input = `data:image/png;base64,${Buffer.from(redDotPng).toString('base64')}`
  const fableBody = { model: 'claude-fable-5', max_tokens: 64000, messages: [{ role: 'user', content: [
    { type: 'text', text: 'Read the image.' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: Buffer.from(redDotPng).toString('base64') } }
  ] }] }
  f.respond(async () => json({ error: 'credit admission rejected' }, 400))
  await f.run(fableBody, endpoints['anthropic'], createNewspaperExpansionSpendingGuard({ ...f.options, provider: 'anthropic', model: 'claude-fable-5' }))
  const rejected = structuredClone((await f.ledger()).receipts[0]!)
  const payload = { model: 'grok-4.7', choices: [{ index: 0, finish_reason: 'length', message: { role: 'assistant', content: 'Incomplete synthetic newspaper fixture.' } }],
    usage: { prompt_tokens: 3758, completion_tokens: 4096, total_tokens: 54603, completion_tokens_details: { reasoning_tokens: 46749 }, num_sources_used: 0 } }
  f.respond(async () => json(payload)); await expect(f.run()).rejects.toThrow('exceeded the reserved allowance')
  const original = structuredClone((await f.ledger()).receipts[1]!), evidence = new Uint8Array(await Bun.file(join(f.root, original.responseEvidencePath!)).arrayBuffer())
  const record: NewspaperFinalBreachAccountingReview = {
    schemaVersion: 1, kind: 'ocr-newspaper-expansion-final-breach-accounting-review', action: 'retain-original-full-hold-and-continue-other-slots',
    approvalBudgetCents: 3000, approvalEvidence: NEWSPAPER_EXPANSION_APPROVAL_EVIDENCE, finalNoRedispatch: true,
    planSha256: f.options.planSha256, receiptId: original.id, receiptSha256: hash(JSON.stringify(original)),
    caseId: original.caseId, documentCaseId: original.documentCaseId, provider: 'grok', model: 'grok-4.7', inputSha256: original.inputSha256,
    requestSha256: original.requestSha256, httpStatus: 200, responseEvidencePath: original.responseEvidencePath!, responseEvidenceSha256: original.responseEvidenceSha256!,
    nativeFinishReason: 'length', inputTokens: 3758, visibleOutputTokens: 4096, reasoningOutputTokens: 46749, outputTokens: 50845,
    reservedCents: 34.9184, chargedCents: 34.9184, reviewedUsageCents: 31.2586,
    continueOnly: { caseId: rejected.caseId, documentCaseId: rejected.documentCaseId, provider: 'anthropic', model: 'claude-fable-5', inputSha256: rejected.inputSha256,
      rejectedReceiptId: rejected.id, rejectedReceiptSha256: hash(JSON.stringify(rejected)) },
    reason: 'Review the final native response only, keep all conservative charge and forbid Grok redispatch; permit only the prior zero-charge Fable slot.', createdAt: new Date().toISOString()
  }
  const context = async () => ({ review: record, ledger: await f.ledger(), plan: f.plan, planSha256: f.options.planSha256, responseEvidenceBytes: evidence })
  const authorize = async (patch: Record<string, unknown> = {}) => {
    const path = `${base}/reconciliations/final-accounting.json`, bytes = JSON.stringify({ ...record, ...patch })
    await mkdir(join(f.root, base, 'reconciliations'), { recursive: true }); await Bun.write(join(f.root, path), bytes)
    const ledger = await f.ledger(); ledger.reconciliations = [{ path, sha256: hash(bytes) }]
    await Bun.write(join(f.root, f.options.ledgerPath), JSON.stringify(ledger))
    return { reviewPath: path, reviewSha256: hash(bytes) }
  }
  return { ...f, input, fableBody, original, rejected, record, evidence, payload, context, authorize }
}

describe('newspaper terminal accounting review closes only the known hold and never authorizes Grok redispatch', () => {
  test('pure proof and shared file reader validate the exact native response while preserving the full breach receipt', async () => {
    const f = await finalAccountingFixture(), before = await f.ledger(), proof = validateNewspaperFinalBreachAccountingReview(await f.context())
    expect(proof).toMatchObject({ receiptId: f.original.id, finalNoRedispatch: true, reviewedUsageCents: 31.2586, retainedChargedCents: 34.9184, totalAccountedCents: 34.9184 })
    const link = await f.authorize()
    expect(await readNewspaperFinalBreachAccountingReview({ projectRoot: f.root, ...link, ledger: await f.ledger(), plan: f.plan, planSha256: f.options.planSha256 })).toEqual(proof)
    expect((await f.ledger()).receipts).toEqual(before.receipts)
  })
  test('the actual guard admits only the previously rejected Fable NYT slot, retaining the untouched Grok hold', async () => {
    const f = await finalAccountingFixture(); await f.authorize(); f.respond(async () => json(usage('anthropic')))
    await f.run(f.fableBody, endpoints['anthropic'], createNewspaperExpansionSpendingGuard({ ...f.options, provider: 'anthropic', model: 'claude-fable-5' }))
    const ledger = await f.ledger()
    expect(ledger.receipts.slice(0, 2)).toEqual([f.rejected, f.original]); expect(ledger.receipts[2]).toMatchObject({ status: 'settled', provider: 'anthropic', model: 'claude-fable-5' })
    expect(ledger.receipts[2]?.recoveryOfReceiptId).toBeUndefined(); expect(ledger.receipts[1]).toMatchObject({ status: 'breach', chargedCents: 34.9184 })
    expect(f.calls).toHaveLength(3)
    await expect(f.run(f.fableBody, endpoints['anthropic'], createNewspaperExpansionSpendingGuard({ ...f.options, provider: 'anthropic', model: 'claude-fable-5' }))).rejects.toThrow('automatic redispatch')
    expect(f.calls).toHaveLength(3)
  })
  test('both reused and fresh Grok guard invocations remain permanently blocked, and no other model or page receives authority', async () => {
    const f = await finalAccountingFixture(); await f.authorize()
    await expect(f.run()).rejects.toThrow('permanently forbids redispatch')
    await expect(f.run(f.body(), f.endpoint, createNewspaperExpansionSpendingGuard(f.options))).rejects.toThrow('permanently forbids redispatch')
    await expect(f.run(f.fableBody, endpoints['anthropic'], createNewspaperExpansionSpendingGuard({ ...f.options, provider: 'anthropic', model: 'claude-fable-5', pageId: f.plan.pages[1]!.id }))).rejects.toThrow('permits only')
    const openaiBody = { model: 'gpt-6-luna', input: [{ role: 'user', content: [{ type: 'input_image', image_url: f.input }] }] }
    await expect(f.run(openaiBody, endpoints['openai'], createNewspaperExpansionSpendingGuard({ ...f.options, provider: 'openai', model: 'gpt-6-luna' }))).rejects.toThrow('permits only')
    expect(f.calls).toHaveLength(2)
  })
  for (const patch of [
    { kind: 'ocr-categories-efg-manual-reconciliation' }, { action: 'retain-full-reservation-and-authorize-one-recovery-invocation' },
    { finalNoRedispatch: false }, { approvalBudgetCents: 3001 }, { approvalEvidence: 'User approved up to $30 for categories 5–7' },
    { planSha256: '0'.repeat(64) }, { receiptId: '00000000-0000-0000-0000-000000000000' }, { receiptSha256: '0'.repeat(64) },
    { inputSha256: '0'.repeat(64) }, { requestSha256: '0'.repeat(64) }, { responseEvidenceSha256: '0'.repeat(64) },
    { nativeFinishReason: 'stop' }, { inputTokens: 3757 }, { visibleOutputTokens: 4095 }, { reasoningOutputTokens: 46748 }, { outputTokens: 50844 },
    { reservedCents: 34 }, { chargedCents: 31.2586 }, { reviewedUsageCents: 31 }, { reviewedUsageCents: 35 }, { recoveryInvocationAllowed: true }
  ]) test(`rejects altered final authority ${JSON.stringify(patch)}`, async () => {
    const f = await finalAccountingFixture(); await f.authorize(patch)
    await expect(f.run(f.fableBody, endpoints['anthropic'], createNewspaperExpansionSpendingGuard({ ...f.options, provider: 'anthropic', model: 'claude-fable-5' })))
      .rejects.toThrow('kind' in patch ? 'approved recovery action' : 'final accounting review')
    expect(f.calls).toHaveLength(2)
  })
  test('rejects incomplete native usage, changed finish reason or extra output even when evidence hashes are repinned consistently', async () => {
    const f = await finalAccountingFixture()
    for (const change of [
      (p: typeof f.payload) => { p.choices[0]!.finish_reason = 'stop' },
      (p: typeof f.payload) => { p.usage.total_tokens = 54602 },
      (p: typeof f.payload) => { p.usage.completion_tokens_details.reasoning_tokens = 46748 },
      (p: typeof f.payload) => { p.choices.push(structuredClone(p.choices[0]!)) },
      (p: typeof f.payload) => { p.usage.num_sources_used = 1 }
    ]) {
      const context = await f.context(), envelope = JSON.parse(new TextDecoder().decode(f.evidence)), payload = structuredClone(f.payload)
      change(payload); envelope.response = payload
      const bytes = new TextEncoder().encode(JSON.stringify(envelope)), fingerprint = hash(bytes)
      const ledger = structuredClone(context.ledger); ledger.receipts[1]!.responseEvidenceSha256 = fingerprint
      const review = { ...f.record, responseEvidenceSha256: fingerprint, receiptSha256: hash(JSON.stringify(ledger.receipts[1])) }
      expect(() => validateNewspaperFinalBreachAccountingReview({ ...context, review, ledger, responseEvidenceBytes: bytes })).toThrow('native response')
    }
  })
  test('rejects byte changes, another unknown hold, changed original status, forged recovery rows or an over-budget ledger', async () => {
    const f = await finalAccountingFixture(), context = await f.context()
    expect(() => validateNewspaperFinalBreachAccountingReview({ ...context, responseEvidenceBytes: new TextEncoder().encode('{}') })).toThrow('checksum changed')
    for (const mutation of ['unknown', 'status', 'recovery', 'budget'] as const) {
      const ledger = structuredClone(context.ledger)
      if (mutation === 'status') ledger.receipts[1]!.status = 'settled'
      else if (mutation === 'recovery') ledger.receipts.push({ ...f.original, id: crypto.randomUUID(), recoveryOfReceiptId: f.original.id, status: 'settled', chargedCents: 1 })
      else if (mutation === 'unknown') ledger.receipts.push({ ...f.original, id: crypto.randomUUID(), status: 'ambiguous' })
      else for (const page of f.plan.pages.slice(1, 9)) ledger.receipts.push({ ...f.original, id: crypto.randomUUID(), caseId: page.id, documentCaseId: page.caseId,
        provider: 'anthropic', model: 'claude-fable-5', status: 'settled', reservedCents: 384, chargedCents: 384 })
      expect(() => validateNewspaperFinalBreachAccountingReview({ ...context, ledger })).toThrow('final accounting review')
    }
  })
  test('rejects a changed zero-charge rejection or any continuation target beyond Fable on the same NYT source', async () => {
    const f = await finalAccountingFixture(), context = await f.context()
    const changedPlan = { ...f.plan, pages: f.plan.pages.map((page, i) => i === 1 ? { ...page, caseId: 'constructor', id: 'constructor-page-01', input: `${base}/cases/constructor/input.png` } : page) }
    expect(() => validateNewspaperFinalBreachAccountingReview({ ...context, plan: changedPlan })).toThrow('altered approved page population')
    for (const patch of [{ provider: 'grok' }, { model: 'claude-fable-5-1' }, { caseId: f.plan.pages[1]!.id },
      { inputSha256: '0'.repeat(64) }, { rejectedReceiptId: f.original.id }, { rejectedReceiptSha256: '0'.repeat(64) }]) {
      expect(() => validateNewspaperFinalBreachAccountingReview({ ...context, review: { ...f.record, continueOnly: { ...f.record.continueOnly, ...patch } } })).toThrow('final accounting review')
    }
    const ledger = structuredClone(context.ledger); ledger.receipts[0]!.chargedCents = 1
    expect(() => validateNewspaperFinalBreachAccountingReview({ ...context, ledger })).toThrow('altered charge')
  })
  test('file loading rejects unpinned or external review/evidence paths before returning authority', async () => {
    const f = await finalAccountingFixture(), link = await f.authorize(), context = await f.context()
    const opts = { projectRoot: f.root, ...link, ledger: context.ledger, plan: f.plan, planSha256: f.options.planSha256 }
    await expect(readNewspaperFinalBreachAccountingReview({ ...opts, reviewSha256: '0'.repeat(64) })).rejects.toThrow('checksum changed')
    await expect(readNewspaperFinalBreachAccountingReview({ ...opts, reviewPath: '../outside.json' })).rejects.toThrow('private evidence path')
    await f.authorize({ responseEvidencePath: '/tmp/outside.json' })
    const ledger = await f.ledger(), changed = ledger.reconciliations![0]!
    await expect(readNewspaperFinalBreachAccountingReview({ ...opts, ledger, reviewPath: changed.path, reviewSha256: changed.sha256 })).rejects.toThrow('pin its own native response')
  })
  for (const profile of ['bc', 'd', 'efg'] as const) test(`legacy ${profile} authority rejects the new final-review action`, async () => {
    const f = await finalAccountingFixture(), legacyBase = `input/examples/document/ocr-${profile === 'd' ? 'category-d' : `categories-${profile}`}-run`
    const populations = profile === 'bc' ? CATEGORIES_BC_CASE_PAGES : profile === 'd' ? CATEGORY_D_CASE_PAGES : CATEGORIES_EFG_CASE_PAGES
    const imageBytes = profile === 'd' ? await new Bun.Image(redDotPng).resize(16, 12).jpeg().bytes() : redDotPng
    const metadata = await new Bun.Image(imageBytes).metadata(), mime = profile === 'd' ? 'image/jpeg' : 'image/png'
    const pages = Object.entries(populations).flatMap(([caseId, count]) => Array.from({ length: count }, (_, i) => ({ id: `${caseId}-page-${String(i + 1).padStart(2, '0')}`,
      caseId, pageNumber: i + 1, input: `${legacyBase}/pages/${caseId}-${i + 1}.${profile === 'd' ? 'jpg' : 'png'}`, inputSha256: hash(imageBytes),
      width: metadata.width, height: metadata.height, format: profile === 'd' ? 'jpg' : 'png' })))
    const plan = { schemaVersion: 1, kind: `ocr-${profile === 'd' ? 'category-d' : `categories-${profile}`}-execution-plan`,
      approval: { status: 'approved', budgetCents: profile === 'd' ? 2500 : 3000, evidence: profile === 'd' ? 'User approved up to $25 for category 4' : profile === 'efg' ? 'User approved up to $30 for categories 5–7' : 'User approved up to $30' },
      pages, targets: [...f.plan.targets, ...(profile === 'bc' ? [{ provider: 'mistral', model: 'mistral-ocr-4-0' }] : [])] }
    const planPath = `${legacyBase}/execution-plan.json`, planBytes = JSON.stringify(plan), ledgerPath = `${legacyBase}/spending-ledger.json`
    await mkdir(join(f.root, legacyBase), { recursive: true }); await Bun.write(join(f.root, planPath), planBytes)
    const make = profile === 'bc' ? createCategoriesBcSpendingGuard : profile === 'd' ? createCategoryDSpendingGuard : createCategoriesEfgSpendingGuard
    const options = { ...f.options, planPath, planSha256: hash(planBytes), ledgerPath, pageId: pages[0]!.id }
    const body = { model: 'grok-4.7', max_completion_tokens: 4096, messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mime};base64,${Buffer.from(imageBytes).toString('base64')}` } }] }] }
    f.respond(async () => json(f.payload)); await expect(f.run(body, endpoints['grok'], make(options))).rejects.toThrow('exceeded the reserved allowance')
    const ledger = await Bun.file(join(f.root, ledgerPath)).json(), recordPath = `${legacyBase}/reconciliations/final.json`, recordBytes = JSON.stringify(f.record)
    await mkdir(join(f.root, legacyBase, 'reconciliations'), { recursive: true }); await Bun.write(join(f.root, recordPath), recordBytes)
    ledger.reconciliations = [{ path: recordPath, sha256: hash(recordBytes) }]; await Bun.write(join(f.root, ledgerPath), JSON.stringify(ledger))
    const before = f.calls.length; await expect(f.run(body, endpoints['grok'], make(options))).rejects.toThrow('approved recovery action'); expect(f.calls).toHaveLength(before)
  })
})
