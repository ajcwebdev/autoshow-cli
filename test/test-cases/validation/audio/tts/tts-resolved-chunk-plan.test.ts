import { expect, test } from 'bun:test'
import { buildPureCurrentTtsRenderPlan } from '~/cli/commands/audio/tts/script-to-audio/attempt-planning'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/audio/tts/script-to-audio/generic-dialogue-plan'
import { resolveTtsDeliverySeams } from '~/cli/commands/audio/tts/script-to-audio/tts-delivery-assembly'
import { ttsProviderSettings } from '~/cli/commands/audio/tts/script-to-audio/tts-provider-settings'
import { buildTtsEstimateForInput } from '~/cli/commands/audio/tts/tts-batch-estimates'
import { buildTtsBatchEstimateSummary } from '~/cli/commands/audio/tts/tts-batch-summary'
import { getTtsEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { planProviderTtsChunks } from '~/cli/commands/audio/tts/tts-utils/tts-provider-chunk-policy'
import { recordSharedTtsResumeOptions, restoreSharedTtsResumeOptions } from '~/cli/commands/audio/tts/tts-utils/tts-resume-options'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import type { PreparedTtsInput, TtsOptions, TtsTarget } from '~/types'

const model = 'gemini-3.8-flash-lite-tts'
const target: TtsTarget = { service: 'gemini', model, voice: 'Kore', run: async () => { throw Error('No dispatch authorized') } }
const paragraph = 'The telescope followed a distant star across the dark sky. '.repeat(12).trim()
const text = Array.from({ length: 6 }, () => paragraph).join('\n\n')

test('Gemini metadata budget, source offsets, paragraph seams, settings and timing use the resolved requests', async () => {
  const ttsOptions: TtsOptions = { geminiTtsInstructions: 'Speak calmly. '.repeat(200), ttsChunkConcurrency: 1, ...resolveTtsDeliveryOptions({}) }
  const sourceIdentity = createInlineTtsSourceIdentity(text)
  const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
  const options = { target, sourceText: text, sourceIdentity, dialoguePlan, ttsOptions }
  const plan = buildPureCurrentTtsRenderPlan(options)
  const slots = plan.planned.slots
  expect(slots.map(slot => slot.providerText)).toEqual(Array(6).fill(paragraph))
  const budget = Math.floor((8192 - 512 - Buffer.byteLength(JSON.stringify([{ text: '', speaker: 'NARRATOR', voice: 'Kore', style: ttsOptions.geminiTtsInstructions }]))) / 6)
  for (const slot of slots) {
    expect(slot.chunk?.effectiveMaxChars).toBe(budget)
    expect(text.slice(slot.chunk!.sourceStart, slot.chunk!.sourceEnd)).toBe(slot.providerText)
  }
  expect([...resolveTtsDeliverySeams(plan.planned, target, ttsOptions.ttsChunking).values()]).toEqual(['paragraph', 'paragraph', 'paragraph', 'paragraph', 'paragraph', 'end'])
  const settings = ttsProviderSettings(options, plan)
  expect(settings.local?.['chunking']).toMatchObject({ policyVersion: 'smart-v2', providerLimit: budget, effectiveMaxChars: budget, requestCount: 6 })
  const prepared: PreparedTtsInput = { inputPath: 'fixture.txt', manifestInputPath: 'fixture.txt', sourceBytes: new TextEncoder().encode(text), text, sourceIdentity, dialoguePlan, ttsCharacterCount: text.length, ttsTimingInputText: text, dialogueRequested: false }
  const estimate = await buildTtsEstimateForInput(prepared, ttsOptions, [target])
  expect(estimate.steps[0]).toMatchObject({ requestCount: 6, chunkLengths: Array(6).fill(paragraph.length) })
  const expectedChunkMs = paragraph.length / 1000 * getTtsEstimation('gemini', model).msPer1KChars
  expect(estimate.timing?.totalProcessingTimeMs).toBe(Math.round(expectedChunkMs * 6))
  expect(buildTtsBatchEstimateSummary([estimate], 1, 2, { preparedInputs: [prepared], targets: [target] }).estimatedWallTimeMs).toBe(Math.round(expectedChunkMs * 3))
})

test('provider budgets clamp overrides, protect notation and reject exhausted metadata before dispatch', () => {
  for (const provider of ['openai', 'elevenlabs', 'grok', 'inworld', 'soniox', 'gemini'] as const) {
    const selectedModel = provider === 'gemini' ? model : provider === 'elevenlabs' ? 'eleven_v3' : ''
    const chunks = planProviderTtsChunks({ provider, model: selectedModel, text: '🌍 [softly] A complete sentence. '.repeat(30), chunking: { boundary: 'smart', maxChars: 40 } })
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(40)
      expect(chunk.text.isWellFormed()).toBe(true)
      expect((chunk.text.match(/\[/g) ?? []).length).toBe((chunk.text.match(/\]/g) ?? []).length)
    }
  }
  expect(planProviderTtsChunks({ provider: 'soniox', model: '', text, chunking: { boundary: 'smart', maxChars: 5000 } }).every(chunk => chunk.effectiveMaxChars === 500)).toBe(true)
  expect(() => planProviderTtsChunks({ provider: 'gemini', model, text, style: 'x'.repeat(8192) })).toThrow('metadata')
  expect(() => planProviderTtsChunks({ provider: 'openai', model: '', text: '🌍🌍', chunking: { boundary: 'smart', maxChars: 1 } })).toThrow('Unicode')
})

