#!/usr/bin/env bun

import { writePortableFileSync } from "../shared/portable_paths";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  computeProviderSegmentStats,
  durationSecondsFromManifest,
  formatCents,
  formatProcessingSeconds,
  loadProviderRuns,
  loadSttManifestRecord,
  mapProviderSpeakers,
  normalizeText,
  parseClock,
  parseReferenceTranscript,
  baseProviderKey,
  scoreNeutralViews,
  wordWerDetailed,
  resolveReferenceTranscript,
  SCORING_METHOD,
  SCORING_VERSION,
  type ErrorAttribution,
  type ReferenceSourceRecord,
} from "./transcript_lib";



interface ParsedArgs {
  runDir: string;
  referencePath: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
  preserveExisting: boolean;
}

function helpText(): string {
  return [
    "Usage: bun build_reference_report.ts <run_dir> [--reference <path>] [--markdown-out <path>] [--json-out <path>] [--preserve-existing]",
    "",
    "Generate comparison reports scoring each provider against a consensus transcript.",
    "",
    "Options:",
    "  --reference <path>      Path to consensus transcript (default: <run_dir>/consensus-transcription.txt, else the verified path in <run_dir>/reference-source.json)",
    "  --markdown-out <path>   Write markdown report to <path> (default: <run_dir>/reference-comparison-report.md)",
    "  --json-out <path>       Write JSON report to <path> (default: <run_dir>/reference-comparison-report.json)",
    "  --preserve-existing     Preserve scored rows whose result.json source is no longer present",
    "  --help, -h              Show this help message",
    "",
    "Examples:",
    "  bun build_reference_report.ts ./runs/my-episode",
    "  bun build_reference_report.ts ./runs/my-episode --reference /tmp/consensus.txt",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let referencePath: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;
  let preserveExisting = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--reference") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --reference");
      }
      referencePath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--markdown-out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --markdown-out");
      }
      markdownOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --json-out");
      }
      jsonOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--preserve-existing") {
      preserveExisting = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) {
    throw new Error(
      "Usage: bun build_reference_report.ts <run_dir> [--reference <path>] [--markdown-out <path>] [--json-out <path>]",
    );
  }

  return {
    runDir: resolve(runDir),
    referencePath,
    markdownOut,
    jsonOut,
    preserveExisting,
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function joinProviderNames(providers: Array<{ provider: string }>): string {
  const names = providers.map((provider) => `\`${provider.provider}\``);
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0]!;
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTimestampMaybe(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    return parseClock(value.replace(",", "."));
  } catch {
    return null;
  }
}

function rawWhisperMaxEndSeconds(rawResponse: unknown): number | null {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse["transcription"])) {
    return null;
  }
  let maxEndSeconds: number | null = null;
  for (const entry of rawResponse["transcription"]) {
    if (!isRecord(entry) || !isRecord(entry["timestamps"])) {
      continue;
    }
    const endSeconds = parseTimestampMaybe(entry["timestamps"]["to"]);
    if (endSeconds !== null) {
      maxEndSeconds = maxEndSeconds === null ? endSeconds : Math.max(maxEndSeconds, endSeconds);
    }
  }
  return maxEndSeconds;
}

function latestSegmentEndSeconds(segments: unknown[]): number | null {
  let latestEndSeconds: number | null = null;
  for (const segment of segments) {
    if (!isRecord(segment) || typeof segment["end"] !== "number" || !Number.isFinite(segment["end"])) {
      continue;
    }
    latestEndSeconds = latestEndSeconds === null ? segment["end"] : Math.max(latestEndSeconds, segment["end"]);
  }
  return latestEndSeconds;
}

function geminiPartLatestEndSeconds(part: unknown): number | null {
  if (!isRecord(part) || typeof part["text"] !== "string") {
    return null;
  }
  try {
    const payload = JSON.parse(part["text"]) as unknown;
    if (!isRecord(payload) || !Array.isArray(payload["segments"])) {
      return null;
    }
    return latestSegmentEndSeconds(payload["segments"]);
  } catch {
    return null;
  }
}

function rawGeminiLatestEndSeconds(rawResponse: unknown): number | null {
  if (!isRecord(rawResponse) || !Array.isArray(rawResponse["candidates"])) {
    return null;
  }
  for (const candidate of rawResponse["candidates"]) {
    if (!isRecord(candidate) || !isRecord(candidate["content"]) || !Array.isArray(candidate["content"]["parts"])) {
      continue;
    }
    for (const part of candidate["content"]["parts"]) {
      const latestEndSeconds = geminiPartLatestEndSeconds(part);
      if (latestEndSeconds !== null) {
        return latestEndSeconds;
      }
    }
  }
  return null;
}

function normalizedTextHash(text: string): string {
  return new Bun.CryptoHasher("sha256").update(normalizeText(text)).digest("hex").slice(0, 16);
}

interface DuplicateGroup {
  id: string;
  normalizedTextHash: string;
  segmentCount: number;
  providers: string[];
}

