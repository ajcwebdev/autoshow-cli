import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { readCanonicalManifest, isRecord, type JsonObject } from "../shared/pipeline_manifest";
import type { CombinedDashboardModel, DashboardGroup, DashboardProviderRow } from "../shared/combined_report_html";
import { toProjectRelativePath } from "../../../../../src/utils/project-root";

export const WRITE_BENCHMARK_CASES = [
  { directory: "2026-10-18_01-short-summary", key: "short-summary", label: "Short summary", prompt: "shortSummary" },
  { directory: "2026-10-18_02-long-summary", key: "long-summary", label: "Long summary", prompt: "longSummary" },
  { directory: "2026-10-18_03-medium-chapters", key: "medium-chapters", label: "Medium chapters", prompt: "mediumChapters" },
  { directory: "2026-10-18_04-blog", key: "blog", label: "Blog", prompt: "blog" },
  { directory: "2026-10-18_05-rap-song-chapter", key: "rap-song-chapter", label: "Rap song chapter", prompt: "rapSongChapter" },
] as const;

export interface WriteDashboardSample {
  /** Path to this attempt, relative to the Write benchmark root. */
  run: string;
  attempt: string;
  selected: boolean;
  caseKey: string;
  providerKey: string;
  status: string;
  processingMs: number | null;
  costDollars: number | null;
  costBasis: string;
  inputTokens: number | null;
  outputTokens: number | null;
  outputPricePerMillion: number | null;
  schema: string;
  outputHref: string | null;
  manifestHref: string | null;
}

const object = (value: unknown): JsonObject => isRecord(value) ? value : {};
const records = (value: unknown): JsonObject[] => Array.isArray(value) ? value.filter(isRecord) : isRecord(value) ? [value] : [];
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const string = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const money = (value: number | null): string => value === null ? "n/a" : `$${value.toFixed(6)}`;
const average = (values: Array<number | null>): number | null => values.length > 0 && values.every(value => value !== null)
  ? values.reduce<number>((sum, value) => sum + value!, 0) / values.length : null;

function identity(row: JsonObject): string | null {
  const provider = string(row["llmService"]) ?? string(row["service"]) ?? string(row["provider"]);
  const model = string(row["llmModel"]) ?? string(row["model"]);
  return provider && model ? `${provider}/${model}` : null;
}

function outputArtifact(runDir: string, providerKey: string, fileName: unknown, format: unknown): { valid: boolean; file: string | null; error: string | null } {
  const name = string(fileName);
  if (!name || isAbsolute(name)) return { valid: false, file: null, error: "missing output" };
  const file = resolve(runDir, name), rel = relative(runDir, file);
  if (rel.startsWith("..") || isAbsolute(rel)) return { valid: false, file: null, error: "invalid output path" };
  if (!existsSync(file) || !statSync(file).isFile()) return { valid: false, file: null, error: "missing output" };
  const bytes = readFileSync(file), text = bytes.toString("utf8");
  if (!text.trim()) return { valid: false, file, error: "empty output" };
  if (format === "json" || name.endsWith(".json")) {
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return { valid: false, file, error: "invalid JSON output" }; }
    if (!isRecord(parsed) || Object.keys(parsed).length === 0) return { valid: false, file, error: "invalid structured output" };
    if ("_validationError" in parsed || "_raw" in parsed) return { valid: false, file, error: "validation failure envelope" };
  }
  const slotPath = join(runDir, `slot-${providerKey.replace(/[/\\:*?"<>|]/g, "-")}.json`);
  if (existsSync(slotPath)) {
    let slot: JsonObject;
    try { slot = object(JSON.parse(readFileSync(slotPath, "utf8"))); } catch { return { valid: false, file, error: "invalid slot evidence" }; }
    if (identity(slot) !== providerKey) return { valid: false, file, error: "invalid slot identity" };
    if (slot["status"] !== "completed") return { valid: false, file, error: "slot not completed" };
    const expected = string(object(slot["artifactHashes"])[name]);
    if (!expected) return { valid: false, file, error: "unverified output artifact" };
    if (createHash("sha256").update(bytes).digest("hex") !== expected) return { valid: false, file, error: "artifact hash mismatch" };
  }
  return { valid: true, file, error: null };
}

