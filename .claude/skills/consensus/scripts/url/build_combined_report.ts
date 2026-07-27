#!/usr/bin/env bun

/**
 * Build a combined cross-run URL provider comparison report from committed
 * single-run report artifacts. No extraction provider or external service is
 * invoked by this script.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  MISSING_DATA_POLICY,
  TIERING_METHOD_LINES,
  WEIGHTED_COMPOSITE_POLICY,
  WEIGHTED_METHOD_LINES,
  WEIGHT_SETS,
  WEIGHT_SET_KEYS,
  buildQualityCostTiering,
  computeGroupSubscores,
  computeWeightedRankings,
  discoverCombinedRuns,
  tierTable,
  weightedRankingTable,
  type CombinedProviderInput,
  type CombinedRunRef,
  type CombinedTiering,
  type ProviderSubscores,
  type WeightSetKey,
  type WeightedRankingEntry,
} from "../shared/combined_report_lib";
import {
  balancedCells,
  renderCombinedDashboard,
  type CombinedDashboardModel,
  type DashboardGroup,
  type DashboardProviderRow,
  type DashboardRunInventoryCell,
  type DashboardWeightedCell,
} from "../shared/combined_report_html";
import { LONG_SEQUENCE_DISTANCE_METHOD } from "./url_consensus_lib";

export type UrlCombinedGroup = "local" | "service";
export type UrlCombinedMetric = "price" | "speed" | "automatedQuality";

const GROUPS: UrlCombinedGroup[] = ["local", "service"];
const GROUP_LABELS: Record<UrlCombinedGroup, string> = {
  local: "Local",
  service: "Service",
};

interface SourceRankingEntry {
  rank?: number;
  providerKey?: string;
  provider?: string;
  model?: string;
  value?: number | null;
  label?: string;
}

interface SourceRankingSurface {
  price?: SourceRankingEntry[];
  speed?: SourceRankingEntry[];
  automatedQuality?: SourceRankingEntry[];
  humanQuality?: SourceRankingEntry[];
}

interface ReportProviderDetail {
  providerKey?: string;
  provider?: string;
  model?: string;
  group?: string;
  processingTimeMs?: number | null;
  costCents?: number | null;
  metrics?: {
    wer?: number | null;
    cer?: number | null;
    contentCoverage?: number | null;
  };
}

interface SourceProviderGroup {
  count?: number;
  providers?: ReportProviderDetail[];
}

interface SingleRunReport {
  runName?: string;
  runDir?: string;
  providerCount?: number;
  providerGroups?: Partial<Record<UrlCombinedGroup, SourceProviderGroup>>;
  rankingSurfaces?: Partial<Record<UrlCombinedGroup, SourceRankingSurface>>;
  normalization?: {
    exactLevenshteinElementLimit?: number;
    longSequenceDistance?: string | null;
    longSequenceDistanceMethods?: string[];
  };
  notes?: string[];
}

interface RunJson {
  metadata?: {
    step1?: { title?: string };
    source?: { url?: string };
    web?: { title?: string; sourceUrl?: string; finalUrl?: string };
  };
}

export interface UrlRunLeader {
  providerKey: string;
  provider: string;
  model: string;
  value: number | null;
  label: string;
}

interface UrlRunLeaders {
  local: Record<UrlCombinedMetric, UrlRunLeader | null>;
  service: Record<UrlCombinedMetric, UrlRunLeader | null>;
}

export interface UrlCombinedRun extends CombinedRunRef {
  articleTitle: string;
  sourceUrl: string | null;
  finalUrl: string | null;
  providerCounts: Record<UrlCombinedGroup, number>;
  providerRowCount: number;
  automatedQualityRowCount: number;
  humanQualityRowCount: number;
  leaders: UrlRunLeaders;
  declaresLongDistanceApproximation: boolean;
}

export interface UrlProviderSample {
  runName: string;
  group: UrlCombinedGroup;
  automatedQuality: number | null;
  wer: number | null;
  cer: number | null;
  contentCoverage: number | null;
  processingTimeMs: number | null;
  costCents: number | null;
}

interface CollectedUrlProvider {
  providerKey: string;
  provider: string;
  model: string;
  group: UrlCombinedGroup;
  samples: UrlProviderSample[];
}

export interface AggregatedUrlProvider {
  providerKey: string;
  provider: string;
  model: string;
  group: UrlCombinedGroup;
  runsCovered: number;
  meanAutomatedQuality: number | null;
  meanWER: number | null;
  meanCER: number | null;
  meanContentCoverage: number | null;
  meanProcessingTimeMs: number | null;
  meanCostCents: number | null;
  meanCostUSD: number | null;
  perRun: Record<string, number | null>;
}

export interface UrlMetricRankingEntry {
  rank: number;
  providerKey: string;
  provider: string;
  model: string;
  group: UrlCombinedGroup;
  metric: UrlCombinedMetric;
  value: number | null;
  label: string;
  runsCovered: number;
  meanAutomatedQuality: number | null;
  meanWER: number | null;
  meanCER: number | null;
  meanContentCoverage: number | null;
  meanProcessingTimeMs: number | null;
  meanCostCents: number | null;
  meanCostUSD: number | null;
}

interface UrlCombinedBuildResult {
  report: Record<string, unknown>;
  markdown: string;
  html: string;
  runCount: number;
  providerCount: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteOrNull(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function mean(values: Array<number | null>): number | null {
  const present = values.filter(isFiniteNumber);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sourceLeader(entry: SourceRankingEntry | undefined): UrlRunLeader | null {
  if (!entry?.providerKey || !isFiniteNumber(entry.value)) {
    return null;
  }
  return {
    providerKey: entry.providerKey,
    provider: entry.provider ?? entry.providerKey,
    model: entry.model ?? entry.provider ?? entry.providerKey,
    value: entry.value,
    label: entry.label ?? "n/a",
  };
}

function leadersFor(report: SingleRunReport): UrlRunLeaders {
  const leaders = {} as UrlRunLeaders;
  for (const group of GROUPS) {
    const surface = report.rankingSurfaces?.[group];
    leaders[group] = {
      price: sourceLeader(surface?.price?.[0]),
      speed: sourceLeader(surface?.speed?.[0]),
      automatedQuality: sourceLeader(surface?.automatedQuality?.[0]),
    };
  }
  return leaders;
}

export function discoverUrlCombinedRuns(rootDir: string): UrlCombinedRun[] {
  return discoverCombinedRuns(rootDir, "provider-comparison-report.json").map((discovered) => {
    const report = readJson<SingleRunReport>(discovered.reportPath);
    const actualRunDir = dirname(discovered.reportPath);
    const runPath = join(actualRunDir, "run.json");
    const runJson = existsSync(runPath) ? readJson<RunJson>(runPath) : null;
    const providerCounts = {
      local: report.providerGroups?.local?.count ?? report.providerGroups?.local?.providers?.length ?? 0,
      service: report.providerGroups?.service?.count ?? report.providerGroups?.service?.providers?.length ?? 0,
    };
    const providerRowCount = GROUPS.reduce(
      (count, group) => count + (report.providerGroups?.[group]?.providers?.length ?? 0),
      0,
    );
    const automatedQualityRowCount = GROUPS.reduce(
      (count, group) => count + (report.rankingSurfaces?.[group]?.automatedQuality?.length ?? 0),
      0,
    );
    const humanQualityRowCount = GROUPS.reduce(
      (count, group) => count + (report.rankingSurfaces?.[group]?.humanQuality?.length ?? 0),
      0,
    );
    const sourceUrl = runJson?.metadata?.web?.sourceUrl ?? runJson?.metadata?.source?.url ?? null;
    return {
      ...discovered,
      runDir: actualRunDir,
      providerCount: report.providerCount ?? providerRowCount,
      articleTitle: runJson?.metadata?.web?.title ?? runJson?.metadata?.step1?.title ?? report.runName ?? basename(actualRunDir),
      sourceUrl,
      finalUrl: runJson?.metadata?.web?.finalUrl ?? sourceUrl,
      providerCounts,
      providerRowCount,
      automatedQualityRowCount,
      humanQualityRowCount,
      leaders: leadersFor(report),
      declaresLongDistanceApproximation:
        report.normalization?.longSequenceDistance === "rolling-shingle-approximation"
        || report.normalization?.longSequenceDistance === LONG_SEQUENCE_DISTANCE_METHOD
        || (report.normalization?.longSequenceDistanceMethods ?? []).some((method) =>
          method !== "exact-levenshtein"
        )
        || (report.notes ?? []).some((note) =>
          note.includes("rolling-shingle approximation")
          || note.includes("bounded exact wavefront alignment")
        ),
    };
  });
}

function qualityByProvider(surface: SourceRankingSurface | undefined): Map<string, number | null> {
  return new Map(
    (surface?.automatedQuality ?? [])
      .filter((entry): entry is SourceRankingEntry & { providerKey: string } => typeof entry.providerKey === "string")
      .map((entry) => [entry.providerKey, finiteOrNull(entry.value)]),
  );
}

export function collectUrlProviderSamples(runs: UrlCombinedRun[]): CollectedUrlProvider[] {
  const groups: Record<UrlCombinedGroup, Map<string, CollectedUrlProvider>> = {
    local: new Map(),
    service: new Map(),
  };

  for (const run of runs) {
    const report = readJson<SingleRunReport>(run.reportPath);
    for (const group of GROUPS) {
      const qualityValues = qualityByProvider(report.rankingSurfaces?.[group]);
      for (const detail of report.providerGroups?.[group]?.providers ?? []) {
        if (!detail.providerKey) {
          continue;
        }
        const existing = groups[group].get(detail.providerKey) ?? {
          providerKey: detail.providerKey,
          provider: detail.provider ?? detail.providerKey,
          model: detail.model ?? detail.provider ?? detail.providerKey,
          group,
          samples: [],
        };
        existing.samples.push({
          runName: run.runName,
          group,
          automatedQuality: qualityValues.get(detail.providerKey) ?? null,
          wer: finiteOrNull(detail.metrics?.wer),
          cer: finiteOrNull(detail.metrics?.cer),
          contentCoverage: finiteOrNull(detail.metrics?.contentCoverage),
          processingTimeMs: finiteOrNull(detail.processingTimeMs),
          costCents: group === "local" ? 0 : finiteOrNull(detail.costCents),
        });
        groups[group].set(detail.providerKey, existing);
      }
    }
  }

  return GROUPS.flatMap((group) => [...groups[group].values()]);
}

export function aggregateUrlProviders(providers: CollectedUrlProvider[], runs: UrlCombinedRun[]): AggregatedUrlProvider[] {
  return providers.map((provider) => {
    const meanCostCents = provider.group === "local" ? 0 : mean(provider.samples.map((sample) => sample.costCents));
    const perRun: Record<string, number | null> = {};
    for (const run of runs) {
      perRun[run.runName] = provider.samples.find((sample) => sample.runName === run.runName)?.automatedQuality ?? null;
    }
    return {
      providerKey: provider.providerKey,
      provider: provider.provider,
      model: provider.model,
      group: provider.group,
      runsCovered: provider.samples.length,
      meanAutomatedQuality: mean(provider.samples.map((sample) => sample.automatedQuality)),
      meanWER: mean(provider.samples.map((sample) => sample.wer)),
      meanCER: mean(provider.samples.map((sample) => sample.cer)),
      meanContentCoverage: mean(provider.samples.map((sample) => sample.contentCoverage)),
      meanProcessingTimeMs: mean(provider.samples.map((sample) => sample.processingTimeMs)),
      meanCostCents,
      meanCostUSD: meanCostCents === null ? null : meanCostCents / 100,
      perRun,
    };
  });
}

function compareAscending(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left - right;
}

function compareDescending(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return right - left;
}

function formatQuality(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function formatTime(value: number | null): string {
  return value === null ? "n/a" : `${(value / 1000).toFixed(2)}s`;
}

function formatCostUsd(value: number | null): string {
  return value === null ? "n/a" : `$${value.toFixed(4)}`;
}

function rankingEntry(
  provider: AggregatedUrlProvider,
  metric: UrlCombinedMetric,
  value: number | null,
  label: string,
  rank: number,
): UrlMetricRankingEntry {
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
    meanAutomatedQuality: provider.meanAutomatedQuality,
    meanWER: provider.meanWER,
    meanCER: provider.meanCER,
    meanContentCoverage: provider.meanContentCoverage,
    meanProcessingTimeMs: provider.meanProcessingTimeMs,
    meanCostCents: provider.meanCostCents,
    meanCostUSD: provider.meanCostUSD,
  };
}

export function rankUrlProviderGroup(
  providers: AggregatedUrlProvider[],
): Record<UrlCombinedMetric, UrlMetricRankingEntry[]> {
  const automatedQuality = [...providers]
    .sort((left, right) =>
      compareDescending(left.meanAutomatedQuality, right.meanAutomatedQuality)
      || compareAscending(left.meanProcessingTimeMs, right.meanProcessingTimeMs)
      || left.providerKey.localeCompare(right.providerKey)
    )
    .map((provider, index) => rankingEntry(
      provider,
      "automatedQuality",
      provider.meanAutomatedQuality,
      `${formatQuality(provider.meanAutomatedQuality)} automated quality`,
      index + 1,
    ));

  const speed = [...providers]
    .sort((left, right) =>
      compareAscending(left.meanProcessingTimeMs, right.meanProcessingTimeMs)
      || compareDescending(left.meanAutomatedQuality, right.meanAutomatedQuality)
      || left.providerKey.localeCompare(right.providerKey)
    )
    .map((provider, index) => rankingEntry(
      provider,
      "speed",
      provider.meanProcessingTimeMs,
      formatTime(provider.meanProcessingTimeMs),
      index + 1,
    ));

  const price = [...providers]
    .sort((left, right) =>
      compareAscending(left.meanCostUSD, right.meanCostUSD)
      || compareDescending(left.meanAutomatedQuality, right.meanAutomatedQuality)
      || compareAscending(left.meanProcessingTimeMs, right.meanProcessingTimeMs)
      || left.providerKey.localeCompare(right.providerKey)
    )
    .map((provider, index) => rankingEntry(
      provider,
      "price",
      provider.meanCostUSD,
      formatCostUsd(provider.meanCostUSD),
      index + 1,
    ));

  return { price, speed, automatedQuality };
}

function metricTable(entries: UrlMetricRankingEntry[], runCount: number): string {
  const header =
    "| Rank | Provider | Value | Coverage | Avg automated quality | Avg WER | Avg CER | Avg content coverage | Avg speed | Avg cost |\n"
    + "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |";
  if (entries.length === 0) {
    return `${header}\n| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |`;
  }
  const rows = entries.map((entry) =>
    `| ${entry.rank} | <code>${markdownText(entry.providerKey)}</code> | ${entry.label} | ${entry.runsCovered}/${runCount} | ${formatQuality(entry.meanAutomatedQuality)} | ${formatPercent(entry.meanWER)} | ${formatPercent(entry.meanCER)} | ${formatPercent(entry.meanContentCoverage)} | ${formatTime(entry.meanProcessingTimeMs)} | ${formatCostUsd(entry.meanCostUSD)} |`
  );
  return `${header}\n${rows.join("\n")}`;
}

function perRunMatrix(providers: AggregatedUrlProvider[], runs: UrlCombinedRun[]): string {
  if (providers.length === 0) {
    return "No providers.";
  }
  const sorted = [...providers].sort((left, right) =>
    compareDescending(left.meanAutomatedQuality, right.meanAutomatedQuality)
    || left.providerKey.localeCompare(right.providerKey)
  );
  const header = `| Provider | Mean | ${runs.map((run) => markdownText(run.runName)).join(" | ")} |`;
  const divider = `| --- | ---: | ${runs.map(() => "---:").join(" | ")} |`;
  const rows = sorted.map((provider) => {
    const cells = runs.map((run) => {
      const value = provider.perRun[run.runName];
      return value === null || value === undefined ? "—" : value.toFixed(2);
    });
    return `| <code>${markdownText(provider.providerKey)}</code> | ${formatQuality(provider.meanAutomatedQuality)} | ${cells.join(" | ")} |`;
  });
  return `${header}\n${divider}\n${rows.join("\n")}`;
}

function markdownText(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function markdownLinkLabel(value: string): string {
  return value
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\\", "&#92;")
    .replaceAll("|", "&#124;")
    .replaceAll("[", "&#91;")
    .replaceAll("]", "&#93;")
    .replaceAll("(", "&#40;")
    .replaceAll(")", "&#41;")
    .replaceAll("*", "&#42;")
    .replaceAll("_", "&#95;")
    .replaceAll("`", "&#96;")
    .replaceAll("!", "&#33;")
    .replaceAll("~", "&#126;");
}

function safeHttpUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href.replaceAll("|", "%7C")
      : null;
  } catch {
    return null;
  }
}

function markdownArticle(run: UrlCombinedRun): string {
  const href = safeHttpUrl(run.sourceUrl);
  const label = markdownLinkLabel(run.articleTitle);
  return href === null ? label : `[${label}](<${href}>)`;
}

function markdownSourceUrl(run: UrlCombinedRun): string {
  const href = safeHttpUrl(run.sourceUrl);
  return href === null ? "n/a" : `<${href}>`;
}

function sourceLeaderDisplay(leader: UrlRunLeader | null, metric: UrlCombinedMetric): string {
  if (leader === null) {
    return "n/a";
  }
  let value = leader.label;
  if (leader.value !== null) {
    if (metric === "automatedQuality") value = leader.value.toFixed(2);
    if (metric === "speed") value = formatTime(leader.value);
    if (metric === "price") value = formatCostUsd(leader.value / 100);
  }
  return `\`${markdownText(leader.providerKey)}\` (${value})`;
}

function sourceInventoryTable(runs: UrlCombinedRun[]): string {
  const header =
    "| Run | Article | Source URL | Providers | Best local quality | Best service quality | Cheapest service | Fastest service |\n"
    + "| --- | --- | --- | ---: | --- | --- | --- | --- |";
  const rows = runs.map((run) =>
    `| \`${markdownText(run.runName)}\` | ${markdownArticle(run)} | ${markdownSourceUrl(run)} | ${run.providerCounts.local} local / ${run.providerCounts.service} service | ${sourceLeaderDisplay(run.leaders.local.automatedQuality, "automatedQuality")} | ${sourceLeaderDisplay(run.leaders.service.automatedQuality, "automatedQuality")} | ${sourceLeaderDisplay(run.leaders.service.price, "price")} | ${sourceLeaderDisplay(run.leaders.service.speed, "speed")} |`
  );
  return `${header}\n${rows.join("\n")}`;
}

function buildDashboardGroup(
  group: UrlCombinedGroup,
  providers: AggregatedUrlProvider[],
  runs: UrlCombinedRun[],
  metricRankings: Record<UrlCombinedMetric, UrlMetricRankingEntry[]>,
  weightedRankings: Record<WeightSetKey, WeightedRankingEntry[]>,
  tiering: CombinedTiering,
  subscored: ProviderSubscores[],
): DashboardGroup {
  const qualityRank = new Map(metricRankings.automatedQuality.map((entry) => [entry.providerKey, entry.rank]));
  const speedRank = new Map(metricRankings.speed.map((entry) => [entry.providerKey, entry.rank]));
  const priceRank = new Map(metricRankings.price.map((entry) => [entry.providerKey, entry.rank]));
  const balanced = balancedCells(subscored);
  const subscoredByKey = new Map(subscored.map((item) => [item.providerKey, item]));
  const weightedByKey = {} as Record<WeightSetKey, Map<string, DashboardWeightedCell>>;
  for (const key of WEIGHT_SET_KEYS) {
    weightedByKey[key] = new Map(weightedRankings[key].map((entry) => [
      entry.providerKey,
      { rank: entry.rank, composite: entry.composite },
    ]));
  }
  const tierByKey = new Map<string, number>();
  for (const tier of tiering.tiers) {
    for (const provider of tier.providers) {
      tierByKey.set(provider.providerKey, tier.tier);
    }
  }
  const heatValues = providers.flatMap((provider) =>
    runs.map((run) => provider.perRun[run.runName]).filter(isFiniteNumber)
  );
  const heatMin = heatValues.length === 0 ? 0 : Math.min(...heatValues);
  const heatMax = heatValues.length === 0 ? 0 : Math.max(...heatValues);

  const rows: DashboardProviderRow[] = providers.map((provider) => ({
    providerKey: provider.providerKey,
    display: provider.providerKey,
    model: provider.model,
    coverage: `${provider.runsCovered}/${runs.length}`,
    tier: tierByKey.get(provider.providerKey) ?? null,
    quality: { display: formatQuality(provider.meanAutomatedQuality), rank: qualityRank.get(provider.providerKey) ?? null },
    speed: { display: formatTime(provider.meanProcessingTimeMs), rank: speedRank.get(provider.providerKey) ?? null },
    cost: { display: formatCostUsd(provider.meanCostUSD), rank: priceRank.get(provider.providerKey) ?? null },
    balanced: balanced.get(provider.providerKey) ?? { rank: providers.length, composite: 0 },
    weighted: Object.fromEntries(
      WEIGHT_SET_KEYS.map((key) => [
        key,
        weightedByKey[key].get(provider.providerKey) ?? { rank: providers.length, composite: 0 },
      ]),
    ) as Record<WeightSetKey, DashboardWeightedCell>,
    evidence: [formatPercent(provider.meanWER), formatPercent(provider.meanCER), formatPercent(provider.meanContentCoverage)],
    missingDimensions: subscoredByKey.get(provider.providerKey)?.missingDimensions ?? [],
    perRun: runs.map((run) => {
      const value = provider.perRun[run.runName];
      if (!isFiniteNumber(value)) {
        return { display: "—", heat: null };
      }
      return {
        display: value.toFixed(2),
        heat: heatMax === heatMin ? 100 : Math.round(((value - heatMin) / (heatMax - heatMin)) * 100),
      };
    }),
  }));

  return {
    key: group,
    label: GROUP_LABELS[group],
    tierCards: tiering.tiers.map((tier) => ({
      tier: tier.tier,
      label: tier.label,
      description: tier.description,
      providers: tier.providers.map((provider) => ({
        display: provider.display ?? provider.provider,
        qualityCostRank: provider.qualityCostRank,
        qualityCostComposite: provider.qualityCostComposite,
      })),
    })),
    metricColumns: { quality: "Auto quality /100", speed: "Mean time", cost: "Mean cost" },
    evidenceColumns: ["Avg WER", "Avg CER", "Avg coverage"],
    perRunMetricLabel: "Per-run automated quality",
    providers: rows,
  };
}

function inventoryCell(display: string, href?: string): DashboardRunInventoryCell {
  return href === undefined ? { display } : { display, href };
}

function buildMarkdown(
  rootDir: string,
  runs: UrlCombinedRun[],
  aggregated: AggregatedUrlProvider[],
  groupedProviders: Record<UrlCombinedGroup, AggregatedUrlProvider[]>,
  metricRankings: Record<UrlCombinedGroup, Record<UrlCombinedMetric, UrlMetricRankingEntry[]>>,
  weightedRankings: Record<UrlCombinedGroup, Record<WeightSetKey, WeightedRankingEntry[]>>,
  tiering: Record<UrlCombinedGroup, CombinedTiering>,
  counts: {
    providerRowCount: number;
    automatedQualityRowCount: number;
    humanQualityRowCount: number;
    longDistanceRunCount: number;
  },
  notes: string[],
): string {
  const md: string[] = [
    "# Combined URL Provider Comparison Report",
    "",
    "This report is generated exclusively from the committed `run.json` and `provider-comparison-report.json` artifacts. It does not rerun URL extraction providers or regenerate consensus extractions.",
    "",
    "## Source Inventory",
    "",
    `- Root directory: \`${rootDir}\``,
    `- Runs: ${runs.length}`,
    `- Distinct providers: ${aggregated.length} (${groupedProviders.local.length} local, ${groupedProviders.service.length} service)`,
    `- Provider result rows: ${counts.providerRowCount}`,
    `- Automated quality score rows: ${counts.automatedQualityRowCount}`,
    `- Human quality score rows: ${counts.humanQualityRowCount}`,
    "",
    sourceInventoryTable(runs),
    "",
    "## Method",
    "",
    "- Providers are matched by `providerKey` within `local` or `service`; groups are collected and ranked independently.",
    "- Automated quality is the unweighted mean of present source `rankingSurfaces.*.automatedQuality.value` values. It is not recomputed from WER, CER, or coverage.",
    "- WER, CER, content coverage, processing time, and cost are supporting unweighted means over present provider-row values. Source cents are converted to USD for price display and ranking; local monetary cost is always zero.",
    "- Automated quality ranks descending, then speed ascending, then provider key. Speed ranks ascending, then quality descending, then provider key. Price ranks ascending, then quality descending, speed ascending, then provider key. Missing values sort last.",
    "",
    ...WEIGHTED_METHOD_LINES,
    "",
    ...TIERING_METHOD_LINES,
    "",
    "## Metric Rankings",
    "",
  ];

  for (const group of GROUPS) {
    md.push(`### ${GROUP_LABELS[group]}`, "");
    md.push("#### Price", "", metricTable(metricRankings[group].price, runs.length), "");
    md.push("#### Speed", "", metricTable(metricRankings[group].speed, runs.length), "");
    md.push("#### Automated Quality", "", metricTable(metricRankings[group].automatedQuality, runs.length), "");
    md.push(
      "#### Weighted Rankings",
      "",
      "Q, S, and C are each provider's per-run normalized automated-quality, processing-time, and monetary-cost subscores averaged across covered runs.",
      "",
    );
    for (const key of WEIGHT_SET_KEYS) {
      md.push(`##### ${WEIGHT_SETS[key].label}`, "", weightedRankingTable(weightedRankings[group][key], runs.length), "");
    }
  }

  md.push(
    "## Per-Run Automated Quality",
    "",
    "Source automated-quality value per provider in each run, sorted by aggregate mean.",
    "",
  );
  for (const group of GROUPS) {
    if (groupedProviders[group].length > 0) {
      md.push(`### ${GROUP_LABELS[group]}`, "", perRunMatrix(groupedProviders[group], runs), "");
    }
  }

  md.push(
    "## Model Tiers",
    "",
    "Tiers are `quality-cost-terciles-v1`: contiguous, near-equal slices of each group's `qualityCost` weighted ranking, with remainder models assigned to higher tiers first. Groups are never compared against each other.",
    "",
  );
  for (const group of GROUPS) {
    md.push(`### ${GROUP_LABELS[group]}`, "", tierTable(tiering[group]), "");
  }

  md.push(
    "## Human Quality Note",
    "",
    counts.humanQualityRowCount === 0
      ? `No explicit \`humanQualityScore\` was available in any of the ${runs.length} source reports. Generic quality scores, cost, speed, file size, token estimates, content coverage, WER, CER, and artifact metadata are not human-quality proxies, so no human-quality ranking is produced.`
      : `${counts.humanQualityRowCount} explicit human-quality rows were present, but URL combined schema v1 does not mix them into automated-quality rankings.`,
    "",
    "## Long-Distance Note",
    "",
    `${counts.longDistanceRunCount} of ${runs.length} source reports declare deterministic long-sequence distance handling beyond 10,000 normalized elements. This combined report averages the source values as recorded and does not recompute or mix distance methods at the combined-report level.`,
    "",
    "## Notes",
    "",
    ...notes.map((note) => `- ${note}`),
    "",
  );
  return md.join("\n");
}

export function buildUrlCombinedReport(rootDirRaw: string, generatedAt = new Date().toISOString()): UrlCombinedBuildResult {
  const rootDir = resolve(rootDirRaw);
  const runs = discoverUrlCombinedRuns(rootDir);
  if (runs.length === 0) {
    throw new Error(`No run subdirectories with provider-comparison-report.json found under ${rootDir}`);
  }

  const collected = collectUrlProviderSamples(runs);
  const aggregated = aggregateUrlProviders(collected, runs);
  const groupedProviders: Record<UrlCombinedGroup, AggregatedUrlProvider[]> = {
    local: aggregated.filter((provider) => provider.group === "local"),
    service: aggregated.filter((provider) => provider.group === "service"),
  };
  const metricRankings: Record<UrlCombinedGroup, Record<UrlCombinedMetric, UrlMetricRankingEntry[]>> = {
    local: rankUrlProviderGroup(groupedProviders.local),
    service: rankUrlProviderGroup(groupedProviders.service),
  };
  const weightedRankings = {} as Record<UrlCombinedGroup, Record<WeightSetKey, WeightedRankingEntry[]>>;
  const tiering = {} as Record<UrlCombinedGroup, CombinedTiering>;
  const subscoresByGroup = {} as Record<UrlCombinedGroup, ProviderSubscores[]>;
  const runNames = runs.map((run) => run.runName);
  for (const group of GROUPS) {
    const inputs: CombinedProviderInput[] = groupedProviders[group].map((provider) => {
      const source = collected.find((item) => item.group === group && item.providerKey === provider.providerKey);
      return {
        providerKey: provider.providerKey,
        provider: provider.provider,
        model: provider.model,
        display: provider.providerKey,
        samples: (source?.samples ?? []).map((sample) => ({
          runName: sample.runName,
          quality: sample.automatedQuality,
          timeMs: sample.processingTimeMs,
          costCents: group === "local" ? 0 : sample.costCents,
        })),
      };
    });
    const subscored = computeGroupSubscores(inputs, runNames);
    subscoresByGroup[group] = subscored;
    weightedRankings[group] = computeWeightedRankings(subscored, group);
    tiering[group] = buildQualityCostTiering(weightedRankings[group].qualityCost);
  }

  const providerRowCount = runs.reduce((sum, run) => sum + run.providerRowCount, 0);
  const automatedQualityRowCount = runs.reduce((sum, run) => sum + run.automatedQualityRowCount, 0);
  const humanQualityRowCount = runs.reduce((sum, run) => sum + run.humanQualityRowCount, 0);
  const longDistanceRunCount = runs.filter((run) => run.declaresLongDistanceApproximation).length;
  const notes = [
    "Each provider is aggregated by providerKey within its source group; present-value means do not impute missing rows or metrics.",
    "Local and service providers are never normalized, ranked, or tiered together; local monetary cost remains zero.",
    humanQualityRowCount === 0
      ? "No human-quality ranking is emitted because explicit human-quality rows are absent from the current source reports."
      : `${humanQualityRowCount} explicit human-quality ${humanQualityRowCount === 1 ? "row is" : "rows are"} present; URL combined schema v1 does not mix ${humanQualityRowCount === 1 ? "it" : "them"} into automated-quality rankings.`,
    "Weighted composite rankings and quality-cost tercile tiers are precomputed per group; the HTML performs no runtime metric or composite calculation.",
  ];
  const report = {
    schemaVersion: 1,
    kind: "url-combined-comparison-report",
    category: "url",
    rootDir,
    generatedAt,
    metric: "source automated-quality score, aggregated as the mean of present rankingSurfaces values",
    runCount: runs.length,
    providerCount: aggregated.length,
    providerRowCount,
    automatedQualityRowCount,
    humanQualityRowCount,
    providerCounts: {
      local: groupedProviders.local.length,
      service: groupedProviders.service.length,
    },
    runs: runs.map((run) => ({
      runName: run.runName,
      runDir: run.runDir,
      articleTitle: run.articleTitle,
      sourceUrl: run.sourceUrl,
      finalUrl: run.finalUrl,
      providerCount: run.providerCount,
      providerCounts: run.providerCounts,
      providerRowCount: run.providerRowCount,
      automatedQualityRowCount: run.automatedQualityRowCount,
      humanQualityRowCount: run.humanQualityRowCount,
      leaders: run.leaders,
    })),
    providers: aggregated,
    metricRankings,
    weightSets: WEIGHT_SETS,
    weightedRankings,
    tiering,
    rankingPolicy: {
      price: "mean monetary cost in USD ascending; local providers at zero; then automated quality descending, processing time ascending, providerKey ascending; missing values sort last",
      speed: "mean processing time ascending; then automated quality descending, providerKey ascending; missing values sort last",
      automatedQuality: "mean source rankingSurfaces automatedQuality value descending; then processing time ascending, providerKey ascending; missing values sort last",
      weightedComposite: WEIGHTED_COMPOSITE_POLICY,
      missingData: MISSING_DATA_POLICY,
    },
    normalization: {
      scope: "per-run, per-provider-group",
      dimensions: {
        quality: "source automatedQuality value; higher is better",
        speed: "processingTimeMs; lower is better",
        cost: "costCents; lower is better; local monetary cost is zero",
      },
      range: "min-max 0-100; identical present min/max values receive 100",
      aggregation: "mean of each provider's present per-run subscores",
      groupIsolation: true,
      sourceDistance: {
        exactLevenshteinElementLimit: 10_000,
        longSequenceDistance: "source-declared-per-run",
        declaringRunCount: longDistanceRunCount,
      },
    },
    notes,
  };

  const markdown = buildMarkdown(
    rootDir,
    runs,
    aggregated,
    groupedProviders,
    metricRankings,
    weightedRankings,
    tiering,
    { providerRowCount, automatedQualityRowCount, humanQualityRowCount, longDistanceRunCount },
    notes,
  );

  const dashboardModel: CombinedDashboardModel = {
    title: "Combined URL Provider Comparison",
    category: "url",
    generatedAt,
    rootDir,
    summaryStats: [
      { label: "Runs", value: String(runs.length) },
      { label: "Providers", value: String(aggregated.length) },
      { label: "Provider rows", value: String(providerRowCount) },
      { label: "Automated quality rows", value: String(automatedQualityRowCount) },
      { label: "Human quality rows", value: String(humanQualityRowCount) },
    ],
    runInventoryColumns: [
      { key: "article", label: "Article" },
      { key: "source", label: "Source URL" },
      { key: "localQuality", label: "Best local quality" },
      { key: "serviceQuality", label: "Best service quality" },
      { key: "servicePrice", label: "Cheapest service" },
      { key: "serviceSpeed", label: "Fastest service" },
    ],
    runs: runs.map((run, index) => {
      const sourceHref = safeHttpUrl(run.sourceUrl) ?? undefined;
      return {
        runName: run.runName,
        shortLabel: `R${index + 1}`,
        detail: `${run.providerCounts.local} local / ${run.providerCounts.service} service`,
        inventory: {
          article: inventoryCell(run.articleTitle, sourceHref),
          source: inventoryCell(run.sourceUrl ?? "n/a", sourceHref),
          localQuality: inventoryCell(sourceLeaderDisplay(run.leaders.local.automatedQuality, "automatedQuality").replaceAll("`", "")),
          serviceQuality: inventoryCell(sourceLeaderDisplay(run.leaders.service.automatedQuality, "automatedQuality").replaceAll("`", "")),
          servicePrice: inventoryCell(sourceLeaderDisplay(run.leaders.service.price, "price").replaceAll("`", "")),
          serviceSpeed: inventoryCell(sourceLeaderDisplay(run.leaders.service.speed, "speed").replaceAll("`", "")),
        },
      };
    }),
    groups: GROUPS.map((group) => buildDashboardGroup(
      group,
      groupedProviders[group],
      runs,
      metricRankings[group],
      weightedRankings[group],
      tiering[group],
      subscoresByGroup[group],
    )),
    methodParagraphs: [
      "Providers are matched by `providerKey` within `local` or `service`; present-value means are computed independently per group.",
      "Automated quality comes directly from source `rankingSurfaces.*.automatedQuality` values. Speed is mean processing time. Cost converts mean source cents to USD and remains zero for local providers. WER, CER, and coverage are supporting evidence. Missing values sort last; ties break deterministically.",
      ...WEIGHTED_METHOD_LINES.filter((line) => line.length > 0 && !line.startsWith("|")),
      ...TIERING_METHOD_LINES,
    ],
    notes: [
      ...notes,
      `${longDistanceRunCount} of ${runs.length} source reports declare deterministic long-sequence distance handling; combined values are not recomputed.`,
      humanQualityRowCount === 0
        ? "No explicit human quality rows are present, so no human-quality ranking is emitted."
        : `${humanQualityRowCount} explicit human quality rows are present but are not mixed into automated quality.`,
    ],
  };

  return {
    report,
    markdown,
    html: renderCombinedDashboard(dashboardModel),
    runCount: runs.length,
    providerCount: aggregated.length,
  };
}

export function writeUrlCombinedReport(rootDirRaw: string): UrlCombinedBuildResult {
  const rootDir = resolve(rootDirRaw);
  const result = buildUrlCombinedReport(rootDir);
  const jsonPath = join(rootDir, "combined-comparison-report.json");
  const markdownPath = join(rootDir, "combined-comparison-report.md");
  const htmlPath = join(rootDir, "combined-comparison-report.html");
  writeFileSync(jsonPath, `${JSON.stringify(result.report, null, 2)}\n`);
  writeFileSync(markdownPath, result.markdown);
  writeFileSync(htmlPath, result.html);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${markdownPath}`);
  console.log(`Wrote ${htmlPath}`);
  console.log(`Aggregated ${result.providerCount} providers across ${result.runCount} URL runs.`);
  return result;
}

function main(): number {
  const rootRaw = process.argv[2];
  if (!rootRaw || rootRaw === "--help" || rootRaw === "-h") {
    console.log("Usage: bun scripts/url/build_combined_report.ts <root_dir>");
    return rootRaw ? 0 : 1;
  }
  writeUrlCombinedReport(rootRaw);
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
