import type { CliFlagOccurrence, SelectorNormalizationResult } from '~/types'
import { UsageError } from '~/utils/error-handler'

// Normalize before merging config so both spellings follow the same precedence rules.
export const normalizeWriteProviderAlias = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): SelectorNormalizationResult => {
  if (explicitFlags.has('provider') && explicitFlags.has('llm')) {
    throw UsageError('Do not combine --provider with its --llm alias. Repeat one selector for multiple providers.')
  }
  if (!explicitFlags.has('provider')) return { flags, explicitFlags, flagOccurrences: [...flagOccurrences] }
  const normalizedFlags: Record<string, unknown> = { ...flags, llm: flags['provider'] }
  delete normalizedFlags['provider']
  const normalizedExplicit = new Set(explicitFlags)
  normalizedExplicit.delete('provider')
  normalizedExplicit.add('llm')
  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicit,
    flagOccurrences: flagOccurrences.map(occurrence => occurrence.name === 'provider' ? { ...occurrence, name: 'llm' } : occurrence)
  }
}
