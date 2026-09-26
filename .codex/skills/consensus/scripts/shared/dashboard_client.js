/**
 * Browser renderer for the AutoShow benchmark dashboard.
 *
 * The generated page is a static shell whose <main data-source> names a sibling JSON file. This
 * script fetches that file and renders every tab from it. The file is copied verbatim beside the
 * page as combined-comparison-dashboard.js and is also imported by the test suite under Bun, so it
 * stays dependency-free: every renderer is a pure string function, and only boot(), mount(), and
 * the attach* helpers touch the DOM. It is a classic script, not an ES module, because browsers
 * refuse module scripts on file:// pages, and a classic script can at least explain that the JSON
 * has to be served over HTTP. Under Bun it is loaded as CommonJS through the exports block at the end.
 */
"use strict";

const TAB_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;
const SORT_METRICS = ["quality", "speed", "cost"];
/** Starting split for the custom-weighting sliders; the three always total 100. */
const WEIGHT_DEFAULTS = { quality: 60, speed: 20, cost: 20 };
const SORT_LABELS = { quality: "Quality", speed: "Speed", cost: "Cost" };
const ARTIFACT_HREF_PATTERN = /^(?:[A-Za-z0-9_.~-]+\/)*[A-Za-z0-9_.~-]+$/;

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mdInline(value) {
  return esc(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function isRank(rank) {
  return typeof rank === "number" && Number.isFinite(rank);
}

function rankChip(rank, rankedCount) {
  if (!isRank(rank)) {
    return "";
  }
  const tier = rank <= Math.ceil(rankedCount / 3) ? "top" : rank <= Math.ceil((2 * rankedCount) / 3) ? "middle" : "bottom";
  const label = tier === "top" ? "Top" : tier === "middle" ? "Middle" : "Bottom";
  return `<span class="rk ${tier}" title="${label} third">${rank}</span>`;
}

function metricCell(cell, rankedCount) {
  return `<td class="num">${esc(cell.display)}${rankChip(cell.rank, rankedCount)}</td>`;
}

function rankOrLast(rank) {
  return isRank(rank) ? rank : Number.POSITIVE_INFINITY;
}

function compareByMetric(left, right, metric) {
  const order = metric === "quality"
    ? ["quality", "speed", "cost"]
    : metric === "speed"
      ? ["speed", "quality", "cost"]
      : ["cost", "quality", "speed"];
  return rankOrLast(left[order[0]].rank) - rankOrLast(right[order[0]].rank)
    || rankOrLast(left[order[1]].rank) - rankOrLast(right[order[1]].rank)
    || rankOrLast(left[order[2]].rank) - rankOrLast(right[order[2]].rank)
    || left.providerKey.localeCompare(right.providerKey);
}

function sortControlId(groupKey, metric, idPrefix) {
  return `sort-${idPrefix}${groupKey}-${metric}`;
}

function metricData(row) {
  return SORT_METRICS
    .map((metric) => {
      const value = row[metric].value;
      return typeof value === "number" && Number.isFinite(value) ? ` data-${metric[0]}="${value}"` : "";
    })
    .join("");
}

function providerRows(group, metric, includeData) {
  const rankedCount = (key) => group.providers.filter((row) => isRank(row[key].rank)).length;
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

function providerTable(group, idPrefix) {
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
    ` data-dir-quality="${esc(group.metricDirections.quality)}"` +
    ` data-dir-speed="${esc(group.metricDirections.speed)}"` +
    ` data-dir-cost="${esc(group.metricDirections.cost)}"`;
  return (
    `<div class="provider-sort"${directions}>` +
    `<span class="sort-label">Sort by</span>` +
    radios +
    weights +
    tables +
    `</div>`
  );
}

function perRunHeatmap(group, runs) {
  const header = `<tr><th>Provider</th><th class="num">Mean</th>${runs.map((run) => `<th class="num" title="${esc(run.runName)}">${esc(run.shortLabel)}</th>`).join("")}</tr>`;
  const rows = [...group.providers]
    .sort((left, right) => rankOrLast(left.quality.rank) - rankOrLast(right.quality.rank) || left.providerKey.localeCompare(right.providerKey))
    .map((row) => {
      const cells = row.perRun
        .map((cell) => (typeof cell.heat === "number" ? `<td class="heat" style="--h:${cell.heat}">${esc(cell.display)}</td>` : `<td class="num">${esc(cell.display)}</td>`))
        .join("");
      return `<tr><td><code>${esc(row.display)}</code></td><td class="num">${esc(row.quality.display)}</td>${cells}</tr>`;
    });
  return `<div class="tablewrap"><table><thead>${header}</thead><tbody>${rows.join("\n")}</tbody><caption>Shading is relative within this table (stronger blue = higher score); run columns are listed under Runs above.</caption></table></div>`;
}

function sectionHeading(escapedLabel) {
  return `<h3 class="section">${escapedLabel}</h3>`;
}

function groupSection(group, model, idPrefix) {
  const heading = sectionHeading(esc(group.label));
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
    providerTable(group, idPrefix),
    ...(group.showPerRun === false ? [] : [
      `<h3>${esc(group.perRunMetricLabel ?? "Per-run quality score")}</h3>`,
      perRunHeatmap(group, model.runs),
    ]),
    `</section>`,
  ].join("\n");
}

function methodSection(model) {
  const paragraphs = model.methodParagraphs.map((paragraph) => `<p>${mdInline(paragraph)}</p>`).join("\n");
  return `<details><summary>Method</summary>${paragraphs}</details>`;
}

function safeHttpHref(value) {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function runInventoryCell(cell) {
  if (cell === undefined || cell === null) {
    return "";
  }
  const artifact = cell.artifactHref;
  const safeArtifact = typeof artifact === "string" && ARTIFACT_HREF_PATTERN.test(artifact)
    && !artifact.split("/").some((part) => part === ".." || part === ".") ? artifact : null;
  const href = safeArtifact ?? safeHttpHref(cell.href);
  if (href === null) {
    return esc(cell.display);
  }
  return `<a class="run-link" href="${esc(href)}" rel="noreferrer">${esc(cell.display)}</a>`;
}

function renderDashboardBody(model, idPrefix) {
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
  const sampleTables = (model.sampleTables ?? [])
    .map((table) =>
      `${sectionHeading(esc(table.title))}${(table.notes ?? []).map((note) => `<p class="notes">${mdInline(note)}</p>`).join("\n")}<div class="tablewrap"><table class="wtable samples"><thead><tr>${table.columns.map((column) => `<th>${esc(column)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${runInventoryCell(cell)}</td>`).join("")}</tr>`).join("\n")}</tbody></table></div>`)
    .join("\n");

  return `<div class="tiles">
${tiles}
</div>
${runsDetails}
${model.groups.map((group) => groupSection(group, model, idPrefix)).join("\n")}
${sampleTables}
${sectionHeading("Method &amp; notes")}
${methodSection(model)}
<ul class="notes">
${notes}
</ul>`;
}

function assertTabKey(key) {
  if (typeof key !== "string" || !TAB_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid dashboard tab key: ${key}`);
  }
}

/** Throws unless `tabs` is a non-empty list of tabs with distinct, id-safe keys. */
function assertTabs(tabs) {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    throw new Error("The dashboard needs at least one tab");
  }
  const seen = new Set();
  for (const tab of tabs) {
    assertTabKey(tab.key);
    if (seen.has(tab.key)) {
      throw new Error(`Duplicate dashboard tab key: ${tab.key}`);
    }
    seen.add(tab.key);
  }
}

