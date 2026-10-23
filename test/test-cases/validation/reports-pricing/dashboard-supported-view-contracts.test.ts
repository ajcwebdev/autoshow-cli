import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildSupportedDashboardModel } from "../../../../.codex/skills/consensus/scripts/shared/dashboard_supported_view";
import type {
  CombinedDashboardModel,
  DashboardGroup,
  DashboardProviderRow,
} from "../../../../.codex/skills/consensus/scripts/shared/combined_report_html";

// The committed archive holds only current routes, so synthetic retired rows exercise the projection.
const removedKeys = ["retired/write-model-a", "retired/write-model-b"];

function withRetiredRows(current: CombinedDashboardModel): CombinedDashboardModel {
  const archive = structuredClone(current);
  for (const section of archive.groups) {
    section.providers.push(...removedKeys.map(providerKey => ({ ...structuredClone(section.providers[0]!), providerKey, display: providerKey, model: providerKey })));
  }
  for (const table of archive.sampleTables ?? []) {
    const column = table.providerKeyColumn!;
    table.rows.push(...removedKeys.map(key => table.rows[0]!.map((cell, index) => index === column ? { ...cell, display: key } : { ...cell })));
  }
  for (const stat of archive.summaryStats) if (stat.label === "Model / provider routes") stat.value = String(Number(stat.value) + removedKeys.length);
  return archive;
}

function provider(providerKey: string, rank: number | null = 1): DashboardProviderRow {
  return {
    providerKey, display: providerKey, model: providerKey, coverage: "2/2",
    quality: { display: "98", rank, value: 98 },
    speed: { display: "5s", rank, value: 5 },
    cost: { display: "$1", rank, value: 1 },
    evidence: ["Original evidence"], perRun: [{ display: "98", heat: 98 }, { display: "Missing", heat: null }],
  };
}

function group(key: string, providers: DashboardProviderRow[]): DashboardGroup {
  return { key, label: key, metricColumns: { quality: "Quality", speed: "Speed", cost: "Cost" },
    metricDirections: { quality: "higher", speed: "higher", cost: "lower" }, evidenceColumns: ["Evidence"], providers };
}

function model(category: string, groups: DashboardGroup[], summaryStats: CombinedDashboardModel["summaryStats"] = []): CombinedDashboardModel {
  return { title: "Benchmark", category, rootDir: "docs/benchmarks", generatedAt: "2026-10-18", summaryStats,
    runs: [{ runName: "one", shortLabel: "R1", detail: "2 providers" }, { runName: "two", shortLabel: "R2", detail: "2 providers" }],
    groups, methodParagraphs: ["Original methodology"], notes: ["Original note"] };
}

const stats = (view: CombinedDashboardModel) => Object.fromEntries(view.summaryStats.map(stat => [stat.label, stat.value]));
const cells = (...values: string[]) => values.map(display => ({ display }));

function writeModel(): CombinedDashboardModel {
  const result = model("text", [group("all-five", [provider("active/model"), provider("retired/model")])], [
    { label: "Prompt cases", value: "2" }, { label: "Model / provider routes", value: "2" },
    { label: "Valid outputs", value: "3/4" }, { label: "First-pass attempts / valid", value: "4 / 1" },
    { label: "Rerun attempts / valid", value: "3 / 2" }, { label: "Usage-based cost", value: "$100.5" },
    { label: "Attempted slots with unknown cost", value: "2" },
  ]);
  result.sampleTables = [{ title: "Request evidence — all attempts", providerKeyColumn: 1,
    columns: ["Prompt", "Model / provider", "Attempt", "Selected", "Status", "$ / request"], rows: [
      cells("One", "active/model", "01", "no", "validation-failed", "$0.250000"),
      cells("One", "active/model", "02", "yes", "succeeded", "$0.125000"),
      cells("Two", "active/model", "01", "no", "failed", "n/a"),
      cells("Two", "active/model", "02", "yes", "failed", "$0.125000"),
      cells("One", "retired/model", "01", "yes", "succeeded", "$100.000000"),
      cells("Two", "retired/model", "01", "no", "failed", "n/a"),
      cells("Two", "retired/model", "02", "yes", "succeeded", "$0.000000"),
    ] }];
  return result;
}

