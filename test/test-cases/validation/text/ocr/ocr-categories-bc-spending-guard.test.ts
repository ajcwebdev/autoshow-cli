import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  CATEGORIES_BC_CASE_PAGES, CATEGORIES_BC_GROK_DOCUMENTATION_URL, CATEGORIES_BC_GROK_REVIEWED_POLICY,
  createCategoriesBcSpendingGuard
} from '~/tools/ocr-categories-bc-spending-guard'
import type {
  CategoriesBcExecutionPlan, CategoriesBcManualReconciliation, CategoriesBcSpendingGuardOptions, CategoriesBcSpendingLedger
} from '~/tools/ocr-categories-bc-spending-guard'
import { redDotPng } from '../../../../test-utils/media-fixtures'
import { runOpenAIOcr } from '~/cli/commands/text/ocr/ocr-services/openai-ocr/run-openai-ocr'
import { runAnthropicOcr } from '~/cli/commands/text/ocr/ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { runDeepinfraOcr } from '~/cli/commands/text/ocr/ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { runMistralOcr } from '~/cli/commands/text/ocr/ocr-services/mistral-ocr/run-mistral-ocr'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const base = 'input/examples/document/ocr-categories-bc-run'
const sha = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
// Native OCR request endpoints and output ceilings are independently documented in the providers' request contracts.
// OpenAI receives an explicit benchmark ceiling; Anthropic/Gemini/xAI/DeepInfra retain their native ceilings.
const contracts: ReadonlyArray<[string, string, number]> = [
  ['openai', 'gpt-6.1-sol', 16384], ['openai', 'gpt-6-luna', 16384], ['openai', 'gpt-6-astra', 16384], ['openai', 'gpt-5.6-terra', 16384],
  ['anthropic', 'claude-opus-5-5', 64000], ['anthropic', 'claude-sonnet-5-5', 64000], ['anthropic', 'claude-haiku-5-5', 64000],
  ['anthropic', 'claude-fable-5-1', 64000], ['anthropic', 'claude-fable-5', 64000],
  ['gemini', 'gemini-4-argon', 32768], ['gemini', 'gemini-3.8-flash', 8192], ['gemini', 'gemini-3.5-flash', 8192],
  ['gemini', 'gemini-3.6-flash', 8192], ['gemini', 'gemini-3.5-flash-lite', 8192],
  ['grok', 'grok-4.7', 4096], ['grok', 'grok-4.5', 4096],
  ['deepinfra', 'google/gemma-4-31B-it', 8192], ['deepinfra', 'Qwen/Qwen3.8-27B', 8192], ['deepinfra', 'deepseek-ai/DeepSeek-V4.1-Flash', 8192],
  ['mistral', 'mistral-ocr-4-0', 0], ['mistral', 'mistral-ocr-4-1', 0]
]
const endpoints: Record<string, string> = {
  openai: 'https://api.openai.com/v1/responses', anthropic: 'https://api.anthropic.com/v1/messages',
  grok: 'https://api.x.ai/v1/chat/completions', deepinfra: 'https://api.deepinfra.com/v1/openai/chat/completions',
  mistral: 'https://api.mistral.ai/v1/ocr'
}
const usage = (provider: string): unknown => provider === 'openai'
  ? { service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 } } }
  : provider === 'anthropic' ? { usage: { input_tokens: 1000, output_tokens: 200 } }
    : provider === 'gemini' ? { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100 } }
      : provider === 'mistral' ? { usage_info: { pages_processed: 1 } }
        : { usage: { prompt_tokens: 1000, completion_tokens: 200, completion_tokens_details: { reasoning_tokens: 150 } } }