/** One tab's <section class="panel">, with ids prefixed by the tab key so shared group keys never collide. */
function renderTabPanel(tab) {
  assertTabKey(tab.key);
  return [
    `<section class="panel" id="panel-${tab.key}">`,
    `<h2>${esc(tab.model.title)}</h2>`,
    `<p class="meta">Generated ${esc(tab.model.generatedAt)} &middot; <code>${esc(tab.rootLabel)}</code></p>`,
    renderDashboardBody(tab.model, `${tab.key}-`),
    `</section>`,
  ].join("\n");
}

/** Markup for the whole <main>: heading, tab radios, tab bar, and one panel per tab. */
function renderDashboard(data) {
  assertTabs(data.tabs);
  const inputs = data.tabs
    .map((tab, index) => `<input type="radio" name="dashboard-tab" id="tab-${tab.key}"${index === 0 ? " checked" : ""}>`)
    .join("\n");
  const chips = data.tabs.map((tab) => `<label for="tab-${tab.key}">${esc(tab.label)}</label>`).join("");
  const panels = data.tabs.map((tab) => renderTabPanel(tab)).join("\n");
  return `<h1>${esc(data.title)}</h1>
<p class="meta">Generated ${esc(data.generatedAt)} &middot; ${data.tabs.length} combined benchmark ${data.tabs.length === 1 ? "root" : "roots"}</p>
${inputs}
<nav class="tabbar">${chips}</nav>
${panels}`;
}

/**
 * Min-max normalises each metric within `rows` to 0-100, honouring each metric's direction, and
 * returns the weighted composite per row. Weights are rescaled to sum to 1; an all-zero set is
 * treated as equal thirds. A row missing a metric that carries weight scores `null`.
 */
