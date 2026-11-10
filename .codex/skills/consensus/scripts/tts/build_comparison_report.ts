#!/usr/bin/env bun

import { writePortableFileSync } from "../shared/portable_paths";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  buildCostLookup,
  buildTimingLookup,
  computeSpeakingRate,
  discoverAudioFiles,
  formatCents,
  formatProcessingSeconds,
  isLocalService,
  loadTtsManifestRecord,
  makeProviderKey,
  probeAudio,
  roundtripWer,
  tokenize,
  type TtsEntryMetadata,
  type TtsManifestRecord,
} from "./tts_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  inputTextPath: string;
  roundtripDir: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> --input-text <path> [--roundtrip-dir <path>] [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate TTS provider comparison reports with optional roundtrip STT scoring.",
    "",
    "Options:",
    "  --input-text <path>      Path to the original input text file",
    "  --roundtrip-dir <path>   Directory containing roundtrip STT transcriptions ({audioFileName}.txt)",
    "  --markdown-out <path>    Write markdown report to <path> (default: <run_dir>/provider-comparison-report.md)",
    "  --json-out <path>        Write JSON report to <path> (default: <run_dir>/provider-comparison-report.json)",
    "  --help, -h               Show this help message",
    "",
    "Examples:",
    "  bun build_comparison_report.ts ./runs/my-tts-run --input-text ./input.txt",
    "  bun build_comparison_report.ts ./runs/my-tts-run --input-text ./input.txt --roundtrip-dir ./roundtrip",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let inputTextPath: string | null = null;
  let roundtripDir: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input-text") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --input-text");
      }
      inputTextPath = value;
      index += 1;
      continue;
    }
    if (arg === "--roundtrip-dir") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --roundtrip-dir");
      }
      roundtripDir = value;
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
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) {
    throw new Error(
      "Usage: bun build_comparison_report.ts <run_dir> --input-text <path> [--roundtrip-dir <path>] [--markdown-out <path>] [--json-out <path>]",
    );
  }
  if (!inputTextPath) {
    throw new Error("--input-text is required");
  }

  return {
    runDir: resolve(runDir),
    inputTextPath: resolve(inputTextPath),
    roundtripDir: roundtripDir ? resolve(roundtripDir) : null,
    markdownOut,
    jsonOut,
  };
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function joinProviderNames(providers: Array<{ providerKey: string }>): string {
  const names = providers.map((p) => `\`${p.providerKey}\``);
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeLowerIsBetter(value: number | null, availableValues: number[]): number {
  if (!isFiniteNumber(value)) {
    return 50;
  }
  const finiteValues = availableValues.filter(isFiniteNumber);
  if (finiteValues.length === 0) {
    return 50;
  }
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (min === max) {
    return 100;
  }
  return Math.max(0, Math.min(100, 100 * (1 - (value - min) / (max - min))));
}

function addOverallScores(providers: ProviderData[]): OverallScoredProvider[] {
  const timingValues = providers.map((provider) => provider.processingTimeMs).filter(isFiniteNumber);
  const costValues = providers
    .map((provider) => isLocalService(provider.ttsService) ? 0 : provider.costCents)
    .filter(isFiniteNumber);

  const withComponents = providers.map((provider) => {
    const costCents = isLocalService(provider.ttsService) ? 0 : provider.costCents;
    const costSource = isLocalService(provider.ttsService)
      ? "local-zero-cost"
      : provider.costCents === null
        ? "missing-cloud-cost"
        : "reported-cost";
    const accuracyScore = provider.qualityScore !== null
      ? provider.qualityScore
      : provider.roundtripWER !== null
        ? Math.max(0, 100 * (1 - provider.roundtripWER))
        : 50;
    const accuracySource: OverallComponents["accuracy"]["source"] = provider.qualityScore !== null
      ? "voice-quality"
      : provider.roundtripWER !== null
        ? "roundtrip-wer"
        : "missing-roundtrip-accuracy";
    const overallComponents: OverallComponents = {
      accuracy: {
        score: accuracyScore,
        source: accuracySource,
      },
      processingSpeed: {
        score: normalizeLowerIsBetter(provider.processingTimeMs, timingValues),
        source: provider.processingTimeMs === null ? "missing-timing" : "processing-time",
        processingTimeMs: provider.processingTimeMs,
      },
      costEfficiency: {
        score: normalizeLowerIsBetter(costCents, costValues),
        source: costSource,
        costCents,
      },
    };
    const overallScore =
      overallComponents.accuracy.score * OVERALL_WEIGHTS.accuracy +
      overallComponents.processingSpeed.score * OVERALL_WEIGHTS.processingSpeed +
      overallComponents.costEfficiency.score * OVERALL_WEIGHTS.costEfficiency;
    return {
      ...provider,
      overallScore,
      overallComponents,
    };
  });

  const overallRanks = new Map<string, number>();
  [...withComponents]
    .sort((left, right) => {
      if (left.overallScore !== right.overallScore) {
        return right.overallScore - left.overallScore;
      }
      if (left.overallComponents.accuracy.score !== right.overallComponents.accuracy.score) {
        return right.overallComponents.accuracy.score - left.overallComponents.accuracy.score;
      }
      if (left.overallComponents.processingSpeed.score !== right.overallComponents.processingSpeed.score) {
        return right.overallComponents.processingSpeed.score - left.overallComponents.processingSpeed.score;
      }
      if (left.overallComponents.costEfficiency.score !== right.overallComponents.costEfficiency.score) {
        return right.overallComponents.costEfficiency.score - left.overallComponents.costEfficiency.score;
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .forEach((provider, index) => {
      overallRanks.set(provider.providerKey, index + 1);
    });

  return withComponents.map((provider) => ({
    ...provider,
    overallRank: overallRanks.get(provider.providerKey) ?? 0,
  }));
}

type ProviderGroup = "local" | "cloud";
type TierGroupName = "local" | "thirdParty";

interface RankedProvider {
  rank: number;
  group: ProviderGroup;
  providerKey: string;
  ttsService: string;
  ttsModel: string;
  speaker: string | null;
  score: number;
  qualityScore: number | null;
  humanSpeechScore: number | null;
  roundtripWER: number | null;
  speakingRateCharsPerSec: number | null;
  durationSeconds: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
  audioFileSize: number;
  audioFileName: string;
  overallRank: number;
  overallScore: number;
  overallComponents: OverallComponents;
  tierGroup: TierGroupName;
  groupOverallRank: number;
  groupTier: TierNumber;
}

interface OverallComponents {
  accuracy: {
    score: number;
    source: "voice-quality" | "roundtrip-wer" | "missing-roundtrip-accuracy";
  };
  processingSpeed: {
    score: number;
    source: "processing-time" | "missing-timing";
    processingTimeMs: number | null;
  };
  costEfficiency: {
    score: number;
    source: "local-zero-cost" | "reported-cost" | "missing-cloud-cost";
    costCents: number | null;
  };
}

const OVERALL_WEIGHTS = {
  accuracy: 0.5,
  processingSpeed: 0.25,
  costEfficiency: 0.25,
} as const;

const TIER_METRIC = "balanced-overall";
const TIER_REMAINDER_POLICY = "bottom-tier-extra";
const TIER_METHOD = "equal-thirds-by-group-overall-rank";
const TIER_DESCRIPTIONS = {
  1: "Best balanced options across accuracy, processing speed, and cost efficiency.",
  2: "Middle options that miss Tier 1 but may have a specific accuracy, speed, or cost advantage.",
  3: "Lowest balanced options, generally weaker across the combined benchmark categories.",
} as const;

type TierNumber = 1 | 2 | 3;

interface TierCounts {
  tier1: number;
  tier2: number;
  tier3: number;
}

interface TierRankRange {
  start: number | null;
  end: number | null;
}

interface TierBreakdownProvider {
  providerKey: string;
  tierGroup: TierGroupName;
  groupOverallRank: number;
  groupTier: TierNumber;
  overallRank: number;
  overallScore: number;
  overallComponents: OverallComponents;
}

interface TierBreakdown {
  tier: TierNumber;
  label: string;
  description: string;
  rankRange: TierRankRange;
  count: number;
  providers: TierBreakdownProvider[];
}

interface TierGroup {
  count: number;
  counts: TierCounts;
  tiers: TierBreakdown[];
}

interface Tiering {
  metric: typeof TIER_METRIC;
  method: typeof TIER_METHOD;
  remainderPolicy: typeof TIER_REMAINDER_POLICY;
  groups: Record<TierGroupName, TierGroup>;
}

interface TierAnnotation {
  tierGroup: TierGroupName;
  groupOverallRank: number;
  groupTier: TierNumber;
}

type RankedProviderWithoutTier = Omit<RankedProvider, "tierGroup" | "groupOverallRank" | "groupTier">;
type ProviderData = Omit<RankedProviderWithoutTier, "rank" | "overallRank" | "overallScore" | "overallComponents">;
type OverallScoredProvider = ProviderData & Pick<RankedProvider, "overallRank" | "overallScore" | "overallComponents">;

interface VoiceQualityProvider {
  providerKey: string;
  humanSpeechScore: number | null;
  metricDetails?: {
    roundtripStt?: {
      medianWer: number | null;
    };
  };
}

interface VoiceQualityReport {
  providers?: VoiceQualityProvider[];
}

function loadVoiceQualityScores(runDir: string): Map<string, { qualityScore: number | null; medianWer: number | null }> {
  const scores = new Map<string, { qualityScore: number | null; medianWer: number | null }>();
  const reportPath = join(runDir, "voice-quality-report.json");
  if (!existsSync(reportPath)) {
    return scores;
  }
  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as VoiceQualityReport;
    for (const provider of report.providers ?? []) {
      const qualityScore = typeof provider.humanSpeechScore === "number" && Number.isFinite(provider.humanSpeechScore)
        ? provider.humanSpeechScore
        : null;
      const medianWer = typeof provider.metricDetails?.roundtripStt?.medianWer === "number"
        ? provider.metricDetails.roundtripStt.medianWer
        : null;
      scores.set(provider.providerKey, { qualityScore, medianWer });
    }
  } catch {
  }
  return scores;
}

const NATURAL_RATE_MID = 150;
const NATURAL_RATE_RANGE = 30;

function speakingRateScore(rate: number | null): number {
  if (rate === null || rate <= 0) {
    return 0;
  }
  const deviation = Math.abs(rate - NATURAL_RATE_MID) / NATURAL_RATE_RANGE;
  return Math.max(0, 1 - deviation * 0.5);
}

function tierCountsForProviderCount(count: number): TierCounts {
  if (count <= 0) {
    return { tier1: 0, tier2: 0, tier3: 0 };
  }
  if (count === 1) {
    return { tier1: 1, tier2: 0, tier3: 0 };
  }
  if (count === 2) {
    return { tier1: 1, tier2: 1, tier3: 0 };
  }
  const base = Math.floor(count / 3);
  return {
    tier1: base,
    tier2: base,
    tier3: count - base * 2,
  };
}

function tierCountForNumber(counts: TierCounts, tier: TierNumber): number {
  if (tier === 1) {
    return counts.tier1;
  }
  if (tier === 2) {
    return counts.tier2;
  }
  return counts.tier3;
}

function tierGroupForProviderGroup(group: ProviderGroup): TierGroupName {
  return group === "local" ? "local" : "thirdParty";
}

function buildTierGroup<T extends Omit<TierBreakdownProvider, keyof TierAnnotation>>(
  tierGroup: TierGroupName,
  rankedProviders: T[],
): { group: TierGroup; providerAnnotations: Map<string, TierAnnotation> } {
  const counts = tierCountsForProviderCount(rankedProviders.length);
  const providerAnnotations = new Map<string, TierAnnotation>();
  const tiers: TierBreakdown[] = [];
  let nextRank = 1;

  for (const tier of [1, 2, 3] as const) {
    const count = tierCountForNumber(counts, tier);
    const start = count > 0 ? nextRank : null;
    const end = count > 0 ? nextRank + count - 1 : null;
    const providers = rankedProviders
      .slice(nextRank - 1, nextRank - 1 + count)
      .map((provider, index) => {
        const groupOverallRank = nextRank + index;
        const annotation = { tierGroup, groupOverallRank, groupTier: tier };
        providerAnnotations.set(provider.providerKey, annotation);
        return {
          providerKey: provider.providerKey,
          ...annotation,
          overallRank: provider.overallRank,
          overallScore: provider.overallScore,
          overallComponents: provider.overallComponents,
        };
      });

    tiers.push({
      tier,
      label: `Tier ${tier}`,
      description: TIER_DESCRIPTIONS[tier],
      rankRange: { start, end },
      count,
      providers,
    });
    nextRank += count;
  }

  return { group: { count: rankedProviders.length, counts, tiers }, providerAnnotations };
}

function buildTiering<T extends Omit<TierBreakdownProvider, keyof TierAnnotation> & { group: ProviderGroup }>(
  rankedOverall: T[],
): {
  tiering: Tiering;
  providerAnnotations: Map<string, TierAnnotation>;
} {
  const local = buildTierGroup(
    "local",
    rankedOverall.filter((provider) => tierGroupForProviderGroup(provider.group) === "local"),
  );
  const thirdParty = buildTierGroup(
    "thirdParty",
    rankedOverall.filter((provider) => tierGroupForProviderGroup(provider.group) === "thirdParty"),
  );
  const providerAnnotations = new Map<string, TierAnnotation>([
    ...local.providerAnnotations,
    ...thirdParty.providerAnnotations,
  ]);
  const tiering: Tiering = {
    metric: TIER_METRIC,
    method: TIER_METHOD,
    remainderPolicy: TIER_REMAINDER_POLICY,
    groups: {
      local: local.group,
      thirdParty: thirdParty.group,
    },
  };
  return { tiering, providerAnnotations };
}

function addTierAnnotations(
  rankedProviders: RankedProviderWithoutTier[],
  providerAnnotations: Map<string, TierAnnotation>,
): RankedProvider[] {
  return rankedProviders.map((provider) => ({
    ...provider,
    ...(providerAnnotations.get(provider.providerKey) ?? {
      tierGroup: tierGroupForProviderGroup(provider.group),
      groupOverallRank: 0,
      groupTier: 3,
    }),
  }));
}

function formatRankRange(range: TierRankRange): string {
  if (range.start === null || range.end === null) {
    return "no group ranks";
  }
  if (range.start === range.end) {
    return `group rank ${range.start}`;
  }
  return `group ranks ${range.start}-${range.end}`;
}

function formatTierGroupName(group: TierGroupName): string {
  return group === "local" ? "Local" : "Third-Party";
}

type ScoringMethod = "voice-quality" | "roundtrip-wer" | "composite";

interface ProviderEvidenceContext {
  manifestRecord: TtsManifestRecord;
  inputText: string;
  roundtripDir: string | null;
  costLookup: Map<string, number>;
  timingLookup: Map<string, number>;
  voiceQualityScores: ReturnType<typeof loadVoiceQualityScores>;
  warnings: string[];
}

interface RankedReportProviders {
  local: RankedProvider[];
  cloud: RankedProvider[];
  all: RankedProvider[];
}

interface RankingTableColumns {
  quality: boolean;
  wer: boolean;
  cost: boolean;
}

interface ReportMarkdownInput {
  inputTextPath: string;
  charCount: number;
  wordCount: number;
  ranked: RankedReportProviders;
  rankedOverall: RankedProvider[];
  tiering: Tiering;
  scoringMethod: ScoringMethod;
  notes: string[];
}

function scoreFormulaFor(scoringMethod: ScoringMethod): string {
  return scoringMethod === "voice-quality"
    ? "humanSpeechScore from voice-quality-report.json (55% naturalness + 45% speech quality)"
    : scoringMethod === "roundtrip-wer"
      ? "max(0, 100 * (1 - roundtripWER))"
      : "composite: 60% speaking-rate-naturalness + 20% cost + 20% speed";
}

function scoringMethodSummary(scoringMethod: ScoringMethod): string {
  return scoringMethod === "voice-quality" ? "voice quality (human speech quality from voice-quality-report.json)" : scoringMethod === "roundtrip-wer" ? "roundtrip WER (TTS audio -> STT -> compare against original text)" : "composite (speaking rate naturalness + cost + speed)";
}

function entryRoundtripWer(entry: TtsEntryMetadata, context: ProviderEvidenceContext): number | null {
  if (context.roundtripDir === null) {
    return null;
  }
  const roundtripPath = join(context.roundtripDir, `${entry.audioFileName}.txt`);
  if (existsSync(roundtripPath)) {
    const transcribed = readFileSync(roundtripPath, "utf8").trim();
    return roundtripWer(context.inputText, transcribed);
  }
  context.warnings.push(`No roundtrip transcription found for ${entry.audioFileName}`);
  return null;
}

function compositeScore(speakingRate: number | null, costCents: number | null, processingTimeMs: number | null): number {
  const rateComponent = speakingRateScore(speakingRate) * 60;
  const costComponent = costCents !== null && costCents === 0 ? 20 : costCents !== null ? Math.max(0, 20 * (1 - costCents / 20)) : 10;
  const speedComponent = processingTimeMs !== null && processingTimeMs > 0 ? Math.max(0, 20 * (1 - processingTimeMs / 60000)) : 10;
  return rateComponent + costComponent + speedComponent;
}

function providerEvidence(entry: TtsEntryMetadata, providerKey: string, durationSeconds: number | null, context: ProviderEvidenceContext) {
  const speakingRate = durationSeconds !== null ? computeSpeakingRate(context.inputText.length, durationSeconds) : null;
  const costCents = context.costLookup.get(providerKey) ?? null;
  const processingTimeMs = context.manifestRecord.recoveredProviderKeys?.includes(providerKey)
    ? null
    : context.timingLookup.get(providerKey) ?? (isFiniteNumber(entry.processingTime) ? entry.processingTime : null);

  let wer = entryRoundtripWer(entry, context);

  const vqScores = context.voiceQualityScores.get(providerKey);
  const qualityScore = vqScores?.qualityScore ?? null;
  if (wer === null && vqScores?.medianWer !== null && vqScores?.medianWer !== undefined) {
    wer = vqScores.medianWer;
  }

  let score: number;
  if (qualityScore !== null) {
    score = qualityScore;
  } else if (wer !== null) {
    score = Math.max(0, 100 * (1 - wer));
  } else {
    score = compositeScore(speakingRate, costCents, processingTimeMs);
  }

  return {
    providerKey,
    ttsService: entry.ttsService,
    ttsModel: entry.ttsModel,
    speaker: entry.speaker ?? null,
    score,
    qualityScore,
    humanSpeechScore: qualityScore,
    roundtripWER: wer,
    speakingRateCharsPerSec: speakingRate,
    durationSeconds,
    processingTimeMs,
    costCents,
    audioFileSize: entry.audioFileSize,
    audioFileName: entry.audioFileName,
  };
}

function rankProviderGroup(group: OverallScoredProvider[], groupLabel: ProviderGroup): RankedProviderWithoutTier[] {
  return [...group]
    .sort((left, right) => {
      if (left.roundtripWER !== null && right.roundtripWER !== null) {
        if (left.roundtripWER !== right.roundtripWER) {
          return left.roundtripWER - right.roundtripWER;
        }
      }
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.providerKey.localeCompare(right.providerKey);
    })
    .map((provider, index) => ({ ...provider, group: groupLabel, rank: index + 1 }));
}

function fastestProvider(providers: RankedProvider[]): RankedProvider | null {
  return providers.length > 0
    ? [...providers].sort((a, b) => (a.processingTimeMs ?? Infinity) - (b.processingTimeMs ?? Infinity))[0]!
    : null;
}

function reportNotes(recoveredProviderKeys: string[] | undefined, ranked: RankedReportProviders, scoringMethod: ScoringMethod): string[] {
  const notes: string[] = (recoveredProviderKeys ?? []).map(key =>
    `Local recovery timing for \`${key}\` is excluded from generation speed rankings; purchased audio was reused.`,
  );

  const cloudWithCost = ranked.cloud.filter((p) => p.costCents !== null);
  if (cloudWithCost.length > 0) {
    const cheapestCost = Math.min(...cloudWithCost.map((p) => p.costCents as number));
    const cheapestProviders = cloudWithCost.filter((p) => p.costCents === cheapestCost);
    const subject = cheapestProviders.length === 1 ? "provider was" : "providers were";
    notes.push(
      `The cheapest cloud ${subject} ${joinProviderNames(cheapestProviders)} at ${formatCents(cheapestCost)}.`,
    );
  }

  const allWithTime = ranked.all.filter((p) => p.processingTimeMs !== null && p.processingTimeMs > 0);
  if (allWithTime.length > 0) {
    const fastestLocal = fastestProvider(ranked.local);
    const fastestCloud = fastestProvider(ranked.cloud);
    if (fastestLocal) {
      notes.push(
        `Fastest local model: \`${fastestLocal.providerKey}\` at ${formatProcessingSeconds(fastestLocal.processingTimeMs)}.`,
      );
    }
    if (fastestCloud) {
      notes.push(
        `Fastest cloud service: \`${fastestCloud.providerKey}\` at ${formatProcessingSeconds(fastestCloud.processingTimeMs)}.`,
      );
    }
  }

  if (scoringMethod === "voice-quality") {
    notes.push(
      "Explicit assessment evidence from voice-quality-report.json is used for separate automated and human quality rankings.",
    );
  } else if (scoringMethod === "composite") {
    notes.push(
      "No assessment evidence was available. Spoken-text accuracy and perceptual quality remain unassessed; duration, cost, and speed do not establish quality.",
    );
  }
  return notes;
}

function overallRankingTable(providers: RankedProvider[]): string {
  const headerCols = ["Rank", "Provider", "Group", "Group Rank", "Group Tier", "Overall / 100", "Accuracy", "Speed", "Cost"];
  const headerRow = `| ${headerCols.join(" | ")} |`;
  const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;
  const rows = providers
    .map((p) => {
      const cols = [
        String(p.overallRank),
        `\`${p.providerKey}\``,
        p.group,
        String(p.groupOverallRank),
        String(p.groupTier),
        p.overallScore.toFixed(2),
        p.overallComponents.accuracy.score.toFixed(2),
        p.overallComponents.processingSpeed.score.toFixed(2),
        p.overallComponents.costEfficiency.score.toFixed(2),
      ];
      return `| ${cols.join(" | ")} |`;
    })
    .join("\n");
  return `${headerRow}\n${separatorRow}\n${rows}`;
}

function rankingTableHeader(columns: RankingTableColumns): string[] {
  const headerCols = ["Rank", "Provider", "Score / 100"];
  if (columns.quality) {
    headerCols.push("Quality / 100");
  }
  if (columns.wer) {
    headerCols.push("Roundtrip WER");
  }
  headerCols.push("Speaking Rate", "Duration", "Processing Time");
  if (columns.cost) {
    headerCols.push("Cost");
  }
  return headerCols;
}

function rankingTableRow(p: RankedProvider, columns: RankingTableColumns): string {
  const cols = [
    String(p.rank),
    `\`${p.providerKey}\``,
    p.score.toFixed(2),
  ];
  if (columns.quality) {
    cols.push(p.qualityScore !== null ? p.qualityScore.toFixed(2) : "n/a");
  }
  if (columns.wer) {
    cols.push(p.roundtripWER !== null ? percentage(p.roundtripWER) : "n/a");
  }
  cols.push(
    p.speakingRateCharsPerSec !== null ? `${p.speakingRateCharsPerSec.toFixed(1)} c/s` : "n/a",
    p.durationSeconds !== null ? `${p.durationSeconds.toFixed(2)}s` : "n/a",
    formatProcessingSeconds(p.processingTimeMs),
  );
  if (columns.cost) {
    cols.push(formatCents(p.costCents));
  }
  return `| ${cols.join(" | ")} |`;
}

function rankingTable(providers: RankedProvider[], columns: RankingTableColumns): string {
  const headerCols = rankingTableHeader(columns);
  const headerRow = `| ${headerCols.join(" | ")} |`;
  const separatorRow = `| ${headerCols.map(() => "---:").join(" | ")} |`;
  const rows = providers
    .map((p) => rankingTableRow(p, columns))
    .join("\n");
  return `${headerRow}\n${separatorRow}\n${rows}`;
}

function tierBreakdownBlock(groups: Tiering["groups"]): string {
  return [
    "Tiers split local and third-party balanced overall rankings separately. When a group count is not divisible by three, the remainder is assigned to Tier 3 for that group.",
    "",
    ...(["local", "thirdParty"] as const).flatMap((groupName) => {
      const group = groups[groupName];
      return [
        `### ${formatTierGroupName(groupName)} Group (${group.count})`,
        "",
        ...group.tiers.flatMap((tier) => {
          const providerRows = tier.providers
            .map(
              (provider) =>
                `| ${provider.groupOverallRank} | ${provider.overallRank} | \`${provider.providerKey}\` | ${provider.overallScore.toFixed(2)} | ${provider.overallComponents.accuracy.score.toFixed(2)} | ${provider.overallComponents.processingSpeed.score.toFixed(2)} | ${provider.overallComponents.costEfficiency.score.toFixed(2)} |`,
            )
            .join("\n");
          return [
            `#### ${tier.label} (${formatRankRange(tier.rankRange)})`,
            "",
            tier.description,
            "",
            "| Group Rank | Overall Rank | Provider | Overall / 100 | Accuracy | Speed | Cost |",
            "| ---: | ---: | --- | ---: | ---: | ---: | ---: |",
            providerRows || "| n/a | n/a | n/a | n/a | n/a | n/a | n/a |",
            "",
          ];
        }),
        "",
      ];
    }),
  ].join("\n");
}

function rankingSection(heading: string, providers: RankedProvider[], providerList: string, columns: RankingTableColumns): string {
  if (providers.length === 0) {
    return "";
  }
  return `### ${heading} (${providers.length})

${providerList}

${rankingTable(providers, columns)}
`;
}

function methodDescriptionFor(hasQualityColumn: boolean, hasWerColumn: boolean): string {
  if (hasQualityColumn) {
    return "- Voice quality scores from voice-quality-report.json were used as the primary quality metric.\n- Human speech quality score combines naturalness (55%) and speech quality (45%) from signal analysis, prosody heuristics, and available external metrics.";
  }
  return hasWerColumn
    ? "- Roundtrip WER was computed by transcribing each provider's audio via STT and comparing against the original input text.\n- Ranking primarily uses roundtrip WER (lower is better)."
    : "- No roundtrip STT transcriptions were available.\n- Existing local/cloud ranking uses a composite score: 60% speaking rate naturalness (120-180 c/s optimal for English), 20% cost efficiency, 20% processing speed.\n- Overall ranking uses neutral 50/100 accuracy components when roundtrip WER is missing.";
}

function reportMarkdown(input: ReportMarkdownInput): string {
  const { ranked, scoringMethod } = input;
  const hasWerColumn = ranked.all.some((p) => p.roundtripWER !== null);
  const localList = ranked.local.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const cloudList = ranked.cloud.map((p) => `  - \`${p.providerKey}\``).join("\n");
  const notesBlock = input.notes.map((note) => `- ${note}`).join("\n");
  const inputFileName = basename(input.inputTextPath);
  const hasQualityColumn = ranked.all.some((p) => p.qualityScore !== null);
  const methodDescription = methodDescriptionFor(hasQualityColumn, hasWerColumn);
  const localSection = rankingSection("Local Models", ranked.local, localList, { quality: hasQualityColumn, wer: hasWerColumn, cost: false });
  const cloudSection = rankingSection("Cloud Services", ranked.cloud, cloudList, { quality: hasQualityColumn, wer: hasWerColumn, cost: true });

  return `# TTS Provider Comparison Report

## Summary

- Input text: \`${inputFileName}\` (${input.charCount} characters, ${input.wordCount} words)
- Total providers: ${ranked.all.length} (${ranked.local.length} local, ${ranked.cloud.length} cloud)
- Scoring method: ${scoringMethodSummary(scoringMethod)}
- Score formula: \`${scoreFormulaFor(scoringMethod)}\`
- Overall metric: balanced-overall (50% accuracy, 25% processing speed, 25% cost efficiency)

## Method

- Each provider in \`metadata.tts[]\` was evaluated based on its audio output.
- Audio duration was measured via ffprobe to compute speaking rate (characters per second).
- Cost and processing time were extracted from \`manifest.json\` metadata.
- Providers are separated into local models and cloud services for independent comparison.
- Overall ranking combines all providers using roundtrip WER accuracy when present, neutral 50/100 accuracy when missing, normalized processing speed, and normalized cost efficiency.
- Tier breakdown assigns local and third-party providers independently using balanced overall group rank.
${methodDescription}

## Overall Ranking

${overallRankingTable(input.rankedOverall)}

## Tier Breakdown

${tierBreakdownBlock(input.tiering.groups)}

## Ranking

${localSection}${cloudSection}
## Notes

${notesBlock}
`;
}

export async function buildReport(
  runDir: string,
  inputTextPath: string,
  roundtripDir: string | null,
) {
  const manifestRecord = loadTtsManifestRecord(runDir);
  const inputText = readFileSync(inputTextPath, "utf8").trim();
  const charCount = inputText.length;
  const wordCount = tokenize(inputText).length;
  const warnings: string[] = [];

  const { found, missing } = discoverAudioFiles(runDir, manifestRecord.metadata.tts);
  if (missing.length > 0) {
    warnings.push(`Missing audio files: ${missing.join(", ")}`);
  }

  const costLookup = buildCostLookup(manifestRecord);
  const timingLookup = buildTimingLookup(manifestRecord);
  const voiceQualityScores = loadVoiceQualityScores(runDir);
  const evidenceContext: ProviderEvidenceContext = {
    manifestRecord, inputText, roundtripDir, costLookup, timingLookup, voiceQualityScores, warnings,
  };

  const providerData: ProviderData[] = [];

  for (const entry of manifestRecord.metadata.tts) {
    const providerKey = makeProviderKey(entry.ttsService, entry.ttsModel);
    const audioPath = found.get(providerKey);

    let durationSeconds: number | null = null;
    if (audioPath) {
      try {
        const props = await probeAudio(audioPath);
        durationSeconds = props.durationSeconds;
      } catch {
        warnings.push(`ffprobe failed for ${entry.audioFileName}`);
      }
    }

    providerData.push(providerEvidence(entry, providerKey, durationSeconds, evidenceContext));
  }

  const providerDataWithOverall = addOverallScores(providerData);
  const localData = providerDataWithOverall.filter((p) => isLocalService(p.ttsService));
  const cloudData = providerDataWithOverall.filter((p) => !isLocalService(p.ttsService));

  const rankedLocal = rankProviderGroup(localData, "local");
  const rankedCloud = rankProviderGroup(cloudData, "cloud");
  const allRankedWithoutTiers = [...rankedLocal, ...rankedCloud];
  const rankedOverallWithoutTiers = [...allRankedWithoutTiers].sort((left, right) => {
    if (left.overallRank !== right.overallRank) {
      return left.overallRank - right.overallRank;
    }
    return left.providerKey.localeCompare(right.providerKey);
  });
  const { tiering, providerAnnotations } = buildTiering(rankedOverallWithoutTiers);
  const rankedLocalWithTiers = addTierAnnotations(rankedLocal, providerAnnotations);
  const rankedCloudWithTiers = addTierAnnotations(rankedCloud, providerAnnotations);
  const allRanked = [...rankedLocalWithTiers, ...rankedCloudWithTiers];
  const rankedOverall = addTierAnnotations(rankedOverallWithoutTiers, providerAnnotations);

  const hasVoiceQuality = allRanked.some((p) => p.qualityScore !== null);
  const scoringMethod: ScoringMethod = hasVoiceQuality
    ? "voice-quality"
    : roundtripDir !== null && allRanked.some((p) => p.roundtripWER !== null)
      ? "roundtrip-wer"
      : "composite";

  const ranked: RankedReportProviders = { local: rankedLocalWithTiers, cloud: rankedCloudWithTiers, all: allRanked };
  const notes = reportNotes(manifestRecord.recoveredProviderKeys, ranked, scoringMethod);

  const reportJson = {
    runDir,
    inputTextPath,
    inputTextCharCount: charCount,
    inputTextWordCount: wordCount,
    metric: "separate-evidence-metrics",
    scoreFormula: "Automated quality uses roundtrip WER accuracy; human quality uses explicit humanSpeechScore. Missing assessment evidence remains unavailable.",
    overallMetric: "balanced-overall",
    overallWeights: OVERALL_WEIGHTS,
    tiering,
    overall: { count: rankedOverall.length, providers: rankedOverall },
    local: { count: rankedLocalWithTiers.length, providers: rankedLocalWithTiers },
    cloud: { count: rankedCloudWithTiers.length, providers: rankedCloudWithTiers },
    notes,
  };

  const markdown = reportMarkdown({ inputTextPath, charCount, wordCount, ranked, rankedOverall, tiering, scoringMethod, notes });

  return { reportJson, markdown, warnings };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const markdownOut = args.markdownOut ?? resolve(args.runDir, "provider-comparison-report.md");
  const jsonOut = args.jsonOut ?? resolve(args.runDir, "provider-comparison-report.json");

  const { reportJson, markdown, warnings } = await buildReport(
    args.runDir,
    args.inputTextPath,
    args.roundtripDir,
  );

  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }

  writePortableFileSync(jsonOut, JSON.stringify(reportJson));
  writePortableFileSync(markdownOut, markdown);
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
