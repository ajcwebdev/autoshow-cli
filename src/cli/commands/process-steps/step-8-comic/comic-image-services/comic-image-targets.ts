import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets/image-target-collect'
import { resolveImageService, SERVICE_TO_IMAGE_MODELS_FIELD } from '../comic-utils/image-service'
import { validateImageSizeForModels } from '../comic-utils/image-size'
import { validateReferenceImageCount } from '../comic-utils/reference-capabilities'
import { UsageError, InfraError, InternalError } from '~/utils/error-handler'
import type { GeneratedImageResponse, ImageGenOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize } from '~/types'

const GEMINI_SIZE_TO_ASPECT_RATIO: Record<string, string> = {
  '1536x1024': '3:2',
  '1024x1024': '1:1',
  '1024x1536': '2:3',
}

const mimeTypeFromExtension = (extension: string): string | undefined => {
  switch (extension.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      return undefined
  }
}

const buildImageGenOptions = (
  service: string,
  field: string,
  model: ImageGenerationModel,
  size: ImageGenerationSize,
  quality: ImageGenerationQuality,
  referenceImages: string[]
): ImageGenOptions => {
  const base: Record<string, unknown> = { [field]: [model] }
  if (referenceImages.length > 0) {
    base['imageInputs'] = referenceImages
  }

  if (service === 'openai') {
    base['imageSize'] = size
    base['imageQuality'] = quality
  } else if (service === 'gemini') {
    const aspectRatio = GEMINI_SIZE_TO_ASPECT_RATIO[size]
    if (aspectRatio) {
      base['imageAspectRatio'] = aspectRatio
      base['imageSize'] = '1K'
    }
  }

  return base as ImageGenOptions
}

export const createImage = async (
  normalizedPrompt: string,
  referenceImages: string[],
  model: ImageGenerationModel,
  size: ImageGenerationSize,
  quality: ImageGenerationQuality
): Promise<GeneratedImageResponse> => {
  validateImageSizeForModels(size, [model])
  if (referenceImages.length > 0) validateReferenceImageCount(model, referenceImages.length, 'Image request')

  const service = resolveImageService(model)
  if (!service) {
    throw UsageError(`Unknown image model "${model}". It is not present in the central image registry.`)
  }

  const field = SERVICE_TO_IMAGE_MODELS_FIELD[service]
  if (!field) {
    throw UsageError(`Image provider "${service}" for model "${model}" is not supported by comic.`)
  }

  const options = buildImageGenOptions(service, field, model, size, quality, referenceImages)
  const target = collectImageTargets(options)[0]
  if (!target) {
    throw InternalError(`Failed to build an image target for "${model}"`, { stage: 'comic:image' })
  }

  const scratchDir = await mkdtemp(join(tmpdir(), 'comic-image-'))
  try {
    const { imagePaths } = await target.run(normalizedPrompt, scratchDir, options)
    const primaryPath = imagePaths[0]
    if (!primaryPath) {
      throw InfraError(`Image target for "${model}" produced no image`, { stage: 'comic:image' })
    }

    const imageBytes = Buffer.from(await Bun.file(primaryPath).arrayBuffer())
    const imageBase64 = imageBytes.toString('base64')
    const mimeType = mimeTypeFromExtension(extname(primaryPath))

    return {
      mode: referenceImages.length > 0 ? 'edit' : 'generate',
      result: {
        imageBase64,
        ...(mimeType ? { mimeType } : {}),
      },
    }
  } finally {
    await rm(scratchDir, { recursive: true, force: true })
  }
}