function computeWeightedScores(rows, weights, directions) {
  const keys = ["quality", "speed", "cost"];
  const total = weights.quality + weights.speed + weights.cost;
  const share = {
    quality: total > 0 ? weights.quality / total : 1 / 3,
    speed: total > 0 ? weights.speed / total : 1 / 3,
    cost: total > 0 ? weights.cost / total : 1 / 3,
  };
  const bounds = {};
  for (const key of keys) {
    const values = rows.map((row) => row[key]).filter((value) => typeof value === "number" && Number.isFinite(value));
    bounds[key] = values.length > 0 ? { min: Math.min(...values), max: Math.max(...values) } : null;
  }

  return rows.map((row) => {
    let score = 0;
    let usable = true;
    for (const key of keys) {
      const weight = share[key] || 0;
      if (weight <= 0) {
        continue;
      }
      const value = row[key];
      const bound = bounds[key];
      if (typeof value !== "number" || !Number.isFinite(value) || !bound) {
        usable = false;
        continue;
      }
      const span = bound.max - bound.min;
      const fraction = span === 0
        ? 1
        : (directions[key] === "higher" ? value - bound.min : bound.max - value) / span;
      score += weight * fraction * 100;
    }
    return usable ? score : null;
  });
}

function tierClass(rank, ranked) {
  if (rank <= Math.ceil(ranked / 3)) {
    return "top";
  }
  if (rank <= Math.ceil((2 * ranked) / 3)) {
    return "middle";
  }
  return "bottom";
}

function numberOrNull(row, attribute) {
  const raw = row.getAttribute(attribute);
  if (raw === null) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCustomTable(sort) {
  const source = sort.querySelector(".sort-quality table");
  if (!source || !source.tHead || !source.tBodies[0]) {
    return null;
  }
  const wrap = document.createElement("div");
  wrap.className = "tablewrap sort-custom";
  const table = source.cloneNode(true);
  const head = table.tHead.rows[0];
  const th = document.createElement("th");
  th.className = "num";
  th.textContent = "Score";
  head.insertBefore(th, head.cells[1] || null);
  for (const row of table.tBodies[0].rows) {
    const cell = document.createElement("td");
    cell.className = "num";
    cell.setAttribute("data-score-cell", "");
    row.insertBefore(cell, row.cells[1] || null);
  }
  wrap.appendChild(table);
  sort.appendChild(wrap);
  return wrap;
}

/** Adds the Custom sort option and its three-slider weighting to every group's sort row. */
function attachWeights(main) {
  main.querySelectorAll(".provider-sort").forEach((sort, index) => {
    const panel = sort.querySelector(".weights");
    const radios = sort.querySelectorAll('input[type="radio"]');
    const last = radios[radios.length - 1];
    if (!panel || !last) {
      return;
    }
    const wrap = buildCustomTable(sort);
    if (!wrap) {
      return;
    }

    const id = `sort-custom-${index}`;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = last.getAttribute("name");
    radio.id = id;
    radio.value = "custom";
    const label = document.createElement("label");
    label.className = "sort-opt";
    label.setAttribute("for", id);
    label.textContent = "Custom";
    const anchor = sort.querySelector(`label[for="${last.id}"]`) || last;
    anchor.parentNode.insertBefore(radio, anchor.nextSibling);
    radio.parentNode.insertBefore(label, radio.nextSibling);

    const sliders = {};
    const outputs = {};
    for (const metric of SORT_METRICS) {
      sliders[metric] = panel.querySelector(`input[data-weight="${metric}"]`);
      outputs[metric] = panel.querySelector(`output[for="${sliders[metric].id}"]`);
    }

    const rows = [...wrap.querySelectorAll("tbody tr")];
    const body = wrap.querySelector("tbody");
    const caption = wrap.querySelector("caption");
    const directions = {
      quality: sort.getAttribute("data-dir-quality") || "higher",
      speed: sort.getAttribute("data-dir-speed") || "lower",
      cost: sort.getAttribute("data-dir-cost") || "lower",
    };

    const current = () => ({
      quality: Number(sliders.quality.value) || 0,
      speed: Number(sliders.speed.value) || 0,
      cost: Number(sliders.cost.value) || 0,
    });

    // The three weights are one budget of 100. Moving one redistributes the remainder across the
    // other two in their existing proportion, so every thumb tracks the percentage beside it.
    const rebalance = (moved) => {
      const weights = current();
      const others = SORT_METRICS.filter((metric) => metric !== moved);
      const remainder = 100 - weights[moved];
      const pool = weights[others[0]] + weights[others[1]];
      const first = pool > 0 ? Math.round((remainder * weights[others[0]]) / pool) : Math.round(remainder / 2);
      weights[others[0]] = first;
      weights[others[1]] = remainder - first;
      return weights;
    };

    const paint = (weights) => {
      for (const metric of SORT_METRICS) {
        sliders[metric].value = String(weights[metric]);
        if (outputs[metric]) {
          outputs[metric].textContent = `${weights[metric]}%`;
        }
      }

      const scores = computeWeightedScores(
        rows.map((row) => ({
          quality: numberOrNull(row, "data-q"),
          speed: numberOrNull(row, "data-s"),
          cost: numberOrNull(row, "data-c"),
        })),
        weights,
        directions,
      );

      const entries = rows.map((row, position) => ({ row, score: scores[position] }));
      entries.sort((left, right) => {
        if (left.score === null && right.score === null) {
          return 0;
        }
        if (left.score === null) {
          return 1;
        }
        if (right.score === null) {
          return -1;
        }
        return right.score - left.score;
      });

      const ranked = entries.filter((entry) => entry.score !== null).length;
      entries.forEach((entry, position) => {
        const cell = entry.row.querySelector("[data-score-cell]");
        if (cell) {
          if (entry.score === null) {
            cell.textContent = "n/a";
          } else {
            cell.textContent = entry.score.toFixed(1);
            const chip = document.createElement("span");
            chip.className = `rk ${tierClass(position + 1, ranked)}`;
            chip.textContent = String(position + 1);
            cell.appendChild(chip);
          }
        }
        body.appendChild(entry.row);
      });

      if (caption) {
        caption.textContent = `Sorted by your custom weighting: quality ${weights.quality}%, speed ${weights.speed}%, cost ${weights.cost}%.`
          + " Score min-max normalises each metric within this group to 0-100, so it ranks these providers"
          + " against each other only and is not comparable across groups or tabs."
          + " A provider missing a weighted metric scores n/a and sorts last.";
      }
    };

    for (const metric of SORT_METRICS) {
      sliders[metric].addEventListener("input", () => {
        paint(rebalance(metric));
        radio.checked = true;
      });
    }

    const reset = panel.querySelector(".weights-reset");
    if (reset) {
      reset.addEventListener("click", () => {
        paint({ quality: WEIGHT_DEFAULTS.quality, speed: WEIGHT_DEFAULTS.speed, cost: WEIGHT_DEFAULTS.cost });
        const quality = sort.querySelector('input[value="quality"]');
        if (quality) {
          quality.checked = true;
        }
      });
    }

    paint(current());
  });
}

function activateTab(main, key) {
  for (const label of main.querySelectorAll(".tabbar label")) {
    label.classList.toggle("active", label.getAttribute("for") === `tab-${key}`);
  }
  for (const panel of main.querySelectorAll(".panel")) {
    panel.classList.toggle("active", panel.id === `panel-${key}`);
  }
}

/** Shows the checked tab's panel and highlights its chip; the radios stay keyboard-navigable. */
function attachTabs(main) {
  const radios = [...main.querySelectorAll('input[name="dashboard-tab"]')];
  const keyOf = (radio) => radio.id.slice("tab-".length);
  for (const radio of radios) {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        activateTab(main, keyOf(radio));
      }
    });
  }
  const checked = radios.find((radio) => radio.checked) ?? radios[0];
  if (checked) {
    activateTab(main, keyOf(checked));
  }
}

