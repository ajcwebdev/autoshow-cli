import { DEFAULT_COST_MULTIPLIER, DEFAULT_STT_MS_PER_SECOND } from './defaults'
import { getModelRegistry, getRegistryServiceType } from './registry'
import type { DurationBilledEstimation, SttBilling, SttLimits } from '~/types'

export const getSttCost = (
  service: string,
  model: string
): { costPerHourCents?: number, costPerThreeHoursCents?: number } => {
  const sttModel = getModelRegistry().stt[service]?.models[model]
  if (!sttModel) return {}
  return {
    ...(sttModel.costPerHourCents !== undefined
      ? { costPerHourCents: sttModel.costPerHourCents }
      : sttModel.costPerHourUSD !== undefined
        ? { costPerHourCents: sttModel.costPerHourUSD * 100 }
        : {}),
    ...(sttModel.costPerThreeHours !== undefined ? { costPerThreeHoursCents: sttModel.costPerThreeHours * 100 } : {})
  }
}

export const getSttBilling = (service: string, model: string): SttBilling => {
  const billing = getModelRegistry().stt[service]?.models[model]?.billing
  return {
    ...(billing?.roundingIncrementSeconds !== undefined
      ? { roundingIncrementSeconds: billing.roundingIncrementSeconds }
      : {}),
    ...(billing?.minimumSeconds !== undefined
      ? { minimumSeconds: billing.minimumSeconds }
      : {})
  }
}

export const getSttLimits = (service: string, model: string): SttLimits => {
  const limits = getModelRegistry().stt[service]?.models[model]?.limits
  const effectiveBytes = limits?.effectiveBytes ?? limits?.directUploadBytes ?? limits?.remoteUrlBytes

  return {
    ...(effectiveBytes !== undefined ? { effectiveBytes } : {}),
    ...(limits?.directUploadBytes !== undefined ? { directUploadBytes: limits.directUploadBytes } : {}),
    ...(limits?.remoteUrlBytes !== undefined ? { remoteUrlBytes: limits.remoteUrlBytes } : {}),
    ...(limits?.durationSeconds !== undefined ? { durationSeconds: limits.durationSeconds } : {}),
    ...(limits?.requestBudgetSeconds !== undefined ? { requestBudgetSeconds: limits.requestBudgetSeconds } : {}),
    ...(limits?.notes !== undefined ? { notes: limits.notes } : {})
  }
}

export const getSttEstimation = (service: string, model: string): DurationBilledEstimation => {
  const serviceType = getRegistryServiceType('stt', service) ?? 'api'
  const modelMeta = getModelRegistry().stt[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_STT_MS_PER_SECOND[serviceType],
  }
}
