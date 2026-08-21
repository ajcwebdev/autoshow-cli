import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { getModelRegistry } from './model-loader'
import { filterModelNamesByLifecycle } from './model-loader/model-lifecycle'
import { InternalError } from '~/utils/error-handler'
import type { CheapestLlmSelection, CheapestTtsSelection, CheapestVideoSelection, Step3Metadata, TtsProvider } from '~/types'
import { STANDALONE_TTS_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { DEFAULT_DEEPINFRA_OCR_MODEL } from './ocr-models'

const PERFORMANCE_TIE_BREAKERS = ['mini', 'nano', 'micro', 'flash', 'turbo', 'fast', 'small']

const DEFAULT_LOCAL_MODEL_BY_FLAG = {
  whisper: 'tiny',
} as const satisfies Record<string, string>

const DEFAULT_HOSTED_TTS_MODEL_BY_FLAG = {
  'elevenlabs-tts': 'eleven_v3',
  'groq-tts': 'canopylabs/orpheus-v1-english',
  'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
  'deepgram-tts': 'aura-2-thalia-en',
  'speechify-tts': 'simba-3.2',
  'cartesia-tts': 'sonic-3.5-2026-05-04',
  'fish-tts': 's2.1-pro',
  'inworld-tts': 'realtime-tts-2',
  'deepinfra-tts': 'ResembleAI/chatterbox-turbo',
  'replicate-tts': 'jaaari/kokoro-82m',
  'fal-tts': 'fal-ai/bytedance/seed-speech/tts/v2'
} as const satisfies Record<string, string>

const DEFAULT_OCR_INPUT_TOKENS_PER_PAGE = 4000
const DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE = 1000

const runtimeRank = (model: string): number => {
  const lower = model.toLowerCase()
  const idx = PERFORMANCE_TIE_BREAKERS.findIndex(token => lower.includes(token))
  return idx === -1 ? PERFORMANCE_TIE_BREAKERS.length : idx
}

const pickCheapestModel = (
  modelNames: string[],
  costForModel: (model: string) => number
): string => {
  const firstModel = modelNames[0]
  if (!firstModel) {
    throw InternalError('No models available to select from', { stage: 'models:cheapest' })
  }

  return modelNames
    .slice()
    .sort((a, b) => {
      const costDelta = costForModel(a) - costForModel(b)
      if (costDelta !== 0) return costDelta

      const rankDelta = runtimeRank(a) - runtimeRank(b)
      if (rankDelta !== 0) return rankDelta

      return a.localeCompare(b)
    })[0] ?? firstModel
}

const selectCheapestRegistryModel = <T extends Record<string, unknown>>(
  models: Record<string, T>,
  costForModel: (model: T) => number
): string =>
  pickCheapestModel(Object.keys(models), (modelName) => {
    const meta = models[modelName]
    return meta ? costForModel(meta) : Number.POSITIVE_INFINITY
  })

const sttHourlyCost = (model: {
  costPerHourCents: number
}): number => model.costPerHourCents

/**
 * The one ordering every cheapest-model selection uses: lowest cost wins, then any
 * family-specific dimensions in the order given (shorter runtime, lower quality tier),
 * then the faster-sounding model name, then stable lexical identity so ties never depend
 * on registry iteration order.
 */
const beatsCurrentBest = <TCandidate>(
  candidate: TCandidate,
  best: NoInfer<TCandidate> | null | undefined,
  dimensions: {
    cost: (value: TCandidate) => number
    ordered?: ReadonlyArray<(value: TCandidate) => number> | undefined
    runtimeRank: (value: TCandidate) => number
    identity: (value: TCandidate) => string
  }
): boolean => {
  if (!best) return true

  const keys = [dimensions.cost, ...(dimensions.ordered ?? []), dimensions.runtimeRank]
  for (const key of keys) {
    const candidateValue = key(candidate)
    const bestValue = key(best)
    if (candidateValue !== bestValue) return candidateValue < bestValue
  }

  return dimensions.identity(candidate).localeCompare(dimensions.identity(best)) < 0
}

const qualityRank = (selection: { size?: string | undefined, resolution?: string | undefined }): number => {
  if (selection.size === '1024x1792' || selection.size === '1792x1024') return 2
  if (selection.resolution === '1080p') return 2
  return 1
}

const selectCheapestSttModel = (service: string): string => {
  const serviceConfig = getModelRegistry().stt[service]
  if (!serviceConfig) {
    throw InternalError(`Missing STT service config: ${service}`, { stage: 'models:cheapest' })
  }

  return selectCheapestRegistryModel(serviceConfig.models, sttHourlyCost)
}

const selectCheapestExtractModel = (service: 'mistral' | 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra'): string => {
  const serviceConfig = getModelRegistry().extract[service]
  if (!serviceConfig) {
    throw InternalError(`Missing extract service config: ${service}`, { stage: 'models:cheapest' })
  }

  const defaultEligibleModels = filterModelNamesByLifecycle(
    Object.keys(serviceConfig.models),
    serviceConfig.models,
    'defaultEligible'
  )
  if (defaultEligibleModels.length === 0) {
    throw InternalError(`No default-eligible extract models available for ${service}`, { stage: 'models:cheapest' })
  }

  return pickCheapestModel(defaultEligibleModels, (modelName) => {
    const model = serviceConfig.models[modelName]
    if (!model) return Number.POSITIVE_INFINITY
    if (typeof model.costPer1kPagesCents === 'number') {
      return model.costPer1kPagesCents / 1000
    }
    if (typeof model.costPerMInputTokensCents === 'number' && typeof model.costPerMOutputTokensCents === 'number') {
      const promptTokensPerPage = model.estimation?.promptTokensPerPage ?? DEFAULT_OCR_INPUT_TOKENS_PER_PAGE
      const completionTokensPerPage = model.estimation?.completionTokensPerPage ?? DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE
      return (promptTokensPerPage / 1_000_000) * model.costPerMInputTokensCents
        + (completionTokensPerPage / 1_000_000) * model.costPerMOutputTokensCents
    }
    return Number.POSITIVE_INFINITY
  })
}

const selectCheapestLlmModel = (service: string): string => {
  const serviceConfig = getModelRegistry().llm[service]
  if (!serviceConfig) {
    throw InternalError(`Missing LLM service config: ${service}`, { stage: 'models:cheapest' })
  }

  const defaultEligibleModels = filterModelNamesByLifecycle(
    Object.keys(serviceConfig.models),
    serviceConfig.models,
    'defaultEligible'
  )
  if (defaultEligibleModels.length === 0) {
    throw InternalError(`No default-eligible LLM models available for ${service}`, { stage: 'models:cheapest' })
  }

  return pickCheapestModel(defaultEligibleModels, (modelName) => {
    const model = serviceConfig.models[modelName]
    return model
      ? model.inputCostPer1MCents + model.outputCostPer1MCents
      : Number.POSITIVE_INFINITY
  })
}

const ttsModelCost = (model: {
  costPerRequestCents?: number | undefined
  costPer1kCharsCents?: number | undefined
  inputCostPer1MCharsCents?: number | undefined
  outputCostPer1MCharsCents?: number | undefined
}): number => {
  if (typeof model.costPerRequestCents === 'number') {
    return model.costPerRequestCents
  }
  if (typeof model.costPer1kCharsCents === 'number') {
    return model.costPer1kCharsCents
  }
  if (typeof model.inputCostPer1MCharsCents === 'number' && typeof model.outputCostPer1MCharsCents === 'number') {
    return (model.inputCostPer1MCharsCents + model.outputCostPer1MCharsCents) / 1000
  }
  return Number.POSITIVE_INFINITY
}

const selectCheapestTtsModel = (service: string): string => {
  const serviceConfig = getModelRegistry().tts[service]
  if (!serviceConfig) {
    throw InternalError(`Missing TTS service config: ${service}`, { stage: 'models:cheapest' })
  }

  return selectCheapestRegistryModel(serviceConfig.models, ttsModelCost)
}

const selectCheapestImageModel = (service: string): string => {
  const serviceConfig = getModelRegistry().image[service]
  if (!serviceConfig) {
    throw InternalError(`Missing image service config: ${service}`, { stage: 'models:cheapest' })
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) => model.costPerImageCents)
}