/** Dashboard artifacts live above the text category grouping. */
export function writeDashboardLinkRoot(rootDir: string): string {
  const parent = dirname(resolve(rootDir));
  return basename(parent) === "text" ? dirname(parent) : parent;
}

export function collectWriteDashboardAttempts(rootDir: string): WriteDashboardSample[] {
  const root = resolve(rootDir), samples: WriteDashboardSample[] = [];
  const href = (path: string) => relative(writeDashboardLinkRoot(root), path).split("\\").join("/");
  const planPath = join(root, "benchmark-plan.json");
  const plan = existsSync(planPath) ? object(JSON.parse(readFileSync(planPath, "utf8"))) : {};
  const plannedProviders = records(plan["providers"]);
  for (const benchmark of WRITE_BENCHMARK_CASES) {
    const firstRunDir = join(root, benchmark.directory), rerunsDir = join(firstRunDir, "reruns");
    const reruns = existsSync(rerunsDir) ? readdirSync(rerunsDir, { withFileTypes: true })
      .filter(entry => entry.name !== ".DS_Store" && entry.isDirectory() && existsSync(join(rerunsDir, entry.name, "manifest.json")))
      .map(entry => entry.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [];
    for (const attempt of ["01", ...reruns]) {
      const run = attempt === "01" ? benchmark.directory : `${benchmark.directory}/reruns/${attempt}`;
      const runDir = join(root, run);
      if (!existsSync(join(runDir, "manifest.json"))) {
        for (const planned of plannedProviders) {
          const providerKey = identity(planned);
          if (!providerKey) continue;
          const outputRate = number(planned["outputCostPer1MCents"]);
          samples.push({ run, attempt, selected: false, caseKey: benchmark.key, providerKey, status: "missing",
            processingMs: null, costDollars: null, costBasis: "unavailable", inputTokens: null, outputTokens: null,
            outputPricePerMillion: outputRate === null ? null : outputRate / 100, schema: "not recorded", outputHref: null,
            manifestHref: null });
        }
        continue;
      }
      const manifest = readCanonicalManifest(runDir);
      if (manifest.command !== "write" || manifest.scope !== "single" || manifest.items.length !== 1) {
        throw Error(`Expected one canonical Write benchmark item: ${run}`);
      }
      const item = manifest.items[0]!, metadata = item.metadata;
      const steps = records(metadata["step3"]);
      const cost = object(metadata["cost"]);
      const actualCosts = records(object(cost["actual"])["steps"]).filter(row => row["step"] === undefined || row["step"] === "llm");
      const estimates = records(object(cost["estimated"])["steps"]).filter(row => row["step"] === undefined || row["step"] === "llm");
      const states = [...records(metadata["providerStates"]), ...item.providers as unknown as JsonObject[]];
      // Global planned routes fill first-pass omissions; a rerun contains only its explicit targets.
      const requested = [...(attempt === "01" ? plannedProviders : []), ...records(metadata["requestedProviders"]), ...states, ...estimates, ...steps];
      const keys = [...new Set(requested.map(identity).filter((key): key is string => key !== null))].sort();
      for (const providerKey of keys) {
        const entry = steps.find(row => identity(row) === providerKey);
        const state = states.find(row => identity(row) === providerKey);
        const recordedCosts = actualCosts.filter(row => identity(row) === providerKey);
        const estimated = estimates.find(row => identity(row) === providerKey);
        const planned = plannedProviders.find(row => identity(row) === providerKey);
        const outputRate = number(planned?.["outputCostPer1MCents"]) ?? number(estimated?.["outputCostPer1MCents"]);
        const artifact = outputArtifact(runDir, providerKey, entry?.["outputFileName"], entry?.["outputFormat"]);
        const schema = entry?.["validationFailed"] === true ? "failed" : entry?.["validationFailed"] === false ? "passed" : "not recorded";
        const stateStatus = string(state?.["status"]);
        let failedElapsedMs: number | null = null;
        if (stateStatus === "failed") {
          const receiptPath = join(runDir, `slot-${providerKey.replace(/[/\\:*?"<>|]/g, "-")}.json`);
          if (existsSync(receiptPath)) {
            try {
              const receipt = object(JSON.parse(readFileSync(receiptPath, "utf8")));
              if (identity(receipt) === providerKey && receipt["status"] === "failed") failedElapsedMs = number(receipt["wallTimeMs"]);
            } catch { /* Invalid failure evidence does not establish an elapsed time. */ }
          }
        }
        const status = stateStatus && stateStatus !== "succeeded" ? stateStatus
          : !entry ? "missing" : schema === "failed" ? "schema failed" : schema !== "passed" ? "validation unrecorded" : artifact.error ?? "succeeded";
        const costs = recordedCosts.map(row => number(row["cost"]));
        const costCents = costs.length && costs.every(value => value !== null) ? costs.reduce<number>((sum, value) => sum + value!, 0) : null;
        const costSources = [...new Set(recordedCosts.map(row => string(row["costSource"]) ?? "recorded usage"))];
        samples.push({
          run, attempt, selected: false, caseKey: benchmark.key, providerKey, status,
          processingMs: number(entry?.["processingTime"]) ?? failedElapsedMs, costDollars: costCents === null ? null : costCents / 100,
          costBasis: costSources.length ? costSources.join(", ") : "unavailable",
          inputTokens: number(entry?.["inputTokenCount"]), outputTokens: number(entry?.["outputTokenCount"]),
          outputPricePerMillion: outputRate === null ? null : outputRate / 100,
          schema, outputHref: artifact.file ? href(artifact.file) : null,
          manifestHref: href(join(runDir, "manifest.json")),
        });
      }
    }
  }
  const selected = new Map<string, WriteDashboardSample>();
  for (const sample of samples) {
    const key = `${sample.caseKey}/${sample.providerKey}`;
    // An unfinished rerun cannot erase an earlier result. Terminal failures do replace it.
    if (sample.attempt === "01" || !["missing", "pending", "not-started", "running", "dispatch-started"].includes(sample.status)) selected.set(key, sample);
  }
  for (const sample of selected.values()) sample.selected = true;
  return samples;
}

/** Current comparison: one latest completed attempt per prompt/model pair. */
export function collectWriteDashboardSamples(rootDir: string): WriteDashboardSample[] {
  return collectWriteDashboardAttempts(rootDir).filter(sample => sample.selected);
}

function rankProviders(providers: DashboardProviderRow[]): void {
  for (const metric of ["quality", "speed", "cost"] as const) {
    const ranked = providers.filter(row => row[metric].value !== null && row[metric].value !== undefined)
      .sort((a, b) => (metric === "quality" ? -1 : 1) * (a[metric].value! - b[metric].value!) || a.providerKey.localeCompare(b.providerKey));
    ranked.forEach((row, index) => {
      row[metric].rank = index > 0 && row[metric].value === ranked[index - 1]![metric].value ? ranked[index - 1]![metric].rank : index + 1;
    });
  }
}

export function buildTextDashboard(rootDir: string, generatedAt = new Date().toISOString()): { dashboardModel: CombinedDashboardModel; samples: WriteDashboardSample[]; attempts: WriteDashboardSample[] } {
  const root = resolve(rootDir), attempts = collectWriteDashboardAttempts(root), samples = attempts.filter(sample => sample.selected);
  const href = (path: string) => relative(writeDashboardLinkRoot(root), path).split("\\").join("/");
  const keys = [...new Set(samples.map(row => row.providerKey))].sort();
  const makeGroup = (key: string, label: string, cases: readonly string[]): DashboardGroup => {
    const providers: DashboardProviderRow[] = keys.map(providerKey => {
      const rows = samples.filter(row => row.providerKey === providerKey && cases.includes(row.caseKey));
      const passed = rows.filter(row => row.status === "succeeded");
      const complete = rows.length === cases.length && passed.length === cases.length;
      const seconds = complete ? average(rows.map(row => row.processingMs === null ? null : row.processingMs / 1000)) : null;
      const costDollars = complete ? average(rows.map(row => row.costDollars)) : null;
      const proxy = complete ? average(rows.map(row => row.outputPricePerMillion)) : null;
      const outputTokens = average(rows.map(row => row.outputTokens));
      const status = complete ? "passed" : rows.length ? [...new Set(rows.filter(row => row.status !== "succeeded").map(row => row.status)), ...(rows.length < cases.length ? ["missing cases"] : [])].join(", ") : "missing";
      return {
        providerKey, display: providerKey, model: providerKey.slice(providerKey.indexOf("/") + 1), coverage: `${passed.length}/${cases.length}`,
        quality: { display: proxy === null ? "n/a" : `$${proxy.toFixed(2)}`, rank: null, value: proxy },
        speed: { display: seconds === null ? "n/a" : `${seconds.toFixed(3)}s`, rank: null, value: seconds },
        cost: { display: money(costDollars), rank: null, value: costDollars },
        evidence: [status, outputTokens === null ? "n/a" : outputTokens.toFixed(cases.length > 1 ? 1 : 0),
          money(rows.length && rows.every(row => row.costDollars !== null) ? rows.reduce((sum, row) => sum + row.costDollars!, 0) : null)],
        perRun: [],
      };
    });
    rankProviders(providers);
    return { key, label, metricColumns: { quality: "Price proxy ($ / 1M output tokens)", speed: "Seconds / request", cost: "$ / request" },
      metricDirections: { quality: "higher", speed: "lower", cost: "lower" },
      metricSortLabels: { quality: "Price proxy", speed: "Speed", cost: "Cost" },
      evidenceColumns: ["Status", "Mean output tokens", "Usage-based cost"], showPerRun: false, providers };
  };
  const groups = [
    makeGroup("all-five", "All five prompts — Service models", WRITE_BENCHMARK_CASES.map(benchmark => benchmark.key)),
    ...WRITE_BENCHMARK_CASES.map(benchmark => makeGroup(benchmark.key, `${benchmark.label} — Service models`, [benchmark.key])),
  ];
  const attempted = attempts.filter(row => !["missing", "pending", "not-started", "skipped"].includes(row.status));
  const firstPass = attempted.filter(row => row.attempt === "01"), rerunAttempts = attempted.filter(row => row.attempt !== "01");
  const totalRecorded = attempts.filter(row => row.costDollars !== null).reduce((sum, row) => sum + row.costDollars!, 0);
  const unknownAttemptedCosts = attempted.filter(row => row.costDollars === null).length;
  const dashboardModel: CombinedDashboardModel = {
    title: "Write benchmark results", category: "text", generatedAt, rootDir: toProjectRelativePath(root),
    summaryStats: [
      { label: "Prompt cases", value: String(WRITE_BENCHMARK_CASES.length) }, { label: "Model / provider routes", value: String(keys.length) },
      { label: "Valid outputs", value: `${samples.filter(row => row.status === "succeeded").length}/${keys.length * WRITE_BENCHMARK_CASES.length}` },
      { label: "First-pass attempts / valid", value: `${firstPass.length} / ${firstPass.filter(row => row.status === "succeeded").length}` },
      { label: "Rerun attempts / valid", value: `${rerunAttempts.length} / ${rerunAttempts.filter(row => row.status === "succeeded").length}` },
      { label: "Usage-based cost", value: money(totalRecorded) },
      { label: "Attempted slots with unknown cost", value: String(unknownAttemptedCosts) },
    ],
    runs: WRITE_BENCHMARK_CASES.map((benchmark, index) => ({
      runName: benchmark.directory, shortLabel: `W${index + 1}`, detail: `${benchmark.label} (${benchmark.prompt})`,
      inventory: {
        manifest: existsSync(join(root, benchmark.directory, "manifest.json"))
          ? { display: "Manifest", artifactHref: href(join(root, benchmark.directory, "manifest.json")) } : { display: "Not run" },
        report: existsSync(join(root, benchmark.directory, "provider-comparison-report.md"))
          ? { display: "Results", artifactHref: href(join(root, benchmark.directory, "provider-comparison-report.md")) } : { display: "Pending" },
      },
    })),
    runInventoryColumns: [{ key: "manifest", label: "Evidence" }, { key: "report", label: "Report" }], groups,
    methodParagraphs: [
      "Each model/provider route receives the same fixed input and preset within a prompt case. Comparisons select the latest completed attempt for each prompt/model pair, including a latest failure; earlier attempts remain in request evidence. The all-five table gives each prompt equal weight, averaging seconds/request and dollars/request only for routes with five valid outputs. A passing request requires explicitly recorded schema validation, a nonempty structured object without a failure envelope, and the saved output hash when a slot receipt exists. Missing, failed, corrupt, or schema-failed outputs remain visible without passing ranks.",
      "Speed is metadata.step3.processingTime in wall-clock seconds/request, with lower values better. It includes generation and provider latency; it is not time to first token or a normalized token throughput score.",
      "Usage-based cost is recorded token usage multiplied by uncached catalog tariffs, in USD/request (metadata.cost.actual.steps cents divided by 100). Cache discounts and Argon introductory pricing are excluded. Provider-usage and heuristic cost sources remain visible in the request evidence. Summary cost and unknown-billing counts are cumulative across all attempts, including superseded failed and invalid requests; ranking costs use only selected requests. Attempted slots with unknown cost are counted separately from unattempted missing routes. These calculations do not establish provider invoices or charged spend.",
      "At the user's request, higher listed output-token price is a temporary quality proxy. The Price proxy ($ / 1M output tokens) column uses benchmark-plan.json's fixed rate snapshot, falling back to the run's estimated-cost rate snapshot when no plan rate exists. It is not measured text quality, an automated judge score, or a human assessment. Schema validity only determines whether a request is eligible for comparison.",
    ],
    notes: [
      "One selected request per model per prompt. These are single-run measurements; targeted failure reruns do not establish latency variability or medians.",
      "The earlier September Write benchmark is preserved in its original directory and excluded from the five-prompt aggregate.",
      "Request cost and output-token list price answer different questions: the price proxy is a model rate; dollars/request also depends on input length, generated output, reasoning usage, and caching.",
    ],
    sampleTables: [{ title: "Request evidence — all attempts", providerKeyColumn: 1, columns: ["Prompt", "Model / provider", "Attempt", "Selected", "Status", "Seconds / request", "$ / request", "Input tokens", "Output tokens", "Schema", "Cost basis", "Output", "Manifest"],
      rows: attempts.map(row => [
        { display: WRITE_BENCHMARK_CASES.find(benchmark => benchmark.key === row.caseKey)!.label }, { display: row.providerKey },
        { display: row.attempt }, { display: row.selected ? "yes" : "no" },
        { display: row.status }, { display: row.processingMs === null ? "n/a" : `${(row.processingMs / 1000).toFixed(3)}s` },
        { display: money(row.costDollars) }, { display: row.inputTokens === null ? "n/a" : String(row.inputTokens) },
        { display: row.outputTokens === null ? "n/a" : String(row.outputTokens) }, { display: row.schema }, { display: row.costBasis },
        row.outputHref ? { display: "Output", artifactHref: row.outputHref } : { display: "n/a" },
        row.manifestHref ? { display: "Manifest", artifactHref: row.manifestHref } : { display: "Not run" },
      ]),
    }],
  };
  return { dashboardModel, samples, attempts };
}