/** Replaces the shell's contents with the rendered dashboard and wires up its controls. */
function mount(main, data) {
  main.innerHTML = renderDashboard(data);
  if (typeof data.title === "string") {
    document.title = data.title;
  }
  attachTabs(main);
  attachWeights(main);
}

function showStatus(main, message) {
  let status = main.querySelector(".status");
  if (!status) {
    status = document.createElement("p");
    status.className = "status";
    main.appendChild(status);
  }
  status.textContent = message;
}

/** Loads the JSON named by `data-source` (a sibling file, relative to the page) and renders it. */
async function boot(main) {
  const source = main.getAttribute("data-source") || "combined-comparison-dashboard.json";
  try {
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    mount(main, await response.json());
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    showStatus(
      main,
      `Could not load ${source} (${reason}). Browsers block a file:// page from reading sibling files, so open this page through an HTTP server.`,
    );
  }
}

const api = {
  TAB_KEY_PATTERN,
  SORT_METRICS,
  WEIGHT_DEFAULTS,
  esc,
  assertTabs,
  renderTabPanel,
  renderDashboard,
  computeWeightedScores,
  mount,
  boot,
};

if (typeof module === "object" && module !== null && typeof module.exports === "object") {
  // Bun and Node load this file as CommonJS for the test suite.
  module.exports = api;
} else {
  globalThis.AutoShowDashboard = api;
}

if (typeof document !== "undefined") {
  const main = document.querySelector("main.dashboard[data-source]");
  if (main) {
    boot(main);
  }
}
