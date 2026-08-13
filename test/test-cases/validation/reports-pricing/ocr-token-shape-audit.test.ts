import { describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createManifest, createManifestItem, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { auditOcrTokenShapes } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/ocr-token-shape-audit'
import { withTempDir } from '../../../test-utils/temp-dirs'

const writeKimiRun = async (
  directory: string,
  promptTokens: number,
  completionTokens: number,
  effectiveReasoningEffort: 'disabled' | 'unspecified',
  status: 'full' | 'incomplete' = 'full'
): Promise<void> => {
  await mkdir(directory, { recursive: true })
  await writeManifest(directory, createManifest('extract', 'single', [
    createManifestItem(directory, {
      status,
      metadata: {},
      providers: [{
        service: 'kimi',
        model: 'kimi-k2.6',
        artifactDir: '.',
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: {
          extractionMethod: 'image+kimi-ocr',
          inputFamily: 'image',
          totalPages: 1,
          promptTokens,
          completionTokens,
          ...(effectiveReasoningEffort === 'unspecified' ? {} : { effectiveReasoningEffort })
        }
      }]
    })
  ]))
}

describe('OCR token-shape evidence audit', () => {
  test('promotes only a matching three-sample component with explicit reasoning policy', async () => {
    await withTempDir('autoshow-ocr-token-audit-', async (dir) => {
      const runs = [join(dir, 'run-a'), join(dir, 'run-b'), join(dir, 'run-c'), join(dir, 'run-incomplete')]
      await writeKimiRun(runs[0] as string, 1000, 500, 'disabled')
      await writeKimiRun(runs[1] as string, 1100, 510, 'disabled')
      await writeKimiRun(runs[2] as string, 1200, 520, 'disabled')
      await writeKimiRun(runs[3] as string, 900, 400, 'disabled', 'incomplete')

      const report = await auditOcrTokenShapes({
        runDirectories: runs,
        now: new Date('2026-08-13T12:00:00.000Z')
      })
      expect(report.sources).toEqual({
        explicitRunDirectoryCount: 4,
        canonicalManifestCount: 4,
        explicitProfileProvided: false
      })
      expect(report.excludedSamples.incomplete).toBe(1)
      expect(report.buckets).toHaveLength(1)
      expect(report.buckets[0]).toMatchObject({
        provider: 'kimi',
        model: 'kimi-k2.6',
        ocrMode: 'image',
        pageCountBand: '1',
        effectiveReasoningEffort: 'disabled',
        usageBasis: 'reported-prompt-completion',
        healthySampleCount: 3,
        promotionEligible: true,
        decision: 'promote-component-shape',
        prompt: {
          medianObservedTokensPerPage: 1100,
          medianAbsoluteDeviation: 100,
          direction: 'below-registry',
          consistentDirection: true,
          promotionEligible: true
        },
        completion: {
          direction: 'mixed-or-equal',
          promotionEligible: false
        }
      })
    })
  })

  test('reads a v1 aggregate profile only from an explicit path but does not promote it without individual reasoning-qualified evidence', async () => {
    await withTempDir('autoshow-ocr-token-audit-profile-', async (dir) => {
      const profilePath = join(dir, 'profiles.json')
      await writeFile(profilePath, JSON.stringify({
        version: 1,
        profiles: [{
          provider: 'kimi',
          model: 'kimi-k2.6',
          ocrMode: 'image',
          pageCountBand: '1',
          pageCount: 1,
          observedPromptTokens: 1000,
          observedCompletionTokens: 500,
          promptTokensPerPage: 1000,
          completionTokensPerPage: 500,
          estimatedPromptTokens: 4265,
          estimatedCompletionTokens: 516,
          promptTokenEstimateDelta: -3265,
          completionTokenEstimateDelta: -16,
          firstSeenAt: '2026-01-01T00:00:00.000Z',
          lastSeenAt: '2026-01-03T00:00:00.000Z',
          sampleCount: 3,
          sourceConfidence: 'healthy'
        }]
      }))

      const report = await auditOcrTokenShapes({ profilePath })
      expect(report.sources).toEqual({
        explicitRunDirectoryCount: 0,
        canonicalManifestCount: 0,
        explicitProfileProvided: true
      })
      expect(report.buckets[0]).toMatchObject({
        effectiveReasoningEffort: 'unspecified',
        healthySampleCount: 0,
        profileSampleCount: 3,
        promotionEligible: false,
        decision: 'insufficient-individual-evidence'
      })
    })
  })

  test('refuses an implicit home-directory scan', async () => {
    await expect(auditOcrTokenShapes({})).rejects.toThrow('requires at least one explicit run directory or an explicit token-profile path')
  })
})
