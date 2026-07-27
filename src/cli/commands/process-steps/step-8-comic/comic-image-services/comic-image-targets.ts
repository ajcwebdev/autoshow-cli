import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets/image-target-collect'
import { resolveImageService, SERVICE_TO_IMAGE_MODELS_FIELD } from '../comic-utils/image-service'
import { validateImageSizeForModels } from '../comic-utils/image-size'
import { validateReferenceImageCount } from '../comic-utils/reference-capabilities'
import { CLIUsageError, InfraError, InternalError } from '~/utils/error-handler'
import type { GeneratedImageResponse, ImageGenOptions, ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize } from '~/types'

// Comic's concrete CLI sizes map onto Gemini's native aspect-ratio + 1K image
// config. Custom WIDTHxHEIGHT sizes are validated to gpt-image-2 only, so a
// Gemini run only ever sees one of these presets.
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

// Maps comic's size/quality/reference-image inputs onto the shared ImageGenOptions
// shape per provider. OpenAI takes size + quality directly; Gemini takes an
// aspect ratio + 1K image size and rejects a quality flag; the remaining
// providers run with their own defaults so comic reaches them without
// provider-specific size handling.
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

// Generates a single comic image through the shared image dispatch. The central
// targets resolve the provider, structured size/quality handling, reference
// images, and API clients that comic previously re-implemented per provider.
// They write to a directory and return file paths, so comic runs each request in
// a scratch directory and reads the primary image back as base64 for its own
// timestamped output layout.
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
    throw CLIUsageError(`Unknown image model "${model}". It is not present in the central image registry.`)
  }

  const field = SERVICE_TO_IMAGE_MODELS_FIELD[service]
  if (!field) {
    throw CLIUsageError(`Image provider "${service}" for model "${model}" is not supported by comic.`)
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
