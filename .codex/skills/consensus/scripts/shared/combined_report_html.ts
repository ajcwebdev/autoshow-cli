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
  providers: DashboardProviderRow[];
}

export interface DashboardRunInventoryCell {
  display: string;
  href?: string;
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
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mdInline(value: string): string {
  return esc(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

const CSS = `
:root { color-scheme: light dark; }
body {
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e;
  --muted: #898781; --grid: #e1e0d9; --border: rgba(11, 11, 11, 0.10);
  --accent: #2a78d6;
  --rank-green: #18743b; --rank-yellow: #876300; --rank-red: #b52c35;
  margin: 0; background: var(--page); color: var(--ink);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  body {
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7;
    --muted: #898781; --grid: #2c2c2a; --border: rgba(255, 255, 255, 0.10);
    --accent: #3987e5;
    --rank-green: #72d995; --rank-yellow: #f0cd62; --rank-red: #ff929a;
  }
}
main { max-width: 1100px; margin: 0 auto; padding: 24px 20px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 36px 0 12px; padding-top: 16px; border-top: 1px solid var(--grid); }
h3 { font-size: 13px; margin: 20px 0 8px; color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.04em; }
.meta { color: var(--muted); font-size: 12px; margin: 0 0 20px; }
.meta code { font-size: 11px; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.tiles { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 12px; }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; min-width: 110px; }
.tile .v { font-size: 20px; font-weight: 600; }
.tile .l { font-size: 12px; color: var(--ink-2); }
details { margin: 10px 0; }
summary { cursor: pointer; color: var(--ink-2); font-size: 13px; }
details[open] summary { margin-bottom: 8px; }
.tablewrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 6px 10px; text-align: left; white-space: nowrap; }
thead th { position: sticky; top: 0; background: var(--surface); color: var(--ink-2); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--grid); }
tbody td { border-bottom: 1px solid var(--grid); }
tbody tr:last-child td { border-bottom: none; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.rk { display: inline-block; min-width: 1.7em; text-align: center; border-radius: 6px; font-size: 11px; color: var(--rank-color); border: 1px solid var(--rank-color); background: color-mix(in srgb, var(--rank-color) 12%, transparent); margin-left: 6px; }
.rk.top { --rank-color: var(--rank-green); }
.rk.middle { --rank-color: var(--rank-yellow); }
.rk.bottom { --rank-color: var(--rank-red); }
.heat { text-align: right; font-variant-numeric: tabular-nums; background: color-mix(in srgb, var(--accent) calc(var(--h, 0) * 0.5%), transparent); }
.empty { color: var(--muted); font-style: italic; }
.notes { color: var(--ink-2); font-size: 12px; }
.run-link { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
.wtable td, .wtable th { font-size: 12px; }
caption { caption-side: bottom; text-align: left; color: var(--muted); font-size: 11px; padding: 6px 10px; }
.provider-sort { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.provider-sort > .sort-label { font-size: 12px; color: var(--ink-2); margin-right: 2px; }
.provider-sort > input[type="radio"] {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.provider-sort > .sort-opt {
  cursor: pointer; border: 1px solid var(--border); border-radius: 999px;
  padding: 4px 10px; font-size: 12px; color: var(--ink-2); background: var(--surface);
}
.provider-sort > input[type="radio"]:checked + .sort-opt {
  border-color: var(--accent); color: var(--ink);
  background: color-mix(in srgb, var(--accent) 12%, var(--surface));
}
.provider-sort > input[type="radio"]:focus-visible + .sort-opt {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.provider-sort > .tablewrap { flex: 1 0 100%; }
.provider-sort > .sort-speed, .provider-sort > .sort-cost { display: none; }
.provider-sort > input[value="speed"]:checked ~ .sort-quality,
.provider-sort > input[value="cost"]:checked ~ .sort-quality { display: none; }
.provider-sort > input[value="speed"]:checked ~ .sort-speed,
.provider-sort > input[value="cost"]:checked ~ .sort-cost { display: block; }
.provider-sort th[data-metric] label { cursor: pointer; color: inherit; font: inherit; text-transform: inherit; letter-spacing: inherit; }
.provider-sort > input[value="quality"]:checked ~ .sort-quality th[data-metric="quality"],
.provider-sort > input[value="speed"]:checked ~ .sort-speed th[data-metric="speed"],
.provider-sort > input[value="cost"]:checked ~ .sort-cost th[data-metric="cost"] { color: var(--ink); }
.provider-sort > .sort-custom { display: none; }
.provider-sort > input[value="custom"]:checked ~ .sort-quality,
.provider-sort > input[value="custom"]:checked ~ .sort-speed,
.provider-sort > input[value="custom"]:checked ~ .sort-cost { display: none; }
.provider-sort > input[value="custom"]:checked ~ .sort-custom { display: block; }
.provider-sort > .weights { display: none; }
.provider-sort > input[value="custom"]:checked ~ .weights { display: flex; }
.weights {
  flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-left: 4px;
  padding: 4px 10px; background: var(--page); border: 1px solid var(--border); border-radius: 999px;
}
.weights .w { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); }
.weights .w input[type="range"] { width: 92px; accent-color: var(--accent); }
.weights .w output { min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; color: var(--ink); }
.weights-reset {
  cursor: pointer; border: 1px solid var(--border); border-radius: 999px; padding: 2px 10px;
  font: inherit; font-size: 12px; color: var(--ink-2); background: var(--surface);
}
.weights-reset:hover { color: var(--ink); border-color: var(--accent); }
@media (max-width: 560px) { .weights .w input[type="range"] { width: 72px; } }
`;

function rankChip(rank: number | null, rankedCount: number): string {
  if (rank === null) {
    return "";
  }
  const tier = rank <= Math.ceil(rankedCount / 3) ? "top" : rank <= Math.ceil(2 * rankedCount / 3) ? "middle" : "bottom";
  return `<span class="rk ${tier}" title="${tier === "top" ? "Top" : tier === "middle" ? "Middle" : "Bottom"} third">${rank}</span>`;
}

function metricCell(cell: DashboardMetricCell, rankedCount: number): string {
  return `<td class="num">${esc(cell.display)}${rankChip(cell.rank, rankedCount)}</td>`;
}

function rankOrLast(rank: number | null): number {
  return rank ?? Number.POSITIVE_INFINITY;
}

type SortMetric = "quality" | "speed" | "cost";

const SORT_METRICS: SortMetric[] = ["quality", "speed", "cost"];
/** Starting split for the custom-weighting sliders; the three always total 100. */
const WEIGHT_DEFAULTS: Record<SortMetric, number> = { quality: 60, speed: 20, cost: 20 };
const SORT_LABELS: Record<SortMetric, string> = {
  quality: "Quality",
  speed: "Speed",
  cost: "Cost",
};

function compareByMetric(left: DashboardProviderRow, right: DashboardProviderRow, metric: SortMetric): number {
  const order: [SortMetric, SortMetric, SortMetric] = metric === "quality"
    ? ["quality", "speed", "cost"]
    : metric === "speed"
      ? ["speed", "quality", "cost"]
      : ["cost", "quality", "speed"];
  return rankOrLast(left[order[0]].rank) - rankOrLast(right[order[0]].rank)
    || rankOrLast(left[order[1]].rank) - rankOrLast(right[order[1]].rank)
    || rankOrLast(left[order[2]].rank) - rankOrLast(right[order[2]].rank)
    || left.providerKey.localeCompare(right.providerKey);
}

function sortControlId(groupKey: string, metric: SortMetric, idPrefix: string): string {
  return `sort-${idPrefix}${groupKey}-${metric}`;
}

function metricData(row: DashboardProviderRow): string {
  return (["quality", "speed", "cost"] as const)
    .map((metric) => {
      const value = row[metric].value;
      return typeof value === "number" && Number.isFinite(value) ? ` data-${metric[0]}="${value}"` : "";
    })
    .join("");
}

function providerRows(group: DashboardGroup, metric: SortMetric, includeData: boolean): string {
  const rankedCount = (key: SortMetric) => group.providers.filter((row) => row[key].rank !== null).length;
  return [...group.providers]
    .sort((left, right) => compareByMetric(left, right, metric))
    .map((row) => {
      const evidenceCells = row.evidence.map((value) => `<td class="num">${esc(value)}</td>`).join("");
      return (
        `<tr${includeData ? metricData(row) : ""}>` +
        `<td><code title="${esc(row.providerKey)}">${esc(row.display)}</code></td>` +
        `<td class="num">${esc(row.coverage)}</td>` +
        metricCell(row.quality, rankedCount("quality")) +
        metricCell(row.speed, rankedCount("speed")) +
        metricCell(row.cost, rankedCount("cost")) +
        evidenceCells +
        `</tr>`
      );
    })
    .join("\n");
}

function providerTable(group: DashboardGroup, idPrefix: string): string {
  const evidenceHeaders = group.evidenceColumns.map((column) => `<th class="num">${esc(column)}</th>`).join("");
  const radios = SORT_METRICS.map((metric, index) => {
    const id = sortControlId(group.key, metric, idPrefix);
    const checked = index === 0 ? " checked" : "";
    return (
      `<input type="radio" name="sort-${esc(idPrefix)}${esc(group.key)}" id="${esc(id)}" value="${metric}"${checked}>` +
      `<label class="sort-opt" for="${esc(id)}">${SORT_LABELS[metric]}</label>`
    );
  }).join("");
  const tables = SORT_METRICS.map((metric) => {
    const header =
      `<tr><th>Provider</th><th class="num">Coverage</th>` +
      `<th class="num" data-metric="quality"><label for="${esc(sortControlId(group.key, "quality", idPrefix))}">${esc(group.metricColumns.quality)}</label></th>` +
      `<th class="num" data-metric="speed"><label for="${esc(sortControlId(group.key, "speed", idPrefix))}">${esc(group.metricColumns.speed)}</label></th>` +
      `<th class="num" data-metric="cost"><label for="${esc(sortControlId(group.key, "cost", idPrefix))}">${esc(group.metricColumns.cost)}</label></th>` +
      `${evidenceHeaders}</tr>`;
    return (
      `<div class="tablewrap sort-${metric}">` +
      `<table class="providers">` +
      `<thead>${header}</thead>` +
      `<tbody>${providerRows(group, metric, metric === "quality")}</tbody>` +
      `<caption>Sorted by ${SORT_LABELS[metric].toLowerCase()}. Click Quality, Speed, or Cost to reorder. Rank boxes show each metric's own rank: green = top third, yellow = middle third, red = bottom third. Groups are as equal as possible, with extra places in earlier thirds.</caption>` +
      `</table></div>`
    );
  }).join("");
  const weights =
    `<div class="weights">` +
    SORT_METRICS.map((metric) => {
      const id = `w-${idPrefix}${group.key}-${metric}`;
      return (
        `<span class="w">` +
        `<label for="${esc(id)}">${SORT_LABELS[metric]}</label>` +
        `<input type="range" id="${esc(id)}" data-weight="${metric}" min="0" max="100" step="1" value="${WEIGHT_DEFAULTS[metric]}">` +
        `<output for="${esc(id)}">${WEIGHT_DEFAULTS[metric]}%</output>` +
        `</span>`
      );
    }).join("") +
    `<button type="button" class="weights-reset">Reset</button>` +
    `</div>`;
  const directions =
    ` data-dir-quality="${group.metricDirections.quality}"` +
    ` data-dir-speed="${group.metricDirections.speed}"` +
    ` data-dir-cost="${group.metricDirections.cost}"`;
  return (
    `<div class="provider-sort"${directions}>` +
    `<span class="sort-label">Sort by</span>` +
    radios +
    weights +
    tables +
    `</div>`
  );
}

function perRunHeatmap(group: DashboardGroup, runs: CombinedDashboardModel["runs"]): string {
  const header = `<tr><th>Provider</th><th class="num">Mean</th>${runs.map((run) => `<th class="num" title="${esc(run.runName)}">${esc(run.shortLabel)}</th>`).join("")}</tr>`;
  const rows = [...group.providers]
    .sort((left, right) => rankOrLast(left.quality.rank) - rankOrLast(right.quality.rank) || left.providerKey.localeCompare(right.providerKey))
    .map((row) => {
      const cells = row.perRun
        .map((cell) => (cell.heat === null ? `<td class="num">${esc(cell.display)}</td>` : `<td class="heat" style="--h:${cell.heat}">${esc(cell.display)}</td>`))
        .join("");
      return `<tr><td><code>${esc(row.display)}</code></td><td class="num">${esc(row.quality.display)}</td>${cells}</tr>`;
    });
  return `<div class="tablewrap"><table><thead>${header}</thead><tbody>${rows.join("\n")}</tbody><caption>Shading is relative within this table (stronger blue = higher score); run columns are listed under Runs above.</caption></table></div>`;
}

interface DashboardBodyOptions {
  idPrefix: string;
  sectionHeadingTag: "h2" | "h3";
}

function sectionHeading(escapedLabel: string, options: DashboardBodyOptions): string {
  return options.sectionHeadingTag === "h2"
    ? `<h2>${escapedLabel}</h2>`
    : `<h3 class="section">${escapedLabel}</h3>`;
}

function groupSection(group: DashboardGroup, model: CombinedDashboardModel, options: DashboardBodyOptions): string {
  const heading = sectionHeading(esc(group.label), options);
  if (group.providers.length === 0) {
    return [
      `<section class="group">`,
      heading,
      `<p class="empty">No providers in this group.</p>`,
      `</section>`,
    ].join("\n");
  }
  return [
    `<section class="group">`,
    heading,
    `<h3>Metric rankings</h3>`,
    providerTable(group, options.idPrefix),
    `<h3>${esc(group.perRunMetricLabel ?? "Per-run quality score")}</h3>`,
    perRunHeatmap(group, model.runs),
    `</section>`,
  ].join("\n");
}

function methodSection(model: CombinedDashboardModel): string {
  const paragraphs = model.methodParagraphs.map((paragraph) => `<p>${mdInline(paragraph)}</p>`).join("\n");
  return `<details><summary>Method</summary>${paragraphs}</details>`;
}

function safeHttpHref(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function runInventoryCell(cell: DashboardRunInventoryCell | undefined): string {
  if (cell === undefined) {
    return "";
  }
  const href = safeHttpHref(cell.href);
  if (href === null) {
    return esc(cell.display);
  }
  return `<a class="run-link" href="${esc(href)}" rel="noreferrer">${esc(cell.display)}</a>`;
}

function renderDashboardBody(model: CombinedDashboardModel, options: DashboardBodyOptions): string {
  const tiles = model.summaryStats
    .map((stat) => `<div class="tile"><div class="v">${esc(stat.value)}</div><div class="l">${esc(stat.label)}</div></div>`)
    .join("\n");
  const inventoryColumns = model.runInventoryColumns ?? [];
  const inventoryHeaders = inventoryColumns.map((column) => `<th>${esc(column.label)}</th>`).join("");
  const runRows = model.runs
    .map((run) => {
      const inventoryCells = inventoryColumns
        .map((column) => `<td>${runInventoryCell(run.inventory?.[column.key])}</td>`)
        .join("");
      return `<tr><td>${esc(run.shortLabel)}</td><td><code>${esc(run.runName)}</code></td><td>${esc(run.detail)}</td>${inventoryCells}</tr>`;
    })
    .join("\n");
  const runsDetails = `<details><summary>Runs (${model.runs.length})</summary><div class="tablewrap"><table class="wtable"><thead><tr><th>Key</th><th>Run</th><th>Detail</th>${inventoryHeaders}</tr></thead><tbody>${runRows}</tbody></table></div></details>`;
  const notes = model.notes.map((note) => `<li>${mdInline(note)}</li>`).join("\n");

  return `<div class="tiles">
${tiles}
</div>
${runsDetails}
${model.groups.map((group) => groupSection(group, model, options)).join("\n")}
${sectionHeading("Method &amp; notes", options)}
${methodSection(model)}
<ul class="notes">
${notes}
</ul>`;
}

export function renderCombinedDashboard(model: CombinedDashboardModel): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(model.title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(model.title)}</h1>
<p class="meta">Generated ${esc(model.generatedAt)} &middot; <code>${esc(model.rootDir)}</code></p>
${renderDashboardBody(model, { idPrefix: "", sectionHeadingTag: "h2" })}
</main>
</body>
</html>
`;
}

export interface BenchmarkDashboardTab {
  key: string;
  label: string;
  rootLabel: string;
  model: CombinedDashboardModel;
}

export interface BenchmarkDashboardPage {
  title: string;
  generatedAt: string;
  tabs: BenchmarkDashboardTab[];
}

const TAB_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

function tabCss(keys: string[]): string {
  const rules = keys.flatMap((key) => [
    `#tab-${key}:checked ~ .tabbar label[for="tab-${key}"] { border-color: var(--accent); color: var(--ink); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }`,
    `#tab-${key}:checked ~ #panel-${key} { display: block; }`,
  ]);
  return `
main.dashboard > input[name="dashboard-tab"] {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.tabbar {
  position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px;
  padding: 10px 0; margin: 0 0 4px; background: var(--page); border-bottom: 1px solid var(--grid);
}
.tabbar label {
  cursor: pointer; border: 1px solid var(--border); border-radius: 999px;
  padding: 5px 12px; font-size: 13px; color: var(--ink-2); background: var(--surface);
}
main.dashboard > input[name="dashboard-tab"]:focus-visible ~ .tabbar label { outline: 1px dotted var(--accent); }
.panel { display: none; }
.panel > h2 { margin-top: 20px; border-top: none; padding-top: 0; }
h3.section {
  font-size: 17px; margin: 36px 0 12px; padding-top: 16px;
  border-top: 1px solid var(--grid); color: var(--ink);
  text-transform: none; letter-spacing: normal;
}
${rules.join("\n")}
`;
}

export interface WeightedScoreRow {
  quality: number | null;
  speed: number | null;
  cost: number | null;
}

export interface MetricWeights {
  quality: number;
  speed: number;
  cost: number;
}

/**
 * Min-max normalises each metric within `rows` to 0-100, honouring each metric's direction, and
 * returns the weighted composite per row. Weights are rescaled to sum to 1; an all-zero set is
 * treated as equal thirds. A row missing a metric that carries weight scores `null`.
 *
 * The dashboard embeds this function's source verbatim, so the browser runs exactly this code.
 */
export function computeWeightedScores(
  rows: WeightedScoreRow[],
  weights: MetricWeights,
  directions: DashboardMetricDirections,
): Array<number | null> {
  const keys: Array<keyof WeightedScoreRow> = ["quality", "speed", "cost"];
  const total = weights.quality + weights.speed + weights.cost;
  const share: Record<string, number> = {
    quality: total > 0 ? weights.quality / total : 1 / 3,
    speed: total > 0 ? weights.speed / total : 1 / 3,
    cost: total > 0 ? weights.cost / total : 1 / 3,
  };
  const bounds: Record<string, { min: number; max: number } | null> = {};
  keys.forEach((key) => {
    const values: number[] = [];
    rows.forEach((row) => {
      const value = row[key];
      if (typeof value === "number" && isFinite(value)) {
        values.push(value);
      }
    });
    bounds[key] = values.length > 0 ? { min: Math.min.apply(null, values), max: Math.max.apply(null, values) } : null;
  });

  return rows.map((row) => {
    let score = 0;
    let usable = true;
    keys.forEach((key) => {
      const weight = share[key] || 0;
      if (weight <= 0) {
        return;
      }
      const value = row[key];
      const bound = bounds[key];
      if (typeof value !== "number" || !isFinite(value) || !bound) {
        usable = false;
        return;
      }
      const span = bound.max - bound.min;
      const fraction = span === 0
        ? 1
        : (directions[key] === "higher" ? value - bound.min : bound.max - value) / span;
      score += weight * fraction * 100;
    });
    return usable ? score : null;
  });
}

const WEIGHTS_SCRIPT = `
(function () {
  var sorts = document.querySelectorAll(".provider-sort");
  if (!sorts.length) { return; }

  ${computeWeightedScores.toString()}

  var METRICS = ["quality", "speed", "cost"];
  var DEFAULTS = ${JSON.stringify(WEIGHT_DEFAULTS)};

  function tierClass(rank, ranked) {
    if (rank <= Math.ceil(ranked / 3)) { return "top"; }
    if (rank <= Math.ceil((2 * ranked) / 3)) { return "middle"; }
    return "bottom";
  }

  function numberOrNull(row, attribute) {
    var raw = row.getAttribute(attribute);
    if (raw === null) { return null; }
    var parsed = Number(raw);
    return isFinite(parsed) ? parsed : null;
  }

  function buildCustomTable(sort) {
    var source = sort.querySelector(".sort-quality table");
    if (!source || !source.tHead || !source.tBodies[0]) { return null; }
    var wrap = document.createElement("div");
    wrap.className = "tablewrap sort-custom";
    var table = source.cloneNode(true);
    var head = table.tHead.rows[0];
    var th = document.createElement("th");
    th.className = "num";
    th.textContent = "Score";
    head.insertBefore(th, head.cells[1] || null);
    Array.prototype.forEach.call(table.tBodies[0].rows, function (row) {
      var cell = document.createElement("td");
      cell.className = "num";
      cell.setAttribute("data-score-cell", "");
      row.insertBefore(cell, row.cells[1] || null);
    });
    wrap.appendChild(table);
    sort.appendChild(wrap);
    return wrap;
  }

  Array.prototype.forEach.call(sorts, function (sort, index) {
    var panel = sort.querySelector(".weights");
    var radios = sort.querySelectorAll('input[type="radio"]');
    var last = radios[radios.length - 1];
    if (!panel || !last) { return; }
    var wrap = buildCustomTable(sort);
    if (!wrap) { return; }

    var id = "sort-custom-" + index;
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.name = last.getAttribute("name");
    radio.id = id;
    radio.value = "custom";
    var label = document.createElement("label");
    label.className = "sort-opt";
    label.setAttribute("for", id);
    label.textContent = "Custom";
    var anchor = sort.querySelector('label[for="' + last.id + '"]') || last;
    anchor.parentNode.insertBefore(radio, anchor.nextSibling);
    radio.parentNode.insertBefore(label, radio.nextSibling);

    var sliders = {};
    var outputs = {};
    METRICS.forEach(function (metric) {
      sliders[metric] = panel.querySelector('input[data-weight="' + metric + '"]');
      outputs[metric] = panel.querySelector('output[for="' + sliders[metric].id + '"]');
    });

    var rows = Array.prototype.slice.call(wrap.querySelectorAll("tbody tr"));
    var body = wrap.querySelector("tbody");
    var caption = wrap.querySelector("caption");
    var directions = {
      quality: sort.getAttribute("data-dir-quality") || "higher",
      speed: sort.getAttribute("data-dir-speed") || "lower",
      cost: sort.getAttribute("data-dir-cost") || "lower"
    };

    function current() {
      return {
        quality: Number(sliders.quality.value) || 0,
        speed: Number(sliders.speed.value) || 0,
        cost: Number(sliders.cost.value) || 0
      };
    }

    // The three weights are one budget of 100. Moving one redistributes the remainder across the
    // other two in their existing proportion, so every thumb tracks the percentage beside it.
    function rebalance(moved) {
      var weights = current();
      var others = METRICS.filter(function (metric) { return metric !== moved; });
      var remainder = 100 - weights[moved];
      var pool = weights[others[0]] + weights[others[1]];
      var first = pool > 0 ? Math.round((remainder * weights[others[0]]) / pool) : Math.round(remainder / 2);
      weights[others[0]] = first;
      weights[others[1]] = remainder - first;
      return weights;
    }

    function paint(weights) {
      METRICS.forEach(function (metric) {
        sliders[metric].value = String(weights[metric]);
        if (outputs[metric]) { outputs[metric].textContent = weights[metric] + "%"; }
      });

      var scores = computeWeightedScores(
        rows.map(function (row) {
          return {
            quality: numberOrNull(row, "data-q"),
            speed: numberOrNull(row, "data-s"),
            cost: numberOrNull(row, "data-c")
          };
        }),
        weights,
        directions
      );

      var entries = rows.map(function (row, position) {
        return { row: row, score: scores[position] };
      });
      entries.sort(function (left, right) {
        if (left.score === null && right.score === null) { return 0; }
        if (left.score === null) { return 1; }
        if (right.score === null) { return -1; }
        return right.score - left.score;
      });

      var ranked = entries.filter(function (entry) { return entry.score !== null; }).length;
      entries.forEach(function (entry, position) {
        var cell = entry.row.querySelector("[data-score-cell]");
        if (cell) {
          if (entry.score === null) {
            cell.textContent = "n/a";
          } else {
            cell.textContent = entry.score.toFixed(1);
            var chip = document.createElement("span");
            chip.className = "rk " + tierClass(position + 1, ranked);
            chip.textContent = String(position + 1);
            cell.appendChild(chip);
          }
        }
        body.appendChild(entry.row);
      });

      if (caption) {
        caption.textContent = "Sorted by your custom weighting: quality " + weights.quality
          + "%, speed " + weights.speed + "%, cost " + weights.cost
          + "%. Score min-max normalises each metric within this group to 0-100, so it ranks these providers"
          + " against each other only and is not comparable across groups or tabs."
          + " A provider missing a weighted metric scores n/a and sorts last.";
      }
    }

    METRICS.forEach(function (metric) {
      sliders[metric].addEventListener("input", function () {
        paint(rebalance(metric));
        radio.checked = true;
      });
    });

    var reset = panel.querySelector(".weights-reset");
    if (reset) {
      reset.addEventListener("click", function () {
        paint({ quality: DEFAULTS.quality, speed: DEFAULTS.speed, cost: DEFAULTS.cost });
        var quality = sort.querySelector('input[value="quality"]');
        if (quality) { quality.checked = true; }
      });
    }

    paint(current());
  });
})();
`;

export function renderBenchmarkDashboard(page: BenchmarkDashboardPage): string {
  if (page.tabs.length === 0) {
    throw new Error("renderBenchmarkDashboard requires at least one tab");
  }
  const seen = new Set<string>();
  for (const tab of page.tabs) {
    if (!TAB_KEY_PATTERN.test(tab.key)) {
      throw new Error(`Invalid dashboard tab key: ${tab.key}`);
    }
    if (seen.has(tab.key)) {
      throw new Error(`Duplicate dashboard tab key: ${tab.key}`);
    }
    seen.add(tab.key);
  }

  const inputs = page.tabs
    .map((tab, index) => `<input type="radio" name="dashboard-tab" id="tab-${tab.key}"${index === 0 ? " checked" : ""}>`)
    .join("\n");
  const chips = page.tabs
    .map((tab) => `<label for="tab-${tab.key}">${esc(tab.label)}</label>`)
    .join("");
  const panels = page.tabs
    .map((tab) => [
      `<section class="panel" id="panel-${tab.key}">`,
      `<h2>${esc(tab.model.title)}</h2>`,
      `<p class="meta">Generated ${esc(tab.model.generatedAt)} &middot; <code>${esc(tab.rootLabel)}</code></p>`,
      renderDashboardBody(tab.model, { idPrefix: `${tab.key}-`, sectionHeadingTag: "h3" }),
      `</section>`,
    ].join("\n"))
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<style>${CSS}${tabCss(page.tabs.map((tab) => tab.key))}</style>
</head>
<body>
<main class="dashboard">
<h1>${esc(page.title)}</h1>
<p class="meta">Generated ${esc(page.generatedAt)} &middot; ${page.tabs.length} combined benchmark ${page.tabs.length === 1 ? "root" : "roots"}</p>
${inputs}
<nav class="tabbar">${chips}</nav>
${panels}
</main>
<script>${WEIGHTS_SCRIPT}</script>
</body>
</html>
`;
}
