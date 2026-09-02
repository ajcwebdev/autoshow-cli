import type { ComicImageRunStop, ComicImageWorkItemResult, ImageRunStats, PageQaEntry } from '~/types'
import { AppProviderError, InfraError, ValidationError } from '~/utils/error-handler'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { comicLog } from '../../comic-utils/comic-logger'
import { writePageQaReports } from './comic-page-qa'

export const isComicProviderError = (error: unknown): boolean => {
  if (error instanceof AppProviderError) return true
  for (let cause: unknown = error; cause instanceof Error; cause = (cause as { cause?: unknown }).cause) {
    if (cause instanceof AppProviderError) return true
  }
  return false
}

export const runComicImageWorkItems = async <TItem>(input: {
  concurrency: number
  items: readonly TItem[]
  render: (item: TItem) => Promise<ComicImageWorkItemResult>
  stats: ImageRunStats
  qaEnabled: boolean
  qaHardFailure?: { message: (count: number) => string, stage: string } | undefined
  itemFailure: { message: (count: number) => string, stage: string }
  stopOnProviderError?: boolean | undefined
  describeItem?: ((item: TItem) => string) | undefined
  onStop?: ((stop: ComicImageRunStop) => void) | undefined
}): Promise<ImageRunStats> => {
  let stop: { item: string; reason: string } | undefined
  let abandoned = 0
  const render = input.stopOnProviderError !== true
    ? input.render
    : async (item: TItem): Promise<ComicImageWorkItemResult> => {
        if (stop) {
          abandoned += 1
          return { stats: createImageRunStats(), qaEntries: [] }
        }
        const result = await input.render(item)
        if (result.error && !stop && isComicProviderError(result.error)) {
          stop = {
            item: input.describeItem?.(item) ?? String(item),
            reason: result.error instanceof Error ? result.error.message : String(result.error),
          }
        }
        return result
      }
  const results = await mapWithConcurrency(input.concurrency, [...input.items], render)

  const qaEntriesByDirectory = new Map<string, PageQaEntry[]>()
  let errorCount = 0

  for (const result of results) {
    if (result.error) errorCount++
    input.stats.imagesGenerated += result.stats.imagesGenerated
    input.stats.imagesSkipped += result.stats.imagesSkipped
    input.stats.totalDurationMs += result.stats.totalDurationMs
    input.stats.totalInputTokens += result.stats.totalInputTokens
    input.stats.totalInputTextTokens += result.stats.totalInputTextTokens
    input.stats.totalInputImageTokens += result.stats.totalInputImageTokens
    input.stats.totalInputUnattributedTokens += result.stats.totalInputUnattributedTokens
    input.stats.totalOutputTokens += result.stats.totalOutputTokens
    input.stats.totalOutputTextTokens += result.stats.totalOutputTextTokens
    input.stats.totalOutputImageTokens += result.stats.totalOutputImageTokens
    input.stats.totalOutputUnattributedTokens += result.stats.totalOutputUnattributedTokens
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
        throw ValidationError(input.qaHardFailure.message(hardFailures.length), { stage: input.qaHardFailure.stage, metadata: { imageRunStats: input.stats } })
      }
    }
  }

  if (stop) {
    const record: ComicImageRunStop = { ...stop, abandoned }
    comicLog.line(`  run summary stopped=${record.item} reason=${record.reason} abandoned=${record.abandoned}`)
    input.onStop?.(record)
    throw InfraError(`${input.itemFailure.message(errorCount)}; stopped=${record.item} reason=${record.reason} abandoned=${record.abandoned}`, { stage: input.itemFailure.stage, metadata: { imageRunStats: input.stats } })
  }

  if (errorCount > 0) {
    throw InfraError(input.itemFailure.message(errorCount), { stage: input.itemFailure.stage, metadata: { imageRunStats: input.stats } })
  }

  return input.stats
}
