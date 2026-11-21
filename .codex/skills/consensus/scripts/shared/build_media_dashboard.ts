import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { isRecord, loadCanonicalRunRecord, type JsonObject } from "./pipeline_manifest";
import type {
  CombinedDashboardModel,
  DashboardGroup,
  DashboardProviderRow,
  DashboardRunInventoryCell,
} from "./combined_report_html";
import { toProjectRelativePath } from "../../../../../src/utils/project-root";

/** Generation categories whose benchmark roots hold per-run reports but no generated combined report. */
export type MediaDashboardCategory = "image" | "video" | "music";

interface MediaCategorySpec {
  label: string;
  outputNoun: string;
  serviceField: string;
  modelField: string;
  files: (entry: JsonObject) => string[];
  qualityProxies: string;
}

const text = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

const MEDIA_CATEGORIES: Record<MediaDashboardCategory, MediaCategorySpec> = {
  image: {
    label: "Image",
    outputNoun: "image",
    serviceField: "imageService",
    modelField: "imageModel",
    files: entry => Array.isArray(entry["imageFileNames"]) ? entry["imageFileNames"].map(text).filter((name): name is string => name !== null) : [],
    qualityProxies: "dimensions, file size",
  },
  video: {
    label: "Video",
    outputNoun: "video",
    serviceField: "videoGenService",
    modelField: "videoGenModel",
    files: entry => [text(entry["videoFileName"])].filter((name): name is string => name !== null),
    qualityProxies: "duration, resolution, file size",
  },
  music: {
    label: "Music",
    outputNoun: "track",
    serviceField: "musicService",
    modelField: "musicModel",
    files: entry => [text(entry["musicFileName"])].filter((name): name is string => name !== null),
    qualityProxies: "duration, bitrate, file size, lyrics metadata",
  },
};

const GROUPS = [
  { key: "local", label: "Local providers" },
  { key: "service", label: "Service providers" },
] as const;

type MediaGroupKey = (typeof GROUPS)[number]["key"];

export interface MediaDashboardSample {
  runName: string;
  group: MediaGroupKey;
  providerKey: string;
  model: string;
  processingMs: number | null;
  costCents: number | null;
  costBasis: string;
  automatedQuality: number | null;
  humanQuality: number | null;
  artifactHrefs: string[];
}

interface MediaDashboardRun {
  runName: string;
  prompt: string;
  reportHref: string;
  evaluationHref: string | null;
  samples: MediaDashboardSample[];
}

const COST_BASIS_LABELS: Record<string, string> = {
  provider_usage: "provider usage",
  provider_quote: "provider quote",
  registry_fallback: "registry rate",
};

const money = (cents: number | null): string => cents === null ? "n/a" : `$${(cents / 100).toFixed(4)}`;
const seconds = (ms: number | null): string => ms === null ? "n/a" : `${(ms / 1000).toFixed(2)}s`;
const mean = (values: (number | null)[]): number | null => {
  const recorded = values.filter((value): value is number => value !== null);
  return recorded.length ? recorded.reduce((sum, value) => sum + value, 0) / recorded.length : null;
};
const score = (value: number | null): string => value === null ? "n/a" : value.toFixed(2);
const qualityScore = (value: unknown): number | null => typeof value === "number" && value >= 0 && value <= 100 ? value : null;
const modelOf = (providerKey: string): string => providerKey.slice(providerKey.indexOf("/") + 1);

/** Retained run directories: a canonical manifest plus a consensus `provider-comparison-report.json`. */
export function discoverMediaRuns(rootDir: string): string[] {
  const root = resolve(rootDir);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory()
      && existsSync(join(root, entry.name, "manifest.json"))
      && existsSync(join(root, entry.name, "provider-comparison-report.json")))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function reportProviders(report: JsonObject, group: MediaGroupKey): JsonObject[] {
  const groups = isRecord(report["providerGroups"]) ? report["providerGroups"] : {};
  const section = groups[group];
  const providers = isRecord(section) ? section["providers"] : undefined;
  return Array.isArray(providers) ? providers.filter(isRecord) : [];
}