const fixture = async (provider = 'openai', model = 'gpt-6-astra') => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-bc-budget-')); roots.push(root)
  await mkdir(join(root, base), { recursive: true })
  const pages = Object.entries(CATEGORIES_BC_CASE_PAGES).flatMap(([caseId, count]) => Array.from({ length: count }, (_, index) => ({
    id: `${caseId}-page-${String(index + 1).padStart(2, '0')}`, caseId, pageNumber: index + 1,
    input: `${base}/pages/${caseId}-${index + 1}.png`, inputSha256: sha(redDotPng), width: 1, height: 1
  })))
  const plan: CategoriesBcExecutionPlan = { schemaVersion: 1, kind: 'ocr-categories-bc-execution-plan',
    approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30' }, pages,
    targets: [...contracts.map(([provider, model]) => ({ provider, model })), { provider: 'tesseract', model: 'tesseract' }] }
  const planPath = `${base}/execution-plan.json`, ledgerPath = `${base}/spending-ledger.json`
  const planBytes = JSON.stringify(plan, null, 2) + '\n'; await Bun.write(join(root, planPath), planBytes)
  const calls: Array<{ input: string, init: RequestInit }> = []
  let respond: (init: RequestInit) => Promise<Response> = async () => json(usage(provider))
  const native = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => { calls.push({ input: String(input), init: init! }); return await respond(init!) }) as typeof fetch
  native.preconnect = fetch.preconnect
  const options: CategoriesBcSpendingGuardOptions = { ledgerPath, planPath, planSha256: sha(planBytes), pageId: pages[0]!.id,
    provider, model, projectRoot: root, fetchImplementation: native }
  const guard = createCategoriesBcSpendingGuard(options)
  const endpoint = provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : endpoints[provider]!
  const data = Buffer.from(redDotPng).toString('base64')
  const cap = contracts.find(([p, m]) => p === provider && m === model)![2]
  const body = (): Record<string, unknown> => {
    if (provider === 'openai') return { model, reasoning: { effort: 'high' }, input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Read visible text.' }, { type: 'input_image', image_url: `data:image/png;base64,${data}`, detail: 'high' }
    ] }] }
    if (provider === 'anthropic') return { model, max_tokens: cap, output_config: { effort: 'high' }, messages: [{ role: 'user', content: [
      { type: 'text', text: 'Read visible text.' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data } }
    ] }] }
    if (provider === 'gemini') return { contents: [{ role: 'user', parts: [{ text: 'Read visible text.' }, { inlineData: { mimeType: 'image/png', data } }] }],
      generationConfig: { maxOutputTokens: cap, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'LOW' } } }
    if (provider === 'mistral') return { model, document: { type: 'image_url', image_url: `data:image/png;base64,${data}` }, include_image_base64: false }
    return { model, [provider === 'grok' ? 'max_completion_tokens' : 'max_tokens']: cap,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Read visible text.' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${data}` } }] }] }
  }
  const run = async (value = body(), target = endpoint, guarded = guard) => await guarded(target, { method: 'POST', body: JSON.stringify(value), headers: { authorization: 'test-secret' } })
  const ledger = async (): Promise<CategoriesBcSpendingLedger> => await Bun.file(join(root, ledgerPath)).json() as CategoriesBcSpendingLedger
  const rewrite = async (change: (plan: CategoriesBcExecutionPlan) => void) => { const next = structuredClone(plan); change(next); const bytes = JSON.stringify(next); await Bun.write(join(root, planPath), bytes); return createCategoriesBcSpendingGuard({ ...options, planSha256: sha(bytes) }) }
  return { root, plan, options, calls, guard, body, run, ledger, rewrite, endpoint, respond: (next: typeof respond) => { respond = next } }
}

