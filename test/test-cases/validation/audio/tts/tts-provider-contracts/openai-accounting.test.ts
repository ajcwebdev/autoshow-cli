import { afterEach, expect, test } from 'bun:test'
import { join } from 'node:path'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { runOpenAITts } from '~/cli/commands/audio/tts/tts-services/tts-openai/run-openai-tts'
import { estimateOpenAITtsCost, estimateOpenAITtsSlots, readOpenAITtsEstimate } from '~/cli/commands/audio/tts/tts-services/tts-openai/openai-tts-pricing'
import { validateOpenAITtsRequest } from '~/cli/commands/audio/tts/tts-services/tts-openai/openai-tts-request'
import { buildPureCurrentTtsRenderPlan } from '~/cli/commands/audio/tts/script-to-audio/attempt-planning'
import { planCurrentTtsResumePrice, prepareCurrentTtsCompletedRecovery } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { adoptExactRetainedTtsChunkPlan } from '~/cli/commands/audio/tts/script-to-audio/tts-retained-chunk-plan'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/audio/tts/script-to-audio/generic-dialogue-plan'
import { planProviderTtsChunks } from '~/cli/commands/audio/tts/tts-utils/tts-provider-chunk-policy'
import { createHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import { buildTtsEstimateForInput } from '~/cli/commands/audio/tts/tts-batch-estimates'
import { runSingleTtsInput } from '~/cli/commands/audio/tts/tts-single-run'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { resolveTtsResumeSourceContext } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume-source-context'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { configureModelCostFilter } from '~/cli/commands/pricing-orchestration/model-cost-filter'
import { getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { selectCheapestDefaultHostedTtsSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { buildReadyVoiceRegistrationDraft } from '~/cli/commands/audio/voice/voice-registration-management'
import { planCanonicalVoiceAudition } from '~/cli/commands/audio/voice/canonical-voice-audition'
import { createSyntheticWavBytes } from '../../../../../test-utils/media-fixtures'
import { createTtsFixtureTarget } from '../../../../../test-utils/tts-fixture-target'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import type { CharacterVoiceBrief, PipelineProviderState, PreparedTtsInput, StandaloneTtsCommandOptions, Step4Metadata, TtsOptions, TtsRequestEvidenceScope } from '~/types'

const { makeTempDir } = setupTtsContractLifecycle()
afterEach(resetPinnedRunDir)
const model = 'gpt-4o-mini-tts-2025-12-15'
const options = (extra: Partial<StandaloneTtsCommandOptions> = {}): StandaloneTtsCommandOptions => ({ batchConcurrency: 1, price: false, allowOverBudget: false, openaiTtsModels: [model], ttsChunkConcurrency: 1, ...extra })
const audio = () => createSyntheticWavBytes({ durationSeconds: 0.1, sampleRate: 24000, amplitude: 0.2, frequencyHz: 440 })
const scheduler = () => createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate' })
// Independently checked 2026-10-15: model docs specify $0.60/M text tokens,
// $12/M audio tokens, 2,000 input tokens; speech API specifies 4,096 chars and
// speed 0.25–4. Conversion constants below are explicit local policy, not usage.
// https://developers.openai.com/api/docs/models/gpt-4o-mini-tts
// https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
const expectedCost = (text: string, instructions = '', speed = 1) => ((Buffer.byteLength(text) + Buffer.byteLength(instructions) + 128) * 60 + Math.ceil([...text].length / 6 / speed * 25) * 1200) / 1e6
const prepare = (text: string, opts: TtsOptions): PreparedTtsInput => {
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = opts.ttsSpeakers ? createGenericTtsDialoguePlan(sourceIdentity, text, opts) : createSingleTurnTtsDialoguePlan(sourceIdentity, text)
  return { inputPath: 'fixture.txt', manifestInputPath: 'fixture.txt', sourceBytes: new TextEncoder().encode(text), text, sourceIdentity, dialoguePlan, ttsCharacterCount: [...text].length, ttsTimingInputText: text, dialogueRequested: Boolean(opts.ttsSpeakers) }
}

test('native billing units and independent conservative count-only quote reach model selection', () => {
  expect(getTtsPricing('openai', model)).toEqual({ inputCostPer1MTokensCents: 60, outputCostPer1MAudioTokensCents: 1200, rateIdentity: 'openai-tts-2026-10-15' })
  // 4,000 bytes + 3 requests × 128 framing = 4,384 estimated text tokens;
  // ceil(1,000 / 6 × 25) = 4,167 estimated audio tokens.
  expect(estimateOpenAITtsCost(1000)).toMatchObject({ requestCount: 3, estimatedTextTokens: 4384, estimatedAudioTokens: 4167, totalCost: 5.26344 })
  expect(estimateOpenAITtsCost(1000).estimateProvenance).toContain('not provider token usage or a guaranteed maximum')
  expect(estimateOpenAITtsCost(0).totalCost).toBe(0)
  expect(selectCheapestDefaultHostedTtsSelection()).toMatchObject({ provider: 'gemini', model: 'gemini-3.8-flash-lite-tts' })
})

test('invalid count, duration and control estimates cannot produce non-finite or negative budgets', () => {
  for (const bad of [NaN, Infinity, -1, 0.5]) {
    expect(() => estimateOpenAITtsCost(bad)).toThrow()
    expect(() => estimateOpenAITtsCost(5, { requestCount: bad })).toThrow()
    expect(() => estimateOpenAITtsCost(5, { textBytes: bad })).toThrow()
  }
  for (const bad of [NaN, Infinity, -1]) expect(() => estimateOpenAITtsCost(5, { providerAudioSeconds: bad })).toThrow()
  expect(() => estimateOpenAITtsCost(5, { requestCount: 0 })).toThrow()
  expect(() => estimateOpenAITtsCost(5, { speed: 4.1 })).toThrow()
})

test('English, Chinese, Arabic and emoji price source bytes and retain safe Unicode chunk bounds', async () => {
  const opts = options({ openaiTtsInstructions: 'Calm.' })
  const target = collectTtsTargets(opts)[0]!
  for (const text of ['Hello.', '你好。', 'مرحبا.', '🌙']) {
    const prepared = prepare(text, opts)
    const quote = await buildTtsEstimateForInput(prepared, opts, [target])
    expect(quote.steps[0]!.totalCost).toBeCloseTo(expectedCost(text, 'Calm.'))
    const chunks = planProviderTtsChunks({ provider: 'openai', model, text: text.repeat(900), style: 'Calm.' })
    for (const chunk of chunks) {
      expect(chunk.text.isWellFormed()).toBe(true)
      expect(Buffer.byteLength(chunk.text) + 5 + 128).toBeLessThanOrEqual(2000)
      expect(chunk.text.length).toBeLessThanOrEqual(4096)
    }
  }
})

test('actual planned requests repeat instruction overhead and share one quote with budget filtering', async () => {
  const opts = options({ openaiTtsInstructions: 'Warm.', openaiTtsSpeed: 0.5 })
  const text = 'A'.repeat(3800), target = collectTtsTargets(opts)[0]!, prepared = prepare(text, opts)
  const plan = buildPureCurrentTtsRenderPlan({ target, sourceText: text, ttsOptions: opts })
  const expected = plan.planned.slots.reduce((sum, slot) => sum + expectedCost(slot.providerText, 'Warm.', 0.5), 0)
  const quoted = await buildTtsEstimateForInput(prepared, opts, [target])
  expect(plan.planned.slots.length).toBeGreaterThan(1)
  expect(quoted.steps[0]!.totalCost).toBeCloseTo(expected)
  expect(plan.plannedRenderCost.amounts[0]!.amount * 100).toBeCloseTo(expected)
  expect(quoted.steps[0]).toMatchObject({ requestCount: plan.planned.slots.length })
  const filter = { maxModelCents: expected - 0.001 }
  const grok = collectTtsTargets({ grokTtsModels: ['grok-tts'] })[0]!
  const combined = await buildTtsEstimateForInput(prepared, opts, [target, grok])
  expect(configureModelCostFilter(filter, [combined])).toEqual([{ step: 'tts', provider: 'openai', model, totalCost: quoted.steps[0]!.totalCost }])
})

test('mocked dispatch preserves default, override and null-reset controls and native heuristic receipts', async () => {
  const root = await makeTempDir('openai-controls-accounting-'), input = join(root, 'source.txt'), output = join(root, 'run')
  const text = 'Host: First.\nGuest: Second.\nHost: Third.'
  await Bun.write(input, text); configurePinnedRunDir(output); process.env['OPENAI_API_KEY'] = 'fixture-openai-key'
  const calls = installMockFetch(() => new Response(audio()))
  const opts = options({ openaiTtsInstructions: 'Global.', openaiTtsSpeed: 0.5, ttsDialogueFormat: 'labeled', ttsSpeakers: ['Host=alloy', 'Guest=marin'], ttsTurnControls: { 'dialogue-turn-001': { openai: { instructions: 'Warm.', speed: 2 } }, 'dialogue-turn-002': { openai: { instructions: null, speed: null } } } })
  const target = collectTtsTargets(opts)[0]!
  const plan = buildPureCurrentTtsRenderPlan({ target, sourceText: text, ttsOptions: opts })
  const expected = expectedCost('First.', 'Warm.', 2) + expectedCost('Second.') + expectedCost('Third.', 'Global.', 0.5)
  expect(estimateOpenAITtsSlots(plan.planned.slots, plan.planned.turns).totalCost).toBeCloseTo(expected)
  await runSingleTtsInput(input, opts, [target], undefined)
  expect(calls.map(call => call.bodyJson)).toEqual([
    { model, voice: 'alloy', input: 'First.', response_format: 'wav', instructions: 'Warm.', speed: 2 },
    { model, voice: 'marin', input: 'Second.', response_format: 'wav' },
    { model, voice: 'alloy', input: 'Third.', response_format: 'wav', instructions: 'Global.', speed: 0.5 },
  ])
  const manifest = await readManifest(output)
  const metadata = manifest!.items[0]!.metadata['tts'] as Step4Metadata[]
  expect(metadata[0]!.openaiTtsEstimate!.totalCost).toBeCloseTo(expected)
  const costs = manifest!.items[0]!.metadata['cost'] as { observedEstimate: { totalCost: number } }
  expect(costs.observedEstimate.totalCost).toBeCloseTo(expected)
  expect(computeActualCosts({ step4: metadata, ttsCharacterCount: text.length }).steps[0]).toMatchObject({ cost: expected, costSource: 'heuristic', inputMetric: 'estimatedTextTokens' })
}, 20000)

test('canonical audition quotes retain registered instructions, speed, defaults and null resets per passage/request', () => {
  const brief: CharacterVoiceBrief = { subjectKey: 'hero', profileKey: 'default', language: 'en', locale: 'en-US', timbre: 'warm', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['provider-stock'] }
  for (const values of [{}, { instructions: 'Warm.', speed: 0.5 }, { instructions: null, speed: null }]) {
    const registration = buildReadyVoiceRegistrationDraft({ subjectKey: 'hero', profileKey: 'default', provider: 'openai', providerModel: model, providerVoice: { kind: 'remote-resource', provider: 'openai', resourceId: 'alloy', namespace: 'provider', origin: 'provider-stock', ownership: 'provider', deletion: { state: 'provider-managed', checkedAt: '2026-10-15T00:00:00Z' } }, brief, provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64), settings: { schemaVersion: 1, settingsSchema: 'openai.voice-defaults.v1', values } })
    const plan = planCanonicalVoiceAudition(registration, brief, 'X'.repeat(2400), 2)
    const instructions = typeof values.instructions === 'string' ? values.instructions : '', speed = typeof values.speed === 'number' ? values.speed : 1
    const cap = 2000 - 128 - Buffer.byteLength(instructions)
    const expected = plan.passages.reduce((sum, passage) => {
      if (passage.category !== 'representative') return sum + expectedCost(passage.text, instructions, speed)
      return sum + expectedCost(passage.text.slice(0, cap), instructions, speed) + expectedCost(passage.text.slice(cap), instructions, speed)
    }, 0) * 2
    expect(plan.estimatedCostCents).toBeCloseTo(expected)
    expect(plan.plannedCost.amounts[0]!.amount * 100).toBeCloseTo(expected)
  }
})

test('prepared turn resets discard unused global instructions before quote validation', async () => {
  const opts = options({ openaiTtsInstructions: 'x'.repeat(2000), ttsDialogueFormat: 'labeled', ttsSpeakers: ['Host=alloy', 'Guest=marin'], ttsTurnControls: { 'dialogue-turn-001': { openai: { instructions: null } }, 'dialogue-turn-002': { openai: { instructions: 'Warm.' } } } })
  const quote = await buildTtsEstimateForInput(prepare('Host: First.\nGuest: Second.', opts), opts)
  expect(quote.steps[0]!.totalCost).toBeCloseTo(expectedCost('First.') + expectedCost('Second.', 'Warm.'))
})

test('invalid native controls and retained input bounds reject before mocked provider dispatch', async () => {
  process.env['OPENAI_API_KEY'] = 'fixture-openai-key'
  const root = await makeTempDir('openai-invalid-bound-'), calls = installMockFetch(() => new Response(audio()))
  for (const controls of [{ speed: 0.24 }, { speed: NaN }, { instructions: 'x'.repeat(4097) }, { instructions: 'x'.repeat(2000) }]) await expect(runOpenAITts('Hello.', root, { model, ...controls, chunkScheduler: scheduler() })).rejects.toThrow()
  for (const chunk of ['x'.repeat(4097), '界'.repeat(1000)]) await expect(runOpenAITts(chunk, root, { model, chunkScheduler: scheduler(), requestEvidence: { plannedChunks: [chunk] } as unknown as TtsRequestEvidenceScope })).rejects.toThrow()
  expect(calls).toHaveLength(0)
  expect(() => validateOpenAITtsRequest('a'.repeat(1872))).not.toThrow()
  expect(() => validateOpenAITtsRequest('a'.repeat(1873))).toThrow('2,000-token')
})

test('transport success with malformed audio never becomes decoded artifact success', async () => {
  process.env['OPENAI_API_KEY'] = 'fixture-openai-key'
  const root = await makeTempDir('openai-invalid-audio-'), calls = installMockFetch(() => new Response(Buffer.from('not a WAV')))
  await expect(runOpenAITts('Hello.', root, { model, chunkScheduler: scheduler() })).rejects.toThrow()
  expect(calls).toHaveLength(1)
}, 10000)

test('missing, corrupt and unsupported usage receipts remain heuristic', () => {
  const base: Step4Metadata = { ttsService: 'openai', ttsModel: model, processingTime: 1, audioFileName: 'fixture.wav', audioFileSize: 44, chunkCount: 1 }
  for (const receipt of [undefined, { input_tokens: 1, output_tokens: 2 }, { ...estimateOpenAITtsCost(1000), totalCost: NaN }, { ...estimateOpenAITtsCost(1000), estimatedTextTokens: -1 }, { ...estimateOpenAITtsCost(1000), totalCost: 1 }]) {
    expect(readOpenAITtsEstimate(receipt)).toBeUndefined()
    const metadata = { ...base, openaiTtsEstimate: receipt } as Step4Metadata
    expect(computeActualCosts({ step4: metadata, ttsCharacterCount: 1000 }).steps[0]).toMatchObject({ cost: 5.26344, costSource: 'heuristic', promptTokens: 4384, completionTokens: 4167 })
  }
  const receipt = estimateOpenAITtsCost(6, { textBytes: 6, instructions: 'Warm.', requestCount: 1, speed: 0.5 })
  expect(readOpenAITtsEstimate(receipt)).toEqual(receipt)
  expect(computeActualCosts({ step4: { ...base, openaiTtsEstimate: receipt }, ttsCharacterCount: 1000 }).steps[0]!.cost).toBeCloseTo(expectedCost('Hello.', 'Warm.', 0.5))
})

test('legacy identity replay preserves immutable costs while pending quotes use current native units', async () => {
  const target = collectTtsTargets(options())[0]!, text = 'Hello.'
  const legacy = buildPureCurrentTtsRenderPlan({ target, sourceText: text, ttsOptions: { ttsOpenAIAccountingReplay: true } })
  const bytes = JSON.stringify(legacy.renderPlan)
  expect(legacy.plannedRenderCost.amounts[0]!.amount * 100).toBeCloseTo(6 * 1260 / 1e6)
  const replayOptions: TtsOptions = {}
  const state = { result: { ttsAudio: { selectedSuccess: { renderIdentity: legacy.renderIdentity } } } } as unknown as PipelineProviderState
  adoptExactRetainedTtsChunkPlan({ target, sourceText: text, ttsOptions: replayOptions }, state)
  expect(replayOptions.ttsOpenAIAccountingReplay).toBe(true)
  expect(buildPureCurrentTtsRenderPlan({ target, sourceText: text, ttsOptions: replayOptions }).renderIdentity).toBe(legacy.renderIdentity)
  const quote = await planCurrentTtsResumePrice({ target, sourceText: text, ttsOptions: replayOptions, rootDir: '.' })
  expect(quote.plannedCost.amounts[0]!.amount * 100).toBeCloseTo(expectedCost(text))
  expect(JSON.stringify(legacy.renderPlan)).toBe(bytes)
  adoptExactRetainedTtsChunkPlan({ target, sourceText: 'Changed.', ttsOptions: replayOptions }, state)
  expect(replayOptions.ttsOpenAIAccountingReplay).toBeUndefined()
  await expect(planCurrentTtsResumePrice({ target, sourceText: 'a'.repeat(2000), ttsOptions: { ttsOpenAIAccountingReplay: true }, rootDir: '.' })).rejects.toThrow('2,000-token')
})

test('completed legacy 2,000-character audio reuses its exact identity with explicit unchanged delivery and no dispatch', async () => {
  const root = await makeTempDir('openai-completed-legacy-'), input = join(root, 'source.txt'), output = join(root, 'run')
  const text = 'a'.repeat(2000)
  await Bun.write(input, text); configurePinnedRunDir(output); process.env['OPENAI_API_KEY'] = 'fixture-openai-key'
  const delivery = resolveTtsDeliveryOptions({ 'tts-audio-profile': 'audiobook' })
  const opts = options({ ...delivery, ttsOpenAIAccountingReplay: true })
  const fixture = createTtsFixtureTarget({ model, voice: 'alloy', mode: { kind: 'success' }, audioBytes: () => createSyntheticWavBytes({ durationSeconds: 2, sampleRate: 24000, amplitude: 0.2, frequencyHz: 440 }) })
  await runSingleTtsInput(input, opts, [fixture], undefined)
  const manifest = (await readManifest(output))!, item = manifest.items[0]!
  const original = item.providers[0]!, metadata = item.metadata['tts'] as Step4Metadata[]
  const explicit: TtsOptions = { ...delivery, ttsDeliveryFallbackAllowed: false }
  const actual = collectTtsTargets(options())[0]!
  const calls = installMockFetch(() => { throw new Error('Completed legacy audio must never be purchased again') })
  // Public resume skips succeeded providers. Exercise its actual local recovery
  // primitive directly to prove old paid chunks survive the stricter new policy.
  const source = await resolveTtsResumeSourceContext(output, text, [original], new Set([actual.targetKey!]))
  const recoveryOptions = { target: actual, sourceText: text, ttsOptions: explicit, sourceIdentity: source.sourceIdentity, dialoguePlan: source.dialoguePlan }
  adoptExactRetainedTtsChunkPlan(recoveryOptions, original)
  const recovered = await prepareCurrentTtsCompletedRecovery({ ...recoveryOptions, rootDir: output, state: original })
  expect(recovered!.kind).toBe('complete-render')
  if (recovered!.kind !== 'complete-render') throw new Error('Expected complete local recovery')
  const reused = await recovered!.finalize(output, join(output, 'speech-reused.wav'))
  expect(calls).toHaveLength(0)
  expect(explicit.ttsOpenAIAccountingReplay).toBe(true)
  expect(explicit.ttsDelivery!.preset).toBe('audiobook')
  expect(reused.renderIdentity).toBe(metadata[0]!.renderIdentity!)
}, 20000)
