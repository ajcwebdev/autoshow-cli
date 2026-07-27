/**
 * Self-contained HTML dashboard renderer for combined cross-run comparison
 * reports (STT, OCR, URL).
 *
 * `renderCombinedDashboard` is a pure function from a category-agnostic view
 * model to a single HTML document string: all data is embedded at generation
 * time, all CSS/JS is inline, and nothing references the network or other
 * files. Category differences (column labels, value formatting, display
 * names) are data in the view model, not code branches here.
 *
 * Design notes:
 *   - One consolidated provider table per group replaces the eleven markdown
 *     ranking tables; a weight-set button strip re-sorts it from precomputed
 *     data attributes (no math happens in the browser).
 *   - Magnitude is always the single blue hue (subscore bars, heat cells);
 *     tier chips are an ordinal wash of the same hue and always carry their
 *     text label; values/labels stay in ink tokens, never the data color.
 *   - The document is fully readable with JavaScript disabled: the strip
 *     stays hidden, the table ships in balanced-composite order, and the
 *     complete weighted rankings live in a <details> matrix.
 *   - Deterministic: the only run-varying value is `generatedAt`.
 */

import { WEIGHT_SETS, WEIGHT_SET_KEYS, formatWeight, type ProviderSubscores, type WeightSetKey } from "./combined_report_lib";

export interface DashboardMetricCell {
  display: string;
  rank: number | null;
}

export interface DashboardWeightedCell {
  rank: number;
  composite: number;
}

/** Balanced-composite ranking (composite desc, providerKey asc) keyed by providerKey. */
export function balancedCells(subscored: ProviderSubscores[]): Map<string, DashboardWeightedCell> {
  const sorted = [...subscored].sort(
    (left, right) => right.balancedComposite - left.balancedComposite || left.providerKey.localeCompare(right.providerKey),
  );
  return new Map(sorted.map((provider, index) => [provider.providerKey, { rank: index + 1, composite: provider.balancedComposite }]));
}

export interface DashboardProviderRow {
  providerKey: string;
  display: string;
  model: string;
  coverage: string;
  tier: number | null;
  quality: DashboardMetricCell;
  speed: DashboardMetricCell;
  cost: DashboardMetricCell;
  balanced: DashboardWeightedCell;
  weighted: Record<WeightSetKey, DashboardWeightedCell>;
  evidence: string[];
  missingDimensions: string[];
  perRun: Array<{ display: string; heat: number | null }>;
}

export interface DashboardTierCard {
  tier: number;
  label: string;
  description: string;
  providers: Array<{ display: string; qualityCostRank: number; qualityCostComposite: number }>;
}

