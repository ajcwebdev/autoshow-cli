import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  DASHBOARD_CLIENT_SCRIPT,
  DASHBOARD_CLIENT_STYLESHEET,
  type BenchmarkDashboardData,
  type CombinedDashboardModel,
  type DashboardProviderRow,
} from '../../../../.codex/skills/consensus/scripts/shared/combined_report_html'
import { withTempDir } from '../../../test-utils/temp-dirs'

function localChromium(): string | undefined {
  const explicit = process.env['AUTOSHOW_CHROMIUM_PATH']
  if (explicit && existsSync(explicit)) return explicit
  const cache = join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright')
  if (!existsSync(cache)) return undefined
  for (const name of readdirSync(cache).filter(name => /^chromium_headless_shell-\d+$/.test(name)).sort().reverse()) {
    const executable = join(cache, name, process.platform === 'darwin'
      ? 'chrome-headless-shell-mac-arm64/chrome-headless-shell'
      : 'chrome-linux/headless_shell')
    if (existsSync(executable)) return executable
  }
  return undefined
}

const chromium = localChromium()
const browserTest = (name: string, fn: () => Promise<void>, timeout: number) => {
  if (chromium) test(name, fn, timeout)
  else test.skip(name, fn, timeout)
}

const provider = (model: string, rank: number): DashboardProviderRow => ({
  providerKey: `fixture/${model}`, model, display: model, coverage: '1/1',
  quality: { value: 100 - rank, display: String(100 - rank), rank },
  speed: { value: rank, display: `${rank}s`, rank },
  cost: { value: rank / 100, display: `$0.0${rank}`, rank },
  evidence: [`${model} evidence`], perRun: [{ display: `${model} heatmap`, heat: 100 - rank }],
})

function model(supported: boolean): CombinedDashboardModel {
  const providers = supported ? [provider('current-a', 1), provider('current-b', 2)]
    : [provider('retired-model', 1), provider('current-a', 2), provider('current-b', 3)]
  const group = {
    key: 'hosted', label: 'Hosted',
    metricColumns: { quality: 'Quality', speed: 'Seconds', cost: 'USD' },
    metricDirections: { quality: 'higher', speed: 'lower', cost: 'lower' } as const,
    evidenceColumns: ['Evidence'], providers,
  }
  return {
    title: 'Fixture benchmarks', category: 'write', generatedAt: 'fixed-time', rootDir: 'fixture',
    summaryStats: [{ label: 'Models', value: supported ? '2' : '3' }],
    runs: [{ runName: 'one', shortLabel: 'R1', detail: 'Fixed fixture' }],
    groups: [group, { ...group, key: 'archive', label: 'Archive group', providers: supported ? [] : [provider('retired-only', 1)] }],
    sampleTables: [{ title: 'Request evidence', columns: ['Model', 'Output'], rows: providers.map(row => [
      { display: row.model }, { display: `${row.model} output`, artifactHref: `fixture/${row.model}.json` },
    ]) }],
    methodParagraphs: ['Fixed local fixture.'], notes: [],
  }
}

function fixture(): BenchmarkDashboardData {
  return {
    schemaVersion: 1, title: 'Model filter browser contract', generatedAt: 'fixed-time',
    tabs: ['first', 'second'].map(key => ({ key, label: key, rootLabel: 'fixture', model: model(false), supportedModel: model(true) })),
  }
}

// Run the actual dependency-free client in an installed browser. The fixture serves localhost
// only, uses no provider credentials, and requires no browser package or download.
async function inBrowser(data: BenchmarkDashboardData, expression: string): Promise<Record<string, unknown>> {
  if (!chromium) throw new Error('No local Chromium executable')
  return await withTempDir('dashboard-model-toggle-browser-', async dir => {
    const page = `<!doctype html><html><head><link rel="stylesheet" href="/client.css"></head><body>
<main id="fixture" class="dashboard"></main><script src="/client.js"></script><script>
const fixtureData = ${JSON.stringify(data)};
const before = JSON.stringify(fixtureData);
const main = document.querySelector('#fixture');
try {
  AutoShowDashboard.mount(main, fixtureData);
  const result = (() => { ${expression} })();
  result.dataUnchanged = before === JSON.stringify(fixtureData);
  const output = document.createElement('output');
  output.id = 'browser-result';
  output.textContent = btoa(JSON.stringify(result));
  document.body.appendChild(output);
} catch (error) {
  const output = document.createElement('output');
  output.id = 'browser-result';
  output.textContent = btoa(JSON.stringify({ browserError: String(error), stack: error.stack }));
  document.body.appendChild(output);
}
</script></body></html>`
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/client.js') return new Response(readFileSync(DASHBOARD_CLIENT_SCRIPT), { headers: { 'content-type': 'text/javascript' } })
      if (path === '/client.css') return new Response(readFileSync(DASHBOARD_CLIENT_STYLESHEET), { headers: { 'content-type': 'text/css' } })
      return new Response(page, { headers: { 'content-type': 'text/html' } })
    } })
    const child = Bun.spawn([chromium, '--headless', '--dump-dom', '--disable-gpu', '--no-sandbox',
      '--disable-background-networking', '--disable-component-update', '--no-first-run',
      `--user-data-dir=${dir}`, `http://127.0.0.1:${server.port}/`], { stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => child.kill(), 20_000)
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(code, stderr).toBe(0)
      const encoded = stdout.match(/<output id="browser-result">([^<]+)<\/output>/)?.[1]
      expect(encoded, stderr).toBeDefined()
      const result = JSON.parse(Buffer.from(encoded!, 'base64').toString()) as Record<string, unknown>
      expect(result['browserError'], String(result['stack'] ?? '')).toBeUndefined()
      return result
    } finally {
      clearTimeout(timeout)
      child.kill()
      await child.exited
      server.stop(true)
    }
  })
}

