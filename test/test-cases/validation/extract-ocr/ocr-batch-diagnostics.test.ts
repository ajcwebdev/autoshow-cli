import { describe, expect, test } from 'bun:test'
import { createManifest, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { deriveOcrBatchDiagnostics, OCR_BATCH_DIAGNOSTICS_FILE, writeOcrBatchDiagnostics } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-batch-diagnostics'
import type { PipelineManifestItem, PipelineProviderState } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'

const costMetadata = (
  provider: string,
  model: string,
  estimatedCost: number,
  actualCost: number | undefined,
  costSource = 'provider_usage'
) => ({
  cost: {
    estimated: {
      totalCost: estimatedCost,
      steps: [{ step: 'extract', provider, model, cost: estimatedCost }]
    },
    actual: {
      totalCost: actualCost ?? 0,
      steps: actualCost === undefined
        ? []
        : [{ step: 'extract', provider, model, cost: actualCost, costSource }]
    }
  }
})

const providerState = (
  service: string,
  model: string,
  extras: Partial<PipelineProviderState> = {}
): PipelineProviderState => ({
  service,
  model,
  artifactDir: '.',
  status: 'succeeded',
  attempts: 1,
  options: {},
  metadata: {
    promptTokens: 100,
    completionTokens: 50
  },
  ...extras
})

const item = (
  provider: PipelineProviderState,
  metadata: PipelineManifestItem['metadata'],
  status: PipelineManifestItem['status'] = 'full'
): PipelineManifestItem => ({
  status,
  metadata,
  providers: [provider]
})

describe('OCR batch diagnostics', () => {
  test('derives deterministic blocker, retry, partial-cost, unknown-cost, and drift rollups without raw diagnostics', () => {
    const blocker = (attempts: number): PipelineProviderState => providerState('kimi', 'kimi-k2.6', {
      status: 'failed',
      attempts,
      metadata: {},
      error: {
        message: 'account acct_live_secret has insufficient balance',
        category: 'rate_limit',
        failureKind: 'quota',
        retryable: false,
        blockedReason: 'insufficient_balance',
        status: 429,
        retryAfterMs: 250
      }
    })
    const manifest = createManifest('extract', 'batch', [
      item(blocker(2), costMetadata('kimi', 'kimi-k2.6', 1, undefined), 'incomplete'),
      item(blocker(1), costMetadata('kimi', 'kimi-k2.6', 1, undefined), 'incomplete'),
      item(providerState('gemini', 'gemini-3.1-pro-preview'), costMetadata('gemini', 'gemini-3.1-pro-preview', 1, 2, 'partial_provider_usage'), 'incomplete')
    ])

    const report = deriveOcrBatchDiagnostics(manifest, 'a'.repeat(64))
    expect(report?.triggers).toEqual([
      'repeated_blocker',
      'partial_provider_usage',
      'missing_actual_cost',
      'material_estimate_drift'
    ])
    expect(report?.targets).toEqual([
      expect.objectContaining({
        provider: 'gemini',
        model: 'gemini-3.1-pro-preview',
        affectedItems: 1,
        cost: expect.objectContaining({
          estimatedCostCents: 1,
          actualCostCents: 2,
          partialProviderCostCents: 2,
          partialProviderUsageItems: 1,
          unknownActualCostItems: 0,
          estimateErrorPercent: 100
        })
      }),
      expect.objectContaining({
        provider: 'kimi',
        model: 'kimi-k2.6',
        affectedItems: 2,
        attemptedItems: 2,
        blockers: [{ category: 'insufficient_balance', affectedItems: 2 }],
        retryPressure: {
          attempts: 3,
          retries: 1,
          rateLimitFailures: 2,
          retryAfterMs: 500
        },
        cost: expect.objectContaining({
          estimatedCostCents: 2,
          actualCostCents: 0,
          partialProviderCostCents: 0,
          unknownActualCostItems: 2
        })
      })
    ])
    expect(JSON.stringify(report)).not.toContain('acct_live_secret')
  })

  test('keeps clean batches quiet and removes a stale derived report when canonical state becomes clean', async () => {
    await withTempDir('autoshow-ocr-batch-diagnostics-', async (dir) => {
      const driftManifest = createManifest('extract', 'batch', [
        item(providerState('kimi', 'kimi-k2.6'), costMetadata('kimi', 'kimi-k2.6', 1, 2))
      ])
      const writtenDriftManifest = await writeManifest(dir, driftManifest)
      expect(await writeOcrBatchDiagnostics(dir)).toBeDefined()
      expect(await Bun.file(`${dir}/${OCR_BATCH_DIAGNOSTICS_FILE}`).exists()).toBe(true)

      const cleanManifest = {
        ...writtenDriftManifest,
        items: [item(providerState('kimi', 'kimi-k2.6'), costMetadata('kimi', 'kimi-k2.6', 1, 1))]
      }
      await writeManifest(dir, cleanManifest)
      expect(await writeOcrBatchDiagnostics(dir)).toBeUndefined()
      expect(await Bun.file(`${dir}/${OCR_BATCH_DIAGNOSTICS_FILE}`).exists()).toBe(false)
    })
  })

  test('treats token metadata without an actual cost row as unknown actual cost', () => {
    const manifest = createManifest('extract', 'batch', [
      item(providerState('kimi', 'kimi-k2.6'), costMetadata('kimi', 'kimi-k2.6', 1, undefined))
    ])

    const report = deriveOcrBatchDiagnostics(manifest, 'b'.repeat(64))
    expect(report?.triggers).toEqual(['missing_actual_cost'])
    expect(report?.targets[0]?.cost.unknownActualCostItems).toBe(1)
  })
})
