import { readFileSync } from "node:fs"
import type { MetricFixtureProvider, MetricFixtures, PaidFailurePolicy, VoiceQualityReportMode } from '~/types'
import { InfraError } from '~/utils/error-handler'

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function strictPaidFailures(mode: VoiceQualityReportMode, allowPaid: boolean): boolean {
  return mode === "full" && allowPaid;
}

export function recordPaidFailure(
  policy: PaidFailurePolicy,
  subsystem: string,
  error: unknown,
): void {
  const message = errorMessage(error);
  if (policy.strict) {
    throw InfraError(`${policy.providerKey}: ${subsystem} failed: ${message}`, { stage: 'tts:voice-quality' });
  }
  policy.warnings.push(`${subsystem} failed: ${message}`);
}

export function paidSttSubsystemLabel(service: string): string {
  if (service === "assemblyai") return "AssemblyAI roundtrip STT";
  return `${service} roundtrip STT`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function fixtureForProvider(
  fixtures: MetricFixtures | null,
  providerKey: string,
  audioFileName: string,
): MetricFixtureProvider | null {
  const providers = fixtures?.providers;
  if (!providers) return null;
  return providers[providerKey] ?? providers[audioFileName] ?? null;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle];
  if (middleValue === undefined) return null;
  if (sorted.length % 2 === 1) return middleValue;
  const previousValue = sorted[middle - 1];
  return previousValue === undefined ? middleValue : (previousValue + middleValue) / 2;
}

export function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((percentileValue / 100) * (sorted.length - 1))));
  return sorted[index] ?? null;
}

export function amplitudeToDbfs(amplitude: number): number {
  return 20 * Math.log10(Math.max(amplitude, 1e-9));
}

export async function runProcess(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}
