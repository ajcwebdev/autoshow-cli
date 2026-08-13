import { existsSync } from "node:fs"
import { join } from "node:path"
import { derivePipelineItemRecord, PIPELINE_MANIFEST_FILE, readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type { AudioProperties, TtsEntryMetadata, TtsManifestMetadata } from '~/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export async function loadTtsManifestMetadata(runDir: string): Promise<TtsManifestMetadata> {
  const manifest = await readManifest(runDir);
  const item = manifest?.items[0];
  if (!manifest || manifest.command !== "tts" || manifest.scope !== "single" || !item) {
    throw ValidationError(`Expected a single TTS ${PIPELINE_MANIFEST_FILE}`, { stage: 'benchmark:tts-eval' });
  }
  const metadata = derivePipelineItemRecord(runDir, item);
  if (!Array.isArray(metadata['tts']) || metadata['tts'].length === 0) {
    throw ValidationError(`${PIPELINE_MANIFEST_FILE} item metadata.tts is missing or empty`, { stage: 'benchmark:tts-eval' });
  }
  return metadata as unknown as TtsManifestMetadata;
}

export function makeProviderKey(service: string, model: string): string {
  return `${service}/${model}`;
}

/**
 * Current manifests identify a benchmark row by execution target plus immutable voice/render
 * context. Legacy manifests retain their historical provider/model key explicitly.
 */
export function makeTtsBenchmarkKey(entry: TtsEntryMetadata): string {
  const legacyKey = makeProviderKey(entry.ttsService, entry.ttsModel);
  const targetKey = entry.targetKey?.trim();
  const identities = [
    entry.renderIdentity?.trim() ? `render:${entry.renderIdentity.trim()}` : undefined,
    entry.registrationId?.trim() ? `registration:${entry.registrationId.trim()}` : undefined,
    entry.snapshotEntryId?.trim() ? `snapshot-entry:${entry.snapshotEntryId.trim()}` : undefined,
    entry.characterIdentity?.trim() ? `character:${entry.characterIdentity.trim()}` : undefined,
  ].filter((value): value is string => value !== undefined);
  if (!targetKey && identities.length === 0) return `legacy:${legacyKey}`;
  const base = targetKey || legacyKey;
  return identities.length === 0 ? base : `${base}::${identities.join('::')}`;
}

// ---------------------------------------------------------------------------
// Audio file discovery
// ---------------------------------------------------------------------------

export function discoverAudioFiles(
  runDir: string,
  ttsEntries: TtsEntryMetadata[],
): { found: Map<string, string>; missing: string[] } {
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const entry of ttsEntries) {
    const audioPath = join(runDir, entry.audioFileName);
    if (existsSync(audioPath)) {
      const benchmarkKey = makeTtsBenchmarkKey(entry);
      if (found.has(benchmarkKey)) {
        throw ValidationError(`Duplicate TTS benchmark identity ${benchmarkKey}; voice-aware entries must have distinct target/render or binding identity.`, { stage: 'benchmark:tts-eval' });
      }
      found.set(benchmarkKey, audioPath);
    } else {
      missing.push(entry.audioFileName);
    }
  }
  return { found, missing };
}

// ---------------------------------------------------------------------------
// ffprobe
// ---------------------------------------------------------------------------

export async function probeAudio(audioPath: string): Promise<AudioProperties> {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v", "error",
      "-show_entries", "format=duration,bit_rate:stream=sample_rate,channels,codec_name",
      "-of", "json",
      audioPath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw InfraError(`ffprobe failed for ${audioPath}: ${stderr.trim()}`, { stage: 'benchmark:tts-eval' });
  }
  const data = JSON.parse(output) as {
    format?: { duration?: string; bit_rate?: string };
    streams?: Array<{ sample_rate?: string; channels?: number; codec_name?: string }>;
  };
  const stream = data.streams?.[0];
  return {
    durationSeconds: data.format?.duration ? Number(data.format.duration) : 0,
    sampleRate: stream?.sample_rate ? Number(stream.sample_rate) : null,
    channels: stream?.channels ?? null,
    bitrate: data.format?.bit_rate ? Number(data.format.bit_rate) : null,
    codec: stream?.codec_name ?? null,
  };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export function computeSpeakingRate(charCount: number, durationSeconds: number): number | null {
  if (durationSeconds <= 0) {
    return null;
  }
  return charCount / durationSeconds;
}

// ---------------------------------------------------------------------------
// Text utilities (self-contained copies from stt-consensus)
// ---------------------------------------------------------------------------

const TOKEN_RE = /[a-z0-9]+(?:[''][a-z0-9]+)?/gi;
const PUNCT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u2018/g, "'"],
  [/\u2019/g, "'"],
  [/\u201c/g, '"'],
  [/\u201d/g, '"'],
  [/\u2013/g, "-"],
  [/\u2014/g, "-"],
  [/\u2026/g, "..."],
];

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of PUNCT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.trim().replace(/\s+/g, " ");
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

function levenshteinDistance(left: string[], right: string[]): number {
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  if (left.length < right.length) {
    return levenshteinDistance(right, left);
  }
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const insertion = (current[rightIndex] ?? 0) + 1;
      const deletion = (previous[rightIndex + 1] ?? 0) + 1;
      const substitution = (previous[rightIndex] ?? 0) + Number((left[leftIndex] ?? "") !== (right[rightIndex] ?? ""));
      current.push(Math.min(insertion, deletion, substitution));
    }
    previous = current;
  }
  return previous.at(-1) ?? 0;
}

export function roundtripWer(originalText: string, transcribedText: string): number {
  const originalTokens = tokenize(originalText);
  const transcribedTokens = tokenize(transcribedText);
  if (originalTokens.length === 0) {
    return 0;
  }
  return levenshteinDistance(originalTokens, transcribedTokens) / originalTokens.length;
}

// ---------------------------------------------------------------------------
// Provider classification
// ---------------------------------------------------------------------------

const LOCAL_SERVICES = new Set(["kitten"]);

export function isLocalService(ttsService: string): boolean {
  return LOCAL_SERVICES.has(ttsService);
}
