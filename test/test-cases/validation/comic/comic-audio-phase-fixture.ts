import { join } from 'node:path'
import type { ApprovedVoiceSnapshotEntry, ComicDialoguePlan, SoundscapePlan, TtsProvider, StructuredScriptData, VoiceReferenceManifest } from '~/types'
import { canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } from '~/cli/commands/process-steps/step-4-tts/soundscape/elevenlabs-sfx-adapter'
import { createSoundEffectRenderPlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/sound-effect-execution'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { createApprovedVoiceSnapshotEntry, createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { createLocalSilentDialogueRun, runComicSoundscape } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'

export const COMIC_AUDIO_PHASE_CREATED_AT = '2026-08-14T00:00:00.000Z'
export const COMIC_AUDIO_PHASE_HASH_A = 'a'.repeat(64)
export const COMIC_AUDIO_PHASE_HASH_B = 'b'.repeat(64)
export const COMIC_AUDIO_PHASE_2_CREATED_AT = '2026-08-11T00:00:00.000Z'
export const COMIC_AUDIO_PHASE_2_HASH_A = 'a'.repeat(64)
export const COMIC_AUDIO_PHASE_2_HASH_B = 'b'.repeat(64)

export const buildComicAudioPhase2Structured = (
  sourceIdentity: Awaited<ReturnType<typeof createComicSourceIdentity>>,
  exactSource?: string
): StructuredScriptData => {
  const readyQuestionStart = exactSource ? [...exactSource.slice(0, exactSource.indexOf('Ready?'))].length : 0
  const readyAnswerStart = exactSource ? [...exactSource.slice(0, exactSource.lastIndexOf('Ready.'))].length : 7
  return {
    schemaVersion: 5,
    scriptSlug: sourceIdentity.scriptSlug,
    sourceFile: sourceIdentity.canonicalPath,
    sourceIdentity,
    document: { heading: 'Episode', title: 'Episode', metadata: [] },
    scene: { heading: 'Scene', title: 'Scene', location: { key: 'bridge', raw: 'INT. BRIDGE' }, soundscape: { cues: [], ambientBeds: [] } },
    characterKeys: ['pilot', 'navigator'],
    beats: [],
    sourceSegments: [
      { id: 'beat-0001', type: 'dialogue', text: 'Ready?', beatIndex: 1, speakerKey: 'pilot', speakerKeys: ['pilot'], speakerLabel: 'PILOT', sourceSpans: [{ kind: 'spoken-text', start: readyQuestionStart, end: readyQuestionStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
      { id: 'beat-0002', type: 'dialogue', text: 'Ready.', beatIndex: 2, speakerKey: 'navigator', speakerKeys: ['navigator'], speakerLabel: 'NAVIGATOR', sourceSpans: [{ kind: 'spoken-text', start: readyAnswerStart, end: readyAnswerStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready.' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
    ],
  }
}

export const buildComicAudioPhase2SnapshotEntry = (
  subjectKey: string,
  resourceId: string,
  provider: 'hume' | 'inworld' | 'openai' = 'hume',
  providerModel = provider === 'hume'
    ? 'octave-2'
    : provider === 'inworld'
      ? 'realtime-tts-2'
      : 'gpt-4o-mini-tts-2025-12-15'
) => buildApprovedVoiceEntry({
  subjectKey,
  resourceId,
  provider,
  providerModel,
  settingsSchema: `${provider}.tts.phase-2-v1`,
  approvedAt: COMIC_AUDIO_PHASE_2_CREATED_AT,
})

export const buildComicAudioPhaseFixture = async (root: string, voiceEntries: VoiceReferenceManifest['entries']) => {
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
  const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: COMIC_AUDIO_PHASE_CREATED_AT })
  const soundscapePlan = createSoundscapePlan({ structuredScript: structured, structuredScriptRef: structuredRef, dialoguePlan, sceneRunIdentity, createdAt: COMIC_AUDIO_PHASE_CREATED_AT })
  const entries = voiceEntries.slice()
    .sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
  const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: COMIC_AUDIO_PHASE_HASH_A, briefSetHash: COMIC_AUDIO_PHASE_HASH_B, createdAt: COMIC_AUDIO_PHASE_CREATED_AT, entries }
  const snapshot = validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) })
  return { structured, structuredRef, dialoguePlan, soundscapePlan, snapshot }
}

export const buildApprovedVoiceEntry = (input: {
  subjectKey: string
  resourceId: string
  provider: TtsProvider
  providerModel: string
  settingsSchema: string
  profileKey?: string | undefined
  approvedAt?: string | undefined
}): ApprovedVoiceSnapshotEntry => createApprovedVoiceSnapshotEntry({
  registrationId: `registration-${input.subjectKey}`,
  generationId: hashCanonicalTtsValue({ subjectKey: input.subjectKey, generation: 1 }),
  subjectKey: input.subjectKey,
  profileKey: input.profileKey ?? 'default',
  provider: input.provider,
  providerVoice: {
    kind: 'remote-resource',
    provider: input.provider,
    resourceId: input.resourceId,
    namespace: 'provider',
    origin: 'provider-stock',
    ownership: 'provider',
    deletion: { state: 'provider-managed', checkedAt: input.approvedAt ?? COMIC_AUDIO_PHASE_CREATED_AT }
  },
  providerModel: input.providerModel,
  settingsSchema: input.settingsSchema,
  synthesisSettings: { schemaVersion: 1, settingsSchema: input.settingsSchema, values: {} },
  sanitizedProviderMetadata: {},
  briefHash: COMIC_AUDIO_PHASE_HASH_A,
  auditionManifestHash: COMIC_AUDIO_PHASE_HASH_B,
  approvedAudition: { storeId: 'voice-store', assetId: `audition-${input.subjectKey}`, sha256: COMIC_AUDIO_PHASE_HASH_A },
  provenanceRef: `provenance:${input.subjectKey}`,
  capabilityFixtureHash: COMIC_AUDIO_PHASE_HASH_B,
  registrationStateAtSnapshot: 'approved-ready',
  externallyMutable: true,
  registrationApprovedAt: input.approvedAt ?? COMIC_AUDIO_PHASE_CREATED_AT,
})

export const runMockComicSoundscape = async (input: {
  rootDir: string
  plan: SoundscapePlan
  dialoguePlan: ComicDialoguePlan
  target: { service: TtsProvider, model: string, transport: string }
  sfxModel?: string | undefined
}) => {
  const dialogue = await createLocalSilentDialogueRun({ rootDir: input.rootDir, plan: input.plan, target: input.target })
  const renderPlan = createSoundEffectRenderPlan({
    plan: input.plan,
    target: resolveSoundEffectTarget(`elevenlabs=${input.sfxModel ?? 'eleven_text_to_sound_v2'}`, { outputFormat: 'wav_48000' })
  })
  let sfxCalls = 0
  const adapter = createElevenLabsSoundEffectAdapter({
    apiKey: 'fixture',
    request: async () => {
      sfxCalls++
      return {
        status: 200,
        headers: { 'content-type': 'audio/wav', 'request-id': `sfx-${sfxCalls}` },
        body: createSyntheticWavBytes({ durationSeconds: 0.5, amplitude: 0.2, frequencyHz: 220 + sfxCalls * 110 })
      }
    },
    now: () => COMIC_AUDIO_PHASE_CREATED_AT
  })
  const mixed = await runComicSoundscape({
    rootDir: input.rootDir,
    plan: input.plan,
    renderPlan,
    dialoguePlan: input.dialoguePlan,
    dialogueRuns: [dialogue.binding],
    adapter,
    concurrency: 2,
    hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: 'immediate' })
  })
  return { mixed, renderPlan, dialogue, soundscapeRun: mixed.soundscapeRuns[0], sfxCalls: () => sfxCalls }
}
