import type { JsonObject } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const createProviderRecordReader = (providerLabel: string) =>
  (value: unknown, label: string): JsonObject => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw UsageError(`${providerLabel} ${label} response is invalid.`)
    }
    return value as JsonObject
  }

export const trimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined
