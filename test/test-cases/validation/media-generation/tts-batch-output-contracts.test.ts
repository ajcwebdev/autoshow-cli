import { describe, expect, test } from 'bun:test'
import {
  buildTtsBatchSource,
  getTtsBatchAudioFileName,
  moveTtsBatchAudioFiles
} from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import type { CompletedTtsBatchItem, HostedTtsSchedulerTelemetry, Step4Metadata } from '~/types'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { mkdir } from 'node:fs/promises'
import { createMetadataFixtureBuilder } from '../../../test-utils/metadata-fixtures'

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  throw new Error('Expected record')
}

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value
  }
  throw new Error('Expected array')
}

const buildTtsMetadata = createMetadataFixtureBuilder<Step4Metadata>({
  ttsService: 'openai',
  ttsModel: 'gpt-4o-mini-tts-2025-12-15',
  processingTime: 100,
  audioFileName: 'speech.wav',
  audioFileSize: 10,
  chunkCount: 1
})

const buildCompletedItem = (
  index: number,
  itemStem: string,
  inputPath: string,
  characterCount: number,
  metadata: Step4Metadata[]
): CompletedTtsBatchItem => ({
  index,
  inputPath,
  itemStem,
  metadata,
  characterCount,
  run: {
    metadata,
    cost: {
      estimated: {
        totalCost: 1,
        steps: metadata.map((entry) => ({
          step: 'tts' as const,
          provider: entry.ttsService,
          model: entry.ttsModel,
          cost: 1 / metadata.length
        }))
      },
      observedEstimate: {
        totalCost: 1,
        steps: metadata.map((entry) => ({
          step: 'tts' as const,
          provider: entry.ttsService,
          model: entry.ttsModel,
          cost: 1 / metadata.length
        }))
      },
      actual: {
        totalCost: 1,
        steps: metadata.map((entry) => ({
          step: 'tts' as const,
          provider: entry.ttsService,
          model: entry.ttsModel,
          cost: 1 / metadata.length,
          costSource: 'computed_usage' as const,
          inputMetric: 'characters',
          inputValue: characterCount
        }))
      }
    },
    timing: {
      estimated: {
        totalProcessingTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
        steps: metadata.map((entry) => ({
          step: 'tts' as const,
          provider: entry.ttsService,
          model: entry.ttsModel,
          processingTimeMs: entry.processingTime,
          inputMetric: 'characters',
          inputValue: characterCount
        }))
      },
      actual: {
        totalProcessingTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
        steps: metadata.map((entry) => ({
          step: 'tts' as const,
          provider: entry.ttsService,
          model: entry.ttsModel,
          processingTimeMs: entry.processingTime,
          inputMetric: 'characters',
          inputValue: characterCount
        }))
      }
    }
  }
})

