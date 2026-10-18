import type {
  CombinedDashboardModel,
  DashboardGroup,
  DashboardProviderRow,
  DashboardRunInventoryCell,
} from "./combined_report_html";

type SampleTable = NonNullable<CombinedDashboardModel["sampleTables"]>[number];
type SummaryStat = CombinedDashboardModel["summaryStats"][number];

const METRICS = ["quality", "speed", "cost"] as const;
const UNATTEMPTED = new Set(["missing", "pending", "not-started", "skipped"]);
const FILTER_EXPLANATION = "Only models currently selectable by the CLI are shown. Ranks are recomputed among the visible eligible models; missing or invalid results remain unranked. Source runs and archive totals retain their original scope.";

function compactRanks(providers: DashboardProviderRow[]): void {
  for (const metric of METRICS) {
    const eligible = providers.filter(row => row[metric].rank !== null)
      .sort((left, right) => left[metric].rank! - right[metric].rank!);
    let previousOriginalRank: number | undefined;
    let currentRank = 0;
    for (const [index, row] of eligible.entries()) {
      const originalRank = row[metric].rank!;
      if (originalRank !== previousOriginalRank) currentRank = index + 1;
      row[metric].rank = currentRank;
      previousOriginalRank = originalRank;
    }
  }
}

function cell(row: DashboardRunInventoryCell[], table: SampleTable, column: string): string {
  return row[table.columns.indexOf(column)]?.display ?? "";
}

function money(value: string): number | null {
  if (!/^\$\d+(?:\.\d+)?$/.test(value)) return null;
  return Number(value.slice(1));
}

function archiveStat(stat: SummaryStat): SummaryStat {
  return { ...stat, label: `Archive ${stat.label.charAt(0).toLowerCase()}${stat.label.slice(1)}` };
}

function providerCount(groups: DashboardGroup[], groupKey?: string): number {
  return new Set(groups.filter(group => groupKey === undefined || group.key === groupKey)
    .flatMap(group => group.providers.map(provider => provider.providerKey))).size;
}

function writeStats(model: CombinedDashboardModel): Map<string, string> {
  const table = model.sampleTables?.find(table => table.providerKeyColumn !== undefined
    && table.columns.includes("Attempt") && table.columns.includes("Selected"));
  if (!table) return new Map();
  const attempted = table.rows.filter(row => !UNATTEMPTED.has(cell(row, table, "Status")));
  const firstPass = attempted.filter(row => cell(row, table, "Attempt") === "01");
  const reruns = attempted.filter(row => cell(row, table, "Attempt") !== "01");
  const validCount = (rows: DashboardRunInventoryCell[][]) => rows.filter(row => cell(row, table, "Status") === "succeeded").length;
  const routes = new Set(table.rows.map(row => row[table.providerKeyColumn!]?.display).filter(Boolean));
  for (const group of model.groups) for (const provider of group.providers) routes.add(provider.providerKey);
  const promptCases = model.summaryStats.find(stat => stat.label === "Prompt cases")?.value;
  const caseCount = promptCases !== undefined && /^\d+$/.test(promptCases) ? Number(promptCases) : model.runs.length;
  const selected = table.rows.filter(row => cell(row, table, "Selected") === "yes");
  const costs = table.rows.map(row => money(cell(row, table, "$ / request"))).filter(value => value !== null);
  return new Map([
    ["Model / provider routes", String(routes.size)],
    ["Valid outputs", `${validCount(selected)}/${routes.size * caseCount}`],
    ["First-pass attempts / valid", `${firstPass.length} / ${validCount(firstPass)}`],
    ["Rerun attempts / valid", `${reruns.length} / ${validCount(reruns)}`],
    ["Usage-based cost", table.rows.length && costs.length === 0 ? "Unavailable" : `$${costs.reduce((sum, value) => sum + value, 0).toFixed(6)}`],
    ["Attempted slots with unknown cost", String(attempted.filter(row => money(cell(row, table, "$ / request")) === null).length)],
  ]);
}

