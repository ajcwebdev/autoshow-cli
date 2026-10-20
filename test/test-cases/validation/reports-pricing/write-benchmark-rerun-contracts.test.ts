import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { buildWriteBenchmarkRerunPlan, executeWriteBenchmarkRerun, verifyWriteBenchmarkRerunCache, WRITE_BENCHMARK_RERUN_COMMAND } from '~/tools/rerun-write-benchmark'
import { prepareWriteBenchmarkCase, WRITE_BENCHMARK_PLAN } from '~/tools/write-benchmark'
import type { WriteBenchmarkRerunPlan } from '~/tools/rerun-write-benchmark'
import type { BenchmarkSlot, WriteBenchmarkPlan } from '~/tools/write-benchmark'
import type { LLMService, LLMTarget, Step3Metadata } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'

const originalFetch = globalThis.fetch
const temporary: string[] = []
const expectedTargets = [
  '01-short-summary:anthropic/claude-sonnet-5-5',
  '03-medium-chapters:glm/glm-5.3',
  '05-rap-song-chapter:grok/grok-4.7',
  '05-rap-song-chapter:grok/grok-4.6',
  '05-rap-song-chapter:glm/glm-5.3',
  '05-rap-song-chapter:glm/glm-5.3-flash',
  '05-rap-song-chapter:together/glm-5.3-flash'
]
afterEach(async () => {
  globalThis.fetch = originalFetch
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const blockNetwork = (): void => {
  globalThis.fetch = Object.assign(async () => { throw Error('This local contract cannot call a provider.') }, { preconnect: originalFetch.preconnect }) as typeof fetch
}
const authorizeFixture = (plan: WriteBenchmarkRerunPlan): WriteBenchmarkRerunPlan => ({ ...plan, authorization: {
  command: WRITE_BENCHMARK_RERUN_COMMAND, planFingerprint: plan.fingerprint, approvedAt: '2026-10-18T20:00:00.000Z',
  evidence: 'Local mocked fixture only; this record does not authorize live dispatch.', acknowledgedScenarioCostCents: plan.observedMaxOutputScenarioCostCents,
  acknowledgesUncappedReasoning: true, acknowledgesPriorUnresolvedBilling: true
} })
const treeHashes = async (directory: string): Promise<Record<string, string>> => {
  const result: Record<string, string> = {}
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name === '.DS_Store' || item.name === 'reruns') continue
    const path = join(directory, item.name)
    if (item.isDirectory()) Object.assign(result, await treeHashes(path))
    else result[path] = sha256Bytes(await Bun.file(path).text())
  }
  return result
}

const setup = async ({ activeFailures = true } = {}): Promise<{ original: WriteBenchmarkPlan; originalPath: string; plan: WriteBenchmarkRerunPlan; before: Record<string, string>; root: string }> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-write-rerun-contracts-'))
  temporary.push(root)
  const original = await Bun.file(WRITE_BENCHMARK_PLAN).json() as WriteBenchmarkPlan
  const inputDirectories = original.cases.map(entry => entry.runDir)
  const activeFailureKeys = new Set([
    ...original.cases.map(entry => `${entry.id}:anthropic/claude-sonnet-5-5`),
    '04-blog:grok/grok-4.7', '05-rap-song-chapter:grok/grok-4.7'
  ])
  original.cases = original.cases.map(entry => ({ ...entry, runDir: join(root, entry.id) }))
  const { fingerprint: _fingerprint, ...content } = original
  original.fingerprint = sha256Bytes(JSON.stringify(content))
  for (const [index, entry] of original.cases.entries()) {
    await mkdir(entry.runDir, { recursive: true })
    const prepared = await prepareWriteBenchmarkCase(entry)
    await Bun.write(join(entry.runDir, 'source.txt'), prepared.source)
    await Bun.write(join(entry.runDir, 'prompt.md'), prepared.prompt)
    await Bun.write(join(entry.runDir, 'manifest.json'), await Bun.file(join(inputDirectories[index]!, 'manifest.json')).text())
    for (const provider of original.providers) {
      const name = `slot-${provider.provider}-${provider.model}.json`
      const receipt = await Bun.file(join(inputDirectories[index]!, name)).json() as BenchmarkSlot
      // Preserve seven mocked failures using current routes while keeping historical fixtures immutable.
      if (activeFailures) receipt.status = activeFailureKeys.has(`${entry.id}:${provider.provider}/${provider.model}`) ? 'failed' : 'completed'
      const evidence = `immutable-original-evidence-${provider.provider}-${provider.model}.txt`
      await Bun.write(join(entry.runDir, evidence), `Original fixture ${entry.id}/${provider.provider}/${provider.model}\n`)
      receipt.planFingerprint = original.fingerprint
      receipt.artifactHashes = { [evidence]: sha256Bytes(await Bun.file(join(entry.runDir, evidence)).text()) }
      await Bun.write(join(entry.runDir, name), `${JSON.stringify(receipt, null, 2)}\n`)
    }
  }
  const originalPath = join(root, 'benchmark-plan.json')
  await Bun.write(originalPath, `${JSON.stringify(original, null, 2)}\n`)
  return { original, originalPath, plan: await buildWriteBenchmarkRerunPlan(originalPath), before: await treeHashes(root), root }
}

