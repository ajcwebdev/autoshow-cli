import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'

describe('price mode contracts', () => {

  test('OpenAI image estimates use model size and quality tables', () => {
      expect(estimateImageCosts({
        openaiImageModels: ['gpt-image-2'],
        imageSize: '1024x1024',
        imageQuality: 'low'
      })[0]?.costPerImageCents).toBe(0.6)
      expect(estimateImageCosts({
        openaiImageModels: ['gpt-image-2'],
        imageSize: '1536x1024',
        imageQuality: 'high'
      })[0]?.costPerImageCents).toBe(16.5)
      expect(estimateImageCosts({
        openaiImageModels: ['gpt-image-2'],
        imageSize: 'auto',
        imageQuality: 'auto'
      })[0]?.costPerImageCents).toBe(5.3)
      expect(estimateImageCosts({
        openaiImageModels: ['gpt-image-2'],
        imageSize: '2048x2048',
        imageQuality: 'high'
      })[0]?.note).toContain('OpenAI')
    })

  test('OpenAI actual fallback cost preserves image options', () => {
      const cost = computeActualCosts({
        step5: {
          imageService: 'openai',
          imageModel: 'gpt-image-2',
          processingTime: 10_000,
          imageFileNames: ['generated-image.png'],
          imageCount: 1,
          imageFileSize: 1234,
          imageWidth: 1024,
          imageHeight: 1024,
          imageSize: '1024x1024',
          imageQuality: 'low',
          imageFormat: 'png',
          requestMode: 'generation'
        }
      })

      expect(cost.steps[0]).toMatchObject({
        step: 'image',
        provider: 'openai',
        model: 'gpt-image-2',
        cost: 0.6
      })

      const highPortraitCost = computeActualCosts({
        step5: {
          imageService: 'openai',
          imageModel: 'gpt-image-2',
          processingTime: 10_000,
          imageFileNames: ['generated-image.png'],
          imageCount: 1,
          imageFileSize: 1234,
          imageWidth: 1024,
          imageHeight: 1536,
          imageSize: '1024x1536',
          imageQuality: 'high',
          imageFormat: 'png',
          requestMode: 'generation'
        }
      })

      expect(highPortraitCost.steps[0]).toMatchObject({
        step: 'image',
        provider: 'openai',
        model: 'gpt-image-2',
        cost: 16.5
      })
    })
})