function detectDuplicateGroups<T extends { provider: string; text: string; segmentStats: { segmentCount: number } }>(
  providers: T[],
): { duplicateGroups: DuplicateGroup[]; providerGroupIds: Map<string, string> } {
  const buckets = new Map<string, { hash: string; segmentCount: number; providers: string[] }>();
  for (const provider of providers) {
    const hash = normalizedTextHash(provider.text);
    const segmentCount = provider.segmentStats.segmentCount;
    const key = `${hash}:${segmentCount}`;
    const bucket = buckets.get(key) ?? { hash, segmentCount, providers: [] };
    bucket.providers.push(provider.provider);
    buckets.set(key, bucket);
  }

  const duplicateGroups = [...buckets.values()]
    .filter((bucket) => bucket.providers.length > 1)
    .sort((left, right) => left.providers[0]!.localeCompare(right.providers[0]!))
    .map((bucket, index) => ({
      id: `duplicate-${index + 1}`,
      normalizedTextHash: bucket.hash,
      segmentCount: bucket.segmentCount,
      providers: bucket.providers.sort((left, right) => left.localeCompare(right)),
    }));
  const providerGroupIds = new Map<string, string>();
  for (const group of duplicateGroups) {
    for (const provider of group.providers) {
      providerGroupIds.set(provider, group.id);
    }
  }
  return { duplicateGroups, providerGroupIds };
}

const LOCAL_STT_SERVICES = new Set(["whisper", "whisperfile"]);
type ProviderGroup = "local" | "cloud";
type DiarizationSupport = "supported" | "not-supported";

function buildQualityWarnings(
  provider: {
    provider: string;
    providerKey: string;
    text: string;
    rawResponse: unknown;
    segmentStats: ReturnType<typeof computeProviderSegmentStats>;
    duplicateGroupId?: string;
  },
  runDurationSeconds: number,
): string[] {
  const warnings: string[] = [];
  const service = provider.providerKey.split("/")[0]?.toLowerCase() ?? "";
  const stats = provider.segmentStats;

  if (service === "gemini-stt") {
    const rawLatestEndSeconds = rawGeminiLatestEndSeconds(provider.rawResponse);
    const rawCoverageRatio = rawLatestEndSeconds !== null && runDurationSeconds > 0
      ? rawLatestEndSeconds / runDurationSeconds
      : null;
    if ((stats.durationCoverageRatio !== null && stats.durationCoverageRatio < 0.75 && stats.segmentCount > 2) || (rawCoverageRatio !== null && rawCoverageRatio < 0.75)) {
      warnings.push("Gemini generated compressed timestamps relative to the known audio duration; timing should be treated as coarse/unreliable.");
    }
  }

  if (service === "supadata" && provider.duplicateGroupId) {
    warnings.push(`Supadata output duplicates another provider artifact in ${provider.duplicateGroupId}; ranking is unchanged.`);
  }

  if (service === "whisper") {
    const rawMaxEndSeconds = rawWhisperMaxEndSeconds(provider.rawResponse);
    if ((rawMaxEndSeconds !== null && rawMaxEndSeconds > runDurationSeconds + 0.01) || (stats.lastEndSeconds !== null && stats.lastEndSeconds > runDurationSeconds + 0.01)) {
      warnings.push("Whisper timestamps exceeded the known audio duration and were clamped for normalized artifacts.");
    }
  }

  if (stats.zeroDurationSegmentCount > 0 && stats.zeroDurationSegmentCount === stats.segmentCount) {
    warnings.push("All provider segments have zero duration; timing is coarse for overlap-based speaker analysis.");
  }

  return warnings;
}

function isLocalSttProvider(provider: string, providerKey: string): boolean {
  const providerName = provider.toLowerCase();
  const serviceName = providerKey.split("/")[0]?.toLowerCase() ?? providerName;
  return LOCAL_STT_SERVICES.has(serviceName) || [...LOCAL_STT_SERVICES].some((service) => providerName === service || providerName.startsWith(`${service}-`));
}

function isKnownUnknownSpeakerLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "speaker-unknown" || normalized === "unknown" || normalized === "unk";
}

function supportsDiarization(provider: { hasSpeakerLabels: boolean | null; segments: Array<{ speaker: string }> }): boolean {
  if (provider.hasSpeakerLabels === true) {
    return true;
  }
  if (provider.hasSpeakerLabels === false) {
    return false;
  }
  return provider.segments.some((segment) => !isKnownUnknownSpeakerLabel(segment.speaker));
}

function diarizationSupportFor(supports: boolean): DiarizationSupport {
  return supports ? "supported" : "not-supported";
}

type SttMetricGroupName = "local" | "thirdPartyServiceNonDiarization" | "thirdPartyServiceDiarization";
type MetricName = "price" | "speed" | "qualityScore";

interface SttMetricProvider {
  provider: string;
  providerKey: string;
  group: ProviderGroup;
  supportsDiarization: boolean;
  diarizationSupport: DiarizationSupport;
  tokenCount: number | null;
  transcriptTextHash: string;
  segmentStats: ReturnType<typeof computeProviderSegmentStats>;
  score: number;
  speakerAwareWER: number;
  textOnlyWER: number;
  textOnlyBreakdown: {
    substitutions: number;
    deletions: number;
    insertions: number;
    referenceWordCount: number;
  };
  speakerAwareBreakdown: {
    substitutions: number;
    deletions: number;
    insertions: number;
    referenceWordCount: number;
  };
  actualProcessingTimeMs: number | null;
  actualCostCents: number | null;
  speakerPenalty: number;
  speakerMap: Record<string, string>;
  qualityWarnings: string[];
  duplicateGroupId?: string;
  settingsLabel?: string | null;
  legacyScore?: number;
  legacySpeakerAwareWER?: number;
  legacyTextOnlyWER?: number;
  legacySpeakerAwareBreakdown?: SttMetricProvider["speakerAwareBreakdown"];
  legacyTextOnlyBreakdown?: SttMetricProvider["textOnlyBreakdown"];
  errorAttribution?: ErrorAttribution;
  speakerMetrics?: SpeakerMetrics;
}

