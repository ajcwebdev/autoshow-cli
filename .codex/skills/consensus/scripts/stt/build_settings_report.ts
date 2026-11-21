#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { writePortableFileSync } from "../shared/portable_paths";
import type {
  CombinedDashboardModel,
  DashboardGroup,
  DashboardProviderRow,
  DashboardRunInventoryCell,
} from "../shared/combined_report_html";
import { buildReport } from "./build_reference_report";
import {
  RUN_VARIANT_FILE,
  SCORING_VERSION,
  resolveReferenceTranscript,
  type ErrorAttribution,
  type ReferenceSourceRecord,
} from "./transcript_lib";

/**
 * STT settings-variant comparison. Each `<variant-id>__<recording-id>/` run under the settings root is paired with
 * the same service/model at default settings from `<baseline-root>/<recording-id>/` (default: the sibling
 * `with-speakers` root). Both rows are scored now, with the current scoring code, against the variant's verified
 * `reference-source.json` reference, so a delta never mixes scoring versions or references.
 */

export const SETTINGS_REPORT_BASENAME = "settings-comparison-report";
export const SETTINGS_REPORT_JSON = `${SETTINGS_REPORT_BASENAME}.json`;
export const SETTINGS_REPORT_MARKDOWN = `${SETTINGS_REPORT_BASENAME}.md`;
export const SETTINGS_REPORT_SCHEMA_VERSION = 1;
const PLAN_FILE = "benchmark-plan.json";
const RUN_SEPARATOR = "__";

interface Baseline {
  service: string;
  model: string;
}

interface VariantRecord {
  variantId: string;
  label: string;
  baseline: Baseline;
  flags: string[];
}

interface PlanVariant {
  id: string;
  label?: string;
  baseline: Baseline;
  provider?: string;
  settings?: string[];
  speakerCountFromReference?: boolean;
  note?: string;
}

interface Plan {
  recordings?: Array<{ id: string }>;
  variants?: PlanVariant[];
  skips?: Array<{ variantId: string; recordingId: string; reason: string }>;
}

export interface ScoredRow {
  providerKey: string;
  score: number | null;
  legacyScore: number | null;
  speakerAwareWER: number | null;
  textOnlyWER: number | null;
  legacySpeakerAwareWER: number | null;
  errorAttribution: ErrorAttribution | null;
  speakerCountAbsoluteError: number | null;
  wordAttributionAccuracy: number | null;
  providerSpeakerCount: number | null;
  referenceSpeakerCount: number | null;
  costCents: number | null;
  processingTimeMs: number | null;
}

export const DELTA_FIELDS = [
  "score",
  "legacyScore",
  "speakerAwareWER",
  "textOnlyWER",
  "strictEdits",
  "neutralEdits",
  "forgivenDisfluency",
  "forgivenOrthographic",
  "forgivenNumberFormat",
  "remainingSpeakerAttribution",
  "remainingNumberFormat",
  "remainingOtherLexical",
  "speakerCountAbsoluteError",
  "wordAttributionAccuracy",
  "costCents",
  "processingTimeMs",
] as const;
export type DeltaField = (typeof DELTA_FIELDS)[number];
export type Delta = Record<DeltaField, number | null>;

export type PairStatus = "paired" | "skipped" | "not-run" | "variant-failed" | "baseline-missing";

export interface RecordingPair {
  recordingId: string;
  status: PairStatus;
  reason: string | null;
  variantDir: string | null;
  baselineDir: string | null;
  variantProviderKey: string | null;
  referenceSource: ReferenceSourceRecord | null;
  variant: ScoredRow | null;
  baseline: ScoredRow | null;
  delta: Delta | null;
}

export interface SettingGroup {
  key: string;
  label: string;
}

export interface VariantSummary {
  variantId: string;
  label: string;
  baseline: Baseline;
  baselineProviderKey: string;
  group: SettingGroup;
  flags: string[];
  pairs: RecordingPair[];
  pairedRecordings: string[];
  unpairedRecordings: Array<{ recordingId: string; status: PairStatus; reason: string | null }>;
  /** Mean delta over every recording this variant pairs. */
  meanDelta: Delta | null;
  /** Mean delta over the report's common recording set; null when the variant misses one of them. */
  commonSetMeanDelta: Delta | null;
}

export interface SettingsReport {
  schemaVersion: typeof SETTINGS_REPORT_SCHEMA_VERSION;
  kind: "stt-settings-comparison-report";
  category: "stt";
  scoringVersion: number;
  generatedAt: string;
  settingsRoot: string;
  baselineRoot: string;
  recordings: string[];
  /** Recordings paired by every variant with at least one paired recording; headline means use this set. */
  commonRecordings: string[];
  headlineBasis: "common-recording-set" | "per-variant-covered-recordings";
  variantCount: number;
  pairedRunCount: number;
  unpairedRunCount: number;
  variants: VariantSummary[];
  notes: string[];
}

