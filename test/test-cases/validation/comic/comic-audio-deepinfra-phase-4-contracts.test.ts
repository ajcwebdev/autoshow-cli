import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { TtsTarget, VoiceReferenceManifest } from '~/types'
import { canonicalTargetKey, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { runDeepinfraTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/run-deepinfra-tts'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { createApprovedVoiceSnapshotEntry } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { buildTargetExecution } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { createLocalSilentDialogueRun, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createResourceGate } from '~/utils/resource-gate'
import { createMockWavBytes, createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { buildComicAudioPhaseFixture, COMIC_AUDIO_PHASE_CREATED_AT as CREATED_AT, COMIC_AUDIO_PHASE_HASH_A as HASH_A, COMIC_AUDIO_PHASE_HASH_B as HASH_B } from './comic-audio-phase-fixture'

const DEEPINFRA_MODELS = [
  'ResembleAI/chatterbox-turbo',
  'XiaomiMiMo/MiMo-V2.5-tts',
  'XiaomiMiMo/MiMo-V2.5-tts-voicedesign',
  'Qwen/Qwen3-TTS',
  'Qwen/Qwen3-TTS-VoiceDesign',
] as const
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['DEEPINFRA_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-deepinfra-soundscape-' })

const voiceEntry = (subjectKey: string, resourceId: string, providerModel: typeof DEEPINFRA_MODELS[number]) => createApprovedVoiceSnapshotEntry({
  registrationId: `registration-${subjectKey}`,
  generationId: hashCanonicalTtsValue({ subjectKey, generation: 1 }),
  subjectKey,
  profileKey: 'default',
  provider: 'deepinfra',
  providerVoice: { kind: 'remote-resource', provider: 'deepinfra', resourceId, namespace: 'provider', origin: 'provider-stock', ownership: 'provider', deletion: { state: 'provider-managed', checkedAt: CREATED_AT } },
  providerModel,
  settingsSchema: 'deepinfra.tts.phase-4-v2',
  synthesisSettings: { schemaVersion: 1, settingsSchema: 'deepinfra.tts.phase-4-v2', values: {} },
  sanitizedProviderMetadata: {},
  briefHash: HASH_A,
  auditionManifestHash: HASH_B,
  approvedAudition: { storeId: 'voice-store', assetId: `audition-${subjectKey}`, sha256: HASH_A },
  provenanceRef: `provenance:${subjectKey}`,
  capabilityFixtureHash: HASH_B,
  registrationStateAtSnapshot: 'approved-ready',
  externallyMutable: true,
  registrationApprovedAt: CREATED_AT,
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
    const dialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'deepinfra', model: 'ResembleAI/chatterbox-turbo', transport: 'hosted-api' } })
    const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2', { outputFormat: 'wav_48000' }) })
    let sfxCalls = 0
    const adapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => {
      sfxCalls++
      return { status: 200, headers: { 'content-type': 'audio/wav', 'request-id': `sfx-${sfxCalls}` }, body: createSyntheticWavBytes({ durationSeconds: 0.5, amplitude: 0.2, frequencyHz: 220 + sfxCalls * 110 }) }
    }, now: () => CREATED_AT })
    const mixed = await runComicSoundscape({ rootDir: root, plan: soundscapePlan, renderPlan, dialoguePlan, dialogueRuns: [dialogue.binding], adapter, concurrency: 2, hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: 'immediate' }) })
    const soundscapeRun = mixed.soundscapeRuns[0]
    expect([0, 2]).toContain(sfxCalls)
    expect(soundscapeRun?.binding.targetKey).toBe(canonicalTargetKey('comic-audio', 'deepinfra', 'ResembleAI/chatterbox-turbo', 'hosted-api'))
    expect(soundscapeRun?.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
    expect(await Bun.file(join(root, soundscapeRun?.ref.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.mix.master.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.binding.reportedOutputPath as string)).exists()).toBe(true)
  }, 20_000)
})