describe('category B/C budget admission and supported provider request dispatch', () => {
  test('all six native OCR adapters send a 3072-pixel PNG unchanged through the guard and decode a mocked text response', async () => {
    const bytes = await new Bun.Image(redDotPng).resize(3072, 2048).png().bytes()
    const keys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY', 'DEEPINFRA_API_KEY', 'MISTRAL_API_KEY']
    const prior = Object.fromEntries(keys.map(key => [key, process.env[key]])), originalFetch = globalThis.fetch
    const pageText = 'Synthetic adapter contract text.'
    const envelope = JSON.stringify({ pages: [{ pageNumber: 1, text: pageText }] })
    try {
      for (const key of keys) process.env[key] = 'nonbillable-mock-key'
      for (const [provider, model, run] of [
        ['openai', 'gpt-6-luna', runOpenAIOcr], ['anthropic', 'claude-haiku-5-5', runAnthropicOcr],
        ['gemini', 'gemini-3.5-flash-lite', runGeminiOcr], ['grok', 'grok-4.7', runGrokOcr],
        ['deepinfra', 'google/gemma-4-31B-it', runDeepinfraOcr], ['mistral', 'mistral-ocr-4-1', runMistralOcr]
      ] as const) {
        const f = await fixture(provider, model)
        const imagePath = join(f.root, f.plan.pages[0]!.input); await mkdir(join(f.root, base, 'pages'), { recursive: true }); await Bun.write(imagePath, bytes)
        const guard = await f.rewrite(p => { Object.assign(p.pages[0]!, { width: 3072, height: 2048, inputSha256: sha(bytes) }) })
        f.respond(async () => json(provider === 'openai'
          ? { ...usage(provider) as object, status: 'completed', output_text: pageText, output: [{ type: 'message', content: [{ type: 'output_text', text: pageText }] }] }
          : provider === 'anthropic' ? { ...usage(provider) as object, content: [{ type: 'text', text: envelope }], stop_reason: 'end_turn' }
            : provider === 'gemini' ? { ...usage(provider) as object, candidates: [{ content: { parts: [{ text: envelope }] }, finishReason: 'STOP' }] }
              : provider === 'mistral' ? { ...usage(provider) as object, pages: [{ index: 0, markdown: pageText }] }
                : { ...usage(provider) as object, choices: [{ message: { content: pageText }, finish_reason: 'stop' }] }))
        globalThis.fetch = guard
        const result = await run(imagePath, { format: 'png', slug: 'large-page', pageCount: 1, fileSize: bytes.length }, model, { dpi: 300, outputDir: f.root })
        expect(result.pages[0]?.text).toBe(pageText); expect(f.calls).toHaveLength(1)
        expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'settled', inputSha256: sha(bytes) })
      }
    } finally {
      globalThis.fetch = originalFetch
      for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key] }
    }
  })
  for (const [provider, model] of contracts) test(`${provider}/${model} dispatches its documented endpoint, image form and output ceiling`, async () => {
    const f = await fixture(provider, model); const response = await f.run(); expect(response.status).toBe(200); expect(f.calls).toHaveLength(1)
    expect(f.calls[0]!.input).toBe(f.endpoint); expect(f.calls[0]!.init.redirect).toBe('error')
    const sent = JSON.parse(f.calls[0]!.init.body as string)
    if (provider === 'openai') expect(sent).toMatchObject({ service_tier: 'default', max_output_tokens: 16384, prompt_cache_options: { mode: 'implicit', ttl: '30m' }, reasoning: { effort: 'high' } })
    else expect(sent).toEqual(f.body())
    const ledger = await f.ledger(); expect(ledger).toMatchObject({ kind: 'ocr-categories-bc-spending-ledger', budgetCents: 3000, planSha256: f.options.planSha256 })
    expect(ledger.receipts[0]).toMatchObject({ status: 'settled', caseId: f.options.pageId, documentCaseId: f.plan.pages[0]!.caseId })
    expect(JSON.stringify(ledger)).not.toContain('test-secret'); expect(JSON.stringify(ledger)).not.toContain('Read visible text')
  })
  test('default, explicit cache override, and reset preserve Standard billing and native reasoning through fetch', async () => {
    const f = await fixture('openai', 'gpt-6-luna'); await f.run(); await f.run({ ...f.body(), service_tier: 'default', prompt_cache_options: { mode: 'explicit', ttl: '30m' } }); await f.run()
    const sent = f.calls.map(c => JSON.parse(c.init.body as string)); expect(sent.map(b => b.prompt_cache_options.mode)).toEqual(['implicit', 'explicit', 'implicit'])
    expect(sent.every(b => b.service_tier === 'default' && b.max_output_tokens === 16384 && b.reasoning.effort === 'high')).toBe(true)
    expect((await f.ledger()).receipts).toHaveLength(3); await expect(f.run()).rejects.toThrow('maximum request attempts'); expect(f.calls).toHaveLength(3)
  })
  test('prices ordinary/cache-read/30m-write tokens separately and does not double-count inclusive reasoning', async () => {
    const f = await fixture(); f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 12000, output_tokens: 200,
      output_tokens_details: { reasoning_tokens: 150 }, input_tokens_details: { cached_tokens: 4000, cache_write_tokens: 7000, cache_write_tokens_details: { ttl_30m_tokens: 7000, ttl_12h_tokens: 0 } } } }))
    await f.run(); expect((await f.ledger()).receipts[0]).toMatchObject({ chargedCents: 11.15, costBasis: 'provider-usage-at-reviewed-rates' })
  })
  test('incomplete OpenAI cache components are retained as a labeled conservative valuation', async () => {
    const f = await fixture(); f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200 } }))
    await f.run(); expect((await f.ledger()).receipts[0]).toMatchObject({ chargedCents: 2.25, costBasis: 'conservative-upper-bound' })
  })
  test('xAI adds separate reasoning, Gemini adds thoughts, and DeepInfra uses inclusive completions once', async () => {
    for (const [provider, model, outputTokens] of [['grok', 'grok-4.7', 350], ['gemini', 'gemini-4-argon', 300], ['deepinfra', 'google/gemma-4-31B-it', 200]] as const) {
      const f = await fixture(provider, model); await f.run(); expect((await f.ledger()).receipts[0]).toMatchObject({ outputTokens })
    }
  })
})

