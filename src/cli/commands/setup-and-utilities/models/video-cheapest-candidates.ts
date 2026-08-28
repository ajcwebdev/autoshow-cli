import type { CheapestVideoSelection } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { getModelRegistry } from './model-loader'

export type CheapestVideoProvider = 'gemini' | 'grok' | 'ltx' | 'replicate' | 'lumalabs' | 'fal'

const TEXT_VIDEO_PROVIDERS = ['gemini', 'grok', 'ltx', 'replicate', 'lumalabs', 'fal'] as const
const PERFORMANCE_TIE_BREAKERS = ['mini', 'nano', 'micro', 'flash', 'turbo', 'fast', 'small']

const runtimeRank = (model: string): number => {
  const rank = PERFORMANCE_TIE_BREAKERS.findIndex((token) => model.toLowerCase().includes(token))
  return rank === -1 ? PERFORMANCE_TIE_BREAKERS.length : rank
}

const qualityRank = (selection: Pick<CheapestVideoSelection, 'size' | 'resolution'>): number => {
  if (selection.size === '1024x1792' || selection.size === '1792x1024') return 2
  return selection.resolution === '1080p' ? 2 : 1
}

const providerVideoEstimateOptions = (
  provider: CheapestVideoProvider,
  model: string
): Parameters<typeof estimateVideoCost>[0] => ({
  ...(provider === 'gemini' ? { geminiVideoModels: [model] } : {}),
  ...(provider === 'grok' ? { grokVideoModels: [model] } : {}),
  ...(provider === 'ltx' ? { ltxVideoModels: [model] } : {}),
  ...(provider === 'replicate' ? { replicateVideoModels: [model] } : {}),
  ...(provider === 'lumalabs' ? { lumalabsVideoModels: [model] } : {}),
  ...(provider === 'fal' ? { falVideoModels: [model] } : {}),
  videoMode: 'text'
})

const estimateCandidate = (
  provider: CheapestVideoProvider,
  model: string,
  options: Parameters<typeof estimateVideoCost>[0]
): CheapestVideoSelection | undefined => {
  try {
    const estimate = estimateVideoCost(options)
    return {
      provider,
      model,
      duration: options.videoDuration ?? estimate.durationSeconds,
      ...(options.videoResolution ? { resolution: options.videoResolution } : {}),
      totalCost: estimate.totalCost
    }
  } catch {
    return undefined
  }
}

const generateProviderCandidates = (provider: CheapestVideoProvider): CheapestVideoSelection[] => {
  const service = getModelRegistry().video[provider]
  if (!service) throw InternalError(`Missing video service config: ${provider}`, { stage: 'models:cheapest' })
  const models = Object.keys(service.models)
  if (provider === 'replicate') {
    return models.flatMap((model) => {
      const candidate = estimateCandidate(provider, model, providerVideoEstimateOptions(provider, model))
      return candidate ? [candidate] : []
    })
  }
  const durations = service.billedDurations?.length ? service.billedDurations : [4]
  const resolutions = service.resolutions?.length ? service.resolutions : ['720p']
  return models.flatMap((model) => durations.flatMap((duration) => resolutions.flatMap((resolution) => {
    const candidate = estimateCandidate(provider, model, {
      ...providerVideoEstimateOptions(provider, model),
      videoDuration: duration,
      videoResolution: resolution
    })
    return candidate ? [candidate] : []
  })))
}

const compareProviderCandidates = (left: CheapestVideoSelection, right: CheapestVideoSelection): number =>
  left.totalCost - right.totalCost
  || left.duration - right.duration
  || qualityRank(left) - qualityRank(right)
  || runtimeRank(left.model) - runtimeRank(right.model)
  || left.model.localeCompare(right.model)

export const selectCheapestVideoCandidateSelection = (
  provider: CheapestVideoProvider
): CheapestVideoSelection => {
  const best = generateProviderCandidates(provider).sort(compareProviderCandidates)[0]
  if (!best) throw InternalError(`No video candidates available for ${provider}`, { stage: 'models:cheapest' })
  return best
}

const generateDefaultTextCandidates = (): CheapestVideoSelection[] =>
  TEXT_VIDEO_PROVIDERS.flatMap((provider) => {
    const service = getModelRegistry().video[provider]
    if (!service) return []
    return Object.keys(service.models).flatMap((model) => {
      const candidate = estimateCandidate(provider, model, providerVideoEstimateOptions(provider, model))
      return candidate ? [candidate] : []
    })
  })

export const selectCheapestDefaultTextVideoCandidate = (): CheapestVideoSelection => {
  const best = generateDefaultTextCandidates().sort((left, right) =>
    left.totalCost - right.totalCost
    || left.duration - right.duration
    || runtimeRank(left.model) - runtimeRank(right.model)
    || `${left.provider}/${left.model}`.localeCompare(`${right.provider}/${right.model}`)
  )[0]
  if (!best) throw InternalError('No default text-to-video candidates available', { stage: 'models:cheapest' })
  return best
}