const metadata = (target: Pick<LLMTarget, 'service' | 'model'>): Step3Metadata => ({
  llmService: target.service, llmModel: target.model, processingTime: 12, inputTokenCount: 100, outputTokenCount: 20,
  tokenCountSource: 'provider_usage', providerUsage: { inputTokenCount: 100, outputTokenCount: 20 },
  rawProviderUsage: { input_tokens: 100, output_tokens: 20 }, outputFileName: '', outputFormat: 'json', structuredMode: 'native', structuredPresetNames: []
})
const fakeTargets = (plan: WriteBenchmarkRerunPlan, run: (target: Pick<LLMTarget, 'service' | 'model'>, prompt: string) => Promise<string>): LLMTarget[] => plan.cases.flatMap(entry => entry.providers.map(provider => {
  if (!['openai', 'anthropic', 'gemini', 'grok'].includes(provider.provider)) throw Error('Mock dispatch requires an active provider')
  const target = { service: provider.provider as LLMService, model: provider.model, label: provider.provider }
  return { ...target, run: async (prompt, model, controls) => {
    expect(model).toBe(target.model)
    expect(controls?.strategy).toBe('native')
    expect(controls?.requestedReasoningEffort).toBeUndefined()
    return { result: await run(target, prompt), metadata: metadata(target) }
  } }
}))

