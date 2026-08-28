#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { isRecord, loadCanonicalRunRecord, readCanonicalManifest } from "../shared/pipeline_manifest";

export interface AudioProperties {
  durationSeconds: number;
  sampleRate: number | null;
  channels: number | null;
  bitrate: number | null;
  codec: string | null;
}

export interface TtsEntryMetadata {
  ttsService: string;
  ttsModel: string;
  speaker?: string;
  language?: string;
  processingTime: number;
  audioFileName: string;
  audioFileSize: number;
  chunkCount: number;
}

interface RunStepCostEntry {
  step?: string;
  provider?: string;
  model?: string;
  cost?: number;
  inputMetric?: string;
  inputValue?: number;
}

interface RunStepTimingEntry {
  step?: string;
  provider?: string;
  model?: string;
  processingTimeMs?: number;
  inputMetric?: string;
  inputValue?: number;
}

export interface TtsManifestRecord {
  metadata: {
    tts: TtsEntryMetadata[];
    cost?: {
      estimated?: { totalCost?: number; steps?: RunStepCostEntry[] };
      actual?: { totalCost?: number; steps?: RunStepCostEntry[] };
    };
    timing?: {
      estimated?: { totalProcessingTimeMs?: number; steps?: RunStepTimingEntry[] };
      actual?: { totalProcessingTimeMs?: number; steps?: RunStepTimingEntry[] };
    };
  };
}

export interface ProviderEvidence {
  providerKey: string;
  ttsService: string;
  ttsModel: string;
  speaker: string | null;
  audioFileName: string;
  audioFileSize: number;
  audioPath: string;
  audioExists: boolean;
  audioProperties: AudioProperties | null;
  chunkCount: number;
  processingTimeMs: number;
  costCents: number | null;
  speakingRateCharsPerSec: number | null;
  charCount: number;
  wordCount: number;
}

export function loadTtsManifestRecord(runDir: string): TtsManifestRecord {
  const manifest = readCanonicalManifest(runDir);
  const metadata = manifest.command === "tts"
    ? loadCanonicalRunRecord(runDir, "tts").metadata
    : loadComicTtsEvaluationMetadata(runDir, manifest);
  if (!Array.isArray(metadata["tts"]) || metadata["tts"].length === 0) {
    throw new Error("Canonical TTS manifest item metadata.tts is missing or empty");
  }
  return { metadata: metadata as TtsManifestRecord["metadata"] };
}

function containedArtifactPath(runDir: string, ...parts: string[]): string | null {
  const root = resolve(runDir);
  const candidate = resolve(root, ...parts);
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)) ? candidate : null;
}

function usdCostCents(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  const amounts = value.filter(isRecord);
  const usd = amounts.filter((amount) => amount["currency"] === "USD" && typeof amount["amount"] === "number" && Number.isFinite(amount["amount"]));
  return usd.length === 0 ? null : usd.reduce((sum, amount) => sum + Number(amount["amount"]), 0) * 100;
}

function comicProviderCostCents(runDir: string, provider: Record<string, unknown>): number | null {
  const projection = isRecord(provider["result"]) && isRecord(provider["result"]["comicAudio"])
    ? provider["result"]["comicAudio"]
    : isRecord(provider["metadata"]) && isRecord(provider["metadata"]["comicAudio"])
      ? provider["metadata"]["comicAudio"]
      : null;
  if (!projection || !isRecord(projection["selectedSuccess"]) || !Array.isArray(projection["renderHistory"])) return null;
  const selected = projection["selectedSuccess"];
  const render = projection["renderHistory"].filter(isRecord).find((candidate) => candidate["renderIdentity"] === selected["renderIdentity"]);
  if (!render || !Array.isArray(render["events"])) return null;
  const event = render["events"].filter(isRecord).find((candidate) => candidate["sequence"] === selected["eventSequence"]);
  if (!event || typeof event["providerRenderResultRef"] !== "string" || typeof provider["artifactDir"] !== "string") return null;
  const resultPath = containedArtifactPath(runDir, provider["artifactDir"], event["providerRenderResultRef"]);
  if (!resultPath || !existsSync(resultPath)) return null;
  const result = JSON.parse(readFileSync(resultPath, "utf8")) as unknown;
  if (!isRecord(result) || !isRecord(result["cost"]) || !isRecord(result["cost"]["currentComposition"])) return null;
  const current = result["cost"]["currentComposition"];
  const observed = usdCostCents(current["observed"]);
  if (observed !== null) return observed;
  return isRecord(current["planned"]) ? usdCostCents(current["planned"]["amounts"]) : null;
}

