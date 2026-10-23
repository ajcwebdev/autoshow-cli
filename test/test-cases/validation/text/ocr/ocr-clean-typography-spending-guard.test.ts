import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLEAN_TYPOGRAPHY_SOURCE_PINS } from '~/tools/ocr-clean-typography-admission'
import {
  CLEAN_TYPOGRAPHY_SPENDING_RATES,
  createCleanTypographySpendingGuard
} from '~/tools/ocr-clean-typography-spending-guard'
import type { CleanTypographyManualReconciliation, CleanTypographySpendingGuardOptions, CleanTypographySpendingLedger } from '~/tools/ocr-clean-typography-spending-guard'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const endpoints: Record<string, string> = {
  openai: 'https://api.openai.com/v1/responses', anthropic: 'https://api.anthropic.com/v1/messages',
  mistral: 'https://api.mistral.ai/v1/ocr', grok: 'https://api.x.ai/v1/chat/completions',
  deepinfra: 'https://api.deepinfra.com/v1/openai/chat/completions'
}
const usage = (provider: string): unknown => {
  if (provider === 'mistral') return { pages: [{ index: 0, markdown: 'Read text' }], usage_info: { pages_processed: 1 } }
  if (provider === 'gemini') return { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100, thoughtsTokenCount: 200 } }
  if (provider === 'openai') return { service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200, output_tokens_details: { reasoning_tokens: 150 } } }
  if (provider === 'anthropic') return { usage: { input_tokens: 1000, output_tokens: 200 } }
  return { usage: { prompt_tokens: 1000, completion_tokens: 200, completion_tokens_details: { reasoning_tokens: 150 } } }
}
const fixture = async (provider = 'openai', model = 'gpt-6-astra', budgetCents = 500) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-ocr-spending-'))
  directories.push(root)
  const pin = { ...CLEAN_TYPOGRAPHY_SOURCE_PINS[0]!, width: 1, height: 1,
    inputSha256: new Bun.CryptoHasher('sha256').update(redDotPng).digest('hex') }
  await Bun.write(join(root, 'plan.json'), JSON.stringify({ approval: { status: 'approved', budgetCents: 500, evidence: 'User approved up to $5' } }))
  const calls: Array<{ url: string, init: RequestInit }> = []
  let respond: (input: Parameters<typeof fetch>[0], init: RequestInit) => Promise<Response> = async () => json(usage(provider))
  const original = (async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init! })
    return await respond(input, init!)
  }) as typeof fetch
  original.preconnect = fetch.preconnect
  const options: CleanTypographySpendingGuardOptions = { projectRoot: root, ledgerPath: 'ledger.json', planPath: 'plan.json',
    caseId: pin.id, provider, model, trustedSources: [pin], budgetCents, fetchImplementation: original }
  const data = Buffer.from(redDotPng).toString('base64')
  const body = (): Record<string, unknown> => {
    const pricing = CLEAN_TYPOGRAPHY_SPENDING_RATES[`${provider}/${model}`]!
    if (provider === 'gemini') return { contents: [{ role: 'user', parts: [{ text: 'Read the visible page.' }, { inlineData: { mimeType: 'image/png', data } }] }],
      generationConfig: { maxOutputTokens: pricing.outputCap, thinkingConfig: { thinkingLevel: 'LOW' }, responseMimeType: 'application/json' } }
    if (provider === 'anthropic') return { model, max_tokens: pricing.outputCap, output_config: { effort: 'high' },
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Read the visible page.' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data } }] }] }
    if (provider === 'mistral') return { model, document: { type: 'image_url', image_url: `data:image/png;base64,${data}` }, include_image_base64: false }
    const media = { type: 'image_url', image_url: { url: `data:image/png;base64,${data}` } }
    if (provider === 'openai') return { model, reasoning: { effort: 'high' }, input: [{ role: 'user', content: [{ type: 'input_text', text: 'Read the visible page.' }, { type: 'input_image', image_url: `data:image/png;base64,${data}`, detail: 'high' }] }] }
    return { model, [provider === 'grok' ? 'max_completion_tokens' : 'max_tokens']: pricing.outputCap,
      reasoning_effort: 'high', messages: [{ role: 'user', content: [{ type: 'text', text: 'Read the visible page.' }, media] }] }
  }
  const endpoint = provider === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : endpoints[provider]!
  const guarded = createCleanTypographySpendingGuard(options)
  const run = async (value = body(), target = endpoint, init: RequestInit = {}): Promise<Response> =>
    await guarded(target, { method: 'POST', headers: { authorization: 'secret-test-key' }, body: JSON.stringify(value), ...init })
  const ledger = async (): Promise<CleanTypographySpendingLedger> => await Bun.file(join(root, 'ledger.json')).json() as CleanTypographySpendingLedger
  return { root, pin, calls, options, body, endpoint, guarded, run, ledger, respond: (next: typeof respond) => { respond = next } }
}

