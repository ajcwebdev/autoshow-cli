import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { planCurrentTtsReadiness } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { planTtsChunks } from '~/cli/commands/audio/tts/tts-utils/tts-chunk-planner'
import { TTS_CHUNK_CHARACTER_LIMITS } from '~/cli/commands/audio/tts/tts-utils/tts-chunking'
import { inspectSoundscapeAudio } from '~/cli/commands/audio/tts/soundscape/soundscape-audio'
import type { CanonicalAudioProviderProjection, MockFetchCall, PipelineProviderState, TtsOptions } from '~/types'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../../test-utils/value-assertions'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY'],
  tempPrefix: 'autoshow-tts-delivery-render-'
})

const OPENAI_MODEL = 'gpt-4o-mini-tts-2025-12-15'
const PROVIDER_SAMPLE_RATE = 24000
const paragraph = (seed: string): string => Array.from({ length: 12 }, (_, index) => `${seed} sentence number ${index + 1} keeps the narration moving at an even pace.`).join(' ')
const LONG_TEXT = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map(paragraph).join('\n\n')

const readInput = (call: MockFetchCall): string => String(call.bodyJson?.['input'] ?? '')

const openAiOptions = (deliveryFlags: Record<string, unknown> | undefined): TtsOptions => ({
  ...buildOptsFromFlags({ 'openai-tts': OPENAI_MODEL }),
  ...(deliveryFlags ? resolveTtsDeliveryOptions(deliveryFlags) : {}),
})

const openAiTarget = (options: TtsOptions) =>
  requireDefined(collectTtsTargets(options).find((candidate) => candidate.service === 'openai'), 'OpenAI TTS target')

const installProviderAudio = () => installMockFetch(() => new Response(
  createSyntheticWavBytes({ sampleRate: PROVIDER_SAMPLE_RATE, durationSeconds: 1, frequencyHz: 440, amplitude: 0.4 }),
  { status: 200, headers: { 'content-type': 'audio/wav' } }
))

const readSlotHashes = async (outputDir: string, projection: CanonicalAudioProviderProjection): Promise<string[]> => {
  const archive = requireDefined(projection.archive, 'compact TTS archive')
  const render = await Bun.file(join(outputDir, archive.renderRef.path)).json() as { slots: Array<{ slotHash: string }> }
  return render.slots.map((slot) => slot.slotHash)
}