function ttsStats(model: CombinedDashboardModel): Map<string, string> {
  const tables = model.sampleTables?.filter(table => table.providerKeyColumn !== undefined) ?? [];
  const narration = tables.find(table => table.title.startsWith("Narration"));
  if (!narration) return new Map();
  const audioMeasurements = tables.reduce((total, table) => {
    const audioColumn = table.columns.indexOf("Audio");
    return total + table.rows.filter(row => row[audioColumn]?.artifactHref || row[audioColumn]?.href).length;
  }, 0);
  return new Map([
    ["Narration models", String(new Set(narration.rows.map(row => row[narration.providerKeyColumn!]?.display)).size)],
    ["Controls results", String(tables.filter(table => table !== narration).reduce((sum, table) => sum + table.rows.length, 0))],
    ["Audio measurements", String(audioMeasurements)],
    ["Quality assessment", tables.some(table => {
      const asrColumn = table.columns.indexOf("ASR WER");
      return table.rows.some(row => /^\d+(?:\.\d+)?%$/.test(row[asrColumn]?.display ?? ""));
    }) ? "ASR only; subjective unscored" : "Unavailable"],
  ]);
}

function supportedStats(model: CombinedDashboardModel): SummaryStat[] {
  const counts = new Map<string, string>([["Providers", String(providerCount(model.groups))]]);
  if (model.category === "ocr") {
    counts.set("Local", String(providerCount(model.groups, "local")));
    counts.set("Third-party service", String(providerCount(model.groups, "thirdPartyService")));
  } else if (model.category === "stt") {
    counts.set("Local", String(providerCount(model.groups, "local")));
    counts.set("Non-diarization", String(providerCount(model.groups, "thirdPartyServiceNonDiarization")));
    counts.set("Diarization", String(providerCount(model.groups, "thirdPartyServiceDiarization")));
  } else if (model.category === "url") {
    const rows = model.groups.flatMap(group => group.providers);
    const coverage = rows.map(row => /^(\d+)\/\d+$/.exec(row.coverage));
    if (coverage.every(match => match !== null)) {
      counts.set("Provider rows", String(coverage.reduce((sum, match) => sum + Number(match![1]), 0)));
    }
  } else if (model.category === "tts") {
    for (const [key, value] of ttsStats(model)) counts.set(key, value);
  } else if (model.category === "text") {
    for (const [key, value] of writeStats(model)) counts.set(key, value);
  }
  return model.summaryStats.map(stat => {
    const value = counts.get(stat.label);
    if (value !== undefined) return { ...stat, value };
    if (stat.label === "Prompt cases") return stat;
    return archiveStat(stat);
  });
}

/** Project archived benchmark results onto exact provider/model routes in the current CLI catalog. */
export function buildSupportedDashboardModel(
  model: CombinedDashboardModel,
  supportedProviderKeys: readonly string[],
): CombinedDashboardModel {
  const supported = new Set(supportedProviderKeys);
  const result = structuredClone(model);
  for (const group of result.groups) {
    group.providers = group.providers.filter(provider => supported.has(provider.providerKey));
    compactRanks(group.providers);
  }
  for (const table of result.sampleTables ?? []) {
    if (table.providerKeyColumn !== undefined) {
      table.rows = table.rows.filter(row => supported.has(row[table.providerKeyColumn!]?.display ?? ""));
    }
  }
  for (const run of result.runs) {
    run.detail = `Archive: ${run.detail}`;
    for (const column of result.runInventoryColumns ?? []) {
      if (!["localQuality", "serviceQuality", "servicePrice", "serviceSpeed"].includes(column.key)) continue;
      const entry = run.inventory?.[column.key];
      if (!entry) continue;
      const key = /^(.*?) \(/.exec(entry.display)?.[1];
      if (key && !supported.has(key)) run.inventory![column.key] = { display: "Archive leader unavailable in CLI" };
    }
  }
  result.summaryStats = supportedStats(result);
  result.methodParagraphs.push(FILTER_EXPLANATION);
  if (result.category === "text") {
    result.methodParagraphs.push("Usage-based cost totals include every visible attempt, including failed and superseded requests, summed at the displayed monetary precision. Unknown charges remain separate; these are not confirmed provider invoices.");
  }
  return result;
}
