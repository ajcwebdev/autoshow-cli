import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildWriteBenchmarkPlan, executeWriteBenchmark, finalizeWriteBenchmarkCase, installWriteBenchmarkFetchGuard, prepareWriteBenchmarkCase, runWriteBenchmarkSlot, verifyWriteBenchmarkCache, WRITE_BENCHMARK_CASES, WRITE_BENCHMARK_PLAN } from '~/tools/write-benchmark'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import type { WriteBenchmarkCase, WriteBenchmarkPlan } from '~/tools/write-benchmark'
import type { LLMTarget, Step3Metadata } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { ValidationError } from '~/utils/error-handler'

const temporary: string[] = []
const originalFetch = globalThis.fetch
afterEach(async () => {
  globalThis.fetch = originalFetch
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})
const metadata: Step3Metadata = {
  llmService: 'openai', llmModel: 'gpt-6.1-sol', processingTime: 125, inputTokenCount: 100, outputTokenCount: 20,
  tokenCountSource: 'provider_usage', providerUsage: { inputTokenCount: 100, outputTokenCount: 20 },
  rawProviderUsage: { input_tokens: 100, output_tokens: 20 }, outputFileName: '', outputFormat: 'json', structuredMode: 'native', structuredPresetNames: []
}
const setup = async (): Promise<{ plan: WriteBenchmarkPlan; entry: WriteBenchmarkCase; prepared: Awaited<ReturnType<typeof prepareWriteBenchmarkCase>> }> => {
  const runDir = await mkdtemp(join(tmpdir(), 'autoshow-write-benchmark-'))
  temporary.push(runDir)
  const prepared = await prepareWriteBenchmarkCase(WRITE_BENCHMARK_CASES[0])
  const entry: WriteBenchmarkCase = { ...WRITE_BENCHMARK_CASES[0], runDir, estimatedCostCents: 1, sourceSha256: sha256Bytes(prepared.source), promptSha256: sha256Bytes(prepared.prompt), schemaSha256: sha256Bytes(JSON.stringify(prepared.schema.jsonSchema)) }
  const plan = { fingerprint: 'fixed-test-plan' } as WriteBenchmarkPlan
  return { plan, entry, prepared }
}

