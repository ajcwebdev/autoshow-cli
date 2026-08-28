#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverCombinedRuns, type CombinedRunRef } from "../shared/combined_report_lib";
import {
  renderCombinedDashboard,
  type CombinedDashboardModel,
  type DashboardGroup,
  type DashboardProviderRow,
} from "../shared/combined_report_html";

type GroupKey = "local" | "thirdPartyService";
type MetricName = "price" | "speed" | "qualityScore";

const GROUPS: GroupKey[] = ["local", "thirdPartyService"];
const GROUP_LABELS: Record<GroupKey, string> = {
  local: "Local",
  thirdPartyService: "Third-Party Service",
};

interface ErrorBreakdown {
  substitutions?: number | null;
  deletions?: number | null;
  insertions?: number | null;
  referenceCount?: number | null;
}

interface ReportProviderDetail {
  providerKey?: string;
  provider?: string;
  model?: string;
  group?: string;
  processingTimeMs?: number | null;
  costCents?: number | null;
  metrics?: {
    score?: number | null;
    wer?: number | null;
    cer?: number | null;
  };
  werBreakdown?: ErrorBreakdown | null;
  cerBreakdown?: ErrorBreakdown | null;
}

interface SingleRunReport {
  runName?: string;
  runDir?: string;
  providerCount?: number;
  providerGroups?: Record<string, { count?: number; providers?: ReportProviderDetail[] }>;
}

interface OcrRunRef extends CombinedRunRef {
  pageCount: number;
}

interface ProviderSample {
  runName: string;
  group: GroupKey;
  pageCount: number;
  score: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
  werBreakdown: ErrorBreakdown | null;
  cerBreakdown: ErrorBreakdown | null;
}

interface AggregatedProvider {
  providerKey: string;
  provider: string;
  model: string;
  group: GroupKey;
  runsCovered: number;
  avgQualityScore: number | null;
  weightedWER: number | null;
  weightedCER: number | null;
  pagesPerMinute: number | null;
  avgProcessingTimeMs: number | null;
  costPer100PagesUSD: number | null;
  meanCostCents: number | null;
  totalCostCents: number | null;
  perRun: Record<string, number | null>;
}

interface RankingEntry {
  rank: number;
  providerKey: string;
  provider: string;
  model: string;
  group: GroupKey;
  metric: MetricName;
  value: number | null;
  label: string;
  runsCovered: number;
  avgQualityScore: number | null;
  weightedWER: number | null;
  weightedCER: number | null;
  pagesPerMinute: number | null;
  avgProcessingTimeMs: number | null;
  costPer100PagesUSD: number | null;
  meanCostCents: number | null;
  totalCostCents: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values: Array<number | null>): number | null {
  const present = values.filter(isFiniteNumber);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((total, value) => total + value, 0) / present.length;
}

function sum(values: Array<number | null>): number | null {
  const present = values.filter(isFiniteNumber);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((total, value) => total + value, 0);
}

function normalizeGroup(group: string | undefined): GroupKey {
  return group === "local" ? "local" : "thirdPartyService";
}

function discoverRuns(rootDir: string): OcrRunRef[] {
  return discoverCombinedRuns(rootDir, "provider-comparison-report.json").map((run) => {
    const pageMetricsPath = join(run.runDir, "page-metrics.json");
    if (!existsSync(pageMetricsPath)) {
      throw new Error(`Missing page-metrics.json in run directory ${run.runDir}`);
    }
    const pageMetrics = JSON.parse(readFileSync(pageMetricsPath, "utf8")) as { pageCount?: number };
    if (!isFiniteNumber(pageMetrics.pageCount) || pageMetrics.pageCount <= 0) {
      throw new Error(`page-metrics.json in ${run.runDir} has no positive pageCount`);
    }
    return { ...run, pageCount: pageMetrics.pageCount };
  });
}