const recoveryFixture = async () => {
  const f = await fixture('gemini', 'gemini-3.5-flash-lite')
  f.respond(async () => json({ error: { code: 503, message: 'temporarily unavailable' } }, 503))
  await expect(f.run()).rejects.toThrow('did not establish complete usage')
  const original = structuredClone((await f.ledger()).receipts[0]!)
  const path = 'input/examples/document/ocr-clean-typography/reconciliations/recovery.json'
  const record: CleanTypographyManualReconciliation = {
    schemaVersion: 1, kind: 'ocr-clean-typography-manual-reconciliation',
    action: 'retain-full-reservation-and-authorize-one-recovery-invocation',
    approvalBudgetCents: 500, approvalEvidence: 'User approved up to $5',
    receiptId: original.id, caseId: original.caseId, provider: original.provider, model: original.model,
    inputSha256: original.inputSha256, httpStatus: 503, reservedCents: original.reservedCents,
    chargedCents: original.chargedCents, createdAt: new Date().toISOString(),
    reason: 'Explicitly reviewed HTTP 503 with missing usage. Preserve all potentially billed cost and allow one fresh invocation within the same approved batch.'
  }
  const authorize = async (patch: Record<string, unknown> = {}, linkPatch: Record<string, unknown> = {}): Promise<void> => {
    await mkdir(join(f.root, 'input/examples/document/ocr-clean-typography/reconciliations'), { recursive: true })
    const bytes = JSON.stringify({ ...record, ...patch }, null, 2) + '\n'
    await Bun.write(join(f.root, path), bytes)
    const ledger = await f.ledger()
    ledger.reconciliations = [{ path, sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'), ...linkPatch }]
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger, null, 2) + '\n')
  }
  const fresh = () => {
    const guarded = createCleanTypographySpendingGuard(f.options)
    return async () => await guarded(f.endpoint, { method: 'POST', body: JSON.stringify(f.body()) })
  }
  return { ...f, original, record, path, authorize, fresh }
}

