#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { compactRunResults, formatBytes, isRecord } from "../stt/compact_provider_results";

const ALWAYS_PRUNE_DIRECTORY_NAMES = new Set(["page-inputs"]);
const RESULT_GATED_PRUNE_DIRECTORY_NAMES = new Set(["page-results", "split-attempts", "segment-runs"]);
const RESULT_GATED_PRUNE_FILE_NAMES = new Set([
  "fallback-state.json",
  "partial-extraction.txt",
  "transcription.words.json",
  "transcription.json",
]);
const RUN_JSON_ARTIFACT_NAMES = [
  "provider-comparison-report.json",
  "reference-comparison-report.json",
  "page-metrics.json",
  "outliers.json",
  "selective-adjudication-pages.json",
  "variant-comparison-summary.json",
] as const;
const ROOT_JSON_ARTIFACT_NAMES = ["combined-comparison-report.json"] as const;

export interface ArchiveJsonStat {
  files: number;
  bytesBefore: number;
  bytesAfter: number;
}

export interface ArchiveRunStat {
  runName: string;
  runDir: string;
  resultFiles: number;
  resultBytesBefore: number;
  resultBytesAfter: number;
  strippedManifestResults: number;
  manifestBytesBefore: number;
  manifestBytesAfter: number;
  jsonFiles: number;
  jsonBytesBefore: number;
  jsonBytesAfter: number;
  prunedDirectories: string[];
  prunedFiles: string[];
}

export function isRunDirectory(dir: string): boolean {
  const manifestPath = join(dir, "manifest.json");
  return existsSync(manifestPath) && statSync(manifestPath).isFile();
}

export function discoverArchiveRuns(rootDir: string): string[] {
  if (isRunDirectory(rootDir)) {
    throw new Error(
      `compact-archive refuses a single run directory: ${rootDir}. Run it on a category root such as docs/benchmarks/image or docs/benchmarks/stt-with-speakers.`,
    );
  }

  const children = readdirSync(rootDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const directRuns = children
    .map((entry) => join(rootDir, entry.name))
    .filter(isRunDirectory)
    .sort((left, right) => left.localeCompare(right));
  if (directRuns.length > 0) {
    return directRuns;
  }

  const nestedRuns: string[] = [];
  for (const child of children) {
    const childDir = join(rootDir, child.name);
    nestedRuns.push(
      ...readdirSync(childDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(childDir, entry.name))
        .filter(isRunDirectory),
    );
  }
  nestedRuns.sort((left, right) => left.localeCompare(right));
  if (nestedRuns.length === 0) {
    throw new Error(`No run subdirectories with manifest.json found under ${rootDir}`);
  }
  return nestedRuns;
}

function sidecarResultPath(runDir: string, artifactDir: string): string | null {
  const candidates = artifactDir === "." || artifactDir === ""
    ? [join(runDir, "result.json")]
    : [join(runDir, artifactDir, "result.json"), join(runDir, "providers", basename(artifactDir), "result.json")];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function relativizePaths(value: unknown, baseDir: string): unknown {
  const resolvedBase = resolve(baseDir);
  const prefix = `${resolvedBase}/`;
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      if (node === resolvedBase || node === `${resolvedBase}/`) {
        return ".";
      }
      if (node.startsWith(prefix)) {
        return node.slice(prefix.length);
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (isRecord(node)) {
      const next: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) {
        next[key] = walk(child);
      }
      return next;
    }
    return node;
  };
  return walk(value);
}

function compactJsonFile(path: string, baseDir: string): { beforeBytes: number; afterBytes: number } | null {
  if (!existsSync(path) || !statSync(path).isFile()) {
    return null;
  }
  const beforeBytes = statSync(path).size;
  const payload = JSON.parse(readFileSync(path, "utf8")) as unknown;
  writeFileSync(path, JSON.stringify(relativizePaths(payload, baseDir)));
  return { beforeBytes, afterBytes: statSync(path).size };
}

function compactNamedJsonFiles(dir: string, names: readonly string[]): ArchiveJsonStat {
  let files = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;
  for (const name of names) {
    const compacted = compactJsonFile(join(dir, name), dir);
    if (!compacted) {
      continue;
    }
    files += 1;
    bytesBefore += compacted.beforeBytes;
    bytesAfter += compacted.afterBytes;
  }
  return { files, bytesBefore, bytesAfter };
}

function compactManifest(runDir: string): { stripped: number; beforeBytes: number; afterBytes: number } {
  const manifestPath = join(runDir, "manifest.json");
  const beforeBytes = statSync(manifestPath).size;
  const payload = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload["items"])) {
    throw new Error(`Invalid canonical manifest: ${manifestPath}`);
  }

  let stripped = 0;
  for (const item of payload["items"]) {
    if (!isRecord(item) || !Array.isArray(item["providers"])) {
      continue;
    }
    for (const provider of item["providers"]) {
      if (!isRecord(provider) || !("result" in provider)) {
        continue;
      }
      const artifactDir = typeof provider["artifactDir"] === "string" ? provider["artifactDir"] : "";
      if (sidecarResultPath(runDir, artifactDir)) {
        delete provider["result"];
        stripped += 1;
      }
    }
  }

  writeFileSync(manifestPath, JSON.stringify(payload));
  return { stripped, beforeBytes, afterBytes: statSync(manifestPath).size };
}

