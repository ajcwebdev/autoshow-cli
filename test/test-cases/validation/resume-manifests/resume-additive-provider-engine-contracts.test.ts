import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { PIPELINE_MANIFEST_FILE, writePipelineItemRecords } from '~/cli/commands/process-steps/pipeline-manifest'
import { hasResumableProviderTargetWork, runProviderResumePass } from '~/cli/commands/setup-and-utilities/resume/provider-batch-resume'
import { resolveAdditiveResumeProviderSelection } from '~/cli/commands/setup-and-utilities/resume/resume-provider-selection'
import type { ProviderIdentity, ResolvedFlagOptions, ResumeTarget } from '~/types'
import { readCanonicalManifest, readCanonicalRecord, writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { fakeProviderResumeConfig } from './resume-additive-provider-fixture'

describe('additive resume provider selection', () => {
  test('shared resolver preserves stored order and appends new selected providers', () => {
    const openai = { service: 'openai', model: 'gpt-image-2' }
    const gemini = { service: 'gemini', model: 'gemini-3.1-flash-lite-image' }
    const runway = { service: 'runway', model: 'gen4.5' }

    const resolved = resolveAdditiveResumeProviderSelection({
      storedProviders: [openai, gemini],
      runnableStoredProviders: [gemini],
      selectedProviders: [runway, openai, gemini],
      successfulProviderKeys: new Set([getGenerationTargetKey(openai.service, openai.model)])
    })

    expect(resolved.requestedProviders).toEqual([openai, gemini, runway])
    expect(resolved.providersToRun).toEqual([runway, gemini])
    expect(resolved.skippedSuccessfulProviders).toEqual([openai])
  })

  test('generic provider batch engine resumes single and batch targets in place', async () => {
    await withTempDir('autoshow-provider-resume-engine-', async (dir) => {
      const singleDir = join(dir, 'single')
      const batchDir = join(dir, 'batch')
      const completeDir = join(batchDir, 'complete')
      const incompleteDir = join(batchDir, 'incomplete')
      await Promise.all([
        mkdir(singleDir, { recursive: true }),
        mkdir(batchDir, { recursive: true }),
        mkdir(completeDir, { recursive: true }),
        mkdir(incompleteDir, { recursive: true })
      ])

      const alpha = { service: 'alpha', model: 'one' }
      const beta = { service: 'beta', model: 'two' }
      await writeSingleManifestFixture(singleDir, 'extract', {
        outputDir: singleDir,
        completionStatus: 'incomplete',
        requestedProviders: [alpha],
        missingProviders: [alpha]
      }, { extractRoute: 'document' })

      const singleRanTargets: ProviderIdentity[] = []
      const singleTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'single',
        dir: singleDir,
        manifestPath: join(singleDir, PIPELINE_MANIFEST_FILE)
      }
      await expect(hasResumableProviderTargetWork(
        singleTarget,
        fakeProviderResumeConfig(singleRanTargets)
      )).resolves.toBe(true)
      const singleResult = await runProviderResumePass(
        singleTarget,
        {} as ResolvedFlagOptions,
        fakeProviderResumeConfig(singleRanTargets)
      )
      const singleRecord = await readCanonicalRecord(singleDir)
      expect(singleResult).toMatchObject({ ok: 1, incomplete: 0, fail: 0, attemptedEntries: 1 })
      expect(singleRanTargets).toEqual([alpha])
      expect(singleRecord['completionStatus']).toBe('full')
      expect(singleRecord['outputDir']).toBe(singleDir)

      await writeSingleManifestFixture(completeDir, 'extract', {
        outputDir: completeDir,
        completionStatus: 'full',
        requestedProviders: [alpha],
        providerStates: [{
          ...alpha,
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1,
          metadata: {}
        }],
        missingProviders: []
      }, { extractRoute: 'document' })
      await writeSingleManifestFixture(incompleteDir, 'extract', {
        outputDir: incompleteDir,
        completionStatus: 'incomplete',
        requestedProviders: [beta],
        missingProviders: [beta]
      }, { extractRoute: 'document' })
      await writePipelineItemRecords(batchDir, 'extract', 'batch', [
        {
          outputDir: completeDir,
          completionStatus: 'full',
          requestedProviders: [alpha],
          providerStates: [{
            ...alpha,
            artifactDir: '.',
            status: 'succeeded',
            attempts: 1,
            metadata: {}
          }],
          missingProviders: []
        },
        {
          outputDir: incompleteDir,
          completionStatus: 'incomplete',
          requestedProviders: [beta],
          missingProviders: [beta]
        }
      ], { extractRoute: 'document' })

      const batchRanTargets: ProviderIdentity[] = []
      const batchTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'batch',
        dir: batchDir,
        manifestPath: join(batchDir, PIPELINE_MANIFEST_FILE)
      }
      const batchResult = await runProviderResumePass(
        batchTarget,
        {} as ResolvedFlagOptions,
        fakeProviderResumeConfig(batchRanTargets)
      )
      const batchManifest = await readCanonicalManifest(batchDir)
      expect(batchResult).toMatchObject({ ok: 2, incomplete: 0, fail: 0, attemptedEntries: 1 })
      expect(batchRanTargets).toEqual([beta])
      expect(batchManifest.items.map((entry) => entry.status)).toEqual(['full', 'full'])
    })
  })

  test('generic provider batch resume rejects a corrupt canonical item without rewriting it', async () => {
    await withTempDir('autoshow-provider-resume-corrupt-item-', async (dir) => {
      const manifestPath = join(dir, PIPELINE_MANIFEST_FILE)
      const now = new Date().toISOString()
      const original = `${JSON.stringify({
        command: 'extract',
        scope: 'batch',
        createdAt: now,
        updatedAt: now,
        items: ['corrupt-item']
      }, null, 2)}\n`
      await Bun.write(manifestPath, original)
      const ranTargets: ProviderIdentity[] = []

      await expect(runProviderResumePass({
        kind: 'extract',
        extractRoute: 'document',
        scope: 'batch',
        dir,
        manifestPath
      }, {} as ResolvedFlagOptions, fakeProviderResumeConfig(ranTargets))).rejects.toThrow(
        `Invalid canonical manifest at ${manifestPath}`
      )
      expect(ranTargets).toEqual([])
      expect(await Bun.file(manifestPath).text()).toBe(original)
    })
  })
})