const KNOWN_SETTING_GROUPS: Record<string, SettingGroup> = {
  "--stt-audio-profile": { key: "audio-profile", label: "Audio profile" },
  "--speaker-count": { key: "speaker-count", label: "Speaker count" },
  "--stt-filler-words": { key: "transcript-formatting", label: "Transcript formatting" },
  "--stt-number-format": { key: "transcript-formatting", label: "Transcript formatting" },
  "--stt-verbatim": { key: "transcript-formatting", label: "Transcript formatting" },
};
const CONTROL_GROUP: SettingGroup = { key: "run-to-run-control", label: "Run-to-run control (default settings)" };
const GROUP_ORDER = ["transcript-formatting", "speaker-count", "audio-profile", "run-to-run-control"];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteOrNull(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function readJson<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readVariantRecord(runDir: string): VariantRecord {
  const path = join(runDir, RUN_VARIANT_FILE);
  const parsed = readJson<Record<string, unknown>>(path);
  const baseline = parsed["baseline"] as Record<string, unknown> | undefined;
  if (typeof parsed["variantId"] !== "string" || typeof parsed["label"] !== "string"
    || typeof baseline?.["service"] !== "string" || typeof baseline?.["model"] !== "string") {
    throw new Error(`${path} must contain string variantId, label, baseline.service, and baseline.model fields`);
  }
  const flags = Array.isArray(parsed["flags"]) ? parsed["flags"].filter((flag): flag is string => typeof flag === "string") : [];
  return {
    variantId: parsed["variantId"],
    label: parsed["label"],
    baseline: { service: baseline["service"], model: baseline["model"] },
    flags,
  };
}

/** Setting flags of a variant: everything except the provider selection and the shared `--diarization`. */
export function settingFlags(flags: readonly string[]): string[] {
  const output: string[] = [];
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index]!;
    if (flag === "--provider") {
      index += 1;
      continue;
    }
    if (flag === "--diarization") continue;
    output.push(flag);
  }
  return output;
}

export function settingGroupForFlags(flags: readonly string[]): SettingGroup {
  const first = settingFlags(flags).find((flag) => flag.startsWith("--"));
  if (!first) return CONTROL_GROUP;
  return KNOWN_SETTING_GROUPS[first] ?? { key: first.replace(/^-+/, ""), label: first };
}

function planFlags(variant: PlanVariant): string[] {
  return [
    ...(variant.provider ? ["--provider", variant.provider] : []),
    "--diarization",
    ...(variant.settings ?? []),
    ...(variant.speakerCountFromReference ? ["--speaker-count", "<reference>"] : []),
  ];
}

/** Compresses per-recording labels that share one key ("speaker-count=2", "speaker-count=13") into "speaker-count=2|13". */
export function combinedVariantLabel(labels: readonly string[]): string {
  const unique = [...new Set(labels.filter(Boolean))];
  if (unique.length <= 1) return unique[0] ?? "";
  const pairs = unique.map((label) => /^([^=,]+)=([^,]*)$/.exec(label));
  if (pairs.every((match) => match !== null && match[1] === pairs[0]![1])) {
    return `${pairs[0]![1]}=${pairs.map((match) => match![2]).join("|")}`;
  }
  return unique.join("; ");
}

function scoredRow(runDir: string, referencePath: string, providerKey: string): ScoredRow | null {
  let reportJson: { providerGroups?: Record<string, { providers?: Array<Record<string, any>> }> };
  try {
    reportJson = buildReport(runDir, referencePath, [], null, { providerKeys: new Set([providerKey]) }).reportJson as typeof reportJson;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No succeeded provider matching")) return null;
    throw error;
  }
  const row = Object.values(reportJson.providerGroups ?? {}).flatMap((group) => group.providers ?? [])
    .find((provider) => provider["providerKey"] === providerKey);
  if (!row) return null;
  const metrics = (row["metrics"] ?? {}) as Record<string, unknown>;
  const speaker = (row["speakerMetrics"] ?? {}) as Record<string, unknown>;
  return {
    providerKey,
    score: finiteOrNull(metrics["score"]),
    legacyScore: finiteOrNull(metrics["legacyScore"]),
    speakerAwareWER: finiteOrNull(metrics["speakerAwareWER"]),
    textOnlyWER: finiteOrNull(metrics["textOnlyWER"]),
    legacySpeakerAwareWER: finiteOrNull(metrics["legacySpeakerAwareWER"]),
    errorAttribution: (row["errorAttribution"] as ErrorAttribution | undefined) ?? null,
    speakerCountAbsoluteError: finiteOrNull(speaker["speakerCountAbsoluteError"]),
    wordAttributionAccuracy: finiteOrNull(speaker["wordAttributionAccuracy"]),
    providerSpeakerCount: finiteOrNull(speaker["providerSpeakerCount"]),
    referenceSpeakerCount: finiteOrNull(speaker["referenceSpeakerCount"]),
    costCents: finiteOrNull(row["actualCostCents"]),
    processingTimeMs: finiteOrNull(row["actualProcessingTimeMs"]),
  };
}