function hasCanonicalResult(dir: string): boolean {
  const resultPath = join(dir, "result.json");
  return existsSync(resultPath) && statSync(resultPath).isFile();
}

function pruneDerivedArtifacts(runDir: string): { directories: string[]; files: string[] } {
  const directories: string[] = [];
  const files: string[] = [];
  const stack = [runDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const hasResult = hasCanonicalResult(current);
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const relative = path.slice(runDir.length + 1);
      if (entry.isDirectory()) {
        if (
          ALWAYS_PRUNE_DIRECTORY_NAMES.has(entry.name)
          || (RESULT_GATED_PRUNE_DIRECTORY_NAMES.has(entry.name) && hasResult)
        ) {
          rmSync(path, { recursive: true, force: true });
          directories.push(relative);
          continue;
        }
        stack.push(path);
        continue;
      }
      if (entry.isFile() && RESULT_GATED_PRUNE_FILE_NAMES.has(entry.name) && hasResult) {
        rmSync(path, { force: true });
        files.push(relative);
      }
    }
  }
  directories.sort((left, right) => left.localeCompare(right));
  files.sort((left, right) => left.localeCompare(right));
  return { directories, files };
}

export function compactArchiveRun(runDir: string): ArchiveRunStat {
  const resultStats = compactRunResults(runDir);
  const resultBytesBefore = resultStats.reduce((sum, stat) => sum + stat.beforeBytes, 0);
  const resultBytesAfter = resultStats.reduce((sum, stat) => sum + stat.afterBytes, 0);
  const manifest = compactManifest(runDir);
  const json = compactNamedJsonFiles(runDir, RUN_JSON_ARTIFACT_NAMES);
  const pruned = pruneDerivedArtifacts(runDir);
  return {
    runName: basename(runDir),
    runDir,
    resultFiles: resultStats.length,
    resultBytesBefore,
    resultBytesAfter,
    strippedManifestResults: manifest.stripped,
    manifestBytesBefore: manifest.beforeBytes,
    manifestBytesAfter: manifest.afterBytes,
    jsonFiles: json.files,
    jsonBytesBefore: json.bytesBefore,
    jsonBytesAfter: json.bytesAfter,
    prunedDirectories: pruned.directories,
    prunedFiles: pruned.files,
  };
}

export function compactArchive(rootDir: string): ArchiveRunStat[] {
  const stats = discoverArchiveRuns(rootDir).map(compactArchiveRun);
  compactNamedJsonFiles(rootDir, ROOT_JSON_ARTIFACT_NAMES);
  return stats;
}

function main(): number {
  const rootRaw = process.argv[2];
  if (!rootRaw || rootRaw === "--help" || rootRaw === "-h") {
    console.log("Usage: bun scripts/shared/compact_archive.ts <root_dir>");
    return rootRaw ? 0 : 1;
  }

  const rootDir = resolve(rootRaw);
  const stats = compactArchive(rootDir);
  let resultBefore = 0;
  let resultAfter = 0;
  let manifestBefore = 0;
  let manifestAfter = 0;
  let jsonBefore = 0;
  let jsonAfter = 0;
  let prunedDirectories = 0;
  let prunedFiles = 0;
  for (const stat of stats) {
    resultBefore += stat.resultBytesBefore;
    resultAfter += stat.resultBytesAfter;
    manifestBefore += stat.manifestBytesBefore;
    manifestAfter += stat.manifestBytesAfter;
    jsonBefore += stat.jsonBytesBefore;
    jsonAfter += stat.jsonBytesAfter;
    prunedDirectories += stat.prunedDirectories.length;
    prunedFiles += stat.prunedFiles.length;
    console.log(
      `${stat.runName.padEnd(48)} results ${formatBytes(stat.resultBytesBefore).padStart(10)} -> ${formatBytes(stat.resultBytesAfter).padStart(10)}  manifest ${formatBytes(stat.manifestBytesBefore).padStart(10)} -> ${formatBytes(stat.manifestBytesAfter).padStart(10)}  json ${formatBytes(stat.jsonBytesBefore).padStart(10)} -> ${formatBytes(stat.jsonBytesAfter).padStart(10)}  pruned ${stat.prunedDirectories.length} dirs / ${stat.prunedFiles.length} files  stripped ${stat.strippedManifestResults}`,
    );
  }
  console.log("");
  console.log(`Compacted ${stats.length} run director${stats.length === 1 ? "y" : "ies"} under ${rootDir}`);
  console.log(`result.json: ${formatBytes(resultBefore)} -> ${formatBytes(resultAfter)}`);
  console.log(`manifest.json: ${formatBytes(manifestBefore)} -> ${formatBytes(manifestAfter)}`);
  console.log(`report JSON: ${formatBytes(jsonBefore)} -> ${formatBytes(jsonAfter)}`);
  console.log(`pruned derived directories: ${prunedDirectories}`);
  console.log(`pruned checkpoint files: ${prunedFiles}`);
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
