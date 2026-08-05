#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  buildTextProviderRows,
  loadTextRunJson,
  type TextProviderRow,
} from "./text_eval_lib.ts";

interface ParsedArgs {
  runDir: string;
  out: string | null;
}

function helpText(): string {
  return [
    "Usage: bun build_packet.ts <run_dir> [--out <path>]",
    "",
    "Build a metadata-only text/write consensus packet from an existing run.",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(helpText());
    process.exit(0);
  }
  const positional: string[] = [];
  let out: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --out");
      out = resolve(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown flag: ${arg}`);
    positional.push(arg);
  }
  const runDir = positional[0];
  if (!runDir) throw new Error(helpText());
  return { runDir: resolve(runDir), out };
}

function outputPreview(runDir: string, row: TextProviderRow): string | null {
  if (!row.outputFileName || !row.outputExists) return null;
  const path = join(runDir, row.outputFileName);
  try {
    return readFileSync(path, "utf8").slice(0, 2000);
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const runJson = loadTextRunJson(args.runDir);
  const rows = buildTextProviderRows(args.runDir, runJson);
  const packet = {
    schemaVersion: 1,
    kind: "text-consensus-packet",
    category: "text",
    runDir: args.runDir,
    generatedAt: new Date().toISOString(),
    instructions: [
      "Use this packet for metadata-only text/write provider comparison.",
      "Do not infer text quality from output length, speed, cost, schema validity, output existence, or subjective judgment.",
      "Only explicit future text quality fields may be used for quality ranking.",
    ],
    providers: rows.map((row) => ({
      ...row,
      outputPreview: outputPreview(args.runDir, row),
    })),
  };
  const payload = `${JSON.stringify(packet, null, 2)}\n`;
  if (args.out) {
    writeFileSync(args.out, payload);
  } else {
    process.stdout.write(payload);
  }
  return 0;
}

main().then((code) => process.exit(code)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
