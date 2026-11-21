import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import {
  buildSttSettingsDashboard,
  buildSttSettingsReport,
  combinedVariantLabel,
  renderSettingsMarkdown,
  settingGroupForFlags,
  settingsDashboardModel,
  SETTINGS_REPORT_JSON,
  SETTINGS_REPORT_MARKDOWN,
  type SettingsReport,
} from '../../../../.codex/skills/consensus/scripts/stt/build_settings_report'
import { SCORING_VERSION } from '../../../../.codex/skills/consensus/scripts/stt/transcript_lib'
import {
  buildCombinedDashboard,
  DASHBOARD_TABS,
  type DashboardTabSource,
} from '../../../../.codex/skills/consensus/scripts/shared/build_combined_dashboard'
import type { BenchmarkDashboardData, CombinedDashboardModel } from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import { supportedDashboardProviderKeys } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_model_support'
import { buildSupportedDashboardModel } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_supported_view'
import { REPOSITORY_ROOT } from '../../../../.codex/skills/consensus/scripts/shared/portable_paths'
import { writeMultiProviderManifestFixture } from '../../../test-utils/manifest-helpers'
import { readBunSpawnStreamText as readStreamText } from '../../../test-utils/stream-text'
import { withTempDir } from '../../../test-utils/temp-dirs'

const RUN_SCRIPT = resolve(import.meta.dir, '../../../../.codex/skills/consensus/scripts/run.ts')
const REFERENCE_TEXT = '[00:00:00] [speaker-1] We are going to ship twenty five widgets today.\n[00:00:04] [speaker-2] Okay, I agree with that.\n'
const SERVICE = 'assemblyai'
const MODEL = 'assemblyai-stt-3-7'
const BASELINE_KEY = `${SERVICE}/${MODEL}`

interface RunText { first: string, second: string, cost: number, timeMs: number }

async function writeRun(runDir: string, text: RunText, extraProvider = false): Promise<void> {
  const result = (first: string, second: string) => ({
    text: `${first} ${second}`,
    segments: [
      { start: '00:00:00', end: '00:00:04', speaker: 'A', text: first },
      { start: '00:00:04', end: '00:00:08', speaker: 'B', text: second },
    ],
    evidence: { timingQuality: 'segment', capabilities: { hasSpeakerLabels: true } },
  })
  await writeMultiProviderManifestFixture(runDir, {
    command: 'extract',
    extractRoute: 'media',
    metadata: { step1: { durationSeconds: 8, duration: '00:00:08' } },
    providerMetadata: { tokenCount: 10 },
    providers: [
      { dir: `${SERVICE}-${MODEL}`, provider: SERVICE, model: MODEL, processingTime: text.timeMs, cost: text.cost, result: result(text.first, text.second) },
      // A different route in the baseline run must never be picked as the baseline.
      ...(extraProvider ? [{ dir: 'grok-grok-voice-transcribe-2.0', provider: 'grok', model: 'grok-voice-transcribe-2.0', processingTime: 1, cost: 0.01, result: result('nothing matches', 'at all') }] : []),
    ],
  })
}

async function writeVariant(settingsRoot: string, variantId: string, recordingId: string, label: string, flags: string[], text: RunText, referencePath: string): Promise<void> {
  const runDir = join(settingsRoot, `${variantId}__${recordingId}`)
  await writeRun(runDir, text)
  await writeFile(join(runDir, 'variant.json'), JSON.stringify({
    schemaVersion: 1, variantId, label, baseline: { service: SERVICE, model: MODEL },
    flags: ['--provider', `${SERVICE}=${MODEL}`, '--diarization', ...flags],
  }))
  const sha256 = new Bun.CryptoHasher('sha256').update(REFERENCE_TEXT).digest('hex')
  await writeFile(join(runDir, 'reference-source.json'), JSON.stringify({ schemaVersion: 1, path: relative(REPOSITORY_ROOT, referencePath), sha256 }))
}