const selectCheapestMusicModel = (service: string): string => {
  const serviceConfig = getModelRegistry().music[service]
  if (!serviceConfig) {
    throw InternalError(`Missing music service config: ${service}`, { stage: 'models:cheapest' })
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) => {
    if (typeof model.costPerTrackCents === 'number') {
      return model.costPerTrackCents
    }
    if (typeof model.costPerMinuteCents === 'number') {
      return model.costPerMinuteCents
    }
    return Number.POSITIVE_INFINITY
  })
}

export const selectCheapestVideoSelection = (
  provider: 'gemini' | 'grok' | 'ltx' | 'replicate' | 'lumalabs' | 'fal'
): CheapestVideoSelection => {
  const serviceConfig = getModelRegistry().video[provider]
  if (!serviceConfig) {
    throw InternalError(`Missing video service config: ${provider}`, { stage: 'models:cheapest' })
  }

  const models = Object.keys(serviceConfig.models)
  const durations = serviceConfig.billedDurations && serviceConfig.billedDurations.length > 0
    ? serviceConfig.billedDurations
    : [4]
  const sizes = [undefined]
  const resolutions = serviceConfig.resolutions && serviceConfig.resolutions.length > 0
    ? serviceConfig.resolutions
    : ['720p']

  let best: CheapestVideoSelection | null = null

  if (provider === 'replicate') {
    for (const model of models) {
      let estimate: ReturnType<typeof estimateVideoCost>
      try {
        estimate = estimateVideoCost(providerVideoEstimateOptions(provider, model))
      } catch {
        continue
      }

      const candidate: CheapestVideoSelection = {
        provider,
        model,
        duration: estimate.durationSeconds,
        totalCost: estimate.totalCost
      }

      if (beatsCurrentBest(candidate, best, {
        cost: entry => entry.totalCost,
        runtimeRank: entry => runtimeRank(entry.model),
        identity: entry => entry.model
      })) {
        best = candidate
      }
    }

    if (!best) {
      throw InternalError(`No video candidates available for ${provider}`, { stage: 'models:cheapest' })
    }
    return best
  }

  for (const model of models) {
    for (const duration of durations) {
      for (const size of sizes) {
        for (const resolution of resolutions) {
          let estimate: ReturnType<typeof estimateVideoCost>
          try {
            estimate = estimateVideoCost({
              ...(provider === 'gemini' ? { geminiVideoModel: model } : {}),
              ...(provider === 'grok' ? { grokVideoModel: model } : {}),
              ...(provider === 'ltx' ? { ltxVideoModel: model } : {}),
              ...(provider === 'lumalabs' ? { lumalabsVideoModel: model } : {}),
              ...(provider === 'fal' ? { falVideoModel: model } : {}),
              videoDuration: duration,
              videoResolution: resolution
            })
          } catch {
            continue
          }

          const candidate: CheapestVideoSelection = {
            provider,
            model,
            duration,
            ...(size ? { size } : {}),
            ...(resolution ? { resolution } : {}),
            totalCost: estimate.totalCost
          }

          if (!best) {
            best = candidate
            continue
          }

          if (beatsCurrentBest(candidate, best, {
            cost: entry => entry.totalCost,
            ordered: [entry => entry.duration, qualityRank],
            runtimeRank: entry => runtimeRank(entry.model),
            identity: entry => entry.model
          })) {
            best = candidate
          }
        }
      }
    }
  }

  if (!best) {
    throw InternalError(`No video candidates available for ${provider}`, { stage: 'models:cheapest' })
  }

  return best
}

