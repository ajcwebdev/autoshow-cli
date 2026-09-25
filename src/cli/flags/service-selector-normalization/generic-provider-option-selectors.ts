import { UsageError } from '~/utils/error-handler'
import type { CliFlagOccurrence, ControlSpec, SelectorNormalizationResult } from '~/types'

// Shared machinery for provider-general `provider=value` option flags. A domain (TTS, STT) supplies
// which providers it knows, which of its capability-table controls each generic flag maps to, and
// which flags select an identity rather than a capability control. Everything else — parsing,
// provider resolution, support assertions and value coercion — lives here once.

export type GenericOptionControl = {
  provider: string
  key: string
  spec: ControlSpec
  defaultValue?: string | undefined
}

export type GenericOptionDomain = {
  /** Human label used in usage errors, e.g. "TTS". */
  label: string
  /** Flag that selects every provider for this domain, e.g. "all-tts". */
  allSelectedFlag: string
  /** provider -> the per-provider flag name its selector writes into. */
  providerTargets: Record<string, string>
  /** Providers that used to exist and now produce a named error instead of "unknown provider". */
  retiredProviders: ReadonlySet<string>
  /** Every generic option flag this domain owns. */
  flagNames: readonly string[]
  /** Identity flags whose identifier syntax reserves provider=value for qualified selection. */
  strictProviderQualifierFlags?: readonly string[]
  /**
   * Capability controls backing a generic flag, keyed by provider. Identity flags return an empty
   * record and declare their providers through `identityProviders` instead.
   */
  controlsFor: (flagName: string) => Readonly<Record<string, GenericOptionControl>>
  /** Providers accepted by an identity flag (a voice or reference selector, not a control). */
  identityProviders: (flagName: string) => readonly string[]
}

export type GenericOptionAssignment = {
  provider: string
  value: string | boolean
}

export const providersForGenericOption = (domain: GenericOptionDomain, flagName: string): string[] => {
  const identity = domain.identityProviders(flagName)
  return identity.length > 0 ? [...identity] : Object.keys(domain.controlsFor(flagName))
}