/** Two recordings with baselines; v-fill covers both, v-lossless only rec-a (rec-b skipped), v-blocked is planned only. */
async function writeFixture(root: string): Promise<{ settingsRoot: string, baselineRoot: string }> {
  const baselineRoot = join(root, 'stt', 'with-speakers')
  const settingsRoot = join(root, 'stt', 'settings')
  for (const recordingId of ['rec-a', 'rec-b']) {
    const runDir = join(baselineRoot, recordingId)
    await mkdir(runDir, { recursive: true })
    await writeFile(join(runDir, 'consensus-transcription.txt'), REFERENCE_TEXT)
  }
  await writeRun(join(baselineRoot, 'rec-a'), { first: "We're gonna ship 25 widgets today.", second: 'OK, I agree with that.', cost: 1, timeMs: 1000 }, true)
  await writeRun(join(baselineRoot, 'rec-b'), { first: 'We are going to ship 25 gadgets today.', second: 'Okay, I agree with that.', cost: 1, timeMs: 2000 }, true)
  const reference = (recordingId: string) => join(baselineRoot, recordingId, 'consensus-transcription.txt')
  await mkdir(settingsRoot, { recursive: true })
  // rec-a: the repeated "We we" is neutral (disfluency view) but costs one legacy edit.
  await writeVariant(settingsRoot, 'v-fill', 'rec-a', 'stt-filler-words=true', ['--stt-filler-words', 'true'],
    { first: 'We we are going to ship 25 widgets today.', second: 'Okay, I agree with that.', cost: 3, timeMs: 1500 }, reference('rec-a'))
  // rec-b: the variant fixes the baseline's "gadgets" substitution.
  await writeVariant(settingsRoot, 'v-fill', 'rec-b', 'stt-filler-words=true', ['--stt-filler-words', 'true'],
    { first: 'We are going to ship 25 widgets today.', second: 'Okay, I agree with that.', cost: 3, timeMs: 2500 }, reference('rec-b'))
  await writeVariant(settingsRoot, 'v-lossless', 'rec-a', 'stt-audio-profile=lossless', ['--stt-audio-profile', 'lossless'],
    { first: 'We are going to ship 25 widgets.', second: 'Okay, I agree with that.', cost: 1, timeMs: 900 }, reference('rec-a'))
  await writeFile(join(settingsRoot, 'benchmark-plan.json'), JSON.stringify({
    schemaVersion: 1,
    recordings: [{ id: 'rec-a' }, { id: 'rec-b' }],
    variants: [
      { id: 'v-fill', baseline: { service: SERVICE, model: MODEL }, provider: `${SERVICE}=${MODEL}`, settings: ['--stt-filler-words', 'true'] },
      { id: 'v-lossless', baseline: { service: SERVICE, model: MODEL }, provider: `${SERVICE}=${MODEL}`, settings: ['--stt-audio-profile', 'lossless'] },
      { id: 'v-blocked', baseline: { service: 'gladia', model: 'solaria-3' }, provider: 'gladia=solaria-3', settings: [], speakerCountFromReference: true },
    ],
    skips: [{ variantId: 'v-lossless', recordingId: 'rec-b', reason: 'WAV exceeds the upload cap.' }],
    runs: [],
  }))
  return { settingsRoot, baselineRoot }
}

const variant = (report: SettingsReport, id: string) => report.variants.find(entry => entry.variantId === id)!

function expectAlignedTables(markdown: string): void {
  const blocks = markdown.split('\n\n').filter(block => block.startsWith('| '))
  expect(blocks.length).toBeGreaterThan(0)
  for (const block of blocks) {
    const lengths = new Set(block.split('\n').map(line => [...line].length))
    expect(lengths.size).toBe(1)
  }
}

