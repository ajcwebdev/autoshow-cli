import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { runSingleTtsInput, runTtsDirectoryBatch } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { planStandaloneMistralReference } from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import { runTtsTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import type { CanonicalAudioProviderProjection, HostedFixture, PipelineProviderState, ProtectedVoiceAssetStore, ProviderReadinessResult, TtsProvider, TtsTarget } from '~/types'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { requireDefined } from '../../../test-utils/value-assertions'

const hostedFixture = (
  service: Extract<TtsProvider, 'openai' | 'groq'>,
  model: string,
  voice: string
): HostedFixture => {
  const calls = { run: 0, setup: 0, fetch: 0 }
  return {
    calls,
    target: {
      service,
      model,
      voice,
      operation: 'tts-synthesis',
      transport: 'hosted-api',
      targetKey: canonicalTargetKey('tts-synthesis', service, model, 'hosted-api'),
      run: async () => {
        calls.run++
        calls.setup++
        calls.fetch++
        throw new Error('Readiness fixtures must never reach provider setup or dispatch.')
      }
    }
  }
}

const commandOptions = (): Parameters<typeof runSingleTtsInput>[1] => ({
  batchConcurrency: 1,
  price: false,
  allowOverBudget: false
})

const projectionFor = (provider: NonNullable<Awaited<ReturnType<typeof readManifest>>>['items'][number]['providers'][number]): CanonicalAudioProviderProjection =>
  provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection

const readReadinessResult = async (
  outputDir: string,
  provider: NonNullable<Awaited<ReturnType<typeof readManifest>>>['items'][number]['providers'][number]
): Promise<ProviderReadinessResult> => {
  const projection = projectionFor(provider)
  const reference = projection.readinessAttempts[0]
  expect(reference).toBeDefined()
  return await Bun.file(join(outputDir, provider.artifactDir, reference!.readinessResultRef)).json() as ProviderReadinessResult
}

const expectBranchOnlyFailure = async (
  outputDir: string,
  provider: NonNullable<Awaited<ReturnType<typeof readManifest>>>['items'][number]['providers'][number]
): Promise<CanonicalAudioProviderProjection> => {
  expect(provider).toMatchObject({ status: 'failed', attempts: 0 })
  const projection = projectionFor(provider)
  expect(projection.activeWork).toMatchObject({ kind: 'branch', readinessAttemptSequence: 1 })
  expect(projection.branchHistory).toHaveLength(1)
  expect(projection.readinessAttempts).toHaveLength(1)
  expect(projection.pointerEvents.map((entry) => entry.action)).toEqual([
    'activate-branch',
    'project-branch-readiness'
  ])
  expect(projection.renderHistory).toEqual([])
  expect(projection.selectedSuccess).toBeUndefined()

  const branch = projection.branchHistory[0]!
  const readiness = projection.readinessAttempts[0]!
  expect(await Bun.file(join(outputDir, provider.artifactDir, branch.branchPlanRef)).exists()).toBe(true)
  expect(await Bun.file(join(outputDir, provider.artifactDir, readiness.readinessResultRef)).exists()).toBe(true)
  const paths = await readdir(join(outputDir, provider.artifactDir), { recursive: true })
  expect(paths.some((path) => /render-plan|admission-journal|provider-render-result|audio-run/.test(path))).toBe(false)
  expect(paths.some((path) => path.split('/').includes('renders'))).toBe(false)
  return projection
}

const withHostedCredentials = async <T>(
  values: Partial<Record<'OPENAI_API_KEY' | 'GROQ_API_KEY' | 'MISTRAL_API_KEY', string | undefined>>,
  operation: () => Promise<T>
): Promise<T> => {
  const prior = {
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
    GROQ_API_KEY: process.env['GROQ_API_KEY'],
    MISTRAL_API_KEY: process.env['MISTRAL_API_KEY']
  }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return await operation()
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

afterEach(() => resetPinnedRunDir())

describe('canonical TTS execution-readiness failures', () => {
  test('deterministic render validation fails before any runtime readiness probe', async () => {
    await withTempDir('autoshow-tts-readiness-static-first-', async (dir) => {
      const binDir = join(dir, 'probe-bin')
      const marker = join(dir, 'readiness-probe-ran')
      await mkdir(binDir)
      for (const tool of ['ffmpeg', 'ffprobe']) {
        await Bun.write(join(binDir, tool), `#!/bin/sh\nprintf called >> "${marker}"\nexit 37\n`)
        await chmod(join(binDir, tool), 0o700)
      }
      const openai = hostedFixture('openai', 'gpt-4o-mini-tts-2025-12-15', 'alloy')
      const priorBinDir = getConfiguredBinDir()
      configureBinDir(binDir)
      try {
        await expect(runTtsTargets(
          [openai.target],
          'HOST: Validate before probing.',
          join(dir, 'run'),
          {
            ttsDialogueFormat: 'labeled',
            ttsSpeakers: [`HOST=ref_audio:sha256_${'a'.repeat(64)}`]
          }
        )).rejects.toThrow('does not bind its exact protected asset before render planning')
      } finally {
        configureBinDir(priorBinDir ?? '')
      }
      expect(await Bun.file(marker).exists()).toBe(false)
      expect(openai.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
    })
  })

  test('fresh blocking narrows stale ready while pre-ingest blocking cannot be widened', async () => {
    await withTempDir('autoshow-tts-readiness-freshness-', async (dir) => {
      const text = 'Readiness observations can narrow but never widen execution admission.'
      const sourceIdentity = createInlineTtsSourceIdentity(text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const openai = hostedFixture('openai', 'gpt-4o-mini-tts-2025-12-15', 'alloy')
      const freshBlockedDir = join(dir, 'fresh-blocked')
      const stickyBlockedDir = join(dir, 'sticky-blocked')
      await mkdir(freshBlockedDir)
      await mkdir(stickyBlockedDir)
      let staleReadyStates: PipelineProviderState[] = []
      await withHostedCredentials({ OPENAI_API_KEY: undefined }, async () => {
        await expect(runTtsTargets([openai.target], text, freshBlockedDir, {}, {
          sourceIdentity,
          dialoguePlan,
          executionReadiness: [{
            targetKey: openai.target.targetKey as string,
            accountState: 'available',
            status: 'ready'
          }],
          beforeDispatch: async (states) => { staleReadyStates = states }
        })).rejects.toThrow('OPENAI_API_KEY')
      })
      expect(projectionFor(staleReadyStates[0]!).readinessAttempts[0]).toMatchObject({
        status: 'blocked',
        admissionDisposition: 'self-blocked'
      })

      let stickyBlockedStates: PipelineProviderState[] = []
      await withHostedCredentials({ OPENAI_API_KEY: 'configured-after-pre-ingest-block' }, async () => {
        await expect(runTtsTargets([openai.target], text, stickyBlockedDir, {}, {
          sourceIdentity,
          dialoguePlan,
          executionReadiness: [{
            targetKey: openai.target.targetKey as string,
            accountState: 'not-configured',
            status: 'blocked',
            error: {
              phase: 'readiness',
              code: 'provider-credential-not-configured',
              message: 'Pre-ingest credential observation remains authoritative.',
              retryable: false,
              blockedReason: 'provider-credential-not-configured'
            }
          }],
          beforeDispatch: async (states) => { stickyBlockedStates = states }
        })).rejects.toThrow('Pre-ingest credential observation remains authoritative')
      })
      expect(projectionFor(stickyBlockedStates[0]!).readinessAttempts[0]).toMatchObject({
        status: 'blocked',
        admissionDisposition: 'self-blocked'
      })
      expect(openai.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
    })
  })

  test('one blocked hosted target is retained as a self-blocked zero-attempt branch', async () => {
    await withTempDir('autoshow-tts-readiness-single-', async (dir) => {
      const inputPath = join(dir, 'source.txt')
      const outputDir = join(dir, 'run')
      await Bun.write(inputPath, 'Readiness must fail before provider setup.')
      configurePinnedRunDir(outputDir)
      const openai = hostedFixture('openai', 'gpt-4o-mini-tts-2025-12-15', 'alloy')

      await withHostedCredentials({ OPENAI_API_KEY: undefined }, async () => {
        await expect(runSingleTtsInput(inputPath, commandOptions(), [openai.target], undefined)).rejects.toThrow('OPENAI_API_KEY')
      })

      const manifest = await readManifest(outputDir)
      expect(manifest?.items[0]?.status).toBe('failed')
      const provider = manifest?.items[0]?.providers[0]
      expect(provider).toBeDefined()
      const projection = await expectBranchOnlyFailure(outputDir, provider!)
      expect(projection.readinessAttempts[0]).toMatchObject({
        status: 'blocked',
        admissionDisposition: 'self-blocked',
        error: {
          phase: 'readiness',
          code: 'provider-credential-not-configured',
          blockedReason: 'provider-credential-not-configured'
        }
      })
      const readinessResult = await readReadinessResult(outputDir, provider!)
      expect(readinessResult.status).toBe('blocked')
      expect(readinessResult.capabilityObservations[0]?.state).toBe('not-configured')
      expect(readinessResult.candidateReadiness[0]?.status).toBe('blocked')
      expect(openai.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
    })
  })

  test('a broken shared media runtime blocks hosted synthesis before setup or dispatch', async () => {
    await withTempDir('autoshow-tts-readiness-media-runtime-', async (dir) => {
      const inputPath = join(dir, 'source.txt')
      const outputDir = join(dir, 'run')
      const binDir = join(dir, 'broken-bin')
      await mkdir(binDir)
      await Bun.write(join(binDir, 'ffmpeg'), '#!/bin/sh\nexit 37\n')
      await Bun.write(join(binDir, 'ffprobe'), '#!/bin/sh\nexit 37\n')
      await chmod(join(binDir, 'ffmpeg'), 0o700)
      await chmod(join(binDir, 'ffprobe'), 0o700)
      await Bun.write(inputPath, 'Shared media tools must be ready before hosted synthesis.')
      configurePinnedRunDir(outputDir)
      const openai = hostedFixture('openai', 'gpt-4o-mini-tts-2025-12-15', 'alloy')
      const priorBinDir = getConfiguredBinDir()

      configureBinDir(binDir)
      try {
        await withHostedCredentials({ OPENAI_API_KEY: 'configured-for-local-fixture' }, async () => {
          await expect(runSingleTtsInput(inputPath, commandOptions(), [openai.target], undefined)).rejects.toThrow('ffmpeg and ffprobe')
        })
      } finally {
        configureBinDir(priorBinDir ?? '')
      }

      const provider = (await readManifest(outputDir))?.items[0]?.providers[0]
      expect(provider).toBeDefined()
      const projection = await expectBranchOnlyFailure(outputDir, provider!)
      expect(projection.readinessAttempts[0]).toMatchObject({
        status: 'blocked',
        admissionDisposition: 'self-blocked',
        error: {
          code: 'local-media-runtime-not-ready',
          blockedReason: 'local-setup-required'
        }
      })
      expect(openai.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
    })
  })

  test('a broken shared media runtime blocks protected Mistral and its hosted peer before ingestion', async () => {
    await withTempDir('autoshow-tts-readiness-protected-media-runtime-', async (dir) => {
      const inputPath = join(dir, 'source.txt')
      const referencePath = join(dir, 'private-reference.wav')
      const outputDir = join(dir, 'run')
      const storeRoot = join(dir, 'protected-store')
      const binDir = join(dir, 'broken-bin')
      await mkdir(binDir)
      await Bun.write(join(binDir, 'ffmpeg'), '#!/bin/sh\nexit 37\n')
      await Bun.write(join(binDir, 'ffprobe'), '#!/bin/sh\nexit 37\n')
      await chmod(join(binDir, 'ffmpeg'), 0o700)
      await chmod(join(binDir, 'ffprobe'), 0o700)
      await Bun.write(inputPath, 'Unavailable shared media tools must block protected ingestion and every peer.')
      await Bun.write(referencePath, createMockWavBytes())
      configurePinnedRunDir(outputDir)

      const baseStore = createProtectedVoiceAssetStore({ storeId: 'media_runtime_refs', root: storeRoot })
      let ingestCalls = 0
      const store: ProtectedVoiceAssetStore = {
        root: baseStore.root,
        plan: async (input) => await baseStore.plan(input),
        ingest: async (input, expected) => {
          ingestCalls++
          return await baseStore.ingest(input, expected)
        },
        resolve: async (asset) => await baseStore.resolve(asset)
      }
      const options = {
        ...commandOptions(),
        mistralTtsModels: ['voxtral-mini-tts-2603']
      }
      const priorBinDir = getConfiguredBinDir()
      configureBinDir(binDir)
      try {
        await planStandaloneMistralReference(options, {
          sourcePath: referencePath,
          authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
        }, store)
        const plannedMistral = requireDefined(collectTtsTargets(options)[0], 'a planned Mistral protected-reference target')
        const mistralCalls = { run: 0, setup: 0, fetch: 0 }
        const mistralTarget: TtsTarget = {
          ...plannedMistral,
          run: async () => {
            mistralCalls.run++
            mistralCalls.setup++
            mistralCalls.fetch++
            throw new Error('Media-readiness-gated Mistral target must not run.')
          }
        }
        const openai = hostedFixture('openai', 'gpt-4o-mini-tts-2025-12-15', 'alloy')

        await withHostedCredentials({
          MISTRAL_API_KEY: 'configured-for-local-fixture',
          OPENAI_API_KEY: 'configured-for-local-fixture'
        }, async () => {
          await expect(runSingleTtsInput(
            inputPath,
            options,
            [mistralTarget, openai.target],
            undefined
          )).rejects.toThrow('ffmpeg and ffprobe')
        })

        const providers = (await readManifest(outputDir))?.items[0]?.providers ?? []
        expect(providers).toHaveLength(2)
        for (const provider of providers) {
          const projection = await expectBranchOnlyFailure(outputDir, provider)
          expect(projection.readinessAttempts[0]).toMatchObject({
            status: 'blocked',
            admissionDisposition: 'self-blocked',
            error: {
              code: 'local-media-runtime-not-ready',
              blockedReason: 'local-setup-required'
            }
          })
        }
        expect(ingestCalls).toBe(0)
        expect(await Bun.file(storeRoot).exists()).toBe(false)
        expect(mistralCalls).toEqual({ run: 0, setup: 0, fetch: 0 })
        expect(openai.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
      } finally {
        configureBinDir(priorBinDir ?? '')
      }
    })
  })

  test('a ready peer retains ready evidence but projects dependency-readiness failure', async () => {
    await withTempDir('autoshow-tts-readiness-peers-', async (dir) => {
      const inputPath = join(dir, 'source.txt')
      const outputDir = join(dir, 'run')
      await Bun.write(inputPath, 'All targets gate synthesis as one readiness set.')
      configurePinnedRunDir(outputDir)
      const openai = hostedFixture('openai', 'gpt-4o-mini-tts-2025-12-15', 'alloy')
      const groq = hostedFixture('groq', 'canopylabs/orpheus-v1-english', 'troy')

      await withHostedCredentials({ OPENAI_API_KEY: undefined, GROQ_API_KEY: 'configured-for-local-fixture' }, async () => {
        await expect(runSingleTtsInput(
          inputPath,
          commandOptions(),
          [openai.target, groq.target],
          undefined
        )).rejects.toThrow('OPENAI_API_KEY')
      })

      const manifest = await readManifest(outputDir)
      expect(manifest?.items[0]?.status).toBe('failed')
      expect(manifest?.items[0]?.providers).toHaveLength(2)
      const blocked = manifest?.items[0]?.providers[0]
      const peer = manifest?.items[0]?.providers[1]
      expect(blocked).toBeDefined()
      expect(peer).toBeDefined()
      const blockedProjection = await expectBranchOnlyFailure(outputDir, blocked!)
      const peerProjection = await expectBranchOnlyFailure(outputDir, peer!)
      expect(blockedProjection.readinessAttempts[0]).toMatchObject({
        status: 'blocked',
        admissionDisposition: 'self-blocked'
      })
      expect(peerProjection.readinessAttempts[0]).toMatchObject({
        status: 'ready',
        admissionDisposition: 'peer-blocked',
        error: {
          phase: 'readiness',
          code: 'peer-readiness-failed',
          blockedReason: 'dependency-readiness-failed'
        }
      })
      expect((await readReadinessResult(outputDir, blocked!)).status).toBe('blocked')
      const peerReadinessResult = await readReadinessResult(outputDir, peer!)
      expect(peerReadinessResult.status).toBe('ready')
      expect(peerReadinessResult.capabilityObservations[0]?.state).toBe('available')
      expect(peerReadinessResult.candidateReadiness[0]?.status).toBe('ready')
      expect(openai.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
      expect(groq.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
    })
  })

  test('a blocked batch peer persists every item and target without protected ingestion', async () => {
    await withTempDir('autoshow-tts-readiness-batch-', async (dir) => {
      const inputDir = join(dir, 'inputs')
      const outputDir = join(dir, 'run')
      const referencePath = join(dir, 'private-reference.wav')
      const storeRoot = join(dir, 'protected-store')
      await mkdir(inputDir)
      await Bun.write(join(inputDir, 'first.txt'), 'First readiness-gated batch item.')
      await Bun.write(join(inputDir, 'second.txt'), 'Second readiness-gated batch item.')
      await Bun.write(referencePath, createMockWavBytes())
      configurePinnedRunDir(outputDir)

      const baseStore = createProtectedVoiceAssetStore({ storeId: 'batch_readiness_refs', root: storeRoot })
      let ingestCalls = 0
      const store: ProtectedVoiceAssetStore = {
        root: baseStore.root,
        plan: async (input) => await baseStore.plan(input),
        ingest: async (input, expected) => {
          ingestCalls++
          return await baseStore.ingest(input, expected)
        },
        resolve: async (asset) => await baseStore.resolve(asset)
      }
      const options = {
        mistralTtsModels: ['voxtral-mini-tts-2603'],
        batchConcurrency: 2,
        price: false,
        allowOverBudget: false
      }
      await planStandaloneMistralReference(options, {
        sourcePath: referencePath,
        authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
      }, store)
      const plannedMistral = requireDefined(collectTtsTargets(options)[0], 'a planned Mistral protected-reference target')
      const mistralCalls = { run: 0, setup: 0, fetch: 0 }
      const mistralTarget: TtsTarget = {
        ...plannedMistral,
        run: async () => {
          mistralCalls.run++
          mistralCalls.setup++
          mistralCalls.fetch++
          throw new Error('Readiness-gated Mistral target must not run.')
        }
      }
      const openai = hostedFixture('openai', 'gpt-4o-mini-tts-2025-12-15', 'alloy')

      await withHostedCredentials({
        MISTRAL_API_KEY: 'configured-for-local-fixture',
        OPENAI_API_KEY: undefined
      }, async () => {
        await expect(runTtsDirectoryBatch(
          inputDir,
          options,
          [mistralTarget, openai.target],
          undefined
        )).rejects.toThrow('TTS batch processing failed for 2 item(s)')
      })

      const manifest = await readManifest(outputDir)
      expect(manifest?.items).toHaveLength(2)
      expect(manifest?.items.map((item) => item.status)).toEqual(['failed', 'failed'])
      for (const item of manifest?.items ?? []) {
        expect(item.providers).toHaveLength(2)
        const readyPeer = item.providers[0]
        const blocker = item.providers[1]
        expect(readyPeer).toBeDefined()
        expect(blocker).toBeDefined()
        const peerProjection = await expectBranchOnlyFailure(outputDir, readyPeer!)
        const blockedProjection = await expectBranchOnlyFailure(outputDir, blocker!)
        expect(peerProjection.readinessAttempts[0]).toMatchObject({ status: 'ready', admissionDisposition: 'peer-blocked' })
        expect(blockedProjection.readinessAttempts[0]).toMatchObject({ status: 'blocked', admissionDisposition: 'self-blocked' })
      }
      expect(ingestCalls).toBe(0)
      expect(await Bun.file(storeRoot).exists()).toBe(false)
      expect(mistralCalls).toEqual({ run: 0, setup: 0, fetch: 0 })
      expect(openai.calls).toEqual({ run: 0, setup: 0, fetch: 0 })
    })
  })
})