export interface DashboardGroup {
  key: string;
  label: string;
  tierCards: DashboardTierCard[];
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

/** Escape, then render the two inline markdown forms the method prose uses. */
function mdInline(value: string): string {
  return esc(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

const BALANCED_KEY = "balanced";

const WEIGHT_SET_SHORT: Record<WeightSetKey, string> = {
  strongQuality: "Strong quality",
  moderateQuality: "Moderate quality",
  strongSpeed: "Strong speed",
  moderateSpeed: "Moderate speed",
  strongCost: "Strong cost",
  moderateCost: "Moderate cost",
  qualityCost: "Quality + cost",
  costSpeed: "Cost + speed",
};

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
.tiers { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin: 0 0 16px; }
.tier-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.tier-card .desc { font-size: 11px; color: var(--muted); margin-top: 8px; }
.chip { display: inline-block; margin: 2px 4px 2px 0; padding: 1px 8px; border-radius: 10px; font-size: 12px; background: color-mix(in srgb, var(--ink) 5%, transparent); }
.chip .n { color: var(--muted); font-size: 11px; }
.tbadge { display: inline-block; min-width: 2.1em; text-align: center; padding: 0 6px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.tbadge.t1 { background: color-mix(in srgb, var(--accent) 26%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); }
.tbadge.t2 { background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent); }
.tbadge.t3 { background: color-mix(in srgb, var(--ink) 6%, transparent); border: 1px solid var(--border); }
.weights { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px; }
.weights button {
  font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 14px; cursor: pointer;
  background: var(--surface); color: var(--ink-2); border: 1px solid var(--border);
}
.weights button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent); color: var(--ink);
}
.tablewrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 6px 10px; text-align: left; white-space: nowrap; }
thead th { position: sticky; top: 0; background: var(--surface); color: var(--ink-2); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--grid); }
tbody td { border-bottom: 1px solid var(--grid); }
tbody tr:last-child td { border-bottom: none; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.rk { display: inline-block; min-width: 1.7em; text-align: center; border-radius: 6px; font-size: 11px; color: var(--ink-2); background: color-mix(in srgb, var(--ink) 6%, transparent); margin-left: 6px; }
.rk.top { border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); color: var(--ink); }
.bar { width: 72px; height: 6px; border-radius: 0 4px 4px 0; background: color-mix(in srgb, var(--accent) 16%, transparent); overflow: hidden; }
.bar > i { display: block; height: 100%; border-radius: 0 4px 4px 0; background: var(--accent); }
.cellbar { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
.heat { text-align: right; font-variant-numeric: tabular-nums; background: color-mix(in srgb, var(--accent) calc(var(--h, 0) * 0.5%), transparent); }
.footnotes { font-size: 12px; color: var(--muted); margin: 8px 2px; }
.footnotes p { margin: 2px 0; }
.empty { color: var(--muted); font-style: italic; }
.notes { color: var(--ink-2); font-size: 12px; }
.run-link { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
.wtable td, .wtable th { font-size: 12px; }
caption { caption-side: bottom; text-align: left; color: var(--muted); font-size: 11px; padding: 6px 10px; }
`;

const SCRIPT = `
for (const sec of document.querySelectorAll("section.group")) {
  const strip = sec.querySelector(".weights");
  const tbody = sec.querySelector("table.providers tbody");
  if (!strip || !tbody) continue;
  strip.hidden = false;
  for (const btn of strip.querySelectorAll("button")) {
    btn.addEventListener("click", () => {
      const set = btn.dataset.set;
      for (const other of strip.querySelectorAll("button")) {
        other.setAttribute("aria-pressed", String(other === btn));
      }
      const rows = Array.from(tbody.rows);
      rows.sort((a, b) => Number(a.getAttribute("data-r-" + set)) - Number(b.getAttribute("data-r-" + set)));
      for (const row of rows) {
        const composite = row.getAttribute("data-c-" + set);
        row.querySelector(".rankcell").textContent = row.getAttribute("data-r-" + set);
        row.querySelector(".compval").textContent = composite;
        row.querySelector(".compfill").style.width = Math.round(Number(composite)) + "%";
        tbody.appendChild(row);
      }
      const label = sec.querySelector(".comp-label");
      if (label) label.textContent = btn.textContent;
    });
  }
}
`;

function rankChip(rank: number | null): string {
  if (rank === null) {
    return "";
  }
  return `<span class="rk${rank <= 3 ? " top" : ""}">${rank}</span>`;
}

function tierBadge(tier: number | null): string {
  if (tier === null) {
    return "";
  }
  return `<span class="tbadge t${tier}">T${tier}</span>`;
}

function metricCell(cell: DashboardMetricCell): string {
  return `<td class="num">${esc(cell.display)}${rankChip(cell.rank)}</td>`;
}

function compositeBar(composite: number): string {
  const width = Math.max(0, Math.min(100, Math.round(composite)));
  return `<span class="cellbar"><span class="compval">${composite.toFixed(2)}</span><span class="bar"><i class="compfill" style="width:${width}%"></i></span></span>`;
}

function tierCards(group: DashboardGroup): string {
  const cards = group.tierCards.map((card) => {
    const chips =
      card.providers.length === 0
        ? '<span class="empty">none</span>'
        : card.providers
            .map(
              (provider) =>
                `<span class="chip"><code>${esc(provider.display)}</code> <span class="n">#${provider.qualityCostRank} · ${provider.qualityCostComposite.toFixed(2)}</span></span>`,
            )
            .join(" ");
    return `<div class="tier-card"><div>${tierBadge(card.tier)} <strong>${esc(card.label)}</strong></div><div>${chips}</div><div class="desc">${esc(card.description)}</div></div>`;
  });
  return `<div class="tiers">${cards.join("\n")}</div>`;
}

function weightStrip(): string {
  const buttons = [
    `<button type="button" data-set="${BALANCED_KEY}" aria-pressed="true">Balanced</button>`,
    ...WEIGHT_SET_KEYS.map((key) => `<button type="button" data-set="${key.toLowerCase()}" aria-pressed="false">${esc(WEIGHT_SET_SHORT[key])}</button>`),
  ];
  return `<div class="weights" hidden role="group" aria-label="Composite weight set">${buttons.join("\n")}</div>`;
}

