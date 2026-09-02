import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TtsOptions, TtsTarget, VoiceReferenceManifest } from '~/types'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { resolveCompatibleComicSceneRun } from '~/cli/commands/process-steps/step-8-comic/comic-utils/compatible-scene-run'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { toSourceIdentityDisplayPath } from '~/utils/runtime-paths'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { COMIC_AUDIO_PHASE_2_CREATED_AT as CREATED_AT, COMIC_AUDIO_PHASE_2_HASH_A as HASH_A, COMIC_AUDIO_PHASE_2_HASH_B as HASH_B, buildComicAudioPhase2SnapshotEntry as snapshotEntry, buildComicAudioPhase2Structured as buildStructured } from './comic-audio-phase-fixture'

setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'HUME_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-comic-audio-phase-2-' })

describe('comic audio phase 2 contracts', () => {
  test('maps host source paths to an explicit immutable-workspace identity alias without weakening containment', () => {
    const mapping = { sourceRoot: '/Users/editor/show', aliasRoot: '/workspace' }
    expect(toSourceIdentityDisplayPath('/Users/editor/show/input/scripts/scene.md', mapping)).toBe('/workspace/input/scripts/scene.md')
    expect(toSourceIdentityDisplayPath('/Users/editor/show', mapping)).toBe('/workspace')
    expect(toSourceIdentityDisplayPath('/Users/editor/other/scene.md', mapping)).toBe('/Users/editor/other/scene.md')
    expect(() => toSourceIdentityDisplayPath('/Users/editor/show/input/scripts/scene.md', { sourceRoot: 'relative/show', aliasRoot: '/workspace' })).toThrow(/ROOT must be an absolute/)
    expect(() => toSourceIdentityDisplayPath('/Users/editor/show/input/scripts/scene.md', { sourceRoot: '/Users/editor/show', aliasRoot: '/workspace/../other' })).toThrow(/normalized absolute POSIX/)
    expect(() => toSourceIdentityDisplayPath('/Users/editor/show/input/scripts/scene.md', { sourceRoot: '/Users/editor/show' })).toThrow(/must be set together/)
  })

  test('source identity converges through symlinks and rejects exact-byte drift in a pinned scene run', async () => {
    const root = await makeTempDir('autoshow-comic-audio-source-')
    const sourcePath = join(root, 'scene.md')
    const aliasPath = join(root, 'scene-alias.md')
    const sceneRunDir = join(root, 'run')
    const sourceBytes = '# Episode\n\n## Scene\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
    await writeFile(sourcePath, sourceBytes)
    await symlink(sourcePath, aliasPath)
    const directIdentity = await createComicSourceIdentity(sourcePath, sourceBytes)
    const aliasIdentity = await createComicSourceIdentity(aliasPath, sourceBytes)
    expect(aliasIdentity).toEqual(directIdentity)

    const structured = buildStructured(directIdentity, sourceBytes)
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await writeFile(join(sceneRunDir, structuredRef.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity: directIdentity, structuredScript: structuredRef })

    const compatible = await resolveCompatibleComicSceneRun({ scriptPath: aliasPath, outputDir: sceneRunDir })
    expect(compatible.sourceIdentity.identityHash).toBe(directIdentity.identityHash)
    await writeFile(sourcePath, `${sourceBytes}\nchanged\n`)
    await expect(resolveCompatibleComicSceneRun({ scriptPath: sourcePath, outputDir: sceneRunDir })).rejects.toThrow(/Pinned comic output is not compatible/)
    expect(await readFile(join(sceneRunDir, structuredRef.path), 'utf8')).toBe(structuredBytes)
    expect((await readManifest(sceneRunDir))?.source).toEqual(directIdentity)
  })

  test('re-stamps the structure manifest when the same source re-parses to different structured bytes', async () => {
    const root = await makeTempDir('autoshow-comic-structure-restamp-')
    const sceneRunDir = join(root, 'run')
    const sourceBytes = '# Episode\n\n## Scene\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
    const sourcePath = join(root, 'scene.md')
    await writeFile(sourcePath, sourceBytes)
    const identity = await createComicSourceIdentity(sourcePath, sourceBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })

    const stamp = async (structured: ReturnType<typeof buildStructured>) => {
      const bytes = `${canonicalTtsJson(structured)}\n`
      const ref = createStructuredScriptArtifactRef(bytes)
      await writeFile(join(sceneRunDir, ref.path), bytes)
      return { manifest: await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity: identity, structuredScript: ref }), ref }
    }

    const first = await stamp(buildStructured(identity, sourceBytes))
    // An LLM re-review of the same canonical script segments it differently, so the structured artifact
    // the manifest still references is replaced before the manifest is re-stamped.
    const rereviewed = { ...buildStructured(identity, sourceBytes), reviewNote: 'resegmented' } as ReturnType<typeof buildStructured>
    const second = await stamp(rereviewed)
    expect(second.ref.sha256).not.toBe(first.ref.sha256)
    const item = second.manifest.items[0]
    const comic = item?.metadata['comic'] as unknown as { audio: { structuredScript: { sha256: string } } }
    expect(comic.audio.structuredScript.sha256).toBe(second.ref.sha256)
    expect((await readManifest(sceneRunDir))?.source).toEqual(identity)
  })

  test('preserves incompatible nonempty pinned directory contents without partial initialization', async () => {
    const root = await makeTempDir('autoshow-comic-audio-pinned-initialize-')
    const sourcePath = join(root, 'scene.md')
    const sourceBytes = '# Episode\n\n## Scene\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
    await writeFile(sourcePath, sourceBytes)
    const occupied = join(root, 'occupied-run')
    await mkdir(occupied)
    await writeFile(join(occupied, 'keep.txt'), 'preserve me\n')
    await expect(resolveCompatibleComicSceneRun({ scriptPath: sourcePath, outputDir: occupied })).rejects.toThrow(/candidate has no strict canonical comic manifest/)
    expect(await readFile(join(occupied, 'keep.txt'), 'utf8')).toBe('preserve me\n')
    expect(await Bun.file(join(occupied, 'metadata/structured-script.json')).exists()).toBe(false)
    expect(await Bun.file(join(occupied, 'manifest.json')).exists()).toBe(false)
  })

  test('automatic source selection skips a newer incompatible candidate without creating a fallback run', async () => {
    const root = await makeTempDir('autoshow-comic-audio-selection-')
    const outputRoot = join(root, 'output')
    const sourcePath = join(root, 'scene.md')
    const sourceBytes = '# Episode\n\n## Scene\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
    await writeFile(sourcePath, sourceBytes)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceBytes)
    const structured = buildStructured(sourceIdentity, sourceBytes)
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    const older = join(outputRoot, '2026-08-10_00-00-00-000_scene')
    const newer = join(outputRoot, '2026-08-11_00-00-00-000_scene')
    await mkdir(join(older, 'metadata'), { recursive: true })
    await writeFile(join(older, structuredRef.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir: older, createdAt: CREATED_AT, sourceIdentity, structuredScript: structuredRef })
    await mkdir(newer, { recursive: true })
    await writeFile(join(newer, 'manifest.json'), '{}\n')

    expect((await resolveCompatibleComicSceneRun({ scriptPath: sourcePath, outputRoot })).sceneRunDir).toBe(older)
    const unrelatedSource = join(root, 'unrelated.md')
    await writeFile(unrelatedSource, 'unrelated')
    const before = await readdir(outputRoot)
    await expect(resolveCompatibleComicSceneRun({ scriptPath: unrelatedSource, outputRoot })).rejects.toThrow(/never creates a fresh scene run/)
    expect(await readdir(outputRoot)).toEqual(before)
  })

  test('compound speech remains an explicit overlap unless a role policy collapses it', async () => {
    const root = await makeTempDir('autoshow-comic-audio-overlap-')
    const sourcePath = join(root, 'scene.md')
    await writeFile(sourcePath, 'compound scene')
    const sourceIdentity = await createComicSourceIdentity(sourcePath, 'compound scene')
    const structured = buildStructured(sourceIdentity)
    const { speakerKey: _speakerKey, ...compoundBase } = structured.sourceSegments[0]!
    structured.sourceSegments = [{ ...compoundBase, id: 'beat-compound', speakerKeys: ['pilot', 'navigator'], speakerLabel: 'PILOT AND NAVIGATOR' }]
    const bytes = `${canonicalTtsJson(structured)}\n`
    const ref = createStructuredScriptArtifactRef(bytes)
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, ref)
    const overlap = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: ref, sceneRunIdentity, createdAt: CREATED_AT })
    expect(overlap.nodes[0]?.kind).toBe('overlap')
    const entries = [snapshotEntry('navigator', 'Puck'), snapshotEntry('pilot', 'Kore')]
    const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: overlap.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    const voiceSnapshot: VoiceReferenceManifest = { ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) }
    const overlapTurns = overlap.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)
    const target: TtsTarget = {
      service: 'hume', model: 'octave-2', operation: 'comic-audio', transport: 'hosted-api',
      targetKey: canonicalTargetKey('comic-audio', 'hume', 'octave-2', 'hosted-api'),
      run: async () => { throw new Error('provider must not run during planning') },
    }
    const planned = planCurrentTtsReadiness({
      target,
      sourceText: overlapTurns.map((turn, index) => `VOICE_00${index + 1}: ${turn.canonicalText}`).join('\n'),
      ttsOptions: {
        ttsDialogueFormat: 'labeled',
        ttsSpeakers: ['VOICE_001=Kore', 'VOICE_002=Puck'],
        ttsCanonicalTurns: overlapTurns.map((turn, index) => ({ turnId: turn.turnId, speaker: `VOICE_00${index + 1}`, text: turn.canonicalText })),
      },
      comicContext: {
        operation: 'comic-audio', sourceIdentity, dialoguePlan: overlap, voiceSnapshot,
        snapshotEntryIdByTurnId: Object.fromEntries(overlapTurns.map(turn => [turn.turnId, entries.find(entry => entry.subjectKey === turn.subjectKey)!.entryId])),
        providerSpeakerLabelByTurnId: Object.fromEntries(overlapTurns.map((turn, index) => [turn.turnId, `VOICE_00${index + 1}`])),
        modePreference: 'segmented',
      },
    })
    expect(planned.renderPlan.nodes[0]?.kind).toBe('overlap')
    const collapsed = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: ref, sceneRunIdentity, createdAt: CREATED_AT, rolePolicies: [{ speakerLabel: 'PILOT AND NAVIGATOR', subjectKey: 'role:chorus' }] })
    expect(collapsed.nodes).toEqual([expect.objectContaining({ kind: 'turn', turn: expect.objectContaining({ subjectKey: 'role:chorus' }) })])
  })

  test('dialogue planning separates comms delivery and resolves loose-comedy timing cues', async () => {
    const root = await makeTempDir('autoshow-comic-audio-pacing-')
    const sourcePath = join(root, 'scene.md')
    await writeFile(sourcePath, 'paced scene')
    const sourceIdentity = await createComicSourceIdentity(sourcePath, 'paced scene')
    const structured = buildStructured(sourceIdentity)
    structured.sourceSegments = [{
      ...structured.sourceSegments[0]!,
      text: 'Ready? Now.',
      delivery: 'over comms, controlled urgency',
      sourceSpans: [
        { kind: 'spoken-text', start: 0, end: 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' },
        { kind: 'timing', start: 7, end: 13, indexUnit: 'unicode-scalar-value', text: '(beat)' },
        { kind: 'spoken-text', start: 14, end: 18, indexUnit: 'unicode-scalar-value', text: 'Now.' },
      ]
    }]
    const bytes = `${canonicalTtsJson(structured)}\n`
    const ref = createStructuredScriptArtifactRef(bytes)
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, ref)
    const plan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: ref, sceneRunIdentity, createdAt: CREATED_AT, pacingProfile: 'loose-comedy' })
    const plannedTurn = plan.nodes[0]?.kind === 'turn' ? plan.nodes[0].turn : undefined

    expect(plan.schemaVersion).toBe(2)
    expect(plan.pacing).toEqual({ profile: 'loose-comedy', interTurnMs: 350 })
    expect(plannedTurn?.delivery?.description).toBe('controlled urgency')
    expect(plannedTurn?.effect?.kind).toBe('radio')
    expect(plannedTurn?.timingCues).toEqual([expect.objectContaining({ kind: 'beat', afterTextOffset: 6, durationMs: 750 })])
  })

  test('Hume comic planning binds approved snapshot entries and selects native utterances', async () => {
    const root = await makeTempDir('autoshow-comic-audio-plan-')
    const sourcePath = join(root, 'scene.md')
    await writeFile(sourcePath, 'two speaker scene')
    const sourceIdentity = await createComicSourceIdentity(sourcePath, 'two speaker scene')
    const structured = buildStructured(sourceIdentity)
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
    const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: CREATED_AT })
    const entries = [snapshotEntry('navigator', 'Puck'), snapshotEntry('pilot', 'Kore')]
    const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    const voiceSnapshot: VoiceReferenceManifest = { ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) }
    const turns = dialoguePlan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)
    const target: TtsTarget = {
      service: 'hume', model: 'octave-2', operation: 'comic-audio', transport: 'hosted-api',
      targetKey: canonicalTargetKey('comic-audio', 'hume', 'octave-2', 'hosted-api'),
      run: async () => { throw new Error('provider must not run during planning') },
    }
    const options: TtsOptions = {
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: ['VOICE_001=Kore', 'VOICE_002=Puck'],
      ttsCanonicalTurns: turns.map((turn, index) => ({ turnId: turn.turnId, speaker: `VOICE_00${index + 1}`, text: turn.canonicalText })),
      ttsMasteringProfile: { schemaVersion: 1, sampleRate: 48000, channels: 2, codec: 'pcm_s24le', container: 'wav' },
    }
    const context = {
      operation: 'comic-audio' as const,
      sourceIdentity,
      dialoguePlan,
      voiceSnapshot,
      snapshotEntryIdByTurnId: Object.fromEntries(turns.map(turn => [turn.turnId, entries.find(entry => entry.subjectKey === turn.subjectKey)!.entryId])),
      providerSpeakerLabelByTurnId: Object.fromEntries(turns.map((turn, index) => [turn.turnId, `VOICE_00${index + 1}`])),
      modePreference: 'auto' as const,
    }
    const planned = planCurrentTtsReadiness({ target, sourceText: 'VOICE_001: Ready?\nVOICE_002: Ready.', ttsOptions: options, comicContext: context })
    expect(planned.operation).toBe('comic-audio')
    expect(planned.strategy).toBe('native-utterances')
    expect(planned.renderPlan.voiceContext).toEqual({ kind: 'approved-snapshot', snapshotId: voiceSnapshot.snapshotId })
    expect(planned.renderPlan.requestedOutput).toEqual({ codec: 'pcm_s24le', container: 'wav', sampleRate: 48000, channels: 2 })
    expect(planned.renderPlan.nodes.every(node => node.kind === 'turn' && node.turn.voice.kind === 'approved-snapshot')).toBe(true)

  })
})
