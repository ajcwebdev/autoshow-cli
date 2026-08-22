import { describe, expect, test } from 'bun:test'
import {
  estimateImageCosts,
  IMAGE_PRICING_MODEL_KEYS,
  IMAGE_PRICING_PROVIDERS
} from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import {
  estimateVideoCost,
  estimateVideoCosts,
  VIDEO_PRICING_MODEL_KEYS,
  VIDEO_PRICING_PROVIDERS
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import {
  estimateMusicCosts,
  MUSIC_PRICING_MODEL_KEYS,
  MUSIC_PRICING_PROVIDERS
} from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import {
  SUPPORTED_BFL_IMAGE_MODELS,
  SUPPORTED_FAL_IMAGE_MODELS,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_LUMALABS_IMAGE_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_REPLICATE_IMAGE_MODELS
} from '~/cli/commands/setup-and-utilities/models/image-models'
import {
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_GEMINI_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS
} from '~/cli/commands/setup-and-utilities/models/music-models'
import {
  SUPPORTED_FAL_VIDEO_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_LTX_VIDEO_MODELS,
  SUPPORTED_LUMALABS_VIDEO_MODELS,
  SUPPORTED_REPLICATE_VIDEO_MODELS
} from '~/cli/commands/setup-and-utilities/models/video-models'
import type { ImageProvider, MusicProvider, VideoProvider } from '~/types'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { optionsForService } from '~/utils/pricing/model-selection'

const IMAGE_MODELS = {
  gemini: SUPPORTED_GEMINI_IMAGE_MODELS,
  openai: SUPPORTED_OPENAI_IMAGE_MODELS,
  grok: SUPPORTED_GROK_IMAGE_MODELS,
  bfl: SUPPORTED_BFL_IMAGE_MODELS,
  replicate: SUPPORTED_REPLICATE_IMAGE_MODELS,
  lumalabs: SUPPORTED_LUMALABS_IMAGE_MODELS,
  fal: SUPPORTED_FAL_IMAGE_MODELS
} as const satisfies Record<ImageProvider, readonly string[]>

const VIDEO_MODELS = {
  gemini: SUPPORTED_GEMINI_VIDEO_MODELS,
  grok: SUPPORTED_GROK_VIDEO_MODELS,
  ltx: SUPPORTED_LTX_VIDEO_MODELS,
  replicate: SUPPORTED_REPLICATE_VIDEO_MODELS,
  lumalabs: SUPPORTED_LUMALABS_VIDEO_MODELS,
  fal: SUPPORTED_FAL_VIDEO_MODELS
} as const satisfies Record<VideoProvider, readonly string[]>

const MUSIC_MODELS = {
  elevenlabs: SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  minimax: SUPPORTED_MINIMAX_MUSIC_MODELS,
  gemini: SUPPORTED_GEMINI_MUSIC_MODELS
} as const satisfies Record<MusicProvider, readonly string[]>

describe('generation pricing model-selection tables', () => {
  test('tables preserve provider priority and expose both pass-through keys', () => {
    expect(IMAGE_PRICING_PROVIDERS.map(({ service }) => service)).toEqual([
      'gemini', 'openai', 'grok', 'bfl', 'replicate', 'lumalabs', 'fal'
    ])
    expect(VIDEO_PRICING_PROVIDERS.map(({ service }) => service)).toEqual([
      'gemini', 'grok', 'ltx', 'replicate', 'lumalabs', 'fal'
    ])
    expect(MUSIC_PRICING_PROVIDERS.map(({ service }) => service)).toEqual([
      'elevenlabs', 'minimax', 'gemini'
    ])
    expect(IMAGE_PRICING_MODEL_KEYS).toHaveLength(IMAGE_PRICING_PROVIDERS.length)
    expect(VIDEO_PRICING_MODEL_KEYS).toHaveLength(VIDEO_PRICING_PROVIDERS.length)
    expect(MUSIC_PRICING_MODEL_KEYS).toHaveLength(MUSIC_PRICING_PROVIDERS.length)
  })

  test('string and array selectors produce identical estimates for every registered model', () => {
    for (const provider of IMAGE_PRICING_PROVIDERS) {
      for (const model of IMAGE_MODELS[provider.service]) {
        const singular = estimateImageCosts(optionsForService(IMAGE_PRICING_PROVIDERS, provider.service, model))
        const plural = estimateImageCosts(optionsForService(IMAGE_PRICING_PROVIDERS, provider.service, [model]))
        expect(plural).toEqual(singular)
      }
    }

    for (const provider of VIDEO_PRICING_PROVIDERS) {
      for (const model of VIDEO_MODELS[provider.service]) {
        for (const videoDuration of [undefined, 5, 8]) {
          const singularOptions = { ...optionsForService(VIDEO_PRICING_PROVIDERS, provider.service, model), videoDuration }
          const pluralOptions = { ...optionsForService(VIDEO_PRICING_PROVIDERS, provider.service, [model]), videoDuration }
          expect(estimateVideoCosts(pluralOptions)).toEqual(estimateVideoCosts(singularOptions))
          expect(estimateVideoCost(pluralOptions)).toEqual(estimateVideoCosts(pluralOptions)[0]!)
        }
      }
    }

    for (const provider of MUSIC_PRICING_PROVIDERS) {
      for (const model of MUSIC_MODELS[provider.service]) {
        for (const musicDuration of [undefined, 60, 120]) {
          const singular = estimateMusicCosts({ ...optionsForService(MUSIC_PRICING_PROVIDERS, provider.service, model), musicDuration })
          const plural = estimateMusicCosts({ ...optionsForService(MUSIC_PRICING_PROVIDERS, provider.service, [model]), musicDuration })
          expect(plural).toEqual(singular)
        }
      }
    }
  })

  test('an explicitly empty array selector produces no image or music estimates', () => {
    expect(estimateImageCosts({
      geminiImageModels: []
    })).toEqual([])
    expect(estimateMusicCosts({
      elevenlabsMusicModels: []
    })).toEqual([])
  })

  test('video and music cost targets retain their own durations', () => {
    const estimated = computeEstimatedCosts({
      applyCostMultipliers: false,
      videoTargets: [
        { service: 'gemini', model: 'veo-3.1-lite-generate-preview', durationSeconds: 4 },
        { service: 'gemini', model: 'veo-3.1-lite-generate-preview', durationSeconds: 8 }
      ],
      musicTargets: [
        { service: 'elevenlabs', model: 'music_v2', durationSeconds: 60 },
        { service: 'elevenlabs', model: 'music_v2', durationSeconds: 120 }
      ]
    })

    expect(estimated.steps.filter(({ step }) => step === 'video')).toMatchObject([
      { provider: 'gemini', durationSeconds: 4, cost: 20 },
      { provider: 'gemini', durationSeconds: 8, cost: 40 }
    ])
    expect(estimated.steps.filter(({ step }) => step === 'music')).toMatchObject([
      { provider: 'elevenlabs', durationSeconds: 60, cost: 15 },
      { provider: 'elevenlabs', durationSeconds: 120, cost: 30 }
    ])
  })
})
