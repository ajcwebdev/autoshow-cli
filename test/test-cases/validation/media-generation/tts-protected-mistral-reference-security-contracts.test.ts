import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProtectedAssetRef, ProtectedVoiceAssetStore, TtsOptions, TtsTarget, TtsTargetInvocation } from '~/types'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { getMistralProtectedReference } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-protected-reference-binding'
import { materializeStandaloneMistralReference, planStandaloneMistralReference, planStandaloneMistralSpeakerReferences, prepareStandaloneMistralReference } from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import { captureConsole } from '../../../test-utils/console-capture'
import { createMockWavBase64, createMockWavBytes } from '../../../test-utils/media-fixtures'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { runMultiSpeakerTts } from '~/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts'
import { resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { installMockFetch, unexpectedCall } from '../../../test-utils/rest-contract-helpers'
import { createMistralProtectedFixture, createMistralTestChunkScheduler, mistralOptions, mistralReferenceInput, protectedAsset } from './tts-protected-mistral-reference-fixture'

const mistralFixture = createMistralProtectedFixture()
const makeRoot = mistralFixture.makeRoot

afterEach(async () => {
  resetPinnedRunDir()
  await mistralFixture.cleanup()
})

describe('standalone Mistral protected request references', () => {
  test('per-turn protected references are immutable snapshots of target capabilities', async () => {
    const root = await makeRoot()
    const runDir = join(root, 'run')
    await mkdir(runDir)
    const mutableAsset: ProtectedAssetRef = {
      storeId: 'mutable_fixture_store',
      assetId: `sha256_${'b'.repeat(64)}`,
      sha256: 'b'.repeat(64)
    }
    let captured: TtsTargetInvocation | undefined
    const target: TtsTarget = {
      service: 'mistral',
      model: 'voxtral-mini-tts-2603',
      operation: 'tts-synthesis',
      transport: 'hosted-api',
      targetKey: canonicalTargetKey('tts-synthesis', 'mistral', 'voxtral-mini-tts-2603', 'hosted-api'),
      voice: `ref_audio:${mutableAsset.assetId}`,
      multiSpeakerStrategy: 'segment-and-concat',
      protectedSpeakerVoiceAssets: { HOST: mutableAsset },
      run: async (_text, outputDir, _options, invocation) => {
        captured = invocation
        const audioPath = join(outputDir, 'speech.wav')
        const bytes = createMockWavBytes()
        await Bun.write(audioPath, bytes)
        return {
          audioPath,
          metadata: {
            ttsService: 'mistral',
            ttsModel: 'voxtral-mini-tts-2603',
            speaker: 'protected-reference',
            processingTime: 1,
            audioFileName: 'speech.wav',
            audioFileSize: bytes.byteLength,
            chunkCount: 1
          }
        }
      }
    }
    const options: TtsOptions = {
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: [`Host=ref_audio:${mutableAsset.assetId}`]
    }

    await runMultiSpeakerTts('Host: Immutable reference.', runDir, target, options)
    if (!captured || captured.voice.kind !== 'ref-audio' || !captured.voice.protectedAsset) {
      throw new Error('Expected a captured protected-reference invocation.')
    }
    const invocationIdentity = (): string => hashCanonicalTtsValue({
      sourceId: captured!.sourceId,
      sourceIndex: captured!.sourceIndex,
      speaker: captured!.speaker,
      voice: captured!.voice,
      controls: captured!.controls
    })
    const before = invocationIdentity()
    const capturedAsset = captured.voice.protectedAsset
    mutableAsset.assetId = `sha256_${'c'.repeat(64)}`
    mutableAsset.sha256 = 'c'.repeat(64)
    Reflect.set(capturedAsset, 'assetId', `sha256_${'d'.repeat(64)}`)

    expect(Object.isFrozen(capturedAsset)).toBe(true)
    expect(capturedAsset).toEqual({
      storeId: 'mutable_fixture_store',
      assetId: `sha256_${'b'.repeat(64)}`,
      sha256: 'b'.repeat(64)
    })
    expect(invocationIdentity()).toBe(before)
  })

  test('corrupt single and per-speaker references stop after hash planning and before protected ingestion', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'private-corrupt-reference.wav')
    await Bun.write(sourcePath, new Uint8Array([1, 2, 3, 4]))
    let planCalls = 0
    let ingestCalls = 0
    const store: ProtectedVoiceAssetStore = {
      plan: async () => {
        planCalls++
        return {
          materialization: 'non-materialized',
          protectedAsset,
          authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION,
          byteLength: 4,
          speakerKey: 'HOST'
        }
      },
      ingest: async () => {
        ingestCalls++
        throw new Error('corrupt input must not be ingested')
      },
      resolve: unexpectedCall('protected-reference resolve for corrupt input')
    }

    const singleError = await planStandaloneMistralReference(
      mistralOptions(sourcePath, true),
      mistralReferenceInput(sourcePath),
      store
    ).then(() => undefined, (error: unknown) => error)
    expect(singleError).toBeInstanceOf(Error)
    expect((singleError as Error).message).toBe('Protected Mistral reference audio is not a decodable audio input.')
    expect((singleError as Error).message).not.toContain(sourcePath)

    const mapping = `Host=${sourcePath}`
    const speakerError = await planStandaloneMistralSpeakerReferences(
      [mapping],
      [{ speakerKey: 'HOST', sourcePath, authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION }],
      store
    ).then(() => undefined, (error: unknown) => error)
    expect(speakerError).toBeInstanceOf(Error)
    expect((speakerError as Error).message).toBe('Protected Mistral reference audio is not a decodable audio input.')
    expect((speakerError as Error).message).not.toContain(sourcePath)
    expect(planCalls).toBe(2)
    expect(ingestCalls).toBe(0)
  })

  test('source mutation after planning fails before creating the protected store', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'authorized-reference.wav')
    const storeRoot = join(root, 'protected-store')
    await Bun.write(sourcePath, createMockWavBytes({ samples: 800 }))
    const options = mistralOptions(sourcePath, false)
    await planStandaloneMistralReference(
      options,
      mistralReferenceInput(sourcePath),
      createProtectedVoiceAssetStore({ storeId: 'test_mistral_refs', root: storeRoot })
    )
    await Bun.write(sourcePath, createMockWavBytes({ samples: 900 }))

    await expect(materializeStandaloneMistralReference(options)).rejects.toThrow('changed after protected planning')
    expect(await Bun.file(storeRoot).exists()).toBe(false)
  })

  test('source replacement between hash planning and decode is rejected before ingestion', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'authorized-reference.wav')
    const storeRoot = join(root, 'protected-store')
    await Bun.write(sourcePath, createMockWavBytes())
    const baseStore = createProtectedVoiceAssetStore({ storeId: 'test_mistral_refs', root: storeRoot })
    let ingestCalls = 0
    const store: ProtectedVoiceAssetStore = {
      root: baseStore.root,
      plan: async (input) => {
        const planned = await baseStore.plan(input)
        await Bun.write(sourcePath, new Uint8Array([1, 2, 3, 4]))
        return planned
      },
      ingest: async (input, expected) => {
        ingestCalls++
        return await baseStore.ingest(input, expected)
      },
      resolve: async (asset) => await baseStore.resolve(asset)
    }

    await expect(planStandaloneMistralReference(
      mistralOptions(sourcePath, false),
      mistralReferenceInput(sourcePath),
      store
    )).rejects.toThrow('not a decodable audio input')
    expect(ingestCalls).toBe(0)
    expect(await Bun.file(storeRoot).exists()).toBe(false)
  })

  test('output/store containment and symlink overlap fail before ingesting or creating output', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'authorized-reference.wav')
    await Bun.write(sourcePath, createMockWavBytes())
    const storeRoot = join(root, 'protected-store')
    await mkdir(storeRoot)
    const symlinkOutputRoot = join(root, 'output-link')
    await symlink(storeRoot, symlinkOutputRoot)
    let ingestCalls = 0
    const store: ProtectedVoiceAssetStore = {
      root: storeRoot,
      plan: async (input) => ({
        materialization: 'non-materialized',
        protectedAsset,
        authorizationRef: input.authorizationRef,
        byteLength: 9
      }),
      ingest: async () => {
        ingestCalls++
        throw new Error('overlap must stop before ingest')
      },
      resolve: async () => { throw new Error('unexpected resolve') }
    }

    for (const outputPath of [join(storeRoot, 'output'), join(symlinkOutputRoot, 'output')]) {
      const options = mistralOptions(sourcePath, false)
      await planStandaloneMistralReference(options, mistralReferenceInput(sourcePath), store)
      await expect(materializeStandaloneMistralReference(options, outputPath)).rejects.toThrow(
        'Output and the protected voice asset store must be disjoint directories.'
      )
      expect(await Bun.file(outputPath).exists()).toBe(false)
    }
    expect(ingestCalls).toBe(0)
  })

  test('protected execution logs and metadata contain opaque identity, never filesystem paths', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'private-performer-reference.mp3')
    const storeRoot = join(root, 'owner-only-store')
    await Bun.write(sourcePath, await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer())
    const prepared = await prepareStandaloneMistralReference(
      mistralOptions(sourcePath, false),
      mistralReferenceInput(sourcePath),
      createProtectedVoiceAssetStore({ storeId: 'test_mistral_refs', root: storeRoot })
    )
    prepared.hostedTtsChunkScheduler = createMistralTestChunkScheduler()
    const binding = getMistralProtectedReference(prepared)
    expect(binding?.materialization).toBe('materialized')
    const protectedPath = join(storeRoot, 'assets', binding!.protectedAsset.assetId)
    const targets = collectTtsTargets(prepared)

    const previousFetch = globalThis.fetch
    const previousApiKey = process.env['MISTRAL_API_KEY']
    process.env['MISTRAL_API_KEY'] = 'local-mock-key'
    installMockFetch(() => Response.json({ audio_data: createMockWavBase64() }))

    try {
      let result!: Awaited<ReturnType<typeof targets[number]['run']>>
      const captured = await captureConsole(async () => {
        result = await targets[0]!.run('Protected reference logging contract.', root, prepared)
      })
      const logs = [...captured.stdout, ...captured.stderr]
      const observable = `${logs.join('\n')}\n${JSON.stringify(result.metadata)}\n${JSON.stringify({
        service: targets[0]!.service,
        model: targets[0]!.model,
        voice: targets[0]!.voice,
        protectedVoiceAsset: targets[0]!.protectedVoiceAsset
      })}`
      expect(observable).not.toContain(sourcePath)
      expect(observable).not.toContain(storeRoot)
      expect(observable).not.toContain(protectedPath)
      expect(observable).toContain(binding!.protectedAsset.assetId)
    } finally {
      globalThis.fetch = previousFetch
      if (previousApiKey === undefined) delete process.env['MISTRAL_API_KEY']
      else process.env['MISTRAL_API_KEY'] = previousApiKey
    }
  }, 10_000)

  test('deterministic selection errors stop before ingestion', async () => {
    const root = await makeRoot()
    let ingestCalls = 0
    const store: ProtectedVoiceAssetStore = {
      plan: async () => { throw new Error('unexpected plan') },
      ingest: async () => {
        ingestCalls++
        throw new Error('unexpected ingest')
      },
      resolve: async () => { throw new Error('unexpected resolve') }
    }

    const sourcePath = join(root, 'reference.wav')
    await expect(prepareStandaloneMistralReference({
      ...mistralOptions(sourcePath, false),
      mistralTtsVoice: 'saved_voice_id'
    }, mistralReferenceInput(sourcePath), store)).rejects.toThrow(
      'Mistral TTS requires exactly one voice source'
    )
    expect(ingestCalls).toBe(0)
  })
})
