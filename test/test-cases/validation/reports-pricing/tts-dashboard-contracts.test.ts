import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildTtsDashboard, collectTtsDashboardSamples } from '../../../../.codex/skills/consensus/scripts/tts/build_tts_dashboard'
import type { CombinedDashboardModel } from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import { renderTabPanel } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_client.js'
import { TTS_DASHBOARD_EVIDENCE } from '../../../../.codex/skills/consensus/scripts/tts/retained_tts_evidence'
import { hasAllDashboardTabs } from '../../../../.codex/skills/consensus/scripts/shared/build_combined_dashboard'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const writeJson = (path: string, value: unknown) => {
  const bytes = Buffer.from(JSON.stringify(value))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, bytes)
  return sha256(bytes)
}

// Independent compact/expanded manifest fixtures. No synthesis transport is involved.
function fixture(root: string, run: string, options: {
  duration?: number; characters?: number; processingMs?: number; recordedCents?: number | null
  observedUsd?: number; plannedUsd?: number; recovery?: boolean; bytes?: Buffer; status?: string
} = {}) {
  const runDir = join(root, run)
  mkdirSync(runDir, { recursive: true })
  const audio = options.bytes ?? createSyntheticWavBytes({ durationSeconds: options.duration ?? 2, frequencyHz: 440, amplitude: 0.1, sampleRate: 24000 })
  const audioRef = { path: 'sample-soniox-tts-rt-v2.wav', sha256: sha256(audio) }
  writeFileSync(join(runDir, audioRef.path), audio)
  const renderPath = 'items/soniox/render.json'
  const renderHash = writeJson(join(runDir, renderPath), {
    outputs: { final: audioRef },
    cost: {
      currentComposition: {
        observed: options.observedUsd === undefined ? [] : [{ amount: options.observedUsd, currency: 'USD' }],
        planned: { amounts: [{ amount: options.plannedUsd ?? 0.99, currency: 'USD' }] }
      },
      // Historical spending must never be added to the selected composition.
      cumulativeRenderHistory: { observed: [{ amount: 1000, currency: 'USD' }] }
    }
  })
  const projection = options.recovery ? {
    selectedSuccess: { renderIdentity: 'selected', eventSequence: 2 },
    renderHistory: [{ renderIdentity: 'selected', events: [
      { sequence: 1, reportedOutputRefs: [{ path: 'obsolete.wav' }] },
      { sequence: 2, reportedOutputRefs: [audioRef], providerRenderResultRef: 'render.json', providerRenderResultSha256: renderHash, audioRunRef: 'recovery-audio-run-selected.json' }
    ] }]
  } : { archive: { finalRef: audioRef, renderRef: { path: renderPath, sha256: renderHash } } }
  const manifest = {
    command: 'tts', scope: 'single', createdAt: '2000-01-12', updatedAt: '2000-01-24',
    items: [{ status: 'full', metadata: {
      characterCount: options.characters ?? 1000,
      tts: [{ targetKey: 'soniox-target', ttsService: 'soniox', ttsModel: 'tts-rt-v2', processingTime: options.processingMs ?? 1000 }],
      cost: { actual: { steps: options.recordedCents === null ? [] : [{ provider: 'soniox', model: 'tts-rt-v2', cost: options.recordedCents ?? 5, costSource: 'heuristic' }] } }
    }, providers: [{ service: 'soniox', model: 'tts-rt-v2', targetKey: 'soniox-target', artifactDir: 'items/soniox',
      status: options.status ?? 'succeeded', attempts: 1, options: {}, metadata: {}, result: { ttsAudio: projection } }] }]
  }
  writeJson(join(runDir, 'manifest.json'), manifest)
  return { runDir, audioRef, manifest }
}

