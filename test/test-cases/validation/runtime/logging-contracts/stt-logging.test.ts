import { describe, expect, test } from 'bun:test'
import {
  buildSttCleanupArtifactsTable,
  buildSttDiarizationConfigTable,
  buildSttProviderSpeakerCountHintsTable,
  buildSttProviderConcurrencyTable,
  buildSttProviderSlotsTable,
  buildSttSplitDecisionTable,
  buildSttSplitSegmentsTable,
  buildSttTranscriptOutputTable,
  logSttProviderConcurrency
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { buildWriteManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { renderHumanTable } from '~/utils/app-logger/human-table/human-table'
import { buildRetryAttemptTable } from '~/utils/retries'
import { stripAnsi } from '~/utils/terminal-colors'
import { createCapturingLogger } from './shared'

describe('logging contracts', () => {
  test('STT provider concurrency summary omits long provider slot details', () => {
      const table = buildSttProviderConcurrencyTable({
        mode: 'cloud_provider_concurrency',
        requested: 2,
        effective: 2,
        batchConcurrency: 1,
        hostedProviders: 27,
        providerSlots: 'assemblyai/universal-3-pro:create=2,poll=1, deepgram/nova-3:launch=4'
      })

      expect(table).toEqual({
        columns: ['mode', 'requested', 'effective', 'batch', 'providers'],
        rows: [{
          mode: 'cloud_provider_concurrency',
          requested: 2,
          effective: 2,
          batch: 1,
          providers: 27
        }]
      })

      const rendered = stripAnsi(renderHumanTable(table))
      expect(rendered).not.toContain('providerSlots')
      expect(rendered).not.toContain('assemblyai/universal-3-pro')
    })

  test('STT provider slot details render as provider rows', () => {
      const table = buildSttProviderSlotsTable([
        {
          service: 'deepgram',
          model: 'nova-3',
          provider: 'deepgram/nova-3',
          kind: 'sync',
          launchSlots: 4,
          pollSlots: null
        },
        {
          service: 'assemblyai',
          model: 'universal-3-pro',
          provider: 'assemblyai/universal-3-pro',
          kind: 'async',
          launchSlots: 2,
          pollSlots: 1
        }
      ])

      expect(table).toEqual({
        columns: ['provider', 'kind', 'launch', 'poll'],
        rows: [
          { provider: 'deepgram/nova-3', kind: 'sync', launch: 4, poll: '' },
          { provider: 'assemblyai/universal-3-pro', kind: 'async', launch: 2, poll: 1 }
        ]
      })

      const rendered = stripAnsi(renderHumanTable(table))
      expect(rendered).toContain('deepgram/nova-3')
      expect(rendered).toContain('sync')
      expect(rendered).toContain('assemblyai/universal-3-pro')
      expect(rendered).toContain('async')
    })

  test('STT provider concurrency log emits compact summary and slot tables', () => {
      const { logger, writes } = createCapturingLogger()
      const providerSlots = 'deepgram/nova-3:launch=4, assemblyai/universal-3-pro:create=2,poll=1'
      const providerSlotDetails = [
        {
          service: 'deepgram',
          model: 'nova-3',
          provider: 'deepgram/nova-3',
          kind: 'sync',
          launchSlots: 4,
          pollSlots: null
        },
        {
          service: 'assemblyai',
          model: 'universal-3-pro',
          provider: 'assemblyai/universal-3-pro',
          kind: 'async',
          launchSlots: 2,
          pollSlots: 1
        }
      ] as const

      logSttProviderConcurrency(
        logger,
        { requested: 2, effective: 2, hostedProviderCount: 2 },
        1,
        false,
        providerSlots,
        providerSlotDetails
      )

      expect(writes.map(write => write.message)).toEqual([
        'STT Provider Concurrency',
        'STT Provider Slots'
      ])
      expect(writes[0]?.options?.humanTable?.columns).toEqual(['mode', 'requested', 'effective', 'batch', 'providers'])
      expect(writes[1]?.options?.humanTable?.columns).toEqual(['provider', 'kind', 'launch', 'poll'])
      expect(writes[0]?.options?.metadata).toMatchObject({
        providerSlots,
        providerSlotDetails
      })
    })

  test('STT split and retry table builders expose structured rows', () => {
      expect(buildSttSplitDecisionTable(
        { service: 'groq', model: 'whisper-large-v3-turbo' },
        {
          reasons: [{ kind: 'attachment_cap', attachmentCapBytes: 25_000_000, audioFileSizeBytes: 30_000_000 }],
          segmentDurationMinutes: 12.5
        }
      )).toEqual({
        columns: ['provider', 'model', 'trigger', 'reason', 'cap', 'inputSize', 'inputDuration', 'segmentDuration'],
        rows: [{
          provider: 'groq',
          model: 'whisper-large-v3-turbo',
          trigger: 'auto',
          reason: 'attachment_cap',
          cap: '23.8 MB',
          inputSize: '28.6 MB',
          inputDuration: '',
          segmentDuration: '12.5m'
        }]
      })

      expect(buildSttSplitDecisionTable(
        { service: 'gladia', model: 'default' },
        {
          reasons: [{ kind: 'duration_cap', maxDurationSeconds: 8100, audioDurationSeconds: 9000 }],
          segmentDurationMinutes: 30
        }
      )).toEqual({
        columns: ['provider', 'model', 'trigger', 'reason', 'cap', 'inputSize', 'inputDuration', 'segmentDuration'],
        rows: [{
          provider: 'gladia',
          model: 'default',
          trigger: 'auto',
          reason: 'duration_cap',
          cap: '8100s',
          inputSize: '',
          inputDuration: '9000s',
          segmentDuration: '30m'
        }]
      })

      expect(buildRetryAttemptTable({
        operation: 'supadata-poll-transcript',
        attempt: 2,
        maxAttempts: 4,
        reason: 'retryable status 429',
        delayMs: 1000
      })).toEqual({
        columns: ['key', 'value'],
        rows: [
          { key: 'operation', value: 'supadata-poll-transcript' },
          { key: 'attempt', value: 2 },
          { key: 'maxAttempts', value: 4 },
          { key: 'reason', value: 'retryable status 429' },
          { key: 'delayMs', value: 1000 }
        ]
      })
    })

  test('STT segment, diarization, output, and cleanup tables use compact shapes', () => {
      expect(buildSttSplitSegmentsTable([
        {
          path: '/tmp/out/segments/segment_001.flac',
          segmentNumber: 1,
          totalSegments: 2,
          startSeconds: 0,
          durationSeconds: 1799.5
        },
        {
          path: '/tmp/out/segments/segment_002.flac',
          segmentNumber: 2,
          totalSegments: 2,
          startSeconds: 1799.5,
          durationSeconds: 60
        }
      ])).toEqual({
        columns: ['segment', 'start', 'duration', 'path'],
        rows: [
          { segment: '1/2', start: '0s', duration: '1799.5s', path: '/tmp/out/segments/segment_001.flac' },
          { segment: '2/2', start: '1799.5s', duration: '60s', path: '/tmp/out/segments/segment_002.flac' }
        ]
      })

      expect(buildSttDiarizationConfigTable({
        provider: 'assemblyai',
        model: 'universal-3-pro',
        enabled: true,
        speakerCount: 3,
        maxSpeakers: 3
      }).rows).toEqual([
        { key: 'provider', value: 'assemblyai' },
        { key: 'model', value: 'universal-3-pro' },
        { key: 'enabled', value: true },
        { key: 'speakerCount', value: 3 },
        { key: 'maxSpeakers', value: 3 }
      ])

      expect(buildSttTranscriptOutputTable({
        provider: 'reverb',
        path: '/tmp/out/transcription.txt',
        characters: 1234,
        speakers: 2
      }).columns).toEqual(['key', 'value'])

      const cleanupRendered = stripAnsi(renderHumanTable(buildSttCleanupArtifactsTable([
        { artifact: 'ctm', path: '/tmp/out/reverb-output/file.ctm' }
      ])))
      expect(cleanupRendered).toContain('\u2502 ctm \u2502 /tmp/out/reverb-output/file.ctm')
      expect(cleanupRendered).not.toContain('\u2502 artifact \u2502 path')

      expect(buildSttProviderSpeakerCountHintsTable([
        { provider: 'assemblyai/universal-3-pro', speakerCount: 2, support: 'honored' },
        { provider: 'reverb/reverb_asr_v1', speakerCount: 2, support: 'ignored' }
      ]).columns).toEqual(['provider', 'speakerCount', 'support'])
    })

  test('STT manifest summary displays concise Reverb ASR model label', () => {
      const reverbDescriptor = '/Users/ajc/c/as/autoshow-cli/runtime/models/reverb/reverb_asr_v1/reverb_asr_v1.pt | /Users/ajc/c/as/autoshow-cli/runtime/models/reverb/reverb_asr_v1/config.yaml | diarization:v2'
      const metadata = {
        step2: {
          transcriptionService: 'reverb',
          transcriptionModel: reverbDescriptor,
          processingTime: 67000,
          tokenCount: 1234
        },
        cost: {
          estimated: {
            totalCost: 0,
            steps: [{
              step: 'stt',
              provider: 'reverb',
              model: 'reverb',
              cost: 0
            }]
          },
          actual: {
            totalCost: 0,
            steps: [{
              step: 'stt',
              provider: 'reverb',
              model: reverbDescriptor,
              cost: 0
            }]
          }
        }
      }

      const summary = buildWriteManifestConsoleSummary(metadata)
      expect(summary.runSummary?.rows[0]).toMatchObject({
        step: 'Transcribe',
        providerModel: 'reverb/reverb_asr_v1',
        predictedCostCents: 0,
        actualCostCents: 0
      })
      expect(summary.promptUsage?.rows[0]).toMatchObject({
        step: 'Transcribe',
        providerModel: 'reverb/reverb_asr_v1',
        usage: '1234 tok'
      })
    })
})