describe('category B/C unsafe or changed inputs are rejected before fetch', () => {
  for (const patch of [{ model: 'other' }, { max_output_tokens: 999999 }, { stream: true }, { tools: [] }, { n: 2 },
    { service_tier: 'priority' }, { service_tier: 'fast' }, { service_tier: null }, { prompt_cache_retention: '24h' },
    { prompt_cache_options: { ttl: '12h' } }, { prompt_cache_options: { mode: 'disabled' } }, { prompt_cache_options: { unexpected: true } },
    { search_parameters: {} }, { web_search_options: {} }, { audio: {} }, { modalities: ['audio'] },
    { previous_response_id: 'resp_other' }, { conversation: 'other' }, { cachedContent: 'cachedContents/other' }]) test(`rejects unapproved controls ${JSON.stringify(patch)}`, async () => {
    const f = await fixture(); await expect(f.run({ ...f.body(), ...patch })).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(0)
  })
  for (const url of ['https://attacker.example/v1/responses', 'http://api.openai.com/v1/responses', 'https://api.openai.com/v1/responses?query=1', 'https://api.openai.com/v1/audio/speech']) test(`rejects endpoint ${url}`, async () => {
    const f = await fixture(); await expect(f.run(f.body(), url)).rejects.toThrow('unapproved provider host'); expect(f.calls).toHaveLength(0)
  })
  test('rejects a changed plan checksum, a mutable options bypass, and a changed approval budget', async () => {
    const f = await fixture(); const bytes = JSON.stringify({ ...f.plan, approval: { ...f.plan.approval, budgetCents: 3001 } }); await Bun.write(join(f.root, f.options.planPath!), bytes)
    f.options.planSha256 = sha(bytes); await expect(f.run()).rejects.toThrow('checksum changed')
    const fresh = createCategoriesBcSpendingGuard(f.options); await expect(f.run(f.body(), f.endpoint, fresh)).rejects.toThrow('explicit approved'); expect(f.calls).toHaveLength(0)
  })
  test('rejects an unquoted target, duplicate page, undeclared case or out-of-bounds page dimensions', async () => {
    for (const patch of [
      (p: CategoriesBcExecutionPlan) => { p.targets[0]!.model = 'other' },
      (p: CategoriesBcExecutionPlan) => { p.pages[1] = p.pages[0]! },
      (p: CategoriesBcExecutionPlan) => { p.pages[0]!.caseId = 'advertisement' },
      (p: CategoriesBcExecutionPlan) => { p.pages[0]!.width = 4097 }
    ]) { const f = await fixture(); const guard = await f.rewrite(patch); await expect(f.run(f.body(), f.endpoint, guard)).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(0) }
  })
  test('rejects wrong image bytes, extra images, remote images and oversized schemas before fetch', async () => {
    const f = await fixture(); const wrong = f.body(), extra = f.body(), remote = f.body()
    const content = (body: Record<string, unknown>) => (body['input'] as Array<{ content: Array<Record<string, unknown>> }>)[0]!.content
    content(wrong)[1]!['image_url'] = 'data:image/png;base64,YWJj'; content(extra).push(content(extra)[1]!); content(remote)[1]!['image_url'] = 'https://example.com/a.png'
    for (const body of [wrong, extra, remote, { ...f.body(), text: 'x'.repeat(9000) }]) await expect(f.run(body)).rejects.toThrow('OCR spending guard')
    expect(f.calls).toHaveLength(0)
  })
  test('rejects native output overrides for non-OpenAI providers before fetch', async () => {
    for (const [provider, model] of [['anthropic', 'claude-fable-5'], ['grok', 'grok-4.7'], ['deepinfra', 'Qwen/Qwen3.8-27B'], ['gemini', 'gemini-4-argon']] as const) {
      const f = await fixture(provider, model); const body = f.body(); if (provider === 'gemini') body['generationConfig'] = { maxOutputTokens: 999999 }; else body[provider === 'grok' ? 'max_completion_tokens' : 'max_tokens'] = 999999
      await expect(f.run(body)).rejects.toThrow('output cap'); expect(f.calls).toHaveLength(0)
    }
  })
  test('rejects hidden uploaded-file and cache-controlled sources beside the authorized PNG', async () => {
    const f = await fixture()
    for (const extra of [{ type: 'document', source: { type: 'file', file_id: 'file-other' } }, { file_uri: 'uploaded-file' }, { cache_control: { type: 'ephemeral' } }]) {
      const body = f.body(); (body['input'] as Array<{ content: unknown[] }>)[0]!.content.push(extra)
      await expect(f.run(body)).rejects.toThrow('unapproved document'); expect(f.calls).toHaveLength(0)
    }
  })
  test('rejects escaping plan and ledger paths, symlinked plans, and unknown page/model IDs', async () => {
    const f = await fixture()
    for (const ledgerPath of ['../ledger.json', '/tmp/ledger.json', `${base}/../ledger.json`]) expect(() => createCategoriesBcSpendingGuard({ ...f.options, ledgerPath })).toThrow('private project-relative')
    await expect(f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard({ ...f.options, pageId: 'unknown' }))).rejects.toThrow('outside')
    expect(() => createCategoriesBcSpendingGuard({ ...f.options, model: 'unknown' })).toThrow('outside')
    const outside = join(f.root, 'outside.json'); await Bun.write(outside, JSON.stringify(f.plan)); await unlink(join(f.root, f.options.planPath!)); await symlink(outside, join(f.root, f.options.planPath!))
    await expect(f.run()).rejects.toThrow('escaped'); expect(f.calls).toHaveLength(0)
  })
})