const selectCheapestVideoModel = (
  provider: 'gemini' | 'grok' | 'ltx' | 'replicate' | 'lumalabs' | 'fal'
): string => selectCheapestVideoSelection(provider).model

const TEXT_VIDEO_PROVIDERS = ['gemini', 'grok', 'ltx', 'replicate', 'lumalabs', 'fal'] as const

const providerVideoEstimateOptions = (
  provider: typeof TEXT_VIDEO_PROVIDERS[number],
  model: string
): Parameters<typeof estimateVideoCost>[0] => ({
  ...(provider === 'gemini' ? { geminiVideoModel: model } : {}),
  ...(provider === 'grok' ? { grokVideoModel: model } : {}),
  ...(provider === 'ltx' ? { ltxVideoModel: model } : {}),
  ...(provider === 'replicate' ? { replicateVideoModel: model } : {}),
  ...(provider === 'lumalabs' ? { lumalabsVideoModel: model } : {}),
  ...(provider === 'fal' ? { falVideoModel: model } : {}),
  videoMode: 'text'
})

export const selectCheapestDefaultTextVideoSelection = (): CheapestVideoSelection => {
  let best: CheapestVideoSelection | null = null

  for (const provider of TEXT_VIDEO_PROVIDERS) {
    const serviceConfig = getModelRegistry().video[provider]
    if (!serviceConfig) {
      continue
    }

    const models = Object.keys(serviceConfig.models)
    for (const model of models) {
      let estimate: ReturnType<typeof estimateVideoCost>
      try {
        estimate = estimateVideoCost(providerVideoEstimateOptions(provider, model))
      } catch {
        continue
      }

      const candidate: CheapestVideoSelection = {
        provider,
        model,
        duration: estimate.durationSeconds,
        totalCost: estimate.totalCost
      }

      if (!best) {
        best = candidate
        continue
      }

      if (beatsCurrentBest(candidate, best, {
        cost: entry => entry.totalCost,
        ordered: [entry => entry.duration],
        runtimeRank: entry => runtimeRank(entry.model),
        identity: entry => `${entry.provider}/${entry.model}`
      })) {
        best = candidate
      }
    }
  }

  if (!best) {
    throw InternalError('No default text-to-video candidates available', { stage: 'models:cheapest' })
  }

  return best
}

