#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  characterErrorRateDetailed,
  clamp01,
  contentTokenCoverage,
  formatCents,
  formatPercent,
  formatSeconds,
  isLocalUrlProvider,
  LONG_SEQUENCE_DISTANCE_METHOD,
  LONG_SEQUENCE_DISTANCE_NOTE,
  loadUrlProviderRuns,
  markdownToPlainText,
  readJson,
  wordErrorRateDetailed,
} from "./url_consensus_lib.ts";

interface ParsedArgs {
  runDir: string;
  consensusPath: string | null;
  markdownOut: string | null;
  jsonOut: string | null;
  fallbackJson: string | null;
}

type ProviderGroup = "local" | "hosted";
type TierNumber = 1 | 2 | 3;

interface OverallComponents {
  accuracy: {
    score: number;
    source: "wer-cer-coverage";
    wer: number;
    cer: number;
    contentCoverage: number;
  };
  processingSpeed: {
    score: number;
    source: "processing-time" | "missing-timing";
    processingTimeMs: number | null;
  };
  costEfficiency: {
    score: number;
    source: "local-zero-cost" | "reported-cost" | "missing-hosted-cost";
    costCents: number | null;
  };
}

interface ProviderScore {
  provider: string;
  model: string;
  providerKey: string;
  group: ProviderGroup;
  directoryName: string;
  rank: number;
  groupRank: number;
  overallRank: number;
  overallScore: number;
  groupTier: TierNumber;
  wer: number;
  cer: number;
  contentCoverage: number;
  accuracyScore: number;
  wordBreakdown: {
    substitutions: number;
    deletions: number;
    insertions: number;
    referenceCount: number;
  };
  characterBreakdown: {
    substitutions: number;
    deletions: number;
    insertions: number;
    referenceCount: number;
  };
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
  distanceMethod: string;
  distanceSource: "recomputed" | "fallback";
  overallComponents: OverallComponents;
}

interface ProviderScoreSeed {
  provider: string;
  model: string;
  providerKey: string;
  group: ProviderGroup;
  directoryName: string;
  wer: number;
  cer: number;
  contentCoverage: number;
  wordBreakdown: ProviderScore["wordBreakdown"];
  characterBreakdown: ProviderScore["characterBreakdown"];
  tokenEstimate: number | null;
  processingTimeMs: number | null;
  actualCostCents: number | null;
  distanceMethod: string;
  distanceSource: "recomputed" | "fallback";
}

const OVERALL_WEIGHTS = {
  accuracy: 0.5,
  processingSpeed: 0.25,
  costEfficiency: 0.25,
} as const;

const EXACT_DISTANCE_METHOD = "exact-levenshtein";
const MIXED_DISTANCE_METHOD = "mixed-by-provider";
const UNKNOWN_FALLBACK_DISTANCE_METHOD = "unknown-fallback";

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> [--consensus <path>] [--markdown-out <path>] [--json-out <path>] [--fallback-json <path>]",
    "",
    "Generate URL provider comparison reports from a consensus extraction.",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }

  const positional: string[] = [];
  let consensusPath: string | null = null;
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;
  let fallbackJson: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--consensus") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --consensus");
      consensusPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--markdown-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --markdown-out");
      markdownOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --json-out");
      jsonOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--fallback-json") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --fallback-json");
      fallbackJson = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    positional.push(arg);
  }

  const runDir = positional[0];
  if (!runDir) throw new Error(helpText());
  return { runDir: resolve(runDir), consensusPath, markdownOut, jsonOut, fallbackJson };
}

function lowerIsBetterScore(value: number | null, values: number[], missingScore: number): number {
  if (value === null || !Number.isFinite(value)) return missingScore;
  if (values.length === 0) return 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  return clamp01(1 - ((value - min) / (max - min)));
}

