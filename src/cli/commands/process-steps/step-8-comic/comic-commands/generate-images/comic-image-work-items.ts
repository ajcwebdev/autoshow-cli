import type { ComicImageWorkItemResult, ImageRunStats, PageQaEntry } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { writePageQaReports } from './comic-page-qa'

/**
 * Runs one comic image work list concurrently, folds each item's counters into the run
 * totals, groups QA entries by output directory, and writes one QA report per directory.
 * A failed item is counted rather than thrown so the whole list still finishes and its
 * artifacts and QA reports are preserved before the run is reported as failed.
 */
export const runComicImageWorkItems = async <TItem>(input: {
  concurrency: number
  items: readonly TItem[]
  render: (item: TItem) => Promise<ComicImageWorkItemResult>
  stats: ImageRunStats
  qaEnabled: boolean
  /** Page generation treats a QA hard failure as a run failure; panel generation does not. */
  qaHardFailure?: { message: (count: number) => string, stage: string } | undefined
  itemFailure: { message: (count: number) => string, stage: string }
}): Promise<ImageRunStats> => {
  const results = await mapWithConcurrency(input.concurrency, [...input.items], input.render)

  const qaEntriesByDirectory = new Map<string, PageQaEntry[]>()
  let errorCount = 0

  for (const result of results) {
    if (result.error) errorCount++
    input.stats.imagesGenerated += result.stats.imagesGenerated
    input.stats.imagesSkipped += result.stats.imagesSkipped
    input.stats.totalDurationMs += result.stats.totalDurationMs
    input.stats.totalInputTokens += result.stats.totalInputTokens
    input.stats.totalOutputTokens += result.stats.totalOutputTokens
    input.stats.totalCost += result.stats.totalCost
    for (const { directory, entry } of result.qaEntries) {
      const entries = qaEntriesByDirectory.get(directory) ?? []
      entries.push(entry)
      qaEntriesByDirectory.set(directory, entries)
    }
  }

  if (input.qaEnabled) {
    for (const [directory, entries] of qaEntriesByDirectory) {
      await writePageQaReports(directory, entries)
    }
    if (input.qaHardFailure) {
      const hardFailures = [...qaEntriesByDirectory.values()].flat().filter(entry => entry.hardFailure)
      if (hardFailures.length > 0) {
        throw ValidationError(input.qaHardFailure.message(hardFailures.length), { stage: input.qaHardFailure.stage })
      }
    }
  }

  if (errorCount > 0) {
    throw InfraError(input.itemFailure.message(errorCount), { stage: input.itemFailure.stage })
  }

  return input.stats
}
