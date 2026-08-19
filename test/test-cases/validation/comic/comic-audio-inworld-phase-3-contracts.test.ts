import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { NormalizedTiming, StructuredScriptData, TtsRequestEvidenceScope, TtsTarget, VoiceReferenceManifest } from '~/types'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { normalizeInworldTimestampInfo } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-request'
import { runInworldTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/run-inworld-tts'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { createApprovedVoiceSnapshotEntry, createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { buildTargetExecution } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { createLocalSilentDialogueRun, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createResourceGate } from '~/utils/resource-gate'
import { createMockWavBase64, createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const CREATED_AT = '2026-08-14T00:00:00.000Z'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const tempDirs = setupContractSuiteLifecycle({ envKeys: ['INWORLD_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-inworld-soundscape-' })

const voiceEntry = (subjectKey: string, resourceId: string) => createApprovedVoiceSnapshotEntry({
  registrationId: `registration-${subjectKey}`,
  generationId: hashCanonicalTtsValue({ subjectKey, generation: 1 }),
  subjectKey,
  profileKey: 'default',
  provider: 'inworld',
  providerVoice: { kind: 'remote-resource', provider: 'inworld', resourceId, namespace: 'provider', origin: 'provider-stock', ownership: 'provider', deletion: { state: 'provider-managed', checkedAt: CREATED_AT } },
  providerModel: 'realtime-tts-2',
  settingsSchema: 'inworld.tts.phase-3-v3',
  synthesisSettings: { schemaVersion: 1, settingsSchema: 'inworld.tts.phase-3-v3', values: {} },
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
  const entries = [voiceEntry('navigator', 'Alex'), voiceEntry('pilot', 'Dennis')]
    .sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
  const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
  const snapshot: VoiceReferenceManifest = validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) })
  return { structured, structuredRef, dialoguePlan, soundscapePlan, snapshot }
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
    const dialogue = await createLocalSilentDialogueRun({ rootDir: root, plan: soundscapePlan, target: { service: 'inworld', model: 'realtime-tts-2', transport: 'hosted-api' } })
    const renderPlan = createSoundEffectRenderPlan({ plan: soundscapePlan, target: resolveSoundEffectTarget('elevenlabs=eleven_text_to_sound_v2', { outputFormat: 'wav_48000' }) })
    let sfxCalls = 0
    const adapter = createElevenLabsSoundEffectAdapter({ apiKey: 'fixture', request: async () => {
      sfxCalls++
      return { status: 200, headers: { 'content-type': 'audio/wav', 'request-id': `sfx-${sfxCalls}` }, body: createSyntheticWavBytes({ durationSeconds: 0.5, amplitude: 0.2, frequencyHz: 220 + sfxCalls * 110 }) }
    }, now: () => CREATED_AT })
    const mixed = await runComicSoundscape({ rootDir: root, plan: soundscapePlan, renderPlan, dialoguePlan, dialogueRuns: [dialogue.binding], adapter, concurrency: 2, hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: 'immediate' }) })
    const soundscapeRun = mixed.soundscapeRuns[0]
    expect([0, 2]).toContain(sfxCalls)
    expect(soundscapeRun?.binding.targetKey).toBe(canonicalTargetKey('comic-audio', 'inworld', 'realtime-tts-2', 'hosted-api'))
    expect(soundscapeRun?.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'action-sfx', 'ambience'])
    expect(await Bun.file(join(root, soundscapeRun?.ref.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.mix.master.path as string)).exists()).toBe(true)
    expect(await Bun.file(join(root, soundscapeRun?.binding.reportedOutputPath as string)).exists()).toBe(true)
  }, 20_000)
})
