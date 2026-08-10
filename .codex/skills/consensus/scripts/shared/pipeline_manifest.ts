import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const PIPELINE_MANIFEST_FILE = "manifest.json";

export type JsonObject = Record<string, unknown>;

export interface PipelineProviderState {
  service: string;
  model?: string | null;
  local?: boolean;
  artifactDir: string;
  status: "running" | "succeeded" | "missing" | "failed" | "skipped";
  attempts: number;
  options: JsonObject;
  metadata: JsonObject;
  result?: JsonObject;
  error?: JsonObject;
}

export interface PipelineManifestItem {
  input?: string;
  inputFamily?: string;
  extractRoute?: string;
  outputDir?: string;
  status: "full" | "incomplete" | "failed" | "skipped";
  metadata: JsonObject;
  providers: PipelineProviderState[];
}

export interface PipelineManifest {
  command: string;
  scope: "single" | "batch";
  createdAt: string;
  updatedAt: string;
  source?: JsonObject;
  items: PipelineManifestItem[];
}

export interface CanonicalRunRecord {
  manifest: PipelineManifest;
  item: PipelineManifestItem;
  metadata: JsonObject;
}

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProviderState(value: unknown): value is PipelineProviderState {
  return isRecord(value)
    && typeof value["service"] === "string"
    && (value["model"] === undefined || value["model"] === null || typeof value["model"] === "string")
    && (value["local"] === undefined || typeof value["local"] === "boolean")
    && typeof value["artifactDir"] === "string"
    && typeof value["status"] === "string"
    && typeof value["attempts"] === "number"
    && isRecord(value["options"])
    && isRecord(value["metadata"])
    && (value["result"] === undefined || isRecord(value["result"]))
    && (value["error"] === undefined || isRecord(value["error"]));
}

function isManifestItem(value: unknown): value is PipelineManifestItem {
  return isRecord(value)
    && typeof value["status"] === "string"
    && isRecord(value["metadata"])
    && Array.isArray(value["providers"])
    && value["providers"].every(isProviderState)
    && (value["input"] === undefined || typeof value["input"] === "string")
    && (value["inputFamily"] === undefined || typeof value["inputFamily"] === "string")
    && (value["extractRoute"] === undefined || typeof value["extractRoute"] === "string")
    && (value["outputDir"] === undefined || typeof value["outputDir"] === "string");
}

function parseManifest(value: unknown): PipelineManifest | null {
  if (
    !isRecord(value)
    || typeof value["command"] !== "string"
    || (value["scope"] !== "single" && value["scope"] !== "batch")
    || typeof value["createdAt"] !== "string"
    || typeof value["updatedAt"] !== "string"
    || (value["source"] !== undefined && !isRecord(value["source"]))
    || !Array.isArray(value["items"])
    || value["items"].length === 0
    || !value["items"].every(isManifestItem)
  ) {
    return null;
  }
  return value as unknown as PipelineManifest;
}

export function readCanonicalManifest(runDir: string): PipelineManifest {
  const manifestPath = join(runDir, PIPELINE_MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing canonical manifest: ${manifestPath}`);
  }
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  const manifest = parseManifest(parsed);
  if (!manifest) {
    throw new Error(`Invalid canonical manifest: ${manifestPath}`);
  }
  return manifest;
}

export function deriveCanonicalItemRecord(runDir: string, item: PipelineManifestItem): JsonObject {
  const requestedProviders = item.providers.map((provider) => ({
    service: provider.service,
    ...(provider.model !== undefined ? { model: provider.model } : {}),
    ...(provider.local !== undefined ? { local: provider.local } : {}),
    ...provider.options,
  }));
  const providerStates = item.providers.map((provider) => ({
    service: provider.service,
    ...(provider.model !== undefined ? { model: provider.model } : {}),
    ...(provider.local !== undefined ? { local: provider.local } : {}),
    artifactDir: provider.artifactDir,
    status: provider.status,
    attempts: provider.attempts,
    metadata: provider.metadata,
    ...(provider.result ? { result: provider.result } : {}),
    ...(provider.error ? { lastError: provider.error } : {}),
  }));
  const successfulMetadata = item.providers
    .filter((provider) => provider.status === "succeeded" && Object.keys(provider.metadata).length > 0)
    .map((provider) => provider.metadata);

  return {
    ...item.metadata,
    ...(item.input !== undefined ? { input: item.input } : {}),
    ...(item.inputFamily !== undefined ? { inputFamily: item.inputFamily } : {}),
    ...(item.extractRoute !== undefined ? { extractRoute: item.extractRoute } : {}),
    ...(successfulMetadata.length === 1
      ? { step2: successfulMetadata[0] }
      : successfulMetadata.length > 1
        ? { step2: successfulMetadata }
        : {}),
    outputDir: item.outputDir ? resolve(runDir, item.outputDir) : resolve(runDir),
    completionStatus: item.status,
    requestedProviders,
    providerStates,
    missingProviders: requestedProviders.filter((_, index) => {
      const status = item.providers[index]?.status;
      return status === "missing" || status === "failed";
    }),
  };
}

export function loadCanonicalRunRecord(
  runDir: string,
  expectedCommand: string,
  expectedExtractRoute?: string,
): CanonicalRunRecord {
  const manifest = readCanonicalManifest(runDir);
  if (manifest.command !== expectedCommand || manifest.scope !== "single" || manifest.items.length !== 1) {
    throw new Error(
      `Expected one ${expectedCommand} item in ${join(runDir, PIPELINE_MANIFEST_FILE)}; found ${manifest.command}/${manifest.scope} with ${manifest.items.length} item(s)`,
    );
  }
  const item = manifest.items[0]!;
  if (expectedExtractRoute !== undefined && item.extractRoute !== expectedExtractRoute) {
    throw new Error(
      `Expected extract route ${expectedExtractRoute} in ${join(runDir, PIPELINE_MANIFEST_FILE)}; found ${item.extractRoute ?? "none"}`,
    );
  }
  return { manifest, item, metadata: deriveCanonicalItemRecord(runDir, item) };
}
