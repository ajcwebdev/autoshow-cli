import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { NormalizedTiming, TtsRequestEvidenceScope, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { normalizeInworldTimestampInfo } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-request'
import { runInworldTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/run-inworld-tts'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildTargetExecution } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { createResourceGate } from '~/utils/resource-gate'
import { createMockWavBase64 } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { buildApprovedVoiceEntry, buildComicAudioPhaseFixture, runMockComicSoundscape } from './comic-audio-phase-fixture'

const tempDirs = setupContractSuiteLifecycle({ envKeys: ['INWORLD_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-inworld-soundscape-' })

const voiceEntry = (subjectKey: string, resourceId: string) => buildApprovedVoiceEntry({
  subjectKey,
  resourceId,
  provider: 'inworld',
  providerModel: 'realtime-tts-2',
  settingsSchema: 'inworld.tts.phase-3-v3',
})

const fixture = async (root: string) => {
  return await buildComicAudioPhaseFixture(root, [voiceEntry('navigator', 'Alex'), voiceEntry('pilot', 'Dennis')])
}

describe('ADR-017 Phase 3E Inworld soundscape acceptance', () => {
  test('keeps Inworld dialogue planning separate from ElevenLabs action and ambience routing', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan, snapshot } = await fixture(root)
    const target: TtsTarget = { service: 'inworld', model: 'realtime-tts-2', run: async () => { throw new Error('provider must not run during planning') } }
    const execution = buildTargetExecution({ target, baseOptions: {}, snapshot, dialoguePlan, mode: 'segmented', deliveryPolicy: 'best-effort', sampleRate: 48000, channels: 2, codec: 'pcm_s24le', resourceGate: createResourceGate({ capacity: 1 }) })

    expect(dialoguePlan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)).toHaveLength(2)
    expect(dialoguePlan.nodes.every(node => node.kind === 'turn')).toBe(true)
    expect(execution.target).toMatchObject({ service: 'inworld', model: 'realtime-tts-2', operation: 'comic-audio', multiSpeakerStrategy: 'segment-and-concat' })
    expect(execution.options.ttsSpeakers?.slice().sort()).toEqual(['VOICE_001=Dennis', 'VOICE_002=Alex'].sort())
    expect([...(execution.target.readinessVoiceIds ?? [])].sort()).toEqual(['Alex', 'Dennis'])

    const calls = installMockFetch(call => {
      if (call.url.includes('/voices/v1/voices')) return Response.json({ voices: [{ voiceId: 'Alex' }, { voiceId: 'Dennis' }] })
      throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
    })
    const readinessPlan = planCurrentTtsReadiness({ target: execution.target, sourceText: execution.sourceText, ttsOptions: execution.options, comicContext: execution.context })
    expect(readinessPlan.strategy).toBe('segmented')
    expect(readinessPlan.renderPlan.nodes.every(node => node.kind === 'turn' && node.turn.voice.kind === 'approved-snapshot')).toBe(true)
    expect(readinessPlan.plannedCost).toBeDefined()
    expect(calls).toHaveLength(0)

    process.env['INWORLD_API_KEY'] = 'inworld-fixture-key'
    const readiness = await validateTtsTargetsForExecution([execution.target])
    expect(readiness).toEqual([expect.objectContaining({ targetKey: execution.target.targetKey, status: 'ready' })])
    expect(calls).toHaveLength(1)

    expect(() => resolveSoundEffectTarget('inworld=realtime-tts-2')).toThrow(/Unsupported sound-effect provider inworld/)
    const sfxTarget = resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2', { outputFormat: 'wav_48000' })
    const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: sfxTarget })
    expect(renderPlan.target).toMatchObject({ provider: 'elevenlabs', model: 'eleven_text_to_sound_v2', targetKey: canonicalTargetKey('sound-effect-generation', 'elevenlabs', 'eleven_text_to_sound_v2', 'hosted-api') })
    expect(renderPlan.tasks.map(task => ({ kind: task.kind, loop: task.loop }))).toEqual([{ kind: 'action-sfx', loop: false }, { kind: 'ambience', loop: true }])
  })

  test('retains mocked Inworld viseme timing and publishes a local final soundscape timeline and mix', async () => {
    const root = await tempDirs.make()
    const { dialoguePlan, soundscapePlan } = await fixture(root)
    const timings: Array<NormalizedTiming<'take-audio-ms'>> = []
    const evidence: TtsRequestEvidenceScope = {
      dispatch: async (_observation, _attempt, operation) => await operation({ accepted: async () => {} }),
      recordOutput: async output => { if (output.timingFactory) timings.push(output.timingFactory({ turnId: 'turn-inworld', subjectKey: 'pilot' })) },
      complete: async () => {},
    }
    const calls = installMockFetch(call => {
      if (!call.url.endsWith('/tts/v1/voice')) throw new Error(`Unexpected network call: ${call.method} ${call.url}`)
      return Response.json({
        audioContent: createMockWavBase64({ samples: 2400 }),
        timestampInfo: { wordAlignment: { words: ['Ready?'], wordStartTimeSeconds: [0], wordEndTimeSeconds: [0.05], phoneticDetails: [{ wordIndex: 0, phones: [{ phoneSymbol: 'r', startTimeSeconds: 0, durationSeconds: 0.02, visemeSymbol: 'R' }] }] } },
      }, { headers: { 'x-request-id': 'inworld-fixture' } })
    })
    const result = await runInworldTts('Ready?', join(root, 'inworld'), { model: 'realtime-tts-2', apiKey: 'fixture-key', voiceId: 'Dennis', requestEvidence: evidence })
    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.bodyJson).toMatchObject({ text: 'Ready?', voiceId: 'Dennis', modelId: 'inworld-tts-2', timestampType: 'WORD' })
    expect(timings[0]).toMatchObject({ availability: 'timed', phonemes: [{ text: 'r', visemeSymbol: 'R', startMs: 0, endMs: 20 }] })
    expect(normalizeInworldTimestampInfo({ text: 'Ready?', identity: { turnId: 'turn-inworld', subjectKey: 'pilot' }, timestampInfo: { wordAlignment: { words: [], wordStartTimeSeconds: [], wordEndTimeSeconds: [], phoneticDetails: [{ phones: [{ phoneSymbol: 'r', startTimeSeconds: 0, durationSeconds: 0.02, visemeSymbol: ' R ' }] }] } } })).toMatchObject({ phonemes: [{ visemeSymbol: 'R' }] })

    await mkdir(join(root, 'audio', 'final'), { recursive: true })
    const { soundscapeRun, sfxCalls } = await runMockComicSoundscape({
      rootDir: root,
      plan: soundscapePlan,
      dialoguePlan,
      target: { service: 'inworld', model: 'realtime-tts-2', transport: 'hosted-api' }
    })
    expect([0, 2]).toContain(sfxCalls())
    expect(soundscapeRun?.binding.targetKey).toBe(canonicalTargetKey('comic-audio', 'inworld', 'realtime-tts-2', 'hosted-api'))
    expect(soundscapeRun?.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
    expect(await Bun.file(join(root, soundscapeRun?.ref.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.mix.master.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.binding.reportedOutputPath as string)).exists()).toBe(true)
  }, 20_000)
})
