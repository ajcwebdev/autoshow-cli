import {
  parseIntWithDefault,
  readOptionalStringFlag
} from './flag-readers'
import { hasExplicitOrConfiguredFlag } from './build-options-config-flags'
import type { ResolveConcurrencyOptions, ResolvedModelOptions } from '~/types'
import {
  DEFAULT_ALL_PROVIDER_CONCURRENCY,
  DEFAULT_CLI_CONCURRENCY,
  DEFAULT_GROK_TTS_CHUNK_CONCURRENCY,
  DEFAULT_TTS_CHUNK_CONCURRENCY,
  DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE
} from '~/utils/concurrency-defaults'

const readExplicitOrConfiguredStringFlag = (
  flags: Record<string, unknown>,
  flagName: string,
  explicitFlags: Set<string>,
  configuredFlags: Set<string>
): string | undefined =>
  hasExplicitOrConfiguredFlag(flagName, explicitFlags, configuredFlags)
    ? readOptionalStringFlag(flags, flagName)
    : undefined

const hasSelectedTarget = (
  models: string[] | undefined
): boolean => (models?.length ?? 0) > 0

const isGrokOnlyHostedTtsSelection = (modelOptions: ResolvedModelOptions): boolean => {
  const grokSelected = hasSelectedTarget(modelOptions.grokTtsModels)
  if (!grokSelected) {
    return false
  }

  return ![
    hasSelectedTarget(modelOptions.elevenlabsTtsModels),
    hasSelectedTarget(modelOptions.minimaxTtsModels),
    hasSelectedTarget(modelOptions.groqTtsModels),
    hasSelectedTarget(modelOptions.mistralTtsModels),
    hasSelectedTarget(modelOptions.openaiTtsModels),
    hasSelectedTarget(modelOptions.geminiTtsModels),
    hasSelectedTarget(modelOptions.deepgramTtsModels),
    hasSelectedTarget(modelOptions.speechifyTtsModels),
    hasSelectedTarget(modelOptions.humeTtsModels),
    hasSelectedTarget(modelOptions.cartesiaTtsModels),
    hasSelectedTarget(modelOptions.fishTtsModels)
  ].some(Boolean)
}

export const resolveProviderConcurrency = (
  flags: Record<string, unknown>,
  flagName: string,
  allShortcutSelected: boolean,
  explicitFlags: Set<string>,
  configuredFlags: Set<string>,
  options: ResolveConcurrencyOptions = {}
): number => {
  const sharedFlagName = 'provider-concurrency'
  const defaultValue = options.defaultValue ?? DEFAULT_CLI_CONCURRENCY
  const sharedValue = readExplicitOrConfiguredStringFlag(flags, sharedFlagName, explicitFlags, configuredFlags)
  const flagValue = sharedValue ?? readOptionalStringFlag(flags, flagName)
  if (allShortcutSelected && flagValue === undefined) {
    return options.allShortcutDefault ?? DEFAULT_ALL_PROVIDER_CONCURRENCY
  }
  return Math.max(1, parseIntWithDefault(
    flagValue,
    defaultValue
  ))
}

export const resolveLocalConcurrency = (
  flags: Record<string, unknown>,
  flagName: string,
  explicitFlags: Set<string> = new Set(),
  configuredFlags: Set<string> = new Set(),
  options: ResolveConcurrencyOptions = {}
): number => Math.max(1, parseIntWithDefault(
  readExplicitOrConfiguredStringFlag(flags, 'local-concurrency', explicitFlags, configuredFlags)
    ?? readOptionalStringFlag(flags, flagName),
  options.defaultValue ?? DEFAULT_CLI_CONCURRENCY
))

export const resolveTtsChunkConcurrency = (
  flags: Record<string, unknown>,
  modelOptions: ResolvedModelOptions,
  explicitFlags: Set<string>,
  configuredFlags: Set<string>
): number => {
  const flagName = 'tts-chunk-concurrency'
  const rawValue = readOptionalStringFlag(flags, flagName)
  const hasUserValue = hasExplicitOrConfiguredFlag(flagName, explicitFlags, configuredFlags)
    || (rawValue !== undefined && rawValue !== DEFAULT_TTS_CHUNK_CONCURRENCY_FLAG_VALUE)
  const defaultValue = !hasUserValue && isGrokOnlyHostedTtsSelection(modelOptions)
    ? DEFAULT_GROK_TTS_CHUNK_CONCURRENCY
    : DEFAULT_TTS_CHUNK_CONCURRENCY

  return Math.max(1, parseIntWithDefault(hasUserValue ? rawValue : undefined, defaultValue))
}
