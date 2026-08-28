import { UsageError } from '~/utils/error-handler'

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
    throw UsageError(`--${flagName} requires provider[=model].`)
  }

  const trimmed = rawValue.trim()
  if (trimmed.length === 0) {
    throw UsageError(`--${flagName} requires provider[=model].`)
  }

  const eqIndex = trimmed.indexOf('=')
  const provider = (eqIndex === -1 ? trimmed : trimmed.slice(0, eqIndex)).trim().toLowerCase()
  if (provider.length === 0) {
    throw UsageError(`--${flagName} requires provider[=model].`)
  }

  if (eqIndex === -1) {
    return { provider, model: true }
  }

  const model = trimmed.slice(eqIndex + 1).trim()
  if (model.length === 0) {
    throw UsageError(`--${flagName} requires a model after "${provider}=".`)
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
    throw UsageError(
      `Unknown provider "${parsed.provider}" for --${selectorFlag}. Expected ${Object.keys(targetByProvider).join('|')}.`
    )
  }

  if (parsed.model !== true && booleanTargets.has(target)) {
    throw UsageError(`--${selectorFlag} ${parsed.provider} does not accept a model.`)
  }
  return { target, model: parsed.model }
}
