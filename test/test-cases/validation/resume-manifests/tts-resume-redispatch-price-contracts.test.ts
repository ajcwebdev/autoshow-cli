import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import { createManifest,createManifestItem,PIPELINE_MANIFEST_FILE,writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { createFileTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { priceGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import type { TtsOptions } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { canonicalFileInput,materializeFailedProviderState,resumeTarget,successfulTarget,ttsTarget } from './tts-resume-fixtures'

describe('canonical TTS resume', () => {

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
})