export const selectCheapestDefaultHostedTtsSelection = (): CheapestTtsSelection => {
  let best: CheapestTtsSelection | null = null

  for (const provider of Object.keys(STANDALONE_TTS_PROVIDER_TARGETS) as TtsProvider[]) {
    const serviceConfig = getModelRegistry().tts[provider]
    if (!serviceConfig || serviceConfig.type === 'local') {
      continue
    }

    for (const modelName of Object.keys(serviceConfig.models)) {
      const model = serviceConfig.models[modelName]
      if (!model) continue
      const totalCost = ttsModelCost(model)
      if (!Number.isFinite(totalCost)) continue

      const candidate: CheapestTtsSelection = {
        provider,
        model: modelName,
        totalCost
      }

      if (beatsCurrentBest(candidate, best, {
        cost: entry => entry.totalCost,
        runtimeRank: entry => runtimeRank(entry.model),
        identity: entry => `${entry.provider}/${entry.model}`
      })) {
        best = candidate
      }
    }
  }

  if (!best) {
    throw InternalError('No default hosted TTS candidates available', { stage: 'models:cheapest' })
  }

  return best
}

export const selectCheapestDefaultLlmSelection = (): CheapestLlmSelection => {
  let best: CheapestLlmSelection | null = null

  for (const provider of Object.keys(WRITE_LLM_PROVIDER_TARGETS) as Step3Metadata['llmService'][]) {
    const serviceConfig = getModelRegistry().llm[provider]
    if (!serviceConfig || serviceConfig.type === 'local') {
      continue
    }

    const defaultEligibleModels = filterModelNamesByLifecycle(
      Object.keys(serviceConfig.models),
      serviceConfig.models,
      'defaultEligible'
    )
    for (const modelName of defaultEligibleModels) {
      const model = serviceConfig.models[modelName]
      if (!model) continue
      const totalCost = model.inputCostPer1MCents + model.outputCostPer1MCents
      if (!Number.isFinite(totalCost)) continue

      const candidate: CheapestLlmSelection = {
        provider,
        model: modelName,
        totalCost
      }

      if (beatsCurrentBest(candidate, best, {
        cost: entry => entry.totalCost,
        runtimeRank: entry => runtimeRank(entry.model),
        identity: entry => `${entry.provider}/${entry.model}`
      })) {
        best = candidate
      }
    }
  }

  if (!best) {
    throw InternalError('No default hosted LLM candidates available', { stage: 'models:cheapest' })
  }

  return best
}