describe('TTS delivery render contracts', () => {
  test('implicit and explicit smart chunking produce the same render identity', () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const baseline = openAiOptions(undefined)
    const target = openAiTarget(baseline)
    const legacy = planCurrentTtsReadiness({ target, sourceText: LONG_TEXT, ttsOptions: baseline })
    const explicitLegacy = planCurrentTtsReadiness({ target, sourceText: LONG_TEXT, ttsOptions: { ...baseline, ttsChunking: { boundary: 'smart' } } })
    expect(explicitLegacy.renderPlanId).toBe(legacy.renderPlanId)
    expect(explicitLegacy.renderIdentity).toBe(legacy.renderIdentity)
    expect(legacy.renderPlan.requestedOutput).toEqual({ codec: 'pcm_s16le', container: 'wav', sampleRate: 16000, channels: 1 })
  })

  test('a delivery profile creates a new render identity and records itself on the plan', () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const baseline = openAiOptions(undefined)
    const target = openAiTarget(baseline)
    const legacy = planCurrentTtsReadiness({ target, sourceText: LONG_TEXT, ttsOptions: { ...baseline, ttsChunking: { boundary: 'smart' } } })
    const native = planCurrentTtsReadiness({ target, sourceText: LONG_TEXT, ttsOptions: openAiOptions({}) })
    expect(native.renderIdentity).not.toBe(legacy.renderIdentity)
    expect(native.renderPlan.requestedOutput.delivery?.preset).toBe('native')
    expect(native.renderPlan.requestedOutput.sampleRate).toBeUndefined()
  })

  test('transport: smart chunking dispatches balanced paragraph-aligned chunks within the provider limit', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const calls = installProviderAudio()
    const options = openAiOptions({})
    const outputDir = await tempDirs.make()
    await runTtsForTargets(LONG_TEXT, outputDir, options, [openAiTarget(options)])
    const planned = planTtsChunks(LONG_TEXT, TTS_CHUNK_CHARACTER_LIMITS.openai, { boundary: 'smart' })
    expect(calls.map(readInput).sort()).toEqual(planned.map((chunk) => chunk.text).sort())
    expect(planned.length).toBeGreaterThan(1)
    expect(planned.slice(0, -1).every((chunk) => chunk.boundaryAfter === 'paragraph')).toBe(true)
    expect(planned.every((chunk) => chunk.text.length <= TTS_CHUNK_CHARACTER_LIMITS.openai)).toBe(true)
  }, 30_000)

  test('transport: long dialogue turns dispatch every planned segment once', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const calls = installProviderAudio()
    const options = { ...openAiOptions({}), ttsSpeakers: ['Narrator=alloy'], ttsDialogueFormat: 'labeled' as const }
    const spoken = LONG_TEXT.replace(/\n+/g, ' ')
    const text = 'Narrator: ' + spoken
    const target = openAiTarget(options)
    const expected = planTtsChunks(spoken, 2000).map(chunk => chunk.text)
    await runTtsForTargets(text, await tempDirs.make(), options, [target])
    expect(expected.length).toBeGreaterThan(1)
    expect(calls.map(readInput).sort()).toEqual(expected.sort())
  }, 20_000)

  test('artifact-integrity: the default delivery keeps the provider sample rate and records seam pauses in the transform ledger', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    installProviderAudio()
    const options = openAiOptions({})
    const outputDir = await tempDirs.make()
    const result = await runTtsForTargets(LONG_TEXT, outputDir, options, [openAiTarget(options)])
    const observed = await inspectSoundscapeAudio(requireDefined(result.audioPaths[0], 'delivered audio path'))
    expect(observed.format.sampleRate).toBe(PROVIDER_SAMPLE_RATE)
    expect(observed.format.channels).toBe(1)
    const chunkCount = planTtsChunks(LONG_TEXT, TTS_CHUNK_CHARACTER_LIMITS.openai, { boundary: 'smart' }).length
    // Every provider chunk retains its full duration, including edge silence.
    const expectedMs = chunkCount * 1000
    expect(Math.abs(observed.durationMs - expectedMs)).toBeLessThanOrEqual(chunkCount * 25)
    const ledgerPath = requireDefined([...new Bun.Glob('providers/**/audio-run/transform-ledger.json').scanSync(outputDir)][0], 'transform ledger')
    const ledger = await Bun.file(join(outputDir, ledgerPath)).json() as { operations: Array<{ kind: string, finalRangeMs: { start: number, end: number } }> }
    const pauses = ledger.operations.filter((operation) => operation.kind === 'pause')
    expect(pauses.map((pause) => pause.finalRangeMs.end - pause.finalRangeMs.start)).toEqual([])
  }, 30_000)

  test('artifact-integrity: legacy-16k still produces 16 kHz mono output with no inserted pauses', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    installProviderAudio()
    const options = openAiOptions({ 'tts-audio-profile': 'legacy-16k' })
    expect(options.ttsDelivery).toBeUndefined()
    const outputDir = await tempDirs.make()
    const result = await runTtsForTargets(LONG_TEXT, outputDir, options, [openAiTarget(options)])
    const observed = await inspectSoundscapeAudio(requireDefined(result.audioPaths[0], 'delivered audio path'))
    expect(observed.format).toEqual({ codec: 'pcm_s16le', container: 'wav', sampleRate: 16000, channels: 1 })
  }, 30_000)

  test('transport: re-mastering purchased audio under a new delivery profile makes zero provider requests', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const calls = installProviderAudio()
    const outputDir = await tempDirs.make()
    const legacyOptions = openAiOptions({ 'tts-audio-profile': 'legacy-16k' })
    let retained: PipelineProviderState | undefined
    const first = await runTtsForTargets(LONG_TEXT, outputDir, legacyOptions, [openAiTarget(legacyOptions)], {
      beforeDispatch: async () => {},
      onProviderState: async (state) => { retained = state },
    })
    const purchasedRequests = calls.length
    expect(purchasedRequests).toBeGreaterThan(1)
    const firstProjection = requireDefined(first.metadata[0]?.ttsAudio, 'first TTS projection') as CanonicalAudioProviderProjection

    const audiobookOptions = openAiOptions({ 'tts-audio-profile': 'audiobook' })
    const second = await runTtsForTargets(LONG_TEXT, outputDir, audiobookOptions, [openAiTarget(audiobookOptions)], {
      retainedProviderStates: [requireDefined(retained, 'retained legacy provider state')],
      recoveryRootDir: outputDir,
      beforeDispatch: async () => {},
      onProviderState: async () => {},
    })
    expect(calls.length).toBe(purchasedRequests)
    const secondProjection = requireDefined(second.metadata[0]?.ttsAudio, 'second TTS projection') as CanonicalAudioProviderProjection
    expect(await readSlotHashes(outputDir, secondProjection)).toEqual(await readSlotHashes(outputDir, firstProjection))
    const observed = await inspectSoundscapeAudio(requireDefined(second.audioPaths[0], 're-mastered audio path'))
    expect(observed.format.sampleRate).toBe(44100)
  }, 60_000)
})
