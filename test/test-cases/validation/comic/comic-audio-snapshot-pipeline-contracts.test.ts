import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PipelineProviderState, ProviderRenderResult, TtsOptions, TtsTarget, VoiceReferenceManifest } from '~/types'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { planCurrentTtsResumePrice } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { updateComicAudioManifest, updateComicImageManifest, writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { assertVoiceSnapshotCoversSelectedTargets } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { loadVoiceReferenceManifest, writeVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/voice-reference-snapshot'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { COMIC_AUDIO_PHASE_2_CREATED_AT as CREATED_AT, COMIC_AUDIO_PHASE_2_HASH_A as HASH_A, COMIC_AUDIO_PHASE_2_HASH_B as HASH_B, buildComicAudioPhase2SnapshotEntry as snapshotEntry, buildComicAudioPhase2Structured as buildStructured } from './comic-audio-phase-fixture'

setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'HUME_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-comic-audio-phase-2-' })

describe('comic audio phase 2 contracts', () => {
  test('finalizes a fully compatible snapshot-identity change without another provider call', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const root = await makeTempDir('autoshow-comic-cross-snapshot-recovery-')
    const sourcePath = join(root, 'scene.md')
    const sourceBytes = '# Episode\n\n## Scene\n\n**PILOT**\nReady?\n\n**NAVIGATOR**\nReady.\n'
    await writeFile(sourcePath, sourceBytes)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceBytes)
    const structured = buildStructured(sourceIdentity, sourceBytes)
    const structuredRef = createStructuredScriptArtifactRef(`${canonicalTtsJson(structured)}\n`)
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredRef)
    const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity, createdAt: CREATED_AT })
    const entries = [snapshotEntry('navigator', 'echo', 'openai'), snapshotEntry('pilot', 'alloy', 'openai')]
      .sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
    const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    const firstSnapshot = validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) })
    const secondSnapshotBase = { ...snapshotBase, catalogHash: 'c'.repeat(64) }
    const secondSnapshot = validateVoiceReferenceManifest({ ...secondSnapshotBase, snapshotId: hashCanonicalTtsValue(secondSnapshotBase) })
    const turns = dialoguePlan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)
    const sourceText = turns.map((turn, index) => `VOICE_00${index + 1}: ${turn.canonicalText}`).join('\n')
    const options: TtsOptions = {
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: ['VOICE_001=alloy', 'VOICE_002=echo'],
      ttsCanonicalTurns: turns.map((turn, index) => ({ turnId: turn.turnId, speaker: `VOICE_00${index + 1}`, text: turn.canonicalText })),
      ttsMasteringProfile: { schemaVersion: 1, sampleRate: 48000, channels: 2, codec: 'pcm_s24le', container: 'wav' },
      ttsChunkConcurrency: 1
    }
    const targetKey = canonicalTargetKey('comic-audio', 'openai', 'gpt-4o-mini-tts-2025-12-15', 'hosted-api')
    const providerCalls: number[] = []
    const target: TtsTarget = {
      service: 'openai',
      model: 'gpt-4o-mini-tts-2025-12-15',
      operation: 'comic-audio',
      transport: 'hosted-api',
      targetKey,
      multiSpeakerStrategy: 'segment-and-concat',
      run: async (text, outputDir, _ttsOptions, invocation, requestEvidence) => {
        const sourceIndex = invocation?.sourceIndex ?? -1
        providerCalls.push(sourceIndex)
        const voice = invocation?.voice.value ?? 'alloy'
        const audioPath = join(outputDir, 'speech.wav')
        const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: sourceIndex === 0 ? 280 : 420 })
        await requestEvidence?.dispatch({
          chunkIndex: 1,
          endpointKind: 'speech-synthesis',
          serializerVersion: 'openai.tts.phase-0-v1',
          serializedRequest: { body: { input: text, voice, response_format: 'wav' } },
          providerText: text,
          voiceField: 'voice',
          voices: [{ kind: 'provider-id', value: voice }],
          requestControls: { responseFormat: 'wav' },
          continuation: { kind: 'none' }
        }, { attempt: 1 }, async ({ accepted }) => {
          await accepted({ providerRequestId: `snapshot-recovery-${sourceIndex}` })
          await Bun.write(audioPath, bytes)
        })
        if (!requestEvidence) await Bun.write(audioPath, bytes)
        await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
        await requestEvidence?.complete({ chunkIndex: 1 })
        return { audioPath, metadata: { ttsService: 'openai', ttsModel: 'gpt-4o-mini-tts-2025-12-15', speaker: voice, processingTime: 1, audioFileName: 'speech.wav', audioFileSize: bytes.byteLength, chunkCount: 1 } }
      }
    }
    const contextFor = (voiceSnapshot: VoiceReferenceManifest) => ({
      operation: 'comic-audio' as const,
      sourceIdentity,
      dialoguePlan,
      voiceSnapshot,
      snapshotEntryIdByTurnId: Object.fromEntries(turns.map(turn => [turn.turnId, entries.find(entry => entry.subjectKey === turn.subjectKey)!.entryId])),
      providerSpeakerLabelByTurnId: Object.fromEntries(turns.map((turn, index) => [turn.turnId, `VOICE_00${index + 1}`])),
      modePreference: 'segmented' as const,
    })
    const firstStates: PipelineProviderState[] = []
    const firstOutput = join(root, 'first.wav')
    await runTtsForTargets(sourceText, root, options, [target], {
      comicContext: contextFor(firstSnapshot),
      artifactOutputDir: root,
      artifactRoot: 'audio/providers',
      resolveReportedOutput: () => ({ path: firstOutput, fileName: 'first.wav' }),
      beforeDispatch: async () => {},
      onProviderState: async (state) => { firstStates.push(state) }
    })
    const retained = requireDefined(firstStates.at(-1), 'first snapshot provider state')
    expect(providerCalls).toEqual([0, 1])

    const price = await planCurrentTtsResumePrice({ rootDir: root, state: retained, target, sourceText, ttsOptions: options, comicContext: contextFor(secondSnapshot) })
    expect(price).toMatchObject({ recoveryKind: 'partial-slots', recoveredSlotCount: 2, unresolvedSlotCount: 0, plannedSlotCount: 0, plannedCost: { amounts: [] } })

    const secondStates: PipelineProviderState[] = []
    const secondOutput = join(root, 'second.wav')
    const second = await runTtsForTargets(sourceText, root, options, [target], {
      comicContext: contextFor(secondSnapshot),
      artifactOutputDir: root,
      artifactRoot: 'audio/providers',
      retainedProviderStates: [retained],
      recoveryRootDir: root,
      resolveReportedOutput: () => ({ path: secondOutput, fileName: 'second.wav' }),
      beforeDispatch: async () => {},
      onProviderState: async (state) => { secondStates.push(state) }
    })
    expect(providerCalls).toEqual([0, 1])
    expect(await Bun.file(secondOutput).exists()).toBe(true)
    expect(second.metadata[0]?.comicAudio?.selectedSuccess).toBeDefined()
    const terminalState = secondStates.at(-1)
    const projection = terminalState?.result?.['comicAudio'] as NonNullable<(typeof second.metadata)[number]['comicAudio']> | undefined
    const active = projection?.activeWork
    const render = active?.kind === 'render' ? projection?.renderHistory.find(candidate => candidate.renderIdentity === active.renderIdentity) : undefined
    const event = active?.kind === 'render' ? render?.events.find(candidate => candidate.sequence === active.eventSequence) : undefined
    if (!terminalState || !render || !event?.providerRenderResultRef) throw new Error('Missing locally composed terminal result')
    const providerResult = await Bun.file(join(root, terminalState.artifactDir, event.providerRenderResultRef)).json() as ProviderRenderResult
    expect(providerResult.closedBy.kind).toBe('local-composition')
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

  test('append-only voice snapshot indexes retain and resolve recast revisions independently', async () => {
    const sceneRunDir = await makeTempDir('autoshow-comic-voice-recast-')
    const firstBase = {
      schemaVersion: 1 as const,
      sceneRunIdentity: HASH_A,
      dialoguePlanId: HASH_B,
      catalogHash: HASH_A,
      briefSetHash: HASH_B,
      createdAt: CREATED_AT,
      entries: [snapshotEntry('paddy', 'Philip', 'openai')]
    }
    const secondBase = {
      ...firstBase,
      catalogHash: HASH_B,
      entries: [snapshotEntry('paddy', 'Dennis', 'openai')]
    }
    const first = validateVoiceReferenceManifest({ ...firstBase, snapshotId: hashCanonicalTtsValue(firstBase) })
    const second = validateVoiceReferenceManifest({ ...secondBase, snapshotId: hashCanonicalTtsValue(secondBase) })

    await writeVoiceReferenceManifest(sceneRunDir, first)
    await writeVoiceReferenceManifest(sceneRunDir, second)

    const index = await Bun.file(join(sceneRunDir, 'assets/voice-reference-snapshots.json')).json() as { entries: Array<{ snapshotId: string }> }
    expect(index.entries.map(entry => entry.snapshotId)).toEqual([first.snapshotId, second.snapshotId])
    expect((await loadVoiceReferenceManifest({ sceneRunDir, sceneRunIdentity: HASH_A, dialoguePlanId: HASH_B, snapshotId: first.snapshotId }))?.manifest.entries[0]?.providerVoice).toMatchObject({ resourceId: 'Philip' })
    expect((await loadVoiceReferenceManifest({ sceneRunDir, sceneRunIdentity: HASH_A, dialoguePlanId: HASH_B, snapshotId: second.snapshotId }))?.manifest.entries[0]?.providerVoice).toMatchObject({ resourceId: 'Dennis' })
    await expect(loadVoiceReferenceManifest({ sceneRunDir, sceneRunIdentity: HASH_A, dialoguePlanId: HASH_B })).rejects.toThrow(/Multiple retained voice snapshots/)
  })

  test('canonical image and audio stage updates preserve each other and replace only their own provider targets', async () => {
    const root = await makeTempDir('autoshow-comic-stage-state-')
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
})
