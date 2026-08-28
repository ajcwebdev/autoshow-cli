export interface DashboardMetricCell {
  display: string;
  rank: number | null;
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
  margin: 0; background: var(--page); color: var(--ink);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  body {
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7;
    --muted: #898781; --grid: #2c2c2a; --border: rgba(255, 255, 255, 0.10);
    --accent: #3987e5;
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
.rk { display: inline-block; min-width: 1.7em; text-align: center; border-radius: 6px; font-size: 11px; color: var(--ink-2); background: color-mix(in srgb, var(--ink) 6%, transparent); margin-left: 6px; }
.rk.top { border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); color: var(--ink); }
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
`;

function rankChip(rank: number | null): string {
  if (rank === null) {
    return "";
  }
  return `<span class="rk${rank <= 3 ? " top" : ""}">${rank}</span>`;
}

function metricCell(cell: DashboardMetricCell): string {
  return `<td class="num">${esc(cell.display)}${rankChip(cell.rank)}</td>`;
}

function rankOrLast(rank: number | null): number {
  return rank ?? Number.POSITIVE_INFINITY;
}

type SortMetric = "quality" | "speed" | "cost";

const SORT_METRICS: SortMetric[] = ["quality", "speed", "cost"];
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

function sortControlId(groupKey: string, metric: SortMetric): string {
  return `sort-${groupKey}-${metric}`;
}

function providerRows(group: DashboardGroup, metric: SortMetric): string {
  return [...group.providers]
    .sort((left, right) => compareByMetric(left, right, metric))
    .map((row) => {
      const evidenceCells = row.evidence.map((value) => `<td class="num">${esc(value)}</td>`).join("");
      return (
        `<tr>` +
        `<td><code title="${esc(row.providerKey)}">${esc(row.display)}</code></td>` +
        `<td class="num">${esc(row.coverage)}</td>` +
        metricCell(row.quality) +
        metricCell(row.speed) +
        metricCell(row.cost) +
        evidenceCells +
        `</tr>`
      );
    })
    .join("\n");
}

function providerTable(group: DashboardGroup): string {
  const evidenceHeaders = group.evidenceColumns.map((column) => `<th class="num">${esc(column)}</th>`).join("");
  const radios = SORT_METRICS.map((metric, index) => {
    const id = sortControlId(group.key, metric);
    const checked = index === 0 ? " checked" : "";
    return (
      `<input type="radio" name="sort-${esc(group.key)}" id="${esc(id)}" value="${metric}"${checked}>` +
      `<label class="sort-opt" for="${esc(id)}">${SORT_LABELS[metric]}</label>`
    );
  }).join("");
  const tables = SORT_METRICS.map((metric) => {
    const header =
      `<tr><th>Provider</th><th class="num">Coverage</th>` +
      `<th class="num" data-metric="quality"><label for="${esc(sortControlId(group.key, "quality"))}">${esc(group.metricColumns.quality)}</label></th>` +
      `<th class="num" data-metric="speed"><label for="${esc(sortControlId(group.key, "speed"))}">${esc(group.metricColumns.speed)}</label></th>` +
      `<th class="num" data-metric="cost"><label for="${esc(sortControlId(group.key, "cost"))}">${esc(group.metricColumns.cost)}</label></th>` +
      `${evidenceHeaders}</tr>`;
    return (
      `<div class="tablewrap sort-${metric}">` +
      `<table class="providers">` +
      `<thead>${header}</thead>` +
      `<tbody>${providerRows(group, metric)}</tbody>` +
      `<caption>Sorted by ${SORT_LABELS[metric].toLowerCase()}. Click Quality, Speed, or Cost to reorder. Rank chips stay each metric's own rank.</caption>` +
      `</table></div>`
    );
  }).join("");
  return (
    `<div class="provider-sort">` +
    `<span class="sort-label">Sort by</span>` +
    radios +
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

function groupSection(group: DashboardGroup, model: CombinedDashboardModel): string {
  if (group.providers.length === 0) {
    return [
      `<section class="group">`,
      `<h2>${esc(group.label)}</h2>`,
      `<p class="empty">No providers in this group.</p>`,
      `</section>`,
    ].join("\n");
  }
  return [
    `<section class="group">`,
    `<h2>${esc(group.label)}</h2>`,
    `<h3>Metric rankings</h3>`,
    providerTable(group),
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

export function renderCombinedDashboard(model: CombinedDashboardModel): string {
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
<div class="tiles">
${tiles}
</div>
${runsDetails}
${model.groups.map((group) => groupSection(group, model)).join("\n")}
<h2>Method &amp; notes</h2>
${methodSection(model)}
<ul class="notes">
${notes}
</ul>
</main>
</body>
</html>
`;
}
