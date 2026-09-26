import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { createManifest, createManifestItem, writeManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { canonicalFileInput, findRecoverableCompletedState, resumeTarget } from '../../resume-manifests/tts-resume-fixtures'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { PipelineProviderState, TtsTarget } from '~/types'
import { validateInworldTtsModel, validateInworldTtsVoice } from '~/cli/commands/setup-and-utilities/models/tts-models'
import { getTtsCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { buildInworldTtsRequestBody, inworldTtsRequestControls, resolveInworldTtsApiModelId } from '~/cli/commands/audio/tts/tts-services/inworld/inworld-tts-request'
import { buildInworldWebSocketRequests } from '~/cli/commands/audio/tts/tts-services/inworld/inworld-tts-websocket'
import { collectInworldTtsTargets } from '~/cli/commands/audio/tts/tts-services/inworld/inworld-tts-targets'
import { createTtsTargetSelection } from '~/cli/commands/audio/tts/tts-targets/tts-target-selection'
import { normalizeTtsTurnControls } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { validateTtsProviderOptions } from '~/cli/commands/audio/tts/tts-targets/tts-provider-option-validation'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/audio/tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/audio/tts/script-to-audio/item-dialogue-plan-artifact'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { createMockWavBase64 } from '../../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: [ 'INWORLD_API_KEY'], tempPrefix: 'autoshow-tts-p1-' })
const inworldModels = ['realtime-tts-2'] as const

const targetFor = (service: 'inworld', model: string): TtsTarget => {
  const selection = createTtsTargetSelection({ inworldTtsModels: [model] })
  return { ...collectInworldTtsTargets(selection)[0]!, operation: 'tts-synthesis', transport: 'hosted-api', targetKey: canonicalTargetKey('tts-synthesis', service, model, 'hosted-api') }
}

describe('P1 TTS models', () => {
  test('accepts current model selectors with provider prices', () => {
    for (const model of inworldModels) expect(validateInworldTtsModel(model)).toBe(model)
    expect(() => validateInworldTtsModel('inworld-tts-2-flash')).toThrow()
    expect(resolveInworldTtsApiModelId('realtime-tts-2')).toBe('inworld-tts-2')
    expect(getTtsCost('inworld', inworldModels[0]) * 1000).toBe(2500)
  })

  test('expands new models and preserves bare-provider defaults', () => {
    const all = buildOptsFromFlags({ 'all-tts': true })
    expect(all.inworldTtsModels).toEqual([...inworldModels])
    const defaults = buildOptsFromFlags({  'inworld-tts': true })
    expect(defaults.inworldTtsModels).toEqual([inworldModels[0]])
  })

  test('validates language, voice and unsupported format controls without network calls', () => {
    const calls = installMockFetch(() => { throw new Error('Unexpected HTTP') })
    for (const validate of [ validateInworldTtsVoice]) expect(() => validate(' ')).toThrow()
    for (const service of [ 'inworld'] as const) {
      expect(() => normalizeTtsTurnControls({ 'dialogue-turn-001': { [service]: { outputFormat: 'flac' } } })).toThrow()
    }
    expect(() => buildInworldTtsRequestBody({ model: inworldModels[0], text: 'a'.repeat(2001), voiceId: 'Dennis' })).toThrow()
    expect(() => buildInworldTtsRequestBody({ model: inworldModels[0], text: 'Hello', voiceId: ' ' })).toThrow()
    expect(buildInworldTtsRequestBody({ model: inworldModels[0], text: 'Hello', voiceId: 'Dennis', steeringPrompt: 'Warm' })).toMatchObject({ instruction: 'Warm' })
    expect(() => validateTtsProviderOptions(createTtsTargetSelection({ inworldTtsModels: [inworldModels[0]], inworldTtsInstructions: 'Warm' }))).not.toThrow()
    expect(calls).toHaveLength(0)
  })

  test('maps Inworld WebSocket synthesis', () => {
    expect(inworldTtsRequestControls(inworldModels[0])).toEqual({ format: 'wav', timestampType: 'WORD', audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 } })
    expect(buildInworldWebSocketRequests({ model: inworldModels[0], text: 'Hello', voiceId: 'Dennis', contextId: 'ctx' })[0]).toMatchObject({ create: { modelId: 'inworld-tts-2', voiceId: 'Dennis' } })
  })

  for (const [service, models] of [ ['inworld', inworldModels]] as const) {
    test(`${service} new model synthesizes and resumes completed audio without redispatch`, async () => {
      process.env['INWORLD_API_KEY'] = 'local-test-key'
      const root = await dirs.make()
      const text = 'A synthetic narration for local resume verification.'
      const sourcePath = join(root, 'source.txt')
      await Bun.write(sourcePath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(sourcePath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = targetFor(service, models[models.length - 1]!)
      const calls = installMockFetch(call => {
        expect(call.url).toBe('https://api.inworld.ai/tts/v1/voice')
        return Response.json({ audioContent: createMockWavBase64() })
      })
      const states: PipelineProviderState[] = []
      const result = await runTtsForTargets(text, root, {}, [target], { sourceIdentity, dialoguePlan, onProviderState: async state => { states.push(structuredClone(state)) } })
      expect(calls).toHaveLength(1)
      expect(result.metadata[0]?.ttsModel).toBe(models[models.length - 1]!)
      {
        expect(calls[0]?.bodyJson).toMatchObject({ modelId: 'inworld-tts-2', voiceId: 'Dennis', audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 }, timestampType: 'WORD' })
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
      process.env['INWORLD_API_KEY'] = 'local-test-key'
      const root = await dirs.make()
      const text = `${'a'.repeat(2000)} ${'b'.repeat(100)}`
      const sourcePath = join(root, 'source.txt')
      await Bun.write(sourcePath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(sourcePath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = targetFor(service, models[models.length - 1]!)
      let attempt = 0
      const calls = installMockFetch(() => {
        attempt += 1
        if (attempt === 2) return Response.json({})
        return Response.json({ audioContent: createMockWavBase64() })
      })
      const states: PipelineProviderState[] = []
      await expect(runTtsForTargets(text, root, { ttsChunkConcurrency: 1 }, [target], { sourceIdentity, dialoguePlan, onProviderState: async state => { states.push(structuredClone(state)) } })).rejects.toThrow()
      expect(calls).toHaveLength(2)
      const retained = bindTtsDialoguePlanArtifact(states.at(-1)!, await materializeTtsDialoguePlanArtifact(root, dialoguePlan))
      await writeManifest(root, createManifest('tts', 'single', [createManifestItem(root, { input: canonicalFileInput(sourceIdentity), status: 'failed', metadata: { tts: [] }, providers: [retained] })]))
      await ttsResumeConfig.runMissingTargets([target], text, root, { ttsAllowAmbiguousRedispatch: true, ttsChunkConcurrency: 1 }, { outputDir: root, runtimeOptions: { ttsAllowAmbiguousRedispatch: true }, targets: [target], existingEntries: [], currentManifestMetadata: {}, currentProviderStates: [retained] })
      expect(calls).toHaveLength(3)
    }, 15_000)

  }
})