function deltaValues(row: ScoredRow): Record<DeltaField, number | null> {
  const attribution = row.errorAttribution;
  return {
    score: row.score,
    legacyScore: row.legacyScore,
    speakerAwareWER: row.speakerAwareWER,
    textOnlyWER: row.textOnlyWER,
    strictEdits: finiteOrNull(attribution?.strictEdits),
    neutralEdits: finiteOrNull(attribution?.neutralEdits),
    forgivenDisfluency: finiteOrNull(attribution?.forgivenByView.disfluency),
    forgivenOrthographic: finiteOrNull(attribution?.forgivenByView.orthographic),
    forgivenNumberFormat: finiteOrNull(attribution?.forgivenByView.numberFormat),
    remainingSpeakerAttribution: finiteOrNull(attribution?.remaining.speakerAttribution),
    remainingNumberFormat: finiteOrNull(attribution?.remaining.numberFormat),
    remainingOtherLexical: finiteOrNull(attribution?.remaining.otherLexical),
    speakerCountAbsoluteError: row.speakerCountAbsoluteError,
    wordAttributionAccuracy: row.wordAttributionAccuracy,
    costCents: row.costCents,
    processingTimeMs: row.processingTimeMs,
  };
}

export function rowDelta(variant: ScoredRow, baseline: ScoredRow): Delta {
  const left = deltaValues(variant);
  const right = deltaValues(baseline);
  const delta = {} as Delta;
  for (const field of DELTA_FIELDS) {
    const a = left[field];
    const b = right[field];
    delta[field] = a === null || b === null ? null : a - b;
  }
  return delta;
}

