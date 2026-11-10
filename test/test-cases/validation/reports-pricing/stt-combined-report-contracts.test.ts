import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildSttCombinedReport } from '../../../../.codex/skills/consensus/scripts/stt/build_combined_report'
import { withTempDir } from '../../../test-utils/temp-dirs'

const writeRun = async (root: string, name: string, providerGroups: Record<string, unknown>): Promise<void> => {
  await mkdir(join(root, name), { recursive: true })
  await writeFile(join(root, name, 'reference-comparison-report.json'), JSON.stringify({ runName: name, providerCount: 2, providerGroups }))
}

describe('STT combined report sample collection', () => {
  test('collects one sample per keyed provider row with actual-value precedence, null defaults and first-seen identity', async () => {
    await withTempDir('stt-combined-report-', async root => {
      await writeRun(root, 'run-a', {
        local: {
          providers: [
            {
              providerKey: 'whisper/base', provider: 'whisper', model: 'base', group: 'local',
              processingTimeMs: 4000, actualProcessingTimeMs: 2000, costCents: 9, actualCostCents: 0,
              audioDurationSeconds: 10, realtimeFactor: 2.5, supportsDiarization: false, diarizationSupport: 'none',
              metrics: { score: 80, speakerAwareWER: 0.3, textOnlyWER: 0.2 }
            },
            { provider: 'unkeyed', model: 'ignored', group: 'local', metrics: { score: 1 } },
            { providerKey: '', provider: 'empty-key', group: 'local', metrics: { score: 2 } }
          ]
        },
        thirdPartyServiceDiarization: {
          providers: [{ providerKey: 'cloud/large', group: 'thirdPartyServiceDiarization', processingTimeMs: 1000, costCents: 4, metrics: { score: 90 } }]
        },
        emptyGroup: {}
      })
      await writeRun(root, 'run-b', {
        local: {
          providers: [{
            providerKey: 'whisper/base', provider: 'renamed-later', model: 'renamed-later', group: 'local',
            processingTimeMs: 6000, costCents: 3, audioDurationSeconds: 30, supportsDiarization: true, diarizationSupport: 'native',
            metrics: { score: 60, textOnlyWER: 0.4 }
          }]
        },
        unknownGroup: { providers: [{ providerKey: 'cloud/large', provider: 'cloud', model: 'large', group: 'unrecognized', metrics: {} }] }
      })

      const result = buildSttCombinedReport(root, '2026-01-01T00:00:00.000Z')
      expect(result.runCount).toBe(2)
      expect(result.providerCount).toBe(2)
      expect(result.groupedProviders.local).toEqual([{
        providerKey: 'whisper/base', provider: 'whisper', model: 'base', group: 'local', runsCovered: 2,
        meanQualityScore: 70, meanSpeakerAwareWER: 0.3, meanTextOnlyWER: expect.closeTo(0.3, 10),
        meanProcessingTimeMs: 4000, aggregateRealtimeFactor: 5, meanCostCents: 1.5, totalCostCents: 3,
        supportsDiarization: true, diarizationSupport: 'native', perRun: { 'run-a': 80, 'run-b': 60 }
      }])
      const cloud = [...result.groupedProviders.thirdPartyServiceDiarization, ...result.groupedProviders.thirdPartyServiceNonDiarization]
      expect(cloud).toEqual([{
        providerKey: 'cloud/large', provider: 'cloud/large', model: '', group: expect.any(String), runsCovered: 2,
        meanQualityScore: 90, meanSpeakerAwareWER: null, meanTextOnlyWER: null,
        meanProcessingTimeMs: 1000, aggregateRealtimeFactor: null, meanCostCents: 4, totalCostCents: 4,
        supportsDiarization: null, diarizationSupport: null, perRun: { 'run-a': 90, 'run-b': null }
      }])
    })
  })
})
