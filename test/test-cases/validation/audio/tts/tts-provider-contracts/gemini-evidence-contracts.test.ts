import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { geminiVoiceExpiry, assertGeminiVoiceAvailable, inspectGeminiVoiceImport } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-voice-availability'
import { estimateGeminiTtsCost, geminiTtsRates, readGeminiTtsUsageCounts, readGeminiTtsValuation, reconcileGeminiTtsUsage } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-pricing'
import { createGeminiAdvancedProvider } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-advanced-provider'
import { runGeminiTts } from '~/cli/commands/audio/tts/tts-services/tts-gemini/run-gemini-tts'
import { deliveryPcmFrames } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-pcm'
import { createProtectedVoiceAssetStore } from '~/cli/commands/audio/voice/voice-assets/protected-voice-asset-store'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { providerAccountScopeHash } from '~/cli/commands/audio/tts/script-to-audio/advanced-provider-contracts'
import { createHostedTtsChunkScheduler } from '~/cli/commands/audio/tts/tts-utils/hosted-tts-chunk-scheduler'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { FLASH, LITE, unary, wav, usage, batchAudio } from './gemini-fixtures'
import type { AdvancedProviderHttpRequest, Step4Metadata } from '~/types'

// Independent current primary contracts, retrieved 2026-10-15 (America/Chicago):
// https://ai.google.dev/api/voices: renewable expire_time; creation model is not a synthesis restriction.
// https://ai.google.dev/api/interactions-api: separate modality counts, optional lifecycle-event usage.
// https://ai.google.dev/gemini-api/docs/batch-api: 24h target, 48h expiry; no replay-idempotency guarantee.
// https://ai.google.dev/gemini-api/docs/pricing: native units and January 2027 schedules.
// Synthetic tones validate transport/artifacts only, never identity, spoken correctness or perceptual fidelity.
const { makeTempDir } = setupTtsContractLifecycle()
const at = new Date('2026-10-15T00:00:00Z')
const validUntil = '2027-10-01T00:00:00Z'
const oldVoice = { id: 'voice_old', type: 'prompted', model: `models/${LITE}`, create_time: '2020-01-01T00:00:00Z' }

test('voice expiry follows explicit renewable provider time; creation or unsupported last-use clocks remain unknown', () => {
  expect(geminiVoiceExpiry(oldVoice)).toBeUndefined()
  expect(geminiVoiceExpiry({ ...oldVoice, lastUsedAt: '2026-10-01T00:00:00Z', last_used_time: '2026-10-01T00:00:00Z' })).toBeUndefined()
  expect(geminiVoiceExpiry({ ...oldVoice, expire_time: validUntil })).toBe(validUntil)
  expect(geminiVoiceExpiry({ expire_time: null })).toBeUndefined()
  expect(geminiVoiceExpiry({ expires_at: validUntil })).toBe(validUntil)
  expect(geminiVoiceExpiry({ expire_time: validUntil, expires_at: '2027-10-01T00:00:00.000Z' })).toBe(validUntil)
  for (const expire_time of [42, {}, 'invalid']) expect(() => geminiVoiceExpiry({ expire_time })).toThrow('Invalid')
  expect(() => geminiVoiceExpiry({ expire_time: validUntil, expires_at: '2020-01-01T00:00:00Z' })).toThrow('Conflicting')
  for (const model of [FLASH, LITE]) expect(() => assertGeminiVoiceAvailable({ ...oldVoice, expire_time: validUntil }, 'voice_old', model, at)).not.toThrow()
  expect(() => assertGeminiVoiceAvailable({ ...oldVoice, expire_time: at.toISOString() }, 'voice_old', FLASH, at)).toThrow('expired')
  expect(() => assertGeminiVoiceAvailable(oldVoice, 'voice_old', FLASH, new Date('invalid'))).toThrow('inspection time')
})

