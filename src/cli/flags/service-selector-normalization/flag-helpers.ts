import { CLIUsageError } from '~/utils/error-handler'
import type { SelectorFlagMap, SelectorNormalizationResult } from '~/types'

export const occurrenceValues = (value: unknown): Array<string | true> => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string | true => typeof entry === 'string' || entry === true)
  }
  return typeof value === 'string' || value === true ? [value] : []
}

export const appendFlagValue = (
  flags: Record<string, unknown>,
  flagName: string,
  value: string | boolean
): void => {
  const current = flags[flagName]
  if (Array.isArray(current)) {
    current.push(value)
    return
  }
  if (current !== undefined) {
    flags[flagName] = [current, value]
    return
  }
  flags[flagName] = value
}

export const setBooleanFlag = (
  flags: Record<string, unknown>,
  flagName: string
): void => {
  flags[flagName] = true
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

export const appendProviderSelector = (
  flags: Record<string, unknown>,
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  booleanTargets: ReadonlySet<string>,
  value: string | true
): string => {
  const parsed = parseProviderSelectorValue(value, selectorFlag)
  const target = targetByProvider[parsed.provider]
  if (!target) {
    throw CLIUsageError(`Unknown provider "${parsed.provider}" for --${selectorFlag}.`)
  }

  if (parsed.model !== true && booleanTargets.has(target)) {
    throw CLIUsageError(`--${selectorFlag} ${parsed.provider} does not accept a model.`)
  }

  appendFlagValue(flags, target, parsed.model)
  return target
}

export const selectorArgToInternalArgs = (
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  booleanTargets: ReadonlySet<string>,
  value: string | true
): string[] => {
  const parsed = parseProviderSelectorValue(value, selectorFlag)
  const target = targetByProvider[parsed.provider]
  if (!target) {
    throw CLIUsageError(`Unknown provider "${parsed.provider}" for --${selectorFlag}.`)
  }
  if (parsed.model !== true && booleanTargets.has(target)) {
    throw CLIUsageError(`--${selectorFlag} ${parsed.provider} does not accept a model.`)
  }
  return parsed.model === true ? [`--${target}`] : [`--${target}`, parsed.model]
}

export const rewriteLongFlagArgs = (
  argv: string[],
  matches: (name: string) => boolean,
  consumesValue: (name: string) => boolean,
  rewrite: (name: string, rawValue: string | true) => string[]
): string[] => {
  const rewritten: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--') {
      rewritten.push(...argv.slice(i))
      break
    }

    const parsed = parseLongFlagArg(arg)
    if (!parsed || !matches(parsed.name)) {
      rewritten.push(arg)
      continue
    }

    const hasSeparateValue = parsed.inlineValue === undefined
      && consumesValue(parsed.name)
      && typeof argv[i + 1] === 'string'
      && argv[i + 1] !== '--'
      && !argv[i + 1]!.startsWith('--')
    const rawValue: string | true = parsed.inlineValue !== undefined
      ? parsed.inlineValue
      : hasSeparateValue
        ? argv[i + 1] as string
        : true

    if (hasSeparateValue) {
      i++
    }
    rewritten.push(...rewrite(parsed.name, rawValue))
  }

  return rewritten
}

export const normalizeProviderSelectorArgs = (
  argv: string[],
  selectorFlag: string,
  targetByProvider: Record<string, string>,
  booleanTargets: ReadonlySet<string>
): string[] =>
  rewriteLongFlagArgs(
    argv,
    (name) => name === selectorFlag,
    () => true,
    (_name, rawValue) => selectorArgToInternalArgs(selectorFlag, targetByProvider, booleanTargets, rawValue)
  )

export const normalizeCommandSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  publicNameByInternalName: SelectorFlagMap
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  for (const [internalName, publicName] of Object.entries(publicNameByInternalName)) {
    const values = occurrenceValues(normalizedFlags[publicName])
    if (values.length === 0) {
      continue
    }

    delete normalizedFlags[publicName]
    for (const value of values) {
      appendFlagValue(normalizedFlags, internalName, value)
    }
    if (normalizedExplicitFlags.has(publicName)) {
      normalizedExplicitFlags.delete(publicName)
      normalizedExplicitFlags.add(internalName)
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}

export const normalizeCommandSelectorArgs = (
  argv: string[],
  publicNameByInternalName: SelectorFlagMap
): string[] => {
  const internalNameByPublicName = new Map(
    Object.entries(publicNameByInternalName).map(([internalName, publicName]) => [publicName, internalName])
  )

  return argv.map((arg) => {
    if (!arg.startsWith('--') || arg === '--') {
      return arg
    }

    const raw = arg.slice(2)
    const eqIndex = raw.indexOf('=')
    const name = eqIndex === -1 ? raw : raw.slice(0, eqIndex)
    const internalName = internalNameByPublicName.get(name)
    if (!internalName) {
      return arg
    }

    if (eqIndex === -1) {
      return `--${internalName}`
    }
    return `--${internalName}=${raw.slice(eqIndex + 1)}`
  })
}

export const parseLongFlagArg = (arg: string): { name: string, inlineValue?: string } | undefined => {
  if (!arg.startsWith('--') || arg === '--') {
    return undefined
  }

  const raw = arg.slice(2)
  const eqIndex = raw.indexOf('=')
  return eqIndex === -1
    ? { name: raw }
    : { name: raw.slice(0, eqIndex), inlineValue: raw.slice(eqIndex + 1) }
}
