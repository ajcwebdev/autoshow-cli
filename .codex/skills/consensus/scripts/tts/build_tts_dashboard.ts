import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { readCanonicalManifest, isRecord, type JsonObject } from "../shared/pipeline_manifest";
import type { CombinedDashboardModel, DashboardGroup, DashboardProviderRow } from "../shared/combined_report_html";
import { readRetainedTtsEvidence, TTS_DASHBOARD_EVIDENCE } from './retained_tts_evidence';
import { activeTtsControlBenchmarks } from './tts_benchmark_layout';

const object = (value: unknown): JsonObject => isRecord(value) ? value : {};
const records = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter(isRecord) : [];
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const dollars = (cents: number | null) => cents === null ? 'n/a' : `$${(cents / 100).toFixed(5)}`;
const seconds = (ms: number | null) => ms === null ? 'n/a' : `${(ms / 1000).toFixed(2)}s`;
const sumComplete = (values: Array<number | null>): number | null => values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0);

export interface TtsDashboardSample {
  run: string; suite: 'narration' | 'emotion' | 'speed-pauses'; providerKey: string; local: boolean;
  status: string; characters: number | null; processingMs: number | null; recovery: boolean;
  durationSeconds: number | null; costCents: number | null; costBasis: string; format: string;
  audioHref: string | null; manifestHref: string; mechanism: string;
}

function artifactPath(root: string, path: unknown): string {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw Error('Missing or absolute TTS artifact reference');
  const result = resolve(root, path), rel = relative(resolve(root), result);
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error('TTS artifact escaped its run directory');
  return result;
}

function verifiedJson(root: string, ref: JsonObject): JsonObject {
  const bytes = readFileSync(artifactPath(root, ref['path']));
  if (typeof ref['sha256'] !== 'string' || hash(bytes) !== ref['sha256']) throw Error(`TTS JSON hash mismatch: ${ref['path']}`);
  const json: unknown = JSON.parse(bytes.toString());
  if (!isRecord(json)) throw Error(`Invalid TTS JSON: ${ref['path']}`);
  return json;
}

function usdAmounts(value: unknown): number | null {
  const amounts = records(value).filter(entry => entry['currency'] === 'USD' && number(entry['amount']) !== null);
  return amounts.length ? amounts.reduce((sum, entry) => sum + Number(entry['amount']) * 100, 0) : null;
}

