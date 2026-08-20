import { unwrapCanonicalRecordValue } from './manifest-helpers'
import type { OutputMetadataSummary } from '~/types'
import { isObjectLike } from '~/utils/value-helpers'

const getFiniteNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const readCostTotal = (metadata: Record<string, unknown>, key: 'estimated' | 'actual'): number | null => {
  const cost = metadata['cost']
  if (!isObjectLike(cost)) return null

  const section = cost[key]
  if (!isObjectLike(section)) return null

  return getFiniteNumber(section['totalCost'])
}

const readActualProcessingTime = (metadata: Record<string, unknown>): number | null => {
  let total = 0
  let found = false

  const readEntryProcessingTime = (value: unknown): number => {
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + readEntryProcessingTime(item), 0)
    }

    if (!isObjectLike(value)) {
      return 0
    }

    const processingTime = getFiniteNumber(value['processingTime'])
    return processingTime ?? 0
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'cost' || key === 'timing') {
      continue
    }

    const processingTime = readEntryProcessingTime(value)
    if (processingTime <= 0) {
      continue
    }

    total += processingTime
    found = true
  }

  return found ? total : null
}

const readTimingTotal = (
  metadata: Record<string, unknown>,
  phase: 'estimated' | 'actual'
): number | null => {
  const timing = metadata['timing']
  if (!isObjectLike(timing)) return null

  const section = timing[phase]
  if (!isObjectLike(section)) return null

  return getFiniteNumber(section['totalProcessingTimeMs'])
}

const summarizeOutputMetadataValue = (value: unknown): OutputMetadataSummary | null => {
  const metadata = unwrapCanonicalRecordValue(value)
  if (!metadata) {
    return null
  }

  return {
    estimatedCostCents: readCostTotal(metadata, 'estimated'),
    actualCostCents: readCostTotal(metadata, 'actual'),
    estimatedProcessingTimeMs: readTimingTotal(metadata, 'estimated'),
    actualProcessingTimeMs: readTimingTotal(metadata, 'actual') ?? readActualProcessingTime(metadata),
  }
}

export const readOutputMetadataSummary = async (metadataPath: string): Promise<OutputMetadataSummary | null> => {
  try {
    const raw = JSON.parse(await Bun.file(metadataPath).text()) as unknown
    return summarizeOutputMetadataValue(raw)
  } catch {
    return null
  }
}