describe('category B/C cumulative concurrency, retained ambiguity and recovery', () => {
  test('native Grok keeps its 4096 visible cap while separately reserving and billing documented reasoning tokens', async () => {
    const f = await fixture('grok', 'grok-4.7'), originalFetch = globalThis.fetch, originalKey = process.env['XAI_API_KEY']
    const imagePath = join(f.root, f.plan.pages[0]!.input); await mkdir(join(f.root, base, 'pages'), { recursive: true }); await Bun.write(imagePath, redDotPng)
    f.respond(async init => {
      expect(JSON.parse(init.body as string).max_completion_tokens).toBe(4096)
      expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'reserved', reservedCents: 34.9184 })
      return json({ choices: [{ message: { content: 'Synthetic visible text.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3658, completion_tokens: 1167, completion_tokens_details: { reasoning_tokens: 4096 }, total_tokens: 8921 } })
    })
    try {
      process.env['XAI_API_KEY'] = 'nonbillable-mock-key'; globalThis.fetch = f.guard
      const result = await runGrokOcr(imagePath, { format: 'png', slug: 'synthetic', pageCount: 1, fileSize: redDotPng.length }, 'grok-4.7', { dpi: 300, outputDir: f.root })
      expect(result.pages[0]?.text).toBe('Synthetic visible text.')
      expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'settled', outputTokens: 5263, visibleOutputTokens: 1167, reasoningOutputTokens: 4096, chargedCents: 3.8894 })
    } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env['XAI_API_KEY']; else process.env['XAI_API_KEY'] = originalKey }
  })
  for (const [visible, reasoning] of [[4097, 0], [100, 32769]]) test(`Grok visible ${visible} / reasoning ${reasoning} independently enforce the reviewed bounds and preserve private failure JSON`, async () => {
    const f = await fixture('grok', 'grok-4.7'), payload = { usage: { prompt_tokens: 1000, completion_tokens: visible, completion_tokens_details: { reasoning_tokens: reasoning } }, choices: [{ message: { content: 'Private synthetic text.' } }] }
    f.respond(async () => json(payload)); await expect(f.run()).rejects.toThrow('exceeded')
    const receipt = (await f.ledger()).receipts[0]!; expect(receipt).toMatchObject({ status: 'breach', chargedCents: 34.9184, visibleOutputTokens: visible, reasoningOutputTokens: reasoning })
    const bytes = await Bun.file(join(f.root, receipt.responseEvidencePath!)).text(); expect(sha(bytes)).toBe(receipt.responseEvidenceSha256!)
    const captured = JSON.parse(bytes); expect(captured.response).toEqual(payload); expect(captured.serialization).toContain('not original response bytes')
    await expect(f.run()).rejects.toThrow('requires reconciliation')
  })
  test('three parallel slots reserve before fetch and settle without losing any receipts', async () => {
    const f = await fixture(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve })
    f.respond(async () => { await gate; return json(usage('openai')) })
    const running = [0, 1, 2].map(index => f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard({ ...f.options, pageId: f.plan.pages[index]!.id })))
    while (f.calls.length < 3) await Bun.sleep(5)
    const pending = await f.ledger(); expect(pending.receipts).toHaveLength(3); expect(pending.receipts.every(r => r.status === 'reserved')).toBe(true)
    expect(pending.receipts.reduce((s, r) => s + r.chargedCents, 0)).toBeCloseTo(485.76)
    release(); await Promise.all(running); const final = await f.ledger(); expect(final.receipts).toHaveLength(3); expect(final.receipts.every(r => r.status === 'settled')).toBe(true)
    expect(new Set(final.receipts.map(r => r.id)).size).toBe(3)
  })
  test('same-slot concurrent and later fresh invocations are blocked while admitted work is preserved', async () => {
    const f = await fixture(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve }); f.respond(async () => { await gate; return json(usage('openai')) })
    const first = f.run(); while (!f.calls.length) await Bun.sleep(5)
    await expect(f.run()).rejects.toThrow('in-flight'); await expect(f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard(f.options))).rejects.toThrow('in-flight')
    release(); await first; await expect(f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard(f.options))).rejects.toThrow('automatic redispatch'); expect(f.calls).toHaveLength(1)
  })
  test('parallel admissions count all prior spending and every live reservation against the shared $30', async () => {
    const f = await fixture('anthropic', 'claude-fable-5'); f.respond(async () => json({ usage: { input_tokens: 64000, output_tokens: 64000 } }))
    for (let i = 0; i < 6; i++) await f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard({ ...f.options, pageId: f.plan.pages[i]!.id }))
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve }); f.respond(async () => { await gate; return json(usage('anthropic')) })
    const finished: string[] = []
    const running = [6, 7, 8].map(index => f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard({ ...f.options, pageId: f.plan.pages[index]!.id }))
      .then(() => { finished.push('fulfilled') }, () => { finished.push('rejected') }))
    while (finished.length < 2) await Bun.sleep(5)
    expect(finished).toEqual(['rejected', 'rejected']); expect(f.calls).toHaveLength(7)
    const pending = await f.ledger(); expect(pending.receipts.at(-1)?.status).toBe('reserved'); expect(pending.receipts.reduce((s, r) => s + r.chargedCents, 0)).toBe(2688)
    release(); await Promise.all(running); expect(finished.filter(s => s === 'fulfilled')).toHaveLength(1)
    expect((await f.ledger()).receipts.reduce((s, r) => s + r.chargedCents, 0)).toBe(2306)
  })
  test('an ambiguous response blocks later admissions but other already admitted work may settle', async () => {
    const f = await fixture(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve }); f.respond(async () => { await gate; return json(usage('openai')) })
    const inFlight = f.run(); while (!f.calls.length) await Bun.sleep(5)
    const failing = createCategoriesBcSpendingGuard({ ...f.options, pageId: f.plan.pages[1]!.id, fetchImplementation: Object.assign(async () => json({ error: 'temporary' }, 503), { preconnect: fetch.preconnect }) as typeof fetch })
    await expect(f.run(f.body(), f.endpoint, failing)).rejects.toThrow('did not establish complete usage')
    await expect(f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard({ ...f.options, pageId: f.plan.pages[2]!.id }))).rejects.toThrow('requires reconciliation')
    release(); await inFlight; expect((await f.ledger()).receipts.map(r => r.status).sort()).toEqual(['ambiguous', 'settled'])
  })
  for (const status of [400, 401, 403, 404, 429]) test(`explicit HTTP ${status} rejection settles at zero and may be retried`, async () => {
    const f = await fixture(); f.respond(async () => json({ error: 'rejected' }, status)); expect((await f.run()).status).toBe(status); expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'rejected', chargedCents: 0 })
    f.respond(async () => json(usage('openai'))); await f.run(); expect(f.calls).toHaveLength(2)
  })
  for (const value of [json({ text: 'missing usage' }), new Response('invalid JSON'), json({ error: 'provider failure' }, 500), json({ service_tier: 'fast', usage: { input_tokens: 1, output_tokens: 1 } })]) test('missing usage or unreviewed billing retains the full reservation and blocks all later slots', async () => {
    const f = await fixture(); f.respond(async () => value); await expect(f.run()).rejects.toThrow('OCR spending guard'); expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'ambiguous', chargedCents: 161.92 })
    await expect(f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard({ ...f.options, pageId: f.plan.pages[1]!.id }))).rejects.toThrow('requires reconciliation')
  })
  test('an allowance breach keeps the greater of reported cost and reservation, then blocks new work', async () => {
    const f = await fixture(); f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 64000, output_tokens: 20000 } }))
    await expect(f.run()).rejects.toThrow('exceeded'); expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'breach', chargedCents: 180 })
    await expect(f.run()).rejects.toThrow('requires reconciliation')
  })
  test('HTTP 503 recovery preserves the original charge, pins its manual record, and permits exactly one fresh invocation', async () => {
    const f = await fixture('gemini', 'gemini-3.5-flash-lite'); f.respond(async () => json({ error: 'temporary unavailable' }, 503)); await expect(f.run()).rejects.toThrow('did not establish complete usage')
    const original = structuredClone((await f.ledger()).receipts[0]!)
    const record: CategoriesBcManualReconciliation = { schemaVersion: 1, kind: 'ocr-categories-bc-manual-reconciliation', action: 'retain-full-reservation-and-authorize-one-recovery-invocation',
      approvalBudgetCents: 3000, approvalEvidence: 'User approved up to $30', planSha256: f.options.planSha256,
      receiptId: original.id, caseId: original.caseId, documentCaseId: original.documentCaseId, provider: original.provider, model: original.model,
      inputSha256: original.inputSha256, httpStatus: 503, reservedCents: original.reservedCents, chargedCents: original.chargedCents,
      reason: 'Keep full unknown cost while executing one recovery within the same approved batch.', createdAt: new Date().toISOString() }
    const path = `${base}/reconciliations/503.json`; await mkdir(join(f.root, base, 'reconciliations'), { recursive: true }); const bytes = JSON.stringify(record); await Bun.write(join(f.root, path), bytes)
    const ledger = await f.ledger(); ledger.reconciliations = [{ path, sha256: sha(bytes) }]; await Bun.write(join(f.root, f.options.ledgerPath), JSON.stringify(ledger))
    f.respond(async () => json(usage('gemini'))); await f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard(f.options))
    const final = await f.ledger(); expect(final.receipts[0]).toEqual(original); expect(final.receipts[1]).toMatchObject({ status: 'settled', recoveryOfReceiptId: original.id, recoveryReconciliationSha256: sha(bytes) })
    expect(final.receipts.reduce((s, r) => s + r.chargedCents, 0)).toBeGreaterThan(original.chargedCents)
    await expect(f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard(f.options))).rejects.toThrow('automatic redispatch')
    await Bun.write(join(f.root, path), JSON.stringify({ ...record, chargedCents: 0 }))
    await expect(f.run(f.body(), f.endpoint, createCategoriesBcSpendingGuard({ ...f.options, pageId: f.plan.pages[1]!.id }))).rejects.toThrow('checksum changed')
  })
  test('ordinary brief ledger lock contention waits for the existing writer rather than dropping admitted receipts', async () => {
    const f = await fixture(); const path = join(f.root, `${f.options.ledgerPath}.lock`); await Bun.write(path, '')
    const run = f.run(); await Bun.sleep(40); await unlink(path); await run; expect((await f.ledger()).receipts).toHaveLength(1)
  })
})