function actualSteps(section: unknown, category: MediaDashboardCategory): JsonObject[] {
  const actual = isRecord(section) ? section["actual"] : undefined;
  if (!isRecord(actual) || !Array.isArray(actual["steps"])) return [];
  return actual["steps"].filter((step): step is JsonObject => isRecord(step) && (step["step"] === category || step["step"] === undefined));
}

function loadRun(category: MediaDashboardCategory, root: string, linkRoot: string, runName: string): MediaDashboardRun {
  const spec = MEDIA_CATEGORIES[category];
  const runDir = join(root, runName);
  const href = (path: string) => relative(linkRoot, path).split("\\").join("/");
  const record = loadCanonicalRunRecord(runDir, category);
  const report = JSON.parse(readFileSync(join(runDir, "provider-comparison-report.json"), "utf8")) as unknown;
  if (!isRecord(report)) throw new Error(`Invalid ${category} provider comparison report: ${runName}`);

  const entries = Array.isArray(record.metadata[category]) ? (record.metadata[category] as unknown[]).filter(isRecord) : [];
  const costs = actualSteps(record.metadata["cost"], category);
  const timings = actualSteps(record.metadata["timing"], category);
  const identity = (service: unknown, model: unknown): string | null => text(service) && text(model) ? `${service}/${model}` : null;

  const samples: MediaDashboardSample[] = [];
  for (const group of GROUPS) {
    for (const provider of reportProviders(report, group.key)) {
      const providerKey = text(provider["providerKey"]);
      if (!providerKey) continue;
      const entry = entries.find(row => identity(row[spec.serviceField], row[spec.modelField]) === providerKey);
      const matchesProvider = (row: JsonObject) => identity(row["provider"], row["model"]) === providerKey;
      const costStep = costs.find(matchesProvider);
      const timingStep = timings.find(matchesProvider);
      const stepCost = finite(costStep?.["cost"]);
      const costCents = stepCost ?? finite(entry?.["providerCostCents"]);
      const basis = text(stepCost === null ? entry?.["providerCostSource"] : costStep?.["costSource"]);
      const metrics = isRecord(provider["metrics"]) ? provider["metrics"] : {};
      samples.push({
        runName,
        group: group.key,
        providerKey,
        model: modelOf(providerKey),
        processingMs: finite(timingStep?.["processingTimeMs"]) ?? finite(entry?.["processingTime"]),
        costCents: group.key === "local" ? 0 : costCents,
        costBasis: group.key === "local" ? "local" : costCents !== null && basis ? COST_BASIS_LABELS[basis] ?? basis : "unrecorded",
        automatedQuality: qualityScore(metrics["qualityScore"]) ?? qualityScore(provider["qualityScore"]),
        humanQuality: qualityScore(metrics["humanQualityScore"]) ?? qualityScore(provider["humanQualityScore"]),
        artifactHrefs: entry ? spec.files(entry).map(name => href(join(runDir, name))) : [],
      });
    }
  }

  const evaluationPath = join(runDir, "consensus-evaluation.txt");
  return {
    runName,
    prompt: record.item.input ?? "n/a",
    reportHref: href(join(runDir, "provider-comparison-report.md")),
    evaluationHref: existsSync(evaluationPath) ? href(evaluationPath) : null,
    samples,
  };
}

function rankRows(rows: DashboardProviderRow[]): void {
  for (const metric of ["quality", "speed", "cost"] as const) {
    const direction = metric === "quality" ? -1 : 1;
    const ranked = rows.filter(row => row[metric].value !== null && row[metric].value !== undefined)
      .sort((left, right) => direction * (left[metric].value! - right[metric].value!) || left.providerKey.localeCompare(right.providerKey));
    ranked.forEach((row, index) => {
      const previous = ranked[index - 1];
      row[metric].rank = previous && previous[metric].value === row[metric].value ? previous[metric].rank : index + 1;
    });
  }
}

