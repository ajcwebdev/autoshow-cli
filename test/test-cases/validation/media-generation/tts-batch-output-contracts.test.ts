import { describe, expect, test } from 'bun:test'
import {
  buildTtsBatchRunMetadata,
  getTtsBatchAudioFileName
} from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import type { CompletedTtsBatchItem, HostedTtsSchedulerTelemetry, Step4Metadata } from '~/types'

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

const buildTtsMetadata = (overrides: Partial<Step4Metadata> = {}): Step4Metadata => ({
  ttsService: 'kitten',
  ttsModel: 'kitten-tts-mini',
  processingTime: 100,
  audioFileName: 'speech.wav',
  audioFileSize: 10,
  chunkCount: 1,
  ...overrides
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

  test('batch run metadata aggregates all speech outputs into one run manifest payload', () => {
    const first = buildTtsMetadata({
      audioFileName: 'guinea-00-preface.wav',
      audioFileSize: 101
    })
    const second = buildTtsMetadata({
      audioFileName: 'guinea-01-nonconsensual-experimentation.wav',
      audioFileSize: 102
    })

    const metadata = buildTtsBatchRunMetadata(
      [
        buildCompletedItem(0, 'guinea-00-preface', 'chapters/00-preface.md', 1000, [first]),
        buildCompletedItem(1, 'guinea-01-nonconsensual-experimentation', 'chapters/01-nonconsensual-experimentation.md', 2000, [second])
      ],
      [
        {
          input: 'chapters/00-preface.md',
          inputKind: 'text',
          audioStem: 'guinea-00-preface',
          characterCount: 1000,
          completionStatus: 'full',
          tts: [first]
        },
        {
          input: 'chapters/01-nonconsensual-experimentation.md',
          inputKind: 'text',
          audioStem: 'guinea-01-nonconsensual-experimentation',
          characterCount: 2000,
          completionStatus: 'full',
          tts: [second]
        }
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
        requestedProviders: [{ service: 'kitten', model: 'kitten-tts-mini' }]
      }
    )

    expect(asRecord(metadata['batch'])['selectedCount']).toBe(2)
    expect(asArray(metadata['tts']).map((entry) => asRecord(entry)['audioFileName'])).toEqual([
      'guinea-00-preface.wav',
      'guinea-01-nonconsensual-experimentation.wav'
    ])
    expect(asArray(metadata['items']).map((entry) => asRecord(entry)['audioStem'])).toEqual([
      'guinea-00-preface',
      'guinea-01-nonconsensual-experimentation'
    ])
    expect(asArray(metadata['items']).every((entry) => !('outputDir' in asRecord(entry)))).toBe(true)

    const cost = asRecord(metadata['cost'])
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

    const metadata = buildTtsBatchRunMetadata(
      [buildCompletedItem(0, 'chapter', 'chapters/chapter.md', 4100, [metadataEntry])],
      [{
        input: 'chapters/chapter.md',
        inputKind: 'text',
        audioStem: 'chapter',
        characterCount: 4100,
        completionStatus: 'full',
        tts: [metadataEntry]
      }],
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

    expect(asRecord(metadata['hostedTtsScheduler'])['providers']).toEqual(telemetry.providers)
    expect(asRecord(metadata['hostedTtsScheduler'])['jobs']).toEqual(telemetry.jobs)
  })
})
