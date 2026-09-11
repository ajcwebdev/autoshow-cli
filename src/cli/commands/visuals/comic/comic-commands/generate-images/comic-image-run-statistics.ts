import type { ImageRunStats } from '~/types'
import { isAppError } from '~/utils/error-handler'

export const mergeImageStats = (target: ImageRunStats, source: ImageRunStats | void): void => {
  if (!source) return

  target.imagesGenerated += source.imagesGenerated
  target.imagesSkipped += source.imagesSkipped
  target.totalInputTokens += source.totalInputTokens
  target.totalInputTextTokens += source.totalInputTextTokens
  target.totalInputImageTokens += source.totalInputImageTokens
  target.totalInputUnattributedTokens += source.totalInputUnattributedTokens
  target.totalOutputTokens += source.totalOutputTokens
  target.totalOutputTextTokens += source.totalOutputTextTokens
  target.totalOutputImageTokens += source.totalOutputImageTokens
  target.totalOutputUnattributedTokens += source.totalOutputUnattributedTokens
  target.totalCost += source.totalCost
  target.totalDurationMs += source.totalDurationMs
}

export const failedImageRunStatsFromError = (error: unknown): ImageRunStats | undefined => {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current)
    if (isAppError(current)) {
      const stats = current.metadata['imageRunStats']
      if (stats && typeof stats === 'object' && !Array.isArray(stats) && typeof (stats as Record<string, unknown>)['imagesGenerated'] === 'number') return stats as ImageRunStats
      current = current.cause
    } else {
      current = (current as Error & { cause?: unknown }).cause
    }
  }
  return undefined
}
