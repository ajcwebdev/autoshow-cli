import type { ComicImageRunStop, ComicImageWorkItemResult, ImageRunStats } from '~/types'
import { AppProviderError, InfraError } from '~/utils/error-handler'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { comicLog } from '../../comic-utils/comic-logger'
import { mergeImageStats } from './comic-image-run-statistics'

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
          return { stats: createImageRunStats() }
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

  let errorCount = 0
  for (const result of results) {
    if (result.error) errorCount++
    mergeImageStats(input.stats, result.stats)
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