function buildGroup(key: MediaGroupKey, label: string, samples: MediaDashboardSample[], runCount: number): DashboardGroup {
  const hasAutomated = samples.some(sample => sample.automatedQuality !== null);
  const hasHuman = samples.some(sample => sample.humanQuality !== null);
  const keys = [...new Set(samples.map(sample => sample.providerKey))].sort((left, right) => left.localeCompare(right));
  const providers: DashboardProviderRow[] = keys.map(providerKey => {
    const rows = samples.filter(sample => sample.providerKey === providerKey);
    const meanMs = mean(rows.map(row => row.processingMs));
    const meanHuman = mean(rows.map(row => row.humanQuality));
    const quality = hasAutomated ? mean(rows.map(row => row.automatedQuality)) : meanHuman;
    const costs = rows.map(row => row.costCents).filter((value): value is number => value !== null);
    const meanCents = mean(costs);
    const bases = [...new Set(rows.map(row => row.costBasis))].sort();
    return {
      providerKey,
      display: providerKey,
      model: rows[0]!.model,
      coverage: `${rows.length}/${runCount}`,
      quality: { display: score(quality), rank: null, value: quality },
      speed: { display: seconds(meanMs), rank: null, value: meanMs === null ? null : meanMs / 1000 },
      cost: { display: money(meanCents), rank: null, value: meanCents === null ? null : meanCents / 100 },
      evidence: [bases.join(", "), costs.length === rows.length ? money(costs.reduce((sum, value) => sum + value, 0)) : "n/a",
        ...(hasAutomated && hasHuman ? [score(meanHuman)] : [])],
      perRun: [],
    };
  });
  rankRows(providers);
  return {
    key,
    label,
    metricColumns: { quality: hasAutomated ? "Mean automated quality" : hasHuman ? "Mean human quality" : "Quality", speed: "Mean time", cost: "Mean cost" },
    metricDirections: { quality: "higher", speed: "lower", cost: "lower" },
    evidenceColumns: ["Cost basis", "Total cost", ...(hasAutomated && hasHuman ? ["Mean human quality"] : [])],
    showPerRun: false,
    providers,
  };
}

function leader(samples: MediaDashboardSample[], field: "costCents" | "processingMs"): DashboardRunInventoryCell {
  const best = samples.filter(sample => sample.group === "service" && sample[field] !== null)
    .sort((left, right) => left[field]! - right[field]! || left.providerKey.localeCompare(right.providerKey))[0];
  if (!best) return { display: "n/a" };
  return { display: `${best.providerKey} (${field === "costCents" ? money(best.costCents) : seconds(best.processingMs)})` };
}

const shortPrompt = (prompt: string): string => prompt.length > 120 ? `${prompt.slice(0, 117).trimEnd()}...` : prompt;

function artifactCell(hrefs: string[]): DashboardRunInventoryCell {
  if (!hrefs.length) return { display: "n/a" };
  if (hrefs.length === 1) return { display: "Artifact", artifactHref: hrefs[0]! };
  return {
    display: `${hrefs.length} artifacts`,
    artifactLinks: hrefs.map((artifactHref, index) => ({ display: `Artifact ${index + 1}`, artifactHref })),
  };
}

/**
 * Builds a dashboard tab for an image, video or music benchmark root from its retained per-run consensus
 * reports and manifests. Only explicit judge and human scores supply quality evidence.
 */
