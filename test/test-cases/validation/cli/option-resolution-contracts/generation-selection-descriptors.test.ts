import { describe, expect, test } from 'bun:test'
import { IMAGE_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { VIDEO_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { MUSIC_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { imageResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/image-resume'
import { musicResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/music-resume'
import { videoResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/video-resume'
import {
  IMAGE_GENERATION_SELECTION,
  MUSIC_GENERATION_SELECTION,
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  VIDEO_GENERATION_SELECTION
} from '~/cli/flags/service-selector-normalization/provider-targets'

const DOMAINS = [
  {
    name: 'image',
    allProvidersFlag: 'all-image',
    providerTargets: STANDALONE_IMAGE_PROVIDER_TARGETS,
    descriptor: IMAGE_GENERATION_SELECTION,
    pricingProviders: IMAGE_PRICING_PROVIDERS,
    resumeConfig: imageResumeConfig
  },
  {
    name: 'video',
    allProvidersFlag: 'all-video',
    providerTargets: STANDALONE_VIDEO_PROVIDER_TARGETS,
    descriptor: VIDEO_GENERATION_SELECTION,
    pricingProviders: VIDEO_PRICING_PROVIDERS,
    resumeConfig: videoResumeConfig
  },
  {
    name: 'music',
    allProvidersFlag: 'all-music',
    providerTargets: STANDALONE_MUSIC_PROVIDER_TARGETS,
    descriptor: MUSIC_GENERATION_SELECTION,
    pricingProviders: MUSIC_PRICING_PROVIDERS,
    resumeConfig: musicResumeConfig
  }
] as const

describe('generation selection descriptors', () => {
  test('every public provider target reaches pricing and resume selection', () => {
    for (const domain of DOMAINS) {
      const publicServices = Object.keys(domain.providerTargets)
      expect(domain.descriptor.providerTargets, domain.name).toBe(domain.providerTargets)
      expect(Object.keys(domain.descriptor.selections), domain.name).toEqual(publicServices)
      expect(domain.pricingProviders.map(({ service }) => String(service)), domain.name).toEqual(publicServices)
      expect(Object.keys(domain.resumeConfig.modelFields), domain.name).toEqual(publicServices)
      expect(domain.resumeConfig.providerFlags, domain.name).toEqual([
        domain.allProvidersFlag,
        ...Object.values(domain.providerTargets)
      ])
    }
  })

  test('every pricing and resume selection resolves back to its public provider target', () => {
    for (const domain of DOMAINS) {
      const descriptorPricing = Object.entries(domain.descriptor.selections).map(([service, selection]) => ({
        service,
        modelsKey: selection.modelsKey,
        modelKey: selection.modelKey
      }))
      const descriptorModelFields = Object.fromEntries(
        Object.entries(domain.descriptor.selections).map(([service, selection]) => [
          service,
          [selection.modelsKey, selection.modelKey] as const
        ])
      )
      expect<unknown>(domain.pricingProviders, domain.name).toEqual(descriptorPricing)
      expect<unknown>(domain.resumeConfig.modelFields, domain.name).toEqual(descriptorModelFields)
      expect(domain.resumeConfig.providerFlags.slice(1), domain.name).toEqual(Object.values(domain.providerTargets))
    }
  })
})
