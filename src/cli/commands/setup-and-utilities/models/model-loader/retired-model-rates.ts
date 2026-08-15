import type { ModelRegistry } from '~/types'

export type ModelCategory = keyof ModelRegistry

export type RetiredModelRate<Category extends ModelCategory> = Partial<
  ModelRegistry[Category][string]['models'][string]
>

type RetiredModelRates = {
  readonly [Category in ModelCategory]: Readonly<Record<string, RetiredModelRate<Category>>>
}

type RetiredModelReplacements = {
  readonly [Category in ModelCategory]: Readonly<Record<string, string>>
}

export const modelRateKey = (service: string, model: string): string => `${service}:${model}`

// Historical pricing only. These models remain absent from active validation,
// defaults, help, and provider expansion. Rates are the cents fields present in
// the registry immediately before retirement; the one never-priced Opus OCR
// identity retains the explicit zero rate recorded in the benchmark corpus.
export const RETIRED_MODEL_RATES: RetiredModelRates = {
  stt: {},
  extract: {
    'anthropic:claude-opus-4-7': { costPerMInputTokensCents: 0, costPerMOutputTokensCents: 0 },
    'anthropic:claude-sonnet-4-6': { costPerMInputTokensCents: 300, costPerMOutputTokensCents: 1500 },
    'gemini:gemini-3.1-flash-lite': { costPerMInputTokensCents: 25, costPerMOutputTokensCents: 150 },
    'gemini:gemini-3.1-flash-lite-preview': { costPerMInputTokensCents: 25, costPerMOutputTokensCents: 150 }
  },
  llm: {
    'gemini:gemini-3.1-flash-lite': { inputCostPer1MCents: 25, outputCostPer1MCents: 150 },
    'gemini:gemini-3.1-flash-lite-preview': { inputCostPer1MCents: 25, outputCostPer1MCents: 150 }
  },
  tts: {
    'cartesia:sonic-3': { costPer1kCharsCents: 3.7375 },
    'cartesia:sonic-3.5': { costPer1kCharsCents: 3.7375 },
    'deepinfra:ResembleAI/chatterbox-multilingual': { costPer1kCharsCents: 0.1 },
    'elevenlabs:eleven_flash_v2_5': { costPer1kCharsCents: 5 },
    'elevenlabs:eleven_multilingual_v2': { costPer1kCharsCents: 10 },
    'fish:fish-speech-1.5': { costPer1kCharsCents: 5 },
    'fish:s1': { costPer1kCharsCents: 5 },
    'fish:s2-pro': { costPer1kCharsCents: 10 },
    'fish:voice-design-1': { costPer1kCharsCents: 20 },
    'groq:canopylabs/orpheus-arabic-saudi': { costPer1kCharsCents: 4 },
    'inworld:realtime-tts-2-flash': { costPer1kCharsCents: 1.5 },
    'openai:gpt-4o-mini-tts': { inputCostPer1MCharsCents: 60, outputCostPer1MCharsCents: 1200 },
    'openai:tts-1': { inputCostPer1MCharsCents: 0, outputCostPer1MCharsCents: 1500 },
    'openai:tts-1-hd': { inputCostPer1MCharsCents: 0, outputCostPer1MCharsCents: 3000 },
    'speechify:simba-3.0': { costPer1kCharsCents: 1 },
    'speechify:simba-english': { costPer1kCharsCents: 1 }
  },
  image: {
    'gemini:gemini-3.1-flash-image-preview': { costPerImageCents: 6.7 },
    'reve:latest': { costPerImageCents: 0.13333333333333333 },
    'reve:reve-create@20250915': { costPerImageCents: 0.13333333333333333 }
  },
  music: {
    'minimax:music-2.6': { costPerTrackCents: 15, lyricsCostPerTrackCents: 1 }
  },
  video: {
    'replicate:alibaba/happyhorse-1.0': {
      costPerSecondByResolutionCents: { '720p': 14, '1080p': 28 }
    }
  }
}

export const RETIRED_MODEL_REPLACEMENTS: RetiredModelReplacements = {
  stt: {},
  extract: {
    'gemini:gemini-3.1-flash-lite': 'gemini-3.5-flash-lite'
  },
  llm: {
    'gemini:gemini-3.1-flash-lite': 'gemini-3.5-flash-lite'
  },
  tts: {
    'deepinfra:ResembleAI/chatterbox-multilingual': 'ResembleAI/chatterbox-turbo',
    'elevenlabs:eleven_flash_v2_5': 'eleven_v3',
    'elevenlabs:eleven_multilingual_v2': 'eleven_v3',
    'fish:fish-speech-1.5': 's2.1-pro',
    'fish:s1': 's2.1-pro',
    'fish:s2-pro': 's2.1-pro',
    'fish:voice-design-1': 's2.1-pro',
    'groq:canopylabs/orpheus-arabic-saudi': 'canopylabs/orpheus-v1-english',
    'inworld:realtime-tts-2-flash': 'realtime-tts-2',
    'openai:tts-1': 'gpt-4o-mini-tts-2025-12-15',
    'openai:tts-1-hd': 'gpt-4o-mini-tts-2025-12-15',
    'speechify:simba-3.0': 'simba-3.2'
  },
  image: {},
  music: {},
  video: {}
}

export const getRetiredModelRate = <Category extends ModelCategory>(
  category: Category,
  service: string,
  model: string
): RetiredModelRate<Category> | undefined =>
  RETIRED_MODEL_RATES[category][modelRateKey(service, model)] as RetiredModelRate<Category> | undefined

export const hasRetiredModelRate = (
  category: ModelCategory,
  service: string,
  model: string
): boolean => getRetiredModelRate(category, service, model) !== undefined

export const getRetiredModelReplacement = (
  category: ModelCategory,
  service: string,
  model: string
): string | undefined => RETIRED_MODEL_REPLACEMENTS[category][modelRateKey(service, model)]
