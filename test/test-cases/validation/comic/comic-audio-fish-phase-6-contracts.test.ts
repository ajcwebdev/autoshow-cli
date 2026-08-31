import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION, FISH_TIMESTAMP_SERIALIZER_VERSION } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/fish-tts-request'
import { runFishTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/run-fish-tts'
import { createHostedTtsChunkScheduler } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-chunk-scheduler'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildTargetExecution } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { createResourceGate } from '~/utils/resource-gate'
import { createMockWavBase64 } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { buildApprovedVoiceEntry, buildComicAudioPhaseFixture, runMockComicSoundscape } from './comic-audio-phase-fixture'

const tempDirs = setupContractSuiteLifecycle({ envKeys: ['FISH_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-fish-soundscape-' })

const voiceEntry = (subjectKey: string, resourceId: string, model = 's2.1-pro') => buildApprovedVoiceEntry({
  subjectKey,
  resourceId,
  provider: 'fish',
  providerModel: model,
  settingsSchema: model === 's2.1-pro' ? FISH_NATIVE_DIALOGUE_SERIALIZER_VERSION : 'fish.tts.phase-0-v1',
})

const fixture = async (root: string, model = 's2.1-pro') => {
  return await buildComicAudioPhaseFixture(root, [voiceEntry('navigator', 'nav-voice', model), voiceEntry('pilot', 'pilot-voice', model)])
}

describe('ADR-017 Phase 6E Fish soundscape acceptance', () => {
  test('keeps Fish S2 Pro native dialogue separate from ElevenLabs action and ambience routing', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan, snapshot } = await fixture(root)
    const target: TtsTarget = { service: 'fish', model: 's2.1-pro', multiSpeakerStrategy: 'native', run: async () => { throw new Error('provider must not run during planning') } }
    const nativeExecution = buildTargetExecution({ target, baseOptions: {}, snapshot, dialoguePlan, mode: 'auto', deliveryPolicy: 'best-effort', sampleRate: 48000, channels: 2, codec: 'pcm_s24le', resourceGate: createResourceGate({ capacity: 1 }) })
    expect(nativeExecution.target).toMatchObject({ service: 'fish', model: 's2.1-pro', operation: 'comic-audio', multiSpeakerStrategy: 'native' })
    const nativePlan = planCurrentTtsReadiness({ target: nativeExecution.target, sourceText: nativeExecution.sourceText, ttsOptions: nativeExecution.options, comicContext: nativeExecution.context })
    expect(nativePlan.strategy).toBe('native-dialogue')
    expect(nativePlan.plannedCost).toBeDefined()

    const segmentedExecution = buildTargetExecution({ target, baseOptions: {}, snapshot, dialoguePlan, mode: 'segmented', deliveryPolicy: 'best-effort', sampleRate: 48000, channels: 2, codec: 'pcm_s24le', resourceGate: createResourceGate({ capacity: 1 }) })
    expect(segmentedExecution.target.multiSpeakerStrategy).toBe('segment-and-concat')
    const segmentedPlan = planCurrentTtsReadiness({ target: segmentedExecution.target, sourceText: segmentedExecution.sourceText, ttsOptions: segmentedExecution.options, comicContext: segmentedExecution.context })
    expect(segmentedPlan.strategy).toBe('segmented')

    expect(() => resolveSoundEffectTarget('fish=s2.1-pro')).toThrow(/Unsupported sound-effect provider fish/)
    process.env['FISH_API_KEY'] = 'fish-fixture-key'
    const calls = installMockFetch(() => { throw new Error('Fish readiness must not call the provider') })
    const readiness = await validateTtsTargetsForExecution([nativeExecution.target])
    expect(readiness).toEqual([expect.objectContaining({ targetKey: nativeExecution.target.targetKey, status: 'ready' })])
    expect(calls).toHaveLength(0)

    const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2', { outputFormat: 'wav_48000' }) })
    expect(renderPlan.target).toMatchObject({ provider: 'elevenlabs', model: 'eleven_text_to_sound_v2', targetKey: canonicalTargetKey('sound-effect-generation', 'elevenlabs', 'eleven_text_to_sound_v2', 'hosted-api') })
    expect(renderPlan.tasks.map(task => ({ kind: task.kind, loop: task.loop }))).toEqual([{ kind: 'action-sfx', loop: false }, { kind: 'ambience', loop: true }])
  })

  test('publishes a local four-bus mix from mocked Fish dialogue and ElevenLabs SFX', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan } = await fixture(root)
    const calls = installMockFetch(call => {
      if (call.url.endsWith('/v1/tts/stream/with-timestamp') && call.method === 'POST') {
        return new Response(`data: ${JSON.stringify({
          audio_base64: createMockWavBase64(),
          content: 'Ready?',
          chunk_seq: 0,
          chunk_audio_offset_sec: 0,
          alignment: { audio_duration: 0.05, segments: [{ text: 'Ready?', start: 0, end: 0.05 }] },
        })}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } })
      }
      throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
    })
    const result = await runFishTts('Ready?', join(root, 'fish'), { model: 's2.1-pro', apiKey: 'fixture-key', voiceId: 'pilot-voice', chunkScheduler: createHostedTtsChunkScheduler() })
    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.fish.audio/v1/tts/stream/with-timestamp')
    expect(calls[0]?.bodyJson).toMatchObject({ text: 'Ready?', reference_id: 'pilot-voice', format: 'wav' })

    await mkdir(join(root, 'audio', 'final'), { recursive: true })
    const { soundscapeRun, sfxCalls } = await runMockComicSoundscape({
      rootDir: root,
      plan: soundscapePlan,
      dialoguePlan,
      target: { service: 'fish', model: 's2.1-pro', transport: 'hosted-api' }
    })
    expect([0, 2]).toContain(sfxCalls())
    expect(soundscapeRun?.binding.targetKey).toBe(canonicalTargetKey('comic-audio', 'fish', 's2.1-pro', 'hosted-api'))
    expect(soundscapeRun?.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
    expect(await Bun.file(join(root, soundscapeRun?.ref.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.mix.master.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.binding.reportedOutputPath as string)).exists()).toBe(true)
    expect(FISH_TIMESTAMP_SERIALIZER_VERSION).toBe('fish.tts.timestamp.phase-6-v1')
  }, 20_000)
})