describe('STT settings comparison report', () => {
  test('pairs each variant with its default-settings baseline, reports deltas, and marks unpaired recordings', async () => {
    await withTempDir('stt-settings-report-', async root => {
      const { settingsRoot, baselineRoot } = await writeFixture(root)
      const report = buildSttSettingsReport(settingsRoot, { generatedAt: '2026-01-01T00:00:00.000Z' })

      expect(report.baselineRoot).toBe(baselineRoot)
      expect(report.scoringVersion).toBe(SCORING_VERSION)
      expect(report.recordings).toEqual(['rec-a', 'rec-b'])
      expect(report.commonRecordings).toEqual(['rec-a'])
      expect(report.headlineBasis).toBe('common-recording-set')
      expect(report.variants.map(entry => [entry.variantId, entry.group.key])).toEqual([
        ['v-fill', 'transcript-formatting'], ['v-blocked', 'speaker-count'], ['v-lossless', 'audio-profile'],
      ])
      expect([report.pairedRunCount, report.unpairedRunCount]).toEqual([3, 3])

      const fill = variant(report, 'v-fill')
      expect(fill.pairedRecordings).toEqual(['rec-a', 'rec-b'])
      const [pairA, pairB] = fill.pairs
      expect(pairA!.variantProviderKey).toBe(`${BASELINE_KEY}[stt-filler-words=true]`)
      expect(pairA!.baseline!.providerKey).toBe(BASELINE_KEY)
      // Baseline rec-a uses "gonna"/"OK"/"25": all neutral, so both neutral scores are 100.
      expect(pairA!.baseline!.score).toBe(100)
      expect(pairA!.variant!.score).toBe(100)
      expect(pairA!.delta!.score).toBe(0)
      expect(pairA!.delta!.legacyScore!).toBeGreaterThan(0)
      expect(pairA!.delta!.forgivenDisfluency).toBe(1)
      expect(pairA!.delta!.costCents).toBe(2)
      expect(pairA!.delta!.processingTimeMs).toBe(500)
      expect(pairA!.delta!.speakerCountAbsoluteError).toBe(0)
      expect(pairA!.referenceSource?.path).toBe(relative(REPOSITORY_ROOT, join(baselineRoot, 'rec-a', 'consensus-transcription.txt')))
      expect(pairB!.baseline!.score).toBeLessThan(100)
      expect(pairB!.delta!.score!).toBeCloseTo(100 - pairB!.baseline!.score!, 10)
      expect(fill.meanDelta!.score!).toBeCloseTo(pairB!.delta!.score! / 2, 10)
      // The common recording set is rec-a only, so the headline excludes rec-b.
      expect(fill.commonSetMeanDelta!.score).toBe(0)

      const lossless = variant(report, 'v-lossless')
      expect(lossless.unpairedRecordings).toEqual([{ recordingId: 'rec-b', status: 'skipped', reason: 'WAV exceeds the upload cap.' }])
      expect(lossless.commonSetMeanDelta).not.toBeNull()
      expect(lossless.meanDelta!.score).toBe(lossless.commonSetMeanDelta!.score)
      const blocked = variant(report, 'v-blocked')
      expect(blocked.pairs.map(pair => pair.status)).toEqual(['not-run', 'not-run'])
      expect(blocked.meanDelta).toBeNull()
      expect(blocked.commonSetMeanDelta).toBeNull()

      const markdown = renderSettingsMarkdown(report)
      expect(markdown).toContain('## Variant Summary')
      expect(markdown).toContain('common recording set: `rec-a`')
      expect(markdown).toContain('| v-lossless | rec-b     | skipped')
      expect(markdown).toContain('not run')
      expect(markdown).toContain('1/2 (1 skipped)')
      expectAlignedTables(markdown)
    })
  })

  test('the run.ts subcommand writes both artifacts and the dashboard tab reads them without rescoring', async () => {
    await withTempDir('stt-settings-report-cli-', async root => {
      const { settingsRoot, baselineRoot } = await writeFixture(root)
      const proc = Bun.spawn([process.execPath, RUN_SCRIPT, 'stt', 'build-settings-report', settingsRoot, '--baseline-root', baselineRoot], { stdout: 'pipe', stderr: 'pipe' })
      const [stdout, exitCode] = await Promise.all([readStreamText(proc.stdout), proc.exited])
      expect(exitCode).toBe(0)
      expect(stdout).toContain('Compared 3 variants (3 paired runs, 3 unpaired slots).')
      expect(stdout).toContain('Skipped the combined dashboard')
      const written = await Bun.file(join(settingsRoot, SETTINGS_REPORT_JSON)).json() as SettingsReport
      expect(written.kind).toBe('stt-settings-comparison-report')
      expect(await Bun.file(join(settingsRoot, SETTINGS_REPORT_MARKDOWN)).text()).toContain('# STT Settings Comparison Report')

      const { dashboardModel } = buildSttSettingsDashboard(settingsRoot)
      expect(dashboardModel.category).toBe('stt-settings')
      expect(dashboardModel.groups.map(group => [group.key, group.providers.map(row => row.providerKey)])).toEqual([
        ['transcript-formatting', [`${BASELINE_KEY}[v-fill]`]],
        ['speaker-count', []],
        ['audio-profile', [`${BASELINE_KEY}[v-lossless]`]],
      ])
      const fillRow = dashboardModel.groups[0]!.providers[0]!
      expect(fillRow.coverage).toBe('2/2')
      expect(fillRow.quality).toEqual({ display: '0.00', rank: 1, value: 0 })
      expect(fillRow.cost).toEqual({ display: '+2.000¢', rank: 1, value: 2 })
      expect(fillRow.perRun.map(cell => cell.display)).toEqual(['0.00', `+${written.variants[0]!.pairs[1]!.delta!.score!.toFixed(2)}`])
      expect(dashboardModel.groups[2]!.providers[0]!.perRun[1]).toEqual({ display: 'skipped', heat: null })
      expect(dashboardModel.sampleTables![0]!.rows.length).toBe(6)
    })
  })

  test('the CLI-supported filter follows the base route of each variant row', () => {
    const report: SettingsReport = {
      schemaVersion: 1, kind: 'stt-settings-comparison-report', category: 'stt', scoringVersion: SCORING_VERSION, generatedAt: 'now',
      settingsRoot: '/s', baselineRoot: '/b', recordings: ['r'], commonRecordings: ['r'], headlineBasis: 'common-recording-set',
      variantCount: 2, pairedRunCount: 2, unpairedRunCount: 0, notes: [],
      variants: [['live', BASELINE_KEY], ['retired', 'assemblyai/not-a-real-model']].map(([variantId, baselineProviderKey]) => {
        const delta = { score: 1, legacyScore: 1, speakerAwareWER: 0, textOnlyWER: 0, strictEdits: 0, neutralEdits: 0, forgivenDisfluency: 0, forgivenOrthographic: 0, forgivenNumberFormat: 0, remainingSpeakerAttribution: 0, remainingNumberFormat: 0, remainingOtherLexical: 0, speakerCountAbsoluteError: 0, wordAttributionAccuracy: 0, costCents: 0, processingTimeMs: 0 }
        return {
          variantId: variantId!, label: 'x=1', baseline: { service: 'assemblyai', model: baselineProviderKey!.split('/')[1]! }, baselineProviderKey: baselineProviderKey!,
          group: { key: 'audio-profile', label: 'Audio profile' }, flags: [], pairedRecordings: ['r'], unpairedRecordings: [], meanDelta: delta, commonSetMeanDelta: delta,
          pairs: [{ recordingId: 'r', status: 'paired' as const, reason: null, variantDir: null, baselineDir: null, variantProviderKey: null, referenceSource: null, variant: null, baseline: null, delta }],
        }
      }),
    }
    const model = settingsDashboardModel(report)
    const keys = supportedDashboardProviderKeys('stt-settings', model)
    expect(keys).toEqual([`${BASELINE_KEY}[live]`])
    const supported = buildSupportedDashboardModel(model, keys)
    expect(supported.groups[0]!.providers.map(row => [row.providerKey, row.quality.rank])).toEqual([[`${BASELINE_KEY}[live]`, 1]])
    expect(supported.summaryStats.find(stat => stat.label === 'Variants')?.value).toBe('1')
    expect(supported.summaryStats.find(stat => stat.label === 'Recordings')?.value).toBe('1')
  })

  test('labels and setting groups', () => {
    expect(combinedVariantLabel(['speaker-count=2', 'speaker-count=13', 'speaker-count=2'])).toBe('speaker-count=2|13')
    expect(combinedVariantLabel(['a=1', 'b=2'])).toBe('a=1; b=2')
    expect(settingGroupForFlags(['--provider', 'x=y', '--diarization']).key).toBe('run-to-run-control')
    expect(settingGroupForFlags(['--provider', 'x=y', '--diarization', '--stt-number-format', 'spoken']).key).toBe('transcript-formatting')
    expect(settingGroupForFlags(['--stt-new-thing', '1']).key).toBe('stt-new-thing')
  })
})