function providerTable(group: DashboardGroup): string {
  const evidenceHeaders = group.evidenceColumns.map((column) => `<th class="num">${esc(column)}</th>`).join("");
  const header =
    `<tr><th class="num rankhead">#</th><th>Tier</th><th>Provider</th><th class="num">Coverage</th>` +
    `<th class="num">${esc(group.metricColumns.quality)}</th><th class="num">${esc(group.metricColumns.speed)}</th><th class="num">${esc(group.metricColumns.cost)}</th>` +
    `<th class="num">Composite (<span class="comp-label">Balanced</span>)</th>${evidenceHeaders}</tr>`;
  const rows = [...group.providers]
    .sort((left, right) => left.balanced.rank - right.balanced.rank)
    .map((row) => {
      const dataAttrs = [
        `data-r-${BALANCED_KEY}="${row.balanced.rank}" data-c-${BALANCED_KEY}="${row.balanced.composite.toFixed(2)}"`,
        ...WEIGHT_SET_KEYS.map(
          (key) => `data-r-${key.toLowerCase()}="${row.weighted[key].rank}" data-c-${key.toLowerCase()}="${row.weighted[key].composite.toFixed(2)}"`,
        ),
      ].join(" ");
      const evidenceCells = row.evidence.map((value) => `<td class="num">${esc(value)}</td>`).join("");
      return (
        `<tr ${dataAttrs}>` +
        `<td class="num rankcell">${row.balanced.rank}</td>` +
        `<td>${tierBadge(row.tier)}</td>` +
        `<td><code title="${esc(row.providerKey)}">${esc(row.display)}</code></td>` +
        `<td class="num">${esc(row.coverage)}</td>` +
        metricCell(row.quality) +
        metricCell(row.speed) +
        metricCell(row.cost) +
        `<td class="num">${compositeBar(row.balanced.composite)}</td>` +
        evidenceCells +
        `</tr>`
      );
    });
  const footnotes = group.providers
    .filter((row) => row.missingDimensions.length > 0)
    .map((row) => `<p><code>${esc(row.display)}</code> has no ${esc(row.missingDimensions.join("/"))} value in any covered run; the missing dimension scores 0.</p>`);
  return (
    `<div class="tablewrap"><table class="providers"><thead>${header}</thead><tbody>${rows.join("\n")}</tbody></table></div>` +
    (footnotes.length > 0 ? `<div class="footnotes">${footnotes.join("\n")}</div>` : "")
  );
}

function weightedMatrix(group: DashboardGroup): string {
  const header = `<tr><th>Provider</th>${WEIGHT_SET_KEYS.map((key) => `<th class="num">${esc(WEIGHT_SET_SHORT[key])}</th>`).join("")}</tr>`;
  const rows = [...group.providers]
    .sort((left, right) => (left.quality.rank ?? Number.POSITIVE_INFINITY) - (right.quality.rank ?? Number.POSITIVE_INFINITY))
    .map((row) => {
      const cells = WEIGHT_SET_KEYS.map((key) => {
        const cell = row.weighted[key];
        return `<td class="num">${cell.rank} <span class="n">(${cell.composite.toFixed(2)})</span></td>`;
      }).join("");
      return `<tr><td><code>${esc(row.display)}</code></td>${cells}</tr>`;
    });
  return `<details><summary>All weighted rankings (rank and composite per weight set)</summary><div class="tablewrap"><table class="wtable"><thead>${header}</thead><tbody>${rows.join("\n")}</tbody></table></div></details>`;
}

function perRunHeatmap(group: DashboardGroup, runs: CombinedDashboardModel["runs"]): string {
  const header = `<tr><th>Provider</th><th class="num">Mean</th>${runs.map((run) => `<th class="num" title="${esc(run.runName)}">${esc(run.shortLabel)}</th>`).join("")}</tr>`;
  const rows = [...group.providers]
    .sort((left, right) => (left.quality.rank ?? Number.POSITIVE_INFINITY) - (right.quality.rank ?? Number.POSITIVE_INFINITY))
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
      `<h3>Quality-cost terciles</h3>`,
      tierCards(group),
      `<p class="empty">No providers in this group.</p>`,
      `</section>`,
    ].join("\n");
  }
  return [
    `<section class="group">`,
    `<h2>${esc(group.label)}</h2>`,
    `<h3>Quality-cost terciles</h3>`,
    tierCards(group),
    `<h3>Providers</h3>`,
    weightStrip(),
    providerTable(group),
    weightedMatrix(group),
    `<h3>${esc(group.perRunMetricLabel ?? "Per-run quality score")}</h3>`,
    perRunHeatmap(group, model.runs),
    `</section>`,
  ].join("\n");
}

function methodSection(model: CombinedDashboardModel): string {
  const paragraphs = model.methodParagraphs.map((paragraph) => `<p>${mdInline(paragraph)}</p>`).join("\n");
  const weightRows = WEIGHT_SET_KEYS.map((key) => {
    const weights = WEIGHT_SETS[key];
    return `<tr><td>${esc(WEIGHT_SET_SHORT[key])}</td><td class="num">${formatWeight(weights.quality)}</td><td class="num">${formatWeight(weights.speed)}</td><td class="num">${formatWeight(weights.cost)}</td></tr>`;
  }).join("\n");
  const weightTable = `<div class="tablewrap"><table class="wtable"><thead><tr><th>Weight set</th><th class="num">Quality</th><th class="num">Speed</th><th class="num">Cost</th></tr></thead><tbody>${weightRows}</tbody></table></div>`;
  return `<details><summary>Method</summary>${paragraphs}\n${weightTable}</details>`;
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
<script>${SCRIPT}</script>
</body>
</html>
`;
}
