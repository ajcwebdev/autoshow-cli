import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CanonicalAudioProviderProjection, ProtectedAssetRef, ProtectedVoiceAssetStore, TtsCliReferenceInput, TtsOptions, TtsTarget, TtsTargetInvocation } from '~/types'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { getMistralProtectedReference, getMistralProtectedSpeakerReferences } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-protected-reference-binding'
import { materializeStandaloneMistralReference, planStandaloneMistralReference, planStandaloneMistralSpeakerReferences, prepareStandaloneMistralReference } from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import { createMockWavBase64, createMockWavBytes } from '../../../test-utils/media-fixtures'
import { runSingleTtsInput, runTtsDirectoryBatch } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { resolveStandaloneMistralTtsCliReferenceInput, resolveStandaloneMistralTtsSpeakerReferenceInputs } from '~/cli/options/option-resolution/tts-options'
import { runMultiSpeakerTts } from '~/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { assertMistralReferenceAudioDecodable } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-reference-audio-preflight'

const roots: string[] = []

const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-mistral-protected-integration-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  resetPinnedRunDir()
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })))
})

const protectedAsset: ProtectedAssetRef = {
  storeId: 'mistral_request_refs_v1',
  assetId: `sha256_${'a'.repeat(64)}`,
  sha256: 'a'.repeat(64)
}

const mistralOptions = (
  _sourcePath: string,
  price: boolean
): TtsOptions & { price: boolean } => ({
  mistralTtsModels: ['voxtral-mini-tts-2603'],
  price
})

const mistralReferenceInput = (sourcePath: string): TtsCliReferenceInput => ({
  sourcePath,
  authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
})

const planSpeakerReferenceOptions = async (
  mappings: readonly string[],
  store: ProtectedVoiceAssetStore,
  price: boolean
): Promise<TtsOptions & { price: boolean }> => {
  const flags = { 'tts-speaker': [...mappings] }
  const occurrences = mappings.map((value) => ({
    name: 'tts-speaker',
    raw: `--tts-speaker=${value}`,
    value,
    known: true
  }))
  const inputs = resolveStandaloneMistralTtsSpeakerReferenceInputs(flags, {
    explicitFlags: new Set(['tts-speaker']),
    flagOccurrences: occurrences,
    cliReferenceInput: 'standalone-mistral'
  })
  const plan = await planStandaloneMistralSpeakerReferences(mappings, inputs, store)
  if (!plan) throw new Error('Expected a protected Mistral speaker-reference plan.')
  return plan.attach({
    mistralTtsModels: ['voxtral-mini-tts-2603'],
    ttsDialogueFormat: 'labeled',
    ttsSpeakers: [...plan.ttsSpeakers],
    price
  })
}

