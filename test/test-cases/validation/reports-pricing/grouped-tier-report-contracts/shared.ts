import { afterEach, expect } from 'bun:test'

import { writeFile } from 'node:fs/promises'

import type { MetricName, MetricRankingEntry, RankingSurfaceName, TtsRankingEntry } from '~/types'
import { createTempDirTracker } from '../../../../test-utils/temp-dirs'
import { readBunSpawnStreamText as readStreamText } from '../../../../test-utils/stream-text'

export { readStreamText }

export const setupTempRoots = (): ((prefix: string) => Promise<string>) => {
  const tracker = createTempDirTracker('autoshow-grouped-tier-')
  afterEach(tracker.cleanup)
  return tracker.make
}

export const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

export const runConsensusBuildReport = async (
  category: 'ocr' | 'stt' | 'text' | 'tts' | 'url',
  runDir: string,
  extraArgs: string[] = []
): Promise<{ stdout: string, stderr: string }> => {
  const proc = Bun.spawn([
    process.execPath,
    '.codex/skills/consensus/scripts/run.ts',
    category,
    'build-report',
    runDir,
    ...extraArgs
  ], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout),
    readStreamText(proc.stderr),
    proc.exited
  ])
  expect(stdout).toContain('Rewrote')
  expect(exitCode).toBe(0)
  return { stdout, stderr }
}

export const expectRankingSurfaces = (report: {
  rankingSurfaces: Record<'local' | 'service', Record<'fastest' | 'cheapest' | 'highestQuality', unknown[]>>
}): void => {
  for (const group of ['local', 'service'] as const) {
    for (const surface of ['fastest', 'cheapest', 'highestQuality'] as const) {
      expect(Array.isArray(report.rankingSurfaces[group][surface])).toBe(true)
    }
  }
}

export const expectMetricRankings = <GroupName extends string>(
  rankings: Record<GroupName, Record<MetricName, MetricRankingEntry[]>>,
  groups: readonly GroupName[]
): void => {
  for (const group of groups) {
    for (const metric of ['price', 'speed', 'qualityScore'] as const) {
      expect(Array.isArray(rankings[group][metric])).toBe(true)
      expect(rankings[group][metric].every((entry, index) => entry.rank === index + 1 && entry.metric === metric)).toBe(true)
    }
  }
}

export const expectTtsRankingSurfaces = (report: {
  rankingSurfaces: Record<'local' | 'service', Record<RankingSurfaceName, TtsRankingEntry[]>>
}): void => {
  expectRankingSurfaces(report)
  for (const group of ['local', 'service'] as const) {
    for (const surface of ['price', 'speed', 'automatedQuality', 'humanQuality'] as const) {
      expect(Array.isArray(report.rankingSurfaces[group][surface])).toBe(true)
    }
  }
}
