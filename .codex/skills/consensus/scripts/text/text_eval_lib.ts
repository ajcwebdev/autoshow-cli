import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export type JsonObject = Record<string, unknown>;

export interface TextRunJson extends JsonObject {
  kind: "write";
  metadata: JsonObject;
}

export interface TextProviderRow extends JsonObject {
  providerKey: string;
  provider: string;
  model: string;
  group: "local" | "service";
  processingTimeMs: number | null;
  actualProcessingTimeMs: number | null;
  estimatedProcessingTimeMs: number | null;
  msPerUnit: number | null;
  costCents: number | null;
  actualCostCents: number | null;
  estimatedCostCents: number | null;
  inputTokenCount: number;
  outputTokenCount: number;
  totalTokenCount: number;
  tokenCountSource: string | null;
  outputFileName: string | null;
  outputExists: boolean;
  outputByteSize: number | null;
}

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function objectArray(value: unknown): JsonObject[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  return isRecord(value) ? [value] : [];
}

function nestedObject(record: JsonObject | undefined, key: string): JsonObject | undefined {
  if (!record) return undefined;
  const value = record[key];
  return isRecord(value) ? value : undefined;
}

function nestedArray(record: JsonObject | undefined, key: string): JsonObject[] {
  if (!record) return [];
  const value = record[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function firstNumber(record: JsonObject | undefined, keys: readonly string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function round3(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function stepMatches(step: JsonObject, service: string, model: string): boolean {
  const stepName = asString(step.step);
  return (stepName === null || stepName === "llm")
    && asString(step.provider) === service
    && asString(step.model) === model;
}

function costSteps(runJson: TextRunJson, source: "actual" | "estimated"): JsonObject[] {
  const cost = nestedObject(runJson.metadata, "cost");
  return nestedArray(nestedObject(cost, source), "steps");
}

function timingSteps(runJson: TextRunJson, source: "actual" | "estimated"): JsonObject[] {
  const timing = nestedObject(runJson.metadata, "timing");
  return nestedArray(nestedObject(timing, source), "steps");
}

function findCostStep(runJson: TextRunJson, service: string, model: string): { source: "actual" | "estimated"; costCents: number } | null {
  for (const source of ["actual", "estimated"] as const) {
    const step = costSteps(runJson, source).find((candidate) => stepMatches(candidate, service, model));
    const costCents = firstNumber(step, ["cost", "costCents", "actualCostCents", "estimatedCostCents", "totalCost"]);
    if (step && costCents !== null) {
      return { source, costCents };
    }
  }
  return null;
}

function findTimingStep(runJson: TextRunJson, service: string, model: string): {
  source: "actual" | "estimated";
  processingTimeMs: number | null;
  msPerUnit: number | null;
  throughputValue: number | null;
  throughputUnit: string | null;
  rateBasis: string | null;
  inputMetric: string | null;
  inputValue: number | null;
  timingScope: string | null;
} | null {
  for (const source of ["actual", "estimated"] as const) {
    const step = timingSteps(runJson, source).find((candidate) => stepMatches(candidate, service, model));
    if (!step) continue;
    return {
      source,
      processingTimeMs: firstNumber(step, ["processingTimeMs", "processingTime"]),
      msPerUnit: asNumber(step.msPerUnit),
      throughputValue: asNumber(step.throughputValue),
      throughputUnit: asString(step.throughputUnit),
      rateBasis: asString(step.rateBasis),
      inputMetric: asString(step.inputMetric),
      inputValue: asNumber(step.inputValue),
      timingScope: asString(step.timingScope),
    };
  }
  return null;
}

export function loadTextRunJson(runDir: string): TextRunJson {
  const runJsonPath = join(runDir, "run.json");
  if (!existsSync(runJsonPath)) {
    throw new Error(`Text run directory is missing run.json: ${runJsonPath}`);
  }
  const parsed = JSON.parse(readFileSync(runJsonPath, "utf8")) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Text benchmark run.json must be a JSON object.");
  }
  if (parsed.kind !== "write") {
    throw new Error(`run.json kind is "${asString(parsed.kind) ?? "unknown"}", expected "write"`);
  }
  if (!isRecord(parsed.metadata)) {
    throw new Error("Text benchmark run.json is missing metadata.");
  }
  return parsed as TextRunJson;
}

export function textStep3Entries(runJson: TextRunJson): JsonObject[] {
  const entries = objectArray(runJson.metadata.step3);
  if (entries.length === 0) {
    throw new Error("Text benchmark run.json must contain metadata.step3.");
  }
  return entries;
}

export function buildTextProviderRows(runDir: string, runJson: TextRunJson): TextProviderRow[] {
  return textStep3Entries(runJson).map((entry, index) => {
    const service = asString(entry.llmService);
    const model = asString(entry.llmModel);
    if (!service || !model) {
      throw new Error(`Text benchmark metadata.step3[${index}] must include llmService and llmModel.`);
    }
    const inputTokenCount = asNumber(entry.inputTokenCount) ?? 0;
    const outputTokenCount = asNumber(entry.outputTokenCount) ?? 0;
    const totalTokenCount = inputTokenCount + outputTokenCount;
    const cost = findCostStep(runJson, service, model);
    const timing = findTimingStep(runJson, service, model);
    const processingTimeMs = timing?.processingTimeMs ?? asNumber(entry.processingTime);
    const msPerUnit = timing?.msPerUnit
      ?? (processingTimeMs !== null && totalTokenCount > 0 ? round3(processingTimeMs / (totalTokenCount / 1000)) : null);
    const group = service === "llama.cpp" ? "local" : "service";
    const actualCostCents = cost?.source === "actual" ? cost.costCents : null;
    const estimatedCostCents = cost?.source === "estimated" ? cost.costCents : null;
    const costCents = group === "local" ? 0 : actualCostCents ?? estimatedCostCents;
    const outputFileName = asString(entry.outputFileName);
    const outputPath = outputFileName ? join(runDir, outputFileName) : null;
    const outputExists = outputPath ? existsSync(outputPath) : false;
    const outputByteSize = outputPath && outputExists ? statSync(outputPath).size : null;
    const automatedQualityScore = asNumber(entry.automatedQualityScore) ?? asNumber(entry.textQualityScore);
    const humanQualityScore = asNumber(entry.humanQualityScore);

    return {
      providerKey: `${service}/${model}`,
      provider: service,
      model,
      group,
      llmService: service,
      llmModel: model,
      processingTimeMs,
      actualProcessingTimeMs: timing?.source === "actual" ? timing.processingTimeMs : null,
      estimatedProcessingTimeMs: timing?.source === "estimated" ? timing.processingTimeMs : null,
      msPerUnit,
      throughputValue: timing?.throughputValue ?? null,
      throughputUnit: timing?.throughputUnit ?? null,
      rateBasis: timing?.rateBasis ?? (msPerUnit !== null ? "1KTokens" : null),
      timingScope: timing?.timingScope ?? (timing?.source === "actual" ? "wall" : null),
      inputMetric: timing?.inputMetric ?? (totalTokenCount > 0 ? "tokens" : null),
      inputValue: timing?.inputValue ?? (totalTokenCount > 0 ? totalTokenCount : null),
      timingSource: timing?.source ?? (processingTimeMs !== null ? "metadata.step3.processingTime" : null),
      costCents,
      actualCostCents,
      estimatedCostCents,
      costSource: cost?.source ?? (group === "local" ? "local_zero" : null),
      inputTokenCount,
      outputTokenCount,
      totalTokenCount,
      tokenCountSource: asString(entry.tokenCountSource),
      providerUsage: isRecord(entry.providerUsage) ? entry.providerUsage : null,
      rawProviderUsage: entry.rawProviderUsage ?? null,
      outputFileName,
      outputExists,
      outputByteSize,
      structuredMode: asString(entry.structuredMode),
      structuredPresetNames: Array.isArray(entry.structuredPresetNames) ? entry.structuredPresetNames : [],
      automatedQualityScore,
      humanQualityScore,
      qualityMetric: automatedQualityScore !== null ? "explicit text quality score" : null,
      qualityValue: automatedQualityScore,
      qualityLabel: automatedQualityScore !== null ? `${automatedQualityScore.toFixed(2)} explicit text quality score` : null,
      metrics: {
        inputTokenCount,
        outputTokenCount,
        totalTokenCount,
        msPerUnit,
        ...(automatedQualityScore !== null ? { automatedQualityScore, textQualityScore: automatedQualityScore } : {}),
        ...(humanQualityScore !== null ? { humanQualityScore } : {}),
      },
    };
  }).sort((left, right) => {
    if (left.group !== right.group) return left.group.localeCompare(right.group);
    return left.providerKey.localeCompare(right.providerKey);
  });
}

export function defaultReportPaths(runDir: string): { jsonOut: string; markdownOut: string } {
  return {
    jsonOut: resolve(runDir, "provider-comparison-report.json"),
    markdownOut: resolve(runDir, "provider-comparison-report.md"),
  };
}

export function runName(runDir: string): string {
  return basename(runDir);
}
