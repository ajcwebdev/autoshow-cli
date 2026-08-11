import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createCurrentTtsRenderAttempt } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { createCurrentTtsBlockedReadinessState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-readiness-attempt'
import { priceGenerationTarget, resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { resolveStoredTtsTargetsForResume, ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { resolveTtsResumeSourceContext } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume-source-context'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import type { CanonicalAudioProviderProjection, GenericTtsDialoguePlan, GenericTtsSourceIdentity, PipelineProviderState, ResumeTarget, Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { createMockWavBytes, createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import type { ProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'

const ttsTarget = (transport = 'hosted-api'): TtsTarget => {
  const operation = 'tts-synthesis' as const
  const service = 'openai' as const
  const model = 'gpt-4o-mini-tts-2025-12-15'
  return {
    service,
    model,
    operation,
    transport,
    targetKey: canonicalTargetKey(operation, service, model, transport),
    run: async () => { throw new Error('provider must not run in this local contract test') }
  }
}

const canonicalFileInput = (sourceIdentity: GenericTtsSourceIdentity): string => {
  if (sourceIdentity.sourceLocator.kind !== 'file') throw new Error('Expected a file-backed TTS source fixture')
  return sourceIdentity.sourceLocator.canonicalPath
}

const succeededMetadata = async (
  rootDir: string,
  target: TtsTarget,
  label: string,
  source?: {
    text: string
    sourceIdentity: GenericTtsSourceIdentity
    dialoguePlan: GenericTtsDialoguePlan
  } | undefined
): Promise<Step4Metadata> => {
  const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })
  const runnableTarget: TtsTarget = {
    ...target,
    voice: 'alloy',
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      const audioPath = join(outputDir, 'speech.wav')
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { text, voice: 'alloy' },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: 'alloy' }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async (lifecycle) => {
        await lifecycle.accepted({ providerRequestId: 'local-contract-fixture' })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: target.service,
          ttsModel: target.model,
          speaker: 'alloy',
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
  const sourceText = source?.text ?? `Fixture render ${label}.`
  const result = await runTtsForTargets(
    sourceText,
    rootDir,
    {},
    [runnableTarget],
    source ? { sourceIdentity: source.sourceIdentity, dialoguePlan: source.dialoguePlan } : undefined
  )
  return result.metadata[0] as Step4Metadata
}

const successfulTarget = (
  target: TtsTarget,
  onRun: () => void = () => {}
): TtsTarget => {
  const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })
  return {
    ...target,
    voice: target.voice ?? 'alloy',
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      onRun()
      const audioPath = join(outputDir, 'speech.wav')
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'openai.tts.phase-0-v1',
        serializedRequest: { text, voice: target.voice ?? 'alloy' },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'provider-id', value: target.voice ?? 'alloy' }],
        requestControls: { responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async (lifecycle) => {
        await lifecycle.accepted({ providerRequestId: 'local-contract-fixture' })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: target.service,
          ttsModel: target.model,
          speaker: target.voice ?? 'alloy',
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

const protectedMistralTarget = (
  protectedAsset: { storeId: string, assetId: string, sha256: string },
  onRun: () => void = () => {}
): TtsTarget => {
  const model = 'voxtral-mini-tts-2603'
  const voice = `ref_audio:${protectedAsset.assetId}`
  const bytes = createMockWavBytes()
  return {
    service: 'mistral',
    model,
    operation: 'tts-synthesis',
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('tts-synthesis', 'mistral', model, 'hosted-api'),
    voice,
    protectedVoiceAsset: protectedAsset,
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      onRun()
      const audioPath = join(outputDir, 'speech.wav')
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'speech-synthesis',
        serializerVersion: 'mistral.tts.phase-0-v1',
        serializedRequest: { text, speaker: voice },
        providerText: text,
        voiceField: 'speaker',
        voices: [{ kind: 'reference-asset', valueHash: protectedAsset.sha256 }],
        requestControls: { stream: false, responseFormat: 'wav' },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async (lifecycle) => {
        await lifecycle.accepted({ providerRequestId: 'local-protected-contract-fixture' })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'mistral',
          ttsModel: model,
          speaker: `protected reference asset ${protectedAsset.assetId}`,
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

const materializeProtectedStoreFixture = async (
  dir: string
): Promise<{ store: ProtectedVoiceAssetStore, protectedAsset: { storeId: string, assetId: string, sha256: string } }> => {
  const sourcePath = join(dir, 'authorized-reference.wav')
  await Bun.write(sourcePath, createMockWavBytes({ samples: 800 }))
  const store = createProtectedVoiceAssetStore({ storeId: 'resume_mistral_refs', root: join(dir, 'protected-store') })
  const materialized = await store.ingest({
    sourcePath,
    authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION
  })
  return { store, protectedAsset: materialized.protectedAsset }
}

const materializeFailedProviderState = async (options: {
  rootDir: string
  target: TtsTarget
  text: string
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
  admitted?: boolean | undefined
}): Promise<PipelineProviderState> => {
  let latest: PipelineProviderState | undefined
  const runnable: TtsTarget = {
    ...options.target,
    voice: options.target.voice ?? 'alloy',
    run: async (text, _outputDir, _opts, _invocation, requestEvidence): Promise<never> => {
      if (options.admitted) {
        await requestEvidence?.dispatch({
          chunkIndex: 1,
          endpointKind: 'speech-synthesis',
          serializerVersion: 'openai.tts.phase-0-v1',
          serializedRequest: { text, voice: options.target.voice ?? 'alloy' },
          providerText: text,
          voiceField: 'voice',
          voices: [{ kind: 'provider-id', value: options.target.voice ?? 'alloy' }],
          requestControls: { responseFormat: 'wav' },
          continuation: { kind: 'none' }
        }, { attempt: 1 }, async () => {
          throw new Error('ambiguous fixture failure after provider admission')
        })
      }
      throw new Error('fixture failure before provider dispatch')
    }
  }
  await runTtsForTargets(options.text, options.rootDir, {}, [runnable], {
    sourceIdentity: options.sourceIdentity,
    dialoguePlan: options.dialoguePlan,
    onProviderState: async (state) => { latest = state }
  }).catch(() => undefined)
  if (!latest || latest.status !== 'failed') throw new Error('Fixture lifecycle did not produce a failed canonical TTS state.')
  return bindTtsDialoguePlanArtifact(
    latest,
    await materializeTtsDialoguePlanArtifact(options.rootDir, options.dialoguePlan)
  )
}

const materializeBlockedReadinessProviderState = async (options: {
  rootDir: string
  target: TtsTarget
  text: string
  sourceIdentity: GenericTtsSourceIdentity
  dialoguePlan: GenericTtsDialoguePlan
  ttsOptions: TtsOptions
}): Promise<PipelineProviderState> => bindTtsDialoguePlanArtifact(
  await createCurrentTtsBlockedReadinessState({
    outputDir: options.rootDir,
    target: options.target,
    sourceText: options.text,
    ttsOptions: options.ttsOptions,
    sourceIdentity: options.sourceIdentity,
    dialoguePlan: options.dialoguePlan,
    readiness: {
      targetKey: options.target.targetKey as string,
      accountState: 'not-configured',
      status: 'blocked',
      error: {
        phase: 'readiness',
        code: 'provider-credential-not-configured',
        message: 'OPENAI_API_KEY environment variable is required for OpenAI TTS.',
        retryable: false,
        blockedReason: 'provider-credential-not-configured'
      }
    },
    peerBlocked: false
  }),
  await materializeTtsDialoguePlanArtifact(options.rootDir, options.dialoguePlan)
)

const policySkippedState = (target: TtsTarget, artifactRoot: string): PipelineProviderState => {
  const targetKey = target.targetKey as string
  const actor = { namespace: 'local-user' as const, actorId: 'fixture' }
  const at = new Date(0).toISOString()
  const evidence = { schemaVersion: 1 as const, skipId: `skip-${artifactRoot.replace(/\//g, '-')}`, targetKey, reasonCode: 'user-requested' as const, reason: 'fixture skip', actor, at }
  const projection = {
    activeWork: { kind: 'policy-skip' as const, evidence },
    branchHistory: [],
    readinessAttempts: [],
    renderHistory: [],
    pointerEvents: [{ sequence: 1, action: 'activate-policy-skip' as const, skipId: evidence.skipId, actor, at }]
  }
  return {
    service: target.service,
    model: target.model,
    operation: 'tts-synthesis',
    targetKey,
    transport: target.transport as string,
    artifactDir: `${artifactRoot}/${targetKey}`,
    status: 'skipped',
    attempts: 0,
    options: {},
    metadata: { ttsAudio: projection },
    result: { ttsAudio: projection }
  }
}

const findRecoverableCompletedState = async (
  rootDir: string,
  states: readonly PipelineProviderState[]
): Promise<PipelineProviderState> => {
  for (const state of states) {
    const projection = state.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
    const event = projection?.renderHistory.flatMap((render) => render.events).findLast((entry) => entry.admissionJournalRef)
    if (!event?.admissionJournalRef) continue
    const journal = await Bun.file(join(rootDir, state.artifactDir, event.admissionJournalRef)).json() as { recordedResult?: unknown }
    if (journal.recordedResult !== undefined && state.status !== 'succeeded') return state
  }
  throw new Error('Fixture lifecycle did not expose a pre-terminal state with a complete promoted provider result.')
}

const resumeTarget = (dir: string): ResumeTarget => ({
  kind: 'tts',
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

const withMistralCredential = async <T>(operation: () => Promise<T>): Promise<T> => {
  const prior = process.env['MISTRAL_API_KEY']
  process.env['MISTRAL_API_KEY'] = 'configured-for-local-protected-resume-fixture'
  try {
    return await operation()
  } finally {
    if (prior === undefined) delete process.env['MISTRAL_API_KEY']
    else process.env['MISTRAL_API_KEY'] = prior
  }
}

const localTtsResumeConfig = (
  selectedTargets: TtsTarget[],
  metadataByKey: ReadonlyMap<string, Step4Metadata>,
  ranTargetKeys: string[]
) => ({
  ...ttsResumeConfig,
  collectTargets: () => selectedTargets,
  runMissingTargets: async (targets: TtsTarget[]) => {
    ranTargetKeys.push(...targets.map((target) => target.targetKey as string))
    return targets.map((target) => metadataByKey.get(target.targetKey as string) as Step4Metadata)
  },
  rebuildRunMetadata: () => ({})
})

describe('canonical TTS resume', () => {
  test('reactivates one retained blocked branch and freezes its render only after fresh readiness', async () => {
    await withTempDir('autoshow-tts-resume-readiness-ready-', async (dir) => {
      const text = 'Retry this exact readiness-blocked branch.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const runtimeOptions: TtsOptions = { openaiTtsModels: [target.model] }
      const blocked = await materializeBlockedReadinessProviderState({
        rootDir: dir,
        target,
        text,
        sourceIdentity,
        dialoguePlan,
        ttsOptions: runtimeOptions
      })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [blocked]
      })]))
      const beforePrice = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      let providerCalls = 0
      let barrierObserved = false
      const runnableBase = successfulTarget(target)
      const runnable: TtsTarget = {
        ...runnableBase,
        run: async (...args) => {
          const preparedProvider = (await readManifest(dir))?.items[0]?.providers[0]
          const preparedProjection = preparedProvider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection
          barrierObserved = preparedProjection.activeWork?.kind === 'render'
            && preparedProjection.readinessAttempts.length === 2
            && preparedProjection.renderHistory.length === 1
            && preparedProjection.renderHistory[0]?.events[0]?.status === 'missing'
          providerCalls++
          return await runnableBase.run(...args)
        }
      }
      const priorKey = process.env['OPENAI_API_KEY']
      process.env['OPENAI_API_KEY'] = 'configured-for-local-resume-fixture'
      try {
        const estimate = await priceGenerationTarget(
          resumeTarget(dir),
          { ...ttsResumeConfig, collectTargets: () => [runnable] },
          runtimeOptions
        )
        expect(estimate.totalEstimatedCost).toBeGreaterThan(0)
        expect(providerCalls).toBe(0)
        expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(beforePrice)

        await resumeGenerationTarget(
          resumeTarget(dir),
          { ...ttsResumeConfig, collectTargets: () => [runnable] },
          runtimeOptions
        )
      } finally {
        if (priorKey === undefined) delete process.env['OPENAI_API_KEY']
        else process.env['OPENAI_API_KEY'] = priorKey
      }

      const provider = (await readManifest(dir))?.items[0]?.providers[0]
      const projection = provider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const blockedProjection = blocked.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      expect(providerCalls).toBe(1)
      expect(barrierObserved).toBe(true)
      expect(provider?.status).toBe('succeeded')
      expect(projection.branchHistory).toEqual(blockedProjection.branchHistory)
      expect(projection.branchHistory).toHaveLength(1)
      expect(projection.branchHistory[0]?.branchPlanRef).toContain('branches/')
      expect(projection.readinessAttempts).toHaveLength(2)
      expect(projection.readinessAttempts[0]).toEqual(blockedProjection.readinessAttempts[0])
      expect(projection.readinessAttempts[1]).toMatchObject({ status: 'ready', admissionDisposition: 'eligible' })
      expect(projection.renderHistory).toHaveLength(1)
      expect(projection.activeWork?.kind).toBe('render')
      expect(projection.pointerEvents.filter((event) => event.action === 'activate-branch')).toHaveLength(2)
      const branchDir = join(dir, provider?.artifactDir as string, 'branches', projection.branchHistory[0]?.branchPlanId as string)
      expect((await readdir(branchDir)).filter((name) => name.startsWith('readiness-result-attempt-'))).toHaveLength(2)
    })
  })

  test('rechecks a still-blocked branch by appending an exact latest readiness projection', async () => {
    await withTempDir('autoshow-tts-resume-readiness-blocked-', async (dir) => {
      const text = 'Keep this blocked branch append-only.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const runtimeOptions: TtsOptions = { openaiTtsModels: [target.model] }
      const blocked = await materializeBlockedReadinessProviderState({
        rootDir: dir,
        target,
        text,
        sourceIdentity,
        dialoguePlan,
        ttsOptions: runtimeOptions
      })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [blocked]
      })]))
      let providerCalls = 0
      const candidate = successfulTarget(target, () => { providerCalls++ })
      const priorKey = process.env['OPENAI_API_KEY']
      delete process.env['OPENAI_API_KEY']
      try {
        await expect(resumeGenerationTarget(
          resumeTarget(dir),
          { ...ttsResumeConfig, collectTargets: () => [candidate] },
          runtimeOptions
        )).rejects.toThrow('still has failed providers')
      } finally {
        if (priorKey === undefined) delete process.env['OPENAI_API_KEY']
        else process.env['OPENAI_API_KEY'] = priorKey
      }

      const provider = (await readManifest(dir))?.items[0]?.providers[0]
      const projection = provider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const blockedProjection = blocked.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      expect(providerCalls).toBe(0)
      expect(provider).toMatchObject({ status: 'failed', attempts: 0 })
      expect(projection.branchHistory).toEqual(blockedProjection.branchHistory)
      expect(projection.readinessAttempts).toHaveLength(2)
      expect(projection.readinessAttempts[0]).toEqual(blockedProjection.readinessAttempts[0])
      expect(projection.readinessAttempts[1]).toMatchObject({ status: 'blocked', admissionDisposition: 'self-blocked' })
      expect(projection.renderHistory).toEqual([])
      expect(projection.activeWork).toMatchObject({
        kind: 'branch',
        branchPlanId: projection.branchHistory[0]?.branchPlanId,
        readinessAttemptSequence: 2
      })
      expect(projection.pointerEvents.filter((event) => event.action === 'activate-branch')).toHaveLength(2)
      expect(projection.pointerEvents.filter((event) => event.action === 'project-branch-readiness')).toHaveLength(2)
      const branchDir = join(dir, provider?.artifactDir as string, 'branches', projection.branchHistory[0]?.branchPlanId as string)
      expect((await readdir(branchDir)).filter((name) => name.startsWith('readiness-result-attempt-'))).toHaveLength(2)
    })
  })

  test('appends a resumed success without replacing failed projection history', async () => {
    await withTempDir('autoshow-tts-resume-history-', async (dir) => {
      const text = 'Resume me.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const failed = await materializeFailedProviderState({ rootDir: dir, target, text, sourceIdentity, dialoguePlan })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [failed]
      })]))
      expect(await readManifest(dir)).toBeDefined()
      let providerCalls = 0
      const runnable = successfulTarget(target, () => { providerCalls += 1 })

      await resumeGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [runnable] },
        {} as TtsOptions
      )

      const provider = (await readManifest(dir))?.items[0]?.providers[0]
      const projection = provider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const failedProjection = failed.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      expect(providerCalls).toBe(1)
      expect(provider).toMatchObject({
        operation: 'tts-synthesis',
        targetKey: target.targetKey,
        transport: target.transport,
        artifactDir: `providers/${target.targetKey}`,
        status: 'succeeded'
      })
      expect(provider?.attempts).toBeGreaterThan(failed.attempts)
      expect(projection.renderHistory).toHaveLength(1)
      expect(projection.readinessAttempts.slice(0, failedProjection.readinessAttempts.length)).toEqual(failedProjection.readinessAttempts)
      expect(failed.status).toBe('failed')
      expect(projection.renderHistory[0]?.events.at(-1)?.status).toBe('succeeded')
      expect(projection.pointerEvents.slice(0, failedProjection.pointerEvents.length)).toEqual(failedProjection.pointerEvents)
      expect(provider?.metadata['ttsAudio']).toEqual(provider?.result?.['ttsAudio'])
    })
  })

  test('treats the same provider/model on a different transport as a new target', async () => {
    await withTempDir('autoshow-tts-resume-target-key-', async (dir) => {
      const input = 'Add one transport.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, input)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, input)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, input)
      const completedTarget = { ...ttsTarget('hosted-api'), voice: 'alloy' }
      const selectedTarget = { ...ttsTarget('hosted-stream'), voice: 'alloy' }
      const completedMetadata = await succeededMetadata(dir, completedTarget, 'completed', {
        text: input,
        sourceIdentity,
        dialoguePlan
      })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'full',
        metadata: { tts: [completedMetadata] },
        providers: [bindTtsDialoguePlanArtifact(
          buildCurrentTtsProviderState(completedMetadata),
          await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
        )]
      })]))
      let providerCalls = 0
      const runnable = successfulTarget(selectedTarget, () => { providerCalls += 1 })

      await resumeGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [runnable] },
        {} as TtsOptions,
        new Set(['openai-tts'])
      )

      const providers = (await readManifest(dir))?.items[0]?.providers ?? []
      expect(providerCalls).toBe(1)
      expect(providers.map((provider) => provider.targetKey)).toEqual([
        completedTarget.targetKey,
        selectedTarget.targetKey
      ])
      expect(providers.every((provider) => provider.status === 'succeeded')).toBe(true)
    })
  })

  test('rejects unfinished pre-ADR TTS state before reconstructing a target', async () => {
    await withTempDir('autoshow-tts-resume-legacy-', async (dir) => {
      const target = ttsTarget()
      const at = new Date(0).toISOString()
      await Bun.write(join(dir, PIPELINE_MANIFEST_FILE), `${JSON.stringify({
        command: 'tts',
        scope: 'single',
        createdAt: at,
        updatedAt: at,
        items: [{
          input: 'Legacy input.',
          status: 'incomplete',
          metadata: { tts: [] },
          providers: [{
            service: target.service,
            model: target.model,
            artifactDir: '.',
            status: 'missing',
            attempts: 0,
            options: {},
            metadata: {}
          }]
        }]
      }, null, 2)}\n`)
      const ranTargetKeys: string[] = []

      await expect(resumeGenerationTarget(
        resumeTarget(dir),
        localTtsResumeConfig([target], new Map(), ranTargetKeys),
        {} as TtsOptions
      )).rejects.toThrow('predates operation-scoped render evidence')
      expect(ranTargetKeys).toEqual([])
    })
  })

  test('loads the exact retained source and dialogue identities for a resumed render', async () => {
    await withTempDir('autoshow-tts-resume-source-context-', async (dir) => {
      const target = ttsTarget()
      const input = 'Retain this exact file-backed resume source.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, input)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, input)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, input)
      const metadata = await succeededMetadata(dir, target, 'source-context', {
        text: input,
        sourceIdentity,
        dialoguePlan
      })
      const provider = bindTtsDialoguePlanArtifact(
        buildCurrentTtsProviderState(metadata),
        await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      )

      const context = await resolveTtsResumeSourceContext(
        dir,
        input,
        [provider],
        new Set([target.targetKey as string])
      )

      expect(context.sourceIdentity).toEqual(sourceIdentity)
      expect(context.dialoguePlan).toEqual(dialoguePlan)
    })
  })

  test('rejects changed voice or synthesis semantics before resume dispatch', async () => {
    await withTempDir('autoshow-tts-resume-plan-mismatch-', async (dir) => {
      const text = 'Keep this exact voice binding.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const retainedTarget = { ...ttsTarget(), voice: 'nova' }
      const failed = await materializeFailedProviderState({
        rootDir: dir,
        target: retainedTarget,
        text,
        sourceIdentity,
        dialoguePlan
      })
      let providerCalls = 0
      const changedTarget = successfulTarget({ ...ttsTarget(), voice: 'alloy' }, () => { providerCalls += 1 })

      await expect(ttsResumeConfig.runMissingTargets(
        [changedTarget],
        text,
        dir,
        {} as TtsOptions,
        {
          outputDir: dir,
          runtimeOptions: {},
          targets: [changedTarget],
          existingEntries: [],
          currentManifestMetadata: {},
          currentProviderStates: [failed]
        }
      )).rejects.toThrow('will not silently rebind or repurchase')
      expect(providerCalls).toBe(0)
    })
  })

  test('price rejects changed voice semantics without a provider call or manifest write', async () => {
    await withTempDir('autoshow-tts-resume-price-plan-mismatch-', async (dir) => {
      const text = 'Price only this exact retained voice.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const retainedTarget = { ...ttsTarget(), voice: 'nova' }
      const failed = await materializeFailedProviderState({ rootDir: dir, target: retainedTarget, text, sourceIdentity, dialoguePlan })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [failed]
      })]))
      const before = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      let providerCalls = 0
      const changedTarget = successfulTarget({ ...ttsTarget(), voice: 'alloy' }, () => { providerCalls += 1 })

      await expect(priceGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [changedTarget] },
        {} as TtsOptions,
        new Set(['openai-tts'])
      )).rejects.toThrow('will not silently rebind or repurchase')
      expect(providerCalls).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(before)
    })
  })

  test('rejects retained admitted or ambiguous work before resume redispatch', async () => {
    await withTempDir('autoshow-tts-resume-admitted-', async (dir) => {
      const text = 'Do not repurchase this admitted request.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const failed = await materializeFailedProviderState({
        rootDir: dir,
        target,
        text,
        sourceIdentity,
        dialoguePlan,
        admitted: true
      })
      let providerCalls = 0
      const candidate = successfulTarget(target, () => { providerCalls += 1 })

      await expect(ttsResumeConfig.runMissingTargets(
        [candidate],
        text,
        dir,
        {} as TtsOptions,
        {
          outputDir: dir,
          runtimeOptions: {},
          targets: [candidate],
          existingEntries: [],
          currentManifestMetadata: {},
          currentProviderStates: [failed]
        }
      )).rejects.toThrow('automatic redispatch is blocked')
      expect(providerCalls).toBe(0)
    })
  })

  test('price rejects retained ambiguous work without a provider call or manifest write', async () => {
    await withTempDir('autoshow-tts-resume-price-admitted-', async (dir) => {
      const text = 'Do not price a second admitted request.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const failed = await materializeFailedProviderState({
        rootDir: dir,
        target,
        text,
        sourceIdentity,
        dialoguePlan,
        admitted: true
      })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [failed]
      })]))
      const before = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      let providerCalls = 0
      const candidate = successfulTarget(target, () => { providerCalls += 1 })

      await expect(priceGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [candidate] },
        {} as TtsOptions,
        new Set(['openai-tts'])
      )).rejects.toThrow('automatic redispatch is blocked')
      expect(providerCalls).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(before)
    })
  })

  test('blocks interrupted protected Mistral work before target invocation or manifest mutation', async () => {
    await withTempDir('autoshow-tts-resume-protected-block-', async (dir) => {
      const text = 'Do not redispatch this interrupted protected reference.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const { store, protectedAsset } = await materializeProtectedStoreFixture(dir)
      const target = protectedMistralTarget(protectedAsset)
      const failed = await withMistralCredential(async () => await materializeFailedProviderState({
        rootDir: dir,
        target,
        text,
        sourceIdentity,
        dialoguePlan
      }))
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [failed]
      })]))
      const before = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      let targetCalls = 0
      const config = {
        ...ttsResumeConfig,
        resolveStoredTargets: async (...args: Parameters<typeof resolveStoredTtsTargetsForResume>) => {
          const targets = await resolveStoredTtsTargetsForResume(args[0], args[1], args[2], args[3], store)
          for (const resolved of targets) {
            resolved.run = async () => {
              targetCalls++
              throw new Error('Protected interrupted work must not invoke its target.')
            }
          }
          return targets
        }
      }

      await expect(priceGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)).rejects.toThrow('cannot authorize protected Mistral reference redispatch')
      await withMistralCredential(async () => {
        await expect(resumeGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)).rejects.toThrow('still has failed providers')
      })
      expect(targetCalls).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(before)
    })
  })

  test('recovers completed protected Mistral evidence without resolving a second provider request', async () => {
    await withTempDir('autoshow-tts-resume-protected-recovery-', async (dir) => {
      const text = 'Recover the already promoted protected-reference result.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const { store, protectedAsset } = await materializeProtectedStoreFixture(dir)
      const target = protectedMistralTarget(protectedAsset)
      const snapshots: PipelineProviderState[] = []
      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      await withMistralCredential(async () => {
        await runTtsForTargets(text, dir, {}, [target], {
          sourceIdentity,
          dialoguePlan,
          onProviderState: async (state) => {
            snapshots.push(structuredClone(bindTtsDialoguePlanArtifact(state, dialoguePlanArtifact)))
          }
        })
      })
      const retained = await findRecoverableCompletedState(dir, snapshots)
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: retained.status === 'failed' ? 'failed' : 'incomplete',
        metadata: { tts: [] },
        providers: [retained]
      })]))
      const beforePrice = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      let resumedTargetCalls = 0
      const config = {
        ...ttsResumeConfig,
        resolveStoredTargets: async (...args: Parameters<typeof resolveStoredTtsTargetsForResume>) => {
          const targets = await resolveStoredTtsTargetsForResume(args[0], args[1], args[2], args[3], store)
          for (const resolved of targets) {
            resolved.run = async () => {
              resumedTargetCalls++
              throw new Error('Completed protected recovery must not invoke its target.')
            }
          }
          return targets
        }
      }

      const estimate = await priceGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)
      expect(estimate.totalEstimatedCost).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(beforePrice)
      await withMistralCredential(async () => {
        await resumeGenerationTarget(resumeTarget(dir), config, {} as TtsOptions)
      })
      expect(resumedTargetCalls).toBe(0)
      expect((await readManifest(dir))?.items[0]?.providers[0]?.status).toBe('succeeded')
    })
  })

  test('recovers a completed promoted result without a second provider call', async () => {
    await withTempDir('autoshow-tts-resume-recovery-', async (dir) => {
      const text = 'Recover these already promoted provider bytes.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const snapshots: PipelineProviderState[] = []
      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      let initialProviderCalls = 0
      await runTtsForTargets(text, dir, {}, [successfulTarget(target, () => { initialProviderCalls += 1 })], {
        sourceIdentity,
        dialoguePlan,
        onProviderState: async (state) => {
          snapshots.push(structuredClone(bindTtsDialoguePlanArtifact(state, dialoguePlanArtifact)))
        }
      })
      expect(initialProviderCalls).toBe(1)
      const retained = await findRecoverableCompletedState(dir, snapshots)
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: retained.status === 'failed' ? 'failed' : 'incomplete',
        metadata: { tts: [] },
        providers: [retained]
      })]))
      expect(await readManifest(dir)).toBeDefined()
      let resumedProviderCalls = 0
      const candidate = successfulTarget(target, () => { resumedProviderCalls += 1 })
      const beforePrice = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      const recoveryEstimate = await priceGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [candidate] },
        {} as TtsOptions
      )
      expect(recoveryEstimate.totalEstimatedCost).toBe(0)
      expect(resumedProviderCalls).toBe(0)
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(beforePrice)

      await resumeGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [candidate] },
        {} as TtsOptions
      )

      const manifest = await readManifest(dir)
      expect(resumedProviderCalls).toBe(0)
      expect(manifest?.items[0]?.status).toBe('full')
      expect(manifest?.items[0]?.providers[0]?.status).toBe('succeeded')
      const metadata = manifest?.items[0]?.metadata['tts'] as Step4Metadata[]
      expect(metadata[0]?.audioFileName).toContain('-resume-')
      expect(await Bun.file(join(dir, metadata[0]?.audioFileName as string)).exists()).toBe(true)
    })
  })

  test('real prepared provider states use item-scoped stable target containers', async () => {
    await withTempDir('autoshow-tts-prepared-roots-', async (dir) => {
      const text = 'Prepared root fixture.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const first = await createCurrentTtsRenderAttempt({
        outputDir: dir,
        artifactRoot: 'items/first/providers',
        target,
        sourceText: text,
        ttsOptions: {},
        sourceIdentity,
        dialoguePlan
      })
      const second = await createCurrentTtsRenderAttempt({
        outputDir: dir,
        artifactRoot: 'items/second/providers',
        target,
        sourceText: text,
        ttsOptions: {},
        sourceIdentity,
        dialoguePlan
      })
      expect(first.preparedState.artifactDir).toBe(`items/first/providers/${target.targetKey}`)
      expect(second.preparedState.artifactDir).toBe(`items/second/providers/${target.targetKey}`)
      expect(second.preparedState.artifactDir).not.toBe(first.preparedState.artifactDir)
    })
  })

  test('rejects batch TTS resume before selecting or running an item', async () => {
    await withTempDir('autoshow-tts-resume-batch-', async (dir) => {
      const target = ttsTarget()
      const createdAt = new Date(0).toISOString()
      const items = await Promise.all(['first', 'second'].map(async (label) => {
        const inputPath = join(dir, `${label}.txt`)
        const text = `${label} batch fixture.`
        await Bun.write(inputPath, text)
        const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
        const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text, createdAt)
        return createManifestItem(dir, {
          input: canonicalFileInput(sourceIdentity),
          status: 'skipped',
          metadata: { tts: [] },
          providers: [bindTtsDialoguePlanArtifact(
            policySkippedState(target, `items/${label}/providers`),
            await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
          )]
        })
      }))
      await writeManifest(dir, createManifest('tts', 'batch', items))
      const ranTargetKeys: string[] = []

      await expect(resumeGenerationTarget(
        { kind: 'tts', scope: 'batch', dir, manifestPath: join(dir, PIPELINE_MANIFEST_FILE) },
        localTtsResumeConfig([target], new Map(), ranTargetKeys),
        {} as TtsOptions
      )).rejects.toThrow('single-run manifest.json outputs only')
      expect(ranTargetKeys).toEqual([])
      expect((await readManifest(dir))?.items).toHaveLength(2)
    })
  })
})
