import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CliCommandContext, PipelineProviderState, StructuredScriptData, TtsOptions, TtsTarget, VoiceReferenceManifest } from '~/types'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsReadiness } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { createApprovedVoiceSnapshotEntry, createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { updateComicAudioManifest, updateComicImageManifest, writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { resolveCompatibleComicSceneRun } from '~/cli/commands/process-steps/step-8-comic/comic-utils/compatible-scene-run'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { mixAudioToWav } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import { assertVoiceSnapshotCoversSelectedTargets, generateComicAudio } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { writeVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/voice-reference-snapshot'
import { createMockWavBytes, createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const CREATED_AT = '2026-08-11T00:00:00.000Z'

setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'HUME_API_KEY'], tempPrefix: 'autoshow-comic-audio-phase-2-' })

const buildStructured = (sourceIdentity: Awaited<ReturnType<typeof createComicSourceIdentity>>, exactSource?: string): StructuredScriptData => {
  const readyQuestionStart = exactSource ? [...exactSource.slice(0, exactSource.indexOf('Ready?'))].length : 0
  const readyAnswerStart = exactSource ? [...exactSource.slice(0, exactSource.lastIndexOf('Ready.'))].length : 7
  return {
  schemaVersion: 4,
  scriptSlug: sourceIdentity.scriptSlug,
  sourceFile: sourceIdentity.canonicalPath,
  sourceIdentity,
  document: { heading: 'Episode', title: 'Episode', metadata: [] },
  scene: { heading: 'Scene', title: 'Scene', location: { key: 'bridge', raw: 'INT. BRIDGE' } },
  characterKeys: ['pilot', 'navigator'],
  beats: [],
  sourceSegments: [
    { id: 'beat-0001', type: 'dialogue', text: 'Ready?', beatIndex: 1, speakerKey: 'pilot', speakerKeys: ['pilot'], speakerLabel: 'PILOT', sourceSpans: [{ kind: 'spoken-text', start: readyQuestionStart, end: readyQuestionStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
    { id: 'beat-0002', type: 'dialogue', text: 'Ready.', beatIndex: 2, speakerKey: 'navigator', speakerKeys: ['navigator'], speakerLabel: 'NAVIGATOR', sourceSpans: [{ kind: 'spoken-text', start: readyAnswerStart, end: readyAnswerStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready.' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
  ],
  }
}

const snapshotEntry = (
  subjectKey: string,
  resourceId: string,
  provider: 'gemini' | 'openai' = 'gemini',
  providerModel = provider === 'gemini' ? 'gemini-2.5-pro-preview-tts' : 'gpt-4o-mini-tts-2025-12-15'
) => createApprovedVoiceSnapshotEntry({
  registrationId: `registration-${subjectKey}`,
  generationId: hashCanonicalTtsValue({ subjectKey, generation: 1 }),
  subjectKey,
  profileKey: 'default',
  provider,
  providerVoice: { kind: 'remote-resource', provider, resourceId, namespace: 'provider', origin: 'provider-stock', ownership: 'provider', deletion: { state: 'provider-managed', checkedAt: CREATED_AT } },
  providerModel,
  settingsSchema: `${provider}.tts.phase-2-v1`,
  synthesisSettings: { schemaVersion: 1, settingsSchema: `${provider}.tts.phase-2-v1`, values: {} },
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

describe('comic audio phase 2 contracts', () => {
  test('source identity converges through symlinks and rejects exact-byte drift in a pinned scene run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-audio-source-'))
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
  })

  test('automatic source selection skips a newer incompatible candidate without creating a fallback run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-audio-selection-'))
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
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-audio-overlap-'))
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
      service: 'gemini', model: 'gemini-2.5-pro-preview-tts', operation: 'comic-audio', transport: 'hosted-api',
      targetKey: canonicalTargetKey('comic-audio', 'gemini', 'gemini-2.5-pro-preview-tts', 'hosted-api'),
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
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-audio-pacing-'))
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

  test('Gemini comic planning binds approved snapshot entries and selects native only for exactly two speakers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-audio-plan-'))
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
      service: 'gemini', model: 'gemini-2.5-pro-preview-tts', operation: 'comic-audio', transport: 'hosted-api',
      targetKey: canonicalTargetKey('comic-audio', 'gemini', 'gemini-2.5-pro-preview-tts', 'hosted-api'),
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
    expect(planned.strategy).toBe('native-dialogue')
    expect(planned.renderPlan.voiceContext).toEqual({ kind: 'approved-snapshot', snapshotId: voiceSnapshot.snapshotId })
    expect(planned.renderPlan.requestedOutput).toEqual({ codec: 'pcm_s24le', container: 'wav', sampleRate: 48000, channels: 2 })
    expect(planned.renderPlan.nodes.every(node => node.kind === 'turn' && node.turn.voice.kind === 'approved-snapshot')).toBe(true)

    const oneSpeakerContext = { ...context, providerSpeakerLabelByTurnId: Object.fromEntries(turns.map(turn => [turn.turnId, 'VOICE_001'])) }
    const segmented = planCurrentTtsReadiness({ target, sourceText: 'VOICE_001: Ready?\nVOICE_001: Ready.', ttsOptions: { ...options, ttsSpeakers: ['VOICE_001=Kore'], ttsCanonicalTurns: turns.map(turn => ({ turnId: turn.turnId, speaker: 'VOICE_001', text: turn.canonicalText })) }, comicContext: oneSpeakerContext })
    expect(segmented.strategy).toBe('segmented')
    expect(sha256Bytes(canonicalTtsJson(segmented.renderPlan))).toHaveLength(64)
  })

  test('shared read-only execution readiness accepts canonical comic-audio targets', async () => {
    const target: TtsTarget = {
      service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15', operation: 'comic-audio', transport: 'hosted-api',
      targetKey: canonicalTargetKey('comic-audio', 'openai', 'gpt-4o-mini-tts-2025-12-15', 'hosted-api'),
      run: async () => { throw new Error('provider must not run during readiness') },
    }
    const observations = await validateTtsTargetsForExecution([target])
    expect(observations).toHaveLength(1)
    expect(observations[0]?.targetKey).toBe(target.targetKey)
  })

  test('shared read-only execution readiness reuses one Hume catalog probe across model targets', async () => {
    process.env['HUME_API_KEY'] = 'hume-test-key'
    const calls = installMockFetch((input) => new Response(JSON.stringify({
      page_number: 0,
      page_size: 100,
      total_pages: 1,
      voices_page: [{ id: 'voice-shared', name: 'Shared', provider: new URL(input.url).searchParams.get('provider') }]
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const targets: TtsTarget[] = ['octave-1', 'octave-2'].map(model => ({
      service: 'hume', model, operation: 'comic-audio', transport: 'hosted-api',
      targetKey: canonicalTargetKey('comic-audio', 'hume', model, 'hosted-api'),
      readinessVoiceIds: ['voice-shared'],
      run: async () => { throw new Error('provider must not run during readiness') },
    }))
    const observations = await validateTtsTargetsForExecution(targets)
    expect(observations.map(observation => observation.status)).toEqual(['ready', 'ready'])
    expect(calls).toHaveLength(2)
    expect(calls.map(call => new URL(call.url).searchParams.get('provider')).sort()).toEqual(['CUSTOM_VOICE', 'HUME_AI'])
  })

  test('targetless zero-turn command completes locally without provider state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-audio-empty-'))
    const sourcePath = join(root, 'silent-scene.md')
    const sceneRunDir = join(root, 'run')
    const sourceText = 'A silent bridge.\n'
    await writeFile(sourcePath, sourceText)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceText)
    const structured: StructuredScriptData = {
      schemaVersion: 4,
      scriptSlug: sourceIdentity.scriptSlug,
      sourceFile: sourceIdentity.canonicalPath,
      sourceIdentity,
      document: { heading: 'Episode', title: 'Episode', metadata: [] },
      scene: { heading: 'Scene', title: 'Scene', location: { key: 'bridge', raw: 'INT. BRIDGE' } },
      characterKeys: [],
      beats: [],
      sourceSegments: [{
        id: 'beat-0001', type: 'direction', text: 'A silent bridge.', sourceSpans: [{ kind: 'stage-direction', start: 0, end: 16, indexUnit: 'unicode-scalar-value', text: 'A silent bridge.' }],
        location: { key: 'bridge', raw: 'INT. BRIDGE' },
      }],
    }
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await writeFile(join(sceneRunDir, structuredRef.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity, structuredScript: structuredRef })
    const context = {
      argv: [], flags: {}, parameters: { input: '', outputDirs: [], prompt: '' }, store: {},
      rawParsed: { doubleDash: [], explicitFlags: new Set<string>(), flagOccurrences: [], flagOccurrenceIndices: [], unknown: {}, positionals: [] },
    } as CliCommandContext
    configurePinnedRunDir(sceneRunDir)
    try {
      await generateComicAudio(context, sourcePath)
    } finally {
      resetPinnedRunDir()
    }
    const manifest = await readManifest(sceneRunDir)
    const comic = manifest?.items[0]?.metadata['comic'] as never as { stages: { audio: { status: string, execution: { kind: string }, targetKeys: string[] } }, audio: { dialoguePlanId?: string } }
    expect(manifest?.items[0]?.providers).toEqual([])
    expect(comic.stages.audio).toEqual(expect.objectContaining({ status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [] }))
    expect(comic.audio.dialoguePlanId).toHaveLength(64)
  })

  test('mocked segmented command crosses the shared barrier and publishes canonical comic audio', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const calls = installMockFetch(() => new Response(createMockWavBytes(), { status: 200, headers: { 'content-type': 'audio/wav' } }))
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-audio-command-'))
    const sourcePath = join(root, 'scene.md')
    const sceneRunDir = join(root, 'run')
    const sourceText = '# Episode\n\n## Scene\n\n**PILOT**\nReady? (beat) Go.\n\n**NAVIGATOR**\nReady.\n'
    await writeFile(sourcePath, sourceText)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceText)
    const structured = buildStructured(sourceIdentity, sourceText)
    const firstSpokenStart = [...sourceText.slice(0, sourceText.indexOf('Ready?'))].length
    const timingStart = [...sourceText.slice(0, sourceText.indexOf('(beat)'))].length
    const secondSpokenStart = [...sourceText.slice(0, sourceText.indexOf('Go.'))].length
    structured.sourceSegments[0] = {
      ...structured.sourceSegments[0]!,
      text: 'Ready? Go.',
      sourceSpans: [
        { kind: 'spoken-text', start: firstSpokenStart, end: firstSpokenStart + 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' },
        { kind: 'timing', start: timingStart, end: timingStart + 6, indexUnit: 'unicode-scalar-value', text: '(beat)' },
        { kind: 'spoken-text', start: secondSpokenStart, end: secondSpokenStart + 3, indexUnit: 'unicode-scalar-value', text: 'Go.' },
      ]
    }
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await writeFile(join(sceneRunDir, structuredRef.path), structuredBytes)
    await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity, structuredScript: structuredRef })
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
    const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: CREATED_AT })
    const entries = [snapshotEntry('navigator', 'onyx', 'openai'), snapshotEntry('pilot', 'alloy', 'openai')]
    const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    const snapshot = validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) })
    await writeVoiceReferenceManifest(sceneRunDir, snapshot)
    const providerValue = 'openai=gpt-4o-mini-tts-2025-12-15'
    const context = {
      argv: [], flags: { provider: [providerValue], mode: 'segmented' }, parameters: { input: '', outputDirs: [], prompt: '' }, store: {},
      rawParsed: {
        doubleDash: [], explicitFlags: new Set(['provider', 'mode']),
        flagOccurrences: [{ name: 'provider', raw: '--provider', value: providerValue, known: true }, { name: 'mode', raw: '--mode', value: 'segmented', known: true }],
        flagOccurrenceIndices: [0, 1], unknown: {}, positionals: [],
      },
    } as CliCommandContext
    configurePinnedRunDir(sceneRunDir)
    try {
      await generateComicAudio(context, sourcePath)
    } finally {
      resetPinnedRunDir()
    }
    const manifest = await readManifest(sceneRunDir)
    const provider = manifest?.items[0]?.providers[0]
    const comic = manifest?.items[0]?.metadata['comic'] as never as { stages: { audio: { status: string } }, audio: { selectedAudioRuns?: unknown[], finalOutputRefs?: Array<{ path: string }> } }
    expect(calls.map(call => call.bodyJson?.['voice']).sort()).toEqual(['alloy', 'alloy', 'onyx'])
    expect(calls.filter(call => call.bodyJson?.['voice'] === 'alloy').map(call => call.bodyJson?.['input'])).toEqual(['Ready?', 'Go.'])
    expect(provider).toEqual(expect.objectContaining({ operation: 'comic-audio', status: 'succeeded' }))
    expect(provider?.result?.['comicAudio']).toEqual(expect.objectContaining({ selectedSuccess: expect.any(Object) }))
    expect(comic.stages.audio.status).toBe('full')
    expect(comic.audio.selectedAudioRuns).toHaveLength(1)
    expect(comic.audio.finalOutputRefs).toHaveLength(1)
    expect(await Bun.file(join(sceneRunDir, comic.audio.finalOutputRefs?.[0]?.path as string)).exists()).toBe(true)
  }, 20_000)

  test('aggregate snapshots reject duplicate target/profile/subject authority', () => {
    const first = snapshotEntry('pilot', 'Kore')
    const second = snapshotEntry('pilot', 'Puck')
    const entries = [first, second].sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
    const base = { schemaVersion: 1 as const, sceneRunIdentity: HASH_A, dialoguePlanId: HASH_B, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    expect(() => validateVoiceReferenceManifest({ ...base, snapshotId: hashCanonicalTtsValue(base) })).toThrow(/duplicate provider\/model\/profile\/subject bindings/)
  })

  test('aggregate snapshots permit an already-contained target subset but reject a recast', () => {
    const entries = [
      snapshotEntry('navigator', 'onyx', 'openai'),
      snapshotEntry('pilot', 'alloy', 'openai'),
      snapshotEntry('navigator', 'Puck'),
      snapshotEntry('pilot', 'Kore'),
    ].sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
    const base = { schemaVersion: 1 as const, sceneRunIdentity: HASH_A, dialoguePlanId: HASH_B, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    const snapshot = validateVoiceReferenceManifest({ ...base, snapshotId: hashCanonicalTtsValue(base) })

    expect(() => assertVoiceSnapshotCoversSelectedTargets({
      snapshot,
      targets: [{ service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }],
      subjectKeys: ['pilot', 'navigator'],
      profileKey: 'default',
    })).not.toThrow()
    expect(() => assertVoiceSnapshotCoversSelectedTargets({
      snapshot,
      targets: [{ service: 'hume', model: 'octave-1' }],
      subjectKeys: ['pilot', 'navigator'],
      profileKey: 'default',
    })).toThrow(/immutable superset/)
  })

  test('canonical image and audio stage updates preserve each other and replace only their own provider targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-stage-state-'))
    const sourcePath = join(root, 'scene.md')
    const sceneRunDir = join(root, 'run')
    await writeFile(sourcePath, 'stage state')
    const sourceIdentity = await createComicSourceIdentity(sourcePath, 'stage state')
    const structured = buildStructured(sourceIdentity)
    const structuredBytes = `${canonicalTtsJson(structured)}\n`
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await writeFile(join(sceneRunDir, structuredRef.path), structuredBytes)
    const initial = await writeInitialComicStructureManifest({ sceneRunDir, createdAt: CREATED_AT, sourceIdentity, structuredScript: structuredRef })
    const oldTargetKey = canonicalTargetKey('comic-image', 'openai', 'gpt-image-2', 'hosted-api')
    const imageState = (targetKey: string, model: string, status: PipelineProviderState['status']): PipelineProviderState => ({
      service: 'openai', model, local: false, operation: 'comic-image', targetKey, transport: 'hosted-api', artifactDir: '.', status,
      attempts: 1, options: {}, metadata: {}, ...(status === 'succeeded' ? { result: {} } : {}),
    })
    await updateComicImageManifest({ sceneRunDir, sourceIdentity, providers: [imageState(oldTargetKey, 'gpt-image-2', 'running')], artifactRefs: [] })
    const afterImage = await readManifest(sceneRunDir)
    const initialComic = initial.items[0]!.metadata['comic'] as never as { audio: Record<string, unknown> }
    await updateComicAudioManifest({
      sceneRunDir,
      sourceIdentity,
      stage: { requirement: 'required', status: 'full', execution: { kind: 'local', state: 'succeeded' }, targetKeys: [], artifactRefs: [{ path: structuredRef.path, sha256: structuredRef.sha256 }] },
      audio: initialComic.audio,
      providers: [],
    })
    expect((await readManifest(sceneRunDir))?.items[0]?.providers.map(provider => provider.targetKey)).toEqual([oldTargetKey])

    const newTargetKey = canonicalTargetKey('comic-image', 'openai', 'gpt-image-3', 'hosted-api')
    await updateComicImageManifest({ sceneRunDir, sourceIdentity, providers: [imageState(newTargetKey, 'gpt-image-3', 'succeeded')], artifactRefs: [] })
    const completed = await readManifest(sceneRunDir)
    expect(afterImage?.items[0]?.status).toBe('incomplete')
    expect(completed?.items[0]?.providers.map(provider => provider.targetKey)).toEqual([newTargetKey])
    expect(completed?.items[0]?.status).toBe('full')
    expect((completed?.items[0]?.metadata['comic'] as never as { stages: { audio: { status: string } } }).stages.audio.status).toBe('full')
  })

  test('local overlap mixing uses the longest child and honors the selected mastering profile', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-comic-overlap-mix-'))
    const first = join(root, 'first.wav')
    const second = join(root, 'second.wav')
    const output = join(root, 'mixed.wav')
    await writeFile(first, createSyntheticWavBytes({ durationSeconds: 0.2, amplitude: 0.2, frequencyHz: 330 }))
    await writeFile(second, createSyntheticWavBytes({ durationSeconds: 0.4, amplitude: 0.2, frequencyHz: 440 }))
    await mixAudioToWav([first, second], output, 'comic-contract', { schemaVersion: 1, sampleRate: 48000, channels: 2, codec: 'pcm_s24le', container: 'wav' })
    const bytes = await readFile(output)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let cursor = 12
    let channels = 0
    let sampleRate = 0
    let bitsPerSample = 0
    let dataBytes = 0
    while (cursor + 8 <= bytes.byteLength) {
      const chunk = bytes.subarray(cursor, cursor + 4).toString('ascii')
      const size = view.getUint32(cursor + 4, true)
      if (chunk === 'fmt ') {
        channels = view.getUint16(cursor + 10, true)
        sampleRate = view.getUint32(cursor + 12, true)
        bitsPerSample = view.getUint16(cursor + 22, true)
      }
      if (chunk === 'data') dataBytes = size
      cursor += 8 + size + (size % 2)
    }
    const durationSeconds = dataBytes / (sampleRate * channels * (bitsPerSample / 8))
    expect({ channels, sampleRate, bitsPerSample }).toEqual({ channels: 2, sampleRate: 48000, bitsPerSample: 24 })
    expect(durationSeconds).toBeGreaterThan(0.38)
    expect(durationSeconds).toBeLessThan(0.42)
  })
})
