import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createBatchedManifestUpdater, createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, readManifest, updateManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createCurrentTtsRenderAttempt } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { priceGenerationTarget, resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { buildTtsTargetEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/tts-estimates'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { createFileTtsSourceIdentity, createGenericTtsDialoguePlan, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import type { Step4Metadata, TtsOptions } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { canonicalFileInput, localTtsResumeConfig, materializeFailedProviderState, policySkippedState, successfulTarget, ttsTarget } from './tts-resume-fixtures'

describe('canonical TTS resume — item-scoped and batch scope', () => {
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

  test('resumes every TTS batch item without rewriting the manifest as a single run', async () => {
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
      await writeManifest(dir, { ...createManifest('tts', 'batch', items), createdAt, updatedAt: createdAt })
      const ranTargetKeys: string[] = []

      await expect(resumeGenerationTarget(
        { kind: 'tts', scope: 'batch', dir, manifestPath: join(dir, PIPELINE_MANIFEST_FILE) },
        localTtsResumeConfig([target], new Map(), ranTargetKeys),
        {} as TtsOptions
      )).resolves.toEqual({ full: 2, incomplete: 0, failed: 0 })
      expect(ranTargetKeys).toEqual([])
      const manifest = await readManifest(dir)
      expect(manifest?.scope).toBe('batch')
      expect(manifest?.createdAt).toBe(createdAt)
      expect(manifest?.items).toHaveLength(2)
      expect(manifest?.source).toMatchObject({
        selectedCount: 2,
        summary: {
          ok: 0,
          partial: 2,
          fail: 0,
          requestedProviders: [{ service: target.service, model: target.model }]
        }
      })
    })
  })

  test('runs TTS batch resume items at the configured batch concurrency', async () => {
    await withTempDir('autoshow-tts-resume-batch-concurrency-', async (dir) => {
      const target = { ...ttsTarget(), voice: 'alloy' }
      const items = await Promise.all(['first', 'second', 'third'].map(async (label) => {
        const inputPath = join(dir, `${label}.txt`)
        const text = `${label} concurrent resume fixture.`
        await Bun.write(inputPath, text)
        const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
        const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
        const failed = await materializeFailedProviderState({
          rootDir: dir,
          target,
          text,
          sourceIdentity,
          dialoguePlan,
          artifactRoot: `items/${label}/providers`
        })
        return createManifestItem(dir, {
          input: canonicalFileInput(sourceIdentity),
          status: 'failed',
          metadata: { tts: [] },
          providers: [failed]
        })
      }))
      await writeManifest(dir, createManifest('tts', 'batch', items))

      let active = 0
      let maxActive = 0
      let started = 0
      const config = {
        ...localTtsResumeConfig([target], new Map(), []),
        runMissingTargets: async () => {
          started += 1
          active += 1
          maxActive = Math.max(maxActive, active)
          await Bun.sleep(40)
          active -= 1
          throw new Error('expected concurrent resume fixture failure')
        }
      }

      await expect(resumeGenerationTarget(
        { kind: 'tts', scope: 'batch', dir, manifestPath: join(dir, PIPELINE_MANIFEST_FILE) },
        config,
        { batchConcurrency: 3 } as TtsOptions
      )).rejects.toThrow('failed items')

      expect(started).toBe(3)
      expect(maxActive).toBe(3)
    })
  })

  test('isolates concurrent resume item provider workspaces', async () => {
    await withTempDir('autoshow-tts-resume-workspace-isolation-', async (dir) => {
      const target = { ...ttsTarget(), voice: 'alloy' }
      const fixtures = await Promise.all(['first', 'second'].map(async (label) => {
        const inputPath = join(dir, `${label}.txt`)
        const text = `${label} isolated resume workspace fixture.`
        await Bun.write(inputPath, text)
        const sourceIdentity = await createFileTtsSourceIdentity(inputPath, text)
        const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, text)
        const failed = await materializeFailedProviderState({
          rootDir: dir,
          target,
          text,
          sourceIdentity,
          dialoguePlan,
          artifactRoot: `items/${label}/providers`
        })
        return { inputPath, text, sourceIdentity, failed }
      }))
      await writeManifest(dir, createManifest('tts', 'batch', fixtures.map((fixture) => createManifestItem(dir, {
        input: canonicalFileInput(fixture.sourceIdentity),
        status: 'failed',
        metadata: { tts: [] },
        providers: [fixture.failed]
      }))))

      const providerWorkspaces: string[] = []
      const baseCandidate = successfulTarget(target)
      const candidate = {
        ...baseCandidate,
        run: async (...args: Parameters<typeof baseCandidate.run>) => {
          providerWorkspaces.push(args[1])
          return await baseCandidate.run(...args)
        }
      }
      const manifestUpdater = createBatchedManifestUpdater(
        async (update) => await updateManifest(dir, update)
      )
      await Promise.all(fixtures.map(async (fixture, itemIndex) => await ttsResumeConfig.runMissingTargets(
        [candidate],
        fixture.text,
        dir,
        {},
        {
          outputDir: dir,
          runtimeOptions: {},
          targets: [candidate],
          existingEntries: [],
          currentManifestMetadata: {},
          currentProviderStates: [fixture.failed],
          itemIndex,
          manifestUpdater
        }
      )))

      expect(providerWorkspaces).toHaveLength(2)
      expect(new Set(providerWorkspaces).size).toBe(2)
      expect(providerWorkspaces.some((workspace) => workspace.includes('.tts-resume-001-'))).toBe(true)
      expect(providerWorkspaces.some((workspace) => workspace.includes('.tts-resume-002-'))).toBe(true)
    })
  })

  test('batch TTS resume with authorization redispatches only unresolved items', async () => {
    await withTempDir('autoshow-tts-resume-batch-redispatch-', async (dir) => {
      const createdAt = new Date(0).toISOString()
      const target = { ...ttsTarget(), voice: 'alloy' }
      const firstPath = join(dir, 'first.txt')
      const secondPath = join(dir, 'second.txt')
      const firstText = 'Completed batch chapter stays retained.'
      const secondText = 'Unresolved batch chapter may be repurchased.'
      await Bun.write(firstPath, firstText)
      await Bun.write(secondPath, secondText)
      const firstIdentity = await createFileTtsSourceIdentity(firstPath, firstText)
      const secondIdentity = await createFileTtsSourceIdentity(secondPath, secondText)
      const firstPlan = createSingleTurnTtsDialoguePlan(firstIdentity, firstText, createdAt)
      const secondPlan = createSingleTurnTtsDialoguePlan(secondIdentity, secondText, createdAt)
      const skipped = bindTtsDialoguePlanArtifact(
        policySkippedState(target, 'items/first/providers'),
        await materializeTtsDialoguePlanArtifact(dir, firstPlan)
      )
      const failed = await materializeFailedProviderState({
        rootDir: dir,
        target,
        text: secondText,
        sourceIdentity: secondIdentity,
        dialoguePlan: secondPlan,
        admitted: true,
        artifactRoot: 'items/second/providers'
      })
      await writeManifest(dir, {
        ...createManifest('tts', 'batch', [
          createManifestItem(dir, {
            input: canonicalFileInput(firstIdentity),
            status: 'skipped',
            metadata: { tts: [] },
            providers: [skipped]
          }),
          createManifestItem(dir, {
            input: canonicalFileInput(secondIdentity),
            status: 'failed',
            metadata: { tts: [] },
            providers: [failed]
          })
        ]),
        createdAt,
        updatedAt: createdAt
      })

      await expect(resumeGenerationTarget(
        { kind: 'tts', scope: 'batch', dir, manifestPath: join(dir, PIPELINE_MANIFEST_FILE) },
        ttsResumeConfig,
        {} as TtsOptions
      )).rejects.toThrow(/failed items|automatic redispatch is blocked/)

      let providerCalls = 0
      const candidate = successfulTarget(target, () => { providerCalls += 1 })
      await expect(ttsResumeConfig.runMissingTargets(
        [candidate],
        secondText,
        dir,
        { ttsAllowAmbiguousRedispatch: true },
        {
          outputDir: dir,
          runtimeOptions: { ttsAllowAmbiguousRedispatch: true },
          targets: [candidate],
          existingEntries: [],
          currentManifestMetadata: {},
          currentProviderStates: [failed],
          itemIndex: 1
        }
      )).resolves.toHaveLength(1)
      expect(providerCalls).toBe(1)
      expect((await readManifest(dir))?.createdAt).toBe(createdAt)
      expect((await readManifest(dir))?.items).toHaveLength(2)
    })
  })

  test('batch TTS resume price reports unresolved remainder instead of full chapter text', async () => {
    await withTempDir('autoshow-tts-resume-batch-price-remainder-', async (dir) => {
      const createdAt = new Date(0).toISOString()
      const target = { ...ttsTarget(), voice: 'alloy' }
      const firstPath = join(dir, 'first.txt')
      const secondPath = join(dir, 'second.txt')
      const firstText = 'Already complete batch chapter.'
      const secondText = 'Host: First turn.\nGuest: Second turn.\nHost: Third turn.'
      const dialogueOptions: TtsOptions = {
        ttsDialogueFormat: 'labeled',
        ttsSpeakers: ['Host=alloy', 'Guest=verse'],
        ttsMaxGenerationSlots: 1,
        ttsTurnControls: {
          'dialogue-turn-001': { openai: {} },
          'dialogue-turn-002': { openai: {} },
          'dialogue-turn-003': { openai: {} }
        },
        ttsCanonicalTurns: [
          { turnId: 'dialogue-turn-001', speaker: 'Host', text: 'First turn.' },
          { turnId: 'dialogue-turn-002', speaker: 'Guest', text: 'Second turn.' },
          { turnId: 'dialogue-turn-003', speaker: 'Host', text: 'Third turn.' }
        ]
      }
      await Bun.write(firstPath, firstText)
      await Bun.write(secondPath, secondText)
      const firstIdentity = await createFileTtsSourceIdentity(firstPath, firstText)
      const secondIdentity = await createFileTtsSourceIdentity(secondPath, secondText)
      const firstPlan = createSingleTurnTtsDialoguePlan(firstIdentity, firstText, createdAt)
      const secondPlan = createGenericTtsDialoguePlan(secondIdentity, secondText, dialogueOptions, createdAt)
      const skipped = bindTtsDialoguePlanArtifact(
        policySkippedState(target, 'items/first/providers'),
        await materializeTtsDialoguePlanArtifact(dir, firstPlan)
      )
      const partialRun = await runTtsForTargets(
        secondText,
        dir,
        dialogueOptions,
        [successfulTarget(target)],
        {
          sourceIdentity: secondIdentity,
          dialoguePlan: secondPlan,
          artifactOutputDir: dir,
          artifactRoot: 'items/second/providers'
        }
      )
      const partialState = bindTtsDialoguePlanArtifact(
        buildCurrentTtsProviderState(partialRun.metadata[0] as Step4Metadata),
        await materializeTtsDialoguePlanArtifact(dir, secondPlan)
      )
      await writeManifest(dir, {
        ...createManifest('tts', 'batch', [
          createManifestItem(dir, {
            input: canonicalFileInput(firstIdentity),
            status: 'skipped',
            metadata: { tts: [] },
            providers: [skipped]
          }),
          createManifestItem(dir, {
            input: canonicalFileInput(secondIdentity),
            status: 'incomplete',
            metadata: { tts: [] },
            providers: [partialState]
          })
        ]),
        createdAt,
        updatedAt: createdAt
      })

      const { ttsMaxGenerationSlots: _limit, ...unboundedOptions } = dialogueOptions
      const fullSecond = await buildTtsTargetEstimates([target], unboundedOptions, secondText.length)
      const estimate = await priceGenerationTarget(
        { kind: 'tts', scope: 'batch', dir, manifestPath: join(dir, PIPELINE_MANIFEST_FILE) },
        { ...ttsResumeConfig, collectTargets: () => [target] },
        unboundedOptions,
        new Set(['openai-tts'])
      )
      const fullBook = await buildTtsTargetEstimates([target], unboundedOptions, firstText.length + secondText.length)

      expect(estimate.totalEstimatedCost).toBeGreaterThan(0)
      expect(estimate.totalEstimatedCost).toBeLessThan(fullSecond[0]?.totalCost ?? Number.POSITIVE_INFINITY)
      expect(estimate.totalEstimatedCost).toBeLessThan(fullBook[0]?.totalCost ?? Number.POSITIVE_INFINITY)
      expect(estimate.steps.some((step) => step.step === 'tts' && (step.characterCount ?? 0) < secondText.length)).toBe(true)
    })
  })
})
