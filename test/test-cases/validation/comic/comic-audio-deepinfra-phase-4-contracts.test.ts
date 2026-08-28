import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { TtsTarget, VoiceReferenceManifest } from '~/types'
import { canonicalTargetKey } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { runDeepinfraTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/run-deepinfra-tts'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildTargetExecution } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { createResourceGate } from '~/utils/resource-gate'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { buildApprovedVoiceEntry, buildComicAudioPhaseFixture, runMockComicSoundscape } from './comic-audio-phase-fixture'

const DEEPINFRA_MODELS = [
  'ResembleAI/chatterbox-turbo',
  'XiaomiMiMo/MiMo-V2.5-tts',
  'XiaomiMiMo/MiMo-V2.5-tts-voicedesign',
  'Qwen/Qwen3-TTS',
  'Qwen/Qwen3-TTS-VoiceDesign',
] as const
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['DEEPINFRA_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-deepinfra-soundscape-' })

const voiceEntry = (subjectKey: string, resourceId: string, providerModel: typeof DEEPINFRA_MODELS[number]) => buildApprovedVoiceEntry({
  subjectKey,
  resourceId,
  provider: 'deepinfra',
  providerModel,
  settingsSchema: 'deepinfra.tts.phase-4-v2',
})

const fixture = async (root: string, providerModel: typeof DEEPINFRA_MODELS[number] = 'ResembleAI/chatterbox-turbo') => {
  return await buildComicAudioPhaseFixture(root, [voiceEntry('navigator', 'Vivian', providerModel), voiceEntry('pilot', 'Ryan', providerModel)])
}

describe('ADR-017 Phase 4E DeepInfra soundscape acceptance', () => {
  test('keeps every DeepInfra dialogue model separate from ElevenLabs action and ambience routing', async () => {
    const root = await tempDirs.make()
    let chatterboxSnapshot: VoiceReferenceManifest | undefined
    let chatterboxDialoguePlan = undefined as Awaited<ReturnType<typeof fixture>>['dialoguePlan'] | undefined
    let chatterboxSoundscapePlan = undefined as Awaited<ReturnType<typeof fixture>>['soundscapePlan'] | undefined
    for (const model of DEEPINFRA_MODELS) {
      const { dialoguePlan, soundscapePlan, snapshot } = await fixture(root, model)
      if (model === 'ResembleAI/chatterbox-turbo') {
        chatterboxSnapshot = snapshot
        chatterboxDialoguePlan = dialoguePlan
        chatterboxSoundscapePlan = soundscapePlan
      }
      const target: TtsTarget = { service: 'deepinfra', model, run: async () => { throw new Error('provider must not run during planning') } }
      const execution = buildTargetExecution({ target, baseOptions: {}, snapshot, dialoguePlan, mode: 'segmented', deliveryPolicy: 'best-effort', sampleRate: 48000, channels: 2, codec: 'pcm_s24le', resourceGate: createResourceGate({ capacity: 1 }) })
      expect(execution.target).toMatchObject({ service: 'deepinfra', model, operation: 'comic-audio', multiSpeakerStrategy: 'segment-and-concat' })
      expect(() => resolveSoundEffectTarget(`deepinfra=${model}`)).toThrow(/Unsupported sound-effect provider deepinfra/)
      const readinessPlan = planCurrentTtsReadiness({ target: execution.target, sourceText: execution.sourceText, ttsOptions: execution.options, comicContext: execution.context })
      expect(readinessPlan.strategy).toBe('segmented')
      expect(readinessPlan.plannedCost).toBeDefined()
    }

    process.env['DEEPINFRA_API_KEY'] = 'deepinfra-fixture-key'
    const execution = buildTargetExecution({
      target: { service: 'deepinfra', model: 'ResembleAI/chatterbox-turbo', run: async () => { throw new Error('provider must not run during readiness') } },
      baseOptions: {}, snapshot: chatterboxSnapshot!, dialoguePlan: chatterboxDialoguePlan!, mode: 'segmented', deliveryPolicy: 'best-effort', sampleRate: 48000, channels: 2, codec: 'pcm_s24le', resourceGate: createResourceGate({ capacity: 1 })
    })
    const calls = installMockFetch(() => { throw new Error('DeepInfra readiness must not call the provider') })
    const readiness = await validateTtsTargetsForExecution([execution.target])
    expect(readiness).toEqual([expect.objectContaining({ targetKey: execution.target.targetKey, status: 'ready' })])
    expect(calls).toHaveLength(0)

    const renderPlan = createSoundEffectRenderPlan({ plan: chatterboxSoundscapePlan!, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2', { outputFormat: 'wav_48000' }) })
    expect(renderPlan.target).toMatchObject({ provider: 'elevenlabs', model: 'eleven_text_to_sound_v2', targetKey: canonicalTargetKey('sound-effect-generation', 'elevenlabs', 'eleven_text_to_sound_v2', 'hosted-api') })
    expect(renderPlan.tasks.map(task => ({ kind: task.kind, loop: task.loop }))).toEqual([{ kind: 'action-sfx', loop: false }, { kind: 'ambience', loop: true }])
  })

  test('publishes a local four-bus mix from mocked DeepInfra dialogue and ElevenLabs SFX', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan } = await fixture(root)
    const calls = installMockFetch(call => {
      if (!call.url.endsWith('/v1/inference/ResembleAI/chatterbox-turbo')) throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
      return new Response(createMockWavBytes({ samples: 2400 }), { headers: { 'content-type': 'audio/wav', 'x-request-id': 'deepinfra-fixture' } })
    })
    const result = await runDeepinfraTts('Ready?', join(root, 'deepinfra'), { model: 'ResembleAI/chatterbox-turbo', apiKey: 'fixture-key', voiceId: 'Ryan' })
    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.bodyJson).toMatchObject({ text: 'Ready?', response_format: 'wav', voice_id: 'Ryan' })

    await mkdir(join(root, 'audio', 'final'), { recursive: true })
    const { soundscapeRun, sfxCalls } = await runMockComicSoundscape({
      rootDir: root,
      plan: soundscapePlan,
      dialoguePlan,
      target: { service: 'deepinfra', model: 'ResembleAI/chatterbox-turbo', transport: 'hosted-api' }
    })
    expect([0, 2]).toContain(sfxCalls())
    expect(soundscapeRun?.binding.targetKey).toBe(canonicalTargetKey('comic-audio', 'deepinfra', 'ResembleAI/chatterbox-turbo', 'hosted-api'))
    expect(soundscapeRun?.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
    expect(await Bun.file(join(root, soundscapeRun?.ref.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.mix.master.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.binding.reportedOutputPath as string)).exists()).toBe(true)
  }, 20_000)
})
