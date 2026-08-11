import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { runSingleTtsInput, runTtsDirectoryBatch } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import type { CanonicalAudioProviderProjection, PipelineManifest, TtsTarget } from '~/types'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'

const options = (): Parameters<typeof runSingleTtsInput>[1] => ({
  batchConcurrency: 2,
  price: false,
  allowOverBudget: false
})

const kittenTarget = (
  model: string,
  behavior: 'success' | 'failure',
  beforeProvider: () => Promise<void>
): TtsTarget => {
  const voice = 'expr-voice-2-f'
  const bytes = createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 })
  return {
    service: 'kitten',
    model,
    operation: 'tts-synthesis',
    transport: 'local-process',
    targetKey: canonicalTargetKey('tts-synthesis', 'kitten', model, 'local-process'),
    voice,
    run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
      await beforeProvider()
      if (behavior === 'failure') throw new Error(`local ${model} fixture failure before provider dispatch`)
      const audioPath = join(outputDir, 'speech.wav')
      await requestEvidence?.dispatch({
        chunkIndex: 1,
        endpointKind: 'local-runner',
        serializerVersion: 'kitten.tts.phase-0-v1',
        serializedRequest: { text, voice },
        providerText: text,
        voiceField: 'voice',
        voices: [{ kind: 'local-model-voice', value: voice }],
        requestControls: { maxChunkChars: 2000 },
        continuation: { kind: 'none' }
      }, { attempt: 1 }, async ({ accepted }) => {
        await accepted({ fields: { local: true } })
        await Bun.write(audioPath, bytes)
      })
      if (!requestEvidence) await Bun.write(audioPath, bytes)
      await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
      await requestEvidence?.complete({ chunkIndex: 1 })
      return {
        audioPath,
        metadata: {
          ttsService: 'kitten',
          ttsModel: model,
          speaker: voice,
          processingTime: 1,
          audioFileName: 'speech.wav',
          audioFileSize: bytes.byteLength,
          chunkCount: 1
        }
      }
    }
  }
}

const expectCompletePreparedCardinality = async (
  outputDir: string,
  itemCount: number,
  targetCount: number
): Promise<void> => {
  const manifest = await readManifest(outputDir)
  expect(manifest?.items).toHaveLength(itemCount)
  expect(manifest?.items.every((item) => item.providers.length === targetCount)).toBe(true)
  for (const item of manifest?.items ?? []) {
    const references = item.providers.map((provider) => provider.options['dialoguePlan'])
    expect(references.every((reference) => reference !== undefined)).toBe(true)
    expect(new Set(references.map((reference) => JSON.stringify(reference))).size).toBe(1)
    const reference = references[0] as { path: string }
    expect(await Bun.file(join(outputDir, reference.path)).exists()).toBe(true)
  }
}

afterEach(() => resetPinnedRunDir())

