import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { collectLegacySurfaceViolations, normalizeLegacyScanContent, shouldScanLegacySurfacePath } from './legacy-surface-scanner'

const root = '/repo'
const retiredFilename = ['run', 'json'].join('.')
const retiredToken = ['Run', 'Manifest'].join('')
const retiredResumeField = ['raw', 'Entry'].join('')

describe('legacy persistence surface scanner', () => {
  test('reports deterministic filename, basename, token, and line-number violations', () => {
    const content = `safe\n${retiredFilename}\n${retiredToken}\n`
    expect(collectLegacySurfaceViolations(join(root, 'src', retiredFilename), content, root)).toEqual([
      `src/${retiredFilename}:1 references ${retiredFilename}`,
      `src/${retiredFilename} uses the retired control filename ${retiredFilename}`,
      `src/${retiredFilename}:3 references ${retiredToken}`,
    ])
  })

  test('uses token boundaries and scans the retired record field only in resume surfaces', () => {
    const content = `prefix${retiredToken}suffix\n${retiredResumeField}\n`
    expect(collectLegacySurfaceViolations(join(root, 'src', 'other.ts'), content, root)).toEqual([])
    expect(collectLegacySurfaceViolations(join(root, 'src', 'commands/setup-and-utilities/resume', 'read.ts'), content, root)).toEqual([
      `src/commands/setup-and-utilities/resume/read.ts:2 references ${retiredResumeField}`,
    ])
  })

  test('normalization strips active-run markers and the unsupported-source fixture exception', () => {
    const activeMarker = ['.active-run', 'json'].join('.')
    expect(normalizeLegacyScanContent(join(root, 'src', 'other.ts'), activeMarker, root)).toBe('')
    const fixture = join(root, 'test/test-cases/validation/cli/cli-usage-errors/tts-usage.test.ts')
    expect(normalizeLegacyScanContent(fixture, ['source', 'json'].join('.'), root)).toBe('')
  })

  test('report and owning-contract paths are excluded from the active tree scan', () => {
    const reportPath = join(root, 'docs/reports/old.md')
    const contractPath = join(root, 'test/legacy-contract.test.ts')
    expect(shouldScanLegacySurfacePath(reportPath, root, contractPath)).toBe(false)
    expect(shouldScanLegacySurfacePath(contractPath, root, contractPath)).toBe(false)
    expect(shouldScanLegacySurfacePath(join(root, 'src/current.ts'), root, contractPath)).toBe(true)
  })
})
