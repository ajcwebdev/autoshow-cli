import { describe,expect,test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createManifest,createManifestItem,PIPELINE_MANIFEST_FILE,readManifest,writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { createFileTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { priceGenerationTarget,resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import type { CanonicalAudioProviderProjection,TtsOptions,TtsTarget } from '~/types'
import { withEnv } from '../../../test-utils/rest-contract-helpers'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { canonicalFileInput,materializeBlockedReadinessProviderState,materializeFailedProviderState,resumeTarget,successfulTarget,ttsTarget } from './tts-resume-fixtures'

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
      await withEnv({ OPENAI_API_KEY: 'configured-for-local-resume-fixture' }, async () => {
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
      })

      const provider = (await readManifest(dir))?.items[0]?.providers[0]
      const projection = provider?.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const blockedProjection = blocked.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      expect(providerCalls).toBe(1)
      expect(barrierObserved).toBe(true)
      expect(provider?.status).toBe('succeeded')
      expect(projection.branchHistory).toEqual([])
      expect(projection.readinessAttempts).toEqual([])
      expect(projection.renderHistory).toEqual([])
      expect(projection.activeWork).toBeUndefined()
      expect(projection.selectedSuccess?.renderIdentity).toBeDefined()
      expect(projection.archive).toBeDefined()
      expect(projection.pointerEvents).toHaveLength(1)
      expect(projection.pointerEvents[0]?.action).toBe('select-success')
      const branchDir = join(dir, provider?.artifactDir as string, 'branches', blockedProjection.branchHistory[0]?.branchPlanId as string)
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
      await withEnv({ OPENAI_API_KEY: undefined }, async () => {
        await expect(resumeGenerationTarget(
          resumeTarget(dir),
          { ...ttsResumeConfig, collectTargets: () => [candidate] },
          runtimeOptions
        )).rejects.toThrow('still has failed providers')
      })

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

  test('compacts a resumed success after retaining failed history through dispatch', async () => {
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
      expect(projection.renderHistory).toEqual([])
      expect(projection.readinessAttempts).toEqual([])
      expect(projection.branchHistory).toEqual([])
      expect(failed.status).toBe('failed')
      expect(failedProjection.renderHistory[0]?.events.at(-1)?.status).toBe('failed')
      expect(projection.archive).toBeDefined()
      expect(projection.pointerEvents).toHaveLength(1)
      expect(projection.pointerEvents[0]?.action).toBe('select-success')
      expect(provider?.metadata['ttsAudio']).toEqual(provider?.result?.['ttsAudio'])
    })
  })
})
