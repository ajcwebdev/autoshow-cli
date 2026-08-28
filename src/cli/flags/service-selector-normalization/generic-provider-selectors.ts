import type { CliFlagOccurrence, SelectorNormalizationResult } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { resolveProviderSelector } from './flag-helpers'
import { applyFlagOccurrenceNormalization, replaceFlagOccurrence } from './occurrence-normalization'
import { BOOLEAN_PROVIDER_TARGETS } from './provider-targets'

export const normalizeGenericProviderSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  options: {
    allProvidersTarget?: string | undefined
    allLocalTarget?: string | undefined
  } = {}
): SelectorNormalizationResult =>
  applyFlagOccurrenceNormalization(flags, explicitFlags, flagOccurrences, (occurrence) => {
    if (occurrence.name === selectorFlag) {
      if (occurrence.value === false) {
        return []
      }
      const { target, model } = resolveProviderSelector(
        occurrence.value,
        selectorFlag,
        targetByProvider,
        BOOLEAN_PROVIDER_TARGETS
      )
      return [replaceFlagOccurrence(
        occurrence,
        target,
        model,
        BOOLEAN_PROVIDER_TARGETS.has(target) ? 'set' : 'append'
      )]
    }

    if (occurrence.name === 'all-providers' && options.allProvidersTarget) {
      return occurrence.value === true
        ? [replaceFlagOccurrence(occurrence, options.allProvidersTarget, true)]
        : []
    }

    if (occurrence.name === 'all-local') {
      if (occurrence.value !== true) {
        return []
      }
      if (!options.allLocalTarget) {
        throw UsageError('--all-local is not supported for this command or resume target.')
      }
      return [replaceFlagOccurrence(occurrence, options.allLocalTarget, true)]
    }

    return undefined
  })
