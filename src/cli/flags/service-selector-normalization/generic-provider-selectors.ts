import type { SelectorNormalizationResult } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { appendProviderSelector, normalizeProviderSelectorArgs, occurrenceValues, setBooleanFlag } from './flag-helpers'
import { BOOLEAN_PROVIDER_TARGETS } from './provider-targets'

export const normalizeGenericProviderSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  options: {
    allProvidersTarget?: string | undefined
    allLocalTarget?: string | undefined
    rawArgs?: string[] | undefined
  } = {}
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  const values = occurrenceValues(normalizedFlags[selectorFlag])
  if (values.length > 0) {
    delete normalizedFlags[selectorFlag]
    normalizedExplicitFlags.delete(selectorFlag)
    for (const value of values) {
      normalizedExplicitFlags.add(
        appendProviderSelector(normalizedFlags, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS, value)
      )
    }
  }

  if (options.allProvidersTarget && normalizedFlags['all-providers'] === true) {
    delete normalizedFlags['all-providers']
    normalizedExplicitFlags.delete('all-providers')
    normalizedExplicitFlags.add(options.allProvidersTarget)
    setBooleanFlag(normalizedFlags, options.allProvidersTarget)
  }

  if (normalizedFlags['all-local'] === true) {
    if (!options.allLocalTarget) {
      throw CLIUsageError('--all-local is not supported for this command or resume target.')
    }
    delete normalizedFlags['all-local']
    normalizedExplicitFlags.delete('all-local')
    normalizedExplicitFlags.add(options.allLocalTarget)
    setBooleanFlag(normalizedFlags, options.allLocalTarget)
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags,
    rawArgs: options.rawArgs
      ? normalizeProviderSelectorArgs(options.rawArgs, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS).flatMap((arg) => {
          if (arg === '--all-providers' && options.allProvidersTarget) {
            return [`--${options.allProvidersTarget}`]
          }
          if (arg === '--all-local') {
            return options.allLocalTarget ? [`--${options.allLocalTarget}`] : []
          }
          return [arg]
        })
      : undefined
  }
}