export interface SpeakerMetrics {
  referenceSpeakerCount: number;
  providerSpeakerCount: number;
  /** |provider - reference| speaker count; null when the provider does not support diarization. */
  speakerCountAbsoluteError: number | null;
  matchedWords: number;
  correctlyAttributedWords: number;
  /** Share of matched words attributed to the reference speaker; null without diarization. */
  wordAttributionAccuracy: number | null;
}

const OPTIONAL_PRESERVED_FIELDS = [
  "settingsLabel", "legacyScore", "legacySpeakerAwareWER", "legacyTextOnlyWER", "legacySpeakerAwareBreakdown",
  "legacyTextOnlyBreakdown", "errorAttribution", "speakerMetrics",
] as const;

function optionalScoringFields(source: Partial<Record<(typeof OPTIONAL_PRESERVED_FIELDS)[number], unknown>>): Record<string, unknown> {
  return Object.fromEntries(OPTIONAL_PRESERVED_FIELDS.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function preservedProviderFromRecord(value: unknown): SttMetricProvider | null {
  if (!isRecord(value) || typeof value["providerKey"] !== "string") {
    return null;
  }
  const metrics = isRecord(value["metrics"]) ? value["metrics"] : {};
  const score = finiteNumber(value["score"]) ?? finiteNumber(metrics["score"]);
  const speakerAwareWER = finiteNumber(value["speakerAwareWER"]) ?? finiteNumber(metrics["speakerAwareWER"]);
  const textOnlyWER = finiteNumber(value["textOnlyWER"]) ?? finiteNumber(metrics["textOnlyWER"]);
  if (score === null || speakerAwareWER === null || textOnlyWER === null) {
    return null;
  }
  const textOnlyBreakdown = isRecord(value["textOnlyBreakdown"])
    ? value["textOnlyBreakdown"] as SttMetricProvider["textOnlyBreakdown"]
    : { substitutions: 0, deletions: 0, insertions: 0, referenceWordCount: 0 };
  const speakerAwareBreakdown = isRecord(value["speakerAwareBreakdown"])
    ? value["speakerAwareBreakdown"] as SttMetricProvider["speakerAwareBreakdown"]
    : { substitutions: 0, deletions: 0, insertions: 0, referenceWordCount: 0 };
  const speakerMapValue = isRecord(value["speakerMap"]) ? value["speakerMap"] : {};
  const supports = value["supportsDiarization"] === true;
  const diarizationSupport: DiarizationSupport = supports ? "supported" : "not-supported";
  return {
    provider: typeof value["provider"] === "string" ? value["provider"] : value["providerKey"],
    providerKey: value["providerKey"],
    group: value["group"] === "local" ? "local" : "cloud",
    supportsDiarization: supports,
    diarizationSupport,
    tokenCount: finiteNumber(value["tokenCount"]),
    transcriptTextHash: typeof value["transcriptTextHash"] === "string" ? value["transcriptTextHash"] : "",
    segmentStats: value["segmentStats"] as ReturnType<typeof computeProviderSegmentStats>,
    score,
    speakerAwareWER,
    textOnlyWER,
    textOnlyBreakdown,
    speakerAwareBreakdown,
    actualProcessingTimeMs: finiteNumber(value["actualProcessingTimeMs"]) ?? finiteNumber(value["processingTimeMs"]),
    actualCostCents: finiteNumber(value["actualCostCents"]) ?? finiteNumber(value["costCents"]),
    speakerPenalty: finiteNumber(value["speakerPenalty"]) ?? speakerAwareWER - textOnlyWER,
    speakerMap: Object.fromEntries(Object.entries(speakerMapValue).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    qualityWarnings: Array.isArray(value["qualityWarnings"])
      ? value["qualityWarnings"].filter((warning): warning is string => typeof warning === "string")
      : [],
    ...(typeof value["duplicateGroupId"] === "string" ? { duplicateGroupId: value["duplicateGroupId"] } : {}),
    ...optionalScoringFields(value),
  };
}

function preservedProvidersFromReport(reportPath: string): SttMetricProvider[] {
  if (!existsSync(reportPath)) {
    return [];
  }
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as Record<string, unknown>;
  const groups = isRecord(report["providerGroups"]) ? report["providerGroups"] : {};
  const providers: SttMetricProvider[] = [];
  for (const groupValue of Object.values(groups)) {
    if (!isRecord(groupValue) || !Array.isArray(groupValue["providers"])) {
      continue;
    }
    for (const value of groupValue["providers"]) {
      const provider = preservedProviderFromRecord(value);
      if (provider) {
        providers.push(provider);
      }
    }
  }
  return providers;
}

interface MetricRankingEntry {
  rank: number;
  providerKey: string;
  provider: string;
  model: string | null;
  group: SttMetricGroupName;
  metric: MetricName;
  value: number | null;
  label: string;
  actualCostCents: number | null;
  processingTimeMs: number | null;
  audioDurationSeconds: number;
  realtimeFactor: number | null;
  score: number;
  speakerAwareWER: number;
  textOnlyWER: number;
  supportsDiarization: boolean;
  diarizationSupport: DiarizationSupport;
}

type SttMetricRankings = Record<SttMetricGroupName, Record<MetricName, MetricRankingEntry[]>>;

function modelFromProviderKey(providerKey: string): string | null {
  const parts = baseProviderKey(providerKey).split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : null;
}

function metricGroupForProvider(provider: { group: ProviderGroup; supportsDiarization: boolean }): SttMetricGroupName {
  if (provider.group === "local") {
    return "local";
  }
  return provider.supportsDiarization ? "thirdPartyServiceDiarization" : "thirdPartyServiceNonDiarization";
}

function compareNullableAscending(left: number | null, right: number | null): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function metricRankingEntry(
  provider: SttMetricProvider,
  rank: number,
  metric: MetricName,
  value: number | null,
  label: string,
  runDurationSeconds: number,
): MetricRankingEntry {
  return {
    rank,
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: modelFromProviderKey(provider.providerKey),
    group: metricGroupForProvider(provider),
    metric,
    value,
    label,
    actualCostCents: provider.group === "local" ? 0 : provider.actualCostCents,
    processingTimeMs: provider.actualProcessingTimeMs,
    audioDurationSeconds: runDurationSeconds,
    realtimeFactor: provider.actualProcessingTimeMs === null || provider.actualProcessingTimeMs <= 0
      ? null
      : (runDurationSeconds * 1000) / provider.actualProcessingTimeMs,
    score: provider.score,
    speakerAwareWER: provider.speakerAwareWER,
    textOnlyWER: provider.textOnlyWER,
    supportsDiarization: provider.supportsDiarization,
    diarizationSupport: provider.diarizationSupport,
  };
}

function buildMetricGroupRankings(providers: SttMetricProvider[], runDurationSeconds: number): Record<MetricName, MetricRankingEntry[]> {
  const price = [...providers]
    .sort((left, right) => {
      const leftCost = left.group === "local" ? 0 : left.actualCostCents;
      const rightCost = right.group === "local" ? 0 : right.actualCostCents;
      return compareNullableAscending(leftCost, rightCost) || left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => {
      const value = provider.group === "local" ? 0 : provider.actualCostCents;
      const label = provider.group === "local" ? "$0.00 local monetary cost" : formatCents(value);
      return metricRankingEntry(provider, index + 1, "price", value, label, runDurationSeconds);
    });

  const speed = [...providers]
    .sort((left, right) => compareNullableAscending(left.actualProcessingTimeMs, right.actualProcessingTimeMs) || left.providerKey.localeCompare(right.providerKey))
    .map((provider, index) =>
      metricRankingEntry(provider, index + 1, "speed", provider.actualProcessingTimeMs, formatProcessingSeconds(provider.actualProcessingTimeMs), runDurationSeconds)
    );

  const qualityScore = [...providers]
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.speakerAwareWER !== right.speakerAwareWER) {
        return left.speakerAwareWER - right.speakerAwareWER;
      }
      if (left.textOnlyWER !== right.textOnlyWER) {
        return left.textOnlyWER - right.textOnlyWER;
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) =>
      metricRankingEntry(provider, index + 1, "qualityScore", provider.score, `${provider.score.toFixed(2)}/100 quality score`, runDurationSeconds)
    );

  return { price, speed, qualityScore };
}

function buildMetricRankings(providers: SttMetricProvider[], runDurationSeconds: number): SttMetricRankings {
  return {
    local: buildMetricGroupRankings(providers.filter((provider) => metricGroupForProvider(provider) === "local"), runDurationSeconds),
    thirdPartyServiceNonDiarization: buildMetricGroupRankings(
      providers.filter((provider) => metricGroupForProvider(provider) === "thirdPartyServiceNonDiarization"),
      runDurationSeconds,
    ),
    thirdPartyServiceDiarization: buildMetricGroupRankings(
      providers.filter((provider) => metricGroupForProvider(provider) === "thirdPartyServiceDiarization"),
      runDurationSeconds,
    ),
  };
}

function metricRankingTable(entries: MetricRankingEntry[]): string {
  if (entries.length === 0) {
    return "| Rank | Provider | Value | Evidence |\n| ---: | --- | ---: | --- |\n| n/a | n/a | n/a | No providers in this group. |";
  }
  return [
    "| Rank | Provider | Value | Evidence |",
    "| ---: | --- | ---: | --- |",
    ...entries.map((entry) =>
      `| ${entry.rank} | \`${entry.providerKey}\` | ${entry.label} | score ${entry.score.toFixed(2)}<br>speaker-aware WER ${percentage(entry.speakerAwareWER)}<br>text-only WER ${percentage(entry.textOnlyWER)}<br>diarization ${entry.diarizationSupport}<br>time ${formatProcessingSeconds(entry.processingTimeMs)}<br>throughput ${entry.realtimeFactor === null ? "n/a" : `${entry.realtimeFactor.toFixed(2)}× realtime`}<br>cost ${formatCents(entry.actualCostCents)} |`
    ),
  ].join("\n");
}

function metricRankingsBlock(metricRankings: SttMetricRankings): string {
  return [
    "## Metric Rankings",
    "",
    "### Local",
    "",
    "#### Price",
    "",
    metricRankingTable(metricRankings.local.price),
    "",
    "#### Speed",
    "",
    metricRankingTable(metricRankings.local.speed),
    "",
    "#### Quality Score",
    "",
    metricRankingTable(metricRankings.local.qualityScore),
    "",
    "### Third-Party Service Non-Diarization",
    "",
    "#### Price",
    "",
    metricRankingTable(metricRankings.thirdPartyServiceNonDiarization.price),
    "",
    "#### Speed",
    "",
    metricRankingTable(metricRankings.thirdPartyServiceNonDiarization.speed),
    "",
    "#### Quality Score",
    "",
    metricRankingTable(metricRankings.thirdPartyServiceNonDiarization.qualityScore),
    "",
    "### Third-Party Service Diarization",
    "",
    "#### Price",
    "",
    metricRankingTable(metricRankings.thirdPartyServiceDiarization.price),
    "",
    "#### Speed",
    "",
    metricRankingTable(metricRankings.thirdPartyServiceDiarization.speed),
    "",
    "#### Quality Score",
    "",
    metricRankingTable(metricRankings.thirdPartyServiceDiarization.qualityScore),
  ].join("\n");
}

function providerDetail(provider: SttMetricProvider, runDurationSeconds: number): Record<string, unknown> {
  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: modelFromProviderKey(provider.providerKey),
    group: metricGroupForProvider(provider),
    supportsDiarization: provider.supportsDiarization,
    diarizationSupport: provider.diarizationSupport,
    tokenCount: provider.tokenCount,
    transcriptTextHash: provider.transcriptTextHash,
    segmentStats: provider.segmentStats,
    score: provider.score,
    speakerAwareWER: provider.speakerAwareWER,
    textOnlyWER: provider.textOnlyWER,
    textOnlyBreakdown: provider.textOnlyBreakdown,
    speakerAwareBreakdown: provider.speakerAwareBreakdown,
    actualProcessingTimeMs: provider.actualProcessingTimeMs,
    actualCostCents: provider.group === "local" ? 0 : provider.actualCostCents,
    audioDurationSeconds: runDurationSeconds,
    realtimeFactor: provider.actualProcessingTimeMs === null || provider.actualProcessingTimeMs <= 0
      ? null
      : (runDurationSeconds * 1000) / provider.actualProcessingTimeMs,
    speakerPenalty: provider.speakerPenalty,
    speakerMap: provider.speakerMap,
    qualityWarnings: provider.qualityWarnings,
    ...(provider.duplicateGroupId ? { duplicateGroupId: provider.duplicateGroupId } : {}),
    ...optionalScoringFields(provider),
    metrics: {
      score: provider.score,
      speakerAwareWER: provider.speakerAwareWER,
      textOnlyWER: provider.textOnlyWER,
      ...(provider.legacyScore !== undefined ? { legacyScore: provider.legacyScore } : {}),
      ...(provider.legacySpeakerAwareWER !== undefined ? { legacySpeakerAwareWER: provider.legacySpeakerAwareWER } : {}),
      ...(provider.legacyTextOnlyWER !== undefined ? { legacyTextOnlyWER: provider.legacyTextOnlyWER } : {}),
    },
  };
}

function buildProviderGroups(providers: SttMetricProvider[], runDurationSeconds: number) {
  const local = providers.filter((provider) => metricGroupForProvider(provider) === "local");
  const thirdPartyServiceNonDiarization = providers.filter(
    (provider) => metricGroupForProvider(provider) === "thirdPartyServiceNonDiarization",
  );
  const thirdPartyServiceDiarization = providers.filter(
    (provider) => metricGroupForProvider(provider) === "thirdPartyServiceDiarization",
  );
  return {
    local: { count: local.length, providers: local.map((provider) => providerDetail(provider, runDurationSeconds)) },
    thirdPartyServiceNonDiarization: {
      count: thirdPartyServiceNonDiarization.length,
      providers: thirdPartyServiceNonDiarization.map((provider) => providerDetail(provider, runDurationSeconds)),
    },
    thirdPartyServiceDiarization: {
      count: thirdPartyServiceDiarization.length,
      providers: thirdPartyServiceDiarization.map((provider) => providerDetail(provider, runDurationSeconds)),
    },
  };
}

export interface BuildReportOptions {
  /** Score only these exact provider keys (used to score a default-settings baseline row from a multi-provider run). */
  providerKeys?: ReadonlySet<string>;
}

export function buildReport(
  runDir: string,
  referencePath: string,
  preservedProviders: SttMetricProvider[] = [],
  referenceSource: ReferenceSourceRecord | null = null,
  options: BuildReportOptions = {},
) {
  const manifestRecord = loadSttManifestRecord(runDir);
  const loaded = loadProviderRuns(runDir);
  const warnings = loaded.warnings;
  const providers = options.providerKeys
    ? loaded.providers.filter((provider) => options.providerKeys!.has(provider.providerKey))
    : loaded.providers;
  if (providers.length === 0) {
    throw new Error(options.providerKeys
      ? `No succeeded provider matching ${[...options.providerKeys].join(", ")} found under ${runDir}`
      : `No providers/*/result.json files found under ${runDir}`);
  }
  const runDurationSeconds = durationSecondsFromManifest(manifestRecord, providers);
  const referenceSegments = parseReferenceTranscript(referencePath, runDurationSeconds);

  const referenceSpeakerCount = new Set(referenceSegments.map((segment) => segment.speaker)).size;
  const breakdownOf = (detail: { substitutions: number; deletions: number; insertions: number; referenceWordCount: number }) => ({
    substitutions: detail.substitutions,
    deletions: detail.deletions,
    insertions: detail.insertions,
    referenceWordCount: detail.referenceWordCount,
  });

  const scoredProviders = providers.map((provider) => {
      const speakerMap = mapProviderSpeakers(referenceSegments, provider.segments);
      const legacyTextOnly = wordWerDetailed(referenceSegments, provider.segments, false, undefined, { stripFillers: true });
      const legacySpeakerAware = wordWerDetailed(referenceSegments, provider.segments, true, speakerMap, { stripFillers: true });
      const neutral = scoreNeutralViews(
        referenceSegments,
        provider.segments,
        speakerMap,
        legacySpeakerAware.substitutions + legacySpeakerAware.deletions + legacySpeakerAware.insertions,
      );
      const textOnlyDetailed = neutral.textOnly;
      const speakerAwareDetailed = neutral.speakerAware;
      const textOnlyWer = textOnlyDetailed.wer;
      const speakerAwareWer = speakerAwareDetailed.wer;
      const segmentStats = computeProviderSegmentStats(provider, runDurationSeconds);
      const providerSupportsDiarization = supportsDiarization(provider);
      const providerSpeakerCount = new Set(
        provider.segments
          .filter((segment) => segment.text.trim() && !isKnownUnknownSpeakerLabel(segment.speaker))
          .map((segment) => segment.speaker),
      ).size;
      const speakerMetrics: SpeakerMetrics = {
        referenceSpeakerCount,
        providerSpeakerCount,
        speakerCountAbsoluteError: providerSupportsDiarization ? Math.abs(providerSpeakerCount - referenceSpeakerCount) : null,
        matchedWords: neutral.wordSpeakerAttribution.matchedWords,
        correctlyAttributedWords: neutral.wordSpeakerAttribution.correctlyAttributedWords,
        wordAttributionAccuracy: providerSupportsDiarization ? neutral.wordSpeakerAttribution.accuracy : null,
      };
      return {
        provider: provider.displayName,
        providerKey: provider.providerKey,
        group: isLocalSttProvider(provider.directoryName, provider.providerKey) ? "local" : "cloud",
        supportsDiarization: providerSupportsDiarization,
        diarizationSupport: diarizationSupportFor(providerSupportsDiarization),
        text: provider.text,
        rawResponse: provider.rawResponse,
        tokenCount: provider.tokenCount,
        transcriptTextHash: normalizedTextHash(provider.text),
        segmentStats,
        score: Math.max(0, 100 * (1 - speakerAwareWer)),
        speakerAwareWER: speakerAwareWer,
        textOnlyWER: textOnlyWer,
        textOnlyBreakdown: {
          substitutions: textOnlyDetailed.substitutions,
          deletions: textOnlyDetailed.deletions,
          insertions: textOnlyDetailed.insertions,
          referenceWordCount: textOnlyDetailed.referenceWordCount,
        },
        speakerAwareBreakdown: {
          substitutions: speakerAwareDetailed.substitutions,
          deletions: speakerAwareDetailed.deletions,
          insertions: speakerAwareDetailed.insertions,
          referenceWordCount: speakerAwareDetailed.referenceWordCount,
        },
        actualProcessingTimeMs: provider.processingTimeMs,
        actualCostCents: provider.actualCostCents,
        speakerPenalty: speakerAwareWer - textOnlyWer,
        speakerMap,
        ...(provider.settingsLabel ? { settingsLabel: provider.settingsLabel } : {}),
        legacyScore: Math.max(0, 100 * (1 - legacySpeakerAware.wer)),
        legacySpeakerAwareWER: legacySpeakerAware.wer,
        legacyTextOnlyWER: legacyTextOnly.wer,
        legacySpeakerAwareBreakdown: breakdownOf(legacySpeakerAware),
        legacyTextOnlyBreakdown: breakdownOf(legacyTextOnly),
        errorAttribution: neutral.attribution,
        speakerMetrics,
      };
    });
  const { duplicateGroups, providerGroupIds } = detectDuplicateGroups(scoredProviders);
  const providersWithQuality = scoredProviders.map((provider) => {
    const duplicateGroupId = providerGroupIds.get(provider.provider);
    const qualityWarnings = buildQualityWarnings(
      {
        provider: provider.provider,
        providerKey: provider.providerKey,
        text: provider.text,
        rawResponse: provider.rawResponse,
        segmentStats: provider.segmentStats,
        ...(duplicateGroupId ? { duplicateGroupId } : {}),
      },
      runDurationSeconds,
    );
    const { text: _text, rawResponse: _rawResponse, ...reportProvider } = provider;
    return {
      ...reportProvider,
      qualityWarnings,
      ...(duplicateGroupId ? { duplicateGroupId } : {}),
    };
  });

  const currentProviders = providersWithQuality as SttMetricProvider[];
  const reportProviders = [...new Map(
    [...preservedProviders, ...currentProviders].map((provider) => [provider.providerKey, provider]),
  ).values()];
  const rankedProviders = [...reportProviders]
    .sort((left, right) => {
      if (left.speakerAwareWER !== right.speakerAwareWER) {
        return left.speakerAwareWER - right.speakerAwareWER;
      }
      if (left.textOnlyWER !== right.textOnlyWER) {
        return left.textOnlyWER - right.textOnlyWER;
      }
      return left.provider.localeCompare(right.provider);
    })
    .map((provider, index) => ({
      ...provider,
      rank: index + 1,
    }));
  const metricRankings = buildMetricRankings(reportProviders, runDurationSeconds);
  const providerGroups = buildProviderGroups(reportProviders, runDurationSeconds);

  const bestProvider = rankedProviders[0];
  if (!bestProvider) {
    throw new Error("Could not rank providers");
  }
  const providersWithCost = rankedProviders.filter((provider) => provider.actualCostCents !== null);
  const providersWithTime = rankedProviders.filter((provider) => provider.actualProcessingTimeMs !== null);
  const largestSpeakerPenalty = [...rankedProviders].sort(
    (left, right) => right.speakerPenalty - left.speakerPenalty,
  )[0];
  if (!largestSpeakerPenalty) {
    throw new Error("Could not compute speaker penalty notes");
  }

  const notes = [
    `\`${bestProvider.provider}\` was the most accurate provider on neutral speaker-aware WER (scoring version ${SCORING_VERSION}), scoring ${bestProvider.score.toFixed(2)}/100.`,
  ];

  if (providersWithCost.length > 0) {
    const cheapestCost = Math.min(...providersWithCost.map((provider) => provider.actualCostCents as number));
    const cheapestProviders = providersWithCost.filter(
      (provider) => provider.actualCostCents === cheapestCost,
    );
    const subject = cheapestProviders.length === 1 ? "provider was" : "providers were";
    notes.push(
      `The cheapest ${subject} ${joinProviderNames(cheapestProviders)} at ${formatCents(cheapestCost)}.`,
    );
  } else {
    notes.push("Actual provider cost data was unavailable in `manifest.json`.");
  }

  if (providersWithTime.length > 0) {
    const fastestProvider = [...providersWithTime].sort(
      (left, right) => (left.actualProcessingTimeMs as number) - (right.actualProcessingTimeMs as number),
    )[0]!;
    notes.push(
      `\`${fastestProvider.provider}\` was the fastest provider in this set at ${((fastestProvider.actualProcessingTimeMs as number) / 1000).toFixed(2)}s.`,
    );
  } else {
    notes.push("Actual provider timing data was unavailable in `manifest.json`.");
  }

  const legacyScoredPreserved = reportProviders.filter((provider) => provider.legacyScore === undefined).map((provider) => provider.provider);
  if (legacyScoredPreserved.length > 0) {
    notes.push(`Preserved rows scored before scoring version 2 keep their scoring-version-1 score: ${joinProviderNames(legacyScoredPreserved.map((provider) => ({ provider })))}.`);
  }

  if (largestSpeakerPenalty.speakerPenalty > 0) {
    notes.push(
      `\`${largestSpeakerPenalty.provider}\` lost the most ground once speaker changes were counted, with ${(largestSpeakerPenalty.speakerPenalty * 100).toFixed(2)} percentage-point gap between text-only and speaker-aware WER.`,
    );
  } else {
    notes.push("No provider scored worse once speaker changes were counted.");
  }

  const reportJson = {
    runDir,
    referenceTranscriptPath: referencePath,
    ...(referenceSource ? { referenceSource } : {}),
    scoringVersion: SCORING_VERSION,
    scoringMethod: SCORING_METHOD,
    metric: SCORING_METHOD.headline,
    scoreFormula: SCORING_METHOD.scoreFormula,
	    normalization: {
	      lowercase: true,
	      contractionsExpanded: true,
	      abbreviationsExpanded: true,
	      currencySymbolsExpanded: true,
	      punctuationStripped: true,
	      fillerWordsRemoved: true,
	      neutralViews: SCORING_METHOD.views,
	    },
	    duplicateGroups,
	    providerCount: reportProviders.length,
	    audioDurationSeconds: runDurationSeconds,
	    providerGroups,
	    metricRankings,
	    notes,
  };

  const providerList = rankedProviders.map((provider) => `  - \`${provider.provider}\``).join("\n");
  const rankingRows = rankedProviders
    .map(
      (provider) =>
        `| ${provider.rank} | \`${provider.provider}\` | ${provider.score.toFixed(2)} | ${percentage(provider.speakerAwareWER)} | ${percentage(provider.textOnlyWER)} | ${formatProcessingSeconds(provider.actualProcessingTimeMs)} | ${formatCents(provider.actualCostCents)} |`,
    )
    .join("\n");
  const breakdownRows = rankedProviders
    .map(
      (provider) =>
        `| \`${provider.provider}\` | ${provider.textOnlyBreakdown.substitutions} | ${provider.textOnlyBreakdown.deletions} | ${provider.textOnlyBreakdown.insertions} | ${provider.textOnlyBreakdown.referenceWordCount} |`,
    )
    .join("\n");
  const attributionRows = rankedProviders
    .map((provider) => {
      const attribution = provider.errorAttribution;
      if (!attribution) {
        return `| \`${provider.provider}\` | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`;
      }
      return `| \`${provider.provider}\` | ${attribution.strictEdits} | ${attribution.forgivenByView.disfluency} | ${attribution.forgivenByView.orthographic} | ${attribution.forgivenByView.numberFormat} | ${attribution.neutralEdits} | ${attribution.remaining.speakerAttribution} | ${attribution.remaining.numberFormat} | ${attribution.remaining.otherLexical} |`;
    })
    .join("\n");
  const speakerRows = rankedProviders
    .map((provider) => {
      const metrics = provider.speakerMetrics;
      const accuracy = metrics?.wordAttributionAccuracy;
      return `| \`${provider.provider}\` | ${metrics?.referenceSpeakerCount ?? "n/a"} | ${metrics?.providerSpeakerCount ?? "n/a"} | ${metrics?.speakerCountAbsoluteError ?? "n/a"} | ${accuracy === null || accuracy === undefined ? "n/a" : percentage(accuracy)} | ${provider.legacyScore === undefined ? "n/a" : provider.legacyScore.toFixed(2)} | ${provider.legacySpeakerAwareWER === undefined ? "n/a" : percentage(provider.legacySpeakerAwareWER)} |`;
    })
    .join("\n");
  const qualityFlagRows = rankedProviders
    .filter((provider) => provider.qualityWarnings.length > 0)
    .map((provider) => `| \`${provider.provider}\` | ${provider.qualityWarnings.join("<br>")} |`)
    .join("\n");
  const qualityFlagsBlock = qualityFlagRows.length > 0
    ? `| Provider | Quality Flags |\n| --- | --- |\n${qualityFlagRows}`
    : "No provider quality flags were detected.";
  const notesBlock = notes.map((note) => `- ${note}`).join("\n");

  const referenceName = referencePath.split("/").at(-1) ?? referencePath;
  const markdown = `# Consensus Transcript Comparison Report

## Summary

- Reference transcript: \`${referenceName}\`
- Compared providers:
${providerList}
- Ranking metric: neutral speaker-aware word error rate (WER), scoring version ${SCORING_VERSION}
- Score formula: \`${SCORING_METHOD.scoreFormula}\`
- WER formula: \`(Substitutions + Deletions + Insertions) / Reference Word Count\`
- Cost and processing time source: actual per-provider billing and timing data from \`manifest.json\` when available

## Method

- The consolidated transcript in \`${referenceName}\` was treated as the gold reference.
- Timestamps were used to map provider speaker labels onto canonical gold speakers by segment overlap.
- Gold segment end times were derived from the next gold segment start, with the final segment ending at the run duration from \`manifest.json\`.
- Provider scoring used \`result.json.result.segments\` for all discovered providers under \`providers/\`; \`transcription.txt\` was ignored.${preservedProviders.length > 0 ? " Previously scored rows whose source result is no longer retained were preserved explicitly." : " Pre-existing comparison reports were ignored."}
${SCORING_METHOD.description.map((line) => `- ${line}`).join("\n")}
- Base text normalization applied before tokenization (all scoring versions): lowercasing, curly quote/dash normalization, contraction expansion (it's -> it is), abbreviation expansion (mr. -> mister), currency symbol conversion ($50 -> 50 dollars), filler word removal (um, uh, etc.), and remaining punctuation stripping.
- Tokenization used a word/number regex, so punctuation-only tokens were ignored.
- Text-only WER compares the provider's full ordered word stream against the gold transcript word stream.
- Speaker-aware WER compares those same ordered word streams after inserting synthetic speaker-change tokens and mapping provider speaker IDs onto canonical gold speakers by overlap.
- Metric rankings keep local, third-party non-diarization, and third-party diarization providers separate.
- Price rankings sort lower monetary cost first; local providers use zero monetary cost, and missing service price stays at the end.
- Speed rankings sort lower processing time first, with missing timing retained at the end.
- Quality Score rankings sort the existing speaker-aware WER-derived provider score highest first, with text-only WER and diarization support included as evidence.

${metricRankingsBlock(metricRankings)}

## Provider Detail

| Rank | Provider | Score / 100 | Speaker-aware WER | Text-only WER | Processing Time | Actual Cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rankingRows}

## Error Breakdown (Text-only, neutral)

| Provider | Substitutions | Deletions | Insertions | Ref. Words |
| --- | ---: | ---: | ---: | ---: |
${breakdownRows}

## Error Attribution (Speaker-aware)

| Provider | Strict Edits | Disfluency | Orthographic | Number/Format | Neutral Edits | Speaker Attribution | Residual Number/Format | Other Lexical |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${attributionRows}

## Speaker Metrics

| Provider | Ref. Speakers | Provider Speakers | Count Error | Word Attribution Accuracy | Legacy Score | Legacy Speaker-aware WER |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${speakerRows}

## Quality Flags

${qualityFlagsBlock}

## Notes

${notesBlock}
`;

  return { reportJson, markdown, warnings };
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  const { referencePath, referenceSource } = resolveReferenceTranscript(args.runDir, args.referencePath);
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "reference-comparison-report.md");
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "reference-comparison-report.json");
  const preservedProviders = args.preserveExisting ? preservedProvidersFromReport(jsonOut) : [];

  const { reportJson, markdown, warnings } = buildReport(args.runDir, referencePath, preservedProviders, referenceSource);

  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }

  writePortableFileSync(jsonOut, JSON.stringify(reportJson));
  writePortableFileSync(markdownOut, markdown);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