describe('write benchmark dispatch and evidence', () => {
  test('price-only plan binds five inputs and 12 active model routes without reusing historical approval or network dispatch', async () => {
    globalThis.fetch = Object.assign(async () => { throw new Error('Price must not call a provider') }, { preconnect: originalFetch.preconnect }) as typeof fetch
    const plan = await buildWriteBenchmarkPlan()
    expect(plan.cases.map(entry => entry.prompt)).toEqual(['shortSummary', 'longSummary', 'mediumChapters', 'blog', 'rapSongChapter'])
    expect(plan.providers).toHaveLength(12)
    expect(plan.providers.length * plan.cases.length).toBe(60)
    // Original fixed corpus/prompt estimates: 20,458 input and 6,200 output tokens per route.
    // Added Standard input/output cents per million: Astra 1000/5000,
    // Terra 100/500, Fable 5.2 800/4000, Carbon 400/2000 (post-introductory).
    // All inputs are below Astra/Terra's 272,000-token pricing threshold.
    const addedCostCents = (20_458 * (1000 + 100 + 800 + 400) + 6200 * (5000 + 500 + 4000 + 2000)) / 1_000_000
    // The revised rap instruction grows from 11,448 to 12,762 trimmed characters:
    // ceil(chars / 4) adds 329 input tokens. Flash retains its 0.8395 estimator
    // multiplier; the other eleven routes use 1. Output estimates stay unchanged.
    const promptRevisionCostCents = 329 * (1000 + 200 + 100 + 10 + 400 + 400 + 150 * 0.8395 + 400 + 200 + 10 + 800 + 200) / 1_000_000
    expect(plan.baseEstimatedCostCents).toBeCloseTo(77.07020865 + addedCostCents + promptRevisionCostCents, 6)
    expect(plan.approval).toBeNull()
    expect(plan.providers.map(provider => `${provider.provider}/${provider.model}`)).toEqual([
      'gemini/gemini-4-argon', 'gemini/gemini-4-carbon', 'gemini/gemini-3.8-flash',
      'anthropic/claude-opus-5-5', 'anthropic/claude-sonnet-5-5', 'anthropic/claude-haiku-5-5', 'anthropic/claude-fable-5-2',
      'openai/gpt-6-astra', 'openai/gpt-6.1-sol', 'openai/gpt-6.1-terra', 'openai/gpt-6-luna',
      'grok/grok-4.7'
    ])
    expect(plan.cases.every(entry => /^[a-f0-9]{64}$/.test(entry.promptSha256))).toBe(true)
    expect(JSON.stringify(plan)).not.toContain(process.cwd())
  })

  test('current inventory requires its own approval, and the purchased historical plan remains read-only cache verifiable', async () => {
    globalThis.fetch = Object.assign(async () => { throw new Error('Cache verification must not call a provider') }, { preconnect: originalFetch.preconnect }) as typeof fetch
    await expect(executeWriteBenchmark(await buildWriteBenchmarkPlan())).rejects.toThrow('requires its own explicit cost-specific approval')
    const historicalBytes = await Bun.file(WRITE_BENCHMARK_PLAN).text()
    const historical = JSON.parse(historicalBytes) as WriteBenchmarkPlan
    expect(historical.providers).toHaveLength(8)
    expect(historical.approval).toBeNull()
    const receipts = await verifyWriteBenchmarkCache(historical)
    expect(receipts).toHaveLength(40)
    expect(receipts.filter(receipt => receipt.model === 'grok-4.7')).toHaveLength(5)
    expect(await Bun.file(WRITE_BENCHMARK_PLAN).text()).toBe(historicalBytes)
    await expect(executeWriteBenchmark(historical)).rejects.toThrow('models, prices or plan contents changed')
  })

  test('a missing retired-model receipt rejects before an attempt is saved or its adapter dispatches', async () => {
    const { plan, entry, prepared } = await setup()
    let calls = 0
    const target: LLMTarget = { service: 'grok', label: 'Grok', model: 'grok-4.5', run: async () => { calls++; return { result: '{}', metadata } } }
    await expect(runWriteBenchmarkSlot(plan, entry, prepared, target)).rejects.toThrow('Retired or unsupported benchmark model')
    expect(await Bun.file(join(entry.runDir, 'slot-grok-grok-4.5.json')).exists()).toBe(false)
    expect(calls).toBe(0)
  })

  test('historical cache uses pinned snapshots and validates schema, receipt identity and artifacts without live input', async () => {
    const { entry: initialEntry, prepared: currentPrepared } = await setup()
    const prepared = { ...currentPrepared, prompt: 'An earlier retained instruction that differs from the current preset.' }
    const entry = { ...initialEntry, input: join(initialEntry.runDir, 'absent-original-input.txt'), promptSha256: sha256Bytes(prepared.prompt) }
    const full = await buildWriteBenchmarkPlan()
    const { fingerprint: _, ...content } = { ...full, cases: [entry], providers: full.providers.filter(provider => provider.provider === 'openai' && provider.model === 'gpt-6.1-sol') }
    const plan = { ...content, fingerprint: sha256Bytes(JSON.stringify(content)) }
    let calls = 0
    const target: LLMTarget = { service: 'openai', model: 'gpt-6.1-sol', label: 'OpenAI', run: async () => {
      calls++
      return { result: JSON.stringify({ episodeDescription: 'A retained synthetic result.' }), metadata }
    } }
    const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    await Bun.write(join(entry.runDir, 'source.txt'), prepared.source)
    await Bun.write(join(entry.runDir, 'prompt.md'), prepared.prompt)
    expect(await Bun.file(entry.input).exists()).toBe(false)
    expect(await verifyWriteBenchmarkCache(plan)).toEqual([slot])
    expect(calls).toBe(1)

    for (const [name, bytes] of [['source.txt', prepared.source], ['prompt.md', prepared.prompt]]) {
      await Bun.write(join(entry.runDir, name!), 'changed snapshot')
      await expect(verifyWriteBenchmarkCache(plan)).rejects.toThrow('Cached benchmark snapshot missing or changed')
      await Bun.write(join(entry.runDir, name!), bytes!)
    }
    const schemaContent = { ...content, cases: [{ ...entry, schemaSha256: '0'.repeat(64) }] }
    await expect(verifyWriteBenchmarkCache({ ...schemaContent, fingerprint: sha256Bytes(JSON.stringify(schemaContent)) })).rejects.toThrow('Cached benchmark schema changed')
    const slotPath = join(entry.runDir, 'slot-openai-gpt-6.1-sol.json')
    await Bun.write(slotPath, JSON.stringify({ ...slot, caseId: 'wrong-case' }))
    await expect(verifyWriteBenchmarkCache(plan)).rejects.toThrow('Cached slot identity changed')
    await Bun.write(slotPath, JSON.stringify(slot))
    await Bun.write(join(entry.runDir, 'text-openai-gpt-6.1-sol.json'), '{}')
    await expect(verifyWriteBenchmarkCache(plan)).rejects.toThrow('Cached artifact missing or changed')
    expect(calls).toBe(1)
  })

  test('saved plan mutations with stale fingerprints are rejected before dispatch', async () => {
    const plan = await buildWriteBenchmarkPlan()
    const changedProviders = structuredClone(plan)
    changedProviders.providers.pop()
    const changedCases = structuredClone(plan)
    changedCases.cases.pop()
    const changedDirectory = structuredClone(plan)
    changedDirectory.cases[0]!.runDir += '-changed'
    globalThis.fetch = Object.assign(async () => { throw new Error('Mutated plan must not call a provider') }, { preconnect: originalFetch.preconnect }) as typeof fetch
    for (const changed of [changedProviders, changedCases, changedDirectory]) {
      expect(changed.fingerprint).toBe(plan.fingerprint)
      await expect(executeWriteBenchmark(changed)).rejects.toThrow('plan contents changed')
    }
  })

  test('transport and schema success preserve raw usage, render output and replay without purchase', async () => {
    const { plan, entry, prepared } = await setup()
    let calls = 0
    const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async (_prompt, _model, controls) => {
      calls++
      expect(controls?.strategy).toBe('native')
      expect(controls?.strict).toBe(true)
      expect(controls?.schema).toEqual(prepared.schema.jsonSchema)
      return { result: JSON.stringify({ episodeDescription: 'A focused discussion of practical software tools.' }), metadata }
    } }
    const first = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    expect(first.status).toBe('completed')
    expect(first.metadata?.rawProviderUsage).toEqual(metadata.rawProviderUsage)
    expect(await Bun.file(join(entry.runDir, 'text-openai-gpt-6.1-sol.md')).text()).toContain('practical software tools')
    expect((await runWriteBenchmarkSlot(plan, entry, prepared, target)).status).toBe('completed')
    expect(calls).toBe(1)
    await Bun.write(join(entry.runDir, 'text-openai-gpt-6.1-sol.json'), '{}')
    await expect(runWriteBenchmarkSlot(plan, entry, prepared, target)).rejects.toThrow('artifact missing or changed')
    expect(calls).toBe(1)
  })

  test('transport success with invalid JSON remains validation-failed and is never repurchased', async () => {
    const { plan, entry, prepared } = await setup()
    let calls = 0
    const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => { calls++; return { result: 'broken {', metadata } } }
    const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    expect(slot.status).toBe('validation-failed')
    expect(slot.metadata?.validationFailed).toBe(true)
    const artifact = await Bun.file(join(entry.runDir, 'text-openai-gpt-6.1-sol.json')).json()
    expect(artifact._raw).toBe('broken {')
    expect(artifact._validationError).toContain('valid JSON')
    await runWriteBenchmarkSlot(plan, entry, prepared, target)
    expect(calls).toBe(1)
  })

  test('local artifact failure after a response preserves measured billing and failed provider status', async () => {
    const { entry, prepared } = await setup()
    const full = await buildWriteBenchmarkPlan()
    const plan = { ...full, providers: full.providers.filter(provider => provider.provider === 'openai' && provider.model === 'gpt-6.1-sol') }
    await mkdir(join(entry.runDir, 'raw-response-openai-gpt-6.1-sol-attempt-1.json'))
    let calls = 0
    const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => { calls++; return { result: JSON.stringify({ episodeDescription: 'Useful tools.' }), metadata } } }
    const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    expect(slot.status).toBe('failed')
    expect(slot.metadata?.rawProviderUsage).toEqual(metadata.rawProviderUsage)
    expect(slot.billing).toEqual({ status: 'known', costCents: 0.04 })
    await runWriteBenchmarkSlot(plan, entry, prepared, target)
    expect(calls).toBe(1)
    await Bun.write(join(entry.runDir, 'source.txt'), prepared.source)
    await finalizeWriteBenchmarkCase(plan, entry, prepared, [slot])
    const manifest = await readManifest(entry.runDir)
    expect(manifest?.items[0]?.status).toBe('failed')
    expect(manifest?.items[0]?.providers[0]?.status).toBe('failed')
    expect(manifest?.items[0]?.metadata['cost']).toMatchObject({ actual: { totalCost: 0.04 } })
  })

  test('adapter validation failure retains sanitized decoded response and complete token usage', async () => {
    const { plan, entry, prepared } = await setup()
    const rawUsage = { input_tokens: 12, output_tokens: 34, output_tokens_details: { thinking_tokens: 7 } }
    const rawResponse = { model: 'claude-sonnet-5-5', stop_reason: 'max_tokens', usage: rawUsage, api_key: 'sensitive-key', sourcePath: join(process.cwd(), 'src/tools/write-benchmark.ts'), content: [{ type: 'text', text: 'Partial output\nwith formatting.' }] }
    const target: LLMTarget = { service: 'anthropic', label: 'Anthropic', model: 'claude-sonnet-5-5', run: async () => { throw ValidationError('Incomplete response', { metadata: { rawResponse, rawProviderUsage: rawUsage, returnedModel: rawResponse.model } }) } }
    const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    expect(slot.status).toBe('failed')
    expect(slot.metadata?.inputTokenCount).toBe(12)
    expect(slot.metadata?.outputTokenCount).toBe(34)
    expect(slot.billing?.status).toBe('known')
    expect(slot.billing?.costCents).toBeCloseTo(0.0364, 8)
    const text = await Bun.file(join(entry.runDir, 'failure-anthropic-claude-sonnet-5-5.json')).text()
    expect(text).not.toContain(process.cwd())
    expect(text).not.toContain('sensitive-key')
    const evidence = JSON.parse(text)
    expect(evidence.rawProviderUsage).toEqual(rawUsage)
    expect(evidence.rawResponse.stop_reason).toBe('max_tokens')
    expect(evidence.rawResponse.content[0].text).toBe(rawResponse.content[0]!.text)
    expect(evidence.originalDecodedResponseSha256).toBe(sha256Bytes(JSON.stringify(rawResponse)))
  })

  test('failure without complete provider usage explicitly records unresolved billing', async () => {
    const { plan, entry, prepared } = await setup()
    const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => { throw ValidationError('Partial usage', { metadata: { rawProviderUsage: { input_tokens: 10 } } }) } }
    const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    expect(slot.metadata).toBeUndefined()
    expect(slot.billing?.status).toBe('unresolved')
    expect(slot.billing?.costCents).toBeUndefined()
  })

  test('changed input or schema is rejected before any dispatch', async () => {
    const { plan, entry, prepared } = await setup()
    let calls = 0
    const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => { calls++; return { result: '{}', metadata } } }
    await expect(runWriteBenchmarkSlot(plan, entry, { ...prepared, source: 'changed source' }, target)).rejects.toThrow('inputs changed before dispatch')
    await expect(runWriteBenchmarkSlot(plan, { ...entry, schemaSha256: 'changed' }, prepared, target)).rejects.toThrow('inputs changed before dispatch')
    expect(calls).toBe(0)
  })

  test('failed and interrupted durable attempt records block automatic repurchase', async () => {
    const { plan, entry, prepared } = await setup()
    let calls = 0
    const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => { calls++; throw new Error('ambiguous connection reset') } }
    expect((await runWriteBenchmarkSlot(plan, entry, prepared, target)).status).toBe('failed')
    expect((await runWriteBenchmarkSlot(plan, entry, prepared, target)).status).toBe('failed')
    const path = join(entry.runDir, 'slot-openai-gpt-6.1-sol.json')
    const failed = await Bun.file(path).json()
    await Bun.write(path, JSON.stringify({ ...failed, status: 'dispatch-started' }))
    expect((await runWriteBenchmarkSlot(plan, entry, prepared, target)).status).toBe('dispatch-started')
    await expect(runWriteBenchmarkSlot({ ...plan, fingerprint: 'changed' }, entry, prepared, target)).rejects.toThrow('identity changed')
    expect(calls).toBe(1)
  })

  test('native adapter fallback is blocked after an inference response', async () => {
    const { plan, entry, prepared } = await setup()
    let requests = 0
    globalThis.fetch = Object.assign(async () => { requests++; return new Response('{}', { status: 200 }) }, { preconnect: originalFetch.preconnect }) as typeof fetch
    const restore = installWriteBenchmarkFetchGuard()
    try {
      const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => {
        await fetch('https://local.invalid/first')
        await fetch('https://local.invalid/fallback')
        return { result: '{}', metadata }
      } }
      const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
      expect(slot.status).toBe('failed')
      expect(slot.error).toContain('redispatch blocked')
      expect(requests).toBe(1)
      expect(slot.networkAttempts).toBe(1)
    } finally { restore() }
  })

  test('explicit HTTP 429 admission allows the next attempt', async () => {
    const { plan, entry, prepared } = await setup()
    let requests = 0
    globalThis.fetch = Object.assign(async () => { requests++; return new Response('{}', { status: requests === 1 ? 429 : 200 }) }, { preconnect: originalFetch.preconnect }) as typeof fetch
    const restore = installWriteBenchmarkFetchGuard()
    try {
      const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => {
        await fetch('https://local.invalid/admission')
        await fetch('https://local.invalid/retry')
        return { result: JSON.stringify({ episodeDescription: 'A concise description.' }), metadata }
      } }
      const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
      expect(slot.status).toBe('completed')
      expect(requests).toBe(2)
    } finally { restore() }
  })

  test('transport ambiguity blocks a second network attempt', async () => {
    const { plan, entry, prepared } = await setup()
    let requests = 0
    globalThis.fetch = Object.assign(async () => { requests++; throw new Error('connection reset after dispatch') }, { preconnect: originalFetch.preconnect }) as typeof fetch
    const restore = installWriteBenchmarkFetchGuard()
    try {
      const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => {
        await fetch('https://local.invalid/ambiguous').catch(() => undefined)
        await fetch('https://local.invalid/retry')
        return { result: '{}', metadata }
      } }
      const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
      expect(slot.status).toBe('failed')
      expect(slot.error).toContain('redispatch blocked')
      expect(requests).toBe(1)
    } finally { restore() }
  })

  test('canonical manifest replay preserves creation identity, cost and timing without redispatch', async () => {
    const { entry, prepared } = await setup()
    const full = await buildWriteBenchmarkPlan()
    const provider = full.providers.find(provider => provider.provider === 'openai' && provider.model === 'gpt-6.1-sol')!
    const plan = { ...full, providers: [provider] }
    let calls = 0
    const target: LLMTarget = { service: 'openai', label: 'OpenAI', model: 'gpt-6.1-sol', run: async () => { calls++; return { result: JSON.stringify({ episodeDescription: 'Practical software tools.' }), metadata } } }
    const slot = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    await Bun.write(join(entry.runDir, 'source.txt'), prepared.source)
    await finalizeWriteBenchmarkCase(plan, entry, prepared, [slot])
    const manifest = await readManifest(entry.runDir)
    // Make creation-time equality meaningful even when two finalizations share a clock tick.
    const originalCreatedAt = '2026-10-18T00:00:00.000Z'
    await Bun.write(join(entry.runDir, 'manifest.json'), JSON.stringify({ ...manifest, createdAt: originalCreatedAt }))
    const reused = await runWriteBenchmarkSlot(plan, entry, prepared, target)
    await finalizeWriteBenchmarkCase(plan, entry, prepared, [reused])
    const replayed = await readManifest(entry.runDir)
    expect(replayed?.createdAt).toBe(originalCreatedAt)
    expect(replayed?.command).toBe(manifest?.command)
    expect(replayed?.scope).toBe(manifest?.scope)
    expect(replayed?.items[0]?.metadata['cost']).toEqual(manifest?.items[0]?.metadata['cost'])
    expect(calls).toBe(1)
    expect(manifest?.command).toBe('write')
    expect(manifest?.items[0]?.status).toBe('full')
    expect(manifest?.items[0]?.providers[0]?.status).toBe('succeeded')
    expect(manifest?.items[0]?.metadata['cost']).toMatchObject({ actual: { totalCost: 0.04 } })
    expect(manifest?.items[0]?.metadata['timing']).toMatchObject({ actual: { totalProcessingTimeMs: 125 } })
  })
})
