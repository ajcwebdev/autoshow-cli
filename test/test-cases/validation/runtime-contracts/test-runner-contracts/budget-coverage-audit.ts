import type { E2eTestSource, PriceSelectionEntry } from '~/types'
import { selectorMatchesFile } from '../../../../test-runner/price-commands/helpers'

export type BudgetSelectorIndex = Readonly<{
  budgetSkippableKeys: ReadonlySet<string>
  selectedKeysByFile: ReadonlyMap<string, ReadonlySet<string>>
}>

export type BudgetCoverageAudit = Readonly<{
  missing: string[]
  unselected: string[]
  uninspectable: string[]
}>

type BudgetSourceInspection = Readonly<{ keys: string[], issues: string[] }>
type BudgetSourceInspector = (file: string, source: string) => BudgetSourceInspection

export const indexBudgetSkippableSelectors = (
  allFiles: readonly string[],
  registry: readonly PriceSelectionEntry[]
): BudgetSelectorIndex => {
  const budgetSkippableEntries = registry.filter(entry => entry.budgetSkippable)
  const selectedKeysByFile = new Map(allFiles.map(file => [
    file,
    new Set(budgetSkippableEntries.filter(entry => selectorMatchesFile(entry, file)).map(entry => entry.key))
  ]))

  return {
    budgetSkippableKeys: new Set(budgetSkippableEntries.map(entry => entry.key)),
    selectedKeysByFile,
  }
}

const auditSourceKeys = (
  file: string,
  keys: readonly string[],
  index: BudgetSelectorIndex
): Pick<BudgetCoverageAudit, 'missing' | 'unselected'> => {
  const missing: string[] = []
  const unselected: string[] = []
  const selectedKeys = index.selectedKeysByFile.get(file) ?? new Set()

  for (const key of new Set(keys)) {
    if (!index.budgetSkippableKeys.has(key)) {
      missing.push(`${file}: ${key}`)
    } else if (!selectedKeys.has(key)) {
      unselected.push(`${file}: ${key}`)
    }
  }

  return { missing, unselected }
}

export const auditBudgetKeyCoverage = (
  sources: readonly E2eTestSource[],
  index: BudgetSelectorIndex,
  inspect: BudgetSourceInspector
): BudgetCoverageAudit => sources.reduce<BudgetCoverageAudit>((audit, { file, source }) => {
  const inspection = inspect(file, source)
  const keyAudit = auditSourceKeys(file, inspection.keys, index)
  audit.missing.push(...keyAudit.missing)
  audit.unselected.push(...keyAudit.unselected)
  audit.uninspectable.push(...inspection.issues)
  return audit
}, { missing: [], unselected: [], uninspectable: [] })
