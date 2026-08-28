import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import { createManifest,createManifestItem,PIPELINE_MANIFEST_FILE,readManifest,writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createFileTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact,materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { priceGenerationTarget,resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { resolveTtsResumeSourceContext } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume-source-context'
import type { TtsOptions } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { canonicalFileInput,localTtsResumeConfig,materializeFailedProviderState,resumeTarget,succeededMetadata,successfulTarget,ttsTarget } from './tts-resume-fixtures'

describe('canonical TTS resume', () => {

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

  test('rejects a pre-canonical TTS manifest instead of reconstructing a target from it', async () => {
    await withTempDir('autoshow-tts-resume-precanonical-', async (dir) => {
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

      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
      await expect(resumeGenerationTarget(
        resumeTarget(dir),
        localTtsResumeConfig([target], new Map(), ranTargetKeys),
        {} as TtsOptions
      )).rejects.toThrow('Invalid canonical manifest')
      await expect(priceGenerationTarget(
        resumeTarget(dir),
        ttsResumeConfig,
        { deepinfraTtsModels: ['ResembleAI/chatterbox-turbo'] } as TtsOptions,
        new Set(['deepinfra-tts'])
      )).rejects.toThrow('Invalid canonical manifest')
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
})
