import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CliCommandContext, StructuredScriptData, TtsTarget } from '~/types'
import { canonicalTargetKey, canonicalTtsJson, hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity, validateVoiceReferenceManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildTargetExecution, generateComicAudio } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-audio/generate-audio-command'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { createResourceGate } from '~/utils/resource-gate'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { COMIC_AUDIO_PHASE_2_CREATED_AT as CREATED_AT, COMIC_AUDIO_PHASE_2_HASH_A as HASH_A, COMIC_AUDIO_PHASE_2_HASH_B as HASH_B, buildComicAudioPhase2SnapshotEntry as snapshotEntry, buildComicAudioPhase2Structured as buildStructured } from './comic-audio-phase-fixture'

setupContractSuiteLifecycle({ envKeys: ['OPENAI_API_KEY', 'HUME_API_KEY', 'ELEVENLABS_API_KEY'], tempPrefix: 'autoshow-comic-audio-phase-2-' })

describe('comic audio phase 2 contracts', () => {
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

  test('comic target execution carries every Inworld snapshot voice into readiness', async () => {
    const root = await makeTempDir('autoshow-inworld-readiness-')
    const sourcePath = join(root, 'scene.md')
    await writeFile(sourcePath, 'Inworld readiness')
    const sourceIdentity = await createComicSourceIdentity(sourcePath, 'Inworld readiness')
    const structured = buildStructured(sourceIdentity)
    const structuredRef = createStructuredScriptArtifactRef(`${canonicalTtsJson(structured)}\n`)
    const dialoguePlan = createComicDialoguePlan({ structuredScript: structured, sourceIdentity, structuredScriptRef: structuredRef, sceneRunIdentity: computeSceneRunIdentity(sourceIdentity, structuredRef), createdAt: CREATED_AT })
    const entries = [snapshotEntry('navigator', 'Alex', 'inworld'), snapshotEntry('pilot', 'Dennis', 'inworld')]
      .sort((left, right) => [left.provider, left.providerModel, left.profileKey, left.subjectKey, left.registrationId, left.generationId, left.entryId].join('\0').localeCompare([right.provider, right.providerModel, right.profileKey, right.subjectKey, right.registrationId, right.generationId, right.entryId].join('\0')))
    const snapshotBase = { schemaVersion: 1 as const, sceneRunIdentity: dialoguePlan.sceneRunIdentity, dialoguePlanId: dialoguePlan.dialoguePlanId, catalogHash: HASH_A, briefSetHash: HASH_B, createdAt: CREATED_AT, entries }
    const snapshot = validateVoiceReferenceManifest({ ...snapshotBase, snapshotId: hashCanonicalTtsValue(snapshotBase) })
    const target: TtsTarget = { service: 'inworld', model: 'realtime-tts-2', run: async () => { throw new Error('provider must not run during planning') } }

    const execution = buildTargetExecution({ target, baseOptions: {}, snapshot, dialoguePlan, mode: 'segmented', deliveryPolicy: 'best-effort', sampleRate: 48000, channels: 2, codec: 'pcm_s24le', resourceGate: createResourceGate({ capacity: 1 }) })

    expect([...(execution.target.readinessVoiceIds ?? [])].sort()).toEqual(['Alex', 'Dennis'])
  })

  test('ElevenLabs premade voices stay ready for eleven_v3 when high_quality_base_model_ids omit eleven_v3', async () => {
    process.env['ELEVENLABS_API_KEY'] = 'eleven-test-key'
    const calls = installMockFetch((input) => {
      const voiceId = new URL(input.url).pathname.split('/').at(-1)
      return new Response(JSON.stringify({
        voice_id: voiceId,
        high_quality_base_model_ids: ['eleven_turbo_v2', 'eleven_multilingual_v2'],
        sharing: null,
        fine_tuning: { state: {} }
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const target: TtsTarget = {
      service: 'elevenlabs', model: 'eleven_v3', operation: 'comic-audio', transport: 'hosted-api',
      targetKey: canonicalTargetKey('comic-audio', 'elevenlabs', 'eleven_v3', 'hosted-api'),
      readinessVoiceIds: ['XrExE9yKIg1WjnnlVkGX'],
      run: async () => { throw new Error('provider must not run during readiness') },
    }
    const observations = await validateTtsTargetsForExecution([target])
    expect(observations.map(observation => observation.status)).toEqual(['ready'])
    expect(calls).toHaveLength(1)
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
    const root = await makeTempDir('autoshow-comic-audio-empty-')
    const sourcePath = join(root, 'silent-scene.md')
    const sceneRunDir = join(root, 'run')
    const sourceText = 'A silent bridge.\n'
    await writeFile(sourcePath, sourceText)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceText)
    const structured: StructuredScriptData = {
      schemaVersion: 5,
      scriptSlug: sourceIdentity.scriptSlug,
      sourceFile: sourceIdentity.canonicalPath,
      sourceIdentity,
      document: { heading: 'Episode', title: 'Episode', metadata: [] },
      scene: { heading: 'Scene', title: 'Scene', location: { key: 'bridge', raw: 'INT. BRIDGE' }, soundscape: { cues: [], ambientBeds: [] } },
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
})