describe('OCR benchmark spending admission and actual dispatch', () => {
  test('persists the reservation before dispatch, caps OpenAI output, preserves reasoning and returns intact response', async () => {
    const f = await fixture()
    f.respond(async (_input, init) => {
      const ledger = await f.ledger()
      expect(ledger.receipts[0]).toMatchObject({ status: 'reserved', reservedCents: 161.92, chargedCents: 161.92, costBasis: 'conservative-upper-bound' })
      expect(JSON.parse(init.body as string)).toMatchObject({ max_output_tokens: 16384, reasoning: { effort: 'high' },
        service_tier: 'default', prompt_cache_options: { mode: 'implicit', ttl: '30m' } })
      expect(init.redirect).toBe('error')
      return json({ ...usage('openai') as object, output: [{ text: 'Complete untouched provider body' }] })
    })
    const response = await f.run()
    expect(await response.json()).toHaveProperty('output')
    const ledger = await f.ledger()
    expect(ledger.receipts[0]).toMatchObject({ status: 'settled', inputTokens: 1000, outputTokens: 200, chargedCents: 2.25,
      costBasis: 'conservative-upper-bound' })
    expect(ledger.receipts[0]!.costNote).toContain('not actual invoice cost')
    const serialized = JSON.stringify(ledger)
    expect(serialized).not.toContain('secret-test-key')
    expect(serialized).not.toContain('Read the visible page')
    expect(serialized).not.toContain('Complete untouched provider body')
    expect(ledger.inputTokenAssumption).toContain('not a provider-enforced')
  })

  for (const [provider, model] of [
    ['anthropic', 'claude-fable-5'], ['gemini', 'gemini-4-argon'], ['gemini', 'gemini-3.8-flash'],
    ['grok', 'grok-4.7'], ['deepinfra', 'Qwen/Qwen3.8-27B'], ['mistral', 'mistral-ocr-4-1']
  ] as const) test(`dispatches accepted native image and output controls for ${provider}/${model}`, async () => {
    const f = await fixture(provider, model)
    await f.run()
    expect(f.calls).toHaveLength(1)
    const sent = JSON.parse(f.calls[0]!.init.body as string) as Record<string, unknown>
    const original = f.body()
    expect(sent).toEqual(original)
    expect((await f.ledger()).receipts[0]!.status).toBe('settled')
  })

  test('charges xAI visible plus separate reasoning once', async () => {
    const f = await fixture('grok', 'grok-4.7')
    f.respond(async () => json({ usage: { prompt_tokens: 32, completion_tokens: 9, completion_tokens_details: { reasoning_tokens: 94 }, total_tokens: 135 } }))
    await f.run()
    expect((await f.ledger()).receipts[0]).toMatchObject({ inputTokens: 32, outputTokens: 103, chargedCents: 0.0682 })
  })
  test('charges Gemini candidates plus thoughts once', async () => {
    const f = await fixture('gemini', 'gemini-4-argon')
    await f.run()
    expect((await f.ledger()).receipts[0]).toMatchObject({ inputTokens: 1000, outputTokens: 300, chargedCents: 1 })
  })
  test('does not add DeepInfra reasoning to already inclusive completion usage', async () => {
    const f = await fixture('deepinfra', 'google/gemma-4-31B-it')
    await f.run()
    expect((await f.ledger()).receipts[0]).toMatchObject({ outputTokens: 200, chargedCents: 0.028 })
  })
  test('dispatches default, accepted billing/cache override, and reset while preserving native reasoning and output controls', async () => {
    const f = await fixture('openai', 'gpt-6-luna')
    await f.run()
    await f.run({ ...f.body(), max_output_tokens: 16384, service_tier: 'default', prompt_cache_options: { mode: 'explicit', ttl: '30m' } })
    await f.run()
    const dispatched = f.calls.map(call => JSON.parse(call.init.body as string))
    expect(dispatched.map(body => body.max_output_tokens)).toEqual([16384, 16384, 16384])
    expect(dispatched.map(body => body.service_tier)).toEqual(['default', 'default', 'default'])
    expect(dispatched.map(body => body.prompt_cache_options)).toEqual([
      { mode: 'implicit', ttl: '30m' }, { mode: 'explicit', ttl: '30m' }, { mode: 'implicit', ttl: '30m' }
    ])
    expect(dispatched.every(body => body.reasoning.effort === 'high')).toBe(true)
  })

  test('dispatches explicit 30m breakpoints and values complete ordinary/read/write usage without double counting output reasoning', async () => {
    const f = await fixture()
    const body: Record<string, unknown> = { ...f.body(), prompt_cache_options: { mode: 'explicit' } }
    const content = (body['input'] as Array<{ content: Array<Record<string, unknown>> }>)[0]!.content
    content[0]!['prompt_cache_breakpoint'] = { mode: 'explicit', ttl: '30m' }
    f.respond(async () => json({ service_tier: 'default', usage: {
      input_tokens: 12000, output_tokens: 200, output_tokens_details: { reasoning_tokens: 150 },
      input_tokens_details: { cached_tokens: 4000, cache_write_tokens: 7000,
        cache_write_tokens_details: { ttl_30m_tokens: 7000, ttl_12h_tokens: 0 } }
    } }))
    await f.run(body)
    expect(f.calls).toHaveLength(1)
    const sent = JSON.parse(f.calls[0]!.init.body as string)
    expect(sent.prompt_cache_options).toEqual({ mode: 'explicit', ttl: '30m' })
    expect(sent.input[0].content[0].prompt_cache_breakpoint).toEqual({ mode: 'explicit', ttl: '30m' })
    // $10/M ordinary input, $1/M reads, $12.50/M writes, $50/M inclusive output.
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'settled', inputTokens: 12000, outputTokens: 200,
      chargedCents: 11.15, costBasis: 'provider-usage-at-reviewed-rates' })
  })

  test('uses GPT-6.1 Sol five-percent cache reads with forced default 30m writes', async () => {
    const f = await fixture('openai', 'gpt-6.1-sol')
    f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200,
      input_tokens_details: { cached_tokens: 400, cache_write_tokens: 500 } } }))
    await f.run({ ...f.body(), prompt_cache_options: { ttl: '30m' } })
    expect(JSON.parse(f.calls[0]!.init.body as string).prompt_cache_options).toEqual({ mode: 'implicit', ttl: '30m' })
    expect((await f.ledger()).receipts[0]).toMatchObject({ chargedCents: 0.349, costBasis: 'provider-usage-at-reviewed-rates' })
  })
  test('values incomplete cache components conservatively instead of assuming zero cache writes', async () => {
    const f = await fixture()
    f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200,
      input_tokens_details: { cached_tokens: 400 } } }))
    await f.run()
    expect((await f.ledger()).receipts[0]).toMatchObject({ chargedCents: 2.25, costBasis: 'conservative-upper-bound' })
    expect((await f.ledger()).receipts[0]!.costNote).toContain('all OpenAI input valued at the 1.25x')
  })
})

