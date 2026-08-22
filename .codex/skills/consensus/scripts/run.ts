#!/usr/bin/env bun

import { resolve } from "node:path";

import { type ConsensusCategory, rewriteComparisonReports } from "./shared/report_surfaces.ts";
import { runSyncCommand } from "../../../../src/utils/sync-subprocess.ts";

type CommandName = "build-packet" | "build-report" | "compact-results" | "build-combined-report";

interface CategoryConfig {
  packetScript: string;
  reportScript: string;
  defaultMarkdown: string;
  defaultJson: string;
  compactScript?: string;
  combinedReportScript?: string;
}

interface ParsedArgs {
  category: ConsensusCategory | null;
  command: CommandName | null;
  runDir: string | null;
  flags: Map<string, string | true>;
}

const CATEGORIES = ["image", "music", "ocr", "stt", "text", "tts", "url", "video"] as const;

const CONFIG: Record<ConsensusCategory, CategoryConfig> = {
  image: {
    packetScript: "image/build_evaluation_packet.ts",
    reportScript: "image/build_comparison_report.ts",
    defaultMarkdown: "provider-comparison-report.md",
    defaultJson: "provider-comparison-report.json",
  },
  music: {
    packetScript: "music/build_evaluation_packet.ts",
    reportScript: "music/build_comparison_report.ts",
    defaultMarkdown: "provider-comparison-report.md",
    defaultJson: "provider-comparison-report.json",
  },
  ocr: {
    packetScript: "ocr/build_consensus_packet.ts",
    reportScript: "ocr/build_comparison_report.ts",
    defaultMarkdown: "provider-comparison-report.md",
    defaultJson: "provider-comparison-report.json",
    combinedReportScript: "ocr/build_combined_report.ts",
  },
  stt: {
    packetScript: "stt/build_consensus_packet.ts",
    reportScript: "stt/build_reference_report.ts",
    defaultMarkdown: "reference-comparison-report.md",
    defaultJson: "reference-comparison-report.json",
    compactScript: "stt/compact_provider_results.ts",
    combinedReportScript: "stt/build_combined_report.ts",
  },
  text: {
    packetScript: "text/build_packet.ts",
    reportScript: "text/build_comparison_report.ts",
    defaultMarkdown: "provider-comparison-report.md",
    defaultJson: "provider-comparison-report.json",
  },
  tts: {
    packetScript: "tts/build_evaluation_packet.ts",
    reportScript: "tts/build_comparison_report.ts",
    defaultMarkdown: "provider-comparison-report.md",
    defaultJson: "provider-comparison-report.json",
  },
  url: {
    packetScript: "url/build_consensus_packet.ts",
    reportScript: "url/build_comparison_report.ts",
    defaultMarkdown: "provider-comparison-report.md",
    defaultJson: "provider-comparison-report.json",
    combinedReportScript: "url/build_combined_report.ts",
  },
  video: {
    packetScript: "video/build_evaluation_packet.ts",
    reportScript: "video/build_comparison_report.ts",
    defaultMarkdown: "provider-comparison-report.md",
    defaultJson: "provider-comparison-report.json",
  },
};

const SCRIPT_DIR = import.meta.dir;

function rootHelp(): string {
  return [
    "Usage:",
    "  bun scripts/run.ts <category> build-packet <run_dir> [--input-text <path>] [--out <path>]",
    "  bun scripts/run.ts <category> build-report <run_dir> [--input-text <path>] [--roundtrip-dir <path>]",
    "  bun scripts/run.ts stt compact-results <run_dir>",
    "  bun scripts/run.ts stt build-combined-report <root_dir>",
    "  bun scripts/run.ts ocr build-combined-report <root_dir>",
    "  bun scripts/run.ts url build-combined-report <root_dir>",
    "",
    `Categories: ${CATEGORIES.join(", ")}`,
    "Commands: build-packet, build-report, compact-results (stt only), build-combined-report (stt, ocr, url)",
    "",
    "Examples:",
    "  bun scripts/run.ts ocr build-packet ./runs/document --out /tmp/ocr-packet.json",
    "  bun scripts/run.ts ocr build-report ./runs/document",
    "  bun scripts/run.ts tts build-report ./runs/tts --input-text ./input.txt --roundtrip-dir ./roundtrip",
    "  bun scripts/run.ts stt compact-results ./runs/audio",
  ].join("\n");
}

function categoryHelp(category: ConsensusCategory): string {
  const inputTextNote = category === "tts"
    ? "TTS requires --input-text <path> for both build-packet and build-report."
    : category === "ocr" || category === "stt" || category === "url"
      ? "--input-text <path> may be used with build-report to point at the already-authored consensus artifact."
      : "--input-text is not used by this category.";

  return [
    `Usage for ${category}:`,
    `  bun scripts/run.ts ${category} build-packet <run_dir> [--input-text <path>] [--out <path>]`,
    `  bun scripts/run.ts ${category} build-report <run_dir> [--input-text <path>] [--roundtrip-dir <path>]`,
    ...(category === "ocr" || category === "stt" || category === "url" ? [`  bun scripts/run.ts ${category} build-combined-report <root_dir>`] : []),
    "",
    inputTextNote,
    "Generated single-run reports are normalized with local and service ranking surfaces; OCR and STT use grouped full metricRankings. OCR, STT, and URL combined cross-run reports add per-group weighted composites and model tiers.",
  ].join("\n");
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    const maybeCategory = argv.find((arg): arg is ConsensusCategory => CATEGORIES.includes(arg as ConsensusCategory));
    console.log(maybeCategory ? categoryHelp(maybeCategory) : rootHelp());
    process.exit(0);
  }

  const [categoryRaw, commandRaw, runDirRaw, ...rest] = argv;
  if (!CATEGORIES.includes(categoryRaw as ConsensusCategory)) {
    throw new Error(`Unknown category: ${categoryRaw}\n\n${rootHelp()}`);
  }
  if (
    commandRaw !== "build-packet" &&
    commandRaw !== "build-report" &&
    commandRaw !== "compact-results" &&
    commandRaw !== "build-combined-report"
  ) {
    throw new Error(`Unknown command: ${commandRaw}\n\n${categoryHelp(categoryRaw as ConsensusCategory)}`);
  }

  const flags = new Map<string, string | true>();
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--skip-ffprobe" || arg === "--preserve-existing") {
      flags.set(arg, true);
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    flags.set(arg, value);
    index += 1;
  }

  if (!runDirRaw) {
    throw new Error(`Missing run_dir.\n\n${categoryHelp(categoryRaw as ConsensusCategory)}`);
  }

  return {
    category: categoryRaw as ConsensusCategory,
    command: commandRaw,
    runDir: resolve(runDirRaw),
    flags,
  };
}