describe('targeted write benchmark rerun safety', () => {
  test('price-only selection is exactly the seven original failures, with observed reasoning risk and no inferred approval', async () => {
    blockNetwork()
    const plan = await buildWriteBenchmarkRerunPlan()
    expect(plan.cases.flatMap(entry => entry.providers.map(provider => `${entry.id}:${provider.provider}/${provider.model}`))).toEqual(expectedTargets)
    expect(plan.requestCount).toBe(7)
    expect(plan.cases.map(entry => entry.providers.length)).toEqual([1, 1, 5])
    expect(plan.providerConcurrency).toBe(2)
    expect(plan.nativeEstimatedCostCents).toBeCloseTo(7.61484, 7)
    expect(plan.observedMaxOutputScenarioCostCents).toBeCloseTo(62.77138, 7)
    expect(plan.priorKnownCostCents).toBeCloseTo(381.41712, 7)
    expect(plan.priorUnresolvedSlots).toBe(5)
    expect(plan.authorization).toBeNull()
    expect(plan.cases.every(entry => entry.runDir === `${entry.originalRunDir}/reruns/02`)).toBe(true)
    expect(JSON.stringify(plan)).not.toContain(process.cwd())
  })

  test('unapproved and malformed approval records reject before dispatch or new attempt files', async () => {
    blockNetwork()
    const fixture = await setup()
    const approved = authorizeFixture(fixture.plan)
    const malformed = [fixture.plan,
      { ...approved, authorization: { ...approved.authorization!, acknowledgedScenarioCostCents: Number.NaN } },
      { ...approved, authorization: { ...approved.authorization!, acknowledgedScenarioCostCents: 0 } },
      { ...approved, authorization: { ...approved.authorization!, planFingerprint: 'different-plan' } }
    ]
    let calls = 0
    const targets = fakeTargets(fixture.plan, async () => { calls++; return '{}' })
    for (const plan of malformed) await expect(executeWriteBenchmarkRerun(plan, targets)).rejects.toThrow('cost-specific authorization')
    expect(calls).toBe(0)
    expect(await treeHashes(fixture.root)).toEqual(fixture.before)
    expect(await Bun.file(join(fixture.plan.cases[0]!.runDir, 'source.txt')).exists()).toBe(false)
  })

  test('historical retired-model rerun receipts remain verifiable while paid execution of that plan is blocked', async () => {
    blockNetwork()
    const historical = await Bun.file('docs/benchmarks/write/rerun-plan.json').json() as WriteBenchmarkRerunPlan
    const cached = await verifyWriteBenchmarkRerunCache(historical)
    expect(cached).toHaveLength(7)
    expect(cached.find(slot => slot.provider === 'grok' && slot.model === 'grok-4.6')?.status).toBe('completed')
    const fixture = await setup({ activeFailures: false })
    let calls = 0
    await expect(executeWriteBenchmarkRerun(authorizeFixture(fixture.plan), [])).rejects.toThrow('Retired or unsupported rerun model glm/glm-5.3')
    expect(calls).toBe(0)
    expect(await treeHashes(fixture.root)).toEqual(fixture.before)
    expect(await Bun.file(join(fixture.plan.cases[0]!.runDir, 'source.txt')).exists()).toBe(false)
  })

  test('historical rerun estimates require the original retired-route snapshot and preserve the pinned selection fingerprint', async () => {
    blockNetwork()
    const saved = await Bun.file('docs/benchmarks/write/rerun-plan.json').json() as WriteBenchmarkRerunPlan
    const rebuilt = await buildWriteBenchmarkRerunPlan()
    expect(rebuilt.fingerprint).toBe(saved.fingerprint)
    expect(rebuilt.cases).toEqual(saved.cases)
    const fixture = await setup({ activeFailures: false })
    const entry = fixture.original.cases.find(entry => entry.id === '05-rap-song-chapter')!
    const path = join(entry.runDir, 'manifest.json')
    const manifest = await Bun.file(path).json()
    const steps = manifest.items[0].metadata.cost.estimated.steps as Array<Record<string, unknown>>
    const snapshot = steps.find(row => row['provider'] === 'grok' && row['model'] === 'grok-4.6')!
    snapshot['cost'] = null
    await Bun.write(path, JSON.stringify(manifest))
    await expect(buildWriteBenchmarkRerunPlan(fixture.originalPath)).rejects.toThrow('Missing or invalid historical native estimate snapshot')
    snapshot['cost'] = 0
    snapshot['inputCostPer1MCents'] = 999
    await Bun.write(path, JSON.stringify(manifest))
    await expect(buildWriteBenchmarkRerunPlan(fixture.originalPath)).rejects.toThrow('Missing or invalid historical native estimate snapshot')
  })

  test('one extra native attempt per target preserves originals and replays valid, invalid and failed receipts without purchase', async () => {
    blockNetwork()
    const fixture = await setup()
    const plan = authorizeFixture(fixture.plan)
    let calls = 0
    const targets = fakeTargets(plan, async (target, prompt) => {
      calls++
      if (target.service === 'anthropic' && sha256Bytes(prompt) === plan.cases[0]!.promptSha256) {
        expect(sha256Bytes(prompt)).toBe(plan.cases[0]!.promptSha256)
        return JSON.stringify({ episodeDescription: 'A concise review of practical software tools.' })
      }
      if (target.service === 'grok' && sha256Bytes(prompt) === plan.cases.find(entry => entry.id === '04-blog')!.promptSha256) throw Error('Ambiguous mock connection closed after dispatch')
      return 'deliberately invalid JSON {'
    })
    const first = await executeWriteBenchmarkRerun(plan, targets)
    expect(calls).toBe(7)
    expect(first.filter(slot => slot.status === 'completed')).toHaveLength(1)
    expect(first.filter(slot => slot.status === 'validation-failed')).toHaveLength(5)
    expect(first.filter(slot => slot.status === 'failed')).toHaveLength(1)
    expect(await treeHashes(fixture.root)).toEqual(fixture.before)
    for (const entry of plan.cases) {
      const manifest = await readManifest(entry.runDir)
      const expected = entry.providers.map(provider => `${provider.provider}/${provider.model}`).sort()
      expect(manifest?.items[0]?.providers.map(provider => `${provider.service}/${provider.model}`).sort()).toEqual(expected)
      expect(manifest?.items[0]?.providers).toHaveLength(entry.providers.length)
      const cost = manifest?.items[0]?.metadata['cost'] as { estimated: { steps: unknown[] } }
      expect(cost.estimated.steps).toHaveLength(entry.providers.length)
      expect((manifest?.items[0]?.metadata['step3'] as unknown[]).length).toBeLessThanOrEqual(entry.providers.length)
    }
    expect(await executeWriteBenchmarkRerun(plan, targets)).toEqual(first)
    expect(calls).toBe(7)
    const verified = await verifyWriteBenchmarkRerunCache(fixture.plan)
    expect(verified).toEqual(first)
    expect(calls).toBe(7)
    expect(await treeHashes(fixture.root)).toEqual(fixture.before)
    const entry = plan.cases[0]!
    await Bun.write(join(entry.runDir, 'text-anthropic-claude-sonnet-5-5.json'), '{}')
    await expect(verifyWriteBenchmarkRerunCache(plan)).rejects.toThrow('artifact missing or changed')
    await expect(executeWriteBenchmarkRerun(plan, targets)).rejects.toThrow('artifact missing or changed')
    expect(calls).toBe(7)
  })

  test('missing rerun cache never dispatches and changed original receipts or schemas invalidate a pinned selection', async () => {
    blockNetwork()
    const fixture = await setup()
    await expect(verifyWriteBenchmarkRerunCache(fixture.plan)).rejects.toThrow('Missing rerun cache receipt')
    const changedPlan = authorizeFixture(structuredClone(fixture.plan))
    changedPlan.cases[0]!.schemaSha256 = 'changed-schema'
    await expect(executeWriteBenchmarkRerun(changedPlan, [])).rejects.toThrow('Rerun plan selection')
    const target = fixture.plan.cases[0]!.providers[0]!
    const receipt = await Bun.file(target.originalReceiptPath).json()
    await Bun.write(target.originalReceiptPath, JSON.stringify({ ...receipt, status: 'completed' }))
    await expect(executeWriteBenchmarkRerun(authorizeFixture(fixture.plan), [])).rejects.toThrow('Expected exactly 7')
    expect(await Bun.file(join(fixture.plan.cases[0]!.runDir, 'source.txt')).exists()).toBe(false)
  })

  test('source snapshots and original artifact hashes are checked before a rerun can be priced', async () => {
    blockNetwork()
    const fixture = await setup()
    const entry = fixture.original.cases[0]!
    const snapshot = join(entry.runDir, 'prompt.md')
    const original = await Bun.file(snapshot).text()
    await Bun.write(snapshot, `${original}\nchanged`)
    await expect(buildWriteBenchmarkRerunPlan(fixture.originalPath)).rejects.toThrow('snapshot missing or changed')
    await Bun.write(snapshot, original)
    const receipt = await Bun.file(fixture.plan.cases[0]!.providers[0]!.originalReceiptPath).json() as BenchmarkSlot
    await Bun.write(join(entry.runDir, Object.keys(receipt.artifactHashes!)[0]!), 'changed original evidence')
    await expect(buildWriteBenchmarkRerunPlan(fixture.originalPath)).rejects.toThrow('Original artifact missing or changed')
  })
})