describe('OCR benchmark spending rejection before dispatch', () => {
  for (const target of ['https://attacker.example/v1/responses', 'https://api.openai.com/v1/audio/speech', 'https://api.openai.com/v1/responses?extra=1', 'http://api.openai.com/v1/responses']) test(`blocks unauthorized endpoint ${target}`, async () => {
    const f = await fixture()
    await expect(f.run(f.body(), target)).rejects.toThrow('unapproved provider host')
    expect(f.calls).toHaveLength(0)
  })
  test('requires persisted approval and never infers approval from environment/options', async () => {
    const f = await fixture()
    for (const approval of [{}, { status: 'pending', budgetCents: 500 }, { status: 'approved', budgetCents: 501, evidence: 'User approved up to $5' }]) {
      await Bun.write(join(f.root, 'plan.json'), JSON.stringify({ approval }))
      await expect(f.run()).rejects.toThrow('explicit user approval')
    }
    expect(f.calls).toHaveLength(0)
  })
  for (const override of [
    { model: 'other-model' }, { max_output_tokens: 999999 }, { tools: [] }, { service_tier: 'priority' }, { stream: true }, { n: 2 }
  ]) test(`rejects unapproved request override ${JSON.stringify(override)}`, async () => {
    const f = await fixture()
    await expect(f.run({ ...f.body(), ...override })).rejects.toThrow('OCR spending guard')
    expect(f.calls).toHaveLength(0)
  })
  for (const tier of ['fast', 'priority', 'ultrafast', 'auto', 'flex', null]) test(`rejects nonstandard OpenAI service tier ${String(tier)} before actual fetch`, async () => {
    const f = await fixture()
    await expect(f.run({ ...f.body(), service_tier: tier })).rejects.toThrow('only the OpenAI default service tier')
    expect(f.calls).toHaveLength(0)
    expect(await Bun.file(join(f.root, 'ledger.json')).exists()).toBe(false)
  })
  for (const override of [
    { prompt_cache_options: { ttl: '12h' } }, { prompt_cache_options: { ttl: '24h' } },
    { prompt_cache_options: { mode: 'disabled' } }, { prompt_cache_options: { prewarm: true } },
    { prompt_cache_options: { mode: 'implicit', ttl: '30m', unreviewed: true } },
    { prompt_cache_options: null }, { prompt_cache_retention: '24h' }, { prompt_cache_key: 'unreviewed-accounting-key' }
  ]) test(`rejects longer retention or unreviewed cache options before fetch ${JSON.stringify(override)}`, async () => {
    const f = await fixture()
    await expect(f.run({ ...f.body(), ...override })).rejects.toThrow('OCR spending guard')
    expect(f.calls).toHaveLength(0)
  })
  test('rejects a nested explicit breakpoint that overrides the admitted cache retention', async () => {
    const f = await fixture()
    const body = f.body()
    ;(body['input'] as Array<{ content: Array<Record<string, unknown>> }>)[0]!.content[0]!['prompt_cache_breakpoint'] = { mode: 'explicit', ttl: '12h' }
    await expect(f.run(body)).rejects.toThrow('explicit 30m cache breakpoints')
    expect(f.calls).toHaveLength(0)
  })
  test('rejects unknown case/model, upward budget changes and nonrelative ledger paths', async () => {
    const f = await fixture()
    for (const override of [{ caseId: 'unknown' }, { model: 'unknown' }, { budgetCents: 501 }, { ledgerPath: '../escape.json' }, { ledgerPath: '/tmp/escape.json' }]) {
      expect(() => createCleanTypographySpendingGuard({ ...f.options, ...override })).toThrow('OCR spending guard')
    }
    expect(f.calls).toHaveLength(0)
  })
  test('rejects changed input, duplicate images, remote images and oversized request text before fetch', async () => {
    const f = await fixture()
    const body = f.body()
    const contents = (body['input'] as Array<{ content: unknown[] }>)[0]!.content
    const image = contents[1] as { image_url: string }
    const mutated = structuredClone(body)
    ;((mutated['input'] as Array<{ content: Array<{ image_url?: string }> }>)[0]!.content[1]!).image_url = 'data:image/png;base64,YWJj'
    const duplicate = structuredClone(body)
    ;(duplicate['input'] as Array<{ content: unknown[] }>)[0]!.content.push(image)
    const remote = structuredClone(body)
    ;((remote['input'] as Array<{ content: Array<{ image_url?: string }> }>)[0]!.content[1]!).image_url = 'https://example.com/not-authorized.png'
    for (const value of [mutated, duplicate, remote, { ...body, extra: 'x'.repeat(9000) }]) await expect(f.run(value)).rejects.toThrow('OCR spending guard')
    expect(f.calls).toHaveLength(0)
  })
  test('rejects changed native output caps before fetch', async () => {
    const f = await fixture('anthropic', 'claude-fable-5')
    await expect(f.run({ ...f.body(), max_tokens: 128000 })).rejects.toThrow('native output cap')
    expect(f.calls).toHaveLength(0)
  })
})

