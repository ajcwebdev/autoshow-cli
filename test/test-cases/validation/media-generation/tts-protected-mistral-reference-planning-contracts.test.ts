import { afterEach, describe, expect, test } from 'bun:test'
import { statPath as stat } from '~/utils/bun-file-io'
import { join } from 'node:path'
import type { ProtectedVoiceAssetStore } from '~/types'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { getMistralProtectedReference, getMistralProtectedSpeakerReferences } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-protected-reference-binding'
import { materializeStandaloneMistralReference, planStandaloneMistralSpeakerReferences, prepareStandaloneMistralReference } from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { resolveStandaloneMistralTtsCliReferenceInput, resolveStandaloneMistralTtsSpeakerReferenceInputs } from '~/cli/options/option-resolution/tts-options'
import { resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { assertMistralReferenceAudioDecodable } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-reference-audio-preflight'
import { createMistralProtectedFixture, mistralOptions, mistralReferenceInput, planSpeakerReferenceOptions, protectedAsset } from './tts-protected-mistral-reference-fixture'

const mistralFixture = createMistralProtectedFixture()
const makeRoot = mistralFixture.makeRoot

afterEach(async () => {
  resetPinnedRunDir()
  await mistralFixture.cleanup()
})

describe('standalone Mistral protected request references', () => {
  test('an unavailable audio runtime defers source probing to all-target readiness', async () => {
    let sourceProbeCalls = 0
    const status = await assertMistralReferenceAudioDecodable('/private/reference.wav', async (_command, args) => {
      if (args.length !== 1 || args[0] !== '-version') sourceProbeCalls++
      return { exitCode: 1, stdout: '', stderr: 'not configured' }
    })

    expect(status).toBe('runtime-unavailable')
    expect(sourceProbeCalls).toBe(0)
  })

  test('per-speaker price planning hashes explicit refs without writes and sanitizes runtime mappings', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'shared-private-speaker.wav')
    const storeRoot = join(root, 'protected-speaker-store')
    await Bun.write(sourcePath, createMockWavBytes({ samples: 800 }))
    const baseStore = createProtectedVoiceAssetStore({ storeId: 'test_mistral_speaker_refs', root: storeRoot })
    let planCalls = 0
    let ingestCalls = 0
    const store: ProtectedVoiceAssetStore = {
      root: baseStore.root,
      plan: async (input) => { planCalls++; return await baseStore.plan(input) },
      ingest: async (input, expected) => { ingestCalls++; return await baseStore.ingest(input, expected) },
      resolve: async (asset) => await baseStore.resolve(asset)
    }

    const options = await planSpeakerReferenceOptions([
      `Host=${sourcePath}`,
      `Guest=${sourcePath}`
    ], store, true)
    const binding = getMistralProtectedSpeakerReferences(options)
    expect(planCalls).toBe(1)
    expect(ingestCalls).toBe(0)
    expect(binding?.materialization).toBe('non-materialized')
    expect(binding?.entries).toHaveLength(2)
    expect(new Set(binding?.entries.map((entry) => entry.protectedAsset.assetId)).size).toBe(1)
    expect(options.ttsSpeakers?.every((mapping) => mapping.includes('=ref_audio:sha256_'))).toBe(true)

    const targets = collectTtsTargets(options)
    const observable = JSON.stringify({
      options,
      targets: targets.map(({ run: _run, ...target }) => target)
    })
    expect(observable).not.toContain(sourcePath)
    expect(observable).not.toContain(root)
    expect(await Bun.file(storeRoot).exists()).toBe(false)
    await expect(materializeStandaloneMistralReference(options)).rejects.toThrow('Price planning cannot materialize')
    expect(ingestCalls).toBe(0)

    const executionOptions = await planSpeakerReferenceOptions([
      `Host=${sourcePath}`,
      `Guest=${sourcePath}`
    ], store, false)
    await materializeStandaloneMistralReference(executionOptions, join(root, 'run'))
    expect(ingestCalls).toBe(1)
  })

  test('price with the real store adapter leaves the protected root unmaterialized', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'authorized-reference.wav')
    const storeRoot = join(root, 'protected-store')
    await Bun.write(sourcePath, createMockWavBytes())

    await prepareStandaloneMistralReference(
      mistralOptions(sourcePath, true),
      mistralReferenceInput(sourcePath),
      createProtectedVoiceAssetStore({ storeId: 'test_mistral_refs', root: storeRoot })
    )

    const storeExists = await stat(storeRoot).then(() => true).catch(() => false)
    expect(storeExists).toBe(false)
  })

  test('price plans without ingesting or exposing a resolver/path', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'private-performer-reference.wav')
    await Bun.write(sourcePath, createMockWavBytes())
    let planCalls = 0
    let ingestCalls = 0
    let resolveCalls = 0
    const store: ProtectedVoiceAssetStore = {
      plan: async (input) => {
        planCalls++
        expect(input.sourcePath).toBe(sourcePath)
        expect(input.authorizationRef).toBe('explicit-cli:mistral-request-reference-v1')
        return {
          materialization: 'non-materialized',
          protectedAsset,
          authorizationRef: input.authorizationRef,
          byteLength: 123
        }
      },
      ingest: async () => {
        ingestCalls++
        throw new Error('price must not ingest')
      },
      resolve: async () => {
        resolveCalls++
        throw new Error('price must not resolve')
      }
    }

    const unresolved = mistralOptions(sourcePath, true)
    const prepared = await prepareStandaloneMistralReference(
      unresolved,
      mistralReferenceInput(sourcePath),
      store
    )

    expect(planCalls).toBe(1)
    expect(ingestCalls).toBe(0)
    expect(resolveCalls).toBe(0)
    expect(prepared).toBe(unresolved)
    expect('mistralTtsRefAudio' in unresolved).toBe(false)
    expect('mistralTtsRefAudio' in prepared).toBe(false)
    expect(getMistralProtectedReference(prepared)).toMatchObject({
      materialization: 'non-materialized',
      protectedAsset
    })
    expect(getMistralProtectedReference({ ...prepared })).toBeUndefined()

    const targets = collectTtsTargets(prepared)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.voice).toBe(`ref_audio:${protectedAsset.assetId}`)
    expect(targets[0]?.protectedVoiceAsset).toEqual(protectedAsset)
    const serialized = JSON.stringify({
      options: prepared,
      targets: targets.map(({ run: _run, ...target }) => target)
    })
    expect(serialized).not.toContain(sourcePath)
    expect(serialized).not.toContain(root)

    await expect(targets[0]!.run('price must not execute', root, prepared))
      .rejects.toThrow('non-materialized Mistral reference plan cannot execute')
    expect(resolveCalls).toBe(0)
  })

  test('configured paths and dialogue path mappings fail locally with migration guidance', async () => {
    const root = await makeRoot()
    let ingestionCalls = 0
    const store: ProtectedVoiceAssetStore = {
      plan: async () => { ingestionCalls++; throw new Error('unexpected plan') },
      ingest: async () => { ingestionCalls++; throw new Error('unexpected ingest') },
      resolve: async () => { throw new Error('unexpected resolve') }
    }

    expect(() => resolveStandaloneMistralTtsCliReferenceInput({
      'tts-ref-audio': join(root, 'configured.wav')
    }, {
      configuredFlags: new Set(['tts-ref-audio']),
      cliReferenceInput: 'standalone-mistral'
    })).toThrow('Configured --tts-ref-audio paths cannot be used as synthesis defaults')

    expect(() => resolveStandaloneMistralTtsSpeakerReferenceInputs({
      'tts-speaker': [`Host=${join(root, 'configured-host.wav')}`]
    }, {
      configuredFlags: new Set(['tts-speaker']),
      cliReferenceInput: 'standalone-mistral'
    })).toThrow('Configured --tts-speaker SPEAKER=path mappings cannot be used as synthesis defaults')

    const nonMistralPath = join(root, 'non-mistral.wav')
    await Bun.write(nonMistralPath, createMockWavBytes())
    const nonMistralMapping = `Host=${nonMistralPath}`
    const nonMistralInputs = resolveStandaloneMistralTtsSpeakerReferenceInputs({
      'tts-speaker': [nonMistralMapping]
    }, {
      explicitFlags: new Set(['tts-speaker']),
      flagOccurrences: [{ name: 'tts-speaker', raw: `--tts-speaker=${nonMistralMapping}`, value: nonMistralMapping, known: true }],
      cliReferenceInput: 'standalone-mistral'
    })
    const nonMistralPlan = await planStandaloneMistralSpeakerReferences([nonMistralMapping], nonMistralInputs, {
      plan: async (input) => ({ materialization: 'non-materialized', protectedAsset, authorizationRef: input.authorizationRef, byteLength: 4, speakerKey: input.speakerKey }),
      ingest: async () => { throw new Error('unexpected ingest') },
      resolve: async () => { throw new Error('unexpected resolve') }
    })
    expect(() => nonMistralPlan?.attach({
      groqTtsModels: ['canopylabs/orpheus-v1-english'],
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: [...(nonMistralPlan?.ttsSpeakers ?? [])],
      price: true
    })).toThrow('supported only by one explicitly selected Mistral TTS target')

    await expect(prepareStandaloneMistralReference({
      mistralTtsModels: ['voxtral-mini-tts-2603'],
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: [`Host=${join(root, 'host.wav')}`],
      price: false
    }, undefined, store)).rejects.toThrow(
      'must cross protected ingestion as exact per-speaker opaque assets'
    )
    const standaloneReferencePath = join(root, 'standalone-reference.wav')
    await expect(prepareStandaloneMistralReference({
      mistralTtsModels: ['voxtral-mini-tts-2603'],
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: ['Host=voice_host', 'Guest=voice_guest'],
      price: false
    }, mistralReferenceInput(standaloneReferencePath), store)).rejects.toThrow(
      'cannot be combined with dialogue voice mappings'
    )
    expect(ingestionCalls).toBe(0)
  })

})