function collectSamples(runs: OcrRunRef[]): Map<string, { provider: string; model: string; samples: ProviderSample[] }> {
  const byProvider = new Map<string, { provider: string; model: string; samples: ProviderSample[] }>();
  for (const run of runs) {
    const report = JSON.parse(readFileSync(run.reportPath, "utf8")) as SingleRunReport;
    const groups = report.providerGroups ?? {};
    for (const groupValue of Object.values(groups)) {
      for (const detail of groupValue.providers ?? []) {
        const providerKey = detail.providerKey;
        if (!providerKey) {
          continue;
        }
        const existing = byProvider.get(providerKey) ?? {
          provider: detail.provider ?? providerKey,
          model: detail.model ?? "",
          samples: [],
        };
        existing.samples.push({
          runName: run.runName,
          group: normalizeGroup(detail.group),
          pageCount: run.pageCount,
          score: detail.metrics?.score ?? null,
          processingTimeMs: detail.processingTimeMs ?? null,
          costCents: detail.costCents ?? null,
          werBreakdown: detail.werBreakdown ?? null,
          cerBreakdown: detail.cerBreakdown ?? null,
        });
        byProvider.set(providerKey, existing);
      }
    }
  }
  return byProvider;
}

function mostCommonGroup(samples: ProviderSample[]): GroupKey {
  const counts = new Map<GroupKey, number>();
  for (const sample of samples) {
    counts.set(sample.group, (counts.get(sample.group) ?? 0) + 1);
  }
  let best: GroupKey = samples[0]?.group ?? "thirdPartyService";
  let bestCount = -1;
  for (const group of GROUPS) {
    const count = counts.get(group) ?? 0;
    if (count > bestCount) {
      best = group;
      bestCount = count;
    }
  }
  return best;
}

function weightedErrorRate(samples: ProviderSample[], key: "werBreakdown" | "cerBreakdown"): number | null {
  let errors = 0;
  let references = 0;
  for (const sample of samples) {
    const breakdown = sample[key];
    if (!breakdown || !isFiniteNumber(breakdown.referenceCount) || breakdown.referenceCount <= 0) {
      continue;
    }
    errors += (breakdown.substitutions ?? 0) + (breakdown.deletions ?? 0) + (breakdown.insertions ?? 0);
    references += breakdown.referenceCount;
  }
  if (references === 0) {
    return null;
  }
  return errors / references;
}

function aggregate(
  byProvider: Map<string, { provider: string; model: string; samples: ProviderSample[] }>,
  runs: OcrRunRef[],
): AggregatedProvider[] {
  const aggregated: AggregatedProvider[] = [];
  for (const [providerKey, { provider, model, samples }] of byProvider) {
    const group = mostCommonGroup(samples);
    const perRun: Record<string, number | null> = {};
    for (const run of runs) {
      const sample = samples.find((item) => item.runName === run.runName);
      perRun[run.runName] = sample?.score ?? null;
    }
    const timedSamples = samples.filter((sample) => isFiniteNumber(sample.processingTimeMs));
    const timedPages = sum(timedSamples.map((sample) => sample.pageCount));
    const timedMs = sum(timedSamples.map((sample) => sample.processingTimeMs));
    const pagesPerMinute = timedPages !== null && timedMs !== null && timedMs > 0 ? timedPages / (timedMs / 60000) : null;
    const costedSamples = samples.filter((sample) => isFiniteNumber(sample.costCents));
    const costedPages = sum(costedSamples.map((sample) => sample.pageCount));
    const costedCents = sum(costedSamples.map((sample) => sample.costCents));
    const costPer100PagesUSD = costedPages !== null && costedPages > 0 && costedCents !== null ? costedCents / costedPages : null;
    aggregated.push({
      providerKey,
      provider,
      model,
      group,
      runsCovered: samples.length,
      avgQualityScore: mean(samples.map((sample) => sample.score)),
      weightedWER: weightedErrorRate(samples, "werBreakdown"),
      weightedCER: weightedErrorRate(samples, "cerBreakdown"),
      pagesPerMinute,
      avgProcessingTimeMs: mean(samples.map((sample) => sample.processingTimeMs)),
      costPer100PagesUSD,
      meanCostCents: mean(samples.map((sample) => sample.costCents)),
      totalCostCents: sum(samples.map((sample) => sample.costCents)),
      perRun,
    });
  }
  return aggregated;
}

