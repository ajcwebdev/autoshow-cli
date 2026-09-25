import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { buildTtsDashboard, collectTtsDashboardSamples } from '../../../../.codex/skills/consensus/scripts/tts/build_tts_dashboard'
import type { BenchmarkDashboardData, CombinedDashboardModel } from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import { renderTabPanel } from '../../../../.codex/skills/consensus/scripts/shared/dashboard_client.js'
import { TTS_DASHBOARD_EVIDENCE } from '../../../../.codex/skills/consensus/scripts/tts/retained_tts_evidence'
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
    command: 'tts', scope: 'single', createdAt: '2026-09-12', updatedAt: '2026-09-24',
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
  test('weights narration throughput and cost by corpus totals and keeps active controls separate', async () => {
    await withTempDir('tts-dashboard-', async dir => {
      const root = join(dir, 'tts')
      fixture(root, '01-short', { duration: 2, characters: 100, processingMs: 1000, recordedCents: 1 })
      fixture(root, '02-long', { duration: 8, characters: 900, processingMs: 9000, recordedCents: 9 })
      fixture(root, '2026-09-12_05-tts-emotion/current-emotion', { recordedCents: 100 })
      fixture(root, '2026-09-01_05-tts-emotion/obsolete-emotion', { recordedCents: 200 })
      fixture(root, '2026-09-10_06-tts-speed-pauses/current-timing', { recordedCents: 50 })
      fixture(root, '2026-09-01_06-tts-speed-pauses/obsolete-timing', { recordedCents: 300 })
      const { dashboardModel, samples } = buildTtsDashboard(root)
      expect(samples).toHaveLength(4)
      expect(samples.filter(row => row.suite === 'narration')).toHaveLength(2)
      expect(samples.filter(row => row.suite === 'emotion').map(row => row.run)).toEqual(['2026-09-12_05-tts-emotion/current-emotion'])
      expect(samples.filter(row => row.suite === 'speed-pauses').map(row => row.run)).toEqual(['2026-09-10_06-tts-speed-pauses/current-timing'])
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
      const { runDir } = fixture(root, '2026-09-12_05-tts-emotion/current')
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

  test('one TTS tab reproduces independent benchmarks, retained metrics and review notes without ignored audio', async () => {
    const benchmarksRoot = resolve(import.meta.dir, '../../../../docs/benchmarks')
    const data = JSON.parse(readFileSync(join(benchmarksRoot, 'combined-comparison-dashboard.json'), 'utf8')) as BenchmarkDashboardData
    await withTempDir('tts-dashboard-checkout-', async checkout => {
      const root = join(checkout, 'tts')
      mkdirSync(root)
      const archive = join(benchmarksRoot, 'tts', TTS_DASHBOARD_EVIDENCE)
      const decoded = Bun.spawnSync(['unzip', '-p', archive, 'dashboard.json'])
      expect(decoded.exitCode).toBe(0)
      const evidence = JSON.parse(decoded.stdout.toString()) as { sources: string[], samples: Array<{ audioSha256: string }> }
      writeFileSync(join(root, TTS_DASHBOARD_EVIDENCE), readFileSync(archive))
      for (const source of evidence.sources) {
        mkdirSync(dirname(join(root, source)), { recursive: true })
        writeFileSync(join(root, source), readFileSync(join(benchmarksRoot, 'tts', source)))
      }
      const { dashboardModel, samples } = buildTtsDashboard(root)
      expect(samples).toHaveLength(47)
      expect(evidence.samples.every(row => /^[a-f0-9]{64}$/.test(row.audioSha256))).toBe(true)
      const soniox = samples.filter(row => row.providerKey === 'soniox/tts-rt-v2')
      expect(soniox.filter(row => row.suite === 'narration')).toHaveLength(4)
      expect(soniox.filter(row => row.suite !== 'narration')).toHaveLength(3)
      for (const sample of samples) {
        expect(existsSync(join(checkout, sample.manifestHref))).toBe(true)
        if (sample.audioHref) expect(existsSync(join(checkout, sample.audioHref))).toBe(false)
      }
      expect(soniox.every(row => row.audioHref?.includes('tts-rt-v2'))).toBe(true)
      expect(soniox.every(row => row.costBasis === 'estimated usage')).toBe(true)
      // Standalone benchmark directories remain together under the existing TTS tab.
      const stable = (model: CombinedDashboardModel) => ({ ...model, generatedAt: 'CURRENT', rootDir: 'CURRENT' })
      expect(data.tabs.filter(tab => tab.key.startsWith('tts')).map(tab => tab.key)).toEqual(['tts'])
      const committed = data.tabs.find(tab => tab.key === 'tts')!
      expect(committed.rootLabel).toBe('docs/benchmarks/tts')
      expect(stable(committed.model)).toEqual(stable(dashboardModel))
      expect(dashboardModel.groups.flatMap(group => group.providers).every(row => row.quality.rank === null)).toBe(true)
      expect(dashboardModel.sampleTables?.map(table => table.rows.length)).toEqual([32, 6, 9])
      expect(dashboardModel.sampleTables![1]!.notes?.join(' ')).toContain('This case fails spoken-text correctness')
      expect(dashboardModel.sampleTables![2]!.notes?.join(' ')).toContain('This timing case is unverified')
      expect(samples.filter(row => row.suite === 'emotion').every(row => row.run.startsWith('2026-09-12_05-tts-emotion/'))).toBe(true)
      expect(samples.filter(row => row.suite === 'speed-pauses').every(row => row.run.startsWith('2026-09-12_06-tts-speed-pauses/'))).toBe(true)
      const panel = renderTabPanel(committed)
      expect(panel).toContain('This case fails spoken-text correctness')
      expect([...panel.matchAll(/>WAV<\/a>/g)]).toHaveLength(samples.filter(row => row.audioHref).length)
      for (const suite of ['emotion', 'speed-pauses']) {
        const newer = `2026-09-26_tts-${suite}`
        mkdirSync(join(root, newer))
        expect(() => collectTtsDashboardSamples(root)).toThrow(`Retained TTS evidence is stale: ${newer}`)
        rmdirSync(join(root, newer))
      }
      const addedManifest = join(root, 'new-narration', 'manifest.json')
      writeJson(addedManifest, {})
      expect(() => buildTtsDashboard(root)).toThrow('Retained TTS evidence is stale: new-narration/manifest.json')
      unlinkSync(addedManifest)
      // Existing local audio remains strictly bound to the recorded digest.
      const audio = join(checkout, samples[0]!.audioHref!)
      mkdirSync(dirname(audio), { recursive: true })
      writeFileSync(audio, 'corrupt retained audio')
      expect(() => buildTtsDashboard(root)).toThrow('TTS audio hash mismatch')
      // Source changes must invalidate the archive, never silently reuse old metrics.
      writeFileSync(join(root, evidence.sources[0]!), '{}')
      expect(() => buildTtsDashboard(root)).toThrow('Retained TTS evidence is stale')
      writeFileSync(join(root, TTS_DASHBOARD_EVIDENCE), 'not a zip')
      expect(() => buildTtsDashboard(root)).toThrow('Cannot read TTS evidence entry')
    })
  }, 30_000)
})