export const createGenericProviderOptionSelectors = (domain: GenericOptionDomain) => {
  const providerByTarget = Object.fromEntries(
    Object.entries(domain.providerTargets).map(([provider, target]) => [target, provider])
  ) as Record<string, string>

  const occurrenceValues = (value: unknown): Array<string | true> =>
    Array.isArray(value)
      ? value.filter((entry): entry is string | true => typeof entry === 'string' || entry === true)
      : typeof value === 'string' || value === true ? [value] : []

  const readSelectedProviders = (
    flags: Record<string, unknown>,
    defaultProvider?: string | undefined
  ): string[] => {
    if (flags[domain.allSelectedFlag] === true) return Object.keys(domain.providerTargets)

    const providers: string[] = []
    for (const [target, provider] of Object.entries(providerByTarget)) {
      if (occurrenceValues(flags[target]).length > 0) providers.push(provider)
    }
    if (providers.length === 0 && defaultProvider) providers.push(defaultProvider)
    return providers
  }

  const parseOptionValue = (
    rawValue: string | boolean,
    flagName: string
  ): { provider?: string | undefined, value: string | boolean } => {
    if (typeof rawValue === 'boolean') return { value: rawValue }

    const eqIndex = rawValue.indexOf('=')
    if (eqIndex > 0) {
      const possibleProvider = rawValue.slice(0, eqIndex).trim().toLowerCase()
      if (domain.retiredProviders.has(possibleProvider)) {
        throw UsageError(`${possibleProvider} is no longer supported for ${domain.label}. Select one of: ${Object.keys(domain.providerTargets).join(', ')}.`)
      }
      if (possibleProvider in domain.providerTargets) {
        const value = rawValue.slice(eqIndex + 1)
        if (value.length === 0) throw UsageError(`--${flagName} requires a value after "${possibleProvider}=".`)
        return { provider: possibleProvider, value }
      }
      if (domain.strictProviderQualifierFlags?.includes(flagName) && /^[a-z][a-z0-9-]*$/.test(possibleProvider)) {
        throw UsageError(`Unknown provider "${possibleProvider}" for --${flagName}. Select one of: ${Object.keys(domain.providerTargets).join(', ')}.`)
      }
    }
    return { value: rawValue }
  }

  const resolveOptionProvider = (
    flagName: string,
    parsedProvider: string | undefined,
    selectedProviders: string[],
    options: { allowUnscoped?: boolean } = {}
  ): string | undefined => {
    if (parsedProvider) return parsedProvider
    if (selectedProviders.length === 1) return selectedProviders[0]
    if (selectedProviders.length === 0) {
      if (options.allowUnscoped === true) return undefined
      throw UsageError(`--${flagName} requires one selected ${domain.label} provider or provider=value.`)
    }
    throw UsageError(`--${flagName} requires provider=value when multiple ${domain.label} providers are selected.`)
  }

  const assertOptionSupported = (flagName: string, provider: string): void => {
    if (!providersForGenericOption(domain, flagName).includes(provider)) {
      throw UsageError(`--${flagName} does not apply to ${provider} ${domain.label}.`)
    }
  }

  // A bare `--flag` is only meaningful for a boolean control, which the capability table already knows.
  const assertOptionValue = (flagName: string, provider: string | undefined, value: string | boolean): void => {
    if (value !== true) return
    const controls = domain.controlsFor(flagName)
    if (provider === undefined) {
      if (Object.values(controls).some((control) => control.spec.kind === 'boolean')) return
    } else if (controls[provider]?.spec.kind === 'boolean') return
    throw UsageError(`--${flagName} requires a value.`)
  }

  const readRawValues = (
    flags: Record<string, unknown>,
    flagOccurrences: readonly CliFlagOccurrence[],
    flagName: string
  ): Array<string | boolean> => {
    const fromOccurrences = flagOccurrences.flatMap((occurrence) =>
      occurrence.name === flagName && (typeof occurrence.value === 'string' || typeof occurrence.value === 'boolean')
        ? [occurrence.value]
        : []
    )
    if (fromOccurrences.length > 0) return fromOccurrences

    const value = flags[flagName]
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string | boolean =>
        (typeof entry === 'string' && entry.length > 0) || typeof entry === 'boolean')
    }
    if (typeof value === 'string' && value.length > 0) return [value]
    if (typeof value === 'boolean') return [value]
    if (typeof value === 'number' && Number.isFinite(value)) return [String(value)]
    return []
  }

  const resolveAssignments = (
    flags: Record<string, unknown>,
    flagOccurrences: readonly CliFlagOccurrence[],
    flagName: string,
    selectedProviders: string[]
  ): GenericOptionAssignment[] => {
    const explicit = readRawValues(flags, flagOccurrences, flagName).map((rawValue) => {
      const parsed = parseOptionValue(rawValue, flagName)
      const provider = resolveOptionProvider(flagName, parsed.provider, selectedProviders)
      if (provider === undefined) {
        throw UsageError(`--${flagName} requires one selected ${domain.label} provider or provider=value.`)
      }
      assertOptionSupported(flagName, provider)
      assertOptionValue(flagName, provider, parsed.value)
      return { provider, value: parsed.value }
    })

    // Registry defaults fill in only providers the invocation left unassigned, so the rendered
    // default and the effective default come from the same constant and cannot drift.
    const assigned = new Set(explicit.map((assignment) => assignment.provider))
    const defaults = Object.values(domain.controlsFor(flagName)).flatMap((control) =>
      control.defaultValue !== undefined
        && !assigned.has(control.provider)
        && selectedProviders.includes(control.provider)
        ? [{ provider: control.provider, value: control.defaultValue }]
        : [])
    return [...explicit, ...defaults]
  }

  const validateOccurrence = (
    flagName: string,
    rawValue: string | boolean,
    selectedProviders: string[]
  ): void => {
    const parsed = parseOptionValue(rawValue, flagName)
    const provider = resolveOptionProvider(flagName, parsed.provider, selectedProviders, { allowUnscoped: true })
    if (provider !== undefined) assertOptionSupported(flagName, provider)
    assertOptionValue(flagName, provider, parsed.value)
  }

  const normalizeFlags = (
    flags: Record<string, unknown>,
    explicitFlags: Set<string>,
    flagOccurrences: readonly CliFlagOccurrence[],
    defaultProvider?: string | undefined
  ): SelectorNormalizationResult => {
    const selectedProviders = readSelectedProviders(flags, defaultProvider)
    for (const occurrence of flagOccurrences) {
      if (!domain.flagNames.includes(occurrence.name)) continue
      if (typeof occurrence.value !== 'string' && typeof occurrence.value !== 'boolean') continue
      validateOccurrence(occurrence.name, occurrence.value, selectedProviders)
    }
    return { flags, explicitFlags, flagOccurrences: [...flagOccurrences] }
  }

  const requireString = (flagName: string, value: string | boolean): string => {
    if (typeof value !== 'string' || value.length === 0) throw UsageError(`--${flagName} requires a value.`)
    return value
  }

  const parseBoolean = (value: string | boolean): boolean =>
    value === true || (typeof value === 'string' && !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase()))

  return {
    domain,
    readSelectedProviders,
    parseOptionValue,
    resolveOptionProvider,
    assertOptionSupported,
    readRawValues,
    resolveAssignments,
    normalizeFlags,
    requireString,
    parseBoolean
  }
}
