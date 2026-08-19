import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { StructuredScriptData, TtsTarget, VoiceReferenceManifest } from '~/types'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { runDeepinfraTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/run-deepinfra-tts'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { createApprovedVoiceSnapshotEntry, createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { buildTargetExecution } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { createLocalSilentDialogueRun, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createResourceGate } from '~/utils/resource-gate'
import { createMockWavBytes, createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const CREATED_AT = '2026-08-14T00:00:00.000Z'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
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
  const source = '# Episode\n\n## Bridge\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n\n**SFX:**\nHatch slams.\n\n**AMBIENCE:**\nEngine hum.\n'
  const sourcePath = join(root, 'scene.md')
  await Bun.write(sourcePath, source)
  const sourceIdentity = await createComicSourceIdentity(sourcePath, source)
  const dialogueStart = [...source.slice(0, source.indexOf('Ready?'))].length
  const answerStart = [...source.slice(0, source.indexOf('Ready.'))].length
  const sfxStart = [...source.slice(0, source.indexOf('Hatch slams.'))].length
  const ambienceStart = [...source.slice(0, source.indexOf('Engine hum.'))].length
  const structured: StructuredScriptData = {
    schemaVersion: 5,
    scriptSlug: sourceIdentity.scriptSlug,
    sourceFile: sourceIdentity.canonicalPath,
    sourceIdentity,
    document: { heading: 'Episode', title: 'Episode', metadata: [] },
    scene: {
      heading: 'Bridge', title: 'Bridge', location: { key: 'bridge', raw: 'INT. BRIDGE' },
      soundscape: {
        cues: [{ cueId: hashCanonicalTtsValue({ kind: 'action-sfx', sfxStart }), kind: 'action-sfx', prompt: 'Hatch slams.', required: true, anchor: { kind: 'scene-clock', positionMs: 100 }, sourceSpan: { kind: 'sound-effect', start: sfxStart, end: sfxStart + 12, indexUnit: 'unicode-scalar-value', text: 'Hatch slams.' }, durationSeconds: 0.5 }],
        ambientBeds: [{ cueId: hashCanonicalTtsValue({ kind: 'ambience', ambienceStart }), kind: 'ambience', prompt: 'Engine hum.', required: true, range: { kind: 'full-scene' }, sourceSpan: { kind: 'sound-effect', start: ambienceStart, end: ambienceStart + 11, indexUnit: 'unicode-scalar-value', text: 'Engine hum.' }, durationSeconds: 1 }],
      },
    },
    characterKeys: ['pilot', 'navigator'],
    beats: [],
    sourceSegments: [
      { id: 'beat-0001', type: 'dialogue', text: 'Ready?', beatIndex: 1, speakerKey: 'pilot', speakerKeys: ['pilot'], speakerLabel: 'PILOT', sourceSpans: [{ kind: 'spoken-text', start: dialogueStart, end: dialogueStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
      { id: 'beat-0002', type: 'dialogue', text: 'Ready.', beatIndex: 2, speakerKey: 'navigator', speakerKeys: ['navigator'], speakerLabel: 'NAVIGATOR', sourceSpans: [{ kind: 'spoken-text', start: answerStart, end: answerStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready.' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
    ],
  }
  const structuredRef = createStructuredScriptArtifactRef(`${canonicalTtsJson(structured)}\n`)
  const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
  const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: CREATED_AT })
  const soundscapePlan = createSoundscapePlan({ structuredScript: structured, structuredScriptRef: structuredRef, dialoguePlan, sceneRunIdentity, createdAt: CREATED_AT })
  const entries = [voiceEntry('navigator', 'Vivian', providerModel), voiceEntry('pilot', 'Ryan', providerModel)]
    .sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
  const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
  const snapshot: VoiceReferenceManifest = validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) })
  return { structured, structuredRef, dialoguePlan, soundscapePlan, snapshot }
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
