import { extname } from 'node:path'
import type { ImageGenOptions, ImageTarget, Step5Metadata } from '~/types'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'
import { getBflImageExtension } from '../image-generation-services/bfl/run-bfl-image-gen'
import { getRecraftImageExtension } from '../image-generation-services/recraft/run-recraft-image-gen'
import { getReplicateImageExtension } from '../image-generation-services/replicate/run-replicate-image-gen'
import { getLumalabsImageExtension } from '../image-generation-services/lumalabs/run-lumalabs-image-gen'
import { normalizeOpenAIImageExtension } from '../image-generation-services/image-openai/openai-image-targets'

const sanitizeImageModelName = sanitizeModelName

export const getExpectedImageCount = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions
): number => {
  if (target.service === 'openai' || target.service === 'grok' || target.service === 'recraft') {
    return Math.max(1, options.imageCount ?? 1)
  }

  if (target.service === 'replicate' && target.model.startsWith('wan-video/')) {
    return Math.max(1, options.imageCount ?? 1)
  }

  return 1
}

const getExpectedImageExtension = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions
): string => {
  if (target.service === 'openai') {
    return normalizeOpenAIImageExtension(options.imageFormat)
  }

  if (target.service === 'grok') {
    return 'jpg'
  }

  if (target.service === 'bfl') {
    return getBflImageExtension(options.imageFormat)
  }

  if (target.service === 'recraft') {
    return getRecraftImageExtension(target.model)
  }

  if (target.service === 'replicate') {
    return getReplicateImageExtension(target.model, options.imageFormat)
  }

  if (target.service === 'lumalabs') {
    return getLumalabsImageExtension(options.imageFormat)
  }

  return 'png'
}

const getImageArtifactFileName = (
  target: Pick<ImageTarget, 'service' | 'model'> | Pick<Step5Metadata, 'imageService' | 'imageModel'>,
  singleTarget: boolean,
  sourceFileName: string,
  index: number
): string => {
  const ext = extname(sourceFileName).replace(/^\./, '') || 'png'
  if (singleTarget) {
    return index === 0 ? `generated-image.${ext}` : `generated-image-${index + 1}.${ext}`
  }

  const service = 'service' in target ? target.service : target.imageService
  const model = 'model' in target ? target.model : target.imageModel
  const baseName = `generated-image-${service}-${sanitizeImageModelName(model)}`
  return index === 0 ? `${baseName}.${ext}` : `${baseName}-${index + 1}.${ext}`
}

export const getImageArtifactFileNames = (
  target: Pick<ImageTarget, 'service' | 'model'> | Pick<Step5Metadata, 'imageService' | 'imageModel'>,
  sourceFileNames: string[],
  singleTarget: boolean
): string[] => sourceFileNames.map((fileName, index) =>
  getImageArtifactFileName(target, singleTarget, fileName, index)
)

export const getExpectedImageArtifactFileNames = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions,
  singleTarget: boolean
): string[] => {
  const imageCount = getExpectedImageCount(target, options)
  const extension = getExpectedImageExtension(target, options)

  return Array.from({ length: imageCount }, (_, index) =>
    getImageArtifactFileName(target, singleTarget, `placeholder.${extension}`, index)
  )
}

const getStep5ImageFileNames = (
  metadata: Pick<Step5Metadata, 'imageFileNames'>
): string[] => metadata.imageFileNames

export const buildImageArtifactMap = (metadata: Step5Metadata[]): Record<string, string> => {
  if (metadata.length === 1) {
    return Object.fromEntries(
      getStep5ImageFileNames(metadata[0]!).map((fileName, index) => [
        index === 0 ? 'image' : `image-${index + 1}`,
        fileName
      ])
    )
  }

  return Object.fromEntries(
    metadata.flatMap((entry) =>
      getStep5ImageFileNames(entry).map((fileName, index) => {
        const baseKey = `image-${entry.imageService}-${sanitizeImageModelName(entry.imageModel)}`
        return [index === 0 ? baseKey : `${baseKey}-${index + 1}`, fileName] as const
      })
    )
  )
}
