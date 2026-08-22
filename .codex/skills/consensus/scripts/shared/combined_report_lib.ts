
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CombinedRunRef {
  runName: string;
  runDir: string;
  reportPath: string;
  providerCount: number;
}

export function discoverCombinedRuns(rootDir: string, perRunReportFilename: string): CombinedRunRef[] {
  const runs: CombinedRunRef[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const reportPath = join(rootDir, entry.name, perRunReportFilename);
    if (!existsSync(reportPath)) {
      continue;
    }
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as { runName?: string; runDir?: string; providerCount?: number };
    runs.push({
      runName: report.runName ?? entry.name,
      runDir: report.runDir ?? join(rootDir, entry.name),
      reportPath,
      providerCount: report.providerCount ?? 0,
    });
  }
  runs.sort((left, right) => left.runName.localeCompare(right.runName));
  return runs;
}

export type WeightSetKey =
  | "strongQuality"
  | "moderateQuality"
  | "strongSpeed"
  | "moderateSpeed"
  | "strongCost"
  | "moderateCost"
  | "qualityCost"
  | "costSpeed";

export interface WeightSet {
  label: string;
  quality: number;
  speed: number;
  cost: number;
}

export const WEIGHT_SET_KEYS: WeightSetKey[] = [
  "strongQuality",
  "moderateQuality",
  "strongSpeed",
  "moderateSpeed",
  "strongCost",
  "moderateCost",
  "qualityCost",
  "costSpeed",
];

export const WEIGHT_SETS: Record<WeightSetKey, WeightSet> = {
  strongQuality: { label: "Strong quality (0.8 quality / 0.1 speed / 0.1 cost)", quality: 0.8, speed: 0.1, cost: 0.1 },
  moderateQuality: { label: "Moderate quality (0.6 quality / 0.2 speed / 0.2 cost)", quality: 0.6, speed: 0.2, cost: 0.2 },
  strongSpeed: { label: "Strong speed (0.1 quality / 0.8 speed / 0.1 cost)", quality: 0.1, speed: 0.8, cost: 0.1 },
  moderateSpeed: { label: "Moderate speed (0.2 quality / 0.6 speed / 0.2 cost)", quality: 0.2, speed: 0.6, cost: 0.2 },
  strongCost: { label: "Strong cost (0.1 quality / 0.1 speed / 0.8 cost)", quality: 0.1, speed: 0.1, cost: 0.8 },
  moderateCost: { label: "Moderate cost (0.2 quality / 0.2 speed / 0.6 cost)", quality: 0.2, speed: 0.2, cost: 0.6 },
  qualityCost: { label: "Quality + cost (0.45 quality / 0.10 speed / 0.45 cost)", quality: 0.45, speed: 0.1, cost: 0.45 },
  costSpeed: { label: "Cost + speed (0.10 quality / 0.45 speed / 0.45 cost)", quality: 0.1, speed: 0.45, cost: 0.45 },
};

export type SubscoreDimension = "quality" | "speed" | "cost";

const SUBSCORE_DIMENSIONS: SubscoreDimension[] = ["quality", "speed", "cost"];

export interface CombinedSample {
  runName: string;
  quality: number | null;
  timeMs: number | null;
  costCents: number | null;
}

export interface CombinedProviderInput {
  providerKey: string;
  provider: string;
  model: string;
  display?: string;
  samples: CombinedSample[];
}