describe("Current CLI dashboard projection", () => {
  test("removes retired write routes from every ranking and evidence table without changing the archive", () => {
    const data = JSON.parse(readFileSync("docs/benchmarks/combined-comparison-dashboard.json", "utf8"));
    const current = data.tabs.find((tab: { key: string }) => tab.key === "write").model as CombinedDashboardModel;
    for (const table of current.sampleTables ?? []) table.providerKeyColumn = 1;
    const original = withRetiredRows(current);
    const originalBytes = JSON.stringify(original);
    const keys = original.groups[0]!.providers.map(row => row.providerKey).filter(key => !removedKeys.includes(key));
    const view = buildSupportedDashboardModel(original, keys);
    expect(keys).toHaveLength(8);
    for (const retired of removedKeys) {
      expect(original.groups[0]!.providers.some(row => row.providerKey === retired)).toBe(true);
      for (const section of view.groups) expect(section.providers.some(row => row.providerKey === retired)).toBe(false);
      for (const table of view.sampleTables ?? []) expect(table.rows.some(row => row[1]?.display === retired)).toBe(false);
    }
    expect(stats(view)["Model / provider routes"]).toBe("8");
    expect(JSON.stringify(original)).toBe(originalBytes);
    expect(original.groups[0]!.providers).toHaveLength(10);
    expect(stats(original)["Model / provider routes"]).toBe("10");
    expect(original.sampleTables![0]!.rows.length).toBeGreaterThan(view.sampleTables![0]!.rows.length);
  });

  test("compacts surviving eligible ranks, preserves ties and retains raw metric directions and heatmap evidence", () => {
    const retired = provider("old", 1), first = provider("first", 3), tied = provider("tied", 3), last = provider("last", 8), invalid = provider("invalid", null);
    first.cost.rank = 8;
    tied.cost.rank = 4;
    last.cost.rank = 6;
    invalid.speed.value = 1000;
    const original = model("ocr", [group("thirdPartyService", [retired, first, tied, last, invalid])]);
    const view = buildSupportedDashboardModel(original, ["first", "tied", "last", "invalid"]);
    const rows = view.groups[0]!.providers;
    expect(rows.map(row => row.quality.rank)).toEqual([1, 1, 3, null]);
    expect(rows.map(row => row.cost.rank)).toEqual([3, 1, 2, null]);
    expect(rows[3]!.speed).toEqual({ display: "5s", rank: null, value: 1000 });
    expect(view.groups[0]!.metricDirections).toEqual({ quality: "higher", speed: "higher", cost: "lower" });
    expect(rows[0]!.perRun).toEqual(first.perRun);
    expect(rows[0]!.evidence).toEqual(first.evidence);
    rows[0]!.perRun[0]!.display = "Changed in projection";
    expect(first.perRun[0]!.display).toBe("98");
    expect(first.quality.rank).toBe(3);
  });

  test("keeps retired-only groups empty and recomputes OCR and diarization group counts", () => {
    const original = model("ocr", [group("local", [provider("old-local")]), group("thirdPartyService", [provider("current"), provider("old-service")])], [
      { label: "Runs", value: "2" }, { label: "Pages", value: "8" }, { label: "Providers", value: "3" },
      { label: "Third-party service", value: "2" }, { label: "Local", value: "1" },
    ]);
    const view = buildSupportedDashboardModel(original, ["current"]);
    expect(view.groups.map(section => section.providers.length)).toEqual([0, 1]);
    expect(stats(view)).toEqual({ "Archive runs": "2", "Archive pages": "8", Providers: "1", "Third-party service": "1", Local: "0" });
    const stt = model("stt", [group("local", [provider("local")]), group("thirdPartyServiceNonDiarization", [provider("old")]), group("thirdPartyServiceDiarization", [provider("diarized")])], [
      { label: "Providers", value: "3" }, { label: "Non-diarization", value: "1" }, { label: "Diarization", value: "1" }, { label: "Local", value: "1" },
    ]);
    expect(stats(buildSupportedDashboardModel(stt, ["diarized", "local"]))).toEqual({ Providers: "2", "Non-diarization": "0", Diarization: "1", Local: "1" });
  });

  test("recomputes URL coverage counts while labeling unavailable row-quality totals and retaining source inventory", () => {
    const active = provider("active");
    active.coverage = "1/2";
    const original = model("url", [group("service", [provider("retired"), active])], [
      { label: "Providers", value: "2" }, { label: "Provider rows", value: "3" },
      { label: "Automated quality rows", value: "2" }, { label: "Human quality rows", value: "0" },
    ]);
    original.runInventoryColumns = [{ key: "source", label: "Source" }, { key: "serviceQuality", label: "Best quality" }];
    original.runs[0]!.inventory = { source: { display: "Source", href: "https://example.com" }, serviceQuality: { display: "retired (99)", artifactHref: "retired-only.md" } };
    const view = buildSupportedDashboardModel(original, ["active"]);
    expect(stats(view)).toEqual({ Providers: "1", "Provider rows": "1", "Archive automated quality rows": "2", "Archive human quality rows": "0" });
    expect(view.runs[0]!.detail).toBe("Archive: 2 providers");
    expect(view.runs[0]!.inventory!["source"]).toEqual(original.runs[0]!.inventory!["source"]);
    expect(view.runs[0]!.inventory!["serviceQuality"]).toEqual({ display: "Archive leader unavailable in CLI" });
  });

  test("filters every TTS suite and counts visible narration models, controls and actual audio links", () => {
    const original = model("tts", [group("service", [provider("active"), provider("old")])], [
      { label: "Narration inputs", value: "2" }, { label: "Narration models", value: "2" },
      { label: "Controls results", value: "4" }, { label: "Audio measurements", value: "5" }, { label: "Quality assessment", value: "ASR only; subjective unscored" },
    ]);
    original.sampleTables = ["Narration — individual results", "Emotion and delivery", "Speed and pauses"].map(title => ({
      title, providerKeyColumn: 1, columns: ["Run / case", "Provider / model", "Audio", "ASR WER"], rows: [
        [{ display: "case" }, { display: "active" }, { display: "WAV", artifactHref: "active.wav" }, { display: "1.25%" }],
        [{ display: "case" }, { display: "old" }, { display: "WAV", artifactHref: "old.wav" }, { display: "0.00%" }],
      ],
    }));
    original.sampleTables[2]!.rows[0]![2] = { display: "Unavailable" };
    const view = buildSupportedDashboardModel(original, ["active"]);
    expect(view.sampleTables!.map(table => table.rows.length)).toEqual([1, 1, 1]);
    expect(stats(view)).toEqual({ "Archive narration inputs": "2", "Narration models": "1", "Controls results": "2", "Audio measurements": "2", "Quality assessment": "ASR only; subjective unscored" });
    expect(stats(buildSupportedDashboardModel(original, []))).toEqual({ "Archive narration inputs": "2", "Narration models": "0", "Controls results": "0", "Audio measurements": "0", "Quality assessment": "Unavailable" });
  });

  test("keeps visible failed-attempt costs and unresolved bills while excluding retired routes from selected and rerun counts", () => {
    const view = buildSupportedDashboardModel(writeModel(), ["active/model"]);
    expect(stats(view)).toEqual({
      "Prompt cases": "2", "Model / provider routes": "1", "Valid outputs": "1/2",
      "First-pass attempts / valid": "2 / 0", "Rerun attempts / valid": "2 / 1",
      "Usage-based cost": "$0.500000", "Attempted slots with unknown cost": "1",
    });
    expect(view.sampleTables![0]!.rows).toHaveLength(4);
    expect(view.methodParagraphs.join(" ")).toContain("displayed monetary precision");
  });

  test("distinguishes visible unknown costs from an empty model selection", () => {
    const original = writeModel();
    original.sampleTables![0]!.rows = [cells("One", "active/model", "01", "yes", "failed", "n/a")];
    const unknown = stats(buildSupportedDashboardModel(original, ["active/model"]));
    expect(unknown["Usage-based cost"]).toBe("Unavailable");
    expect(unknown["Attempted slots with unknown cost"]).toBe("1");
    const empty = buildSupportedDashboardModel(original, []);
    expect(empty.groups[0]!.providers).toEqual([]);
    expect(empty.sampleTables![0]!.rows).toEqual([]);
    expect(stats(empty)["Valid outputs"]).toBe("0/0");
    expect(stats(empty)["Usage-based cost"]).toBe("$0.000000");
    expect(stats(empty)["Attempted slots with unknown cost"]).toBe("0");
  });

  test("uses explicit provider metadata instead of guessing from arbitrary table text", () => {
    const original = model("other", [group("service", [provider("exact/model"), provider("exact/model-long")])]);
    original.sampleTables = [{ title: "Source notes", columns: ["Text"], rows: [cells("exact/model-long is source context")] },
      { title: "Evidence", providerKeyColumn: 0, columns: ["Model", "Description"], rows: [cells("exact/model", "Retained"), cells("exact/model-long", "Removed")] }];
    const view = buildSupportedDashboardModel(original, ["exact/model"]);
    expect(view.groups[0]!.providers.map(row => row.providerKey)).toEqual(["exact/model"]);
    expect(view.sampleTables![0]!.rows).toEqual(original.sampleTables![0]!.rows);
    expect(view.sampleTables![1]!.rows).toEqual([cells("exact/model", "Retained")]);
  });
});
