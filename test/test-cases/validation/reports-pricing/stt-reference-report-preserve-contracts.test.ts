import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { writeMultiProviderManifestFixture } from '../../../test-utils/manifest-helpers'
import { readBunSpawnStreamText as readStreamText } from '../../../test-utils/stream-text'
import { withTempDir } from '../../../test-utils/temp-dirs'

const REPORT_SCRIPT = resolve(import.meta.dir, '../../../../.codex/skills/consensus/scripts/stt/build_reference_report.ts')
const GEMINI_TIMING_WARNING = 'Gemini generated compressed timestamps relative to the known audio duration; timing should be treated as coarse/unreliable.'

interface ProviderDetail {
  providerKey: string
  provider: string
  qualityWarnings: string[]
  [key: string]: unknown
}
interface ReferenceReport {
  providerCount: number
  providerGroups: Record<'local' | 'thirdPartyServiceNonDiarization' | 'thirdPartyServiceDiarization', { count: number, providers: ProviderDetail[] }>
}

const geminiRawResponse = (parts: unknown[]): unknown => ({ candidates: [null, { content: { parts: 'not-parts' } }, { content: { parts } }] })

const runReferenceReport = async (runDir: string, extraArgs: string[] = []): Promise<ReferenceReport> => {
  const proc = Bun.spawn([process.execPath, REPORT_SCRIPT, runDir, ...extraArgs], { stdout: 'pipe', stderr: 'pipe' })
  const [stderr, exitCode] = await Promise.all([readStreamText(proc.stderr), proc.exited])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  return await Bun.file(join(runDir, 'reference-comparison-report.json')).json() as ReferenceReport
}

const writeRunFixture = async (runDir: string): Promise<void> => {
  await writeFile(join(runDir, 'consensus-transcription.txt'), '[00:00:00] [speaker-1] Alpha beta.\n[00:00:04] [speaker-2] Gamma delta.\n')
  const segments = [{ start: '00:00:00', end: '00:00:08', text: 'Alpha beta. Gamma delta.' }]
  const provider = (model: string, rawResponse: unknown) => ({
    dir: `gemini-stt-${model}`, provider: 'gemini-stt', model, processingTime: 1000, cost: 0.2, hasSpeakerLabels: false, segments,
    result: {
      text: 'Alpha beta. Gamma delta.', segments,
      evidence: { timingQuality: 'segment_interpolated', capabilities: { hasSpeakerLabels: false }, ...(rawResponse === undefined ? {} : { rawResponse }) },
    },
  })
  await writeMultiProviderManifestFixture(runDir, {
    command: 'extract',
    extractRoute: 'media',
    metadata: { step1: { durationSeconds: 8, duration: '00:00:08' } },
    providerMetadata: { tokenCount: 4 },
    providers: [
      // The first parseable segment payload with a finite end decides the raw coverage; later parts are ignored.
      provider('compressed', geminiRawResponse([
        'not-a-part', { text: 7 }, { text: '{broken' }, { text: '{"segments":"none"}' }, { text: '{"segments":[{"end":"8"},null]}' },
        { text: '{"segments":[{"end":1.5},{"end":3.5},{"end":2}]}' }, { text: '{"segments":[{"end":8}]}' },
      ])),
      provider('full', geminiRawResponse([{ text: '{"segments":[{"end":2},{"end":7.5}]}' }])),
      provider('unparsed', geminiRawResponse([{ text: 'plain text' }])),
      provider('absent', undefined),
    ],
  })
}