describe('tts batch output contracts', () => {
  test('batch audio promotion never moves or rebases stable provider artifacts', async () => {
    await withTempDir('autoshow-tts-batch-promotion-', async (dir) => {
      const workspaceDir = join(dir, 'workspace')
      const batchDir = join(dir, 'batch')
      const artifactDir = 'providers/target-key/renders/render-id/result-id'
      await mkdir(join(workspaceDir, artifactDir, 'provider-render', 'audio-run'), { recursive: true })
      await mkdir(batchDir)
      await Bun.write(join(workspaceDir, 'speech.wav'), createSyntheticWavBytes({ durationSeconds: 0.1, amplitude: 0.2, frequencyHz: 440 }))
      await Bun.write(join(workspaceDir, artifactDir, 'provider-render', 'render-plan.json'), '{}\n')
      await Bun.write(join(workspaceDir, artifactDir, 'provider-render', 'audio-run', 'audio-run.json'), '{}\n')

      const moved = await moveTtsBatchAudioFiles(workspaceDir, batchDir, 'item-one', [buildTtsMetadata({ artifactDir })], true)
      expect(moved[0]?.audioFileName).toBe('item-one.wav')
      expect(moved[0]?.artifactDir).toBe(artifactDir)
      expect(await Bun.file(join(batchDir, 'item-one.wav')).exists()).toBe(true)
      expect(await Bun.file(join(workspaceDir, artifactDir, 'provider-render', 'render-plan.json')).exists()).toBe(true)
      expect(await Bun.file(join(workspaceDir, artifactDir, 'provider-render', 'audio-run', 'audio-run.json')).exists()).toBe(true)
    })
  })

  test('batch audio filenames use the former child directory stem', () => {
    expect(getTtsBatchAudioFileName(
      'guinea-00-preface',
      buildTtsMetadata(),
      true
    )).toBe('guinea-00-preface.wav')

    expect(getTtsBatchAudioFileName(
      'guinea-00-preface',
      buildTtsMetadata({
        ttsService: 'openai',
        ttsModel: 'gpt-4o-mini-tts-2025-12-15',
        audioFileName: 'speech-openai-gpt-4o-mini-tts-2025-12-15.wav'
      }),
      false
    )).toBe('guinea-00-preface-openai-gpt-4o-mini-tts-2025-12-15.wav')

    expect(getTtsBatchAudioFileName(
      'guinea-00-preface',
      buildTtsMetadata({
        ttsService: 'elevenlabs',
        ttsModel: 'eleven_v3',
        audioFileName: 'speech-elevenlabs-eleven_v3.wav'
      }),
      false
    )).toBe('guinea-00-preface-elevenlabs-eleven_v3.wav')
  })

  test('batch-scoped canonical source aggregates costs without duplicating item payloads', () => {
    const first = buildTtsMetadata({
      audioFileName: 'guinea-00-preface.wav',
      audioFileSize: 101
    })
    const second = buildTtsMetadata({
      audioFileName: 'guinea-01-nonconsensual-experimentation.wav',
      audioFileSize: 102
    })

    const source = buildTtsBatchSource(
      [
        buildCompletedItem(0, 'guinea-00-preface', 'chapters/00-preface.md', 1000, [first]),
        buildCompletedItem(1, 'guinea-01-nonconsensual-experimentation', 'chapters/01-nonconsensual-experimentation.md', 2000, [second])
      ],
      {
        sourceKind: 'directory',
        sourceUrl: 'chapters',
        title: 'chapters',
        selectedCount: 2
      },
      {
        ok: 2,
        partial: 0,
        fail: 0,
        wallTimeMs: 300,
        requestedProviders: [{ service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }]
      }
    )

    expect(source['selectedCount']).toBe(2)
    expect(source['items']).toBeUndefined()
    expect(source['tts']).toBeUndefined()
    const cost = asRecord(asRecord(source['summary'])['cost'])
    expect(asRecord(cost['actual'])['totalCost']).toBe(2)
    expect(asArray(asRecord(cost['actual'])['steps'])).toHaveLength(2)
  })

  test('batch run metadata includes hosted TTS scheduler telemetry when provided', () => {
    const metadataEntry = buildTtsMetadata({
      ttsService: 'openai',
      ttsModel: 'gpt-4o-mini-tts-2025-12-15',
      audioFileName: 'chapter-openai-gpt-4o-mini-tts-2025-12-15.wav'
    })
    const telemetry: HostedTtsSchedulerTelemetry = {
      providers: [{
        provider: 'openai',
        maxLimit: 2,
        currentLimit: 2,
        startedChunks: 3,
        completedChunks: 3,
        failedChunks: 0,
        retryCount: 0,
        rateLimitCount: 0,
        maxActive: 2,
        queueWait: { totalMs: 10, maxMs: 8, p50Ms: 2, p95Ms: 8 },
        activeLatency: { totalMs: 30, maxMs: 15, p50Ms: 10, p95Ms: 15 },
        pauseTimeMs: 0,
        limitChanges: []
      }],
      jobs: [{
        provider: 'openai',
        jobId: 'chapter-openai',
        inputIndex: 0,
        targetIndex: 0,
        chunkCount: 3,
        startedChunks: 3,
        completedChunks: 3,
        failedChunks: 0,
        retryCount: 0,
        rateLimitCount: 0,
        queueWait: { totalMs: 10, maxMs: 8, p50Ms: 2, p95Ms: 8 },
        activeLatency: { totalMs: 30, maxMs: 15, p50Ms: 10, p95Ms: 15 }
      }]
    }

    const source = buildTtsBatchSource(
      [buildCompletedItem(0, 'chapter', 'chapters/chapter.md', 4100, [metadataEntry])],
      {
        sourceKind: 'directory',
        sourceUrl: 'chapters',
        title: 'chapters',
        selectedCount: 1
      },
      {
        ok: 1,
        partial: 0,
        fail: 0,
        wallTimeMs: 300,
        requestedProviders: [{ service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }]
      },
      telemetry
    )

    const scheduler = asRecord(asRecord(source['summary'])['hostedTtsScheduler'])
    expect(scheduler['providers']).toEqual(telemetry.providers)
    expect(scheduler['jobs']).toEqual(telemetry.jobs)
  })
})
