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
    'openai:gpt-4o-mini-tts': { inputCostPer1MCharsCents: 60, outputCostPer1MCharsCents: 1200 },
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
  tts: {},
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
