import type { GrokImageModel, OpenAIImageResponse, Step5Metadata } from '~/types'
import { UsageError, InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/command-shared/generation-command-utils'
import { resolveCredential } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createOpenAIImage, openAIJsonRequest } from '~/utils/openai/openai-client'
import { imageReferenceToDataUrl, isHttpUrl } from '../../image-utils/image-inputs'
import {
  getFirstRevisedPrompt,
  getImageFileNames,
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
  const apiKey = resolveCredential('grok', 'require', { stage: 'image:grok', description: 'Grok image generation' })
  const startTime = Date.now()

  logGenStatus('image', 'grok', options.model, 'started', mode)

  const clientConfig = {
    apiKey,
    baseURL: XAI_DEFAULT_BASE_URL
  }
  const result = mode === 'edit'
    ? await (async () => {
        const imageRefs = await Promise.all((options.inputs ?? []).map(async (input) => ({
          type: 'image_url',
          url: isHttpUrl(input) ? input : await imageReferenceToDataUrl(input)
        })))
        const body = {
          model: options.model,
          prompt,
          response_format: 'b64_json',
          n: count,
          ...(imageRefs.length === 1 ? { image: imageRefs[0] } : { images: imageRefs }),
          ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
          ...(resolution ? { resolution } : {}),
          ...(quality ? { quality } : {})
        }
        return await openAIJsonRequest<OpenAIImageResponse>(clientConfig, '/images/edits', body, {
          errorMessagePrefix: 'Grok image edit failed'
        })
      })()
    : await createOpenAIImage(clientConfig, {
        model: options.model,
        prompt,
        response_format: 'b64_json',
        n: count,
        ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
        ...(resolution ? { resolution } : {}),
        ...(quality ? { quality } : {})
      }, { errorMessagePrefix: 'Grok image generation failed' })

  const imagePaths = await writeOpenAIImageResponseData(result, outputDir, 'jpg')
  if (imagePaths.length === 0) {
    throw InfraError('No image data in Grok response', { stage: 'image:grok' })
  }

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(imagePaths[0] as string)
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

  logGenCompleted('image', 'grok', options.model, processingTime, imagePaths)

  return {
    imagePaths,
    metadata: {
      imageService: 'grok',
      imageModel: options.model,
      processingTime,
      imageCount: imagePaths.length,
      imageFileNames: getImageFileNames(imagePaths),
      imageFileSize: imageFile.size,
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