describe('STT reference report script', () => {
  test('flags Gemini raw segment timing that covers less than three quarters of the audio', async () => {
    await withTempDir('stt-reference-gemini-timing-', async runDir => {
      await writeRunFixture(runDir)
      const report = await runReferenceReport(runDir)
      const warnings = Object.fromEntries(report.providerGroups.thirdPartyServiceNonDiarization.providers.map(row => [row.providerKey, row.qualityWarnings]))
      expect(warnings).toEqual({
        'gemini-stt/absent': [],
        'gemini-stt/compressed': [GEMINI_TIMING_WARNING],
        'gemini-stt/full': [],
        'gemini-stt/unparsed': [],
      })
    })
  })

  test('--preserve-existing carries scored providers from the previous report and drops unscored or malformed ones', async () => {
    await withTempDir('stt-reference-preserve-', async runDir => {
      await writeRunFixture(runDir)
      const breakdown = { substitutions: 1, deletions: 2, insertions: 3, referenceWordCount: 10 }
      await writeFile(join(runDir, 'reference-comparison-report.json'), JSON.stringify({ providerGroups: {
        thirdPartyServiceDiarization: { providers: [
          {
            providerKey: 'legacy/diarized', provider: 'legacy-diarized', group: 'cloud', supportsDiarization: true, tokenCount: 12, transcriptTextHash: 'abc',
            segmentStats: { segmentCount: 3 }, score: 80, speakerAwareWER: 0.2, textOnlyWER: 0.05, textOnlyBreakdown: breakdown,
            processingTimeMs: 4000, costCents: 0.7, speakerMap: { A: 'speaker-1', B: 2 }, qualityWarnings: ['kept warning', 5], duplicateGroupId: 'duplicate-9',
          },
          { providerKey: 'legacy/unscored', speakerAwareWER: 0.2, textOnlyWER: 0.1 },
          { provider: 'no-key', score: 1, speakerAwareWER: 0, textOnlyWER: 0 },
          'not-a-record',
        ] },
        local: { providers: [{ providerKey: 'legacy-local/model', group: 'local', supportsDiarization: 'yes', metrics: { score: 50, speakerAwareWER: 0.5, textOnlyWER: 0.25 }, actualCostCents: 9 }] },
        ignored: { providers: 'not-a-list' },
        gemini: { providers: [{ providerKey: 'gemini-stt/full', score: 1, speakerAwareWER: 0.99, textOnlyWER: 0.99 }] },
      } }))

      const report = await runReferenceReport(runDir, ['--preserve-existing'])
      expect(report.providerCount).toBe(6)
      const groups = report.providerGroups
      expect(groups.local.providers).toEqual([{
        providerKey: 'legacy-local/model', provider: 'legacy-local/model', model: 'model', group: 'local', supportsDiarization: false, diarizationSupport: 'not-supported',
        tokenCount: null, transcriptTextHash: '', score: 50, speakerAwareWER: 0.5, textOnlyWER: 0.25,
        textOnlyBreakdown: { substitutions: 0, deletions: 0, insertions: 0, referenceWordCount: 0 },
        speakerAwareBreakdown: { substitutions: 0, deletions: 0, insertions: 0, referenceWordCount: 0 },
        actualProcessingTimeMs: null, actualCostCents: 0, audioDurationSeconds: 8, realtimeFactor: null, speakerPenalty: 0.25, speakerMap: {}, qualityWarnings: [],
        metrics: { score: 50, speakerAwareWER: 0.5, textOnlyWER: 0.25 },
      }])
      expect(groups.thirdPartyServiceDiarization.providers).toEqual([{
        providerKey: 'legacy/diarized', provider: 'legacy-diarized', model: 'diarized', group: 'thirdPartyServiceDiarization', supportsDiarization: true, diarizationSupport: 'supported',
        tokenCount: 12, transcriptTextHash: 'abc', segmentStats: { segmentCount: 3 }, score: 80, speakerAwareWER: 0.2, textOnlyWER: 0.05,
        textOnlyBreakdown: breakdown, speakerAwareBreakdown: { substitutions: 0, deletions: 0, insertions: 0, referenceWordCount: 0 },
        actualProcessingTimeMs: 4000, actualCostCents: 0.7, audioDurationSeconds: 8, realtimeFactor: 2, speakerPenalty: 0.2 - 0.05, speakerMap: { A: 'speaker-1' },
        qualityWarnings: ['kept warning'], duplicateGroupId: 'duplicate-9', metrics: { score: 80, speakerAwareWER: 0.2, textOnlyWER: 0.05 },
      }])
      expect(Object.keys(groups.thirdPartyServiceDiarization.providers[0]!)).toEqual([
        'providerKey', 'provider', 'model', 'group', 'supportsDiarization', 'diarizationSupport', 'tokenCount', 'transcriptTextHash', 'segmentStats', 'score',
        'speakerAwareWER', 'textOnlyWER', 'textOnlyBreakdown', 'speakerAwareBreakdown', 'actualProcessingTimeMs', 'actualCostCents', 'audioDurationSeconds',
        'realtimeFactor', 'speakerPenalty', 'speakerMap', 'qualityWarnings', 'duplicateGroupId', 'metrics',
      ])
      // A provider measured in this run replaces its preserved record.
      const current = groups.thirdPartyServiceNonDiarization.providers
      expect(current.map(row => row.providerKey)).toEqual(['gemini-stt/full', 'gemini-stt/absent', 'gemini-stt/compressed', 'gemini-stt/unparsed'])

      const rebuilt = await runReferenceReport(runDir)
      expect(rebuilt.providerCount).toBe(4)
      expect(rebuilt.providerGroups.local.count).toBe(0)
      expect(current[0]!['score']).not.toBe(1)
      expect(current[0]!['score']).toBe(rebuilt.providerGroups.thirdPartyServiceNonDiarization.providers[0]!['score'])
    })
  })
})