export function meanDelta(deltas: readonly Delta[]): Delta | null {
  if (deltas.length === 0) return null;
  const output = {} as Delta;
  for (const field of DELTA_FIELDS) {
    const values = deltas.map((delta) => delta[field]).filter(isFiniteNumber);
    output[field] = values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return output;
}

interface DiscoveredRun {
  dirName: string;
  runDir: string;
  record: VariantRecord;
  recordingId: string;
}

function discoverVariantRuns(settingsRoot: string): DiscoveredRun[] {
  const runs: DiscoveredRun[] = [];
  for (const entry of readdirSync(settingsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runDir = join(settingsRoot, entry.name);
    if (!existsSync(join(runDir, RUN_VARIANT_FILE))) continue;
    const record = readVariantRecord(runDir);
    const prefix = `${record.variantId}${RUN_SEPARATOR}`;
    if (!entry.name.startsWith(prefix) || entry.name.length === prefix.length) {
      throw new Error(`${runDir} must be named <variantId>${RUN_SEPARATOR}<recordingId> for variantId ${record.variantId}`);
    }
    runs.push({ dirName: entry.name, runDir, record, recordingId: entry.name.slice(prefix.length) });
  }
  return runs.sort((left, right) => left.dirName.localeCompare(right.dirName));
}

export interface SettingsReportOptions {
  baselineRoot?: string;
  generatedAt?: string;
  /** Progress callback for long scoring passes. */
  onProgress?: (message: string) => void;
}

export function defaultBaselineRoot(settingsRoot: string): string {
  return resolve(settingsRoot, "..", "with-speakers");
}

export function buildSttSettingsReport(settingsRootRaw: string, options: SettingsReportOptions = {}): SettingsReport {
  const settingsRoot = resolve(settingsRootRaw);
  const baselineRoot = resolve(options.baselineRoot ?? defaultBaselineRoot(settingsRoot));
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const planPath = join(settingsRoot, PLAN_FILE);
  const plan: Plan = existsSync(planPath) ? readJson<Plan>(planPath) : {};
  const runs = discoverVariantRuns(settingsRoot);
  const planVariants = plan.variants ?? [];
  if (runs.length === 0 && planVariants.length === 0) {
    throw new Error(`No <variant>${RUN_SEPARATOR}<recording>/${RUN_VARIANT_FILE} runs or ${PLAN_FILE} variants found under ${settingsRoot}`);
  }

  const recordings = [...new Set([...(plan.recordings ?? []).map((recording) => recording.id), ...runs.map((run) => run.recordingId)])];
  const skips = new Map((plan.skips ?? []).map((skip) => [`${skip.variantId}${RUN_SEPARATOR}${skip.recordingId}`, skip.reason]));
  const variantIds = [...new Set([...planVariants.map((variant) => variant.id), ...runs.map((run) => run.record.variantId)])];
  const baselineCache = new Map<string, ScoredRow | null>();

  const variants: VariantSummary[] = variantIds.map((variantId) => {
    const variantRuns = runs.filter((run) => run.record.variantId === variantId);
    const planVariant = planVariants.find((variant) => variant.id === variantId);
    const first = variantRuns[0]?.record;
    const baseline = first?.baseline ?? planVariant!.baseline;
    const flags = first?.flags ?? (planVariant ? planFlags(planVariant) : []);
    for (const run of variantRuns) {
      if (run.record.baseline.service !== baseline.service || run.record.baseline.model !== baseline.model) {
        throw new Error(`${run.runDir}/${RUN_VARIANT_FILE} baseline differs from other ${variantId} runs`);
      }
    }
    const baselineProviderKey = `${baseline.service}/${baseline.model}`;
    const pairs: RecordingPair[] = recordings.map((recordingId) => {
      const run = variantRuns.find((candidate) => candidate.recordingId === recordingId);
      const empty = { variantDir: null, baselineDir: null, variantProviderKey: null, referenceSource: null, variant: null, baseline: null, delta: null };
      if (!run) {
        const skipReason = skips.get(`${variantId}${RUN_SEPARATOR}${recordingId}`);
        return skipReason !== undefined
          ? { recordingId, status: "skipped", reason: skipReason, ...empty }
          : { recordingId, status: "not-run", reason: planVariant ? "Planned; no run directory (not yet run or blocked)." : "No run directory.", ...empty };
      }
      const { referencePath, referenceSource } = resolveReferenceTranscript(run.runDir, null);
      const label = run.record.label.trim();
      const variantProviderKey = label ? `${baselineProviderKey}[${label}]` : baselineProviderKey;
      options.onProgress?.(`Scoring ${run.dirName}`);
      const variantRow = scoredRow(run.runDir, referencePath, variantProviderKey);
      const baselineDir = join(baselineRoot, recordingId);
      const base = { variantDir: run.runDir, baselineDir, variantProviderKey, referenceSource };
      if (!variantRow) {
        return { recordingId, status: "variant-failed", reason: `No succeeded ${variantProviderKey} result in the variant run.`, ...base, variant: null, baseline: null, delta: null };
      }
      const cacheKey = `${baselineDir}\u0000${baselineProviderKey}\u0000${referencePath}`;
      if (!baselineCache.has(cacheKey)) {
        let baselineRow: ScoredRow | null = null;
        if (existsSync(join(baselineDir, "manifest.json"))) {
          options.onProgress?.(`Scoring baseline ${baselineProviderKey} in ${recordingId}`);
          baselineRow = scoredRow(baselineDir, referencePath, baselineProviderKey);
        }
        baselineCache.set(cacheKey, baselineRow);
      }
      const baselineRow = baselineCache.get(cacheKey) ?? null;
      if (!baselineRow) {
        return { recordingId, status: "baseline-missing", reason: `No succeeded default-settings ${baselineProviderKey} result in ${recordingId} under the baseline root.`, ...base, variant: variantRow, baseline: null, delta: null };
      }
      return { recordingId, status: "paired", reason: null, ...base, variant: variantRow, baseline: baselineRow, delta: rowDelta(variantRow, baselineRow) };
    });
    const paired = pairs.filter((pair) => pair.status === "paired");
    const labels = variantRuns.map((run) => run.record.label);
    return {
      variantId,
      label: combinedVariantLabel(labels.length > 0 ? labels : [planVariant?.label ?? settingFlags(flags).join(" ")]),
      baseline,
      baselineProviderKey,
      group: settingGroupForFlags(flags),
      flags,
      pairs,
      pairedRecordings: paired.map((pair) => pair.recordingId),
      unpairedRecordings: pairs.filter((pair) => pair.status !== "paired").map((pair) => ({ recordingId: pair.recordingId, status: pair.status, reason: pair.reason })),
      meanDelta: meanDelta(paired.map((pair) => pair.delta!)),
      commonSetMeanDelta: null,
    };
  });

  const covering = variants.filter((variant) => variant.pairedRecordings.length > 0);
  const commonRecordings = recordings.filter((recordingId) => covering.length > 0 && covering.every((variant) => variant.pairedRecordings.includes(recordingId)));
  for (const variant of variants) {
    if (commonRecordings.length === 0 || !commonRecordings.every((recordingId) => variant.pairedRecordings.includes(recordingId))) continue;
    variant.commonSetMeanDelta = meanDelta(variant.pairs.filter((pair) => commonRecordings.includes(pair.recordingId)).map((pair) => pair.delta!));
  }
  variants.sort((left, right) => groupRank(left.group) - groupRank(right.group)
    || left.group.label.localeCompare(right.group.label)
    || left.variantId.localeCompare(right.variantId));

  const pairedRunCount = variants.reduce((sum, variant) => sum + variant.pairedRecordings.length, 0);
  const unpairedRunCount = variants.reduce((sum, variant) => sum + variant.unpairedRecordings.length, 0);
  const headlineBasis = commonRecordings.length > 0 ? "common-recording-set" : "per-variant-covered-recordings";
  const incomplete = variants.filter((variant) => variant.unpairedRecordings.length > 0).map((variant) => variant.variantId);
  return {
    schemaVersion: SETTINGS_REPORT_SCHEMA_VERSION,
    kind: "stt-settings-comparison-report",
    category: "stt",
    scoringVersion: SCORING_VERSION,
    generatedAt,
    settingsRoot,
    baselineRoot,
    recordings,
    commonRecordings,
    headlineBasis,
    variantCount: variants.length,
    pairedRunCount,
    unpairedRunCount,
    variants,
    notes: [
      "Every delta is variant minus its default-settings baseline (same service/model) on the same recording, both scored now with the current scoring code against the variant's verified reference-source.json reference.",
      headlineBasis === "common-recording-set"
        ? `Headline means use the common recording set paired by every variant with at least one paired recording (${commonRecordings.join(", ")}); the "all covered" score mean uses every recording a variant pairs.`
        : "No recording is paired by every variant, so headline means use each variant's own paired recordings; compare variants with different coverage with care.",
      ...(incomplete.length > 0 ? [`Variants with unpaired recordings (skipped, not run, failed, or missing a baseline) are listed under Coverage and never averaged silently: ${incomplete.join(", ")}.`] : []),
      "Positive score, legacy-score, and word-attribution deltas favor the variant; positive WER, edit-count, speaker-count-error, cost, and time deltas favor the baseline. Forgiven-by-view edit deltas show how much more (positive) form variation the variant produced that the neutral view forgave.",
      "The baseline rows come from the with-speakers archive and were recorded on an earlier date, so deltas also include any provider-side model drift; the run-to-run control variant estimates that noise for one route.",
    ],
  };
}

function groupRank(group: SettingGroup): number {
  const index = GROUP_ORDER.indexOf(group.key);
  return index === -1 ? GROUP_ORDER.length : index;
}

function signed(value: number | null, digits: number, suffix = ""): string {
  if (value === null) return "n/a";
  const fixed = value.toFixed(digits);
  const zero = Number(fixed) === 0;
  return `${!zero && value > 0 ? "+" : ""}${zero ? (0).toFixed(digits) : fixed}${suffix}`;
}

function signedPoints(value: number | null): string {
  return value === null ? "n/a" : signed(value * 100, 2, " pp");
}

function signedCost(value: number | null): string {
  return signed(value, 3, "¢");
}

function signedSeconds(value: number | null): string {
  return value === null ? "n/a" : signed(value / 1000, 2, "s");
}

function plain(value: number | null, digits: number): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

const STATUS_LABELS: Record<PairStatus, string> = {
  paired: "paired",
  skipped: "skipped",
  "not-run": "not run",
  "variant-failed": "variant failed",
  "baseline-missing": "baseline missing",
};

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

/** Renders a Markdown table with pipes aligned to each column's widest cell. */
export function alignedTable(headers: string[], alignments: Array<"left" | "right">, rows: string[][]): string {
  const cells = [headers, ...rows].map((row) => row.map(escapeCell));
  const widths = headers.map((_, column) => Math.max(3, ...cells.map((row) => [...(row[column] ?? "")].length)));
  const pad = (value: string, column: number) => {
    const fill = " ".repeat(widths[column]! - [...value].length);
    return alignments[column] === "right" ? `${fill}${value}` : `${value}${fill}`;
  };
  const line = (row: string[]) => `| ${row.map((value, column) => pad(value, column)).join(" | ")} |`;
  const divider = `| ${widths.map((width, column) => (alignments[column] === "right" ? `${"-".repeat(width - 1)}:` : "-".repeat(width))).join(" | ")} |`;
  return [line(cells[0]!), divider, ...cells.slice(1).map(line)].join("\n");
}

function headline(variant: VariantSummary, report: SettingsReport): Delta | null {
  return report.headlineBasis === "common-recording-set" ? variant.commonSetMeanDelta : variant.meanDelta;
}

/** "3/4 (1 skipped)": paired over planned recordings plus unpaired counts by status; the Coverage table names them. */
function coverageLabel(variant: VariantSummary, report: SettingsReport): string {
  const counts = new Map<PairStatus, number>();
  for (const entry of variant.unpairedRecordings) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  const missing = [...counts].map(([status, count]) => `${count} ${STATUS_LABELS[status]}`);
  return `${variant.pairedRecordings.length}/${report.recordings.length}${missing.length > 0 ? ` (${missing.join(", ")})` : ""}`;
}

export function renderSettingsMarkdown(report: SettingsReport): string {
  const md: string[] = [];
  const basisText = report.headlineBasis === "common-recording-set"
    ? `common recording set: ${report.commonRecordings.map((id) => `\`${id}\``).join(", ")}`
    : "each variant's paired recordings (no recording is shared by every variant)";
  md.push("# STT Settings Comparison Report", "");
  md.push("## Summary", "");
  md.push(`- Settings root: \`${report.settingsRoot}\``);
  md.push(`- Baseline root: \`${report.baselineRoot}\``);
  md.push(`- Scoring version: ${report.scoringVersion}`);
  md.push(`- Recordings: ${report.recordings.map((id) => `\`${id}\``).join(", ")}`);
  md.push(`- Variants: ${report.variantCount}; paired runs: ${report.pairedRunCount}; unpaired variant × recording slots: ${report.unpairedRunCount}`);
  md.push(`- Headline means use the ${basisText}.`, "");
  md.push("## Method", "");
  md.push("- Each `<variant-id>__<recording-id>/` run is paired with the same service/model at default settings in `<baseline-root>/<recording-id>/providers/<service-model>/result.json`.");
  md.push("- Both rows are scored by this command with the current scoring code against the variant's `reference-source.json` reference (path and SHA-256 verified), so deltas never mix scoring versions or references.");
  md.push("- Δ is variant minus baseline. Score and legacy score are /100; WER and word attribution are percentage points; edit counts are speaker-aware edits per recording; cost (¢) and time come from each run's manifest.");
  md.push("- Edit columns: strict and neutral edits, edits forgiven by the disfluency, orthographic, and number views, and the remaining edits attributed to speakers, number format, and other lexical errors.");
  md.push("- Variants missing a recording are never averaged over fewer recordings silently: the headline uses the common recording set, and the Coverage table names each unpaired slot and its reason.", "");

  md.push("## Variant Summary", "");
  md.push(`Mean Δ per recording over the ${basisText}. "Score (all)" averages every recording the variant pairs.`, "");
  const summaryRows = report.variants.map((variant) => {
    const delta = headline(variant, report);
    return [
      variant.group.label,
      variant.variantId,
      variant.label,
      variant.baselineProviderKey,
      coverageLabel(variant, report),
      signed(delta?.score ?? null, 2),
      signed(variant.meanDelta?.score ?? null, 2),
      signed(delta?.legacyScore ?? null, 2),
      signedPoints(delta?.speakerAwareWER ?? null),
      signedPoints(delta?.textOnlyWER ?? null),
      signed(delta?.forgivenDisfluency ?? null, 1),
      signed(delta?.speakerCountAbsoluteError ?? null, 2),
      signedPoints(delta?.wordAttributionAccuracy ?? null),
      signedCost(delta?.costCents ?? null),
      signedSeconds(delta?.processingTimeMs ?? null),
    ];
  });
  md.push(alignedTable(
    ["Group", "Variant", "Label", "Baseline", "Recordings", "Δ Score", "Δ Score (all)", "Δ Legacy", "Δ SA-WER", "Δ Text WER", "Δ Disfluency Edits", "Δ Speaker-count Error", "Δ Word Attribution", "Δ Cost", "Δ Time"],
    ["left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right"],
    summaryRows,
  ), "");

  md.push("## Error Attribution Deltas", "");
  md.push(`Mean Δ speaker-aware edit counts per recording over the ${basisText}.`, "");
  md.push(alignedTable(
    ["Variant", "Δ Strict", "Δ Disfluency", "Δ Orthographic", "Δ Number", "Δ Neutral", "Δ Speaker Attribution", "Δ Residual Number", "Δ Other Lexical"],
    ["left", "right", "right", "right", "right", "right", "right", "right", "right"],
    report.variants.map((variant) => {
      const delta = headline(variant, report);
      return [
        variant.variantId,
        signed(delta?.strictEdits ?? null, 1),
        signed(delta?.forgivenDisfluency ?? null, 1),
        signed(delta?.forgivenOrthographic ?? null, 1),
        signed(delta?.forgivenNumberFormat ?? null, 1),
        signed(delta?.neutralEdits ?? null, 1),
        signed(delta?.remainingSpeakerAttribution ?? null, 1),
        signed(delta?.remainingNumberFormat ?? null, 1),
        signed(delta?.remainingOtherLexical ?? null, 1),
      ];
    }),
  ), "");

  md.push("## Coverage", "");
  md.push(alignedTable(
    ["Variant", ...report.recordings],
    ["left", ...report.recordings.map(() => "left" as const)],
    report.variants.map((variant) => [variant.variantId, ...variant.pairs.map((pair) => STATUS_LABELS[pair.status])]),
  ), "");
  const unpaired = report.variants.flatMap((variant) => variant.unpairedRecordings.map((entry) => [variant.variantId, entry.recordingId, STATUS_LABELS[entry.status], entry.reason ?? ""]));
  if (unpaired.length > 0) {
    md.push(alignedTable(["Variant", "Recording", "Status", "Reason"], ["left", "left", "left", "left"], unpaired), "");
  }

  md.push("## Per-Recording Detail", "");
  for (const variant of report.variants) {
    const paired = variant.pairs.filter((pair) => pair.status === "paired");
    if (paired.length === 0) continue;
    md.push(`### ${variant.variantId}`, "");
    md.push(alignedTable(
      ["Recording", "Variant Key", "Baseline Score", "Variant Score", "Δ Score", "Δ Legacy", "Δ SA-WER", "Δ Text WER", "Δ Disfluency", "Δ Neutral Edits", "Speakers (base → variant / ref)", "Δ Word Attribution", "Δ Cost", "Δ Time"],
      ["left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right", "right"],
      paired.map((pair) => [
        pair.recordingId,
        pair.variantProviderKey ?? "",
        plain(pair.baseline!.score, 2),
        plain(pair.variant!.score, 2),
        signed(pair.delta!.score, 2),
        signed(pair.delta!.legacyScore, 2),
        signedPoints(pair.delta!.speakerAwareWER),
        signedPoints(pair.delta!.textOnlyWER),
        signed(pair.delta!.forgivenDisfluency, 0),
        signed(pair.delta!.neutralEdits, 0),
        `${pair.baseline!.providerSpeakerCount ?? "n/a"} → ${pair.variant!.providerSpeakerCount ?? "n/a"} / ${pair.variant!.referenceSpeakerCount ?? "n/a"}`,
        signedPoints(pair.delta!.wordAttributionAccuracy),
        signedCost(pair.delta!.costCents),
        signedSeconds(pair.delta!.processingTimeMs),
      ]),
    ), "");
  }

  md.push("## Notes", "");
  for (const note of report.notes) md.push(`- ${note}`);
  md.push("");
  return md.join("\n");
}

