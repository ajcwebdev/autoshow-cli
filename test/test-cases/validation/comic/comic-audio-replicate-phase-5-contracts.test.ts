import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { TtsTarget } from '~/types'
import { canonicalTargetKey, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import {
  REPLICATE_KOKORO_MODEL_ID,
  REPLICATE_KOKORO_SERIALIZER_VERSION,
  REPLICATE_KOKORO_VERSION,
  runReplicateTts,
} from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-replicate/run-replicate-tts'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { createApprovedVoiceSnapshotEntry } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { buildTargetExecution } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { createLocalSilentDialogueRun, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createResourceGate } from '~/utils/resource-gate'
import { createMockWavBytes, createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle, unexpectedCall } from '../../../test-utils/rest-contract-helpers'
import { buildComicAudioPhaseFixture, COMIC_AUDIO_PHASE_CREATED_AT as CREATED_AT, COMIC_AUDIO_PHASE_HASH_A as HASH_A, COMIC_AUDIO_PHASE_HASH_B as HASH_B } from './comic-audio-phase-fixture'

const POLL_URL = 'https://api.replicate.com/v1/predictions/prediction-kokoro'
const OUTPUT_URL = 'https://replicate.delivery/kokoro-soundscape.wav'
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['REPLICATE_API_TOKEN', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-replicate-soundscape-' })

const voiceEntry = (subjectKey: string, resourceId: string) => createApprovedVoiceSnapshotEntry({
  registrationId: `registration-${subjectKey}`,
  generationId: hashCanonicalTtsValue({ subjectKey, generation: 1 }),
  subjectKey,
  profileKey: 'default',
  provider: 'replicate',
  providerVoice: { kind: 'remote-resource', provider: 'replicate', resourceId, namespace: 'provider', origin: 'provider-stock', ownership: 'provider', deletion: { state: 'provider-managed', checkedAt: CREATED_AT } },
  providerModel: REPLICATE_KOKORO_MODEL_ID,
  settingsSchema: REPLICATE_KOKORO_SERIALIZER_VERSION,
  synthesisSettings: { schemaVersion: 1, settingsSchema: REPLICATE_KOKORO_SERIALIZER_VERSION, values: {} },
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

const fixture = async (root: string) => {
  return await buildComicAudioPhaseFixture(root, [voiceEntry('navigator', 'af_bella'), voiceEntry('pilot', 'am_puck')])
}

describe('ADR-017 Phase 5E Replicate Kokoro soundscape acceptance', () => {
  test('keeps segmented Kokoro dialogue separate from ElevenLabs action and ambience routing', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan, snapshot } = await fixture(root)
    const target: TtsTarget = { service: 'replicate', model: REPLICATE_KOKORO_MODEL_ID, run: unexpectedCall('Replicate dispatch during planning') }
    const execution = buildTargetExecution({ target, baseOptions: {}, snapshot, dialoguePlan, mode: 'segmented', deliveryPolicy: 'best-effort', sampleRate: 48000, channels: 2, codec: 'pcm_s24le', resourceGate: createResourceGate({ capacity: 1 }) })
    expect(execution.target).toMatchObject({ service: 'replicate', model: REPLICATE_KOKORO_MODEL_ID, operation: 'comic-audio', multiSpeakerStrategy: 'segment-and-concat' })
    expect(() => resolveSoundEffectTarget(`replicate=${REPLICATE_KOKORO_MODEL_ID}`)).toThrow(/Unsupported Replicate sound-effect model jaaari\/kokoro-82m/)
    expect(resolveSoundEffectTarget('replicate=sepal/audiogen').model).toBe('sepal/audiogen')
    const readinessPlan = planCurrentTtsReadiness({ target: execution.target, sourceText: execution.sourceText, ttsOptions: execution.options, comicContext: execution.context })
    expect(readinessPlan.strategy).toBe('segmented')
    expect(readinessPlan.plannedCost).toBeDefined()

    process.env['REPLICATE_API_TOKEN'] = 'replicate-fixture-key'
    const calls = installMockFetch(() => { throw new Error('Replicate readiness must not call the provider') })
    const readiness = await validateTtsTargetsForExecution([execution.target])
    expect(readiness).toEqual([expect.objectContaining({ targetKey: execution.target.targetKey, status: 'ready' })])
    expect(calls).toHaveLength(0)

    const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2', { outputFormat: 'wav_48000' }) })
    expect(renderPlan.target).toMatchObject({ provider: 'elevenlabs', model: 'eleven_text_to_sound_v2', targetKey: canonicalTargetKey('sound-effect-generation', 'elevenlabs', 'eleven_text_to_sound_v2', 'hosted-api') })
    expect(renderPlan.tasks.map(task => ({ kind: task.kind, loop: task.loop }))).toEqual([{ kind: 'action-sfx', loop: false }, { kind: 'ambience', loop: true }])
  })

  test('publishes a local four-bus mix from mocked Kokoro dialogue and ElevenLabs SFX', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan } = await fixture(root)
    const calls = installMockFetch(call => {
      if (call.url.endsWith('/v1/predictions') && call.method === 'POST') {
        return Response.json({ id: 'prediction-kokoro', status: 'starting', urls: { get: POLL_URL } })
      }
      if (call.url === POLL_URL) {
        return Response.json({ id: 'prediction-kokoro', status: 'succeeded', output: OUTPUT_URL })
      }
      if (call.url === OUTPUT_URL) {
        return new Response(createMockWavBytes({ samples: 2400 }), { headers: { 'content-type': 'audio/wav' } })
      }
      throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
    })
    const result = await runReplicateTts('Ready?', join(root, 'replicate'), { model: REPLICATE_KOKORO_MODEL_ID, apiKey: 'fixture-key', voiceId: 'am_puck' })
    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(3)
    expect(calls[0]?.bodyJson).toMatchObject({
      version: `${REPLICATE_KOKORO_MODEL_ID}:${REPLICATE_KOKORO_VERSION}`,
      input: { text: 'Ready?', voice: 'am_puck' },
    })
    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.replicate.com/v1/predictions',
      `GET ${POLL_URL}`,
      `GET ${OUTPUT_URL}`,
    ])

    await mkdir(join(root, 'audio', 'final'), { recursive: true })
    const dialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'replicate', model: REPLICATE_KOKORO_MODEL_ID, transport: 'hosted-api' } })
    const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2', { outputFormat: 'wav_48000' }) })
    let sfxCalls = 0
    const adapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => {
      sfxCalls++
      return { status: 200, headers: { 'content-type': 'audio/wav', 'request-id': `sfx-${sfxCalls}` }, body: createSyntheticWavBytes({ durationSeconds: 0.5, amplitude: 0.2, frequencyHz: 220 + sfxCalls * 110 }) }
    }, now: () => CREATED_AT })
    const mixed = await runComicSoundscape({ rootDir: root, plan: soundscapePlan, renderPlan, dialoguePlan, dialogueRuns: [dialogue.binding], adapter, concurrency: 2, hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: 'immediate' }) })
    const soundscapeRun = mixed.soundscapeRuns[0]
    expect([0, 2]).toContain(sfxCalls)
    expect(soundscapeRun?.binding.targetKey).toBe(canonicalTargetKey('comic-audio', 'replicate', REPLICATE_KOKORO_MODEL_ID, 'hosted-api'))
    expect(soundscapeRun?.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
    expect(await Bun.file(join(root, soundscapeRun?.ref.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.mix.master.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.binding.reportedOutputPath as string)).exists()).toBe(true)
  }, 20_000)
})
