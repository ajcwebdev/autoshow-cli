#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const RAW_RESPONSE_CONSUMERS = new Set(["whisper", "gemini-stt"]);

interface CompactionStat {
  directoryName: string;
  beforeBytes: number;
  afterBytes: number;
  droppedWords: boolean;
  droppedRawResponse: boolean;
  keptRawResponse: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function discoverResultPaths(runDir: string): string[] {
  const providersDir = join(runDir, "providers");
  if (!existsSync(providersDir)) {
    throw new Error(`No providers directory found under ${runDir}`);
  }
  return readdirSync(providersDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(providersDir, entry.name, "result.json"))
    .filter((path) => existsSync(path))
    .sort((left, right) => left.localeCompare(right));
}

function compactResult(resultPath: string): CompactionStat {
  const beforeBytes = statSync(resultPath).size;
  const payload = JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, unknown>;
  const directoryName = basename(dirname(resultPath));

  const provider = typeof payload.provider === "string" ? payload.provider : "";
  const result = isRecord(payload.result) ? payload.result : null;
  const evidence = result && isRecord(result.evidence) ? result.evidence : null;

  let droppedWords = false;
  let droppedRawResponse = false;
  let keptRawResponse = false;

  if (evidence) {
    if ("words" in evidence) {
      delete evidence.words;
      droppedWords = true;
    }
    if ("rawResponse" in evidence) {
      if (RAW_RESPONSE_CONSUMERS.has(provider)) {
        keptRawResponse = true;
      } else {
        delete evidence.rawResponse;
        droppedRawResponse = true;
      }
    }
  }

  writeFileSync(resultPath, JSON.stringify(payload));
  const afterBytes = statSync(resultPath).size;

  return { directoryName, beforeBytes, afterBytes, droppedWords, droppedRawResponse, keptRawResponse };
}

function main(): number {
  const runDirRaw = process.argv[2];
  if (!runDirRaw || runDirRaw === "--help" || runDirRaw === "-h") {
    console.log("Usage: bun scripts/stt/compact_provider_results.ts <run_dir>");
    return runDirRaw ? 0 : 1;
  }

  const runDir = resolve(runDirRaw);
  const resultPaths = discoverResultPaths(runDir);
  if (resultPaths.length === 0) {
    throw new Error(`No providers/*/result.json files found under ${runDir}`);
  }

  const stats = resultPaths.map(compactResult);

  let totalBefore = 0;
  let totalAfter = 0;
  for (const stat of stats) {
    totalBefore += stat.beforeBytes;
    totalAfter += stat.afterBytes;
    const flags: string[] = [];
    if (stat.droppedWords) flags.push("dropped words");
    if (stat.droppedRawResponse) flags.push("dropped rawResponse");
    if (stat.keptRawResponse) flags.push("kept rawResponse (consumer)");
    console.log(
      `${stat.directoryName.padEnd(44)} ${formatBytes(stat.beforeBytes).padStart(10)} -> ${formatBytes(stat.afterBytes).padStart(10)}  ${flags.join(", ")}`,
    );
  }

  const saved = totalBefore - totalAfter;
  const pct = totalBefore > 0 ? ((saved / totalBefore) * 100).toFixed(1) : "0.0";
  console.log("");
  console.log(`Compacted ${stats.length} provider result.json files`);
  console.log(`Total: ${formatBytes(totalBefore)} -> ${formatBytes(totalAfter)} (saved ${formatBytes(saved)}, ${pct}%)`);
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