describe('dashboard model filter browser interaction', () => {
  browserTest('defaults to supported models and restores full history across rankings, heatmaps, evidence and statistics', async () => {
    const result = await inBrowser(fixture(), `
      const checkbox = main.querySelector('#supported-models-only');
      const snapshot = () => ({
        checked: main.querySelector('#supported-models-only').checked,
        providers: [...main.querySelectorAll('#panel-first .sort-quality tbody code')].map(node => node.textContent),
        qualityRanks: [...main.querySelectorAll('#panel-first .sort-quality tbody tr')].map(node => node.cells[2].querySelector('.rk').textContent),
        heatmap: [...main.querySelectorAll('#panel-first td.heat')].map(node => node.textContent),
        evidence: [...main.querySelectorAll('#panel-first .samples tbody td:first-child')].map(node => node.textContent),
        models: main.querySelector('#panel-first .tile .v').textContent,
        emptyGroups: main.querySelectorAll('#panel-first .empty').length,
        rank: main.querySelector('#panel-first .sort-quality tbody .rk').textContent,
      });
      const supported = snapshot();
      checkbox.click();
      const historical = snapshot();
      main.querySelector('#supported-models-only').click();
      return { supported, historical, restored: snapshot() };
    `)
    const supported = {
      checked: true, providers: ['current-a', 'current-b'], qualityRanks: ['1', '2'],
      heatmap: ['current-a heatmap', 'current-b heatmap'], evidence: ['current-a', 'current-b'], models: '2', emptyGroups: 1, rank: '1',
    }
    expect(result['supported']).toEqual(supported)
    expect(result['historical']).toEqual({
      checked: false, providers: ['retired-model', 'current-a', 'current-b', 'retired-only'], qualityRanks: ['1', '2', '3', '1'],
      heatmap: ['retired-model heatmap', 'current-a heatmap', 'current-b heatmap', 'retired-only heatmap'],
      evidence: ['retired-model', 'current-a', 'current-b'], models: '3', emptyGroups: 0, rank: '1',
    })
    expect(result['restored']).toEqual(supported)
    expect(result['dataUnchanged']).toBe(true)
  }, 30_000)

  browserTest('preserves selected tab, independent sort controls and custom slider percentages through both filter directions', async () => {
    const result = await inBrowser(fixture(), `
      main.querySelector('#sort-first-hosted-speed').click();
      main.querySelector('#tab-second').click();
      const slider = main.querySelector('#w-second-hosted-quality');
      slider.value = '20';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const snapshot = () => ({
        tab: main.querySelector('input[name="dashboard-tab"]:checked').id,
        activePanels: [...main.querySelectorAll('.panel.active')].map(node => node.id),
        firstSort: main.querySelector('#panel-first .provider-sort input[type="radio"]:checked').value,
        secondSort: main.querySelector('#panel-second .provider-sort input[type="radio"]:checked').value,
        weights: [...main.querySelector('#panel-second .provider-sort').querySelectorAll('input[type="range"]')].map(node => Number(node.value)),
        scores: [...main.querySelectorAll('#panel-second .sort-custom [data-score-cell]')].map(node => node.textContent),
      });
      const before = snapshot();
      main.querySelector('#supported-models-only').click();
      const historical = snapshot();
      main.querySelector('#supported-models-only').click();
      const restored = snapshot();
      return { before, historical, restored };
    `)
    for (const key of ['before', 'historical', 'restored']) {
      expect(result[key]).toMatchObject({
        tab: 'tab-second', activePanels: ['panel-second'], firstSort: 'speed', secondSort: 'custom', weights: [20, 40, 40],
      })
    }
    expect((result['before'] as { scores: string[] }).scores).toHaveLength(2)
    expect((result['historical'] as { scores: string[] }).scores).toHaveLength(4)
    expect(result['restored']).toEqual(result['before'])
    expect(result['dataUnchanged']).toBe(true)
  }, 30_000)

  browserTest('remembers the filter choice and remains usable when browser storage is blocked', async () => {
    const result = await inBrowser(fixture(), `
      const initial = main.querySelector('#supported-models-only').checked;
      main.querySelector('#supported-models-only').click();
      const saved = localStorage.getItem('autoshow-dashboard-supported-models-only');
      AutoShowDashboard.mount(main, fixtureData);
      const remembered = main.querySelector('#supported-models-only').checked;
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Storage disabled'); } });
      AutoShowDashboard.mount(main, fixtureData);
      const fallback = main.querySelector('#supported-models-only').checked;
      main.querySelector('#supported-models-only').click();
      return { initial, saved, remembered, fallback, stillUsable: !main.querySelector('#supported-models-only').checked };
    `)
    expect(result).toEqual({ initial: true, saved: 'false', remembered: false, fallback: true, stillUsable: true, dataUnchanged: true })
  }, 30_000)
})
