import type { JsonObject } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

/**
 * Response coercion shared by the advanced (voice-management) TTS provider adapters. All
 * seven carried byte-identical copies of both helpers, differing only in the provider name
 * interpolated into the error message.
 */

/** Narrows a provider response fragment to an object, or fails with a provider-named message. */
export const createProviderRecordReader = (providerLabel: string) =>
  (value: unknown, label: string): JsonObject => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw CLIUsageError(`${providerLabel} ${label} response is invalid.`)
    }
    return value as JsonObject
  }

/** A trimmed non-empty string, or undefined for anything else. */
export const trimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined
