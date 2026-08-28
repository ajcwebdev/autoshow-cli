#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { discoverCombinedRuns } from "../shared/combined_report_lib";
import {
  renderCombinedDashboard,
  type CombinedDashboardModel,
  type DashboardGroup,
  type DashboardProviderRow,
} from "../shared/combined_report_html";

type GroupKey = "local" | "thirdPartyServiceNonDiarization" | "thirdPartyServiceDiarization";
type MetricName = "price" | "speed" | "qualityScore";

const GROUPS: GroupKey[] = ["local", "thirdPartyServiceNonDiarization", "thirdPartyServiceDiarization"];
const GROUP_LABELS: Record<GroupKey, string> = {
  local: "Local",
  thirdPartyServiceNonDiarization: "Third-Party Service Non-Diarization",
  thirdPartyServiceDiarization: "Third-Party Service Diarization",
};

interface ReportProviderDetail {
  providerKey?: string;
  provider?: string;
  model?: string;
  group?: string;
  processingTimeMs?: number | null;
  actualProcessingTimeMs?: number | null;
  costCents?: number | null;
  actualCostCents?: number | null;
  audioDurationSeconds?: number | null;
  realtimeFactor?: number | null;
  supportsDiarization?: boolean | null;
  diarizationSupport?: string | null;
  metrics?: {
    score?: number | null;
    speakerAwareWER?: number | null;
    textOnlyWER?: number | null;
  };
}

interface SingleRunReport {
  runName?: string;
  runDir?: string;
  providerCount?: number;
  providerGroups?: Record<string, { count?: number; providers?: ReportProviderDetail[] }>;
}

type RunRef = ReturnType<typeof discoverCombinedRuns>[number];

interface ProviderSample {
  runName: string;
  group: GroupKey;
  score: number | null;
  speakerAwareWER: number | null;
  textOnlyWER: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
  audioDurationSeconds: number | null;
  realtimeFactor: number | null;
  supportsDiarization: boolean | null;
  diarizationSupport: string | null;
}

interface AggregatedProvider {
  providerKey: string;
  provider: string;
  model: string;
  group: GroupKey;
  runsCovered: number;
  meanQualityScore: number | null;
  meanSpeakerAwareWER: number | null;
  meanTextOnlyWER: number | null;
  meanProcessingTimeMs: number | null;
  aggregateRealtimeFactor: number | null;
  meanCostCents: number | null;
  totalCostCents: number | null;
  supportsDiarization: boolean | null;
  diarizationSupport: string | null;
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
  meanQualityScore: number | null;
  meanSpeakerAwareWER: number | null;
  meanTextOnlyWER: number | null;
  meanProcessingTimeMs: number | null;
  aggregateRealtimeFactor: number | null;
  meanCostCents: number | null;
  totalCostCents: number | null;
  supportsDiarization: boolean | null;
  diarizationSupport: string | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values: Array<number | null>): number | null {
  const present = values.filter(isFiniteNumber);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function sum(values: Array<number | null>): number | null {
  const present = values.filter(isFiniteNumber);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((acc, value) => acc + value, 0);
}

function normalizeGroup(group: string | undefined): GroupKey {
  if (group === "local" || group === "thirdPartyServiceNonDiarization" || group === "thirdPartyServiceDiarization") {
    return group;
  }
  return "thirdPartyServiceNonDiarization";
}

function discoverRuns(rootDir: string): RunRef[] {
  return discoverCombinedRuns(rootDir, "reference-comparison-report.json");
}

function collectSamples(runs: RunRef[]): Map<string, { provider: string; model: string; samples: ProviderSample[] }> {
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
          score: detail.metrics?.score ?? null,
          speakerAwareWER: detail.metrics?.speakerAwareWER ?? null,
          textOnlyWER: detail.metrics?.textOnlyWER ?? null,
          processingTimeMs: detail.actualProcessingTimeMs ?? detail.processingTimeMs ?? null,
          costCents: detail.actualCostCents ?? detail.costCents ?? null,
          audioDurationSeconds: detail.audioDurationSeconds ?? null,
          realtimeFactor: detail.realtimeFactor ?? null,
          supportsDiarization: detail.supportsDiarization ?? null,
          diarizationSupport: detail.diarizationSupport ?? null,
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
  let best: GroupKey = samples[0]?.group ?? "thirdPartyServiceNonDiarization";
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

function aggregate(
  byProvider: Map<string, { provider: string; model: string; samples: ProviderSample[] }>,
  runs: RunRef[],
): AggregatedProvider[] {
  const aggregated: AggregatedProvider[] = [];
  for (const [providerKey, { provider, model, samples }] of byProvider) {
    const group = mostCommonGroup(samples);
    const latest = samples[samples.length - 1];
    const perRun: Record<string, number | null> = {};
    for (const run of runs) {
      const sample = samples.find((item) => item.runName === run.runName);
      perRun[run.runName] = sample?.score ?? null;
    }
    aggregated.push({
      providerKey,
      provider,
      model,
      group,
      runsCovered: samples.length,
      meanQualityScore: mean(samples.map((sample) => sample.score)),
      meanSpeakerAwareWER: mean(samples.map((sample) => sample.speakerAwareWER)),
      meanTextOnlyWER: mean(samples.map((sample) => sample.textOnlyWER)),
      meanProcessingTimeMs: mean(samples.map((sample) => sample.processingTimeMs)),
      aggregateRealtimeFactor: (() => {
        const timed = samples.filter((sample) => isFiniteNumber(sample.processingTimeMs) && sample.processingTimeMs > 0);
        const durationSeconds = sum(timed.map((sample) => sample.audioDurationSeconds));
        const processingTimeMs = sum(timed.map((sample) => sample.processingTimeMs));
        if (durationSeconds !== null && processingTimeMs !== null && processingTimeMs > 0) {
          return (durationSeconds * 1000) / processingTimeMs;
        }
        return mean(samples.map((sample) => sample.realtimeFactor));
      })(),
      meanCostCents: mean(samples.map((sample) => sample.costCents)),
      totalCostCents: sum(samples.map((sample) => sample.costCents)),
      supportsDiarization: latest?.supportsDiarization ?? null,
      diarizationSupport: latest?.diarizationSupport ?? null,
      perRun,
    });
  }
  return aggregated;
}

function priceValue(provider: AggregatedProvider): number | null {
  if (provider.group === "local") {
    return 0;
  }
  return provider.meanCostCents;
}

function formatPrice(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  if (value === 0) {
    return "$0.00";
  }
  return `$${(value / 100).toFixed(4)}`;
}

function formatSpeed(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `${(value / 1000).toFixed(2)}s`;
}

function formatQuality(value: number | null): string {
  if (value === null) {
    return "n/a";
  }
  return `${value.toFixed(2)}/100 quality score`;
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
    meanQualityScore: provider.meanQualityScore,
    meanSpeakerAwareWER: provider.meanSpeakerAwareWER,
    meanTextOnlyWER: provider.meanTextOnlyWER,
    meanProcessingTimeMs: provider.meanProcessingTimeMs,
    aggregateRealtimeFactor: provider.aggregateRealtimeFactor,
    meanCostCents: provider.meanCostCents,
    totalCostCents: provider.totalCostCents,
    supportsDiarization: provider.supportsDiarization,
    diarizationSupport: provider.diarizationSupport,
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
      const byQuality = descendingNullsLast(right.provider.meanQualityScore) - descendingNullsLast(left.provider.meanQualityScore);
      if (byQuality !== 0) {
        return byQuality;
      }
      return left.provider.providerKey.localeCompare(right.provider.providerKey);
    })
    .map((item, index) => buildEntry(item.provider, "price", item.value, formatPrice(item.value), index + 1));

  const speed = [...providers]
    .map((provider) => ({ provider, value: provider.meanProcessingTimeMs }))
    .sort((left, right) => {
      const byValue = ascendingNullsLast(left.value) - ascendingNullsLast(right.value);
      if (byValue !== 0) {
        return byValue;
      }
      return left.provider.providerKey.localeCompare(right.provider.providerKey);
    })
    .map((item, index) => buildEntry(item.provider, "speed", item.value, formatSpeed(item.value), index + 1));

  const qualityScore = [...providers]
    .map((provider) => ({ provider, value: provider.meanQualityScore }))
    .sort((left, right) => {
      const byValue = descendingNullsLast(right.value) - descendingNullsLast(left.value);
      if (byValue !== 0) {
        return byValue;
      }
      return left.provider.providerKey.localeCompare(right.provider.providerKey);
    })
    .map((item, index) => buildEntry(item.provider, "qualityScore", item.value, formatQuality(item.value), index + 1));

  return { price, speed, qualityScore };
}

function metricTable(entries: RankingEntry[]): string {
  const header =
    "| Rank | Provider | Value | Runs | Mean Score / 100 | Mean Speaker-aware WER | Mean Text-only WER | Diarization | Mean Speed | Throughput | Mean Cost |\n" +
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |";
  if (entries.length === 0) {
    return `${header}\n| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |`;
  }
  const rows = entries.map((entry) => {
    const diar = entry.supportsDiarization === null ? "n/a" : entry.diarizationSupport ?? (entry.supportsDiarization ? "supported" : "unsupported");
    return `| ${entry.rank} | <code>${entry.provider}</code> | ${entry.label} | ${entry.runsCovered} | ${entry.meanQualityScore === null ? "n/a" : entry.meanQualityScore.toFixed(2)} | ${formatPercent(entry.meanSpeakerAwareWER)} | ${formatPercent(entry.meanTextOnlyWER)} | ${diar} | ${formatSpeed(entry.meanProcessingTimeMs)} | ${entry.aggregateRealtimeFactor === null ? "n/a" : `${entry.aggregateRealtimeFactor.toFixed(2)}×`} | ${formatPrice(entry.meanCostCents)} |`;
  });
  return `${header}\n${rows.join("\n")}`;
}

function benchmarkSummaryRankingTable(
  entries: RankingEntry[],
  value: (entry: RankingEntry) => string,
  totalRuns: number,
): string {
  if (entries.length === 0) {
    return "_Unavailable: no entries are present in the current STT report files._";
  }
  return [
    "| Rank | Provider/model | Runs | Average |",
    "| ---: | --- | ---: | ---: |",
    ...entries.map((entry) => `| ${entry.rank} | ${entry.providerKey} | ${entry.runsCovered}/${totalRuns} runs | ${value(entry)} |`),
  ].join("\n");
}

function sttSummaryIdentity(rootDir: string): { slug: string; heading: string } {
  const slug = basename(rootDir);
  if (slug === "stt-with-speakers") {
    return { slug, heading: "STT With Speakers" };
  }
  if (slug === "stt-without-speakers") {
    return { slug, heading: "STT Without Speakers" };
  }
  return { slug: slug || "stt", heading: "STT" };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface InventoryRow {
  slug: string;
  reports: number;
  rows: number;
  groups: string;
}

function parseInventoryRows(summary: string): InventoryRow[] {
  const rows: InventoryRow[] = [];
  const pattern = /^\| ([a-z0-9-]+) +\| +(\d+) +\| +(\d+) +\| +([^|\n]+?) +\|$/gm;
  for (const match of summary.matchAll(pattern)) {
    if (match[1] === "stt") {
      continue;
    }
    rows.push({
      slug: match[1],
      reports: Number(match[2]),
      rows: Number(match[3]),
      groups: match[4].trim(),
    });
  }
  return rows;
}

function formatInventoryTable(rows: InventoryRow[]): string {
  const data = [...rows].sort((left, right) => left.slug.localeCompare(right.slug));
  const totalReports = data.reduce((sum, row) => sum + row.reports, 0);
  const totalRows = data.reduce((sum, row) => sum + row.rows, 0);
  const groupSet = new Set(data.flatMap((row) => row.groups.split(",").map((group) => group.trim()).filter(Boolean)));
  const categoryWidth = Math.max(8, ...data.map((row) => row.slug.length));
  const header = `| ${"Category".padEnd(categoryWidth)} | Reports | Provider rows | Groups present |`;
  const divider = `| ${"-".repeat(categoryWidth)} | ------: | ------------: | --- |`;
  const body = data.map((row) =>
    `| ${row.slug.padEnd(categoryWidth)} | ${String(row.reports).padStart(7)} | ${String(row.rows).padStart(13)} | ${row.groups} |`
  );
  const total = `| ${"**Total**".padEnd(categoryWidth)} | **${totalReports}** | **${totalRows}** | **${groupSet.size} groups** |`;
  return [header, divider, ...body, total].join("\n");
}

function upsertInventoryRow(summary: string, row: InventoryRow): string {
  const rows = parseInventoryRows(summary);
  const existing = rows.find((candidate) => candidate.slug === row.slug);
  if (existing) {
    existing.reports = row.reports;
    existing.rows = row.rows;
    existing.groups = row.groups;
  } else {
    rows.push(row);
  }
  return summary.replace(
    /\|\s*Category[\s\S]*?\|\s*\*\*Total\*\*\s*\|[^\n]+\|\n/,
    `${formatInventoryTable(rows)}\n`,
  );
}

function replaceOrInsertHeadingSection(summary: string, heading: string, body: string): string {
  const headingPattern = new RegExp(`## ${escapeRegExp(heading)}\\n[\\s\\S]*?(?=\\n## )`);
  if (headingPattern.test(summary)) {
    return summary.replace(headingPattern, `${body}\n\n`);
  }
  summary = summary.replace(/## STT\n[\s\S]*?(?=\n## )/, "");
  const before = heading === "STT With Speakers" && summary.includes("## STT Without Speakers\n")
    ? "STT Without Speakers"
    : "TTS";
  return summary.replace(`\n## ${before}\n`, `\n${body}\n\n## ${before}\n`);
}

function benchmarkSttSection(
  heading: string,
  slug: string,
  metricRankings: Record<GroupKey, Record<MetricName, RankingEntry[]>>,
  groupedProviders: Record<GroupKey, AggregatedProvider[]>,
  totalRuns: number,
): string {
  const lines = [`## ${heading}`, ""];
  for (const group of GROUPS) {
    lines.push(`### ${group}`, "", "#### Cost Ranking", "");
    lines.push(benchmarkSummaryRankingTable(metricRankings[group].price, (entry) => formatPrice(entry.value), totalRuns));
    lines.push("", "#### Speed Ranking", "");
    lines.push(benchmarkSummaryRankingTable(metricRankings[group].speed, (entry) => formatSpeed(entry.value), totalRuns));
    lines.push("", "#### Realtime Throughput Ranking", "");
    const throughput = [...groupedProviders[group]]
      .filter((provider) => provider.aggregateRealtimeFactor !== null)
      .sort((left, right) => (right.aggregateRealtimeFactor ?? -1) - (left.aggregateRealtimeFactor ?? -1) || left.providerKey.localeCompare(right.providerKey))
      .map((provider, index) => buildEntry(provider, "speed", provider.meanProcessingTimeMs, formatSpeed(provider.meanProcessingTimeMs), index + 1));
    lines.push(benchmarkSummaryRankingTable(
      throughput,
      (entry) => entry.aggregateRealtimeFactor === null ? "n/a" : `${entry.aggregateRealtimeFactor.toFixed(2)}× realtime`,
      totalRuns,
    ));
    lines.push("", "#### Auto-Quality Ranking", "");
    lines.push(benchmarkSummaryRankingTable(metricRankings[group].qualityScore, (entry) => formatQuality(entry.value), totalRuns));
    lines.push("", "#### Human Quality Ranking", "");
    lines.push(`_Unavailable: no humanQuality entries are present for \`${slug}/${group}\` in the current report files._`, "");
  }
  return lines.join("\n").trimEnd();
}

function updateBenchmarkSummary(
  rootDir: string,
  metricRankings: Record<GroupKey, Record<MetricName, RankingEntry[]>>,
  groupedProviders: Record<GroupKey, AggregatedProvider[]>,
  runs: RunRef[],
): void {
  const summaryPath = resolve(rootDir, "..", "summary.md");
  if (!existsSync(summaryPath)) {
    return;
  }
  const { slug, heading } = sttSummaryIdentity(rootDir);
  const providerRows = runs.reduce((total, run) => total + run.providerCount, 0);
  let summary = readFileSync(summaryPath, "utf8");
  summary = upsertInventoryRow(summary, {
    slug,
    reports: runs.length,
    rows: providerRows,
    groups: "local, thirdPartyServiceDiarization, thirdPartyServiceNonDiarization",
  });
  const section = benchmarkSttSection(heading, slug, metricRankings, groupedProviders, runs.length);
  summary = replaceOrInsertHeadingSection(summary, heading, section);
  writeFileSync(summaryPath, summary);
  console.log(`Wrote ${summaryPath}`);
}

function perRunMatrix(providers: AggregatedProvider[], runs: RunRef[]): string {
  if (providers.length === 0 || runs.length === 0) {
    return "No providers.";
  }
  const sorted = [...providers].sort((left, right) => (right.meanQualityScore ?? -1) - (left.meanQualityScore ?? -1));
  const header = `| Provider | Mean | ${runs.map((run) => run.runName).join(" | ")} |`;
  const divider = `| --- | ---: | ${runs.map(() => "---:").join(" | ")} |`;
  const rows = sorted.map((provider) => {
    const cells = runs.map((run) => {
      const value = provider.perRun[run.runName];
      return value === null || value === undefined ? "—" : value.toFixed(2);
    });
    const meanCell = provider.meanQualityScore === null ? "—" : provider.meanQualityScore.toFixed(2);
    return `| <code>${provider.provider}</code> | ${meanCell} | ${cells.join(" | ")} |`;
  });
  return `${header}\n${divider}\n${rows.join("\n")}`;
}

function diarizationLabel(provider: AggregatedProvider): string {
  if (provider.supportsDiarization === null) {
    return "n/a";
  }
  return provider.diarizationSupport ?? (provider.supportsDiarization ? "supported" : "unsupported");
}

function buildDashboardGroup(
  group: GroupKey,
  providers: AggregatedProvider[],
  runs: RunRef[],
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
    display: provider.provider,
    model: provider.model,
    coverage: `${provider.runsCovered}/${runs.length}`,
    quality: {
      display: provider.meanQualityScore === null ? "n/a" : provider.meanQualityScore.toFixed(2),
      rank: qualityRank.get(provider.providerKey) ?? null,
    },
    speed: {
      display: provider.aggregateRealtimeFactor === null
        ? formatSpeed(provider.meanProcessingTimeMs)
        : `${formatSpeed(provider.meanProcessingTimeMs)} · ${provider.aggregateRealtimeFactor.toFixed(2)}×`,
      rank: speedRank.get(provider.providerKey) ?? null,
    },
    cost: { display: formatPrice(priceValue(provider)), rank: priceRank.get(provider.providerKey) ?? null },
    evidence: [
      formatPercent(provider.meanSpeakerAwareWER),
      formatPercent(provider.meanTextOnlyWER),
      diarizationLabel(provider),
    ],
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
    metricColumns: { quality: "Quality /100", speed: "Mean time · throughput", cost: "Mean cost" },
    evidenceColumns: ["Mean SA-WER", "Mean text WER", "Diarization"],
    providers: rows,
  };
}

function main(): number {
  const rootRaw = process.argv[2];
  if (!rootRaw || rootRaw === "--help" || rootRaw === "-h") {
    console.log("Usage: bun scripts/stt/build_combined_report.ts <root_dir>");
    return rootRaw ? 0 : 1;
  }
  const rootDir = resolve(rootRaw);
  const runs = discoverRuns(rootDir);
  if (runs.length === 0) {
    throw new Error(`No run subdirectories with reference-comparison-report.json found under ${rootDir}`);
  }

  const byProvider = collectSamples(runs);
  const aggregated = aggregate(byProvider, runs);

  const groupedProviders: Record<GroupKey, AggregatedProvider[]> = {
    local: aggregated.filter((provider) => provider.group === "local"),
    thirdPartyServiceNonDiarization: aggregated.filter((provider) => provider.group === "thirdPartyServiceNonDiarization"),
    thirdPartyServiceDiarization: aggregated.filter((provider) => provider.group === "thirdPartyServiceDiarization"),
  };

  const metricRankings: Record<GroupKey, Record<MetricName, RankingEntry[]>> = {
    local: rankGroup(groupedProviders.local),
    thirdPartyServiceNonDiarization: rankGroup(groupedProviders.thirdPartyServiceNonDiarization),
    thirdPartyServiceDiarization: rankGroup(groupedProviders.thirdPartyServiceDiarization),
  };

  const generatedAt = new Date().toISOString();
  const jsonReport = {
    schemaVersion: 4,
    kind: "stt-combined-comparison-report",
    category: "stt",
    rootDir,
    generatedAt,
    metric: "speaker-aware WER-derived quality score, aggregated as the mean across runs",
    runCount: runs.length,
    runs: runs.map((run) => ({ runName: run.runName, runDir: run.runDir, providerCount: run.providerCount })),
    providerCount: aggregated.length,
    metricRankings,
    rankingPolicy: {
      price: "mean per-run monetary cost ascending; local providers at zero; missing cost sorts last; ties break by quality descending then providerKey",
      speed: "mean processing time ascending; observed aggregate realtime throughput is retained as evidence; missing timing sorts last; ties break by providerKey",
      qualityScore: "mean speaker-aware WER-derived score descending; missing score sorts last; ties break by providerKey",
    },
    notes: [
      "Each provider is aggregated by providerKey across the runs it appears in; the mean is taken over present values only. Aggregate realtime throughput is total covered audio duration divided by total covered processing time.",
      "Groups follow the single-run STT contract: local, thirdPartyServiceNonDiarization, thirdPartyServiceDiarization.",
      "Each group ranks price, speed, and quality score independently. No weighted composite or model-tier ranking is emitted.",
    ],
  };

  const jsonPath = join(rootDir, "combined-comparison-report.json");
  writeFileSync(jsonPath, JSON.stringify(jsonReport));

  const md: string[] = [];
  md.push("# Combined STT Provider Comparison Report");
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`- Root directory: \`${rootDir}\``);
  md.push(`- Runs aggregated: ${runs.length}`);
  for (const run of runs) {
    md.push(`  - \`${run.runName}\` (${run.providerCount} providers)`);
  }
  md.push(`- Distinct providers: ${aggregated.length} (${groupedProviders.local.length} local, ${groupedProviders.thirdPartyServiceNonDiarization.length} third-party non-diarization, ${groupedProviders.thirdPartyServiceDiarization.length} third-party diarization)`);
  md.push("- Quality score aggregates the per-run speaker-aware WER-derived score as a mean across runs; price and speed aggregate per-run cost and processing time as means.");
  md.push("");
  md.push("## Method");
  md.push("");
  md.push("- Providers are matched by `providerKey` and aggregated across the runs they appear in.");
  md.push("- Means are taken over present values only; a provider missing a value in some runs is averaged over the runs where it is present.");
  md.push("- Price rankings use mean per-run monetary cost ascending, local providers at zero, missing cost last.");
  md.push("- Speed rankings use mean processing time ascending, missing timing last.");
  md.push("- Quality Score rankings use the mean speaker-aware WER-derived score descending.");
  md.push("- Tied ranking values break deterministically: price ties by quality descending then provider key; speed and quality ties by provider key.");
  md.push("");
  md.push("## Metric Rankings");
  md.push("");
  for (const group of GROUPS) {
    md.push(`### ${GROUP_LABELS[group]}`);
    md.push("");
    md.push("#### Price");
    md.push("");
    md.push(metricTable(metricRankings[group].price));
    md.push("");
    md.push("#### Speed");
    md.push("");
    md.push(metricTable(metricRankings[group].speed));
    md.push("");
    md.push("#### Quality Score");
    md.push("");
    md.push(metricTable(metricRankings[group].qualityScore));
    md.push("");
  }
  md.push("## Per-Run Quality Score");
  md.push("");
  md.push("Speaker-aware WER-derived quality score per provider in each run, sorted by mean.");
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
    title: "Combined STT Provider Comparison",
    category: "stt",
    generatedAt,
    rootDir,
    summaryStats: [
      { label: "Runs", value: String(runs.length) },
      { label: "Providers", value: String(aggregated.length) },
      { label: "Non-diarization", value: String(groupedProviders.thirdPartyServiceNonDiarization.length) },
      { label: "Diarization", value: String(groupedProviders.thirdPartyServiceDiarization.length) },
      { label: "Local", value: String(groupedProviders.local.length) },
    ],
    runs: runs.map((run, index) => ({ runName: run.runName, shortLabel: `R${index + 1}`, detail: `${run.providerCount} providers` })),
    groups: GROUPS.map((group) =>
      buildDashboardGroup(group, groupedProviders[group], runs, metricRankings[group]),
    ),
    methodParagraphs: [
      "Providers are matched by `providerKey` and aggregated across the runs they appear in; means are taken over present values only.",
      "Quality ranks the mean speaker-aware WER-derived score descending. Speed ranks mean processing time ascending. Cost ranks mean per-run monetary cost ascending with local providers at zero. Missing values sort last; ties break deterministically.",
    ],
    notes: jsonReport.notes,
  };
  const htmlPath = join(rootDir, "combined-comparison-report.html");
  writeFileSync(htmlPath, renderCombinedDashboard(dashboardModel));
  updateBenchmarkSummary(rootDir, metricRankings, groupedProviders, runs);

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${markdownPath}`);
  console.log(`Wrote ${htmlPath}`);
  console.log(`Aggregated ${aggregated.length} providers across ${runs.length} runs.`);
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