describe('OCR benchmark cumulative spending, retries and ambiguity', () => {
  test('uses one cumulative ledger and refuses a request that cannot be fully reserved', async () => {
    const f = await fixture('mistral', 'mistral-ocr-4-1', 1)
    await f.run(); await f.run()
    await expect(f.run()).rejects.toThrow('remaining cumulative approval')
    expect(f.calls).toHaveLength(2)
    expect((await f.ledger()).receipts.reduce((sum, entry) => sum + entry.chargedCents, 0)).toBe(0.8)
  })
  test('reserves and accounts for every admitted schema retry and stops beyond three', async () => {
    const f = await fixture('anthropic', 'claude-fable-5')
    for (let attempt = 0; attempt < 3; attempt++) await f.run({ ...f.body(), repair_prompt: `attempt ${attempt}` })
    await expect(f.run()).rejects.toThrow('maximum request attempts')
    const ledger = await f.ledger()
    expect(ledger.receipts).toHaveLength(3)
    expect(ledger.receipts.every(entry => entry.status === 'settled')).toBe(true)
    expect(ledger.receipts.reduce((sum, entry) => sum + entry.chargedCents, 0)).toBe(6)
  })
  test('releases an explicit rejected admission and admits a subsequent retry', async () => {
    const f = await fixture('anthropic', 'claude-fable-5')
    f.respond(async () => json({ error: { type: 'rate_limit_error' } }, 429))
    expect((await f.run()).status).toBe(429)
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'rejected', chargedCents: 0 })
    f.respond(async () => json(usage('anthropic')))
    await f.run()
    expect((await f.ledger()).receipts[1]!.status).toBe('settled')
  })
  test('holds an apparent rejection when the response includes inference usage', async () => {
    const f = await fixture()
    f.respond(async () => json(usage('openai'), 400))
    await expect(f.run()).rejects.toThrow('included inference usage')
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'ambiguous', chargedCents: 161.92 })
    await expect(f.run()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })
  test('retains full reservation after transport ambiguity and prevents every further request', async () => {
    const f = await fixture('anthropic', 'claude-fable-5')
    f.respond(async () => { throw new DOMException('request timed out', 'TimeoutError') })
    await expect(f.run()).rejects.toThrow('timed out')
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'ambiguous', chargedCents: 384, reservedCents: 384 })
    await expect(f.run()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })
  for (const [index, response] of [json({ text: 'Missing usage' }), new Response('invalid JSON'), json({ error: 'provider failure' }, 500)].entries()) test(`holds unknown/missing usage and ambiguous HTTP response ${index}`, async () => {
    const f = await fixture()
    f.respond(async () => response)
    await expect(f.run()).rejects.toThrow('OCR spending guard')
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'ambiguous', chargedCents: 161.92 })
    await expect(f.run()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })
  test('retains the full reservation and freezes dispatch on an input allowance breach', async () => {
    const f = await fixture()
    f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 64001, output_tokens: 1 } }))
    await expect(f.run()).rejects.toThrow('exceeded the reserved allowance')
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'breach', chargedCents: 161.92, inputTokens: 64001 })
    await expect(f.run()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })
  test('records the conservative over-reservation usage valuation and freezes after an output allowance breach', async () => {
    const f = await fixture()
    f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 64000, output_tokens: 20000 } }))
    await expect(f.run()).rejects.toThrow('exceeded the reserved allowance')
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'breach', chargedCents: 180, outputTokens: 20000 })
  })
  for (const tier of ['priority', 'fast', 'ultrafast', 'auto', undefined]) test(`holds the complete reservation for unconfirmed returned OpenAI tier ${String(tier)}`, async () => {
    const f = await fixture()
    f.respond(async () => json({ ...usage('openai') as object, service_tier: tier }))
    await expect(f.run()).rejects.toThrow('did not confirm the Standard default service tier')
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'ambiguous', chargedCents: 161.92, reservedCents: 161.92 })
    await expect(f.run()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })
  for (const details of [
    { cached_tokens: 700, cache_write_tokens: 400 },
    { cached_tokens: -1, cache_write_tokens: 0 },
    { cached_tokens: 1001 },
    { cached_tokens: 0, cache_write_tokens: 500, cache_write_tokens_details: { ttl_30m_tokens: 400, ttl_12h_tokens: 0 } },
    { cached_tokens: 0, cache_write_tokens: 500, cache_write_tokens_details: { ttl_30m_tokens: 0, ttl_12h_tokens: 500 } }
  ]) test(`retains the reservation on invalid or unapproved returned cache usage ${JSON.stringify(details)}`, async () => {
    const f = await fixture()
    f.respond(async () => json({ service_tier: 'default', usage: { input_tokens: 1000, output_tokens: 200, input_tokens_details: details } }))
    await expect(f.run()).rejects.toThrow('did not establish complete usage')
    expect((await f.ledger()).receipts[0]).toMatchObject({ status: 'ambiguous', chargedCents: 161.92 })
    await expect(f.run()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })
  test('keeps the existing ledger schema and all 105 prior rejected receipts while admitting a new attempt', async () => {
    const f = await fixture()
    f.respond(async () => json({ error: 'Invalid API key' }, 401))
    await f.run()
    const ledger = await f.ledger()
    const { costBasis: _basis, costNote: _note, ...legacy } = ledger.receipts[0]!
    const targets = Object.keys(CLEAN_TYPOGRAPHY_SPENDING_RATES)
    ledger.receipts = Array.from({ length: 105 }, (_, index) => {
      const target = targets[index % 21]!, separator = target.indexOf('/')
      return { ...legacy, id: `${legacy.id}-${index}`, caseId: CLEAN_TYPOGRAPHY_SOURCE_PINS[Math.floor(index / 21)]!.id,
        provider: target.slice(0, separator), model: target.slice(separator + 1) }
    })
    const preserved = JSON.stringify(ledger.receipts)
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger))
    f.respond(async () => json(usage('openai')))
    await f.run()
    const updated = await f.ledger()
    expect(updated.schemaVersion).toBe(1)
    expect(updated.receipts).toHaveLength(106)
    expect(JSON.stringify(updated.receipts.slice(0, 105))).toBe(preserved)
    expect(updated.receipts[105]).toMatchObject({ status: 'settled', chargedCents: 2.25, costBasis: 'conservative-upper-bound' })
  })
  test('blocks paid redispatch in a fresh invocation when a slot already has admitted evidence', async () => {
    const f = await fixture()
    await f.run()
    const second = createCleanTypographySpendingGuard(f.options)
    await expect(second(f.endpoint, { method: 'POST', body: JSON.stringify(f.body()) })).rejects.toThrow('already has admitted evidence')
    expect(f.calls).toHaveLength(1)
  })
  test('blocks concurrent dispatch while a durable reservation is outstanding', async () => {
    const f = await fixture()
    let release: (() => void) | undefined
    const pending = new Promise<void>(resolve => { release = resolve })
    let entered: (() => void) | undefined
    const called = new Promise<void>(resolve => { entered = resolve })
    f.respond(async () => { entered!(); await pending; return json(usage('openai')) })
    const first = f.run()
    await called
    await expect(f.run()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
    release!()
    await first
    expect((await f.ledger()).receipts[0]!.status).toBe('settled')
  })
  test('fails closed on a stale write lock or corrupted ledger', async () => {
    const f = await fixture()
    await Bun.write(join(f.root, 'ledger.json.lock'), '')
    await expect(f.run()).rejects.toThrow('ledger locked')
    await rm(join(f.root, 'ledger.json.lock'))
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify({ schemaVersion: 1, budgetCents: 0, receipts: [] }))
    await expect(f.run()).rejects.toThrow('invalid or changed cumulative ledger')
    expect(f.calls).toHaveLength(0)
  })
})