const legacyGrokBreachFixture = async () => {
  const f = await fixture('grok', 'grok-4.7'); await f.run()
  const ledger = await f.ledger(), original = ledger.receipts[0]!
  Object.assign(original, { status: 'breach', httpStatus: 200, inputTokens: 3658, outputTokens: 5263, reservedCents: 15.2576, chargedCents: 15.2576,
    reason: 'reported usage exceeded the reserved allowance; further dispatch blocked' })
  delete original.visibleOutputTokens; delete original.reasoningOutputTokens
  await Bun.write(join(f.root, f.options.ledgerPath), JSON.stringify(ledger))
  const retained = structuredClone(original)
  const record: CategoriesBcManualReconciliation = { schemaVersion: 1, kind: 'ocr-categories-bc-manual-reconciliation', action: 'retain-full-reservation-and-authorize-one-recovery-invocation',
    approvalBudgetCents: 3000, approvalEvidence: 'User approved up to $30', planSha256: f.options.planSha256,
    receiptId: original.id, caseId: original.caseId, documentCaseId: original.documentCaseId, provider: original.provider, model: original.model,
    inputSha256: original.inputSha256, httpStatus: 200, reservedCents: original.reservedCents, chargedCents: original.chargedCents,
    reviewedPolicy: CATEGORIES_BC_GROK_REVIEWED_POLICY, documentationUrl: CATEGORIES_BC_GROK_DOCUMENTATION_URL, nativeVisibleOutputCap: 4096, reasoningAllowance: 32768,
    reason: 'The earlier guard conflated the visible output limit with separately billed reasoning. Preserve its full original charge and authorize one recovery; no original response bytes or output components were retained.', createdAt: new Date().toISOString() }
  const path = `${base}/reconciliations/legacy-grok.json`
  const authorize = async (patch: Record<string, unknown> = {}, receiptPatch: Record<string, unknown> = {}) => {
    await mkdir(join(f.root, base, 'reconciliations'), { recursive: true }); const bytes = JSON.stringify({ ...record, ...patch }); await Bun.write(join(f.root, path), bytes)
    const current = await f.ledger(); Object.assign(current.receipts[0]!, receiptPatch); current.reconciliations = [{ path, sha256: sha(bytes) }]; await Bun.write(join(f.root, f.options.ledgerPath), JSON.stringify(current))
  }
  const fresh = () => createCategoriesBcSpendingGuard(f.options)
  return { ...f, retained, record, authorize, fresh }
}

