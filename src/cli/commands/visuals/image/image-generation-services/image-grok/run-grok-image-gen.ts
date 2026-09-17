import type { GrokImageModel, OpenAIImageResponse, Step5Metadata } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { runImageGeneration } from '~/cli/commands/command-shared/media-generation/image-generation-scaffold'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createOpenAIImage, openAIJsonRequest } from '~/utils/openai/openai-client'
import { imageReferenceToDataUrl, isHttpUrl } from '../../image-utils/image-inputs'
import {
  getFirstRevisedPrompt,
  writeOpenAIImageResponseData
} from '../../image-utils/image-output'
import { estimateImageCosts } from '../../image-utils/image-pricing'
import { resolveGrokImageOptions } from './grok-image-options'
export { normalizeGrokImageResolution } from './grok-image-options'

export const runGrokImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: GrokImageModel
    mode?: 'generation' | 'edit' | undefined
    inputs?: string[] | undefined
    count?: number | undefined
    aspectRatio?: string | undefined
    imageSize?: string | undefined
    imageQuality?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const resolved = resolveGrokImageOptions(options.model, {
    imageSize: options.imageSize,
    imageQuality: options.imageQuality,
    imageInputs: options.inputs,
    imageCount: options.count,
    imageAspectRatio: options.aspectRatio
  })
  if (options.mode !== undefined && options.mode !== resolved.mode) {
    throw UsageError('Grok edit mode requires --input references; generation mode cannot include references.')
  }
  const { resolution, quality, mode, imageCount: count } = resolved

  return await runImageGeneration({
    service: 'grok',
    model: options.model,
    outputDir,
    startDetail: mode,
    prepare: async () => ({
      imageRefs: mode === 'edit'
        ? await Promise.all((options.inputs ?? []).map(async (input) => ({
          type: 'image_url',
          url: isHttpUrl(input) ? input : await imageReferenceToDataUrl(input)
        })))
        : []
    }),
    execute: async (context, prepared) => {
      const clientConfig = {
        apiKey: context.apiKey,
        baseURL: XAI_DEFAULT_BASE_URL
      }
      const result = mode === 'edit'
        ? await openAIJsonRequest<OpenAIImageResponse>(clientConfig, '/images/edits', {
          model: options.model,
          prompt,
          response_format: 'b64_json',
          n: count,
          ...(prepared.imageRefs.length === 1 ? { image: prepared.imageRefs[0] } : { images: prepared.imageRefs }),
          ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
          ...(resolution ? { resolution } : {}),
          ...(quality ? { quality } : {})
        }, { errorMessagePrefix: 'Grok image edit failed' })
        : await createOpenAIImage(clientConfig, {
          model: options.model,
          prompt,
          response_format: 'b64_json',
          n: count,
          ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
          ...(resolution ? { resolution } : {}),
          ...(quality ? { quality } : {})
        }, { errorMessagePrefix: 'Grok image generation failed' })

      const imagePaths = await writeOpenAIImageResponseData(result, context.outputDir, 'jpg')
      if (imagePaths.length === 0) {
        throw InfraError('No image data in Grok response', { stage: 'image:grok' })
      }

      const usageCostRaw = typeof result.usage?.['cost_in_usd_ticks'] === 'number'
        ? result.usage['cost_in_usd_ticks']
        : undefined
      const providerCostCents = usageCostRaw !== undefined ? usageCostRaw / 100_000_000 : undefined
      const fallbackCost = options.model === 'grok-imagine-image-2.0' && providerCostCents === undefined
        ? estimateImageCosts({
            grokImageModels: [options.model], imageCount: imagePaths.length,
            imageSize: resolution, imageQuality: quality, imageInputs: options.inputs
          })[0]?.totalCost
        : undefined
      const moderation = result.data?.[0]?.['respect_moderation'] ?? result['respect_moderation']

      return {
        artifactPaths: imagePaths,
        metadata: {
          imageWidth: undefined,
          imageHeight: undefined,
          requestMode: mode,
          ...(getFirstRevisedPrompt(result) ? { revisedPrompt: getFirstRevisedPrompt(result) } : {}),
          ...(typeof result.model === 'string' && result.model.length > 0 ? { providerReturnedModel: result.model } : {}),
          ...(quality ? { imageQuality: quality, imageSize: resolution } : {}),
          ...(usageCostRaw !== undefined ? { usageCostRaw } : {}),
          ...(providerCostCents !== undefined
            ? { providerCostCents, providerCostSource: 'provider_usage' as const }
            : fallbackCost !== undefined ? { providerCostCents: fallbackCost, providerCostSource: 'registry_fallback' as const } : {}),
          ...(moderation !== undefined ? { providerModeration: moderation } : {})
        }
      }
    }
  })
}