describe('TTS dashboard metrics from archived audio', () => {
  test('selects an explicit nested rerun without adding a corpus input and rejects mismatched or corrupt evidence', async () => {
    await withTempDir('tts-dashboard-rerun-', async root => {
      const original = fixture(root, '01-short', { recovery: true, processingMs: 75 })
      const replacement = fixture(root, '01-short/reruns/timing', { processingMs: 2000 })
      Object.assign(original.manifest.items[0]!.metadata, { benchmarkReruns: [{ directory: 'reruns/timing', providerKeys: ['soniox/tts-rt-v2'] }] })
      writeJson(join(original.runDir, 'manifest.json'), original.manifest)
      const result = buildTtsDashboard(root)
      expect(result.samples).toHaveLength(1)
      expect(result.samples[0]).toMatchObject({ run: '01-short', recovery: false, processingMs: 2000 })
      expect(result.samples[0]!.manifestHref).toContain('reruns/timing/manifest.json')
      expect(result.dashboardModel.groups[0]!.providers[0]!.evidence[2]).toBe('1/1')
      replacement.manifest.items[0]!.metadata.characterCount++
      writeJson(join(replacement.runDir, 'manifest.json'), replacement.manifest)
      expect(() => buildTtsDashboard(root)).toThrow('same narration input')
      replacement.manifest.items[0]!.metadata.characterCount--
      writeJson(join(replacement.runDir, 'manifest.json'), replacement.manifest)
      writeFileSync(join(replacement.runDir, replacement.audioRef.path), 'broken')
      expect(() => buildTtsDashboard(root)).toThrow('hash mismatch')
    })
  })

  test('weights narration throughput and cost by corpus totals and keeps active controls separate', async () => {
    await withTempDir('tts-dashboard-', async dir => {
      const root = join(dir, 'tts')
      fixture(root, '01-short', { duration: 2, characters: 100, processingMs: 1000, recordedCents: 1 })
      fixture(root, '02-long', { duration: 8, characters: 900, processingMs: 9000, recordedCents: 9 })
      fixture(root, '2000-01-12_05-tts-emotion/current-emotion', { recordedCents: 100 })
      fixture(root, '2000-01-01_05-tts-emotion/obsolete-emotion', { recordedCents: 200 })
      fixture(root, '2000-01-10_06-tts-speed-pauses/current-timing', { recordedCents: 50 })
      fixture(root, '2000-01-01_06-tts-speed-pauses/obsolete-timing', { recordedCents: 300 })
      const { dashboardModel, samples } = buildTtsDashboard(root)
      expect(samples).toHaveLength(4)
      expect(samples.filter(row => row.suite === 'narration')).toHaveLength(2)
      expect(samples.filter(row => row.suite === 'emotion').map(row => row.run)).toEqual(['2000-01-12_05-tts-emotion/current-emotion'])
      expect(samples.filter(row => row.suite === 'speed-pauses').map(row => row.run)).toEqual(['2000-01-10_06-tts-speed-pauses/current-timing'])
      expect(samples.some(row => row.run.includes('obsolete'))).toBe(false)
      expect(dashboardModel.sampleTables?.map(table => table.rows.length)).toEqual([2, 1, 1])
      expect(dashboardModel.sampleTables![1]!.rows[0]![6]!.display).toBe('$1.00000')
      expect(dashboardModel.sampleTables![2]!.rows[0]![6]!.display).toBe('$0.50000')
      const provider = dashboardModel.groups[0]!.providers[0]!
      expect(provider.coverage).toBe('2/2')
      expect(provider.speed.value).toBe(1) // (2 + 8) / (1 + 9), not the mean of per-run rates.
      expect(provider.cost.value).toBe(10) // (1 + 9) cents / (100 + 900) chars × 1000.
      expect(provider.cost.display).toBe('$0.10000')
      expect(provider.quality.value).toBeNull()
      expect(provider.quality.rank).toBeNull()
      expect(samples[0]!.format).toBe('24 kHz / 1 ch / pcm_s16le')
    })
  })

  test('prefers observed usage, then recorded estimated usage, then planned cost; excludes historical spending', async () => {
    await withTempDir('tts-dashboard-cost-', async root => {
      fixture(root, '01-observed', { observedUsd: 0.03 })
      fixture(root, '02-recorded', { recordedCents: 4 })
      fixture(root, '03-planned', { recordedCents: null, plannedUsd: 0.07 })
      expect(buildTtsDashboard(root).samples.map(row => [row.costCents, row.costBasis])).toEqual([
        [3, 'provider usage'], [4, 'estimated usage'], [7.000000000000001, 'planned estimate']
      ])
    })
  })

  test('selects the current recovered output and excludes recovery timing from generation rankings', async () => {
    await withTempDir('tts-dashboard-recovery-', async root => {
      fixture(root, '01-original')
      fixture(root, '02-recovered', { recovery: true, processingMs: 75 })
      const { dashboardModel, samples } = buildTtsDashboard(root)
      const recovered = samples[1]!
      expect(recovered.recovery).toBe(true)
      expect(recovered.processingMs).toBe(75)
      expect(recovered.audioHref).toEndWith('sample-soniox-tts-rt-v2.wav')
      expect(dashboardModel.groups[0]!.providers[0]!.speed.value).toBeNull()
      expect(dashboardModel.groups[0]!.providers[0]!.cost.value).toBe(5)
      expect(dashboardModel.groups[0]!.providers[0]!.evidence[2]).toBe('1/2')
    })
  })

  test('keeps failed execution visible without including partial coverage in rankings', async () => {
    await withTempDir('tts-dashboard-failed-', async root => {
      fixture(root, '01-complete')
      fixture(root, '02-failed', { status: 'failed' })
      const { dashboardModel, samples } = buildTtsDashboard(root)
      expect(samples[1]!.audioHref).toBeNull()
      const provider = dashboardModel.groups[0]!.providers[0]!
      expect(provider.coverage).toBe('1/2')
      expect(provider.speed.rank).toBeNull()
      expect(provider.cost.rank).toBeNull()
    })
  })

  test('rejects changed audio bytes and hash-matching JSON masquerading as audio', async () => {
    await withTempDir('tts-dashboard-invalid-', async root => {
      const valid = fixture(root, '01-run')
      writeFileSync(join(valid.runDir, valid.audioRef.path), 'changed')
      expect(() => buildTtsDashboard(root)).toThrow('TTS audio hash mismatch')
      fixture(root, '01-run', { bytes: Buffer.from('{"error":"not audio"}') })
      expect(() => buildTtsDashboard(root)).toThrow('Invalid TTS audio')
    })
  })

  test('rejects modified render evidence and references outside a run', async () => {
    await withTempDir('tts-dashboard-path-', async root => {
      const valid = fixture(root, '01-run')
      writeFileSync(join(valid.runDir, 'items/soniox/render.json'), '{}')
      expect(() => buildTtsDashboard(root)).toThrow('TTS JSON hash mismatch')
      const restored = fixture(root, '01-run')
      restored.manifest.items[0]!.providers[0]!.result.ttsAudio.archive!.renderRef.path = '../outside.json'
      writeJson(join(restored.runDir, 'manifest.json'), restored.manifest)
      expect(() => buildTtsDashboard(root)).toThrow('TTS artifact escaped its run directory')
    })
  })

  test('preserves documented listening defects and allows only safe relative artifact links', async () => {
    await withTempDir('tts-dashboard-notes-', async root => {
      const { runDir } = fixture(root, '2000-01-12_05-tts-emotion/current')
      writeFileSync(join(dirname(runDir), 'benchmark-report.md'), '> **Listening defect:** Instruction prose was spoken.\n')
      const { dashboardModel } = buildTtsDashboard(root)
      expect(dashboardModel.sampleTables![1]!.notes).toEqual(['**Listening defect:** Instruction prose was spoken.'])
      dashboardModel.sampleTables!.push({ title: '<unsafe>', columns: ['Artifact'], rows: [
        [{ display: 'Valid', artifactHref: 'tts/run/sample-soniox-tts-rt-v2.wav' }],
        ...['javascript:alert(1)', '//example.com', '../outside.wav', 'tts/./a.wav', 'tts/a".wav'].map(artifactHref => [{ display: 'Invalid', artifactHref }])
      ] })
      const html = renderTabPanel({ key: 'tts', label: 'TTS', rootLabel: 'tts', model: dashboardModel })
      expect(html).toContain('href="tts/run/sample-soniox-tts-rt-v2.wav"')
      expect(html).not.toMatch(/href="(?:javascript:|\/\/|\.\.\/|tts\/\.\/|tts\/a&quot;)/)
      expect(html).toContain('&lt;unsafe&gt;')
      expect(html).toContain('<strong>Listening defect:</strong> Instruction prose was spoken.')
    })
  })

  test('empty and absent roots have no TTS records; new runs populate the tab and deletion clears them', async () => {
    await withTempDir('tts-dashboard-empty-', async checkout => {
      const root = join(checkout, 'tts')
      expect(hasAllDashboardTabs(checkout)).toBe(false)
      for (const category of ['ocr', 'stt-local', 'stt-with-speakers', 'stt-without-speakers', 'url']) {
        writeJson(join(checkout, category, 'combined-comparison-report.json'), {})
      }
      expect(hasAllDashboardTabs(checkout)).toBe(true)
      const empty = () => {
        const { dashboardModel, samples } = buildTtsDashboard(root)
        expect(samples).toEqual([])
        expect(dashboardModel.runs).toEqual([])
        expect(dashboardModel.groups.flatMap(group => group.providers)).toEqual([])
        expect(dashboardModel.sampleTables?.flatMap(table => table.rows)).toEqual([])
        expect(renderTabPanel({ key: 'tts', label: 'TTS', rootLabel: 'tts', model: dashboardModel })).toContain('No TTS benchmark results are available.')
      }
      empty()
      mkdirSync(root)
      empty()
      fixture(root, 'fresh-narration')
      expect(buildTtsDashboard(root).samples).toHaveLength(1)
      rmSync(join(root, 'fresh-narration'), { recursive: true })
      empty()
      writeJson(join(root, 'invalid-narration/manifest.json'), {})
      expect(() => buildTtsDashboard(root)).toThrow('Invalid canonical manifest')
    })
  })

  test('synthetic retained evidence reproduces metrics and review notes without audio and rejects stale or corrupt artifacts', async () => {
    await withTempDir('tts-dashboard-checkout-', async checkout => {
      const sourceRoot = join(checkout, 'source', 'tts')
      const root = join(checkout, 'tts')
      const archiveRoot = join(checkout, 'archive')
      const cases = ['01-narration', '2000-01-02_05-tts-emotion/emotion', '2000-01-03_06-tts-speed-pauses/timing']
      const sources: string[] = []
      for (const run of cases) {
        fixture(sourceRoot, run)
        sources.push(run + '/manifest.json')
      }
      for (const run of cases.slice(1)) {
        const report = dirname(run) + '/benchmark-report.md'
        writeFileSync(join(sourceRoot, report), '> **Listening defect:** Synthetic review note; speech quality is unverified.\n')
        sources.push(report)
      }
      const original = buildTtsDashboard(sourceRoot)
      const evidence = {
        schemaVersion: 1, sources,
        samples: original.samples.map(sample => ({ ...sample, audioSha256: sha256(readFileSync(join(dirname(sourceRoot), sample.audioHref!))) })),
      }
      const checksums: string[] = []
      const retain = (name: string, bytes: Buffer) => {
        mkdirSync(dirname(join(archiveRoot, name)), { recursive: true })
        writeFileSync(join(archiveRoot, name), bytes)
        checksums.push(sha256(bytes) + '  ' + name)
      }
      retain('dashboard.json', Buffer.from(JSON.stringify(evidence)))
      for (const source of sources) {
        const bytes = readFileSync(join(sourceRoot, source))
        retain('sources/' + source, bytes)
        mkdirSync(dirname(join(root, source)), { recursive: true })
        writeFileSync(join(root, source), bytes)
      }
      writeFileSync(join(archiveRoot, 'SHA256SUMS'), checksums.join('\n') + '\n')
      const archive = join(root, TTS_DASHBOARD_EVIDENCE)
      const zipped = Bun.spawnSync(['zip', '-q', archive, 'dashboard.json', 'SHA256SUMS', ...sources.map(source => 'sources/' + source)], { cwd: archiveRoot })
      expect(zipped.exitCode).toBe(0)
      const { dashboardModel, samples } = buildTtsDashboard(root)
      expect(samples).toHaveLength(3)
      expect(samples).toEqual(original.samples)
      const stable = (model: CombinedDashboardModel) => ({ ...model, generatedAt: 'CURRENT' })
      expect(stable(dashboardModel)).toEqual({ ...stable(original.dashboardModel), methodParagraphs: dashboardModel.methodParagraphs })
      expect(dashboardModel.methodParagraphs.join(' ')).toContain('Retained evidence binds')
      for (const sample of samples) {
        expect(existsSync(join(checkout, sample.manifestHref))).toBe(true)
        expect(existsSync(join(checkout, sample.audioHref!))).toBe(false)
      }
      expect(dashboardModel.groups.flatMap(group => group.providers).every(row => row.quality.rank === null)).toBe(true)
      expect(dashboardModel.sampleTables?.map(table => table.rows.length)).toEqual([1, 1, 1])
      const panel = renderTabPanel({ key: 'tts', label: 'TTS', rootLabel: 'tts', model: dashboardModel })
      expect(panel).toContain('Synthetic review note; speech quality is unverified.')
      expect([...panel.matchAll(/>WAV<\/a>/g)]).toHaveLength(3)
      for (const suite of ['emotion', 'speed-pauses']) {
        const newer = '2000-01-04_tts-' + suite
        mkdirSync(join(root, newer))
        expect(() => collectTtsDashboardSamples(root)).toThrow('Retained TTS evidence is stale: ' + newer)
        rmdirSync(join(root, newer))
      }
      const addedManifest = join(root, 'new-narration', 'manifest.json')
      writeJson(addedManifest, {})
      expect(() => buildTtsDashboard(root)).toThrow('Retained TTS evidence is stale: new-narration/manifest.json')
      unlinkSync(addedManifest)
      const audio = join(checkout, samples[0]!.audioHref!)
      mkdirSync(dirname(audio), { recursive: true })
      writeFileSync(audio, 'corrupt retained audio')
      expect(() => buildTtsDashboard(root)).toThrow('TTS audio hash mismatch')
      writeFileSync(join(root, sources[0]!), '{}')
      expect(() => buildTtsDashboard(root)).toThrow('Retained TTS evidence is stale')
      writeFileSync(archive, 'not a zip')
      expect(() => buildTtsDashboard(root)).toThrow('Cannot read TTS evidence entry')
    })
  }, 30_000)
})
