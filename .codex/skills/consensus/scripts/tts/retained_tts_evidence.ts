import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { TtsDashboardSample } from './build_tts_dashboard';
import { activeTtsControlBenchmarks } from './tts_benchmark_layout';

export const TTS_DASHBOARD_EVIDENCE = 'dashboard.evidence.zip';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function contained(root: string, path: string): string {
  const resolved = resolve(root, path), rel = relative(resolve(root), resolved);
  if (!path || isAbsolute(path) || rel.startsWith('..') || isAbsolute(rel)) throw Error('TTS evidence path escaped its root');
  return resolved;
}

function entry(archive: string, name: string): Buffer {
  const result = Bun.spawnSync(['unzip', '-p', archive, name]);
  if (result.exitCode !== 0) throw Error(`Cannot read TTS evidence entry: ${name}`);
  return result.stdout;
}

// This explicit archive preserves measurements whose original render records were
// removed. It never fabricates replacement render records or claims to reverify
// absent audio. Live manifests without this archive still require every artifact.
export function readRetainedTtsEvidence(root: string): TtsDashboardSample[] | null {
  const archive = join(root, TTS_DASHBOARD_EVIDENCE);
  if (!existsSync(archive)) return null;
  const checksums = new Map(entry(archive, 'SHA256SUMS').toString().trim().split('\n').map(line => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) throw Error('Invalid TTS evidence checksum manifest');
    return [match[2]!, match[1]!] as const;
  }));
  const verified = (name: string) => {
    const bytes = entry(archive, name);
    if (hash(bytes) !== checksums.get(name)) throw Error(`TTS evidence checksum mismatch: ${name}`);
    return bytes;
  };
  const evidence = JSON.parse(verified('dashboard.json').toString()) as {
    schemaVersion: number;
    sources: string[];
    samples: Array<TtsDashboardSample & { audioSha256: string }>;
  };
  if (evidence.schemaVersion !== 1 || !Array.isArray(evidence.sources) || !Array.isArray(evidence.samples) || !evidence.samples.length) {
    throw Error('Invalid retained TTS evidence');
  }
  for (const source of evidence.sources) {
    const bytes = verified(`sources/${source}`);
    if (!readFileSync(contained(root, source)).equals(bytes)) throw Error(`Retained TTS evidence is stale: ${source}`);
  }
  const directories = readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name);
  for (const directory of directories) {
    const manifest = `${directory}/manifest.json`;
    if (existsSync(join(root, manifest)) && !evidence.sources.includes(manifest)) throw Error(`Retained TTS evidence is stale: ${manifest}`);
  }
  for (const { suite, directory } of activeTtsControlBenchmarks(root)) {
    if (!evidence.sources.some(source => source.startsWith(`${directory}/`)) ||
      !evidence.samples.some(sample => sample.suite === suite && sample.run.startsWith(`${directory}/`))) {
      throw Error(`Retained TTS evidence is stale: ${directory}`);
    }
  }
  return evidence.samples.map(({ audioSha256, ...sample }) => {
    if (!['narration', 'emotion', 'speed-pauses'].includes(sample.suite) || !sample.providerKey ||
      !/^[a-f0-9]{64}$/.test(audioSha256) || !Number.isFinite(sample.durationSeconds) || sample.durationSeconds! <= 0 ||
      !Number.isFinite(sample.costCents) || sample.costCents! < 0) throw Error('Invalid retained TTS sample');
    const evidencePath = contained(dirname(root), sample.manifestHref);
    if (!evidence.sources.some(source => contained(root, source) === evidencePath)) throw Error('Unbound retained TTS source');
    if (sample.audioHref) {
      const audioPath = contained(dirname(root), sample.audioHref);
      if (existsSync(audioPath) && hash(readFileSync(audioPath)) !== audioSha256) throw Error(`TTS audio hash mismatch: ${sample.providerKey} / ${sample.run}`);
    }
    return sample;
  });
}
