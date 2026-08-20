import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProtectedAssetRef, StructuredScriptData, TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { validateTtsTargetsForExecution } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { createComicSourceIdentity, createStructuredScriptArtifactRef, computeSceneRunIdentity } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { createComicDialoguePlan } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan'
import { createFishAdvancedProvider, FISH_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/fish-advanced-provider'
import { runFishTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/fish/run-fish-tts'
import { createMockWavBase64, createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle, withEnv } from '../../../test-utils/rest-contract-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const HASH_A = 'a'.repeat(64)
const CREATED_AT = '2026-08-14T00:00:00.000Z'

setupContractSuiteLifecycle({ envKeys: ['FISH_API_KEY'], tempPrefix: 'autoshow-comic-audio-phase-3-' })

const buildStructured = (sourceIdentity: Awaited<ReturnType<typeof createComicSourceIdentity>>): StructuredScriptData => ({
  schemaVersion: 5,
  scriptSlug: sourceIdentity.scriptSlug,
  sourceFile: sourceIdentity.canonicalPath,
  sourceIdentity,
  document: { heading: 'Episode', title: 'Episode', metadata: [] },
  scene: { heading: 'Scene', title: 'Scene', location: { key: 'bridge', raw: 'INT. BRIDGE' }, soundscape: { cues: [], ambientBeds: [] } },
  characterKeys: ['pilot', 'navigator'],
  beats: [],
  sourceSegments: [
    { id: 'beat-0001', type: 'dialogue', text: 'Ready?', beatIndex: 1, speakerKey: 'pilot', speakerKeys: ['pilot'], speakerLabel: 'PILOT', sourceSpans: [{ kind: 'spoken-text', start: 0, end: 6, indexUnit: 'unicode-scalar-value', text: 'Ready?' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
    { id: 'beat-0002', type: 'dialogue', text: 'Ready.', beatIndex: 2, speakerKey: 'navigator', speakerKeys: ['navigator'], speakerLabel: 'NAVIGATOR', sourceSpans: [{ kind: 'spoken-text', start: 7, end: 13, indexUnit: 'unicode-scalar-value', text: 'Ready.' }], location: { key: 'bridge', raw: 'INT. BRIDGE' } },
  ],
})

const createDummyRun = (): TtsTarget['run'] => async () => ({
  audioPath: 'dummy.wav',
  metadata: {
    ttsService: 'fish',
    ttsModel: 's2.1-pro',
    speaker: 'dummy',
    processingTime: 100,
    audioFileName: 'speech.wav',
    audioFileSize: 100,
    chunkCount: 1,
  }
})

describe('ADR-017 Phase 3 Fish Audio Contracts', () => {
  test('Fish Audio capability fixture declares single-speaker TTS, S2 Pro native dialogue, and voice design', () => {
    expect(FISH_ADVANCED_CAPABILITY_FIXTURE.records.some((c) => c.scope.feature === 'turn-synthesis' && c.adapterSupport === 'implemented')).toBeTrue()
    expect(FISH_ADVANCED_CAPABILITY_FIXTURE.records.some((c) => c.scope.feature === 'native-dialogue' && 'model' in c.scope && c.scope.model === 's2.1-pro' && c.adapterSupport === 'implemented')).toBeTrue()
    expect(FISH_ADVANCED_CAPABILITY_FIXTURE.records.some((c) => c.scope.feature === 'word-timing' && 'model' in c.scope && c.scope.model === 's2.1-pro' && c.adapterSupport === 'implemented')).toBeTrue()
    expect(FISH_ADVANCED_CAPABILITY_FIXTURE.records.some((c) => c.scope.feature === 'voice-design')).toBeTrue()
    expect(FISH_ADVANCED_CAPABILITY_FIXTURE.records.some((c) => c.scope.feature === 'instant-clone')).toBeTrue()
  })

  test('Fish Audio target resolution and preflight check with missing key', async () => {
    const targetKey = canonicalTargetKey('tts-synthesis', 'fish', 's2.1-pro', 'http')
    const targets: readonly TtsTarget[] = [{ service: 'fish', model: 's2.1-pro', voice: '7f92f8afb8ec43bf81429cc1c9199cb1', operation: 'tts-synthesis', transport: 'http', targetKey, run: createDummyRun() }]
    const preflight = await validateTtsTargetsForExecution(targets)
    expect(preflight[0]?.status).toBe('blocked')
  })

  test('Fish Audio target preflight check with FISH_API_KEY present', async () => {
    await withEnv({ FISH_API_KEY: 'test-fish-key' }, async () => {
      const targetKey = canonicalTargetKey('tts-synthesis', 'fish', 's2.1-pro', 'http')
      const targets: readonly TtsTarget[] = [{ service: 'fish', model: 's2.1-pro', voice: '7f92f8afb8ec43bf81429cc1c9199cb1', operation: 'tts-synthesis', transport: 'http', targetKey, run: createDummyRun() }]
      const preflight = await validateTtsTargetsForExecution(targets)
      expect(preflight[0]?.status).toBe('ready')
    })
  })

  test('Fish Audio advanced provider generates design candidates and clones voices', async () => {
    const mockWav = createMockWavBytes()

    installMockFetch((call) => {
      if (call.url.includes('/voice-design')) {
        return new Response(JSON.stringify({
          candidates: [{ id: 'fish-candidate-0', index: 0, audio_base64: Buffer.from(mockWav).toString('base64'), sample_rate: 44100, duration_ms: 3500 }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (call.url.includes('/model')) {
        return new Response(JSON.stringify({ _id: 'fish-model-99', title: 'New Fish Voice', state: 'ready' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('Not found', { status: 404 })
    })

    const provider = createFishAdvancedProvider({
      apiKey: 'test-fish-key',
      resolveProtectedAsset: async () => ({ bytes: mockWav, fileName: 'sample.wav', mediaType: 'audio/wav' })
    })

    const res = await provider.design!.createCandidate({
      description: 'A confident starship captain',
      previewText: 'Engage hyperdrive.',
      creationModel: 'voice-design-1',
      candidateCount: 1,
    })

    expect(res.previews).toHaveLength(1)
    expect(res.previews[0]?.providerCandidateId).toBe('fish-candidate-0')

    const protectedSample: ProtectedAssetRef = { assetId: 'asset-1', sha256: HASH_A, storeId: 'store-1' }
    const cloned = await provider.clone!.clone({
      desiredName: 'New Fish Voice',
      protectedSamples: [protectedSample],
      cloneKind: 'instant',
      consentRecordRef: 'consent-1',
      provenanceRef: 'prov-1',
      localAttemptId: 'attempt-1',
    })

    expect(cloned.state).toBe('ready')
    expect(cloned.providerVoice?.kind).toBe('remote-resource')
    if (cloned.providerVoice?.kind === 'remote-resource') {
      expect(cloned.providerVoice.resourceId).toBe('fish-model-99')
    }
  })

  test('Fish Audio TTS runner synthesizes speech WAV', async () => {
    installMockFetch((call) => {
      if (call.url.includes('/v1/tts')) {
        return new Response(`data: ${JSON.stringify({
          audio_base64: createMockWavBase64(),
          content: 'Ready for departure.',
          chunk_seq: 0,
          chunk_audio_offset_sec: 0,
          alignment: { audio_duration: 0.05, segments: [{ text: 'Ready for departure.', start: 0, end: 0.05 }] },
        })}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } })
      }
      return new Response('Not found', { status: 404 })
    })

    const tempDir = await makeTempDir('autoshow-fish-tts-')

    const result = await runFishTts('Ready for departure.', tempDir, {
      model: 's2.1-pro',
      voiceId: '7f92f8afb8ec43bf81429cc1c9199cb1',
      apiKey: 'test-fish-key',
    })

    expect(result.audioPath).toContain(tempDir)
    expect(result.metadata.audioFileSize).toBeGreaterThan(0)
  })

  test('Fish Audio structured script creates dialogue plan', async () => {
    const tempDir = await makeTempDir('autoshow-fish-scene-')
    const sourceFile = join(tempDir, 'input.txt')
    const sourceText = 'PILOT: Ready?\nNAVIGATOR: Ready.'
    await writeFile(sourceFile, sourceText)

    const sourceIdentity = await createComicSourceIdentity(sourceFile, sourceText)
    const structured = buildStructured(sourceIdentity)
    const structuredJsonBytes = new TextEncoder().encode(JSON.stringify(structured))
    const structuredScriptRef = createStructuredScriptArtifactRef(structuredJsonBytes)
    const sceneRunIdentity = computeSceneRunIdentity(sourceIdentity, structuredScriptRef)

    const plan = createComicDialoguePlan({
      structuredScript: structured,
      sourceIdentity,
      structuredScriptRef,
      sceneRunIdentity,
      createdAt: CREATED_AT,
    })

    expect(plan.sceneRunIdentity).toBeDefined()
    expect(plan.nodes).toHaveLength(2)
  })
})
