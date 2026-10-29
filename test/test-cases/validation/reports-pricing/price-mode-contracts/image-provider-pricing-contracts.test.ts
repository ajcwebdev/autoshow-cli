import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { estimateImageCosts } from '~/cli/commands/visuals/image/image-utils/image-pricing'

const openaiStep5 = (imageSize: string, imageQuality: string, imageWidth: number, imageHeight: number) => ({
  imageService: 'openai' as const,
  imageModel: 'gpt-image-2.5-flare',
  processingTime: 10_000,
  imageFileNames: ['generated-image.png'],
  imageCount: 1,
  imageFileSize: 1234,
  imageWidth,
  imageHeight,
  imageSize,
  imageQuality,
  imageFormat: 'png',
  requestMode: 'generation' as const
})

describe('price mode contracts', () => {

  test('Grok image estimates use the registry size and quality table', () => {
      expect(estimateImageCosts({
        grokImageModels: ['grok-imagine-image-2.0'],
        imageSize: '1K',
        imageQuality: 'low'
      })[0]?.costPerImageCents).toBe(4)
      expect(estimateImageCosts({
        grokImageModels: ['grok-imagine-image-2.0'],
        imageSize: '2K',
        imageQuality: 'medium'
      })[0]?.costPerImageCents).toBe(8)
      expect(estimateImageCosts({
        grokImageModels: ['grok-imagine-image-2.0'],
        imageSize: '2K',
        imageQuality: 'auto'
      })[0]?.costPerImageCents).toBe(6)
      expect(estimateImageCosts({
        grokImageModels: ['grok-imagine-image-2.0'],
        imageSize: '2K',
        imageQuality: 'medium'
      })[0]?.note).toContain('xAI')
    })

  test('OpenAI actual fallback cost preserves image options', () => {
      const lowSquare = computeActualCosts({ step5: openaiStep5('1024x1024', 'low', 1024, 1024) })
      const lowSquareEstimate = estimateImageCosts({ openaiImageModels: ['gpt-image-2.5-flare'], imageSize: '1024x1024', imageQuality: 'low' })[0]?.costPerImageCents

      expect(lowSquare.steps[0]).toMatchObject({
        step: 'image',
        provider: 'openai',
        model: 'gpt-image-2.5-flare',
        cost: 0.588
      })
      expect(lowSquare.steps[0]?.cost).toBe(lowSquareEstimate)

      const highPortrait = computeActualCosts({ step5: openaiStep5('1024x1536', 'high', 1024, 1536) })
      const highPortraitEstimate = estimateImageCosts({ openaiImageModels: ['gpt-image-2.5-flare'], imageSize: '1024x1536', imageQuality: 'high' })[0]?.costPerImageCents

      expect(highPortrait.steps[0]).toMatchObject({
        step: 'image',
        provider: 'openai',
        model: 'gpt-image-2.5-flare',
        cost: 4.116
      })
      expect(highPortrait.steps[0]?.cost).toBe(highPortraitEstimate)
    })
})
