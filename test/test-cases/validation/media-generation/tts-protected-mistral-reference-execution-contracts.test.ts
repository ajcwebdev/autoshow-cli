import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { CanonicalAudioProviderProjection, ProtectedVoiceAssetStore, TtsTarget } from '~/types'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { materializeStandaloneMistralReference, prepareStandaloneMistralReference } from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import { createMockWavBase64, createMockWavBytes } from '../../../test-utils/media-fixtures'
import { runSingleTtsInput, runTtsDirectoryBatch } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { runMultiSpeakerTts } from '~/cli/commands/process-steps/step-4-tts/run-multi-speaker-tts'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { assertMistralReferenceAudioDecodable } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-reference-audio-preflight'
import { installMockFetch } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'
import { admissionStore, createMistralProtectedFixture, mistralOptions, mistralReferenceInput, plannedExecution, planSpeakerReferenceOptions, protectedAsset } from './tts-protected-mistral-reference-fixture'

const mistralFixture = createMistralProtectedFixture()
const makeRoot = mistralFixture.makeRoot

afterEach(async () => {
  resetPinnedRunDir()
  await mistralFixture.cleanup()
})

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
    const target = requireDefined(collectTtsTargets(options)[0], 'the protected Mistral dialogue target')

    const previousFetch = globalThis.fetch
    const previousApiKey = process.env['MISTRAL_API_KEY']
    process.env['MISTRAL_API_KEY'] = 'local-mock-key'
    const mockCalls = installMockFetch(() => Response.json({ audio_data: createMockWavBase64() }))
    const calls = (): Array<Record<string, unknown>> =>
      mockCalls.map((call) => call.bodyJson ?? {})
    try {
      const result = await runMultiSpeakerTts(
        'Host: First line.\nGuest: Second line.\nHost: Third line.',
        runDir,
        target,
        options
      )
      expect(resolveCalls).toBe(3)
      expect(calls()).toHaveLength(3)
      const hostReference = Buffer.from(hostBytes).toString('base64')
      const guestReference = Buffer.from(guestBytes).toString('base64')
      expect(calls().filter((call) => call['ref_audio'] === hostReference).map((call) => call['input']).sort()).toEqual(['First line.', 'Third line.'])
      expect(calls().filter((call) => call['ref_audio'] === guestReference).map((call) => call['input'])).toEqual(['Second line.'])
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