export interface ProviderSubscores {
  providerKey: string;
  provider: string;
  model: string;
  display?: string;
  runsCovered: number;
  subscores: Record<SubscoreDimension, number>;
  subscoreRunCounts: Record<SubscoreDimension, number>;
  missingDimensions: SubscoreDimension[];
  balancedComposite: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sampleValue(sample: CombinedSample, dimension: SubscoreDimension): number | null {
  if (dimension === "quality") {
    return isFiniteNumber(sample.quality) ? sample.quality : null;
  }
  if (dimension === "speed") {
    return isFiniteNumber(sample.timeMs) ? sample.timeMs : null;
  }
  return isFiniteNumber(sample.costCents) ? sample.costCents : null;
}

export function computeGroupSubscores(providers: CombinedProviderInput[], runNames: string[]): ProviderSubscores[] {
  const sums = new Map<string, Record<SubscoreDimension, number>>();
  const counts = new Map<string, Record<SubscoreDimension, number>>();
  for (const provider of providers) {
    sums.set(provider.providerKey, { quality: 0, speed: 0, cost: 0 });
    counts.set(provider.providerKey, { quality: 0, speed: 0, cost: 0 });
  }

  for (const runName of runNames) {
    for (const dimension of SUBSCORE_DIMENSIONS) {
      const pool: Array<{ providerKey: string; value: number }> = [];
      for (const provider of providers) {
        const sample = provider.samples.find((item) => item.runName === runName);
        if (!sample) {
          continue;
        }
        const value = sampleValue(sample, dimension);
        if (value !== null) {
          pool.push({ providerKey: provider.providerKey, value });
        }
      }
      if (pool.length === 0) {
        continue;
      }
      const values = pool.map((item) => item.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      for (const item of pool) {
        let subscore: number;
        if (max === min) {
          subscore = 100;
        } else if (dimension === "quality") {
          subscore = (100 * (item.value - min)) / (max - min);
        } else {
          subscore = 100 * (1 - (item.value - min) / (max - min));
        }
        sums.get(item.providerKey)![dimension] += subscore;
        counts.get(item.providerKey)![dimension] += 1;
      }
    }
  }

  return providers.map((provider) => {
    const providerSums = sums.get(provider.providerKey)!;
    const providerCounts = counts.get(provider.providerKey)!;
    const subscores = { quality: 0, speed: 0, cost: 0 };
    const missingDimensions: SubscoreDimension[] = [];
    for (const dimension of SUBSCORE_DIMENSIONS) {
      if (providerCounts[dimension] > 0) {
        subscores[dimension] = providerSums[dimension] / providerCounts[dimension];
      } else {
        missingDimensions.push(dimension);
      }
    }
    return {
      providerKey: provider.providerKey,
      provider: provider.provider,
      model: provider.model,
      ...(provider.display === undefined ? {} : { display: provider.display }),
      runsCovered: provider.samples.length,
      subscores,
      subscoreRunCounts: { ...providerCounts },
      missingDimensions,
      balancedComposite: (subscores.quality + subscores.speed + subscores.cost) / 3,
    };
  });
}

export interface WeightedRankingEntry {
  rank: number;
  providerKey: string;
  provider: string;
  model: string;
  display?: string;
  group: string;
  weightSet: WeightSetKey;
  runsCovered: number;
  composite: number;
  subscores: Record<SubscoreDimension, number>;
  subscoreRunCounts: Record<SubscoreDimension, number>;
  missingDimensions: SubscoreDimension[];
}

export function computeWeightedRankings(
  subscored: ProviderSubscores[],
  group: string,
): Record<WeightSetKey, WeightedRankingEntry[]> {
  const rankings = {} as Record<WeightSetKey, WeightedRankingEntry[]>;
  for (const key of WEIGHT_SET_KEYS) {
    const weights = WEIGHT_SETS[key];
    rankings[key] = [...subscored]
      .map((provider) => ({
        provider,
        composite:
          weights.quality * provider.subscores.quality +
          weights.speed * provider.subscores.speed +
          weights.cost * provider.subscores.cost,
      }))
      .sort((left, right) => {
        if (right.composite !== left.composite) {
          return right.composite - left.composite;
        }
        if (right.provider.subscores.quality !== left.provider.subscores.quality) {
          return right.provider.subscores.quality - left.provider.subscores.quality;
        }
        return left.provider.providerKey.localeCompare(right.provider.providerKey);
      })
      .map((item, index) => ({
        rank: index + 1,
        providerKey: item.provider.providerKey,
        provider: item.provider.provider,
        model: item.provider.model,
        ...(item.provider.display === undefined ? {} : { display: item.provider.display }),
        group,
        weightSet: key,
        runsCovered: item.provider.runsCovered,
        composite: item.composite,
        subscores: { ...item.provider.subscores },
        subscoreRunCounts: { ...item.provider.subscoreRunCounts },
        missingDimensions: [...item.provider.missingDimensions],
      }));
  }
  return rankings;
}

export const TIERING_METHOD = "quality-cost-terciles-v1";
export const TIERING_RANKING = "qualityCost";
export const TIERING_TIE_BREAK = "composite-desc, quality-subscore-desc, providerKey-asc";

export interface TierProviderRow {
  providerKey: string;
  provider: string;
  model: string;
  display?: string;
  qualityCostRank: number;
  qualityCostComposite: number;
}

export interface TierRow {
  tier: number;
  label: string;
  description: string;
  count: number;
  providers: TierProviderRow[];
}

export interface CombinedTiering {
  method: typeof TIERING_METHOD;
  ranking: typeof TIERING_RANKING;
  providerCount: number;
  tieBreak: string;
  tiers: TierRow[];
}

export function qualityCostTercileSizes(providerCount: number): [number, number, number] {
  const baseSize = Math.floor(providerCount / 3);
  const remainder = providerCount % 3;
  return [baseSize + (remainder >= 1 ? 1 : 0), baseSize + (remainder >= 2 ? 1 : 0), baseSize];
}

function tierDescription(tier: number, providers: TierProviderRow[]): string {
  const band = tier === 1 ? "Highest" : tier === 2 ? "Middle" : "Lower";
  if (providers.length === 0) {
    return `${band} quality-cost tercile; no models fall in this tier for this group size.`;
  }
  const firstRank = providers[0]!.qualityCostRank;
  const lastRank = providers.at(-1)!.qualityCostRank;
  const range = firstRank === lastRank ? `rank ${firstRank}` : `ranks ${firstRank}-${lastRank}`;
  return `${band} quality-cost tercile (${range}).`;
}

export function buildQualityCostTiering(qualityCostRanking: WeightedRankingEntry[]): CombinedTiering {
  const providerCount = qualityCostRanking.length;
  const sizes = qualityCostTercileSizes(providerCount);
  let offset = 0;
  const tiers: TierRow[] = sizes.map((size, index) => {
    const tier = index + 1;
    const providers = qualityCostRanking.slice(offset, offset + size).map((entry) => ({
      providerKey: entry.providerKey,
      provider: entry.provider,
      model: entry.model,
      ...(entry.display === undefined ? {} : { display: entry.display }),
      qualityCostRank: entry.rank,
      qualityCostComposite: entry.composite,
    }));
    offset += size;
    return {
      tier,
      label: `Tier ${tier}`,
      description: tierDescription(tier, providers),
      count: providers.length,
      providers,
    };
  });

  return {
    method: TIERING_METHOD,
    ranking: TIERING_RANKING,
    providerCount,
    tieBreak: TIERING_TIE_BREAK,
    tiers,
  };
}

const WEIGHTED_TABLE_HEADER =
  "| Rank | Provider | Coverage | Composite | Q | S | C |\n| ---: | --- | ---: | ---: | ---: | ---: | ---: |";

export function weightedRankingTable(entries: WeightedRankingEntry[], runCount: number): string {
  if (entries.length === 0) {
    return `${WEIGHTED_TABLE_HEADER}\n| n/a | n/a | n/a | n/a | n/a | n/a | No providers in this group. |`;
  }
  const rows = entries.map(
    (entry) =>
      `| ${entry.rank} | <code>${entry.display ?? entry.provider}</code> | ${entry.runsCovered}/${runCount} | ${entry.composite.toFixed(2)} | ${entry.subscores.quality.toFixed(2)} | ${entry.subscores.speed.toFixed(2)} | ${entry.subscores.cost.toFixed(2)} |`,
  );
  const lines = [`${WEIGHTED_TABLE_HEADER}\n${rows.join("\n")}`];
  const missing = entries.filter((entry) => entry.missingDimensions.length > 0);
  if (missing.length > 0) {
    lines.push("");
    for (const entry of missing) {
      lines.push(
        `- <code>${entry.display ?? entry.provider}</code> has no ${entry.missingDimensions.join("/")} value in any covered run; the missing dimension scores 0.`,
      );
    }
  }
  return lines.join("\n");
}

export function tierTable(tiering: CombinedTiering): string {
  const header = "| Tier | Models (quality-cost rank · composite) | Basis |\n| --- | --- | --- |";
  const rows = tiering.tiers.map((tier) => {
    const models =
      tier.providers.length === 0
        ? "none"
        : tier.providers
            .map(
              (provider) =>
                `<code>${provider.display ?? provider.provider}</code> (#${provider.qualityCostRank} · ${provider.qualityCostComposite.toFixed(2)})`,
            )
            .join(", ");
    return `| ${tier.label} | ${models} | ${tier.description} |`;
  });
  return `${header}\n${rows.join("\n")}`;
}

export function weightSetTable(): string {
  const header = "| Weight set | Quality | Speed | Cost |\n| --- | ---: | ---: | ---: |";
  const rows = WEIGHT_SET_KEYS.map((key) => {
    const weights = WEIGHT_SETS[key];
    const name = weights.label.replace(/ \(.*\)$/, "");
    return `| ${name} | ${formatWeight(weights.quality)} | ${formatWeight(weights.speed)} | ${formatWeight(weights.cost)} |`;
  });
  return `${header}\n${rows.join("\n")}`;
}

export function formatWeight(value: number): string {
  return value.toFixed(2).replace(/0$/, "");
}

export const WEIGHTED_METHOD_LINES: string[] = [
  "**Weighted composites** are built separately for each provider group in three steps:",
  "",
  "1. Within each run and provider group, every provider gets three 0-100 subscores. **Q** = `100 * (value - min) / (max - min)` over quality score (higher is better). **S** and **C** = `100 * (1 - (value - min) / (max - min))` over processing time and cost (lower is better). If a dimension has identical min/max values, every pooled provider receives 100 for that dimension.",
  "2. Each provider's Q, S, and C are averaged across the runs it participated in. A provider missing a value in a run is excluded from that run's normalization pool for that dimension; a dimension missing in every covered run scores 0 and is flagged under the affected tables.",
  "3. Composite = `w_q*Q + w_s*S + w_c*C` for each weight set below.",
  "",
  weightSetTable(),
];

export const TIERING_METHOD_LINES: string[] = [
  `**Model tiers** are computed per group with \`${TIERING_METHOD}\` from the group's \`${TIERING_RANKING}\` weighted ranking only; groups are never compared against each other. That ranking orders composite descending, then quality subscore descending, then provider key. Its models are divided into three contiguous tiers of \`floor(n / 3)\` models, with remainder models assigned to Tier 1 and then Tier 2. Every model appears exactly once.`,
];

export const MISSING_DATA_POLICY =
  "provider missing a value in a run is excluded from that run's normalization pool for that dimension; a dimension missing in all covered runs scores 0 and is listed in missingDimensions";

export const WEIGHTED_COMPOSITE_POLICY =
  "per-run per-group min-max 0-100 subscores (Q higher-better; S/C lower-better; identical min/max => 100), averaged across covered runs; composite = w_q*Q + w_s*S + w_c*C";