function rankBy(rows: DashboardProviderRow[], metric: "quality" | "speed" | "cost", direction: "higher" | "lower"): void {
  const ranked = rows.filter((row) => isFiniteNumber(row[metric].value))
    .sort((left, right) => (direction === "higher" ? right[metric].value! - left[metric].value! : left[metric].value! - right[metric].value!)
      || left.providerKey.localeCompare(right.providerKey));
  ranked.forEach((row, index) => {
    row[metric].rank = index + 1;
  });
}

/** Dashboard row identity: the base route plus the variant id, so the CLI-supported filter follows the base `service/model`. */
export function settingsDashboardProviderKey(variant: Pick<VariantSummary, "baselineProviderKey" | "variantId">): string {
  return `${variant.baselineProviderKey}[${variant.variantId}]`;
}

export function settingsDashboardModel(report: SettingsReport, rootDir = report.settingsRoot): CombinedDashboardModel {
  const groupKeys = [...new Map(report.variants.map((variant) => [variant.group.key, variant.group])).values()];
  const basis = report.headlineBasis === "common-recording-set" ? `common set (${report.commonRecordings.length})` : "covered recordings";
  const groups: DashboardGroup[] = groupKeys.map((group) => {
    const variants = report.variants.filter((variant) => variant.group.key === group.key && variant.pairedRecordings.length > 0);
    const heatValues = variants.flatMap((variant) => variant.pairs.map((pair) => pair.delta?.score ?? null)).filter(isFiniteNumber);
    const heatMin = heatValues.length > 0 ? Math.min(...heatValues) : 0;
    const heatMax = heatValues.length > 0 ? Math.max(...heatValues) : 0;
    const providers: DashboardProviderRow[] = variants.map((variant) => {
      const delta = headline(variant, report);
      return {
        providerKey: settingsDashboardProviderKey(variant),
        display: `${variant.variantId} [${variant.label}]`,
        model: variant.baseline.model,
        coverage: coverageLabel(variant, report),
        quality: { display: signed(delta?.score ?? null, 2), rank: null, value: delta?.score ?? null },
        speed: { display: signedSeconds(delta?.processingTimeMs ?? null), rank: null, value: delta?.processingTimeMs ?? null },
        cost: { display: signedCost(delta?.costCents ?? null), rank: null, value: delta?.costCents ?? null },
        evidence: [
          signed(variant.meanDelta?.score ?? null, 2),
          signed(delta?.legacyScore ?? null, 2),
          signedPoints(delta?.speakerAwareWER ?? null),
          signedPoints(delta?.textOnlyWER ?? null),
          signed(delta?.forgivenDisfluency ?? null, 1),
          signed(delta?.forgivenOrthographic ?? null, 1),
          signed(delta?.forgivenNumberFormat ?? null, 1),
          signed(delta?.remainingSpeakerAttribution ?? null, 1),
          signed(delta?.remainingOtherLexical ?? null, 1),
          signed(delta?.speakerCountAbsoluteError ?? null, 2),
          signedPoints(delta?.wordAttributionAccuracy ?? null),
          variant.baselineProviderKey,
          variant.unpairedRecordings.length === 0 ? "complete" : variant.unpairedRecordings.map((entry) => `${entry.recordingId}: ${STATUS_LABELS[entry.status]}`).join("; "),
        ],
        perRun: variant.pairs.map((pair) => {
          const value = pair.delta?.score ?? null;
          if (!isFiniteNumber(value)) return { display: pair.status === "paired" ? "n/a" : STATUS_LABELS[pair.status], heat: null };
          return { display: signed(value, 2), heat: heatMax === heatMin ? 100 : Math.round(((value - heatMin) / (heatMax - heatMin)) * 100) };
        }),
      };
    });
    rankBy(providers, "quality", "higher");
    rankBy(providers, "speed", "lower");
    rankBy(providers, "cost", "lower");
    return {
      key: group.key,
      label: group.label,
      metricColumns: { quality: `Δ score · ${basis}`, speed: "Δ mean time", cost: "Δ mean cost" },
      metricDirections: { quality: "higher", speed: "lower", cost: "lower" },
      metricSortLabels: { quality: "Δ quality", speed: "Δ time", cost: "Δ cost" },
      evidenceColumns: [
        "Δ score (all covered)", "Δ legacy", "Δ SA-WER", "Δ text WER", "Δ disfluency edits", "Δ orthographic edits", "Δ number edits",
        "Δ speaker-attr. edits", "Δ other lexical", "Δ speaker-count err.", "Δ word attribution", "Baseline", "Unpaired",
      ],
      perRunMetricLabel: "Per-recording Δ neutral score (variant − baseline)",
      providers,
    };
  });
  const statusRows: DashboardRunInventoryCell[][] = report.variants.flatMap((variant) => variant.pairs.map((pair) => [
    { display: variant.variantId },
    { display: pair.recordingId },
    { display: STATUS_LABELS[pair.status] },
    { display: pair.baseline ? plain(pair.baseline.score, 2) : "n/a" },
    { display: pair.variant ? plain(pair.variant.score, 2) : "n/a" },
    { display: signed(pair.delta?.score ?? null, 2) },
    { display: pair.reason ?? "" },
  ]));
  return {
    title: "STT Settings Variants vs Default Baselines",
    category: "stt-settings",
    generatedAt: report.generatedAt,
    rootDir,
    summaryStats: [
      { label: "Variants", value: String(report.variants.filter((variant) => variant.pairedRecordings.length > 0).length) },
      { label: "Planned variants", value: String(report.variantCount) },
      { label: "Recordings", value: String(report.recordings.length) },
      { label: "Paired runs", value: String(report.pairedRunCount) },
      { label: "Unpaired slots", value: String(report.unpairedRunCount) },
      { label: "Common recordings", value: String(report.commonRecordings.length) },
      { label: "Scoring version", value: String(report.scoringVersion) },
    ],
    runs: report.recordings.map((recordingId, index) => ({
      runName: recordingId,
      shortLabel: `R${index + 1}`,
      detail: `${report.variants.filter((variant) => variant.pairedRecordings.includes(recordingId)).length} paired variants${report.commonRecordings.includes(recordingId) ? " · common set" : ""}`,
    })),
    groups,
    methodParagraphs: [
      "Each row is one settings variant compared with the same service/model at default settings on the same recordings, both scored with the current scoring code against the same verified consensus reference. Every value is a mean Δ (variant − baseline) per recording.",
      `Quality ranks the mean Δ neutral score descending over the ${report.headlineBasis === "common-recording-set" ? `common recording set (${report.commonRecordings.join(", ")})` : "variant's own paired recordings"}; time and cost rank the mean Δ ascending. Groups are setting kinds and are never ranked against each other.`,
      "Unpaired slots (skipped, not run, variant failed, or baseline missing) are listed in the status table and excluded from means; the Unpaired column names them.",
    ],
    notes: report.notes,
    sampleTables: [{
      title: "Variant × recording status",
      columns: ["Variant", "Recording", "Status", "Baseline score", "Variant score", "Δ score", "Reason"],
      rows: statusRows,
    }],
  };
}

