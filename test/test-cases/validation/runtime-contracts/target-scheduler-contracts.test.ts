import { describe, expect, test } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createResourceGate } from '~/utils/resource-gate'
import { runProviderTargetScheduler } from '~/cli/commands/process-steps/provider-target-scheduler'
import { createProviderLaneIdentity } from '~/cli/commands/process-steps/provider-lane-contract'
import { runImageTargets } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import type { ImageTarget, SchedulerTestTarget, Step5Metadata } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const imageMetadata = (target: ImageTarget, fileName: string): Step5Metadata => ({
  imageService: target.service,
  imageModel: target.model,
  processingTime: 1,
  imageFileNames: [fileName],
  imageCount: 1,
  imageFileSize: 0,
  imageWidth: undefined,
  imageHeight: undefined,
  requestMode: 'generation'
})

describe('target scheduler contracts', () => {
  test('provider lane identity accepts stable labels and rejects credential-like values', () => {
    expect(createProviderLaneIdentity('openai', 'team-a')).toEqual({
      service: 'openai',
      scopeLabel: 'team-a',
      laneKey: 'openai:team-a'
    })
    expect(() => createProviderLaneIdentity('openai', 'a'.repeat(64))).toThrow('not credentials or credential hashes')
    expect(() => createProviderLaneIdentity('openai', 'sk-project-secret-value')).toThrow('not credentials or credential hashes')
  })

  test('scheduler enforces hosted/local caps, preserves result slots, and collects partial failures', async () => {
    const targets: SchedulerTestTarget[] = [
      { service: 'local', model: 'a', pool: 'local', delayMs: 8 },
      { service: 'hosted', model: 'a', pool: 'hosted', delayMs: 8 },
      { service: 'hosted', model: 'b', pool: 'hosted', delayMs: 8, fail: true },
      { service: 'local', model: 'b', pool: 'local', delayMs: 8 },
      { service: 'hosted', model: 'c', pool: 'hosted', delayMs: 8 }
    ]
    const active = { hosted: 0, local: 0, total: 0 }
    const max = { hosted: 0, local: 0, total: 0 }

    const scheduled = await runProviderTargetScheduler<SchedulerTestTarget, string>({
      entries: targets.map((target, index) => ({ index, target })),
      concurrency: { provider: 2, local: 1 },
      getPool: (target) => target.pool,
      runTarget: async (_index, target) => {
        active[target.pool] += 1
        active.total += 1
        max[target.pool] = Math.max(max[target.pool], active[target.pool])
        max.total = Math.max(max.total, active.total)
        await Bun.sleep(target.delayMs)
        active[target.pool] -= 1
        active.total -= 1
        if (target.fail) {
          throw new Error(`${target.model} failed`)
        }
        return target.model
      }
    })

    expect(max.hosted).toBe(2)
    expect(max.local).toBe(1)
    expect(max.total).toBe(3)
    expect(scheduled.results).toEqual(['a', 'a', undefined, 'b', 'c'])
    expect(scheduled.failures).toHaveLength(1)
    expect(scheduled.failures[0]).toMatchObject({
      index: 2,
      target: targets[2] as SchedulerTestTarget,
      message: 'b failed'
    })
    expect(scheduled.failures[0]?.error).toBeInstanceOf(Error)
  })

  test('scheduler priority changes execution order without changing output order', async () => {
    const targets: SchedulerTestTarget[] = [
      { service: 'hosted', model: 'slow-first', pool: 'hosted', delayMs: 1, priority: 100 },
      { service: 'hosted', model: 'normal-second', pool: 'hosted', delayMs: 1, priority: 0 },
      { service: 'hosted', model: 'medium-third', pool: 'hosted', delayMs: 1, priority: 50 }
    ]
    const started: string[] = []

    const scheduled = await runProviderTargetScheduler<SchedulerTestTarget, string>({
      entries: targets.map((target, index) => ({ index, target, priority: target.priority })),
      concurrency: { provider: 1, local: 1 },
      getPool: (target) => target.pool,
      onLifecycle: (event) => {
        if (event.status === 'started') {
          started.push(event.target.model)
        }
      },
      runTarget: async (_index, target) => target.model
    })

    expect(started).toEqual(['slow-first', 'medium-third', 'normal-second'])
    expect(scheduled.results).toEqual(['slow-first', 'normal-second', 'medium-third'])
  })

  test('scheduler resource gate caps total hosted and local generation work', async () => {
    const targets: SchedulerTestTarget[] = [
      { service: 'hosted', model: 'hosted-a', pool: 'hosted', delayMs: 10 },
      { service: 'hosted', model: 'hosted-b', pool: 'hosted', delayMs: 10 },
      { service: 'local', model: 'local-a', pool: 'local', delayMs: 10 },
      { service: 'local', model: 'local-b', pool: 'local', delayMs: 10 }
    ]
    const gate = createResourceGate({ capacity: 2 })
    let activeTotal = 0
    let maxTotal = 0

    const scheduled = await runProviderTargetScheduler<SchedulerTestTarget, string>({
      entries: targets.map((target, index) => ({ index, target })),
      concurrency: { provider: 4, local: 4 },
      getPool: (target) => target.pool,
      resourceGate: gate,
      runTarget: async (_index, target) => {
        activeTotal += 1
        maxTotal = Math.max(maxTotal, activeTotal)
        await Bun.sleep(target.delayMs)
        activeTotal -= 1
        return target.model
      }
    })

    expect(gate.capacity).toBe(2)
    expect(maxTotal).toBe(2)
    expect(scheduled.results).toEqual(['hosted-a', 'hosted-b', 'local-a', 'local-b'])
  })

  test('image target runner executes multiple hosted targets concurrently with stable artifact names', async () => {
    const outputDir = await makeTempDir('autoshow-image-target-runner-')
    try {
      const active = { hosted: 0 }
      let maxHosted = 0
      const makeTarget = (model: string): ImageTarget => ({
        service: 'openai',
        model,
        run: async (_prompt, workspaceDir) => {
          active.hosted += 1
          maxHosted = Math.max(maxHosted, active.hosted)
          await Bun.sleep(10)
          const filePath = join(workspaceDir, `${model}.png`)
          await writeFile(filePath, new Uint8Array([1, 2, 3]))
          active.hosted -= 1
          return {
            imagePaths: [filePath],
            metadata: imageMetadata({ service: 'openai', model } as ImageTarget, `${model}.png`)
          }
        }
      })

      const result = await runImageTargets(
        [makeTarget('model-a'), makeTarget('model-b')],
        'prompt',
        outputDir,
        {
          openaiImageModels: ['model-a', 'model-b'],
          geminiImageModels: undefined,
          grokImageModels: undefined,
          bflImageModels: undefined,
          imageAspectRatio: undefined,
          imageSize: undefined,
          imageQuality: undefined,
          imageFormat: undefined,
          imageBackground: undefined,
          imageCount: undefined,
          imageInputs: undefined,
          imageMask: undefined,
          imageResponseMode: undefined,
          geminiSearchGrounding: undefined,
          imageCompression: undefined,
          imageProviderConcurrency: 2,
          imageLocalConcurrency: 1
        }
      )

      expect(maxHosted).toBe(2)
      expect(result.metadata.map((entry) => entry.imageFileNames)).toEqual([
        ['generated-image-openai-model-a.png'],
        ['generated-image-openai-model-b.png']
      ])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