describe('standalone Mistral protected request references', () => {
  test('decodability probes resolve option-like relative source paths before invoking tools', async () => {
    const observedInputs: string[] = []
    await assertMistralReferenceAudioDecodable('-private-reference.wav', async (_command, args) => {
      if (args.length === 1 && args[0] === '-version') return { exitCode: 0, stdout: 'ready\n', stderr: '' }
      const inputIndex = args.indexOf('-i')
      const input = inputIndex >= 0 ? args[inputIndex + 1] : args.at(-1)
      if (input) observedInputs.push(input)
      return inputIndex >= 0
        ? { exitCode: 0, stdout: '', stderr: '' }
        : { exitCode: 0, stdout: 'audio\n', stderr: '' }
    })

    expect(observedInputs).toHaveLength(2)
    expect(observedInputs.every((input) => input.startsWith('/'))).toBe(true)
    expect(observedInputs.every((input) => input.endsWith('/-private-reference.wav'))).toBe(true)
  })

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

  test('per-speaker execution ingests unique assets once and resolves A/B/A references just in time', async () => {
    const root = await makeRoot()
    const hostPath = join(root, 'host-private.wav')
    const guestPath = join(root, 'guest-private.wav')
    const storeRoot = join(root, 'protected-speaker-store')
    const runDir = join(root, 'run')
    const hostBytes = createMockWavBytes({ samples: 800 })
    const guestBytes = createMockWavBytes({ samples: 900 })
    await Bun.write(hostPath, hostBytes)
    await Bun.write(guestPath, guestBytes)
    await mkdir(runDir)
    const baseStore = createProtectedVoiceAssetStore({ storeId: 'test_mistral_speaker_refs', root: storeRoot })
    let ingestCalls = 0
    let resolveCalls = 0
    const store: ProtectedVoiceAssetStore = {
      root: baseStore.root,
      plan: async (input) => await baseStore.plan(input),
      ingest: async (input, expected) => { ingestCalls++; return await baseStore.ingest(input, expected) },
      resolve: async (asset) => { resolveCalls++; return await baseStore.resolve(asset) }
    }
    let options = await planSpeakerReferenceOptions([
      `Host=${hostPath}`,
      `Guest=${guestPath}`
    ], store, false)
    options = await materializeStandaloneMistralReference(options, runDir)
    expect(ingestCalls).toBe(2)
    expect(resolveCalls).toBe(0)
    const target = collectTtsTargets(options)[0]
    if (!target) throw new Error('Expected the protected Mistral dialogue target.')

    const previousFetch = globalThis.fetch
    const previousApiKey = process.env['MISTRAL_API_KEY']
    const calls: Array<Record<string, unknown>> = []
    process.env['MISTRAL_API_KEY'] = 'local-mock-key'
    globalThis.fetch = (async (_input, init) => {
      calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return Response.json({ audio_data: createMockWavBase64() })
    }) as typeof fetch
    try {
      const result = await runMultiSpeakerTts(
        'Host: First line.\nGuest: Second line.\nHost: Third line.',
        runDir,
        target,
        options
      )
      expect(resolveCalls).toBe(3)
      expect(calls).toHaveLength(3)
      const hostReference = Buffer.from(hostBytes).toString('base64')
      const guestReference = Buffer.from(guestBytes).toString('base64')
      expect(calls.filter((call) => call['ref_audio'] === hostReference).map((call) => call['input']).sort()).toEqual(['First line.', 'Third line.'])
      expect(calls.filter((call) => call['ref_audio'] === guestReference).map((call) => call['input'])).toEqual(['Second line.'])
      const observable = JSON.stringify({
        options,
        target: { ...target, run: undefined },
        metadata: result.metadata
      })
      expect(observable).not.toContain(hostPath)
      expect(observable).not.toContain(guestPath)
      expect(observable).not.toContain(storeRoot)
    } finally {
      globalThis.fetch = previousFetch
      if (previousApiKey === undefined) delete process.env['MISTRAL_API_KEY']
      else process.env['MISTRAL_API_KEY'] = previousApiKey
    }
  }, 10_000)

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
      resolve: async () => { throw new Error('corrupt input must not resolve') }
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

  test('execution ingests once and resolves only inside target execution', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'private-performer-reference.mp3')
    await Bun.write(sourcePath, createMockWavBytes())
    const protectedPath = join(root, 'owner-only-store', 'assets', protectedAsset.assetId)
    let planCalls = 0
    let ingestCalls = 0
    let resolveCalls = 0
    const store: ProtectedVoiceAssetStore = {
      plan: async (input) => {
        planCalls++
        return {
          materialization: 'non-materialized',
          protectedAsset,
          authorizationRef: input.authorizationRef,
          byteLength: 123
        }
      },
      ingest: async (input) => {
        ingestCalls++
        expect(input.sourcePath).toBe(sourcePath)
        return {
          materialization: 'materialized',
          protectedAsset,
          authorizationRef: input.authorizationRef,
          byteLength: 123
        }
      },
      resolve: async () => {
        resolveCalls++
        throw new Error('just-in-time resolver sentinel')
      }
    }

    const prepared = await prepareStandaloneMistralReference(
      mistralOptions(sourcePath, false),
      mistralReferenceInput(sourcePath),
      store
    )
    expect(planCalls).toBe(1)
    expect(ingestCalls).toBe(1)
    expect(resolveCalls).toBe(0)
    expect('mistralTtsRefAudio' in prepared).toBe(false)

    const targets = collectTtsTargets(prepared)
    expect(resolveCalls).toBe(0)
    expect(JSON.stringify(prepared)).not.toContain(sourcePath)
    expect(JSON.stringify(prepared)).not.toContain(protectedPath)

    await expect(targets[0]!.run('resolve immediately before synthesis', root, prepared))
      .rejects.toThrow('just-in-time resolver sentinel')
    expect(resolveCalls).toBe(1)
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
    const binding = getMistralProtectedReference(prepared)
    expect(binding?.materialization).toBe('materialized')
    const protectedPath = join(storeRoot, 'assets', binding!.protectedAsset.assetId)
    const targets = collectTtsTargets(prepared)

    const previousFetch = globalThis.fetch
    const previousApiKey = process.env['MISTRAL_API_KEY']
    const previousConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    }
    const logs: string[] = []
    console.log = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
    console.warn = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
    console.error = (...args: unknown[]) => { logs.push(args.map(String).join(' ')) }
    process.env['MISTRAL_API_KEY'] = 'local-mock-key'
    globalThis.fetch = (async () => Response.json({ audio_data: createMockWavBase64() })) as unknown as typeof fetch

    try {
      const result = await targets[0]!.run('Protected reference logging contract.', root, prepared)
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
      console.log = previousConsole.log
      console.warn = previousConsole.warn
      console.error = previousConsole.error
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

  test('configured paths and dialogue path mappings fail locally with migration guidance', async () => {
    const root = await makeRoot()
    let ingestionCalls = 0
    const store: ProtectedVoiceAssetStore = {
      plan: async () => { ingestionCalls++; throw new Error('unexpected plan') },
      ingest: async () => { ingestionCalls++; throw new Error('unexpected ingest') },
      resolve: async () => { throw new Error('unexpected resolve') }
    }

    expect(() => resolveStandaloneMistralTtsCliReferenceInput({
      'mistral-tts-ref-audio': join(root, 'configured.wav')
    }, {
      configuredFlags: new Set(['mistral-tts-ref-audio']),
      cliReferenceInput: 'standalone-mistral'
    })).toThrow('Configured --mistral-tts-ref-audio paths cannot be used as synthesis defaults')

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

  const plannedExecution = async (
    sourcePath: string,
    store: ProtectedVoiceAssetStore
  ) => {
    await Bun.write(sourcePath, createMockWavBytes())
    const options = {
      ...mistralOptions(sourcePath, false),
      batchConcurrency: 1,
      allowOverBudget: false
    }
    await planStandaloneMistralReference(options, mistralReferenceInput(sourcePath), store)
    return { options, targets: collectTtsTargets(options) }
  }

  const admissionStore = (onIngest: () => void): ProtectedVoiceAssetStore => ({
    plan: async (input) => ({
      materialization: 'non-materialized',
      protectedAsset,
      authorizationRef: input.authorizationRef,
      byteLength: 123
    }),
    ingest: async (input) => {
      onIngest()
      return {
        materialization: 'materialized',
        protectedAsset,
        authorizationRef: input.authorizationRef,
        byteLength: 123
      }
    },
    resolve: async () => { throw new Error('provider execution is not expected') }
  })

  test('invalid single-file input is rejected before execution ingestion', async () => {
    const root = await makeRoot()
    const inputPath = join(root, 'script.json')
    await Bun.write(inputPath, '{"text":"not a supported input"}\n')
    let ingestCalls = 0
    const { options, targets } = await plannedExecution(
      join(root, 'reference.wav'),
      admissionStore(() => { ingestCalls++ })
    )

    await expect(runSingleTtsInput(inputPath, options, targets, undefined)).rejects.toThrow(
      'tts only accepts .md or .txt files'
    )
    expect(ingestCalls).toBe(0)
  })

  test('an empty input directory exits before execution ingestion', async () => {
    const root = await makeRoot()
    const inputDir = join(root, 'empty-inputs')
    await mkdir(inputDir)
    let ingestCalls = 0
    const { options, targets } = await plannedExecution(
      join(root, 'reference.wav'),
      admissionStore(() => { ingestCalls++ })
    )

    await runTtsDirectoryBatch(inputDir, options, targets, undefined)
    expect(ingestCalls).toBe(0)
  })

  test('an over-budget input is rejected before execution ingestion', async () => {
    const root = await makeRoot()
    const inputPath = join(root, 'script.txt')
    await Bun.write(inputPath, 'This input has a non-zero Mistral synthesis estimate.')
    let ingestCalls = 0
    const { options, targets } = await plannedExecution(
      join(root, 'reference.wav'),
      admissionStore(() => { ingestCalls++ })
    )

    await expect(runSingleTtsInput(inputPath, options, targets, 0)).rejects.toThrow(
      'exceeds configured budget'
    )
    expect(ingestCalls).toBe(0)
  })

  test('the full selected target set passes static credential preflight before execution ingestion', async () => {
    const root = await makeRoot()
    const inputPath = join(root, 'script.txt')
    const outputDir = join(root, 'run')
    await Bun.write(inputPath, 'Every selected target must validate before protected ingestion.')
    configurePinnedRunDir(outputDir)
    let ingestCalls = 0
    const { options, targets } = await plannedExecution(
      join(root, 'reference.wav'),
      admissionStore(() => { ingestCalls++ })
    )
    const priorMistralKey = process.env['MISTRAL_API_KEY']
    const priorOpenAiKey = process.env['OPENAI_API_KEY']
    process.env['MISTRAL_API_KEY'] = 'local-preflight-fixture'
    delete process.env['OPENAI_API_KEY']
    const openAiTarget: TtsTarget = {
      service: 'openai',
      model: 'gpt-4o-mini-tts-2025-12-15',
      operation: 'tts-synthesis',
      targetKey: canonicalTargetKey('tts-synthesis', 'openai', 'gpt-4o-mini-tts-2025-12-15', 'hosted-api'),
      transport: 'hosted-api',
      run: async () => { throw new Error('provider execution is not expected') }
    }

    try {
      await expect(runSingleTtsInput(
        inputPath,
        options,
        [...targets, openAiTarget],
        undefined
      )).rejects.toThrow('OPENAI_API_KEY')
      expect(ingestCalls).toBe(0)
      const manifest = await readManifest(outputDir)
      expect(manifest?.items[0]?.providers).toHaveLength(2)
      expect(manifest?.items[0]?.providers.every((provider) => provider.status === 'failed' && provider.attempts === 0)).toBe(true)
      const projections = manifest?.items[0]?.providers.map((provider) => provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection) ?? []
      expect(projections.every((projection) => projection.renderHistory.length === 0)).toBe(true)
      expect(projections.map((projection) => projection.readinessAttempts[0]?.admissionDisposition)).toEqual([
        'peer-blocked',
        'self-blocked'
      ])
    } finally {
      if (priorMistralKey === undefined) delete process.env['MISTRAL_API_KEY']
      else process.env['MISTRAL_API_KEY'] = priorMistralKey
      if (priorOpenAiKey === undefined) delete process.env['OPENAI_API_KEY']
      else process.env['OPENAI_API_KEY'] = priorOpenAiKey
    }
  })
})