test('shared resume options round-trip across providers, respect explicit overrides and migrate old snapshots', () => {
  const original = { ...resolveTtsDeliveryOptions({ 'tts-chunk-size': '400', 'tts-audio-profile': 'audiobook', 'tts-export-format': 'mp3' }), ttsTextPreflight: false }
  for (const provider of ['openai', 'elevenlabs', 'grok', 'inworld', 'soniox', 'gemini']) {
    const settings = { schemaVersion: 1 as const, settingsSchema: `${provider}.tts-synthesis.v1`, request: {}, local: { ttsResume: recordSharedTtsResumeOptions(original) } }
    const restored: TtsOptions = resolveTtsDeliveryOptions({})
    restoreSharedTtsResumeOptions(restored, settings)
    expect(restored).toMatchObject(original)
    const override: TtsOptions = resolveTtsDeliveryOptions({ 'tts-chunk-size': '200' })
    restoreSharedTtsResumeOptions(override, settings, new Set(['tts-chunk-size']))
    expect(override.ttsChunking).toEqual({ boundary: 'smart', maxChars: 200 })
  }
  for (const boundary of ['legacy', 'smart']) {
    const options: TtsOptions = {}
    restoreSharedTtsResumeOptions(options, { schemaVersion: 1, settingsSchema: 'openai.tts-synthesis.v1', request: {}, local: { chunking: { boundary, requestedMaxChars: 400 } } })
    expect(options.ttsChunking).toEqual({ boundary: 'smart', replay: boundary === 'legacy' ? 'legacy-v0' : 'smart-v1', maxChars: 400 })
  }
})

test('historical delivery profiles retain exact trim, clause and gap values on supported-provider resume', () => {
  const historical = { ...resolveTtsDeliveryOptions({}).ttsDelivery!, trimSilence: true, gapsMs: { paragraph: 750, turn: 750, sentence: 350, clause: 120 } }
  for (const provider of ['openai', 'elevenlabs', 'grok', 'inworld', 'soniox', 'gemini']) {
    for (const local of [{ delivery: historical }, { ttsResume: { ttsDelivery: historical } }]) {
      const settings = { schemaVersion: 1 as const, settingsSchema: `${provider}.tts-synthesis.v1`, request: {}, local }
      const options: TtsOptions = resolveTtsDeliveryOptions({})
      restoreSharedTtsResumeOptions(options, settings)
      expect(options.ttsDelivery).toEqual(historical)
      const explicit: TtsOptions = resolveTtsDeliveryOptions({ 'tts-paragraph-pause': '0' })
      restoreSharedTtsResumeOptions(explicit, settings, new Set(['tts-paragraph-pause']))
      expect(explicit.ttsDelivery?.gapsMs).toEqual({ paragraph: 0, turn: 0, sentence: 0, clause: 0 })
      expect(explicit.ttsDelivery?.trimSilence).toBe(false)
    }
  }
})