function flagString(flags: Map<string, string | true>, flag: string): string | null {
  const value = flags.get(flag);
  return typeof value === "string" ? value : null;
}

function runScript(script: string, args: string[]): void {
  const scriptPath = resolve(SCRIPT_DIR, script);
  const result = runSyncCommand("bun", [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.exitCode !== 0) {
    throw new Error(`Command failed with exit code ${result.exitCode}: bun ${scriptPath} ${args.join(" ")}`);
  }
}

function packetArgs(category: ConsensusCategory, runDir: string, flags: Map<string, string | true>): string[] {
  const args = [runDir];
  const inputText = flagString(flags, "--input-text");
  const out = flagString(flags, "--out");

  if (category === "tts") {
    if (!inputText) {
      throw new Error("TTS build-packet requires --input-text <path>");
    }
    args.push("--input-text", resolve(inputText));
  } else if (inputText) {
    throw new Error(`--input-text is not used by ${category} build-packet`);
  }

  if (out) {
    args.push("--out", resolve(out));
  }
  if (flags.get("--skip-ffprobe") === true) {
    if (category !== "tts") {
      throw new Error("--skip-ffprobe is only supported for tts build-packet");
    }
    args.push("--skip-ffprobe");
  }
  return args;
}

function reportArgs(category: ConsensusCategory, runDir: string, flags: Map<string, string | true>): string[] {
  const args = [runDir];
  const inputText = flagString(flags, "--input-text");
  const roundtripDir = flagString(flags, "--roundtrip-dir");
  const previousReport = flagString(flags, "--previous-report");
  const markdownOut = flagString(flags, "--markdown-out");
  const jsonOut = flagString(flags, "--json-out");
  const preserveExisting = flags.get("--preserve-existing") === true;

  if (category === "tts") {
    if (!inputText) {
      throw new Error("TTS build-report requires --input-text <path>");
    }
    args.push("--input-text", resolve(inputText));
    if (roundtripDir) {
      args.push("--roundtrip-dir", resolve(roundtripDir));
    }
  } else {
    if (roundtripDir) {
      throw new Error("--roundtrip-dir is only supported for tts build-report");
    }
    if ((category === "ocr" || category === "url") && inputText) {
      args.push("--consensus", resolve(inputText));
    } else if (category === "stt" && inputText) {
      args.push("--reference", resolve(inputText));
    } else if (inputText) {
      throw new Error(`--input-text is not used by ${category} build-report`);
    }
    if (previousReport) {
      if (category !== "ocr") {
        throw new Error("--previous-report is only supported for ocr build-report");
      }
      args.push("--previous-report", resolve(previousReport));
    }
  }

  if (markdownOut) {
    args.push("--markdown-out", resolve(markdownOut));
  }
  if (jsonOut) {
    args.push("--json-out", resolve(jsonOut));
  }
  if (preserveExisting) {
    if (category !== "stt") {
      throw new Error("--preserve-existing is only supported for stt build-report");
    }
    args.push("--preserve-existing");
  }

  return args;
}

function outputPaths(category: ConsensusCategory, runDir: string, flags: Map<string, string | true>): { markdownPath: string; jsonPath: string } {
  const config = CONFIG[category];
  return {
    markdownPath: resolve(flagString(flags, "--markdown-out") ?? resolve(runDir, config.defaultMarkdown)),
    jsonPath: resolve(flagString(flags, "--json-out") ?? resolve(runDir, config.defaultJson)),
  };
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.category || !parsed.command || !parsed.runDir) {
    throw new Error(rootHelp());
  }

  const config = CONFIG[parsed.category];
  if (parsed.command === "compact-results") {
    if (!config.compactScript) {
      throw new Error(`compact-results is not supported for ${parsed.category}`);
    }
    runScript(config.compactScript, [parsed.runDir]);
    return 0;
  }

  if (parsed.command === "build-combined-report") {
    if (!config.combinedReportScript) {
      throw new Error(`build-combined-report is not supported for ${parsed.category}`);
    }
    runScript(config.combinedReportScript, [parsed.runDir]);
    return 0;
  }

  if (parsed.command === "build-packet") {
    runScript(config.packetScript, packetArgs(parsed.category, parsed.runDir, parsed.flags));
    return 0;
  }

  runScript(config.reportScript, reportArgs(parsed.category, parsed.runDir, parsed.flags));
  const { markdownPath, jsonPath } = outputPaths(parsed.category, parsed.runDir, parsed.flags);
  rewriteComparisonReports({
    category: parsed.category,
    markdownPath,
    jsonPath,
  });
  console.log(`Rewrote ${markdownPath}`);
  console.log(`Rewrote ${jsonPath}`);
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