describe('explicit HTTP 503 recovery with the full original reservation retained', () => {
  test('authorizes one fresh invocation and up to three native responses without changing the original receipt', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    await expect(f.run()).rejects.toThrow('recovery invocation')
    expect(f.calls).toHaveLength(1)
    f.respond(async () => {
      const ledger = await f.ledger()
      expect(ledger.receipts[0]).toEqual(f.original)
      expect(ledger.receipts.at(-1)).toMatchObject({ status: 'reserved', recoveryOfReceiptId: f.original.id, reservedCents: 3.968 })
      expect(ledger.receipts.reduce((sum, row) => sum + row.chargedCents, 0)).toBeGreaterThanOrEqual(7.936)
      return json(usage('gemini'))
    })
    const retry = f.fresh()
    for (let response = 0; response < 3; response++) await retry()
    await expect(retry()).rejects.toThrow('maximum request attempts')
    const ledger = await f.ledger()
    expect(ledger.receipts[0]).toEqual(f.original)
    expect(ledger.receipts[0]).toMatchObject({ status: 'ambiguous', httpStatus: 503, chargedCents: 3.968 })
    expect(new Set(ledger.receipts.slice(1).map(row => row.invocationId)).size).toBe(1)
    expect(ledger.receipts.slice(1).every(row => row.recoveryOfReceiptId === f.original.id)).toBe(true)
    expect(ledger.receipts.reduce((sum, row) => sum + row.chargedCents, 0)).toBeCloseTo(4.283, 8)
    await expect(f.fresh()()).rejects.toThrow('automatic redispatch is blocked')
    expect(f.calls).toHaveLength(4)
  })

  test('allows other untried slots while the explicitly reconciled 503 reservation remains held', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    const other = await fixture('mistral', 'mistral-ocr-4-1')
    f.respond(async () => json(usage('mistral')))
    const guarded = createCleanTypographySpendingGuard({ ...f.options, provider: 'mistral', model: 'mistral-ocr-4-1' })
    await guarded(other.endpoint, { method: 'POST', body: JSON.stringify(other.body()) })
    const ledger = await f.ledger()
    expect(ledger.receipts[0]).toEqual(f.original)
    expect(ledger.receipts[1]).toMatchObject({ status: 'settled', chargedCents: 0.4 })
    expect(ledger.receipts[1]!.recoveryOfReceiptId).toBeUndefined()
    expect(ledger.receipts.reduce((sum, row) => sum + row.chargedCents, 0)).toBe(4.368)
  })

  test('keeps automatic ambiguity recovery blocked when no explicit overlay exists', async () => {
    const f = await recoveryFixture()
    await expect(f.fresh()()).rejects.toThrow('requires reconciliation')
    expect((await f.ledger()).receipts).toEqual([f.original])
    expect(f.calls).toHaveLength(1)
  })

  for (const patch of [
    { approvalBudgetCents: 501 }, { approvalEvidence: 'generic permission' }, { action: 'release-reservation' },
    { receiptId: 'different-receipt' }, { reservedCents: 0 }, { chargedCents: 0 }, { httpStatus: 500 },
    { caseId: 'clean-typography-suitcase' }, { provider: 'openai' }, { model: 'gemini-3.8-flash' },
    { inputSha256: '0'.repeat(64) }, { reason: '' }, { createdAt: 'invalid timestamp' }, { createdAt: '2000-01-01T00:00:00.000Z' }
  ]) test(`rejects a modified manual record before dispatch ${JSON.stringify(patch)}`, async () => {
    const f = await recoveryFixture()
    await f.authorize(patch)
    await expect(f.fresh()()).rejects.toThrow('manual reconciliation')
    expect(f.calls).toHaveLength(1)
    expect((await f.ledger()).receipts[0]).toEqual(f.original)
  })

  test('rejects a changed record checksum or changed record bytes before dispatch', async () => {
    const f = await recoveryFixture()
    await f.authorize({}, { sha256: '0'.repeat(64) })
    await expect(f.fresh()()).rejects.toThrow('checksum changed')
    await f.authorize()
    await Bun.write(join(f.root, f.path), JSON.stringify({ ...f.record, reason: 'Changed after pinning' }))
    await expect(f.fresh()()).rejects.toThrow('checksum changed')
    expect(f.calls).toHaveLength(1)
  })

  for (const path of ['../recovery.json', '/tmp/recovery.json', 'docs/reports/recovery.json', 'input/examples/document/ocr-clean-typography/reconciliations/../recovery.json']) test(`rejects a nonprivate or escaping record path ${path}`, async () => {
    const f = await recoveryFixture()
    await f.authorize({}, { path })
    await expect(f.fresh()()).rejects.toThrow('unique private project-relative path')
    expect(f.calls).toHaveLength(1)
  })

  test('does not authorize a settled receipt or change a retained ambiguous amount', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    let ledger = await f.ledger()
    ledger.receipts[0]!.status = 'settled'
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger))
    await expect(f.fresh()()).rejects.toThrow('differs from the retained HTTP 503 receipt')
    ledger = await f.ledger()
    ledger.receipts[0] = { ...f.original, reservedCents: 0.001, chargedCents: 0.001 }
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger))
    await expect(f.fresh()()).rejects.toThrow('differs from the retained HTTP 503 receipt')
    expect(f.calls).toHaveLength(1)
  })

  test('a rejected recovery request still consumes the one new invocation authorization', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    f.respond(async () => json({ error: { message: 'quota limit' } }, 429))
    const retry = f.fresh()
    expect((await retry()).status).toBe(429)
    await expect(f.fresh()()).rejects.toThrow('consumed its recovery invocation')
    expect((await retry()).status).toBe(429)
    expect((await f.ledger()).receipts[0]).toEqual(f.original)
    expect(f.calls).toHaveLength(3)
  })

  test('a second ambiguous recovery response blocks every further request until separately reconciled', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    const retry = f.fresh()
    await expect(retry()).rejects.toThrow('did not establish complete usage')
    await expect(retry()).rejects.toThrow('requires reconciliation')
    await expect(f.fresh()()).rejects.toThrow('requires reconciliation')
    const other = await fixture('mistral', 'mistral-ocr-4-1')
    const guarded = createCleanTypographySpendingGuard({ ...f.options, provider: 'mistral', model: 'mistral-ocr-4-1' })
    await expect(guarded(other.endpoint, { method: 'POST', body: JSON.stringify(other.body()) })).rejects.toThrow('requires reconciliation')
    const ledger = await f.ledger()
    expect(ledger.receipts[0]).toEqual(f.original)
    expect(ledger.receipts[1]).toMatchObject({ status: 'ambiguous', chargedCents: 3.968, recoveryOfReceiptId: f.original.id })
    expect(ledger.receipts.reduce((sum, row) => sum + row.chargedCents, 0)).toBe(7.936)
    expect(f.calls).toHaveLength(2)
  })

  test('the held original cost participates in the cumulative budget before a recovery request', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    const ledger = await f.ledger()
    ledger.receipts.push({ ...f.original, id: 'prior-paid-slot', invocationId: 'different-prior-invocation',
      caseId: 'clean-typography-suitcase', status: 'settled', httpStatus: 200, reservedCents: 495, chargedCents: 495 })
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger))
    f.respond(async () => json(usage('gemini')))
    await expect(f.fresh()()).rejects.toThrow('remaining cumulative approval')
    expect(f.calls).toHaveLength(1)
    expect((await f.ledger()).receipts[0]).toEqual(f.original)
  })

  test('an unrelated allowance breach remains blocked even when the 503 is explicitly reconciled', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    const ledger = await f.ledger()
    ledger.receipts.push({ ...f.original, id: 'unrelated-allowance-breach', invocationId: 'different-prior-invocation',
      caseId: 'clean-typography-suitcase', status: 'breach', httpStatus: 200, reservedCents: 1, chargedCents: 1 })
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger))
    await expect(f.fresh()()).rejects.toThrow('requires reconciliation')
    expect(f.calls).toHaveLength(1)
  })

  test('rejects duplicate manual overlays rather than granting another invocation', async () => {
    const f = await recoveryFixture()
    await f.authorize()
    const ledger = await f.ledger()
    ledger.reconciliations!.push({ ...ledger.reconciliations![0]! })
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger))
    await expect(f.fresh()()).rejects.toThrow('unique private project-relative path')
    expect(f.calls).toHaveLength(1)
  })

  test('preserves all 105 legacy rejected receipts and the original 503 object during manual recovery', async () => {
    const f = await recoveryFixture()
    const ledger = await f.ledger()
    const targets = Object.keys(CLEAN_TYPOGRAPHY_SPENDING_RATES)
    const rejected = Array.from({ length: 105 }, (_, index) => {
      const target = targets[index % 21]!, separator = target.indexOf('/')
      return { ...f.original, id: `legacy-rejected-${index}`, invocationId: `legacy-invocation-${index}`,
        caseId: CLEAN_TYPOGRAPHY_SOURCE_PINS[Math.floor(index / 21)]!.id, provider: target.slice(0, separator),
        model: target.slice(separator + 1), status: 'rejected' as const, httpStatus: 401, chargedCents: 0 }
    })
    ledger.receipts = [...rejected, f.original]
    const originalBytes = JSON.stringify(ledger.receipts)
    await Bun.write(join(f.root, 'ledger.json'), JSON.stringify(ledger))
    await f.authorize()
    f.respond(async () => json(usage('gemini')))
    await f.fresh()()
    const updated = await f.ledger()
    expect(updated.receipts).toHaveLength(107)
    expect(JSON.stringify(updated.receipts.slice(0, 106))).toBe(originalBytes)
    expect(updated.receipts[106]).toMatchObject({ status: 'settled', recoveryOfReceiptId: f.original.id, chargedCents: 0.105 })
  })
})
