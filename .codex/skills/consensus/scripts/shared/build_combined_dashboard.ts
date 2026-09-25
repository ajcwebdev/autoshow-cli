#!/usr/bin/env bun

import { writePortableFileSync } from "./portable_paths";
import { join, resolve } from "node:path";
import { buildOcrCombinedReport } from "../ocr/build_combined_report";
import { buildSttCombinedReport } from "../stt/build_combined_report";
import { buildUrlCombinedReport } from "../url/build_combined_report";
import { buildTtsDashboard } from "../tts/build_tts_dashboard";
import {
  renderBenchmarkDashboard,
  type BenchmarkDashboardTab,
  type CombinedDashboardModel,
} from "./combined_report_html";

interface DashboardTabSource {
  key: string;
  label: string;
  build: (rootDir: string, generatedAt: string) => { dashboardModel: CombinedDashboardModel };
}

export const DASHBOARD_TABS: DashboardTabSource[] = [
  { key: "ocr", label: "OCR", build: buildOcrCombinedReport },
  { key: "stt-local", label: "STT local", build: buildSttCombinedReport },
  { key: "stt-with-speakers", label: "STT with speakers", build: buildSttCombinedReport },
  { key: "stt-without-speakers", label: "STT without speakers", build: buildSttCombinedReport },
  { key: "url", label: "URL", build: buildUrlCombinedReport },
  { key: "tts", label: "TTS", build: buildTtsDashboard },
];

export const DASHBOARD_FILE = "combined-comparison-dashboard.html";

export function buildCombinedDashboard(benchmarksRootRaw: string, generatedAt = new Date().toISOString()): string {
  const benchmarksRoot = resolve(benchmarksRootRaw);
  const tabs: BenchmarkDashboardTab[] = DASHBOARD_TABS.map((tab) => {
    const tabRoot = join(benchmarksRoot, tab.key);
    const { dashboardModel } = tab.build(tabRoot, generatedAt);
    return {
      key: tab.key,
      label: tab.label,
      rootLabel: `docs/benchmarks/${tab.key}`,
      model: dashboardModel,
    };
  });

  return renderBenchmarkDashboard({
    title: "AutoShow Benchmark Dashboard",
    generatedAt,
    tabs,
  });
}

export function writeCombinedDashboard(benchmarksRootRaw: string, outPathRaw?: string): string {
  const benchmarksRoot = resolve(benchmarksRootRaw);
  const outPath = resolve(outPathRaw ?? join(benchmarksRoot, DASHBOARD_FILE));
  writePortableFileSync(outPath, buildCombinedDashboard(benchmarksRoot));
  console.log(`Wrote ${outPath}`);
  return outPath;
}

export function defaultBenchmarksRoot(): string {
  return resolve(import.meta.dir, "../../../../../docs/benchmarks");
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: bun scripts/shared/build_combined_dashboard.ts [benchmarks_root] [--out <path>]");
    return 0;
  }

  let benchmarksRoot: string | null = null;
  let outPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --out");
      }
      outPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    if (benchmarksRoot !== null) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    benchmarksRoot = arg;
  }

  writeCombinedDashboard(benchmarksRoot ?? defaultBenchmarksRoot(), outPath);
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
