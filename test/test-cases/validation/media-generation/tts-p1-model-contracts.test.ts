import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { createManifest, createManifestItem, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { canonicalFileInput, findRecoverableCompletedState, resumeTarget } from '../resume-manifests/tts-resume-fixtures'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { PipelineProviderState, TtsTarget } from '~/types'
import { validateCartesiaTtsModel, validateCartesiaTtsVoice, validateInworldTtsModel, validateInworldTtsVoice } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { getTtsCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { buildCartesiaTtsRequestBody, cartesiaTtsRequestControls, validateCartesiaTtsLanguage } from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/cartesia-tts-request'
import { buildInworldTtsRequestBody, inworldTtsRequestControls, resolveInworldTtsApiModelId } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-request'
import { buildInworldWebSocketRequests } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-websocket'
import { collectCartesiaTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/cartesia-tts-targets'
import { collectInworldTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-targets'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'
import { normalizeTtsTurnControls } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-invocation-controls'
import { validateTtsProviderOptions } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-provider-option-validation'
import { buildProviderSerializerDescriptor } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/provider-serializer-registry'
import { computePaidSpeechSlotHash, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { createMockWavBase64 } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: ['CARTESIA_API_KEY', 'INWORLD_API_KEY'], tempPrefix: 'autoshow-tts-p1-' })
const cartesiaModels = ['sonic-3.5-2026-05-04', 'sonic-3.6-2026-08-27'] as const
const inworldModels = ['realtime-tts-2', 'realtime-tts-2-flash'] as const

const targetFor = (service: 'cartesia' | 'inworld', model: string): TtsTarget => {
  const selection = createTtsTargetSelection(service === 'cartesia' ? { cartesiaTtsModels: [model] } : { inworldTtsModels: [model] })
  return { ...(service === 'cartesia' ? collectCartesiaTtsTargets(selection) : collectInworldTtsTargets(selection))[0]!, operation: 'tts-synthesis', transport: 'hosted-api', targetKey: canonicalTargetKey('tts-synthesis', service, model, 'hosted-api') }
}

describe('P1 TTS models', () => {
  test('accepts pinned and Flash selectors while retaining old mappings and independent prices', () => {
    for (const model of cartesiaModels) expect(validateCartesiaTtsModel(model)).toBe(model)
    for (const model of inworldModels) expect(validateInworldTtsModel(model)).toBe(model)
    expect(() => validateCartesiaTtsModel('sonic-preview')).toThrow()
    expect(() => validateCartesiaTtsModel('sonic-3.6')).toThrow()
    expect(() => validateInworldTtsModel('inworld-tts-2-flash')).toThrow()
    expect(resolveInworldTtsApiModelId('realtime-tts-2')).toBe('inworld-tts-2')
    expect(resolveInworldTtsApiModelId('realtime-tts-2-flash')).toBe('inworld-tts-2-flash')
    expect(getTtsCost('cartesia', cartesiaModels[1]) * 1000).toBeCloseTo(299 / 8 * 100)
    expect(getTtsCost('inworld', inworldModels[1]) * 1000).toBe(1500)
    expect(getTtsCost('inworld', inworldModels[0]) * 1000).toBe(2500)
  })

  test('expands new models and preserves bare-provider defaults', () => {
    const all = buildOptsFromFlags({ 'all-tts': true })
    expect(all.cartesiaTtsModels).toEqual([...cartesiaModels])
    expect(all.inworldTtsModels).toEqual([...inworldModels])
    const defaults = buildOptsFromFlags({ 'cartesia-tts': true, 'inworld-tts': true })
    expect(defaults.cartesiaTtsModels).toEqual([cartesiaModels[0]])
    expect(defaults.inworldTtsModels).toEqual([inworldModels[0]])
  })

  test('validates language, voice and unsupported format controls without network calls', () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected HTTP') })
    for (const validate of [validateCartesiaTtsVoice, validateInworldTtsVoice]) expect(() => validate(' ')).toThrow()
    for (const lang of ['or', 'ur', 'en']) expect(validateCartesiaTtsLanguage(cartesiaModels[1], lang)).toBe(lang)
    for (const lang of ['xx', 'en-GB']) expect(() => validateCartesiaTtsLanguage(cartesiaModels[1], lang)).toThrow()
    for (const service of ['cartesia', 'inworld'] as const) {
      expect(() => normalizeTtsTurnControls({ 'dialogue-turn-001': { [service]: { outputFormat: 'flac' } } })).toThrow()
    }
    expect(() => buildInworldTtsRequestBody({ model: inworldModels[1], text: 'a'.repeat(2001), voiceId: 'Dennis' })).toThrow()
    expect(() => buildInworldTtsRequestBody({ model: inworldModels[1], text: 'Hello', voiceId: ' ' })).toThrow()
    expect(() => buildInworldTtsRequestBody({ model: inworldModels[1], text: 'Hello', voiceId: 'Dennis', steeringPrompt: 'Warm' })).toThrow('does not support steering')
    expect(() => validateTtsProviderOptions(createTtsTargetSelection({ inworldTtsModels: [inworldModels[1]], inworldTtsInstructions: 'Warm' }))).toThrow()
    expect(calls).toHaveLength(0)
  })

  test('preserves old wire shapes and maps Flash WebSocket synthesis', () => {
    expect(buildCartesiaTtsRequestBody(cartesiaModels[0], 'Hello', 'voice-id', 'en')).toMatchObject({ voice: { mode: 'id', id: 'voice-id' }, model_id: cartesiaModels[0], language: 'en' })
    expect(cartesiaTtsRequestControls(cartesiaModels[0])).toEqual({ outputFormat: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 }, version: '2026-03-01' })
    expect(inworldTtsRequestControls(inworldModels[0])).toEqual({ format: 'wav', timestampType: 'WORD', audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 } })
    expect(buildInworldWebSocketRequests({ model: inworldModels[1], text: 'Hello', voiceId: 'Dennis', contextId: 'ctx' })[0]).toMatchObject({ create: { modelId: 'inworld-tts-2-flash', voiceId: 'Dennis' } })
  })

  for (const [service, models] of [['cartesia', cartesiaModels], ['inworld', inworldModels]] as const) {
    test(`${service} model changes produce distinct paid segment identities`, () => {
      const hashes = models.map(model => {
        const descriptor = buildProviderSerializerDescriptor(targetFor(service, model), 'same-voice', {})
        return computePaidSpeechSlotHash({ dialoguePlanId: 'same-plan', turnIds: ['dialogue-turn-001'], providerText: 'Same text', serializedVoiceHash: 'same-voice', requestControlsHash: hashCanonicalTtsValue(descriptor.controls), outputFormat: 'wav', endpointKind: descriptor.endpointKind, serializerVersion: descriptor.serializerVersion })
      })
      expect(hashes[0]).not.toBe(hashes[1])
    })

    test(`${service} new model synthesizes and resumes completed audio without redispatch`, async () => {
      process.env['CARTESIA_API_KEY'] = 'local-test-key'
      process.env['INWORLD_API_KEY'] = 'local-test-key'
      const root = await dirs.make()
      const text = 'A synthetic narration for local resume verification.'
      const sourcePath = join(root, 'source.txt')
      await Bun.write(sourcePath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(sourcePath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = targetFor(service, models[1])
      const calls = installMockFetch(call => {
        expect(call.url).toBe(service === 'cartesia' ? 'https://api.cartesia.ai/tts/bytes' : 'https://api.inworld.ai/tts/v1/voice')
        return service === 'cartesia' ? new Response(Buffer.from(createMockWavBase64(), 'base64')) : Response.json({ audioContent: createMockWavBase64() })
      })
      const states: PipelineProviderState[] = []
      const result = await runTtsForTargets(text, root, {}, [target], { sourceIdentity, dialoguePlan, onProviderState: async state => { states.push(structuredClone(state)) } })
      expect(calls).toHaveLength(1)
      expect(result.metadata[0]?.ttsModel).toBe(models[1])
      if (service === 'cartesia') {
        expect(calls[0]?.headers.get('cartesia-version')).toBe('2026-08-14')
        expect(calls[0]?.bodyJson).toMatchObject({ model_id: models[1], voice: 'f786b574-daa5-4673-aa0c-cbe3e8534c02', output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 24000 } })
      } else {
        expect(calls[0]?.bodyJson).toMatchObject({ modelId: 'inworld-tts-2-flash', voiceId: 'Dennis', audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 }, timestampType: 'WORD' })
        expect(calls[0]?.bodyJson).not.toHaveProperty('instruction')
      }
      const retained = bindTtsDialoguePlanArtifact(await findRecoverableCompletedState(root, states), await materializeTtsDialoguePlanArtifact(root, dialoguePlan))
      const before = await Bun.file(result.audioPaths[0]!).arrayBuffer()
      await writeManifest(root, createManifest('tts', 'single', [createManifestItem(root, { input: canonicalFileInput(sourceIdentity), status: 'incomplete', metadata: { tts: [] }, providers: [retained] })]))
      await resumeGenerationTarget(resumeTarget(root), { ...ttsResumeConfig, collectTargets: () => [target] }, {})
      expect(calls).toHaveLength(1)
      expect(await Bun.file(result.audioPaths[0]!).arrayBuffer()).toEqual(before)
    }, 15_000)

    test(`${service} resumes an interrupted two-chunk render and preserves completed audio`, async () => {
      process.env['CARTESIA_API_KEY'] = 'local-test-key'
      process.env['INWORLD_API_KEY'] = 'local-test-key'
      const root = await dirs.make()
      const text = `${'a'.repeat(2000)} ${'b'.repeat(100)}`
      const sourcePath = join(root, 'source.txt')
      await Bun.write(sourcePath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(sourcePath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = targetFor(service, models[1])
      let attempt = 0
      const calls = installMockFetch(() => {
        attempt += 1
        // A successful HTTP admission with missing audio is ambiguous and must be reconciled.
        if (attempt === 2) return service === 'cartesia' ? new Response(new Uint8Array()) : Response.json({})
        return service === 'cartesia' ? new Response(Buffer.from(createMockWavBase64(), 'base64')) : Response.json({ audioContent: createMockWavBase64() })
      })
      const states: PipelineProviderState[] = []
      await expect(runTtsForTargets(text, root, { ttsChunkConcurrency: 1 }, [target], { sourceIdentity, dialoguePlan, onProviderState: async state => { states.push(structuredClone(state)) } })).rejects.toThrow()
      expect(calls).toHaveLength(2)
      const retained = bindTtsDialoguePlanArtifact(states.at(-1)!, await materializeTtsDialoguePlanArtifact(root, dialoguePlan))
      await writeManifest(root, createManifest('tts', 'single', [createManifestItem(root, { input: canonicalFileInput(sourceIdentity), status: 'failed', metadata: { tts: [] }, providers: [retained] })]))
      await ttsResumeConfig.runMissingTargets([target], text, root, { ttsAllowAmbiguousRedispatch: true, ttsChunkConcurrency: 1 }, { outputDir: root, runtimeOptions: { ttsAllowAmbiguousRedispatch: true }, targets: [target], existingEntries: [], currentManifestMetadata: {}, currentProviderStates: [retained] })
      expect(calls).toHaveLength(3)
      expect(calls[2]?.bodyJson?.[service === 'cartesia' ? 'transcript' : 'text']).toBe('b'.repeat(100))
    }, 15_000)

  }
})