describe('narrow legacy Grok visible/reasoning policy reconciliation', () => {
  test('keeps the full historical breach receipt unchanged and admits only one fresh recovery invocation', async () => {
    const f = await legacyGrokBreachFixture(); await f.authorize(); await f.run(f.body(), f.endpoint, f.fresh())
    const final = await f.ledger(); expect(final.receipts[0]).toEqual(f.retained); expect(final.receipts[1]).toMatchObject({ status: 'settled', recoveryOfReceiptId: f.retained.id })
    expect(final.receipts.reduce((s, r) => s + r.chargedCents, 0)).toBeGreaterThan(15.2576)
    await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('automatic redispatch')
  })
  for (const patch of [
    { reviewedPolicy: 'unreviewed' }, { documentationUrl: 'https://example.com' }, { nativeVisibleOutputCap: 8192 }, { reasoningAllowance: 65536 },
    { chargedCents: 0 }, { httpStatus: 503 }, { planSha256: '0'.repeat(64) }
  ]) test(`rejects changed retained-breach authority before fetch ${JSON.stringify(patch)}`, async () => {
    const f = await legacyGrokBreachFixture(); await f.authorize(patch); await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(1)
  })
  for (const receiptPatch of [{ inputTokens: 64001 }, { outputTokens: 36865 }, { outputTokens: 4096 }, { reservedCents: 34.9184, chargedCents: 34.9184 }, { visibleOutputTokens: 4097, reasoningOutputTokens: 0 }]) test(`does not authorize a genuine or newly measured breach ${JSON.stringify(receiptPatch)}`, async () => {
    const f = await legacyGrokBreachFixture(); await f.authorize({}, receiptPatch); await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(1)
  })
})

