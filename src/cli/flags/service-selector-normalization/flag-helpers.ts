import { CLIUsageError } from '~/utils/error-handler'
import type { CliFlagOccurrence, SelectorFlagMap, SelectorNormalizationResult } from '~/types'
import { applyFlagOccurrenceNormalization, replaceFlagOccurrence } from './occurrence-normalization'

export const occurrenceValues = (value: unknown): Array<string | true> => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string | true => typeof entry === 'string' || entry === true)
  }
  return typeof value === 'string' || value === true ? [value] : []
}

export const parseProviderSelectorValue = (
  rawValue: string | true,
  flagName: string
): { provider: string, model: string | true } => {
  if (rawValue === true) {
    throw CLIUsageError(`--${flagName} requires provider[=model].`)
  }

  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    throw CLIUsageError(`--${flagName} requires provider[=model].`)
  }

  const eqIndex = trimmed.indexOf('=')
  const provider = (eqIndex === -1 ? trimmed : trimmed.slice(0, eqIndex)).trim().toLowerCase()
  if (provider.length === 0) {
    throw CLIUsageError(`--${flagName} requires provider[=model].`)
  }

  if (eqIndex === -1) {
    return { provider, model: true }
  }

  const model = trimmed.slice(eqIndex + 1).trim()
  if (model.length === 0) {
    throw CLIUsageError(`--${flagName} requires a model after "${provider}=".`)
  }

  return { provider, model }
}

export const resolveProviderSelector = (
  value: string | true,
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  booleanTargets: ReadonlySet<string>
): { target: string, model: string | true } => {
  const parsed = parseProviderSelectorValue(value, selectorFlag)
  const target = targetByProvider[parsed.provider]
  if (!target) {
    throw CLIUsageError(
      `Unknown provider "${parsed.provider}" for --${selectorFlag}. Expected ${Object.keys(targetByProvider).join('|')}.`
    )
  }

  if (parsed.model !== true && booleanTargets.has(target)) {
    throw CLIUsageError(`--${selectorFlag} ${parsed.provider} does not accept a model.`)
  }
  return { target, model: parsed.model }
}

export const normalizeCommandSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  publicNameByInternalName: SelectorFlagMap
): SelectorNormalizationResult => {
  const internalNameByPublicName = new Map(
    Object.entries(publicNameByInternalName).map(([internalName, publicName]) => [publicName, internalName])
  )

  return applyFlagOccurrenceNormalization(flags, explicitFlags, flagOccurrences, (occurrence) => {
    const internalName = internalNameByPublicName.get(occurrence.name)
    if (!internalName) {
      return undefined
    }
    return [replaceFlagOccurrence(
      occurrence,
      internalName,
      occurrence.value,
      Array.isArray(flags[occurrence.name]) ? 'append' : 'set'
    )]
  })
}