function assignTiers(scores: ProviderScore[]): Map<string, TierNumber> {
  const sorted = scores.slice().sort((left, right) =>
    right.overallScore - left.overallScore || left.providerKey.localeCompare(right.providerKey)
  );
  const tiers = new Map<string, TierNumber>();
  if (sorted.length === 0) return tiers;

  const tierSize = Math.max(1, Math.ceil(sorted.length / 3));
  sorted.forEach((score, index) => {
    const tier = Math.min(3, Math.floor(index / tierSize) + 1) as TierNumber;
    tiers.set(score.providerKey, tier);
  });
  return tiers;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function groupFromValue(value: unknown): ProviderGroup {
  return value === "local" ? "local" : "hosted";
}

function metricRecord(entry: Record<string, unknown>): Record<string, unknown> {
  return record(entry.metrics) ?? entry;
}

function fallbackDistanceMethod(report: Record<string, unknown>, providerKey: string): string {
  const normalization = record(report.normalization);
  const providerMethods = record(normalization?.providerLongSequenceDistance);
  const providerMethod = providerMethods?.[providerKey];
  if (typeof providerMethod === "string" && providerMethod.length > 0) return providerMethod;
  const reportMethod = normalization?.longSequenceDistance;
  return typeof reportMethod === "string" && reportMethod.length > 0
    ? reportMethod
    : UNKNOWN_FALLBACK_DISTANCE_METHOD;
}

function loadFallbackScoreSeeds(path: string | null, existingKeys: Set<string>): ProviderScoreSeed[] {
  if (!path || !existsSync(path)) return [];
  const report = readJson<Record<string, unknown>>(path);
  const providerGroups = record(report.providerGroups);
  const groupedProviders = [
    ...(Array.isArray(record(providerGroups?.local)?.providers) ? record(providerGroups?.local)?.providers as unknown[] : []),
    ...(Array.isArray(record(providerGroups?.service)?.providers) ? record(providerGroups?.service)?.providers as unknown[] : []),
    ...(Array.isArray(record(providerGroups?.hosted)?.providers) ? record(providerGroups?.hosted)?.providers as unknown[] : []),
  ];
  const rawProviders = groupedProviders.length > 0
    ? groupedProviders
    : Array.isArray(report.providers)
      ? report.providers
      : [];

  return rawProviders.flatMap((raw) => {
    const entry = record(raw);
    if (!entry) return [];
    const provider = typeof entry.provider === "string" ? entry.provider : null;
    const model = typeof entry.model === "string" ? entry.model : provider;
    const providerKey = typeof entry.providerKey === "string"
      ? entry.providerKey
      : provider && model
        ? model === provider ? provider : `${provider}/${model}`
        : null;
    if (!provider || !model || !providerKey || existingKeys.has(providerKey)) return [];

    const metrics = metricRecord(entry);
    const wer = finiteNumber(metrics.wer);
    const cer = finiteNumber(metrics.cer);
    const contentCoverage = finiteNumber(metrics.contentCoverage);
    if (wer === null || cer === null || contentCoverage === null) return [];

    return [{
      provider,
      model,
      providerKey,
      group: groupFromValue(entry.group),
      directoryName: providerKey,
      wer,
      cer,
      contentCoverage,
      wordBreakdown: record(entry.wordBreakdown) as ProviderScore["wordBreakdown"] ?? {
        substitutions: -1,
        deletions: -1,
        insertions: -1,
        referenceCount: -1,
      },
      characterBreakdown: record(entry.characterBreakdown) as ProviderScore["characterBreakdown"] ?? {
        substitutions: -1,
        deletions: -1,
        insertions: -1,
        referenceCount: -1,
      },
      tokenEstimate: finiteNumber(entry.tokenEstimate),
      processingTimeMs: finiteNumber(entry.processingTimeMs),
      actualCostCents: finiteNumber(entry.actualCostCents) ?? finiteNumber(entry.costCents),
      distanceMethod: fallbackDistanceMethod(report, providerKey),
      distanceSource: "fallback",
    } satisfies ProviderScoreSeed];
  });
}

function buildScores(consensusText: string, runDir: string, fallbackReportPath: string | null): ProviderScore[] {
  let providers: ReturnType<typeof loadUrlProviderRuns> = [];
  try {
    providers = loadUrlProviderRuns(runDir);
  } catch (error) {
    if (!fallbackReportPath || !existsSync(fallbackReportPath)) {
      throw error;
    }
  }
  const seeds: ProviderScoreSeed[] = providers.map((provider) => {
    const wer = wordErrorRateDetailed(consensusText, provider.text);
    const cer = characterErrorRateDetailed(consensusText, provider.text);
    const contentCoverage = contentTokenCoverage(consensusText, provider.text);
    return {
      provider: provider.provider,
      model: provider.model,
      providerKey: provider.providerKey,
      group: isLocalUrlProvider(provider.provider) ? "local" : "hosted",
      directoryName: provider.directoryName,
      wer: wer.rate,
      cer: cer.rate,
      contentCoverage,
      wordBreakdown: {
        substitutions: wer.substitutions,
        deletions: wer.deletions,
        insertions: wer.insertions,
        referenceCount: wer.referenceCount,
      },
      characterBreakdown: {
        substitutions: cer.substitutions,
        deletions: cer.deletions,
        insertions: cer.insertions,
        referenceCount: cer.referenceCount,
      },
      tokenEstimate: provider.tokenEstimate,
      processingTimeMs: provider.processingTimeMs,
      actualCostCents: provider.actualCostCents,
      distanceMethod: wer.substitutions === -1 || cer.substitutions === -1
        ? LONG_SEQUENCE_DISTANCE_METHOD
        : EXACT_DISTANCE_METHOD,
      distanceSource: "recomputed",
    };
  });
  const artifactProviderKeys = new Set(seeds.map((seed) => seed.providerKey));
  seeds.push(...loadFallbackScoreSeeds(fallbackReportPath, artifactProviderKeys));

  const timingValues = seeds
    .map((provider) => provider.processingTimeMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const hostedCostValues = seeds
    .filter((provider) => provider.group === "hosted")
    .map((provider) => provider.actualCostCents)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const initial = seeds.map((provider) => {
    const group = provider.group;
    const accuracyScore = clamp01((1 - provider.wer) * 0.5 + (1 - provider.cer) * 0.25 + provider.contentCoverage * 0.25);
    const speedScore = lowerIsBetterScore(provider.processingTimeMs, timingValues, 0);
    const costScore = group === "local"
      ? 1
      : lowerIsBetterScore(provider.actualCostCents, hostedCostValues, 0);
    const overallScore = clamp01(
      accuracyScore * OVERALL_WEIGHTS.accuracy
      + speedScore * OVERALL_WEIGHTS.processingSpeed
      + costScore * OVERALL_WEIGHTS.costEfficiency,
    );

    return {
      provider: provider.provider,
      model: provider.model,
      providerKey: provider.providerKey,
      group,
      directoryName: provider.directoryName,
      rank: 0,
      groupRank: 0,
      overallRank: 0,
      overallScore,
      groupTier: 3 as TierNumber,
      wer: provider.wer,
      cer: provider.cer,
      contentCoverage: provider.contentCoverage,
      accuracyScore,
      wordBreakdown: provider.wordBreakdown,
      characterBreakdown: provider.characterBreakdown,
      tokenEstimate: provider.tokenEstimate,
      processingTimeMs: provider.processingTimeMs,
      actualCostCents: provider.actualCostCents,
      distanceMethod: provider.distanceMethod,
      distanceSource: provider.distanceSource,
      overallComponents: {
        accuracy: {
          score: accuracyScore,
          source: "wer-cer-coverage",
          wer: provider.wer,
          cer: provider.cer,
          contentCoverage: provider.contentCoverage,
        },
        processingSpeed: {
          score: speedScore,
          source: provider.processingTimeMs === null ? "missing-timing" : "processing-time",
          processingTimeMs: provider.processingTimeMs,
        },
        costEfficiency: {
          score: costScore,
          source: group === "local"
            ? "local-zero-cost"
            : provider.actualCostCents === null
              ? "missing-hosted-cost"
              : "reported-cost",
          costCents: provider.actualCostCents,
        },
      },
    } satisfies ProviderScore;
  });

  const overall = initial.slice().sort((left, right) =>
    right.overallScore - left.overallScore || left.wer - right.wer || left.providerKey.localeCompare(right.providerKey)
  );
  overall.forEach((score, index) => {
    score.overallRank = index + 1;
  });

  const accuracyRanked = initial.slice().sort((left, right) =>
    left.wer - right.wer || left.cer - right.cer || right.contentCoverage - left.contentCoverage || left.providerKey.localeCompare(right.providerKey)
  );
  accuracyRanked.forEach((score, index) => {
    score.rank = index + 1;
  });

  for (const group of ["local", "hosted"] as const) {
    const groupScores = initial
      .filter((score) => score.group === group)
      .sort((left, right) => right.overallScore - left.overallScore || left.providerKey.localeCompare(right.providerKey));
    const tiers = assignTiers(groupScores);
    groupScores.forEach((score, index) => {
      score.groupRank = index + 1;
      score.groupTier = tiers.get(score.providerKey) ?? 3;
    });
  }

  return initial.sort((left, right) => left.overallRank - right.overallRank);
}

function distanceNotes(scores: ProviderScore[]): string[] {
  const notes: string[] = [];
  if (scores.some((score) => score.distanceMethod === LONG_SEQUENCE_DISTANCE_METHOD)) {
    notes.push(LONG_SEQUENCE_DISTANCE_NOTE);
  }
  const fallbackMethods = [...new Set(
    scores
      .filter((score) => score.distanceSource === "fallback")
      .map((score) => score.distanceMethod),
  )].sort();
  if (fallbackMethods.length > 0) {
    notes.push(`Fallback provider rows retain their source distance method: ${fallbackMethods.join(", ")}.`);
  }
  return notes;
}

function distanceNormalization(scores: ProviderScore[]): Record<string, unknown> {
  const providerLongSequenceDistance = Object.fromEntries(
    scores.map((score) => [score.providerKey, score.distanceMethod]),
  );
  const longSequenceDistanceMethods = [...new Set(
    scores
      .map((score) => score.distanceMethod)
      .filter((method) => method !== EXACT_DISTANCE_METHOD),
  )].sort();
  return {
    exactLevenshteinElementLimit: 10_000,
    longSequenceDistance: longSequenceDistanceMethods.length === 0
      ? null
      : longSequenceDistanceMethods.length === 1
        ? longSequenceDistanceMethods[0]
        : MIXED_DISTANCE_METHOD,
    longSequenceDistanceMethods,
    providerLongSequenceDistance,
  };
}

function markdownTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function providerRows(scores: ProviderScore[], includeCost: boolean): string[][] {
  return scores.map((score) => [
    String(score.overallRank),
    score.provider,
    formatPercent(score.wer),
    formatPercent(score.cer),
    formatPercent(score.contentCoverage),
    formatSeconds(score.processingTimeMs),
    ...(includeCost ? [formatCents(score.actualCostCents)] : []),
    score.overallScore.toFixed(4),
    `Tier ${score.groupTier}`,
  ]);
}

function buildMarkdownReport(runDir: string, consensusPath: string, scores: ProviderScore[]): string {
  const localScores = scores.filter((score) => score.group === "local").sort((left, right) => left.groupRank - right.groupRank);
  const hostedScores = scores.filter((score) => score.group === "hosted").sort((left, right) => left.groupRank - right.groupRank);
  const best = scores[0];
  const worst = scores.at(-1);
  const notes: string[] = [];
  if (scores.some((score) => score.processingTimeMs === null)) notes.push("Some providers are missing timing data.");
  if (hostedScores.some((score) => score.actualCostCents === null)) notes.push("Some hosted providers are missing actual cost data.");
  notes.push(...distanceNotes(scores));

  return [
    "# URL Provider Comparison Report",
    "",
    `Run directory: \`${runDir}\``,
    `Consensus extraction: \`${consensusPath}\``,
    `Providers scored: ${scores.length}`,
    ...(best ? [`Best overall: ${best.provider} (${best.overallScore.toFixed(4)})`] : []),
    ...(worst ? [`Worst overall: ${worst.provider} (${worst.overallScore.toFixed(4)})`] : []),
    "",
    "## Overall Ranking",
    "",
    markdownTable(
      ["Rank", "Provider", "WER", "CER", "Coverage", "Time", "Cost", "Overall", "Tier"],
      providerRows(scores, true),
    ),
    "",
    "## Local Providers",
    "",
    localScores.length > 0
      ? markdownTable(["Rank", "Provider", "WER", "CER", "Coverage", "Time", "Overall", "Tier"], providerRows(localScores, false))
      : "No local providers were scored.",
    "",
    "## Hosted Providers",
    "",
    hostedScores.length > 0
      ? markdownTable(["Rank", "Provider", "WER", "CER", "Coverage", "Time", "Cost", "Overall", "Tier"], providerRows(hostedScores, true))
      : "No hosted providers were scored.",
    "",
    "## Tier Breakdown",
    "",
    ...([1, 2, 3] as const).map((tier) => {
      const tierProviders = scores.filter((score) => score.groupTier === tier).map((score) => score.provider).join(", ") || "None";
      return `Tier ${tier}: ${tierProviders}`;
    }),
    "",
    "## Notes",
    "",
    notes.length > 0 ? notes.map((note) => `- ${note}`).join("\n") : "No missing cost or timing data detected.",
    "",
  ].join("\n");
}

function buildTiering(scores: ProviderScore[]): Record<ProviderGroup, Record<string, string[]>> {
  const result: Record<ProviderGroup, Record<string, string[]>> = {
    local: { tier1: [], tier2: [], tier3: [] },
    hosted: { tier1: [], tier2: [], tier3: [] },
  };
  for (const score of scores) {
    result[score.group][`tier${score.groupTier}`]?.push(score.providerKey);
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const consensusPath = args.consensusPath ?? resolve(args.runDir, "consensus-extraction.txt");
if (!existsSync(consensusPath)) {
  throw new Error(`Consensus extraction not found: ${consensusPath}`);
}

const consensusText = markdownToPlainText(readFileSync(consensusPath, "utf8"));
const markdownOut = args.markdownOut ?? resolve(args.runDir, "provider-comparison-report.md");
const jsonOut = args.jsonOut ?? resolve(args.runDir, "provider-comparison-report.json");
const fallbackReportPath = args.fallbackJson
  ? args.fallbackJson
  : existsSync(jsonOut)
    ? jsonOut
    : null;
const scores = buildScores(consensusText, args.runDir, fallbackReportPath);
const markdownReport = buildMarkdownReport(args.runDir, consensusPath, scores);
const jsonReport = {
  schemaVersion: 1,
  kind: "url-provider-comparison",
  runDir: args.runDir,
  runName: basename(args.runDir),
  consensusPath,
  generatedAt: new Date().toISOString(),
  providerCount: scores.length,
  normalization: distanceNormalization(scores),
  notes: distanceNotes(scores),
  overallMetric: "balanced-url-extraction",
  overallWeights: OVERALL_WEIGHTS,
  providers: scores,
  overall: scores.map((score) => ({
    rank: score.overallRank,
    provider: score.provider,
    model: score.model,
    providerKey: score.providerKey,
    group: score.group,
    overallScore: score.overallScore,
    overallComponents: score.overallComponents,
  })),
  tiering: {
    metric: "balanced-url-extraction",
    method: "equal-thirds-by-provider-group",
    groups: buildTiering(scores),
  },
};

writeFileSync(markdownOut, markdownReport);
writeFileSync(jsonOut, `${JSON.stringify(jsonReport, null, 2)}\n`);

console.log(`Wrote ${markdownOut}`);
console.log(`Wrote ${jsonOut}`);
