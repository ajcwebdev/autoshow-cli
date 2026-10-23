import type { GenerationPricingProviders, GenerationProviderTargetsOf, GenerationSelectionDescriptor, GenerationSelectionDescriptorOf, GenerationSelectionEntry, GenerationSelectionFields } from '~/types'
import {
  IMAGE_SELECTION_ENTRIES,
  MUSIC_SELECTION_ENTRIES,
  VIDEO_SELECTION_ENTRIES
} from '~/cli/commands/command-shared/generation-routing/generation-selection-entries'

const deriveProviderTargets = <const TEntries extends readonly GenerationSelectionEntry[]>(
  entries: TEntries
): GenerationProviderTargetsOf<TEntries> =>
  Object.fromEntries(entries.map(entry => [entry.service, entry.flagName])) as GenerationProviderTargetsOf<TEntries>

// The descriptor reuses the exported provider-target object so selection and flag surfaces stay one value.
const deriveSelectionDescriptor = <const TEntries extends readonly GenerationSelectionEntry[]>(
  entries: TEntries,
  providerTargets: GenerationProviderTargetsOf<TEntries>
): GenerationSelectionDescriptorOf<TEntries> => ({
  providerTargets,
  selections: Object.fromEntries(entries.map(entry => [entry.service, { modelsKey: entry.runtimeModelsKey }]))
} as GenerationSelectionDescriptorOf<TEntries>)

export const STANDALONE_TTS_PROVIDER_TARGETS = {
  gemini: 'gemini-tts',
  elevenlabs: 'elevenlabs-tts',
  soniox: 'soniox-tts',
  grok: 'grok-tts',
  openai: 'openai-tts',
  inworld: 'inworld-tts'
} as const satisfies Record<string, string>

export const STANDALONE_IMAGE_PROVIDER_TARGETS = deriveProviderTargets(IMAGE_SELECTION_ENTRIES)

export const STANDALONE_VIDEO_PROVIDER_TARGETS = deriveProviderTargets(VIDEO_SELECTION_ENTRIES)

export const STANDALONE_MUSIC_PROVIDER_TARGETS = deriveProviderTargets(MUSIC_SELECTION_ENTRIES)

const defineGenerationSelectionDescriptor = <
  const TProviderTargets extends Readonly<Record<string, string>>,
  const TSelections extends GenerationSelectionFields<TProviderTargets>
>(
  providerTargets: TProviderTargets,
  selections: TSelections & Record<Exclude<keyof TSelections, keyof TProviderTargets>, never>
) => ({ providerTargets, selections })

export const deriveGenerationPricingProviders = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor
): GenerationPricingProviders<TDescriptor> =>
  Object.keys(descriptor.providerTargets).map((service) => ({
    service,
    modelsKey: descriptor.selections[service]!.modelsKey
  })) as GenerationPricingProviders<TDescriptor>

export const deriveGenerationResumeModelFields = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.keys(descriptor.providerTargets).map((service) => [
    service,
    descriptor.selections[service]!.modelsKey
  ]))

export const deriveGenerationResumeProviderFlags = <const TDescriptor extends GenerationSelectionDescriptor>(
  descriptor: TDescriptor,
  ...shortcutFlags: readonly string[]
): readonly string[] => [...shortcutFlags, ...Object.values(descriptor.providerTargets)]

export const TTS_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  STANDALONE_TTS_PROVIDER_TARGETS,
  {
    gemini: { modelsKey: 'geminiTtsModels' },
    elevenlabs: { modelsKey: 'elevenlabsTtsModels' },
    soniox: { modelsKey: 'sonioxTtsModels' },
    grok: { modelsKey: 'grokTtsModels' },
    openai: { modelsKey: 'openaiTtsModels' },
    inworld: { modelsKey: 'inworldTtsModels' }
  }
)

export const IMAGE_GENERATION_SELECTION = deriveSelectionDescriptor(IMAGE_SELECTION_ENTRIES, STANDALONE_IMAGE_PROVIDER_TARGETS)

export const VIDEO_GENERATION_SELECTION = deriveSelectionDescriptor(VIDEO_SELECTION_ENTRIES, STANDALONE_VIDEO_PROVIDER_TARGETS)

export const MUSIC_GENERATION_SELECTION = deriveSelectionDescriptor(MUSIC_SELECTION_ENTRIES, STANDALONE_MUSIC_PROVIDER_TARGETS)

export const pickProviderTargets = <T extends Readonly<Record<string, string>>, K extends keyof T & string>(
  targets: T,
  keys: readonly K[]
): Pick<T, K> => Object.fromEntries(keys.map((key) => [key, targets[key]])) as Pick<T, K>

// Comic selects one image target per run from the standalone image providers.
export const COMIC_IMAGE_PROVIDER_TARGETS = STANDALONE_IMAGE_PROVIDER_TARGETS

export const WRITE_STT_PROVIDER_TARGETS = {
  deepinfra: 'deepinfra-stt',
  deepgram: 'deepgram-stt',
  soniox: 'soniox-stt',
  speechmatics: 'speechmatics-stt',
  grok: 'grok-stt',
  mistral: 'mistral-stt',
  assemblyai: 'assemblyai-stt',
  gladia: 'gladia-stt',
  scrapecreators: 'scrapecreators-stt',
  gemini: 'gemini-stt',
  together: 'together-stt',
  openai: 'openai-stt',
  cloudflare: 'cloudflare-stt',
  whisperfile: 'whisperfile-stt'
} as const satisfies Record<string, string>

export const WRITE_OCR_PROVIDER_TARGETS = {
  tesseract: 'tesseract-ocr',
  mistral: 'mistral-ocr',
  openai: 'openai-ocr',
  grok: 'grok-ocr',
  anthropic: 'anthropic-ocr',
  gemini: 'gemini-ocr'
} as const satisfies Record<string, string>

export const WRITE_LLM_PROVIDER_TARGETS = {
  openai: 'openai',
  gemini: 'gemini',
  anthropic: 'anthropic',
  grok: 'grok',
} as const satisfies Record<string, string>

// Comic's text roles use the shared LLM registry. The QA vision judge is restricted structurally:
// openai and gemini are the only keys, so an unsupported provider is rejected by the shared selector
// with a derived message instead of a hand-written capability check.
export const COMIC_LLM_PROVIDER_TARGETS = WRITE_LLM_PROVIDER_TARGETS
export const COMIC_QA_PROVIDER_TARGETS = pickProviderTargets(WRITE_LLM_PROVIDER_TARGETS, ['openai', 'gemini'])

export const WRITE_LLM_GENERATION_SELECTION = defineGenerationSelectionDescriptor(
  WRITE_LLM_PROVIDER_TARGETS,
  {
    openai: { modelsKey: 'openaiModels' },
    gemini: { modelsKey: 'geminiModels' },
    anthropic: { modelsKey: 'anthropicModels' },
    grok: { modelsKey: 'grokModels' },
  }
)

export const BOOLEAN_PROVIDER_TARGETS = new Set<string>([
  'tesseract-ocr'
])
