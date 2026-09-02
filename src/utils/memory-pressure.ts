import type { MemoryPressureCache, MemoryPressureLevel } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InternalError } from '~/utils/error-handler'

const reconstructibleCaches = new Map<string, MemoryPressureCache>()

export const registerMemoryPressureCache = (cache: MemoryPressureCache): (() => void) => {
  if (reconstructibleCaches.has(cache.name)) {
    throw InternalError(`Memory-pressure cache already registered: ${cache.name}`, { stage: 'runtime:memory-pressure' })
  }
  reconstructibleCaches.set(cache.name, cache)
  return () => {
    if (reconstructibleCaches.get(cache.name) === cache) reconstructibleCaches.delete(cache.name)
  }
}

const handleMemoryPressure = (level: MemoryPressureLevel): void => {
  let releasedCaches = 0
  let releasedEntries = 0
  let failedCaches = 0
  for (const cache of reconstructibleCaches.values()) {
    try {
      const eviction = cache.clear(level)
      if (!eviction.released) continue
      releasedCaches++
      releasedEntries += Math.max(0, eviction.entries)
    } catch {
      failedCaches++
    }
  }

  l.write('warn', 'Memory pressure cache eviction', {
    category: 'pipeline',
    metadata: {
      level,
      releasedCaches,
      releasedEntries,
      failedCaches
    }
  })
}

process.on('memoryPressure', handleMemoryPressure)