const FLAG_SELECTORS: Record<string, () => string | undefined> = {
  'deepinfra-stt': () => selectCheapestSttModel('deepinfra'),
  'deepgram-stt': () => selectCheapestSttModel('deepgram'),
  'soniox-stt': () => selectCheapestSttModel('soniox'),
  'speechmatics-stt': () => selectCheapestSttModel('speechmatics'),
  'rev-stt': () => selectCheapestSttModel('rev'),
  'groq-stt': () => selectCheapestSttModel('groq'),
  'grok-stt': () => selectCheapestSttModel('grok'),
  'mistral-stt': () => selectCheapestSttModel('mistral'),
  'assemblyai-stt': () => selectCheapestSttModel('assemblyai'),
  'gladia-stt': () => selectCheapestSttModel('gladia'),
  'happyscribe-stt': () => selectCheapestSttModel('happyscribe'),
  'supadata-stt': () => 'auto',
  'scrapecreators-stt': () => 'youtube-transcript',
  'gemini-stt': () => selectCheapestSttModel('gemini-stt'),
  'together-stt': () => selectCheapestSttModel('together'),
  'mistral-ocr': () => selectCheapestExtractModel('mistral'),
  'glm-ocr': () => selectCheapestExtractModel('glm'),
  'kimi-ocr': () => selectCheapestExtractModel('kimi'),
  'openai-ocr': () => selectCheapestExtractModel('openai'),
  'grok-ocr': () => 'grok-4.3',
  'anthropic-ocr': () => selectCheapestExtractModel('anthropic'),
  'gemini-ocr': () => selectCheapestExtractModel('gemini'),
  'deepinfra-ocr': () => DEFAULT_DEEPINFRA_OCR_MODEL,
  'replicate-ocr': () => 'datalab-to/ocr',
  'fal-ocr': () => 'fal-ai/got-ocr/v2',
  openai: () => selectCheapestLlmModel('openai'),
  groq: () => selectCheapestLlmModel('groq'),
  gemini: () => selectCheapestLlmModel('gemini'),
  anthropic: () => selectCheapestLlmModel('anthropic'),
  minimax: () => selectCheapestLlmModel('minimax'),
  grok: () => 'grok-4.3',
  glm: () => selectCheapestLlmModel('glm'),
  kimi: () => selectCheapestLlmModel('kimi'),
  together: () => 'glm-5.1',
  cerebras: () => selectCheapestLlmModel('cerebras'),
  'minimax-tts': () => selectCheapestTtsModel('minimax'),
  'grok-tts': () => selectCheapestTtsModel('grok'),
  'mistral-tts': () => selectCheapestTtsModel('mistral'),
  'gemini-tts': () => selectCheapestTtsModel('gemini'),
  'hume-tts': () => selectCheapestTtsModel('hume'),
  'gemini-image': () => selectCheapestImageModel('gemini'),
  'openai-image': () => selectCheapestImageModel('openai'),
  'grok-image': () => selectCheapestImageModel('grok'),
  'bfl-image': () => selectCheapestImageModel('bfl'),
  'replicate-image': () => selectCheapestImageModel('replicate'),
  'lumalabs-image': () => selectCheapestImageModel('lumalabs'),
  'fal-image': () => selectCheapestImageModel('fal'),
  'elevenlabs-music': () => selectCheapestMusicModel('elevenlabs'),
  'minimax-music': () => selectCheapestMusicModel('minimax'),
  'gemini-music': () => selectCheapestMusicModel('gemini'),
  'gemini-video': () => selectCheapestVideoModel('gemini'),
  'grok-video': () => selectCheapestVideoModel('grok'),
  'ltx-video': () => selectCheapestVideoModel('ltx'),
  'replicate-video': () => selectCheapestVideoModel('replicate'),
  'lumalabs-video': () => selectCheapestVideoModel('lumalabs'),
  'fal-video': () => selectCheapestVideoModel('fal')
}

export const resolveCheapestModelForFlag = (flagName: string): string | undefined => {
  const localDefault = DEFAULT_LOCAL_MODEL_BY_FLAG[flagName as keyof typeof DEFAULT_LOCAL_MODEL_BY_FLAG]
  if (localDefault) {
    return localDefault
  }
  const hostedTtsDefault = DEFAULT_HOSTED_TTS_MODEL_BY_FLAG[flagName as keyof typeof DEFAULT_HOSTED_TTS_MODEL_BY_FLAG]
  if (hostedTtsDefault) {
    return hostedTtsDefault
  }

  return FLAG_SELECTORS[flagName]?.()
}
