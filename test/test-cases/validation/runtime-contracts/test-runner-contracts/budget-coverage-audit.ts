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

export type PriceRegistryConsistencyAudit = Readonly<{
  orphaned: string[]
  unpriced: string[]
  mismatched: string[]
}>

type InvocationInspector = (file: string, source: string) => Readonly<{ keys: string[], invocations?: readonly { key: string, args: readonly string[] }[] | undefined }>

// Tests that stream the hosted example audio are priced from the identical local copy, so pricing needs no download.
const PRICE_INPUT_PROXIES: ReadonlyMap<string, string> = new Map([
  ['https://ajc.pics/autoshow/examples/1-audio.mp3', 'input/examples/audio/1-audio.mp3'],
])

/**
 * Compares each registered test case with the price inventory: a budget-skippable price command
 * no test registers is orphaned, a test case without a price command is unpriced, and a price
 * command whose model or input differs from the test's actual invocation is mismatched.
 */
export const auditPriceRegistryConsistency = (
  sources: readonly E2eTestSource[],
  registry: readonly PriceSelectionEntry[],
  inspect: InvocationInspector
): PriceRegistryConsistencyAudit => {
  const audit = { orphaned: [] as string[], unpriced: [] as string[], mismatched: [] as string[] }
  for (const { file, source } of sources) {
    const inspection = inspect(file, source)
    const entries = registry.filter(entry => entry.selectorKind === 'file' && entry.selector === file)
    const testKeys = new Set(inspection.keys)
    for (const entry of entries) {
      if (entry.budgetSkippable && !testKeys.has(entry.key)) audit.orphaned.push(`${file}: ${entry.key}`)
    }
    for (const invocation of inspection.invocations ?? []) {
      const priced = entries.filter(entry => entry.key === invocation.key)
      if (priced.length === 0) {
        audit.unpriced.push(`${file}: ${invocation.key}`)
        continue
      }
      const expected = invocation.args.map(arg => PRICE_INPUT_PROXIES.get(arg) ?? arg).join(' ')
      for (const entry of priced) {
        const actual = entry.args.filter(arg => arg !== '--price').join(' ')
        if (actual !== expected) audit.mismatched.push(`${file}: ${invocation.key} prices "${actual}" but the test runs "${expected}"`)
      }
    }
  }
  return audit
}