function loadComicTtsEvaluationMetadata(runDir: string, manifest: ReturnType<typeof readCanonicalManifest>): Record<string, unknown> {
  if (manifest.command !== "comic" || manifest.scope !== "single" || manifest.items.length !== 1) {
    throw new Error(`Expected one tts or comic item in ${join(runDir, "manifest.json")}; found ${manifest.command}/${manifest.scope} with ${manifest.items.length} item(s)`);
  }
  const item = manifest.items[0]!;
  const entries = item.metadata["tts"];
  if (!Array.isArray(entries) || entries.length === 0 || entries.some((entry) => !isRecord(entry))) {
    throw new Error("Canonical comic manifest is missing completed metadata.tts evaluation entries");
  }
  const costs = item.providers.filter((provider) => provider.status === "succeeded").flatMap((provider) => {
    const cost = comicProviderCostCents(runDir, provider as unknown as Record<string, unknown>);
    return cost === null || typeof provider.model !== "string"
      ? []
      : [{ provider: provider.service, model: provider.model, cost }];
  });
  const metadata = item.metadata as Record<string, unknown>;
  return {
    ...metadata,
    ...(costs.length > 0 ? { cost: { actual: { steps: costs } } } : {}),
  };
}

export function makeProviderKey(service: string, model: string): string {
  return `${service}/${model}`;
}

export function discoverAudioFiles(
  runDir: string,
  ttsEntries: TtsEntryMetadata[],
): { found: Map<string, string>; missing: string[] } {
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const entry of ttsEntries) {
    const audioPath = join(runDir, entry.audioFileName);
    if (existsSync(audioPath)) {
      found.set(makeProviderKey(entry.ttsService, entry.ttsModel), audioPath);
    } else {
      missing.push(entry.audioFileName);
    }
  }
  return { found, missing };
}

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
    throw new Error(`ffprobe failed for ${audioPath}: ${stderr.trim()}`);
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

export function computeSpeakingRate(charCount: number, durationSeconds: number): number | null {
  if (durationSeconds <= 0) {
    return null;
  }
  return charCount / durationSeconds;
}

export function buildCostLookup(manifestRecord: TtsManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = manifestRecord.metadata.cost?.actual?.steps ?? manifestRecord.metadata.cost?.estimated?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.cost !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.cost));
    }
  }
  return lookup;
}

export function buildTimingLookup(manifestRecord: TtsManifestRecord): Map<string, number> {
  const lookup = new Map<string, number>();
  const steps = manifestRecord.metadata.timing?.actual?.steps ?? manifestRecord.metadata.timing?.estimated?.steps ?? [];
  for (const step of steps) {
    if (step.provider && step.model && step.processingTimeMs !== undefined) {
      lookup.set(makeProviderKey(step.provider, step.model), Number(step.processingTimeMs));
    }
  }
  return lookup;
}

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

export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of PUNCT_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.trim().replace(/\s+/g, " ");
}

export function tokenize(text: string): string[] {
  return normalizeText(text).match(TOKEN_RE) ?? [];
}

export function levenshteinDistance(left: string[], right: string[]): number {
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
      const insertion = current[rightIndex]! + 1;
      const deletion = previous[rightIndex + 1]! + 1;
      const substitution = previous[rightIndex]! + Number(left[leftIndex] !== right[rightIndex]);
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

const LOCAL_SERVICES = new Set<string>();

export function isLocalService(ttsService: string): boolean {
  return LOCAL_SERVICES.has(ttsService);
}

export function formatCents(cents: number | null): string {
  if (cents === null) {
    return "n/a";
  }
  return `${cents.toFixed(4)}\u00A2 ($${(cents / 100).toFixed(4)})`;
}

export function formatProcessingSeconds(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "n/a";
  }
  return `${(milliseconds / 1000).toFixed(2)}s`;
}
