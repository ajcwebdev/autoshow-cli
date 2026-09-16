import type { ImageGenerationDescriptor, Step5Metadata } from '~/types'
import { runMediaGeneration } from './media-generation-scaffold'

/** Runs one image provider and stamps the identity, timing and file facts every image adapter shared. */
export const runImageGeneration = async <TPrepared>(
  descriptor: ImageGenerationDescriptor<TPrepared>
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const run = await runMediaGeneration({ ...descriptor, modality: 'image' })
  return {
    imagePaths: run.artifactPaths,
    metadata: {
      imageService: descriptor.service,
      imageModel: descriptor.model,
      processingTime: run.processingTime,
      imageCount: run.artifactPaths.length,
      imageFileNames: run.fileNames,
      imageFileSize: run.primaryFileSize,
      ...run.metadata
    }
  }
}
