import { mkdir } from 'node:fs/promises'
import type { OpenAIImageModel, Step5Metadata } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { logGenCompleted, logGenStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIImage, createOpenAIImageEdit } from '~/utils/openai/openai-client'
import { appendImageReferenceToForm } from '../../image-utils/image-inputs'
import {
  getFirstRevisedPrompt,
  getImageFileNames,
  getProviderReturnedModel,
  writeOpenAIImageResponseData
} from '../../image-utils/image-output'

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
  const mode = options.mode ?? 'generation'
  logGenStatus('image', 'openai', options.model, 'started', mode)

  const config = getOpenAIClientConfig()

  const startTime = Date.now()

  await mkdir(outputDir, { recursive: true })

  const ext = options.outputFormat === 'jpeg' ? 'jpg' : (options.outputFormat ?? 'png')
  const count = Math.max(1, options.count ?? 1)

  const result = mode === 'edit'
    ? await (async () => {
        const form = new FormData()
        form.append('model', options.model)
        form.append('prompt', prompt)
        form.append('n', String(count))
        form.append('size', options.size ?? 'auto')
        form.append('quality', options.quality ?? 'auto')
        form.append('output_format', options.outputFormat ?? 'png')
        form.append('background', options.background ?? 'auto')
        form.append('moderation', 'low')
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
        size: options.size ?? 'auto',
        quality: options.quality ?? 'auto',
        output_format: options.outputFormat ?? 'png',
        background: options.background ?? 'auto',
        moderation: 'low',
        ...(typeof options.compression === 'number' ? { output_compression: options.compression } : {})
      })

  const imagePaths = await writeOpenAIImageResponseData(result, outputDir, ext)
  if (imagePaths.length === 0) {
    throw ValidationError('No image data in OpenAI response', { stage: 'image:openai' })
  }

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(imagePaths[0] as string)
  const imageFileSize = imageFile.size

  logGenCompleted('image', 'openai', options.model, processingTime, imagePaths)

  const metadata: Step5Metadata = {
    imageService: 'openai',
    imageModel: options.model,
    processingTime,
    imageCount: imagePaths.length,
    imageFileNames: getImageFileNames(imagePaths),
    imageFileSize,
    imageWidth: undefined,
    imageHeight: undefined,
    imageSize: options.size ?? 'auto',
    imageQuality: options.quality ?? 'auto',
    imageFormat: options.outputFormat ?? 'png',
    requestMode: mode,
    ...(getFirstRevisedPrompt(result) ? { revisedPrompt: getFirstRevisedPrompt(result) } : {}),
    ...(getProviderReturnedModel(options.model, result) ? { providerReturnedModel: getProviderReturnedModel(options.model, result) } : {})
  }

  return { imagePaths, metadata }
}
