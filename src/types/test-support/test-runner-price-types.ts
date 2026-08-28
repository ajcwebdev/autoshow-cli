import type { BudgetPreflightSummary, CommandResultBase, PriceCommandSpec } from '~/types'

export type ResolvePriceSelectionOptions = {
  budgetSkippableOnly?: boolean
}

export type PriceCommandObservation = {
  name: string
  key: string
  args: string[]
  exitCode: number
  durationMs: number
  costCents: number | null
  failureMessage: string | null
  budgetSkippable: boolean
}

export type PriceCommandKeySummary = {
  key: string
  budgetSkippable: boolean
  variantCount: number
  variantCostsCents: number[]
  failedVariantCount: number
  selectedCostCents: number | null
  overBudget: boolean
}

export type BudgetSkippedEntry = {
  key: string
  selectedCostCents: number
}

export type PriceCommandKeyedEntry = {
  key: string
}

export type GroupedPriceCommandEntries<T extends PriceCommandKeyedEntry> = {
  key: string
  variants: T[]
}

export type ExecutedPriceCommand = CommandResultBase & {
  commandText: string
  durationMs: number
  parsedCost: number | null
}

export type BudgetPreflightResult = {
  summary: BudgetPreflightSummary
  skipKeys: string[]
  evaluatedKeys: string[]
}

export type RunnerStreamLabel = 'STDOUT' | 'STDERR'

export type BudgetPreflightCacheFile = {
  version: number
  fingerprint: string
  entries: Array<{
    argvKey: string
    costCents: number
  }>
}

export type BudgetPreflightVariant = {
  entry: PriceCommandSpec
  groupIndex: number
  variantIndex: number
}

export type ExecutedBudgetPreflightVariant = BudgetPreflightVariant & {
  executed: ExecutedPriceCommand
  observation: PriceCommandObservation
}

export type HeadBudgetResult = {
  summary: BudgetPreflightSummary | undefined
  skipKeys: string[]
  evaluatedKeys: string[]
}
