import type { Step6VideoMetadata, VideoGenerationDescriptor } from '~/types'
import { runMediaGeneration } from './media-generation-scaffold'

/** Runs one video provider and stamps the identity, timing and file facts every video adapter shared. */
export const runVideoGeneration = async <TPrepared>(
  descriptor: VideoGenerationDescriptor<TPrepared>
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {
  const run = await runMediaGeneration({ ...descriptor, modality: 'video' })
  return {
    videoPath: run.primaryPath,
    metadata: {
      videoGenService: descriptor.service,
      videoGenModel: descriptor.model,
      processingTime: run.processingTime,
      videoFileName: run.fileNames[0] as string,
      videoFileSize: run.primaryFileSize,
      ...run.metadata
    }
  }
}
