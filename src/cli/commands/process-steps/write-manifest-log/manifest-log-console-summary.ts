import type { WriteManifestMetadata, WriteManifestSourceRefs, WriteManifestSummary } from '~/types'
import { buildOcrCostCalculation } from './manifest-log-ocr-cost'
import { buildHostedOcrSchedulerSummary } from './manifest-log-hosted-ocr-scheduler'
import { buildPromptUsage } from './manifest-log-prompt-usage'
import { buildRunSummary } from './manifest-log-run-summary'

export const buildWriteManifestSummary = (
  metadata: WriteManifestMetadata,
  refs: WriteManifestSourceRefs = {}
): WriteManifestSummary => {
  const runSummary = buildRunSummary(metadata)
  const promptUsage = buildPromptUsage(metadata, refs)
  const ocrCostCalculation = buildOcrCostCalculation(metadata)
  const hostedOcrScheduler = buildHostedOcrSchedulerSummary(metadata)

  return {
    ...(runSummary ? { runSummary } : {}),
    ...(promptUsage ? { promptUsage } : {}),
    ...(ocrCostCalculation ? { ocrCostCalculation } : {}),
    ...(hostedOcrScheduler ? { hostedOcrScheduler } : {})
  }
}
