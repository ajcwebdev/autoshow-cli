import type { OpenAIImageModel, Step5Metadata } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { runImageGeneration } from '~/cli/commands/command-shared/media-generation/image-generation-scaffold'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createOpenAIImage, createOpenAIImageEdit } from '~/utils/openai/openai-client'
import { appendImageReferenceToForm } from '../../image-utils/image-inputs'
import { computeOpenAIImageUsageCostCents } from '../../image-utils/openai-image-pricing'
import { OPENAI_IMAGE_COUNT_RANGE, OPENAI_IMAGE_REQUEST_DEFAULTS, validateOpenAIImageOptions } from './openai-image-options'
import { validateImageCount } from '../../image-utils/image-target-validation'
import {
  getFirstRevisedPrompt,
  getProviderReturnedModel,
  writeOpenAIImageResponseData
} from '../../image-utils/image-output'

type OpenAIImageUsageUnits = Pick<Step5Metadata, 'imageInputUnits' | 'textInputUnits' | 'totalInputUnits' | 'outputUnits' | 'imageOutputUnits' | 'totalUnits'>

const readUsageUnits = (source: Record<string, unknown> | undefined, key: string): number | undefined => {
  const value = source?.[key]
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

const asRecord = (value: unknown): Record<string, unknown> | undefined => (
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
)

export const parseOpenAIImageUsage = (usage: unknown): OpenAIImageUsageUnits => {
  const record = asRecord(usage)
  if (!record) return {}
  const inputDetails = asRecord(record['input_tokens_details'])
  const imageInputUnits = readUsageUnits(inputDetails, 'image_tokens')
  const textInputUnits = readUsageUnits(inputDetails, 'text_tokens')
  const totalInputUnits = readUsageUnits(record, 'input_tokens')
  const outputUnits = readUsageUnits(record, 'output_tokens')
  const imageOutputUnits = readUsageUnits(asRecord(record['output_tokens_details']), 'image_tokens')
  const totalUnits = readUsageUnits(record, 'total_tokens')
  return {
    ...(imageInputUnits !== undefined ? { imageInputUnits } : {}),
    ...(textInputUnits !== undefined ? { textInputUnits } : {}),
    ...(totalInputUnits !== undefined ? { totalInputUnits } : {}),
    ...(outputUnits !== undefined ? { outputUnits } : {}),
    ...(imageOutputUnits !== undefined ? { imageOutputUnits } : {}),
    ...(totalUnits !== undefined ? { totalUnits } : {})
  }
}

export const runOpenAIImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: OpenAIImageModel
    mode?: 'generation' | 'edit' | undefined
    inputs?: string[] | undefined
    mask?: string | undefined
    count?: number | undefined
    size?: string | undefined
    quality?: string | undefined
    outputFormat?: string | undefined
    background?: string | undefined
    compression?: number | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  validateOpenAIImageOptions(options.model, { imageSize: options.size, imageQuality: options.quality, imageFormat: options.outputFormat, imageBackground: options.background, imageCompression: options.compression })
  const count = validateImageCount('OpenAI', options.model, options.count, ...OPENAI_IMAGE_COUNT_RANGE)
  const mode = options.mode ?? 'generation'
  const ext = options.outputFormat === 'jpeg' ? 'jpg' : (options.outputFormat ?? OPENAI_IMAGE_REQUEST_DEFAULTS.outputFormat)

  return await runImageGeneration({
    service: 'openai',
    model: options.model,
    outputDir,
    startDetail: mode,
    prepare: () => ({}),
    execute: async (context) => {
      const config = { apiKey: context.apiKey, baseURL: OPENAI_DEFAULT_BASE_URL }
      const result = mode === 'edit'
        ? await (async () => {
            const form = new FormData()
            form.append('model', options.model)
            form.append('prompt', prompt)
            form.append('n', String(count))
            form.append('size', options.size ?? OPENAI_IMAGE_REQUEST_DEFAULTS.size)
            form.append('quality', options.quality ?? OPENAI_IMAGE_REQUEST_DEFAULTS.quality)
            form.append('output_format', options.outputFormat ?? OPENAI_IMAGE_REQUEST_DEFAULTS.outputFormat)
            form.append('background', options.background ?? OPENAI_IMAGE_REQUEST_DEFAULTS.background)
            form.append('moderation', OPENAI_IMAGE_REQUEST_DEFAULTS.moderation)
            if (typeof options.compression === 'number') {
              form.append('output_compression', String(options.compression))
            }
            const inputs = options.inputs ?? []
            const imageFieldName = inputs.length > 1 ? 'image[]' : 'image'
            for (const input of inputs) {
              await appendImageReferenceToForm(form, imageFieldName, input)
            }
            if (options.mask) {
              await appendImageReferenceToForm(form, 'mask', options.mask)
            }
            return await createOpenAIImageEdit(config, form)
          })()
        : await createOpenAIImage(config, {
            model: options.model,
            prompt,
            n: count,
            size: options.size ?? OPENAI_IMAGE_REQUEST_DEFAULTS.size,
            quality: options.quality ?? OPENAI_IMAGE_REQUEST_DEFAULTS.quality,
            output_format: options.outputFormat ?? OPENAI_IMAGE_REQUEST_DEFAULTS.outputFormat,
            background: options.background ?? OPENAI_IMAGE_REQUEST_DEFAULTS.background,
            moderation: OPENAI_IMAGE_REQUEST_DEFAULTS.moderation,
            ...(typeof options.compression === 'number' ? { output_compression: options.compression } : {})
          })

      const imagePaths = await writeOpenAIImageResponseData(result, context.outputDir, ext)
      if (imagePaths.length === 0) {
        throw ValidationError('No image data in OpenAI response', { stage: 'image:openai' })
      }

      const usage = parseOpenAIImageUsage(result.usage)
      const providerCostCents = computeOpenAIImageUsageCostCents(options.model, usage)

      return {
        artifactPaths: imagePaths,
        metadata: {
          imageWidth: undefined,
          imageHeight: undefined,
          imageSize: options.size ?? OPENAI_IMAGE_REQUEST_DEFAULTS.size,
          imageQuality: options.quality ?? OPENAI_IMAGE_REQUEST_DEFAULTS.quality,
          imageFormat: options.outputFormat ?? OPENAI_IMAGE_REQUEST_DEFAULTS.outputFormat,
          requestMode: mode,
          ...(getFirstRevisedPrompt(result) ? { revisedPrompt: getFirstRevisedPrompt(result) } : {}),
          ...(getProviderReturnedModel(options.model, result) ? { providerReturnedModel: getProviderReturnedModel(options.model, result) } : {}),
          ...usage,
          ...(providerCostCents !== undefined ? { providerCostCents, providerCostSource: 'provider_usage' as const } : {})
        }
      }
    }
  })
}