function priceValue(provider: AggregatedProvider): number | null {
  if (provider.group === "local") {
    return 0;
  }
  return provider.costPer100PagesUSD;
}

function formatCostPer100Pages(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `$${value.toFixed(3)}`;
}

function formatAvgCost(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `$${(value / 100).toFixed(4)}`;
}

function formatPagesPerMinute(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return value.toFixed(1);
}

function formatTime(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `${(value / 1000).toFixed(2)}s`;
}

function formatQuality(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return value.toFixed(2);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `${(value * 100).toFixed(2)}%`;
}

function buildEntry(provider: AggregatedProvider, metric: MetricName, value: number | null, label: string, rank: number): RankingEntry {
  return {
    rank,
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    metric,
    value,
    label,
    runsCovered: provider.runsCovered,
    avgQualityScore: provider.avgQualityScore,
    weightedWER: provider.weightedWER,
    weightedCER: provider.weightedCER,
    pagesPerMinute: provider.pagesPerMinute,
    avgProcessingTimeMs: provider.avgProcessingTimeMs,
    costPer100PagesUSD: provider.costPer100PagesUSD,
    meanCostCents: provider.meanCostCents,
    totalCostCents: provider.totalCostCents,
  };
}

function rankGroup(providers: AggregatedProvider[]): Record<MetricName, RankingEntry[]> {
  const ascendingNullsLast = (value: number | null): number => (value === null ? Number.POSITIVE_INFINITY : value);
  const descendingNullsLast = (value: number | null): number => (value === null ? Number.NEGATIVE_INFINITY : value);

  const price = [...providers]
    .map((provider) => ({ provider, value: priceValue(provider) }))
    .sort((left, right) => {
      const byValue = ascendingNullsLast(left.value) - ascendingNullsLast(right.value);
      if (byValue !== 0) {
        return byValue;
      }
      const byQuality = descendingNullsLast(right.provider.avgQualityScore) - descendingNullsLast(left.provider.avgQualityScore);
      if (byQuality !== 0) {
        return byQuality;
      }
      const bySpeed = descendingNullsLast(right.provider.pagesPerMinute) - descendingNullsLast(left.provider.pagesPerMinute);
      if (bySpeed !== 0) {
        return bySpeed;
      }
      return left.provider.providerKey.localeCompare(right.provider.providerKey);
    })
    .map((item, index) => buildEntry(item.provider, "price", item.value, formatCostPer100Pages(item.value), index + 1));

  const speed = [...providers]
    .map((provider) => ({ provider, value: provider.pagesPerMinute }))
    .sort((left, right) => {
      const byValue = descendingNullsLast(right.value) - descendingNullsLast(left.value);
      if (byValue !== 0) {
        return byValue;
      }
      return left.provider.providerKey.localeCompare(right.provider.providerKey);
    })
    .map((item, index) => buildEntry(item.provider, "speed", item.value, `${formatPagesPerMinute(item.value)} pages/minute`, index + 1));

  const qualityScore = [...providers]
    .map((provider) => ({ provider, value: provider.avgQualityScore }))
    .sort((left, right) => {
      const byValue = descendingNullsLast(right.value) - descendingNullsLast(left.value);
      if (byValue !== 0) {
        return byValue;
      }
      return left.provider.providerKey.localeCompare(right.provider.providerKey);
    })
    .map((item, index) => buildEntry(item.provider, "qualityScore", item.value, `${formatQuality(item.value)}/100 avg quality score`, index + 1));

  return { price, speed, qualityScore };
}

