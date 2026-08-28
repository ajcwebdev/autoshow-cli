#!/usr/bin/env bun

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildTextProviderRows,
  defaultReportPaths,
  loadTextManifestRecord,
  runName,
  type TextProviderRow,
} from "./text_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  markdownOut: string | null;
  jsonOut: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_comparison_report.ts <run_dir> [--markdown-out <path>] [--json-out <path>]",
    "",
    "Generate text/write provider comparison reports from canonical manifest metadata.",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }
  const positional: string[] = [];
  let markdownOut: string | null = null;
  let jsonOut: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--markdown-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --markdown-out");
      markdownOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --json-out");
      jsonOut = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    positional.push(arg);
  }
  const runDir = positional[0];
  if (!runDir) throw new Error(helpText());
  return { runDir: resolve(runDir), markdownOut, jsonOut };
}

function escapeCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

function formatCents(value: number | null): string {
  if (value === null) return "n/a";
  if (value === 0) return "$0.00";
  return `$${(value / 100).toFixed(4)}`;
}

function formatSpeed(row: TextProviderRow): string {
  if (row.msPerUnit !== null) return `${row.msPerUnit.toFixed(3)} ms/1K tokens`;
  return row.processingTimeMs === null ? "n/a" : `${(row.processingTimeMs / 1000).toFixed(2)}s`;
}

function markdownForRows(runDir: string, rows: TextProviderRow[]): string {
  const tableRows = rows.map((row) => [
    row.providerKey,
    row.group,
    `${row.inputTokenCount.toLocaleString()} in / ${row.outputTokenCount.toLocaleString()} out`,
    formatSpeed(row),
    formatCents(row.costCents),
    row.outputFileName ? `${row.outputFileName}${row.outputExists ? "" : " (missing)"}` : "n/a",
  ]);
  return [
    "# Text Provider Comparison Report",
    "",
    "## Summary",
    "",
    `- Run directory: \`${runDir}\``,
    `- Total providers: ${rows.length}`,
    "- This report uses existing write metadata only and does not call providers.",
    "",
    "## Provider Evidence",
    "",
    "| Provider | Group | Tokens | Speed | Cost | Output |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...tableRows.map((cells) => `| ${cells.map(escapeCell).join(" | ")} |`),
    "",
    "## Notes",
    "",
    "- Text quality is not inferred from length, speed, cost, schema validity, output existence, or subjective judgment.",
    "- The shared report normalizer rewrites this artifact with local/service ranking surfaces.",
    "",
  ].join("\n");
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const defaults = defaultReportPaths(args.runDir);
  const jsonOut = args.jsonOut ?? defaults.jsonOut;
  const markdownOut = args.markdownOut ?? defaults.markdownOut;
  const manifestRecord = loadTextManifestRecord(args.runDir);
  const rows = buildTextProviderRows(args.runDir, manifestRecord);
  const localRows = rows.filter((row) => row.group === "local");
  const serviceRows = rows.filter((row) => row.group === "service");
  const reportJson = {
    schemaVersion: 1,
    kind: "text-provider-comparison",
    category: "text",
    runDir: args.runDir,
    runName: runName(args.runDir),
    generatedAt: new Date().toISOString(),
    metric: "metadata-only price-speed",
    providerCount: rows.length,
    providerGroups: {
      local: { count: localRows.length, providers: localRows },
      service: { count: serviceRows.length, providers: serviceRows },
    },
    providers: rows,
    qualityPolicy: "Quality unavailable unless explicit text quality fields are present.",
    notes: [
      "Text mode scores existing write outputs only and does not call LLM providers.",
      "Length, speed, cost, output existence, schema validity, and subjective judgment are not quality proxies.",
    ],
  };

  writeFileSync(jsonOut, JSON.stringify(reportJson));
  writeFileSync(markdownOut, markdownForRows(args.runDir, rows));
  return 0;
}

main().then((code) => process.exit(code)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
