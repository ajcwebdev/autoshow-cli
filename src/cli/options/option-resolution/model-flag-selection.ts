import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { filterModelNamesByLifecycle, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  SUPPORTED_OPENAI_MODELS,
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_GROK_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_INWORLD_TTS_MODELS,
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import {
  getStep2ProviderEntries,
  getStep2AllShortcutModelExpansions,
  isStep2BooleanProviderSelected
} from '~/cli/commands/command-shared/extract-routing/provider-registry'
import { getGenerationAllShortcutModelExpansions } from '~/cli/commands/command-shared/generation-routing/generation-model-registry'
import { REPEATABLE_MODEL_FLAGS } from '~/cli/flags/service-selector-normalization/repeatable-model-flags'
import type { AllShortcutFlag, CliFlagOccurrence, FlagOccurrenceValue, RepeatableModelFlag, Step2ProviderSelectionOrigin } from '~/types'
import { readBooleanFlag } from './flag-readers'

export { REPEATABLE_MODEL_FLAGS }

const REPEATABLE_MODEL_FLAG_SET = new Set<string>(REPEATABLE_MODEL_FLAGS)
const STEP2_ALL_SHORTCUT_MODEL_EXPANSIONS = getStep2AllShortcutModelExpansions()
const GENERATION_ALL_SHORTCUT_MODEL_EXPANSIONS = getGenerationAllShortcutModelExpansions()
const STEP2_PROVIDER_ENTRIES = [
  ...getStep2ProviderEntries('stt'),
  ...getStep2ProviderEntries('ocr'),
  ...getStep2ProviderEntries('url')
] as const
const ALL_SHORTCUT_MODEL_EXPANSIONS: Partial<Record<RepeatableModelFlag, { shortcut: AllShortcutFlag, supported: readonly string[] }>> = {
  ...STEP2_ALL_SHORTCUT_MODEL_EXPANSIONS,
  openai: { shortcut: 'all-llm', supported: SUPPORTED_OPENAI_MODELS },
  gemini: { shortcut: 'all-llm', supported: SUPPORTED_GEMINI_MODELS },
  anthropic: { shortcut: 'all-llm', supported: SUPPORTED_ANTHROPIC_MODELS },
  grok: { shortcut: 'all-llm', supported: SUPPORTED_GROK_MODELS },
  'elevenlabs-tts': { shortcut: 'all-tts', supported: SUPPORTED_ELEVENLABS_TTS_MODELS },
  'gemini-tts': { shortcut: 'all-tts', supported: SUPPORTED_GEMINI_TTS_MODELS },
  'soniox-tts': { shortcut: 'all-tts', supported: ['tts-rt-v2'] },
  'grok-tts': { shortcut: 'all-tts', supported: SUPPORTED_GROK_TTS_MODELS },
  'openai-tts': { shortcut: 'all-tts', supported: SUPPORTED_OPENAI_TTS_MODELS },
  'inworld-tts': { shortcut: 'all-tts', supported: SUPPORTED_INWORLD_TTS_MODELS },
  ...GENERATION_ALL_SHORTCUT_MODEL_EXPANSIONS
}

const filterAllExpansionModels = (
  flagName: RepeatableModelFlag,
  supported: readonly string[]
): string[] => {
  const registry = getModelRegistry()
  if (flagName.endsWith('-ocr')) {
    const service = flagName.slice(0, -'-ocr'.length)
    return filterModelNamesByLifecycle(supported, registry.extract[service]?.models, 'allExpansionEligible')
  }
  return filterModelNamesByLifecycle(supported, registry.llm[flagName]?.models, 'allExpansionEligible')
}

export const collectRepeatableModelFlagOccurrences = (
  flagOccurrences: readonly CliFlagOccurrence[]
): Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>> => {
  const result: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>> = {}

  for (const occurrence of flagOccurrences) {
    if (!REPEATABLE_MODEL_FLAG_SET.has(occurrence.name)) {
      continue
    }
    const key = occurrence.name as RepeatableModelFlag
    const occurrenceList = result[key] ?? []
    result[key] = occurrenceList
    occurrenceList.push(occurrence.value)
  }

  return result
}

export const appendUnique = <T>(values: T[], value: T): void => {
  if (!values.includes(value)) {
    values.push(value)
  }
}

const readModelFlagSourceValues = (
  flagName: RepeatableModelFlag,
  flags: Record<string, unknown>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>
): FlagOccurrenceValue[] | undefined => {
  const occurrences = rawOccurrences[flagName]
  if (occurrences && occurrences.length > 0) {
    return occurrences
  }
  if (Array.isArray(flags[flagName])) {
    return (flags[flagName] as unknown[]).flatMap((entry) =>
      typeof entry === 'string' || entry === true ? [entry] : []
    )
  }
  return typeof flags[flagName] === 'string' || flags[flagName] === true
    ? [flags[flagName] as string | boolean]
    : undefined
}

export const normalizeModelFlagOccurrences = (
  flagName: RepeatableModelFlag,
  flags: Record<string, unknown>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>
): string[] | undefined => {
  const sourceValues = readModelFlagSourceValues(flagName, flags, rawOccurrences)

  if (!sourceValues || sourceValues.length === 0) {
    return undefined
  }

  const models: string[] = []
  for (const value of sourceValues) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        appendUnique(models, trimmed)
        continue
      }
    }

    const cheapestModel = resolveCheapestModelForFlag(flagName)
    if (cheapestModel !== undefined) {
      appendUnique(models, cheapestModel)
    }
  }

  return models.length > 0 ? models : undefined
}

