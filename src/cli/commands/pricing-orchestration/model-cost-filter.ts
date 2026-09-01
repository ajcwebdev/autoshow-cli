import type { AggregatedPriceEstimate, StepEstimate } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { UsageError } from '~/utils/error-handler'

export type ModelCostFilterOptions = {
  maxModelCents?: number | undefined
  modelCostFilterExcludedTargetKeys?: string[] | undefined
}

type ModelCostTarget = Pick<StepEstimate, 'step' | 'provider' | 'model'>

type ModelCostTotal = ModelCostTarget & {
  totalCost: number
}

export const getModelCostTargetKey = (
  step: StepEstimate['step'],
  provider: string,
  model: string
): string => `${step}\u0000${provider}\u0000${model}`

const getStepKey = (step: ModelCostTarget): string => step.step

const getExcludedKeys = (options: object): ReadonlySet<string> =>
  new Set((options as ModelCostFilterOptions).modelCostFilterExcludedTargetKeys ?? [])

export const hasModelCostFilterPlan = (options: object): boolean =>
  Array.isArray((options as ModelCostFilterOptions).modelCostFilterExcludedTargetKeys)

export const isModelCostTargetIncluded = (
  options: object,
  step: StepEstimate['step'],
  provider: string,
  model: string
): boolean => !getExcludedKeys(options).has(getModelCostTargetKey(step, provider, model))

export const filterModelCostTargets = <T extends { service: string, model: string }>(
  targets: readonly T[],
  options: object,
  step: StepEstimate['step']
): T[] => targets.filter((target) =>
  isModelCostTargetIncluded(options, step, target.service, target.model)
)

export const filterModelCostEstimateSteps = (
  steps: readonly StepEstimate[],
  options: object
): StepEstimate[] => steps.filter((step) =>
  isModelCostTargetIncluded(options, step.step, step.provider, step.model)
)

const collectModelCostTotals = (
  estimates: readonly AggregatedPriceEstimate[]
): ModelCostTotal[] => {
  const totals = new Map<string, ModelCostTotal>()
  for (const estimate of estimates) {
    for (const step of estimate.steps) {
      const key = getModelCostTargetKey(step.step, step.provider, step.model)
      const existing = totals.get(key)
      if (existing) {
        existing.totalCost += step.totalCost
      } else {
        totals.set(key, {
          step: step.step,
          provider: step.provider,
          model: step.model,
          totalCost: step.totalCost
        })
      }
    }
  }
  return [...totals.values()]
}

const formatCents = (value: number): string => `${value.toFixed(3)}\u00a2`

export const configureModelCostFilter = (
  options: ModelCostFilterOptions,
  estimates: readonly AggregatedPriceEstimate[]
): ModelCostTotal[] => {
  const maxModelCents = options.maxModelCents
  if (maxModelCents === undefined) return []

  const totals = collectModelCostTotals(estimates)
  const excluded = totals.filter((target) => target.totalCost > maxModelCents)
  const included = totals.filter((target) => target.totalCost <= maxModelCents)

  for (const step of new Set(totals.map(getStepKey))) {
    if (totals.some((target) => target.step === step) && !included.some((target) => target.step === step)) {
      throw UsageError(
        `--max-model-cents ${maxModelCents} excludes every ${step} provider/model target for this invocation. Raise the ceiling or select a cheaper model.`
      )
    }
  }

  const existingExcludedKeys = new Set(options.modelCostFilterExcludedTargetKeys ?? [])
  const newlyExcluded = excluded.filter((target) =>
    !existingExcludedKeys.has(getModelCostTargetKey(target.step, target.provider, target.model))
  )
  for (const target of newlyExcluded) {
    existingExcludedKeys.add(getModelCostTargetKey(target.step, target.provider, target.model))
  }
  options.modelCostFilterExcludedTargetKeys = [...existingExcludedKeys]

  if (newlyExcluded.length > 0) {
    l.write('info', `Excluded ${newlyExcluded.length} provider/model target${newlyExcluded.length === 1 ? '' : 's'} over ${formatCents(maxModelCents)}: ${newlyExcluded.map((target) => `${target.provider}/${target.model} (${formatCents(target.totalCost)})`).join(', ')}`, {
      category: 'pricing',
      metadata: {
        maxModelCents,
        includedCount: included.length,
        excluded: newlyExcluded.map((target) => ({
          step: target.step,
          provider: target.provider,
          model: target.model,
          estimatedCostCents: target.totalCost
        }))
      }
    })
  }

  return newlyExcluded
}
