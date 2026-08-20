import { afterEach, describe, expect, test } from 'bun:test'
import {
  beginSetupPerformanceRun,
  finishSetupPerformanceRun,
  recordSetupPerformancePhase,
  resetSetupPerformanceRunForTests
} from '~/cli/commands/setup-and-utilities/setup/setup-performance'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tempDirs = createTempDirTracker('autoshow-setup-performance-')
const makeTempDir = tempDirs.make

afterEach(async () => {
  resetSetupPerformanceRunForTests()
  await tempDirs.cleanup()
})

describe('setup performance artifact', () => {
  test('records structured phases, actual compile overlap, environment facts, and no local paths', async () => {
    const artifactDirectory = await makeTempDir()
    beginSetupPerformanceRun({
      topology: 'ungated-build-baseline-v1',
      dependencyVersions: { mupdf: '1.27.2', qpdf: '12.3.2' },
      artifactDirectory
    })

    await recordSetupPerformancePhase('mupdf', 'archive-preparation', async () => {}, { sourceCached: false })
    await Promise.all([
      recordSetupPerformancePhase('mupdf', 'compile-link', async () => { await Bun.sleep(8) }, { parallelJobs: 8 }),
      recordSetupPerformancePhase('qpdf', 'compile-link', async () => { await Bun.sleep(8) }, { parallelJobs: 8 })
    ])

    const result = await finishSetupPerformanceRun({
      healthy: true,
      stepTimings: [{ label: 'document tools', durationMs: 42, ok: true }]
    })

    expect(result).toBeDefined()
    expect(result!.artifact.schemaVersion).toBe(1)
    expect(result!.artifact.environment.logicalCpuCount).toBeGreaterThan(0)
    expect(result!.artifact.environment.dependencyVersions['qpdf']).toBe('12.3.2')
    expect(result!.artifact.phases.map(({ phase }) => phase)).toEqual([
      'archive-preparation',
      'compile-link',
      'compile-link'
    ])
    expect(result!.artifact.compileOverlaps).toHaveLength(1)
    expect(result!.artifact.compileOverlaps[0]!.overlapMs).toBeGreaterThan(0)
    expect(await Bun.file(result!.artifactPath).exists()).toBe(true)

    const serialized = await Bun.file(result!.artifactPath).text()
    const homePath = process.env['HOME']
    if (homePath) expect(serialized).not.toContain(homePath)
    expect(serialized).not.toContain('https://')
  })
})
