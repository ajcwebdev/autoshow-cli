import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface DashboardMetricCell {
  display: string;
  rank: number | null;
  /** Raw comparable magnitude used by the custom-weighting control; omit or null when unavailable. */
  value?: number | null;
}

/** Which direction of a raw metric value counts as better within a group. */
export type MetricDirection = "higher" | "lower";

export interface DashboardMetricDirections {
  quality: MetricDirection;
  speed: MetricDirection;
  cost: MetricDirection;
}

export interface DashboardProviderRow {
  providerKey: string;
  display: string;
  model: string;
  coverage: string;
  quality: DashboardMetricCell;
  speed: DashboardMetricCell;
  cost: DashboardMetricCell;
  evidence: string[];
  perRun: Array<{ display: string; heat: number | null }>;
}

export interface DashboardGroup {
  key: string;
  label: string;
  metricColumns: { quality: string; speed: string; cost: string };
  metricDirections: DashboardMetricDirections;
  evidenceColumns: string[];
  perRunMetricLabel?: string;
  showPerRun?: boolean;
  providers: DashboardProviderRow[];
}

export interface DashboardRunInventoryCell {
  display: string;
  href?: string;
  /** Explicit run-relative artifact links; ordinary source URLs remain HTTP(S)-only. */
  artifactHref?: string;
}

export interface DashboardRunInventoryColumn {
  key: string;
  label: string;
}

export interface DashboardRun {
  runName: string;
  shortLabel: string;
  detail: string;
  inventory?: Record<string, DashboardRunInventoryCell>;
}

export interface CombinedDashboardModel {
  title: string;
  category: string;
  generatedAt: string;
  rootDir: string;
  summaryStats: Array<{ label: string; value: string }>;
  runs: DashboardRun[];
  runInventoryColumns?: DashboardRunInventoryColumn[];
  groups: DashboardGroup[];
  methodParagraphs: string[];
  notes: string[];
  sampleTables?: Array<{ title: string; columns: string[]; rows: DashboardRunInventoryCell[][]; notes?: string[] }>;
}

export interface BenchmarkDashboardTab {
  key: string;
  label: string;
  rootLabel: string;
  model: CombinedDashboardModel;
}

/** Sibling file names the page links or loads by relative name; plain names only, no directories or URLs. */
export interface DashboardAssetNames {
  stylesheet: string;
  script: string;
  data: string;
}

export const DEFAULT_DASHBOARD_ASSETS: DashboardAssetNames = {
  stylesheet: "combined-comparison-dashboard.css",
  script: "combined-comparison-dashboard.js",
  data: "combined-comparison-dashboard.json",
};

export interface BenchmarkDashboardPage {
  title: string;
  generatedAt: string;
  tabs: BenchmarkDashboardTab[];
  /** Defaults to `DEFAULT_DASHBOARD_ASSETS`; all three files are written beside the page. */
  assets?: DashboardAssetNames;
}

export const DASHBOARD_DATA_SCHEMA_VERSION = 1;

/** Contents of the dashboard's JSON file: everything the browser script renders. */
export interface BenchmarkDashboardData {
  schemaVersion: typeof DASHBOARD_DATA_SCHEMA_VERSION;
  title: string;
  generatedAt: string;
  tabs: BenchmarkDashboardTab[];
}

/** The four files a dashboard build writes: the static page shell, its data, and the stylesheet and script it links. */
export interface BenchmarkDashboardBundle {
  html: string;
  data: string;
  stylesheet: string;
  script: string;
}

/** The browser renderer and stylesheet, copied verbatim beside every generated page. */
export const DASHBOARD_CLIENT_SCRIPT = join(import.meta.dir, "dashboard_client.js");
export const DASHBOARD_CLIENT_STYLESHEET = join(import.meta.dir, "dashboard_client.css");

const TAB_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;
const ASSET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assertAssetName(name: string, extension: ".css" | ".js" | ".json"): string {
  if (!ASSET_NAME_PATTERN.test(name) || !name.endsWith(extension) || name.includes("..")) {
    throw new Error(`Invalid dashboard asset name: ${name} (expected a sibling file name ending in ${extension})`);
  }
  return name;
}

function assertTabs(tabs: BenchmarkDashboardTab[]): void {
  if (tabs.length === 0) {
    throw new Error("renderBenchmarkDashboard requires at least one tab");
  }
  const seen = new Set<string>();
  for (const tab of tabs) {
    if (!TAB_KEY_PATTERN.test(tab.key)) {
      throw new Error(`Invalid dashboard tab key: ${tab.key}`);
    }
    if (seen.has(tab.key)) {
      throw new Error(`Duplicate dashboard tab key: ${tab.key}`);
    }
    seen.add(tab.key);
  }
}

/**
 * The static page: no data, tables, or timestamps. `main[data-source]` names the JSON the sibling
 * script fetches and renders, so the shell only changes when the title or asset names do.
 */
export function renderDashboardShell(title: string, assets: DashboardAssetNames = DEFAULT_DASHBOARD_ASSETS): string {
  const stylesheet = assertAssetName(assets.stylesheet, ".css");
  const script = assertAssetName(assets.script, ".js");
  const data = assertAssetName(assets.data, ".json");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${esc(stylesheet)}">
</head>
<body>
<main class="dashboard" data-source="${esc(data)}">
<h1>${esc(title)}</h1>
<noscript><p class="notes">This page renders <code>${esc(data)}</code> in the browser and needs JavaScript. The same rankings are in each root's <code>combined-comparison-report.md</code>.</p></noscript>
<p class="status">Loading <code>${esc(data)}</code></p>
</main>
<script src="${esc(script)}"></script>
</body>
</html>
`;
}

export function renderBenchmarkDashboard(page: BenchmarkDashboardPage): BenchmarkDashboardBundle {
  assertTabs(page.tabs);
  const assets = page.assets ?? DEFAULT_DASHBOARD_ASSETS;
  const data: BenchmarkDashboardData = {
    schemaVersion: DASHBOARD_DATA_SCHEMA_VERSION,
    title: page.title,
    generatedAt: page.generatedAt,
    tabs: page.tabs,
  };
  return {
    html: renderDashboardShell(page.title, assets),
    data: `${JSON.stringify(data, null, 2)}\n`,
    stylesheet: readFileSync(DASHBOARD_CLIENT_STYLESHEET, "utf8"),
    script: readFileSync(DASHBOARD_CLIENT_SCRIPT, "utf8"),
  };
}
