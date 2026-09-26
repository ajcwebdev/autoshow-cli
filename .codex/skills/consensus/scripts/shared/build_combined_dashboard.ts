#!/usr/bin/env bun

import { writePortableFileSync } from "./portable_paths";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { buildOcrCombinedReport } from "../ocr/build_combined_report";
import { buildSttCombinedReport } from "../stt/build_combined_report";
import { buildUrlCombinedReport } from "../url/build_combined_report";
import { buildTtsDashboard } from "../tts/build_tts_dashboard";
import {
  DEFAULT_DASHBOARD_ASSETS,
  renderBenchmarkDashboard,
  type BenchmarkDashboardBundle,
  type BenchmarkDashboardTab,
  type CombinedDashboardModel,
  type DashboardAssetNames,
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

export const DASHBOARD_TAB_DIRS = DASHBOARD_TABS.filter(tab => tab.key !== "tts").map(tab => tab.key);

export function hasAllDashboardTabs(benchmarksRoot: string): boolean {
  // TTS can render an empty tab before its first benchmark run.
  return DASHBOARD_TAB_DIRS.every(tab => existsSync(join(benchmarksRoot, tab, "combined-comparison-report.json")));
}

export const DASHBOARD_FILE = "combined-comparison-dashboard.html";
export const DASHBOARD_DATA_FILE = DEFAULT_DASHBOARD_ASSETS.data;
export const DASHBOARD_STYLESHEET_FILE = DEFAULT_DASHBOARD_ASSETS.stylesheet;
export const DASHBOARD_SCRIPT_FILE = DEFAULT_DASHBOARD_ASSETS.script;

/** The page, data, stylesheet, and script paths one dashboard build writes; the assets share the page's directory and stem. */
export interface DashboardOutputPaths {
  html: string;
  data: string;
  stylesheet: string;
  script: string;
}

export function dashboardAssetNames(htmlPath: string): DashboardAssetNames {
  const stem = basename(htmlPath, extname(htmlPath));
  return { stylesheet: `${stem}.css`, script: `${stem}.js`, data: `${stem}.json` };
}

export function buildCombinedDashboard(
  benchmarksRootRaw: string,
  generatedAt = new Date().toISOString(),
  assets: DashboardAssetNames = DEFAULT_DASHBOARD_ASSETS,
): BenchmarkDashboardBundle {
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
    assets,
  });
}

export function writeCombinedDashboard(benchmarksRootRaw: string, outPathRaw?: string): DashboardOutputPaths {
  const benchmarksRoot = resolve(benchmarksRootRaw);
  const htmlPath = resolve(outPathRaw ?? join(benchmarksRoot, DASHBOARD_FILE));
  const assets = dashboardAssetNames(htmlPath);
  const outDir = dirname(htmlPath);
  const paths: DashboardOutputPaths = {
    html: htmlPath,
    data: join(outDir, assets.data),
    stylesheet: join(outDir, assets.stylesheet),
    script: join(outDir, assets.script),
  };
  const bundle = buildCombinedDashboard(benchmarksRoot, undefined, assets);
  writePortableFileSync(paths.html, bundle.html);
  writePortableFileSync(paths.data, bundle.data);
  writePortableFileSync(paths.stylesheet, bundle.stylesheet);
  writePortableFileSync(paths.script, bundle.script);
  for (const path of [paths.html, paths.data, paths.stylesheet, paths.script]) {
    console.log(`Wrote ${path}`);
  }
  return paths;
}

export function defaultBenchmarksRoot(): string {
  return resolve(import.meta.dir, "../../../../../docs/benchmarks");
}

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("Usage: bun scripts/shared/build_combined_dashboard.ts [benchmarks_root] [--out <path>]");
    console.log("Writes the dashboard page plus its data, stylesheet, and script with the same stem beside it.");
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