const socketRecoveryFixture = async () => {
  const f = await fixture('openai', 'gpt-5.6-terra')
  const message = 'The socket connection was closed unexpectedly. For more information, pass `verbose: true` in the second argument to fetch()'
  f.respond(async () => { throw new TypeError(message) }); await expect(f.run()).rejects.toThrow('socket connection was closed')
  const original = structuredClone((await f.ledger()).receipts[0]!)
  const stem = `${original.provider}-${original.model}`.replace(/[^a-zA-Z0-9_.-]/g, '-')
  const archive = `${base}/prior-attempts/socket-recovery/slots/${original.caseId}/${stem}`
  const failurePath = `${archive}/failure.txt`, recordPath = `${base}/reconciliations/socket-recovery.json`
  await mkdir(join(f.root, archive), { recursive: true }); await mkdir(join(f.root, base, 'reconciliations'), { recursive: true })
  const authorize = async (patch: Record<string, unknown> = {}, errorPatch: Record<string, unknown> = {}, receiptPatch: Record<string, unknown> = {}, journalPatch: Record<string, unknown> = {}) => {
    const bytes = JSON.stringify({ schemaVersion: 1, type: 'log', level: 'error', timestamp: original.completedAt,
      error: { name: 'TypeError', message, ...errorPatch } }) + '\n'
    await Bun.write(join(f.root, failurePath), bytes)
    const originalDirectory = `${base}/slots/${original.caseId}/${stem}`
    await Bun.write(join(f.root, archive, 'dispatch.json'), JSON.stringify({ caseId: original.caseId, documentCaseId: original.documentCaseId,
      provider: original.provider, model: original.model, inputSha256: original.inputSha256, status: 'failed', directory: originalDirectory,
      startedAt: original.createdAt, completedAt: original.completedAt, artifactHashes: [{ path: `${originalDirectory}/failure.txt`, sha256: sha(bytes) }], ...journalPatch }))
    const record: CategoriesBcManualReconciliation = { schemaVersion: 1, kind: 'ocr-categories-bc-manual-reconciliation',
      action: 'retain-full-reservation-and-authorize-one-recovery-invocation', approvalBudgetCents: 3000,
      approvalEvidence: 'User approved up to $30', planSha256: f.options.planSha256, receiptId: original.id,
      caseId: original.caseId, documentCaseId: original.documentCaseId, provider: original.provider, model: original.model,
      inputSha256: original.inputSha256, reservedCents: original.reservedCents, chargedCents: original.chargedCents,
      transportReview: 'socket-closed-no-reported-usage', failureEvidencePath: failurePath, failureEvidenceSha256: sha(bytes),
      reason: 'Reviewed the archived native TypeError and retained all uncertain spending; authorize one separately counted recovery under the same $30 approval.', createdAt: new Date().toISOString() }
    const recordBytes = JSON.stringify({ ...record, ...patch }); await Bun.write(join(f.root, recordPath), recordBytes)
    const ledger = await f.ledger(); Object.assign(ledger.receipts[0]!, receiptPatch); ledger.reconciliations = [{ path: recordPath, sha256: sha(recordBytes) }]
    await Bun.write(join(f.root, f.options.ledgerPath), JSON.stringify(ledger))
  }
  return { ...f, original, failurePath, authorize, fresh: () => createCategoriesBcSpendingGuard(f.options) }
}

describe('reviewed socket-closed transport recovery retains all uncertain spending', () => {
  test('pins archived native failure evidence, preserves the original reservation and admits exactly one recovery invocation', async () => {
    const f = await socketRecoveryFixture(); await f.authorize(); f.respond(async () => json(usage('openai')))
    await f.run(f.body(), f.endpoint, f.fresh()); const ledger = await f.ledger(); expect(ledger.receipts[0]).toEqual(f.original)
    expect(ledger.receipts[1]).toMatchObject({ status: 'settled', recoveryOfReceiptId: f.original.id }); expect(ledger.receipts.reduce((s, r) => s + r.chargedCents, 0)).toBeGreaterThan(f.original.chargedCents)
    await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('automatic redispatch')
  })
  for (const patch of [{ transportReview: 'generic-network-error' }, { failureEvidenceSha256: '0'.repeat(64) }, { httpStatus: 503 },
    { failureEvidencePath: `${base}/slots/not-archived/failure.txt` }, { chargedCents: 0 }, { planSha256: '0'.repeat(64) }]) test(`rejects changed socket recovery proof ${JSON.stringify(patch)}`, async () => {
    const f = await socketRecoveryFixture(); await f.authorize(patch); await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(1)
  })
  for (const error of [{ name: 'TimeoutError' }, { message: 'Network request failed.' }, { message: 'The socket connection was closed unexpectedly (different error)' }]) test(`does not authorize a different native error ${JSON.stringify(error)}`, async () => {
    const f = await socketRecoveryFixture(); await f.authorize({}, error); await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(1)
  })
  test('rejects changed evidence bytes, an unmatched archived journal and any claimed reported usage', async () => {
    const f = await socketRecoveryFixture(); await f.authorize(); await Bun.write(join(f.root, f.failurePath), 'changed evidence')
    await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('checksum changed')
    await f.authorize({}, {}, {}, { model: 'other-model' }); await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('journal differs')
    await f.authorize({}, {}, { inputTokens: 1 }); await expect(f.run(f.body(), f.endpoint, f.fresh())).rejects.toThrow('OCR spending guard'); expect(f.calls).toHaveLength(1)
  })
})
