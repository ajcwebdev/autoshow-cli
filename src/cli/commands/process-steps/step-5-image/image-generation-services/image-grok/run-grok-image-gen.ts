import type { GrokImageModel, OpenAIImageResponse, Step5Metadata } from '~/types'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { requireApiKey } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createOpenAIImage, openAIJsonRequest } from '~/utils/openai/openai-client'
import { imageReferenceToDataUrl, isHttpUrl } from '../../image-utils/image-inputs'
import {
  getFirstRevisedPrompt,
  getImageFileNames,
  getProviderReturnedModel,
  writeOpenAIImageResponseData
} from '../../image-utils/image-output'

export const normalizeGrokImageResolution = (size: string | undefined): string | undefined => {
  if (size === undefined || size.length === 0) return undefined
  const normalized = size.toLowerCase()
  if (normalized === '1k' || normalized === '2k') return normalized
  throw CLIUsageError(`Invalid --image-size value "${size}" for Grok. Expected 1K or 2K.`)
}

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
    baseUrl?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = requireApiKey('XAI_API_KEY', 'image:grok', 'Grok image generation')

  const resolution = normalizeGrokImageResolution(options.imageSize)
  const mode = options.mode ?? 'generation'
  const count = Math.max(1, options.count ?? 1)
  const startTime = Date.now()

  logGenStatus('image', 'grok', options.model, 'started', mode)

  const clientConfig = {
    apiKey,
    baseURL: (options.baseUrl ?? XAI_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
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
          ...(resolution ? { resolution } : {})
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
        ...(resolution ? { resolution } : {})
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
      ...(getProviderReturnedModel(options.model, result) ? { providerReturnedModel: getProviderReturnedModel(options.model, result) } : {}),
      ...(usageCostRaw !== undefined ? { usageCostRaw } : {}),
      ...(providerCostCents !== undefined ? { providerCostCents, providerCostSource: 'provider_usage' as const } : {}),
      ...(moderation !== undefined ? { providerModeration: moderation } : {})
    }
  }
}
