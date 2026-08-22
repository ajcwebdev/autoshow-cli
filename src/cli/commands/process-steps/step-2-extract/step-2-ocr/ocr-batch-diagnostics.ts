import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE, readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import type { OcrBatchDiagnosticTarget, OcrBatchDiagnosticsReport, PipelineManifest, TargetAccumulator } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable, logLocationsTable } from '~/utils/app-logger/human-table/human-table'
import { isRecord } from '~/utils/rest-client'

export const OCR_BATCH_DIAGNOSTICS_FILE = 'ocr-batch-diagnostics.json'
const MATERIAL_ESTIMATE_ERROR_PERCENT = 20
const OCR_PROVIDER_SERVICES = new Set(['tesseract', 'mistral', 'glm', 'kimi', 'openai', 'grok', 'anthropic', 'gemini', 'deepinfra', 'replicate'])

const targetKey = (provider: string, model: string): string => `${provider}\u0000${model}`

const getAccumulator = (
  accumulators: Map<string, TargetAccumulator>,
  provider: string,
  model: string
): TargetAccumulator => {
  const key = targetKey(provider, model)
  const existing = accumulators.get(key)
  if (existing) return existing
  const created: TargetAccumulator = {
    provider,
    model,
    affectedItems: new Set(),
    attemptedItems: new Set(),
    blockerItems: new Map(),
    attempts: 0,
    retries: 0,
    rateLimitFailures: 0,
    retryAfterMs: 0,
    estimatedCostCents: 0,
    actualCostCents: 0,
    partialProviderCostCents: 0,
    partialProviderUsageItems: new Set(),
    unknownActualCostItems: new Set()
  }
  accumulators.set(key, created)
  return created
}

const normalizedBlockerCategory = (error: Record<string, unknown>): string => {
  const candidate = [error['blockedReason'], error['failureKind'], error['category']]
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  if (!candidate) return 'deterministic_provider_blocker'
  const normalized = candidate.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64)
  return normalized || 'deterministic_provider_blocker'
}

const costRows = (
  itemMetadata: Record<string, unknown>,
  kind: 'estimated' | 'actual'
): Array<Record<string, unknown>> => {
  const cost = isRecord(itemMetadata['cost']) ? itemMetadata['cost'] : undefined
  const breakdown = cost && isRecord(cost[kind]) ? cost[kind] : undefined
  return breakdown && Array.isArray(breakdown['steps'])
    ? breakdown['steps'].filter(isRecord)
    : []
}

const matchingCostRows = (
  rows: readonly Record<string, unknown>[],
  provider: string,
  model: string
): Array<Record<string, unknown>> => rows.filter((row) =>
  row['step'] === 'extract'
  && row['provider'] === provider
  && row['model'] === model
  && typeof row['cost'] === 'number'
)

const sumCost = (rows: readonly Record<string, unknown>[]): number =>
  rows.reduce((sum, row) => sum + (typeof row['cost'] === 'number' ? row['cost'] : 0), 0)

const toTarget = (accumulator: TargetAccumulator): OcrBatchDiagnosticTarget => {
  const estimateErrorPercent = accumulator.estimatedCostCents > 0 && accumulator.unknownActualCostItems.size === 0
    ? Math.abs(accumulator.actualCostCents - accumulator.estimatedCostCents) / accumulator.estimatedCostCents * 100
    : undefined
  return {
    provider: accumulator.provider,
    model: accumulator.model,
    affectedItems: accumulator.affectedItems.size,
    attemptedItems: accumulator.attemptedItems.size,
    blockers: [...accumulator.blockerItems.entries()]
      .map(([category, items]) => ({ category, affectedItems: items.size }))
      .sort((left, right) => left.category.localeCompare(right.category)),
    retryPressure: {
      attempts: accumulator.attempts,
      retries: accumulator.retries,
      rateLimitFailures: accumulator.rateLimitFailures,
      retryAfterMs: accumulator.retryAfterMs
    },
    cost: {
      estimatedCostCents: accumulator.estimatedCostCents,
      actualCostCents: accumulator.actualCostCents,
      partialProviderCostCents: accumulator.partialProviderCostCents,
      partialProviderUsageItems: accumulator.partialProviderUsageItems.size,
      unknownActualCostItems: accumulator.unknownActualCostItems.size,
      ...(estimateErrorPercent !== undefined ? { estimateErrorPercent } : {})
    }
  }
}