describe('STT settings dashboard tab', () => {
  const settingsSource = DASHBOARD_TABS.find(tab => tab.key === 'stt-settings')!
  const emptyModel = (): CombinedDashboardModel => ({ title: 'stub', category: 'stub', generatedAt: 'now', rootDir: '/tmp', summaryStats: [], runs: [], groups: [], methodParagraphs: [], notes: [] })
  const stubSource: DashboardTabSource = { key: 'stub', directory: 'stub', label: 'Stub', combinedReport: false, build: () => ({ dashboardModel: emptyModel() }) }
  const tabKeys = (benchmarksRoot: string): string[] =>
    (JSON.parse(buildCombinedDashboard(benchmarksRoot, 'now', undefined, [stubSource, settingsSource]).data) as BenchmarkDashboardData).tabs.map(tab => tab.key)

  test('is optional: other tabs build without it and it appears once the settings report exists', async () => {
    expect(settingsSource.directory).toBe('stt/settings')
    expect(settingsSource.combinedReport).toBe(false)
    await withTempDir('stt-settings-dashboard-', async root => {
      expect(tabKeys(root)).toEqual(['stub'])
      const { settingsRoot } = await writeFixture(root)
      expect(tabKeys(root)).toEqual(['stub'])
      const proc = Bun.spawn([process.execPath, RUN_SCRIPT, 'stt', 'build-settings-report', settingsRoot], { stdout: 'pipe', stderr: 'pipe' })
      expect(await proc.exited).toBe(0)
      const data = JSON.parse(buildCombinedDashboard(root, 'now', undefined, [stubSource, settingsSource]).data) as BenchmarkDashboardData
      expect(data.tabs.map(tab => tab.key)).toEqual(['stub', 'stt-settings'])
      const tab = data.tabs[1]!
      expect(tab.rootLabel).toBe('docs/benchmarks/stt/settings')
      expect(tab.supportedModel?.groups.flatMap(group => group.providers.map(row => row.providerKey))).toEqual([`${BASELINE_KEY}[v-fill]`, `${BASELINE_KEY}[v-lossless]`])
    })
  })
})
