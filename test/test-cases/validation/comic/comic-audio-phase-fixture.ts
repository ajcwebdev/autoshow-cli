import { join } from 'node:path'
import type { StructuredScriptData, VoiceReferenceManifest } from '~/types'
import { canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { createSoundscapePlan } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'

export const COMIC_AUDIO_PHASE_CREATED_AT = '2026-08-14T00:00:00.000Z'
export const COMIC_AUDIO_PHASE_HASH_A = 'a'.repeat(64)
export const COMIC_AUDIO_PHASE_HASH_B = 'b'.repeat(64)

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