/** Dashboard tab builder: reads the generated settings report; it never rescores. */
export function buildSttSettingsDashboard(rootDirRaw: string): { dashboardModel: CombinedDashboardModel } {
  const rootDir = resolve(rootDirRaw);
  const report = readJson<SettingsReport>(join(rootDir, SETTINGS_REPORT_JSON));
  if (report.kind !== "stt-settings-comparison-report") {
    throw new Error(`${join(rootDir, SETTINGS_REPORT_JSON)} is not an STT settings comparison report`);
  }
  return { dashboardModel: settingsDashboardModel(report, rootDir) };
}

export function writeSttSettingsReport(settingsRootRaw: string, options: SettingsReportOptions = {}): SettingsReport {
  const settingsRoot = resolve(settingsRootRaw);
  const report = buildSttSettingsReport(settingsRoot, { onProgress: (message) => console.error(message), ...options });
  const jsonPath = join(settingsRoot, SETTINGS_REPORT_JSON);
  const markdownPath = join(settingsRoot, SETTINGS_REPORT_MARKDOWN);
  writePortableFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writePortableFileSync(markdownPath, renderSettingsMarkdown(report));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${markdownPath}`);
  console.log(`Compared ${report.variantCount} variants (${report.pairedRunCount} paired runs, ${report.unpairedRunCount} unpaired slots).`);
  return report;
}

function main(argv: string[]): number {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: bun scripts/stt/build_settings_report.ts <settings_root> [--baseline-root <dir>]");
    console.log(`Writes ${SETTINGS_REPORT_JSON} and ${SETTINGS_REPORT_MARKDOWN} in <settings_root>. The baseline root defaults to the sibling with-speakers directory.`);
    return argv.length === 0 ? 1 : 0;
  }
  let settingsRoot: string | null = null;
  let baselineRoot: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--baseline-root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --baseline-root");
      baselineRoot = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    if (settingsRoot !== null) throw new Error(`Unexpected positional argument: ${arg}`);
    settingsRoot = arg;
  }
  writeSttSettingsReport(settingsRoot!, baselineRoot ? { baselineRoot } : {});
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
