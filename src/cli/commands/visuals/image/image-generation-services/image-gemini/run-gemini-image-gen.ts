import type { GeminiImageModel, Step5Metadata } from '~/types'
import { runImageGeneration } from '~/cli/commands/command-shared/media-generation/image-generation-scaffold'
import { geminiGenerateContent } from '~/utils/gemini/gemini-rest'
import { withRetry } from '~/utils/retries'
import { classifyGeminiRetry } from '~/cli/commands/text/write/write-services/write-gemini/gemini-utils'
import { imageReferenceToInlineDataPart } from '../../image-utils/image-inputs'
import { getProviderReturnedModel, mimeToExtension } from '../../image-utils/image-output'
import { validateGeminiImageDimensions } from './gemini-image-options'
import { InfraError } from '~/utils/error-handler'

const describeGeminiEmptyImageReason = (
  response: { promptFeedback?: { blockReason?: string | undefined } | undefined, candidates?: Array<{ finishReason?: string | undefined }> | undefined }
): string => {
  const blockReason = response.promptFeedback?.blockReason
  const finishReason = response.candidates?.find((candidate) => typeof candidate.finishReason === 'string')?.finishReason
  const reasons = [
    ...(typeof blockReason === 'string' && blockReason.length > 0 ? [`blockReason=${blockReason}`] : []),
    ...(typeof finishReason === 'string' && finishReason.length > 0 ? [`finishReason=${finishReason}`] : [])
  ]
  return reasons.length > 0 ? ` (${reasons.join(', ')})` : ''
}

export const runGeminiImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: GeminiImageModel
    mode?: 'generation' | 'edit' | undefined
    inputs?: string[] | undefined
    aspectRatio?: string | undefined
    imageSize?: string | undefined
    responseMode?: 'image' | 'text-image' | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  validateGeminiImageDimensions(options.model, { imageSize: options.imageSize, imageAspectRatio: options.aspectRatio })
  const mode = options.mode ?? 'generation'

  return await runImageGeneration({
    service: 'gemini',
    model: options.model,
    outputDir,
    startDetail: mode === 'edit' ? 'native image edit' : 'native image',
    prepare: async () => ({
      inputParts: await Promise.all((options.inputs ?? []).map(imageReferenceToInlineDataPart)),
      responseModalities: options.responseMode === 'text-image' ? ['TEXT', 'IMAGE'] : ['IMAGE']
    }),
    execute: async (context, prepared) => {
      const response = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'gemini-image-generate'
        },
        async (signal) => await geminiGenerateContent(context.apiKey, {
          model: options.model,
          contents: [{ text: prompt }, ...prepared.inputParts],
          generationConfig: {
            responseModalities: prepared.responseModalities,
            ...(options.aspectRatio || options.imageSize ? {
              imageConfig: {
                ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
                ...(options.imageSize ? { imageSize: options.imageSize } : {})
              }
            } : {})
          },
          ...(signal ? { abortSignal: signal } : {})
        }),
        classifyGeminiRetry
      )
      const providerReturnedModel = getProviderReturnedModel(options.model, response)

      const candidates = response.candidates ?? []
      if (candidates.length === 0 || !candidates[0]?.content?.parts) {
        throw InfraError(
          `No image content in Gemini response${describeGeminiEmptyImageReason(response)}`,
          { stage: 'image:gemini' }
        )
      }

      const imagePaths: string[] = []
      // Gemini picks the encoding itself and reports it per part, so the artifact is named after the
      // bytes it actually returned instead of an assumed PNG.
      const imageFormats: string[] = []
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.thought !== true) {
          const imageData = part.inlineData.data
          if (!imageData) continue
          const extension = mimeToExtension(part.inlineData.mimeType)
          const outputPath = context.artifactPath(extension, imagePaths.length)
          const bytes = Buffer.from(imageData, 'base64')
          if (options.model === 'gemini-nano-banana-2.1') {
            try {
              if (!['image/png', 'image/jpeg', 'image/webp'].includes(part.inlineData.mimeType ?? '')) throw InfraError('Unsupported image MIME type', { stage: 'image:gemini' })
              if (bytes.length === 0 || bytes.toString('base64') !== imageData) throw InfraError('Invalid base64 image', { stage: 'image:gemini' })
              const image = new Bun.Image(bytes)
              const metadata = await image.metadata()
              if (!metadata.width || !metadata.height || !['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) throw InfraError('Unsupported image encoding', { stage: 'image:gemini' })
              const expectedFormat = extension === 'jpg' ? 'jpeg' : extension
              if (metadata.format !== expectedFormat) throw InfraError('Image MIME type disagrees with decoded encoding', { stage: 'image:gemini' })
              await image.png().bytes()
            } catch (error) {
              throw InfraError('Gemini returned invalid image bytes', { stage: 'image:gemini', cause: error })
            }
          }
          await Bun.write(outputPath, bytes)
          imagePaths.push(outputPath)
          imageFormats.push(extension)
        }
      }

      if (imagePaths.length === 0) {
        throw InfraError('No images were generated by Gemini', { stage: 'image:gemini' })
      }

      return {
        artifactPaths: imagePaths,
        metadata: {
          imageWidth: undefined,
          imageHeight: undefined,
          imageSize: options.imageSize ?? '1K',
          requestMode: mode,
          ...(imageFormats[0] ? { imageFormat: imageFormats[0] } : {}),
          ...(providerReturnedModel ? { providerReturnedModel } : {})
        }
      }
    }
  })
}
