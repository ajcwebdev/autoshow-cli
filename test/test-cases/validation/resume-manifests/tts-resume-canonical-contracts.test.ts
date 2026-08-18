import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, readManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { priceGenerationTarget, resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { resolveTtsResumeSourceContext } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume-source-context'
import { createFileTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import type { CanonicalAudioProviderProjection, PipelineProviderState, Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { canonicalFileInput, findRecoverableCompletedState, localTtsResumeConfig, materializeBlockedReadinessProviderState, materializeFailedProviderState, resumeTarget, succeededMetadata, successfulTarget, ttsTarget } from './tts-resume-fixtures'

describe('canonical TTS resume', () => {
  test('prices and appends a canonical model to an unambiguous legacy inline run', async () => {
    await withTempDir('autoshow-tts-resume-legacy-inline-', async (dir) => {
      const input = 'Legacy inline narration remains exact for additive resume.'
      const legacyMetadata: Step4Metadata = {
        ttsService: 'openai',
        ttsModel: 'tts-1',
        speaker: 'alloy',
        processingTime: 1,
        audioFileName: 'speech-openai-tts-1.wav',
        audioFileSize: 1,
        chunkCount: 1
      }
      const legacyProvider: PipelineProviderState = {
        service: 'openai',
        model: 'tts-1',
        artifactDir: '.',
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: {}
      }
      await Bun.write(join(dir, legacyMetadata.audioFileName), new Uint8Array([0]))
      await Bun.write(join(dir, PIPELINE_MANIFEST_FILE), `${JSON.stringify({
        command: 'tts',
        scope: 'single',
        createdAt: '2026-06-15T18:24:36.993Z',
        updatedAt: '2026-06-15T18:24:36.993Z',
        items: [{
          input,
          status: 'full',
          metadata: { tts: [legacyMetadata] },
          providers: [legacyProvider]
        }]
      }, null, 2)}\n`)
      const beforeManifest = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      const beforeFiles = await readdir(dir)

      const estimate = await priceGenerationTarget(
        resumeTarget(dir),
        ttsResumeConfig,
        { deepinfraTtsModels: ['ResembleAI/chatterbox-turbo'] } as TtsOptions,
        new Set(['deepinfra-tts'])
      )

      expect(estimate.steps.map((step) => [step.provider, step.model])).toEqual([
        ['deepinfra', 'ResembleAI/chatterbox-turbo']
      ])
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(beforeManifest)
      expect(await readdir(dir)).toEqual(beforeFiles)

      const target = ttsTarget()
      const runnable = successfulTarget(target)
      const runtimeOptions = { openaiTtsModels: [target.model] } as TtsOptions
      const priorKey = process.env['OPENAI_API_KEY']
      process.env['OPENAI_API_KEY'] = 'configured-for-local-legacy-resume-fixture'
      try {
        await resumeGenerationTarget(
          resumeTarget(dir),
          {
            ...ttsResumeConfig,
            collectTargets: () => [runnable],
            resolveStoredTargets: async () => [runnable]
          },
          runtimeOptions,
          new Set(['openai-tts'])
        )
      } finally {
        if (priorKey === undefined) delete process.env['OPENAI_API_KEY']
        else process.env['OPENAI_API_KEY'] = priorKey
      }

      const updated = await readManifest(dir)
      expect(updated?.items[0]?.providers).toHaveLength(2)
      expect(updated?.items[0]?.providers[0]?.legacyRenderIdentity).toBeDefined()
      expect(updated?.items[0]?.providers[1]?.targetKey).toBe(target.targetKey)

      const mixedStateEstimate = await priceGenerationTarget(
        resumeTarget(dir),
        ttsResumeConfig,
        { deepinfraTtsModels: ['ResembleAI/chatterbox-turbo'] } as TtsOptions,
        new Set(['deepinfra-tts'])
      )
      expect(mixedStateEstimate.steps.map((step) => [step.provider, step.model])).toEqual([
        ['deepinfra', 'ResembleAI/chatterbox-turbo']
      ])
    })
  })

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
      expect(projection.activeWork).toBeUndefined()
      expect(projection.selectedSuccess?.renderIdentity).toBe(projection.renderHistory[0]?.renderIdentity)
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
      expect(projection.renderHistory).toHaveLength(1)
      expect(projection.renderHistory[0]?.events.length).toBeGreaterThan(failedProjection.renderHistory[0]?.events.length ?? 0)
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

  test('price permits an immutable replacement branch for a failed implicit adapter default', async () => {
    await withTempDir('autoshow-tts-resume-price-default-migration-', async (dir) => {
      const text = 'Migrate only this failed implicit adapter default.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const retainedTarget = { ...ttsTarget(), voice: 'old-provider-default' }
      const failed = await materializeFailedProviderState({ rootDir: dir, target: retainedTarget, text, sourceIdentity, dialoguePlan })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [failed]
      })]))
      const before = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      const replacement = { ...successfulTarget({ ...ttsTarget(), voice: 'new-provider-default' }), allowFailedImplicitDefaultReplan: true }

      const estimate = await priceGenerationTarget(
        resumeTarget(dir),
        { ...ttsResumeConfig, collectTargets: () => [replacement] },
        {} as TtsOptions,
        new Set(['openai-tts'])
      )

      expect(estimate.totalEstimatedCost).toBeGreaterThan(0)
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

  test('explicit one-run authorization permits repurchasing an admitted slot with no recoverable output', async () => {
    await withTempDir('autoshow-tts-resume-authorized-redispatch-', async (dir) => {
      const text = 'Explicitly repurchase this lost admitted request.'
      const inputPath = join(dir, 'source.txt')
      await Bun.write(inputPath, text)
      const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
      const target = { ...ttsTarget(), voice: 'alloy' }
      const failed = await materializeFailedProviderState({ rootDir: dir, target, text, sourceIdentity, dialoguePlan, admitted: true })
      await writeManifest(dir, createManifest('tts', 'single', [createManifestItem(dir, {
        input: canonicalFileInput(sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [failed]
      })]))
      let providerCalls = 0
      const candidate = successfulTarget(target, () => { providerCalls += 1 })

      const resumed = await ttsResumeConfig.runMissingTargets(
        [candidate],
        text,
        dir,
        { ttsAllowAmbiguousRedispatch: true },
        {
          outputDir: dir,
          runtimeOptions: {},
          targets: [candidate],
          existingEntries: [],
          currentManifestMetadata: {},
          currentProviderStates: [failed]
        }
      )
      expect(providerCalls).toBe(1)
      expect(resumed).toHaveLength(1)
      expect(resumed[0]?.resultIdentity).toHaveLength(64)
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
})
