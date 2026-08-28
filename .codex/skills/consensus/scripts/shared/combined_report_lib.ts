import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CombinedRunRef {
  runName: string;
  runDir: string;
  reportPath: string;
  providerCount: number;
}

export function discoverCombinedRuns(rootDir: string, perRunReportFilename: string): CombinedRunRef[] {
  const runs: CombinedRunRef[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const reportPath = join(rootDir, entry.name, perRunReportFilename);
    if (!existsSync(reportPath)) {
      continue;
    }
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as { runName?: string; providerCount?: number };
    runs.push({
      runName: report.runName ?? entry.name,
      runDir: join(rootDir, entry.name),
      reportPath,
      providerCount: report.providerCount ?? 0,
    });
  }
  runs.sort((left, right) => left.runName.localeCompare(right.runName));
  return runs;
}