function metricTable(entries: RankingEntry[], runCount: number): string {
  const header =
    "| Rank | Provider | Value | Coverage | Avg quality score | Weighted WER | Weighted CER | Pages/minute | Avg time/run | Cost/100 pages |\n" +
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |";
  if (entries.length === 0) {
    return `${header}\n| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |`;
  }
  const rows = entries.map(
    (entry) =>
      `| ${entry.rank} | <code>${entry.providerKey}</code> | ${entry.label} | ${entry.runsCovered}/${runCount} | ${formatQuality(entry.avgQualityScore)} | ${formatPercent(entry.weightedWER)} | ${formatPercent(entry.weightedCER)} | ${formatPagesPerMinute(entry.pagesPerMinute)} | ${formatTime(entry.avgProcessingTimeMs)} | ${formatCostPer100Pages(entry.costPer100PagesUSD)} |`,
  );
  return `${header}\n${rows.join("\n")}`;
}

function perRunMatrix(providers: AggregatedProvider[], runs: OcrRunRef[]): string {
  if (providers.length === 0 || runs.length === 0) {
    return "No providers.";
  }
  const sorted = [...providers].sort((left, right) => (right.avgQualityScore ?? -1) - (left.avgQualityScore ?? -1));
  const header = `| Provider | Mean | ${runs.map((run) => run.runName).join(" | ")} |`;
  const divider = `| --- | ---: | ${runs.map(() => "---:").join(" | ")} |`;
  const rows = sorted.map((provider) => {
    const cells = runs.map((run) => {
      const value = provider.perRun[run.runName];
      return value === null || value === undefined ? "—" : value.toFixed(2);
    });
    const meanCell = provider.avgQualityScore === null ? "—" : provider.avgQualityScore.toFixed(2);
    return `| <code>${provider.providerKey}</code> | ${meanCell} | ${cells.join(" | ")} |`;
  });
  return `${header}\n${divider}\n${rows.join("\n")}`;
}

function buildDashboardGroup(
  group: GroupKey,
  providers: AggregatedProvider[],
  runs: OcrRunRef[],
  metricRankings: Record<MetricName, RankingEntry[]>,
): DashboardGroup {
  const qualityRank = new Map(metricRankings.qualityScore.map((entry) => [entry.providerKey, entry.rank]));
  const speedRank = new Map(metricRankings.speed.map((entry) => [entry.providerKey, entry.rank]));
  const priceRank = new Map(metricRankings.price.map((entry) => [entry.providerKey, entry.rank]));
  const heatValues = providers.flatMap((provider) => runs.map((run) => provider.perRun[run.runName]).filter(isFiniteNumber));
  const heatMin = heatValues.length > 0 ? Math.min(...heatValues) : 0;
  const heatMax = heatValues.length > 0 ? Math.max(...heatValues) : 0;

  const rows: DashboardProviderRow[] = providers.map((provider) => ({
    providerKey: provider.providerKey,
    display: provider.providerKey,
    model: provider.model,
    coverage: `${provider.runsCovered}/${runs.length}`,
    quality: { display: formatQuality(provider.avgQualityScore), rank: qualityRank.get(provider.providerKey) ?? null },
    speed: { display: formatPagesPerMinute(provider.pagesPerMinute), rank: speedRank.get(provider.providerKey) ?? null },
    cost: { display: formatCostPer100Pages(priceValue(provider)), rank: priceRank.get(provider.providerKey) ?? null },
    evidence: [formatPercent(provider.weightedWER), formatPercent(provider.weightedCER), formatTime(provider.avgProcessingTimeMs)],
    perRun: runs.map((run) => {
      const value = provider.perRun[run.runName];
      if (!isFiniteNumber(value)) {
        return { display: "—", heat: null };
      }
      const heat = heatMax === heatMin ? 100 : Math.round(((value - heatMin) / (heatMax - heatMin)) * 100);
      return { display: value.toFixed(2), heat };
    }),
  }));

  return {
    key: group,
    label: GROUP_LABELS[group],
    metricColumns: { quality: "Avg quality /100", speed: "Pages/min", cost: "$/100 pages" },
    evidenceColumns: ["Weighted WER", "Weighted CER", "Avg time/run"],
    providers: rows,
  };
}