function audioProbe(path: string): { duration: number; format: string } {
  const result = Bun.spawnSync(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels,codec_name', '-of', 'json', path]);
  if (result.exitCode !== 0) throw Error(`Invalid TTS audio: ${basename(path)}: ${result.stderr.toString().trim()}`);
  const value = JSON.parse(result.stdout.toString());
  const duration = Number(value.format?.duration), stream = value.streams?.[0];
  if (!Number.isFinite(duration) || duration <= 0 || !stream) throw Error(`Empty TTS audio: ${basename(path)}`);
  return { duration, format: `${Number(stream.sample_rate) / 1000} kHz / ${stream.channels} ch / ${stream.codec_name}` };
}

function readSamples(root: string, runDir: string, suite: TtsDashboardSample['suite']): TtsDashboardSample[] {
  const manifest = readCanonicalManifest(runDir);
  if (manifest.command !== 'tts' || manifest.items.length !== 1) throw Error(`Expected one archived TTS item: ${runDir}`);
  const item = manifest.items[0]!;
  const costs = records(object(object(item.metadata['cost'])['actual'])['steps']);
  const entries = records(item.metadata['tts']);
  const controlsPath = join(runDir, 'controls.json');
  const controls = existsSync(controlsPath) ? object(JSON.parse(readFileSync(controlsPath, 'utf8'))) : {};
  const link = (path: string) => relative(dirname(root), path).split('\\').join('/');
  return item.providers.filter(provider => provider.status !== 'skipped').map(provider => {
    const providerKey = `${provider.service}/${provider['model']}`;
    const targetKey = (provider as unknown as JsonObject)['targetKey'];
    const entry = entries.find(entry => targetKey && entry['targetKey'] === targetKey)
      ?? entries.find(entry => entry['ttsService'] === provider.service && entry['ttsModel'] === provider['model']) ?? {};
    const projection = object(object(provider.result)['ttsAudio'] ?? provider.metadata['ttsAudio']);
    const selected = object(projection['selectedSuccess']), archive = object(projection['archive']);
    const sample: TtsDashboardSample = {
      run: relative(root, runDir).split('\\').join('/'), suite, providerKey, local: provider.local === true,
      status: provider.status, characters: number(item.metadata['characterCount']), processingMs: number(entry['processingTime']), recovery: false,
      durationSeconds: null, costCents: null, costBasis: 'unavailable', format: 'n/a', audioHref: null,
      manifestHref: link(join(runDir, 'manifest.json')), mechanism: typeof controls['mechanism'] === 'string' ? controls['mechanism'] : 'Single-voice narration',
    };
    if (provider.status !== 'succeeded') { sample.processingMs = null; return sample; }
    let audioRef: JsonObject, render: JsonObject;
    if (isRecord(archive['finalRef'])) {
      audioRef = archive['finalRef'];
      render = verifiedJson(runDir, object(archive['renderRef']));
      const final = object(object(render['outputs'])['final']);
      if (final['path'] !== audioRef['path'] || final['sha256'] !== audioRef['sha256']) throw Error(`TTS final reference mismatch: ${providerKey}`);
    } else {
      const history = records(projection['renderHistory']).find(row => row['renderIdentity'] === selected['renderIdentity']);
      const event = records(history?.['events']).find(row => row['sequence'] === selected['eventSequence']);
      if (!event) throw Error(`Missing selected TTS result: ${providerKey}`);
      audioRef = records(event['reportedOutputRefs'])[0] ?? {};
      const providerRoot = artifactPath(runDir, provider.artifactDir);
      render = verifiedJson(providerRoot, { path: event['providerRenderResultRef'], sha256: event['providerRenderResultSha256'] });
      sample.recovery = String(event['audioRunRef'] ?? '').includes('recovery-audio-run-');
    }
    const audioPath = artifactPath(runDir, audioRef['path']), bytes = readFileSync(audioPath);
    if (hash(bytes) !== audioRef['sha256']) throw Error(`TTS audio hash mismatch: ${providerKey} / ${sample.run}`);
    const probe = audioProbe(audioPath);
    sample.durationSeconds = probe.duration; sample.format = probe.format; sample.audioHref = link(audioPath);
    const recorded = costs.find(cost => cost['provider'] === provider.service && cost['model'] === provider['model']);
    const composition = object(object(render['cost'])['currentComposition']);
    const observed = usdAmounts(composition['observed']), planned = usdAmounts(object(composition['planned'])['amounts']);
    if (sample.local) { sample.costCents = 0; sample.costBasis = 'local'; }
    else if (observed !== null) { sample.costCents = observed; sample.costBasis = 'provider usage'; }
    else if (number(recorded?.['cost']) !== null) {
      sample.costCents = number(recorded!['cost']);
      sample.costBasis = recorded!['costSource'] === 'provider_usage' ? 'provider usage' : recorded!['costSource'] === 'heuristic' ? 'estimated usage' : 'computed usage';
    } else { sample.costCents = planned; sample.costBasis = planned === null ? 'unavailable' : 'planned estimate'; }
    return sample;
  });
}

export function collectTtsDashboardSamples(rootDir: string): TtsDashboardSample[] {
  const retained = readRetainedTtsEvidence(rootDir);
  if (retained) return retained;
  const root = resolve(rootDir), samples: TtsDashboardSample[] = [];
  // Narration manifests and the independently versioned control benchmarks share the TTS archive root.
  for (const entry of readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const run = join(root, entry.name);
    if (existsSync(join(run, 'manifest.json'))) samples.push(...readSamples(root, run, 'narration'));
  }
  for (const { suite, directory } of activeTtsControlBenchmarks(root)) {
    const suiteRoot = join(root, directory);
    for (const entry of readdirSync(suiteRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const run = join(suiteRoot, entry.name);
      if (existsSync(join(run, 'manifest.json'))) samples.push(...readSamples(root, run, suite));
    }
  }
  if (!samples.length) throw Error(`No TTS benchmark manifests found in ${root}`);
  return samples;
}

function suiteReviewNotes(root: string, samples: TtsDashboardSample[]): string[] {
  const reports = new Set(samples.filter(row => row.suite !== 'narration').map(row => join(root, dirname(row.run), 'benchmark-report.md')));
  return [...reports].flatMap(path => existsSync(path)
    ? readFileSync(path, 'utf8').split('\n').filter(line => line.startsWith('> ')).map(line => line.slice(2))
    : []);
}

export function buildTtsDashboard(rootDir: string, generatedAt = new Date().toISOString()): { dashboardModel: CombinedDashboardModel; samples: TtsDashboardSample[] } {
  const samples = collectTtsDashboardSamples(rootDir), narration = samples.filter(row => row.suite === 'narration');
  const runs = [...new Set(narration.map(row => row.run))];
  const groups: DashboardGroup[] = [false, true].map(local => {
    const keys = [...new Set(narration.filter(row => row.local === local).map(row => row.providerKey))].sort();
    const providers: DashboardProviderRow[] = keys.map(providerKey => {
      const rows = narration.filter(row => row.providerKey === providerKey);
      const complete = rows.length === runs.length && rows.every(row => row.status === 'succeeded');
      const timings = rows.filter(row => !row.recovery && row.status === 'succeeded' && row.processingMs !== null && row.processingMs > 0);
      const elapsed = complete && timings.length === runs.length ? sumComplete(rows.map(row => row.processingMs)) : null;
      const audio = sumComplete(rows.map(row => row.durationSeconds));
      const cost = complete ? sumComplete(rows.map(row => row.costCents)) : null;
      const chars = sumComplete(rows.map(row => row.characters));
      const throughput = elapsed && audio ? audio * 1000 / elapsed : null;
      const perThousandCents = chars && cost !== null ? cost * 1000 / chars : null;
      return {
        providerKey, display: providerKey, model: providerKey.slice(providerKey.indexOf('/') + 1), coverage: `${rows.filter(row => row.status === 'succeeded').length}/${runs.length}`,
        quality: { display: 'Not assessed', rank: null, value: null },
        speed: { display: throughput === null ? 'n/a' : `${throughput.toFixed(2)}×`, rank: null, value: throughput },
        cost: { display: dollars(perThousandCents), rank: null, value: perThousandCents },
        evidence: [audio === null ? 'n/a' : `${audio.toFixed(2)}s`, dollars(cost), `${timings.length}/${runs.length}`, 'Not assessed'],
        perRun: runs.map(run => ({ display: rows.find(row => row.run === run)?.status === 'succeeded' ? 'Not assessed' : 'n/a', heat: null })),
      };
    });
    for (const metric of ['speed', 'cost'] as const) {
      const sorted = providers.filter(row => row[metric].value !== null).sort((a, b) => (metric === 'speed' ? -1 : 1) * (a[metric].value! - b[metric].value!) || a.providerKey.localeCompare(b.providerKey));
      sorted.forEach((row, index) => { row[metric].rank = index > 0 && row[metric].value === sorted[index - 1]![metric].value ? sorted[index - 1]![metric].rank : index + 1; });
    }
    return { key: local ? 'local' : 'service', label: local ? 'Narration — Local Models' : 'Narration — Third-Party Service Models',
      metricColumns: { quality: 'Automated accuracy', speed: 'Audio / generation time', cost: '$ / 1K input chars' },
      metricDirections: { quality: 'higher', speed: 'higher', cost: 'lower' }, evidenceColumns: ['Total audio', 'Total cost', 'Generation timing coverage', 'Human quality'],
      showPerRun: false, providers };
  });
  const table = (suite: TtsDashboardSample['suite'], title: string) => ({ title,
    notes: suiteReviewNotes(rootDir, samples.filter(row => row.suite === suite)),
    columns: ['Run / case', 'Provider / model', 'Execution', 'Recorded time', 'Time basis', 'Audio duration', 'Cost USD', 'Cost basis', 'Format', 'Audio', 'Evidence', 'Controls'],
    rows: samples.filter(row => row.suite === suite).map(row => [
      { display: basename(row.run) }, { display: row.providerKey }, { display: row.status }, { display: seconds(row.processingMs) },
      { display: row.recovery ? 'Local recovery; excluded from speed ranking' : 'Generation + local assembly' },
      { display: row.durationSeconds === null ? 'n/a' : `${row.durationSeconds.toFixed(3)}s` }, { display: dollars(row.costCents) }, { display: row.costBasis }, { display: row.format },
      { display: row.audioHref ? 'WAV' : 'Unavailable', ...(row.audioHref ? { artifactHref: row.audioHref } : {}) },
      { display: row.manifestHref.endsWith('.md') ? 'Report' : 'Manifest', artifactHref: row.manifestHref }, { display: row['mechanism'] },
    ]) });
  return { samples, dashboardModel: {
    title: 'TTS benchmark results', category: 'tts', generatedAt, rootDir: 'docs/benchmarks/tts',
    summaryStats: [{ label: 'Narration inputs', value: String(runs.length) }, { label: 'Narration models', value: String(new Set(narration.map(row => row.providerKey)).size) },
      { label: 'Controls results', value: String(samples.length - narration.length) }, { label: 'Audio measurements', value: String(samples.filter(row => row.audioHref).length) }, { label: 'Quality assessment', value: 'Unavailable' }],
    runs: runs.map((run, index) => ({ runName: run, shortLabel: `R${index + 1}`, detail: `${narration.filter(row => row.run === run).length} provider/model results` })),
    groups, sampleTables: [table('narration', 'Narration — individual results'), table('emotion', 'Emotion and delivery — individual cases'), table('speed-pauses', 'Speed and pauses — individual cases')],
    methodParagraphs: [
      'Narration rankings use the common direct-child TTS benchmark corpus. Controls are shown separately because providers expose different native mechanisms. Emotion and delivery, and speed and pauses, each select their newest dated standalone benchmark directory independently; earlier revisions are excluded.',
      existsSync(join(rootDir, TTS_DASHBOARD_EVIDENCE))
        ? 'Retained evidence binds the current manifests and reports to recorded audio hashes and local ffprobe measurements. Narration costs and exact timings come from manifests; controls costs and timings retain the reports\' published precision. Original render records and controls manifests are unavailable. Locally present audio is hash-checked; absent audio is not reverified. Audio links require the original local recordings. Costs are not confirmed invoices or total historical spending; Soniox costs remain estimates.'
        : 'Selected manifest audio references and SHA-256 hashes are authoritative. Duration and format are read locally with ffprobe. Current provider usage is preferred for cost, then recorded usage estimates, then the selected render estimate. Costs describe the selected audio, not all historical spending or confirmed invoices. Soniox costs remain estimates based on measured provider audio before local silence insertion.',
      'Generation throughput is total final audio duration divided by total recorded generation time, including local assembly. Local recovery timings are labeled and excluded. Speed and cost rankings require complete narration coverage; timings reflect their original concurrency and machine conditions.',
      'No roundtrip transcript accuracy or human listening scores are present for these benchmark archives. Automated accuracy, spoken-text correctness, audible control effectiveness and human quality are not inferred from HTTP success, audio integrity, duration, speed or cost. No quality ranking is asserted.',
    ], notes: ['Audio and evidence links are relative. Audio playback requires the retained local recordings. Refreshing this page makes no provider calls and does not alter benchmark artifacts.'],
  } };
}