export function buildMediaDashboard(
  category: MediaDashboardCategory,
  rootDir: string,
  generatedAt = new Date().toISOString(),
): { dashboardModel: CombinedDashboardModel; samples: MediaDashboardSample[] } {
  const spec = MEDIA_CATEGORIES[category];
  const root = resolve(rootDir);
  const linkRoot = dirname(root);
  const runs = discoverMediaRuns(root).map(runName => loadRun(category, root, linkRoot, runName));
  const samples = runs.flatMap(run => run.samples);
  const populatedGroups = GROUPS.filter(group => samples.some(sample => sample.group === group.key));
  const groups = (populatedGroups.length > 0 ? populatedGroups : GROUPS.filter(group => group.key === "service"))
    .map(group => buildGroup(group.key, group.label, samples.filter(sample => sample.group === group.key), runs.length));
  const recordedCosts = samples.map(sample => sample.costCents).filter((value): value is number => value !== null);
  const automatedCount = samples.filter(sample => sample.automatedQuality !== null).length;
  const humanCount = samples.filter(sample => sample.humanQuality !== null).length;
  const combinedReports = existsSync(root)
    ? readdirSync(root).filter(name => name.endsWith("_combined-provider-comparison-report.md")).sort()
    : [];
  const runShortLabel = (index: number) => `${category[0]!.toUpperCase()}${index + 1}`;

  const dashboardModel: CombinedDashboardModel = {
    title: `${spec.label} benchmark results`,
    category,
    generatedAt,
    rootDir: toProjectRelativePath(root),
    summaryStats: [
      { label: "Runs", value: String(runs.length) },
      { label: "Providers", value: String(new Set(samples.map(sample => sample.providerKey)).size) },
      { label: "Provider rows", value: String(samples.length) },
      { label: "Recorded cost", value: recordedCosts.length === samples.length ? money(recordedCosts.reduce((sum, value) => sum + value, 0)) : "Incomplete" },
      { label: "Quality scores", value: automatedCount || humanCount ? `${automatedCount} automated / ${humanCount} human` : "Unavailable" },
    ],
    runInventoryColumns: [
      { key: "prompt", label: "Prompt" },
      { key: "servicePrice", label: "Cheapest service" },
      { key: "serviceSpeed", label: "Fastest service" },
      { key: "report", label: "Report" },
      { key: "evaluation", label: "Evaluation" },
    ],
    runs: runs.map((run, index) => {
      const service = run.samples.filter(sample => sample.group === "service").length;
      const local = run.samples.length - service;
      return {
        runName: run.runName,
        shortLabel: runShortLabel(index),
        detail: `${local} local / ${service} service`,
        inventory: {
          prompt: { display: shortPrompt(run.prompt) },
          servicePrice: leader(run.samples, "costCents"),
          serviceSpeed: leader(run.samples, "processingMs"),
          report: { display: "Report", artifactHref: run.reportHref },
          evaluation: run.evaluationHref ? { display: "Evaluation", artifactHref: run.evaluationHref } : { display: "n/a" },
        },
      };
    }),
    groups,
    methodParagraphs: [
      `Providers are matched by \`providerKey\` within each group across the retained ${spec.outputNoun} runs; means use available observations, and coverage counts the runs that include each model.`,
      `Speed uses the manifest's actual timing step or the provider entry's processing time. Cost uses the actual cost step or the cost recorded on the provider entry, in USD per ${spec.outputNoun} request. The cost basis identifies provider usage, a provider quote or a registry rate. Preflight estimates are excluded.`,
      automatedCount || humanCount
        ? "Quality rankings use the mean explicit automated score within each group. A group with only human scores ranks by mean human score. When both sources exist, human means appear separately. Each per-run score comes from its linked comparison report."
        : `The run reports contain no explicit quality scores. Sorting by quality falls back to speed, then cost. Artifact properties (${spec.qualityProxies}) have no effect on quality rankings.`,
    ],
    notes: [
      "Each run is a single request per model; these are not latency distributions or medians.",
      ...(combinedReports.length > 0
        ? [`Dated combined reports: ${combinedReports.map(name => `\`${basename(root)}/${name}\``).join(", ")}.`]
        : []),
      "Media artifacts are Git-ignored; artifact links resolve only where the files are retained locally.",
    ],
    sampleTables: [{
      title: "Per-run evidence",
      providerKeyColumn: 1,
      columns: ["Run", "Provider / model", "Seconds", "$ / request", "Cost basis",
        ...(automatedCount ? ["Automated quality / 100"] : []),
        ...(humanCount ? ["Human quality / 100"] : []), "Artifact"],
      rows: runs.flatMap((run, index) => run.samples.map(sample => [
        { display: runShortLabel(index) },
        { display: sample.providerKey },
        { display: seconds(sample.processingMs) },
        { display: money(sample.costCents) },
        { display: sample.costBasis },
        ...(automatedCount ? [{ display: score(sample.automatedQuality) }] : []),
        ...(humanCount ? [{ display: score(sample.humanQuality) }] : []),
        artifactCell(sample.artifactHrefs),
      ])),
    }],
  };
  return { dashboardModel, samples };
}