export const readAllShortcutFlags = (flags: Record<string, unknown>): Record<AllShortcutFlag, boolean> => ({
  'all-stt': readBooleanFlag(flags, 'all-stt'),
  'all-local-stt': readBooleanFlag(flags, 'all-local-stt'),
  'all-ocr': readBooleanFlag(flags, 'all-ocr'),
  'all-local-ocr': readBooleanFlag(flags, 'all-local-ocr'),
  'all-url': readBooleanFlag(flags, 'all-url'),
  'all-local-url': readBooleanFlag(flags, 'all-local-url'),
  'all-llm': readBooleanFlag(flags, 'all-llm'),
  'all-tts': readBooleanFlag(flags, 'all-tts'),
  'all-image': readBooleanFlag(flags, 'all-image'),
  'all-local-image': readBooleanFlag(flags, 'all-local-image'),
  'all-video': readBooleanFlag(flags, 'all-video'),
  'all-local-video': readBooleanFlag(flags, 'all-local-video'),
  'all-music': readBooleanFlag(flags, 'all-music'),
  'all-local-music': readBooleanFlag(flags, 'all-local-music')
})

export const expandAllShortcutModels = (
  flagName: RepeatableModelFlag,
  flags: Record<string, unknown>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>,
  allShortcutFlags: Record<AllShortcutFlag, boolean>
): string[] | undefined => {
  const explicitSelections = normalizeModelFlagOccurrences(flagName, flags, rawOccurrences)
  const expansion = ALL_SHORTCUT_MODEL_EXPANSIONS[flagName]
  if (!expansion || !allShortcutFlags[expansion.shortcut]) {
    return explicitSelections
  }

  const mergedSelections = filterAllExpansionModels(flagName, expansion.supported)
  for (const value of explicitSelections ?? []) {
    appendUnique(mergedSelections, value)
  }
  return mergedSelections.length > 0 ? mergedSelections : undefined
}

type Step2SelectionEntry = (typeof STEP2_PROVIDER_ENTRIES)[number]
type Step2SelectionOriginInputs = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>
  allShortcutFlags: Record<AllShortcutFlag, boolean>
  configuredFlags: Set<string>
}

const resolveFixedSelectionOrigin = (
  entry: Step2SelectionEntry,
  { flags, explicitFlags, allShortcutFlags }: Step2SelectionOriginInputs
): Step2ProviderSelectionOrigin | undefined => {
  const rawValue = flags[entry.flagName]
  const normalizedValue = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : undefined
  const allShortcutSelected = entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut]
  const directSelected = normalizedValue === entry.targetService
    || (normalizedValue === undefined && entry.targetService === 'defuddle' && !allShortcutSelected)

  if (!allShortcutSelected && !directSelected) {
    return undefined
  }

  if (explicitFlags.has(entry.flagName) && directSelected) {
    return 'explicit'
  }
  return allShortcutSelected ? 'all-shortcut' : 'default'
}

const resolveBooleanSelectionOrigin = (
  entry: Step2SelectionEntry,
  { flags, explicitFlags, allShortcutFlags }: Step2SelectionOriginInputs
): Step2ProviderSelectionOrigin | undefined => {
  if (!isStep2BooleanProviderSelected(entry.flagName, flags, allShortcutFlags)) {
    return undefined
  }

  if (explicitFlags.has(entry.flagName)) {
    return 'explicit'
  }
  return entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut] ? 'all-shortcut' : 'default'
}

const resolveModelSelectionOrigin = (
  entry: Step2SelectionEntry,
  { flags, explicitFlags, rawOccurrences, allShortcutFlags, configuredFlags }: Step2SelectionOriginInputs
): Step2ProviderSelectionOrigin | undefined => {
  if (entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut]) {
    const isExplicitSttSelection = entry.step === 'stt'
      && (explicitFlags.has(entry.flagName) || configuredFlags.has(entry.flagName))
    return isExplicitSttSelection ? 'explicit' : 'all-shortcut'
  }

  const models = normalizeModelFlagOccurrences(entry.flagName as RepeatableModelFlag, flags, rawOccurrences)
  if (!models || models.length === 0) {
    return undefined
  }

  return explicitFlags.has(entry.flagName) ? 'explicit' : 'default'
}

const resolveStep2SelectionOrigin = (
  entry: Step2SelectionEntry,
  inputs: Step2SelectionOriginInputs
): Step2ProviderSelectionOrigin | undefined => {
  if (entry.selection.type === 'fixed') {
    return resolveFixedSelectionOrigin(entry, inputs)
  }
  if (entry.selection.type === 'boolean') {
    return resolveBooleanSelectionOrigin(entry, inputs)
  }
  return resolveModelSelectionOrigin(entry, inputs)
}

export const resolveStep2SelectionOrigins = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>,
  allShortcutFlags: Record<AllShortcutFlag, boolean>,
  configuredFlags: Set<string> = new Set()
): Partial<Record<string, Step2ProviderSelectionOrigin>> => {
  const origins: Partial<Record<string, Step2ProviderSelectionOrigin>> = {}
  const inputs: Step2SelectionOriginInputs = { flags, explicitFlags, rawOccurrences, allShortcutFlags, configuredFlags }

  for (const entry of STEP2_PROVIDER_ENTRIES) {
    const origin = resolveStep2SelectionOrigin(entry, inputs)
    if (origin !== undefined) {
      origins[entry.flagName] = origin
    }
  }

  return origins
}