function main(): number {
  const rootRaw = process.argv[2];
  if (!rootRaw || rootRaw === "--help" || rootRaw === "-h") {
    console.log("Usage: bun scripts/ocr/build_combined_report.ts <root_dir>");
    return rootRaw ? 0 : 1;
  }
  const rootDir = resolve(rootRaw);
  const runs = discoverRuns(rootDir);
  if (runs.length === 0) {
    throw new Error(`No run subdirectories with provider-comparison-report.json found under ${rootDir}`);
  }

  const byProvider = collectSamples(runs);
  const aggregated = aggregate(byProvider, runs);
  const totalPages = runs.reduce((total, run) => total + run.pageCount, 0);

  const groupedProviders: Record<GroupKey, AggregatedProvider[]> = {
    local: aggregated.filter((provider) => provider.group === "local"),
    thirdPartyService: aggregated.filter((provider) => provider.group === "thirdPartyService"),
  };

  const metricRankings: Record<GroupKey, Record<MetricName, RankingEntry[]>> = {
    local: rankGroup(groupedProviders.local),
    thirdPartyService: rankGroup(groupedProviders.thirdPartyService),
  };

  const generatedAt = new Date().toISOString();
  const jsonReport = {
    schemaVersion: 3,
    kind: "ocr-combined-comparison-report",
    category: "ocr",
    rootDir,
    generatedAt,
    metric: "WER-derived quality score, aggregated as the unweighted mean across runs",
    runCount: runs.length,
    runs: runs.map((run) => ({ runName: run.runName, runDir: run.runDir, providerCount: run.providerCount, pageCount: run.pageCount })),
    totalPages,
    providerCount: aggregated.length,
    metricRankings,
    rankingPolicy: {
      price:
        "USD per 100 pages ascending (sum of costCents over sum of pageCount); local providers at zero; missing cost sorts last; ties break by quality descending, then pages/minute descending, then providerKey",
      speed: "aggregate pages per minute descending (sum of pageCount over sum of processing time); missing timing sorts last; ties break by providerKey",
      qualityScore: "unweighted mean quality score descending; missing score sorts last; ties break by providerKey",
    },
    notes: [
      "Each provider is aggregated by providerKey across the runs it appears in; sums and means cover present values only.",
      "Groups follow the single-run OCR contract: local, thirdPartyService; local and service providers are never ranked against each other.",
      "Weighted WER and weighted CER are evidence columns: summed breakdown errors divided by summed reference counts, so longer runs count proportionally more.",
      "Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.",
      "Supersedes the hand-authored 2026-06-14 combined report, which is preserved as a historical record.",
    ],
  };

  const jsonPath = join(rootDir, "combined-comparison-report.json");
  writeFileSync(jsonPath, JSON.stringify(jsonReport));

  const md: string[] = [];
  md.push("# Combined OCR Provider Comparison Report");
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Root directory: \`${rootDir}\``);
  md.push(`- Runs aggregated: ${runs.length} (${totalPages} pages)`);
  for (const run of runs) {
    md.push(`  - \`${run.runName}\` (${run.providerCount} providers, ${run.pageCount} page${run.pageCount === 1 ? "" : "s"})`);
  }
  md.push(`- Distinct providers: ${aggregated.length} (${groupedProviders.local.length} local, ${groupedProviders.thirdPartyService.length} third-party service)`);
  md.push(
    "- Quality aggregates the per-run WER-derived score as an unweighted mean across runs; speed and price aggregate page-weighted totals (pages per minute, USD per 100 pages).",
  );
  md.push("");
  md.push("## Method");
  md.push("");
  md.push("- Providers are matched by `providerKey` and aggregated across the runs they appear in; sums and means cover present values only.");
  md.push("- Quality Score rankings use the unweighted mean `metrics.score` descending.");
  md.push(
    "- Weighted WER and Weighted CER are evidence columns: summed errors from the corresponding breakdowns divided by summed reference counts, so longer runs count proportionally more.",
  );
  md.push("- Speed rankings use aggregate pages per minute descending: `sum(pageCount) / sum(processingTimeMs / 60000)`; missing timing sorts last.");
  md.push(
    "- Price rankings use USD per 100 pages ascending: `sum(costCents) / sum(pageCount)` (cents per page is numerically equal to dollars per 100 pages); local providers at zero; missing cost sorts last.",
  );
  md.push(
    "- Tied ranking values break deterministically: price ties by quality descending, then pages/minute descending, then provider key; speed and quality ties by provider key.",
  );
  md.push("");
  md.push("## Metric Rankings");
  md.push("");
  for (const group of GROUPS) {
    md.push(`### ${GROUP_LABELS[group]}`);
    md.push("");
    md.push("#### Price");
    md.push("");
    md.push(metricTable(metricRankings[group].price, runs.length));
    md.push("");
    md.push("#### Speed");
    md.push("");
    md.push(metricTable(metricRankings[group].speed, runs.length));
    md.push("");
    md.push("#### Quality Score");
    md.push("");
    md.push(metricTable(metricRankings[group].qualityScore, runs.length));
    md.push("");
  }
  md.push("## Per-Run Quality Score");
  md.push("");
  md.push("WER-derived quality score per provider in each run, sorted by mean.");
  md.push("");
  for (const group of GROUPS) {
    if (groupedProviders[group].length === 0) {
      continue;
    }
    md.push(`### ${GROUP_LABELS[group]}`);
    md.push("");
    md.push(perRunMatrix(groupedProviders[group], runs));
    md.push("");
  }
  md.push("## Notes");
  md.push("");
  for (const note of jsonReport.notes) {
    md.push(`- ${note}`);
  }
  md.push("");

  const markdownPath = join(rootDir, "combined-comparison-report.md");
  writeFileSync(markdownPath, md.join("\n"));

  const dashboardModel: CombinedDashboardModel = {
    title: "Combined OCR Provider Comparison",
    category: "ocr",
    generatedAt,
    rootDir,
    summaryStats: [
      { label: "Runs", value: String(runs.length) },
      { label: "Pages", value: String(totalPages) },
      { label: "Providers", value: String(aggregated.length) },
      { label: "Third-party service", value: String(groupedProviders.thirdPartyService.length) },
      { label: "Local", value: String(groupedProviders.local.length) },
    ],
    runs: runs.map((run, index) => ({
      runName: run.runName,
      shortLabel: `R${index + 1}`,
      detail: `${run.providerCount} providers, ${run.pageCount} page${run.pageCount === 1 ? "" : "s"}`,
    })),
    groups: GROUPS.map((group) =>
      buildDashboardGroup(group, groupedProviders[group], runs, metricRankings[group]),
    ),
    methodParagraphs: [
      "Providers are matched by `providerKey` and aggregated across the runs they appear in; sums and means cover present values only.",
      "Quality ranks the unweighted mean `metrics.score` descending. Speed ranks aggregate pages per minute (`sum(pageCount) / sum(processingTimeMs / 60000)`) descending. Cost ranks USD per 100 pages (`sum(costCents) / sum(pageCount)`) ascending with local providers at zero. Weighted WER/CER are evidence: summed breakdown errors over summed reference counts. Missing values sort last; ties break deterministically.",
    ],
    notes: jsonReport.notes,
  };
  const htmlPath = join(rootDir, "combined-comparison-report.html");
  writeFileSync(htmlPath, renderCombinedDashboard(dashboardModel));

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${markdownPath}`);
  console.log(`Wrote ${htmlPath}`);
  console.log(`Aggregated ${aggregated.length} providers across ${runs.length} runs (${totalPages} pages).`);
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
