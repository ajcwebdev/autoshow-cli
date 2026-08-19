import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { filterModelNamesByLifecycle, getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  SUPPORTED_OPENAI_MODELS,
  SUPPORTED_GROQ_MODELS,
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_MINIMAX_MODELS,
  SUPPORTED_GROK_MODELS,
  SUPPORTED_GLM_MODELS,
  SUPPORTED_KIMI_MODELS,
  SUPPORTED_TOGETHER_MODELS,
  SUPPORTED_CEREBRAS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_CARTESIA_TTS_MODELS,
  DEEPGRAM_DEFAULT_VOICE,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_BFL_IMAGE_MODELS,
  SUPPORTED_REPLICATE_IMAGE_MODELS,
  SUPPORTED_LUMALABS_IMAGE_MODELS,
  SUPPORTED_FAL_IMAGE_MODELS,
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_GEMINI_MUSIC_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_LTX_VIDEO_MODELS,
  SUPPORTED_REPLICATE_VIDEO_MODELS,
  SUPPORTED_LUMALABS_VIDEO_MODELS,
  SUPPORTED_FAL_VIDEO_MODELS
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import {
  getStep2ProviderEntries,
  getStep2AllShortcutModelExpansions,
  isStep2BooleanProviderSelected
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { REPEATABLE_MODEL_FLAGS } from '~/cli/flags/service-selector-normalization/repeatable-model-flags'
import type { AllShortcutFlag, CliFlagOccurrence, FlagOccurrenceValue, RepeatableModelFlag, Step2ProviderSelectionOrigin } from '~/types'
import { readBooleanFlag } from './flag-readers'

export { REPEATABLE_MODEL_FLAGS }

const REPEATABLE_MODEL_FLAG_SET = new Set<string>(REPEATABLE_MODEL_FLAGS)
const STEP2_ALL_SHORTCUT_MODEL_EXPANSIONS = getStep2AllShortcutModelExpansions()
const STEP2_PROVIDER_ENTRIES = [
  ...getStep2ProviderEntries('stt'),
  ...getStep2ProviderEntries('ocr'),
  ...getStep2ProviderEntries('url')
] as const
const ALL_SHORTCUT_MODEL_EXPANSIONS: Partial<Record<RepeatableModelFlag, { shortcut: AllShortcutFlag, supported: readonly string[] }>> = {
  ...STEP2_ALL_SHORTCUT_MODEL_EXPANSIONS,
  openai: { shortcut: 'all-llm', supported: SUPPORTED_OPENAI_MODELS },
  groq: { shortcut: 'all-llm', supported: SUPPORTED_GROQ_MODELS },
  gemini: { shortcut: 'all-llm', supported: SUPPORTED_GEMINI_MODELS },
  anthropic: { shortcut: 'all-llm', supported: SUPPORTED_ANTHROPIC_MODELS },
  minimax: { shortcut: 'all-llm', supported: SUPPORTED_MINIMAX_MODELS },
  grok: { shortcut: 'all-llm', supported: SUPPORTED_GROK_MODELS },
  glm: { shortcut: 'all-llm', supported: SUPPORTED_GLM_MODELS },
  kimi: { shortcut: 'all-llm', supported: SUPPORTED_KIMI_MODELS },
  together: { shortcut: 'all-llm', supported: SUPPORTED_TOGETHER_MODELS },
  cerebras: { shortcut: 'all-llm', supported: SUPPORTED_CEREBRAS_MODELS },
  'elevenlabs-tts': { shortcut: 'all-tts', supported: SUPPORTED_ELEVENLABS_TTS_MODELS },
  'minimax-tts': { shortcut: 'all-tts', supported: SUPPORTED_MINIMAX_TTS_MODELS },
  'groq-tts': { shortcut: 'all-tts', supported: SUPPORTED_GROQ_TTS_MODELS },
  'grok-tts': { shortcut: 'all-tts', supported: SUPPORTED_GROK_TTS_MODELS },
  'openai-tts': { shortcut: 'all-tts', supported: SUPPORTED_OPENAI_TTS_MODELS },
  'gemini-tts': { shortcut: 'all-tts', supported: SUPPORTED_GEMINI_TTS_MODELS },
  'deepgram-tts': { shortcut: 'all-tts', supported: [DEEPGRAM_DEFAULT_VOICE] },
  'speechify-tts': { shortcut: 'all-tts', supported: SUPPORTED_SPEECHIFY_TTS_MODELS },
  'hume-tts': { shortcut: 'all-tts', supported: SUPPORTED_HUME_TTS_MODELS },
  'cartesia-tts': { shortcut: 'all-tts', supported: SUPPORTED_CARTESIA_TTS_MODELS },
  'gemini-image': { shortcut: 'all-image', supported: SUPPORTED_GEMINI_IMAGE_MODELS },
  'openai-image': { shortcut: 'all-image', supported: SUPPORTED_OPENAI_IMAGE_MODELS },
  'grok-image': { shortcut: 'all-image', supported: SUPPORTED_GROK_IMAGE_MODELS },
  'bfl-image': { shortcut: 'all-image', supported: SUPPORTED_BFL_IMAGE_MODELS },
  'replicate-image': { shortcut: 'all-image', supported: SUPPORTED_REPLICATE_IMAGE_MODELS },
  'lumalabs-image': { shortcut: 'all-image', supported: SUPPORTED_LUMALABS_IMAGE_MODELS },
  'fal-image': { shortcut: 'all-image', supported: SUPPORTED_FAL_IMAGE_MODELS },
  'elevenlabs-music': { shortcut: 'all-music', supported: SUPPORTED_ELEVENLABS_MUSIC_MODELS },
  'minimax-music': { shortcut: 'all-music', supported: SUPPORTED_MINIMAX_MUSIC_MODELS },
  'gemini-music': { shortcut: 'all-music', supported: SUPPORTED_GEMINI_MUSIC_MODELS },
  'gemini-video': { shortcut: 'all-video', supported: SUPPORTED_GEMINI_VIDEO_MODELS },
  'grok-video': { shortcut: 'all-video', supported: SUPPORTED_GROK_VIDEO_MODELS },
  'ltx-video': { shortcut: 'all-video', supported: SUPPORTED_LTX_VIDEO_MODELS },
  'replicate-video': { shortcut: 'all-video', supported: SUPPORTED_REPLICATE_VIDEO_MODELS },
  'lumalabs-video': { shortcut: 'all-video', supported: SUPPORTED_LUMALABS_VIDEO_MODELS },
  'fal-video': { shortcut: 'all-video', supported: SUPPORTED_FAL_VIDEO_MODELS },
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

export const normalizeModelFlagOccurrences = (
  flagName: RepeatableModelFlag,
  flags: Record<string, unknown>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>
): string[] | undefined => {
  const occurrences = rawOccurrences[flagName]
  const sourceValues: FlagOccurrenceValue[] | undefined = occurrences && occurrences.length > 0
    ? occurrences
    : Array.isArray(flags[flagName])
      ? (flags[flagName] as unknown[]).flatMap((entry) =>
          typeof entry === 'string' || entry === true ? [entry] : []
        )
      : typeof flags[flagName] === 'string' || flags[flagName] === true
        ? [flags[flagName] as string | boolean]
        : undefined

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

export const resolveStep2SelectionOrigins = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>,
  allShortcutFlags: Record<AllShortcutFlag, boolean>,
  configuredFlags: Set<string> = new Set()
): Partial<Record<string, Step2ProviderSelectionOrigin>> => {
  const origins: Partial<Record<string, Step2ProviderSelectionOrigin>> = {}
  const isExplicitOrConfiguredSttSelection = (flagName: string): boolean =>
    explicitFlags.has(flagName) || configuredFlags.has(flagName)

  for (const entry of STEP2_PROVIDER_ENTRIES) {
    if (entry.selection.type === 'fixed') {
      const rawValue = flags[entry.flagName]
      const normalizedValue = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : undefined
      const allShortcutSelected = entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut]
      const directSelected = normalizedValue === entry.targetService
        || (normalizedValue === undefined && entry.targetService === 'defuddle' && !allShortcutSelected)

      if (!allShortcutSelected && !directSelected) {
        continue
      }

      origins[entry.flagName] = explicitFlags.has(entry.flagName) && directSelected
        ? 'explicit'
        : allShortcutSelected
          ? 'all-shortcut'
          : 'default'
      continue
    }

    if (entry.selection.type === 'boolean') {
      if (!isStep2BooleanProviderSelected(entry.flagName, flags, allShortcutFlags)) {
        continue
      }

      origins[entry.flagName] = explicitFlags.has(entry.flagName)
        ? 'explicit'
        : entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut]
          ? 'all-shortcut'
          : 'default'
      continue
    }

    if (entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut]) {
      origins[entry.flagName] = entry.step === 'stt' && isExplicitOrConfiguredSttSelection(entry.flagName) ? 'explicit' : 'all-shortcut'
      continue
    }

    const models = normalizeModelFlagOccurrences(entry.flagName as RepeatableModelFlag, flags, rawOccurrences)
    if (!models || models.length === 0) {
      continue
    }

    origins[entry.flagName] = explicitFlags.has(entry.flagName) ? 'explicit' : 'default'
  }

  return origins
}