test('actual mocked synthesis inspects old renewed and unknown-expiry voices, preserves default/override/reset, and rejects expired or malformed voices before POST', async () => {
  process.env['GEMINI_API_KEY'] = 'fixture-key'
  let remote: Record<string, unknown> = { ...oldVoice, expire_time: validUntil }
  const calls = installMockFetch(call => jsonResponse(call.method === 'GET' ? remote : unary()))
  for (const instructions of [undefined, 'Calm and measured.', undefined]) {
    const result = await runGeminiTts('A consistent reference sentence.', await makeTempDir('gemini-renewed-'), { model: FLASH, voice: 'voice_old', instructions, hostedTtsChunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate' }) })
    expect(calls.at(-2)?.method).toBe('GET')
    expect(calls.at(-1)?.bodyJson?.['input']).toEqual([{ type: 'user_input', content: [{ type: 'text', text: 'A consistent reference sentence.', ...(instructions ? { annotations: [{ type: 'speech_metadata', style: instructions }] } : {}) }] }])
    expect(await deliveryPcmFrames(result.audioPath)).toBeGreaterThan(0)
  }
  remote = oldVoice
  await runGeminiTts('No invented expiry.', await makeTempDir('gemini-unknown-expiry-'), { model: FLASH, voice: 'voice_old', hostedTtsChunkScheduler: createHostedTtsChunkScheduler({ maxConcurrency: 1, concurrencyMode: 'immediate' }) })
  const posts = calls.filter(call => call.method === 'POST').length
  for (const invalid of [{ expire_time: '2020-01-01T00:00:00Z' }, { expire_time: 42 }, { model: 'models/unknown' }, { model: `models/models/${FLASH}` }]) {
    remote = { ...oldVoice, ...invalid }
    await expect(runGeminiTts('Blocked before synthesis.', await makeTempDir('gemini-rejected-'), { model: FLASH, voice: 'voice_old' })).rejects.toThrow()
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(posts)
  }
})

test('canonical Gemini audition refreshes a stale local expiry through actual dispatch without changing the saved registration', async () => {
  const { buildReadyVoiceRegistrationDraft } = await import('~/cli/commands/audio/voice/voice-registration-management')
  const { runCanonicalVoiceAudition, planCanonicalVoiceAudition } = await import('~/cli/commands/audio/voice/canonical-voice-audition')
  const brief: import('~/types').CharacterVoiceBrief = { subjectKey: 'narrator', profileKey: 'default', language: 'en', locale: 'en-US', timbre: 'Warm', mannerisms: [], prohibitedCaricatures: [], pronunciations: [], allowedOrigins: ['designed'] }
  const providerVoice = { kind: 'remote-resource' as const, provider: 'gemini' as const, resourceId: 'voice_old', namespace: 'account' as const, accountScopeHash: providerAccountScopeHash('gemini', 'fixture-key'), origin: 'designed' as const, ownership: 'project' as const, deletion: { state: 'eligible' as const, checkedAt: at.toISOString() }, expiresAt: '2020-01-01T00:00:00Z' }
  const registration = buildReadyVoiceRegistrationDraft({ subjectKey: 'narrator', profileKey: 'default', provider: 'gemini', providerModel: FLASH, providerVoice, brief, provenanceRef: 'fixture:casting', capabilityFixtureHash: 'b'.repeat(64), createdAt: at.toISOString() })
  const original = JSON.stringify(registration)
  const store = createProtectedVoiceAssetStore({ storeId: 'gemini_audition_renewal', root: join(await makeTempDir('gemini-audition-renewal-'), 'protected') })
  process.env['GEMINI_API_KEY'] = 'fixture-key'
  const calls = installMockFetch(call => jsonResponse(call.method === 'GET' ? { ...oldVoice, expire_time: validUntil } : unary()))
  expect(planCanonicalVoiceAudition(registration, brief, 'A representative sentence.').estimatedCostCents).toBeGreaterThan(0)
  expect(calls).toHaveLength(0)
  const audition = await runCanonicalVoiceAudition({ registration, brief, representativeLine: 'A representative sentence.', protectedStore: store })
  expect(audition.items).toHaveLength(6)
  expect(calls.filter(call => call.method === 'GET')).toHaveLength(6)
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(6)
  expect(JSON.stringify(registration)).toBe(original)
})

test('fresh provider inspection supersedes old journal expiry and retains native creation counts without assigning a voice tariff', async () => {
  const root = await makeTempDir('gemini-renewal-journal-'), creationJournalRoot = join(root, 'creations')
  const store = createProtectedVoiceAssetStore({ storeId: 'gemini_evidence', root: join(root, 'protected') })
  let expires: string | undefined = validUntil, posts = 0
  const request: AdvancedProviderHttpRequest = async <T>(input: Parameters<AdvancedProviderHttpRequest>[0]) => {
    if (input.method === 'POST') posts++
    return { ...oldVoice, display_name: 'Narrator', ...(expires ? { expire_time: expires } : {}), sample_audio: { mime_type: 'audio/wav', data: wav.toString('base64') }, ...(input.method === 'POST' ? { usage } : {}) } as T
  }
  const provider = createGeminiAdvancedProvider({ apiKey: 'fixture-key', request, now: () => at.toISOString(), creationJournalRoot, protectedStore: store })
  const design = { creationModel: LITE, desiredName: 'Narrator', description: 'A steady documentary narrator.', previewText: '', candidateCount: 1 }
  await provider.design!.createCandidate(design)
  const path = join(creationJournalRoot, (await readdir(creationJournalRoot)).find(name => /^[a-f0-9]{64}\.json$/.test(name))!)
  const previous = await Bun.file(path).json()
  expect(previous.creationUsage).toEqual({ textTokens: 30, audioTokens: 8 })
  expect(previous.creationUsage.totalCost).toBeUndefined()
  previous.expiresAt = '2020-01-01T00:00:00Z'
  await Bun.write(path, JSON.stringify(previous))
  expect((await provider.design!.createCandidate(design)).previews[0]?.expiresAt).toBe(validUntil)
  expect(posts).toBe(1)
  expires = undefined
  expect((await provider.design!.createCandidate(design)).previews[0]?.expiresAt).toBeUndefined()
  expect((await Bun.file(path).json()).creationUsage).toEqual({ textTokens: 30, audioTokens: 8 })
  // A fresh GET also prevents an old journal-only guessed expiry blocking import.
  const journal = await Bun.file(path).json()
  journal.expiresAt = '2020-01-01T00:00:00Z'
  journal.accountScopeHash = providerAccountScopeHash('gemini', 'fixture-key')
  await Bun.write(path, JSON.stringify(journal))
  installMockFetch(() => jsonResponse(oldVoice))
  expect(await inspectGeminiVoiceImport('fixture-key', FLASH, 'voice_old', creationJournalRoot)).toMatchObject({ ownership: 'project', expiresAt: undefined })
})

test('native modality receipts require complete unambiguous schemas and reject malformed, conflicting, or unsupported counts', () => {
  expect(readGeminiTtsUsageCounts(usage)).toEqual({ textTokens: 30, audioTokens: 8 })
  expect(readGeminiTtsUsageCounts(batchAudio().usageMetadata)).toEqual({ textTokens: 30, audioTokens: 8 })
  expect(readGeminiTtsUsageCounts({ ...usage, ...batchAudio().usageMetadata })).toEqual({ textTokens: 30, audioTokens: 8 })
  const invalid: unknown[] = [undefined, [], { total_tokens: 38 }, { ...usage, output_tokens_by_modality: undefined },
    { ...usage, input_tokens_by_modality: [{ modality: 'text', tokens: 30 }, { modality: 'TEXT', tokens: 31 }] },
    { ...usage, input_tokens_by_modality: [{ modality: 'text', tokens: 30, tokenCount: 31 }] },
    { ...usage, input_tokens_by_modality: [{ modality: 'text', tokenCount: 30 }] },
    { ...usage, output_tokens_by_modality: [{ modality: 'audio', tokens: 8 }, { modality: 'image', tokens: 1 }] },
    { ...usage, output_tokens_by_modality: [{ modality: 'audio', tokens: 8 }, { modality: 'unknown', tokens: 0 }] },
    { ...usage, ...batchAudio().usageMetadata, candidatesTokensDetails: [{ modality: 'AUDIO', tokenCount: 9 }] },
    { ...usage, total_input_tokens: 31 }, { ...usage, total_tokens: 39 }, { ...usage, total_cached_tokens: 1 },
    { ...usage, cached_tokens_by_modality: [{ modality: 'text', tokens: 1 }] }]
  for (const tokens of [NaN, Infinity, -1, .5]) invalid.push({ ...usage, output_tokens_by_modality: [{ modality: 'audio', tokens }] })
  for (const receipt of invalid) expect(reconcileGeminiTtsUsage(LITE, 'unary', receipt, at, at)).toBeUndefined()
})

test('persisted provider-count valuations reject forged costs, model rates, schedule modes and incomplete metadata while retaining valid historical values', () => {
  const recorded = reconcileGeminiTtsUsage(LITE, 'unary', usage, at, at)!
  const historical = { rateIdentity: recorded.rateIdentity, executionMode: recorded.executionMode, observedTextTokens: 30, observedAudioTokens: 8, totalCost: .0063 }
  expect(readGeminiTtsValuation(LITE, historical)?.totalCost).toBe(.0063)
  const metadata: Step4Metadata = { ttsService: 'gemini', ttsModel: LITE, processingTime: 1, audioFileName: 'tone.wav', audioFileSize: wav.length, chunkCount: 1, geminiTtsUsageComplete: true, geminiTtsUsage: [recorded] }
  const actual = (value: unknown, chunkCount = 1) => computeActualCosts({ ttsCharacterCount: 120, step4: [{ ...metadata, chunkCount, geminiTtsUsage: [value] as Step4Metadata['geminiTtsUsage'] }] }).steps[0]!
  expect(actual(recorded)).toMatchObject({ costSource: 'provider_usage', cost: .0063, pricingNote: expect.stringContaining('Not invoice-reconciled') })
  for (const forged of [{ ...recorded, totalCost: 0 }, { ...recorded, totalCost: NaN }, { ...recorded, totalCost: .001 },
    { ...recorded, outputCostPer1MAudioTokensCents: 900 }, { ...recorded, executionMode: 'batch' },
    { ...recorded, rateIdentity: 'gemini-tts-2027-01-01-standard' }, { ...recorded, observedAudioTokens: -1 }]) {
    expect(readGeminiTtsValuation(LITE, forged)).toBeUndefined()
    expect(actual(forged).costSource).toBe('heuristic')
    expect(Number.isFinite(actual(forged).cost)).toBe(true)
  }
  expect(readGeminiTtsValuation(FLASH, recorded)).toBeUndefined()
  expect(actual(recorded, 2).costSource).toBe('heuristic')
})

test('Batch rate reservation covers the documented 48-hour expiry window; cross-boundary count valuation stays a local UTC pricing policy', () => {
  for (const [model, output] of [[FLASH, 900], [LITE, 600]] as const) {
    expect(estimateGeminiTtsCost(model, 120, 'batch', new Date('2026-12-29T23:59:59Z'), 1).rateIdentity).toBe('gemini-tts-2026-09-22-batch')
    const crossing = estimateGeminiTtsCost(model, 120, 'batch', new Date('2026-12-30T12:00:00Z'), 1)
    expect(crossing).toMatchObject({ rateIdentity: 'gemini-tts-2027-01-01-batch', inputCostPer1MTokensCents: 50, outputCostPer1MAudioTokensCents: output })
    expect(crossing.authorizationBoundCents).toBeCloseTo((8192 * 50 + 16384 * output) / 1e6, 10)
    const valuation = reconcileGeminiTtsUsage(model, 'unary', usage, new Date('2026-12-31T23:59:59Z'), new Date('2027-01-01T00:00:00Z'))!
    expect(valuation.totalCost).toBeCloseTo((30 * 100 + 8 * output * 2) / 1e6, 10)
    expect(valuation.rateIdentity).toBe('gemini-tts-2027-01-01-standard')
  }
  expect(() => geminiTtsRates(LITE, 'unary', new Date('invalid'))).toThrow('pricing mode or time')
  expect(reconcileGeminiTtsUsage(LITE, 'unary', usage, new Date('invalid'), at)).toBeUndefined()
})
