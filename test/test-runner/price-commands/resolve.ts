import type { PriceCommandSpec, ResolvePriceSelectionOptions } from '~/types'
import {
  formatSelectedPathsLabel,
  resolveSelectedFiles
} from '../path-selection'
import { dedupeResolvedCommands, selectorMatchesFile } from './helpers'
import { BUDGET_PRICE_SELECTION_REGISTRY } from './registry/index'

const resolveEntriesForSelectedFiles = (allFiles: string[], pathFilters: string[]) => {
  if (pathFilters.length === 0) {
    return BUDGET_PRICE_SELECTION_REGISTRY
  }

  const selectedFiles = resolveSelectedFiles(allFiles, pathFilters)
  return BUDGET_PRICE_SELECTION_REGISTRY.filter(entry => {
    return selectedFiles.some(file => selectorMatchesFile(entry, file))
  })
}

export const resolvePriceSelection = (
  allFiles: string[],
  pathFilters: string[],
  resolveOptions: ResolvePriceSelectionOptions = {}
): { suiteName: string, commands: PriceCommandSpec[] } => {
  const budgetSkippableOnly = resolveOptions.budgetSkippableOnly ?? false
  const matchingEntries = resolveEntriesForSelectedFiles(allFiles, pathFilters)

  const filteredEntries = budgetSkippableOnly
    ? matchingEntries.filter(entry => entry.budgetSkippable)
    : matchingEntries

  return {
    suiteName: pathFilters.length === 0
      ? 'All mapped tests'
      : formatSelectedPathsLabel(pathFilters),
    commands: dedupeResolvedCommands(filteredEntries),
  }
}