export const deriveOcrBatchDiagnostics = (
  manifest: PipelineManifest,
  sourceManifestSha256: string
): OcrBatchDiagnosticsReport | undefined => {
  if (manifest.scope !== 'batch') return undefined
  const accumulators = new Map<string, TargetAccumulator>()

  manifest.items.forEach((item, itemIndex) => {
    const estimatedRows = costRows(item.metadata, 'estimated')
    const actualRows = costRows(item.metadata, 'actual')
    for (const providerState of item.providers) {
      if (!OCR_PROVIDER_SERVICES.has(providerState.service) || providerState.service === 'tesseract' || typeof providerState.model !== 'string') continue
      const accumulator = getAccumulator(accumulators, providerState.service, providerState.model)
      accumulator.affectedItems.add(itemIndex)
      const attempts = Math.max(0, Math.floor(providerState.attempts))
      const attempted = attempts > 0 || providerState.status === 'succeeded' || providerState.status === 'failed'
      if (attempted) accumulator.attemptedItems.add(itemIndex)
      accumulator.attempts += attempts
      accumulator.retries += Math.max(0, attempts - 1)

      const error = providerState.error
      if (error) {
        const rateLimited = error['status'] === 429 || error['category'] === 'rate_limit' || error['failureKind'] === 'rate_limit'
        if (rateLimited) accumulator.rateLimitFailures += 1
        if (typeof error['retryAfterMs'] === 'number' && error['retryAfterMs'] > 0) accumulator.retryAfterMs += error['retryAfterMs']
        if (error['retryable'] === false || typeof error['blockedReason'] === 'string') {
          const category = normalizedBlockerCategory(error)
          const items = accumulator.blockerItems.get(category) ?? new Set<number>()
          items.add(itemIndex)
          accumulator.blockerItems.set(category, items)
        }
      }

      const providerEstimatedRows = matchingCostRows(estimatedRows, providerState.service, providerState.model)
      const providerActualRows = matchingCostRows(actualRows, providerState.service, providerState.model)
      accumulator.estimatedCostCents += sumCost(providerEstimatedRows)
      accumulator.actualCostCents += sumCost(providerActualRows)
      accumulator.partialProviderCostCents += sumCost(providerActualRows.filter((row) => row['costSource'] === 'partial_provider_usage'))
      if (providerActualRows.some((row) => row['costSource'] === 'partial_provider_usage')) accumulator.partialProviderUsageItems.add(itemIndex)
      if (attempted && providerActualRows.length === 0) {
        accumulator.unknownActualCostItems.add(itemIndex)
      }
    }
  })

  const targets = [...accumulators.values()]
    .map(toTarget)
    .sort((left, right) => left.provider.localeCompare(right.provider) || left.model.localeCompare(right.model))
  const repeatedBlocker = targets.some((target) => target.blockers.some((blocker) => blocker.affectedItems > 1))
  const partialProviderUsage = targets.some((target) => target.cost.partialProviderUsageItems > 0)
  const missingActualCost = targets.some((target) => target.cost.unknownActualCostItems > 0)
  const materialEstimateDrift = targets.some((target) => (target.cost.estimateErrorPercent ?? 0) > MATERIAL_ESTIMATE_ERROR_PERCENT)
  const triggers = [
    ...(repeatedBlocker ? ['repeated_blocker' as const] : []),
    ...(partialProviderUsage ? ['partial_provider_usage' as const] : []),
    ...(missingActualCost ? ['missing_actual_cost' as const] : []),
    ...(materialEstimateDrift ? ['material_estimate_drift' as const] : [])
  ]
  if (triggers.length === 0) return undefined

  return {
    schemaVersion: 1,
    generatedAt: manifest.updatedAt,
    sourceManifest: {
      command: manifest.command,
      scope: manifest.scope,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
      sha256: sourceManifestSha256
    },
    thresholds: {
      materialEstimateErrorPercent: MATERIAL_ESTIMATE_ERROR_PERCENT
    },
    triggers,
    targets
  }
}

const diagnosticsTable = (report: OcrBatchDiagnosticsReport) => createHumanTable(
  report.targets.map((target) => ({
    target: `${target.provider}/${target.model}`,
    items: String(target.affectedItems),
    blockers: target.blockers.map((entry) => `${entry.category}:${entry.affectedItems}`).join(', '),
    retries: target.retryPressure.retries,
    estimatedCost: target.cost.estimatedCostCents.toFixed(4),
    actualCost: target.cost.actualCostCents.toFixed(4),
    partialCost: target.cost.partialProviderCostCents.toFixed(4),
    unknownActual: target.cost.unknownActualCostItems,
    estimateError: target.cost.estimateErrorPercent === undefined ? '' : `${target.cost.estimateErrorPercent.toFixed(1)}%`
  })),
  ['target', 'items', 'blockers', 'retries', 'estimatedCost', 'actualCost', 'partialCost', 'unknownActual', 'estimateError']
)

export const writeOcrBatchDiagnostics = async (
  batchDir: string
): Promise<OcrBatchDiagnosticsReport | undefined> => {
  const manifest = await readManifest(batchDir)
  if (!manifest || manifest.scope !== 'batch') return undefined
  const manifestBytes = await readFile(join(batchDir, PIPELINE_MANIFEST_FILE))
  const sha256 = new Bun.CryptoHasher('sha256').update(manifestBytes).digest('hex')
  const report = deriveOcrBatchDiagnostics(manifest, sha256)
  const outputPath = join(batchDir, OCR_BATCH_DIAGNOSTICS_FILE)
  if (!report) {
    await rm(outputPath, { force: true })
    return undefined
  }

  const temporaryPath = `${outputPath}.${crypto.randomUUID()}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`)
  await rename(temporaryPath, outputPath)
  l.write('warn', 'OCR batch diagnostics', {
    category: 'artifact',
    humanTable: diagnosticsTable(report),
    metadata: report
  })
  logLocationsTable(l, [{ artifact: 'ocrBatchDiagnostics', path: outputPath }])
  return report
}