describe('canonical standalone TTS lifecycle persistence', () => {
  test('single partial failure is canonical before dispatch and retains real terminal states', async () => {
    await withTempDir('autoshow-tts-canonical-single-', async (dir) => {
      const inputPath = join(dir, 'source.txt')
      const outputDir = join(dir, 'run')
      await Bun.write(inputPath, 'Persist every selected target before local synthesis.')
      configurePinnedRunDir(outputDir)
      const beforeProvider = async () => await expectCompletePreparedCardinality(outputDir, 1, 2)
      const targets = [
        kittenTarget('kitten-tts-mini', 'success', beforeProvider),
        kittenTarget('kitten-tts-nano', 'failure', beforeProvider)
      ]

      await runSingleTtsInput(inputPath, options(), targets, undefined)

      const manifest = await readManifest(outputDir) as PipelineManifest
      expect(manifest.items[0]?.status).toBe('incomplete')
      expect(manifest.items[0]?.providers.map((provider) => provider.status)).toEqual(['succeeded', 'failed'])
      expect(manifest.items[0]?.providers.every((provider) => provider.artifactDir === `providers/${provider.targetKey}`)).toBe(true)
      const succeeded = manifest.items[0]?.providers[0]
      const projection = succeeded?.result?.['ttsAudio'] as CanonicalAudioProviderProjection
      const render = projection.renderHistory[0]!
      const dialoguePlan = await Bun.file(join(outputDir, succeeded?.artifactDir as string, render.renderDir, 'dialogue-plan.json')).json()
      expect(dialoguePlan.createdAt).toBe(manifest.createdAt)
      const itemPlanRef = succeeded?.options['dialoguePlan'] as { dialoguePlanId: string, path: string, sha256: string }
      expect(itemPlanRef.dialoguePlanId).toBe(dialoguePlan.dialoguePlanId)
      expect(await Bun.file(join(outputDir, itemPlanRef.path)).json()).toEqual(dialoguePlan)
    })
  })

  test('single all-target failure leaves a canonical failed manifest', async () => {
    await withTempDir('autoshow-tts-canonical-single-failed-', async (dir) => {
      const inputPath = join(dir, 'source.txt')
      const outputDir = join(dir, 'run')
      await Bun.write(inputPath, 'Retain the real failure projection.')
      configurePinnedRunDir(outputDir)
      const target = kittenTarget('kitten-tts-nano', 'failure', async () =>
        await expectCompletePreparedCardinality(outputDir, 1, 1)
      )

      await expect(runSingleTtsInput(inputPath, options(), [target], undefined)).rejects.toThrow('No TTS outputs were generated')
      const manifest = await readManifest(outputDir)
      expect(manifest?.items[0]?.status).toBe('failed')
      expect(manifest?.items[0]?.providers[0]).toMatchObject({
        targetKey: target.targetKey,
        status: 'failed',
        artifactDir: `providers/${target.targetKey}`
      })
    })
  })

  test('batch partial failures bootstrap every item and target before any dispatch', async () => {
    await withTempDir('autoshow-tts-canonical-batch-', async (dir) => {
      const inputDir = join(dir, 'inputs')
      const outputDir = join(dir, 'run')
      await mkdir(inputDir)
      await Bun.write(join(inputDir, 'first.txt'), 'First batch fixture.')
      await Bun.write(join(inputDir, 'second.txt'), 'Second batch fixture.')
      configurePinnedRunDir(outputDir)
      const beforeProvider = async () => await expectCompletePreparedCardinality(outputDir, 2, 2)
      const targets = [
        kittenTarget('kitten-tts-mini', 'success', beforeProvider),
        kittenTarget('kitten-tts-nano', 'failure', beforeProvider)
      ]

      await runTtsDirectoryBatch(inputDir, options(), targets, undefined)

      const manifest = await readManifest(outputDir)
      expect(manifest?.items.map((item) => item.status)).toEqual(['incomplete', 'incomplete'])
      expect(manifest?.items.every((item) => item.providers.map((provider) => provider.status).join(',') === 'succeeded,failed')).toBe(true)
      const artifactDirs = manifest?.items.flatMap((item) => item.providers.map((provider) => provider.artifactDir)) ?? []
      expect(new Set(artifactDirs).size).toBe(4)
      expect(artifactDirs.every((path) => path.startsWith('items/'))).toBe(true)
    })
  })

  test('batch all-target failure retains every item failure before reporting failure', async () => {
    await withTempDir('autoshow-tts-canonical-batch-failed-', async (dir) => {
      const inputDir = join(dir, 'inputs')
      const outputDir = join(dir, 'run')
      await mkdir(inputDir)
      await Bun.write(join(inputDir, 'first.txt'), 'First failed batch fixture.')
      await Bun.write(join(inputDir, 'second.txt'), 'Second failed batch fixture.')
      configurePinnedRunDir(outputDir)
      const target = kittenTarget('kitten-tts-nano', 'failure', async () =>
        await expectCompletePreparedCardinality(outputDir, 2, 1)
      )

      await expect(runTtsDirectoryBatch(inputDir, options(), [target], undefined)).rejects.toThrow('TTS batch processing failed for 2 item(s)')
      const manifest = await readManifest(outputDir)
      expect(manifest?.items.map((item) => item.status)).toEqual(['failed', 'failed'])
      expect(manifest?.items.every((item) => item.providers[0]?.status === 'failed')).toBe(true)
    })
  })
})
