import type { MusicGenerationDescriptor, Step7MusicMetadata } from '~/types'
import { runMediaGeneration } from './media-generation-scaffold'

/** Runs one music provider and stamps the identity, timing and file facts every music adapter shared. */
export const runMusicGeneration = async <TPrepared>(
  descriptor: MusicGenerationDescriptor<TPrepared>
): Promise<{ musicPath: string, metadata: Step7MusicMetadata }> => {
  const run = await runMediaGeneration({ ...descriptor, modality: 'music' })
  return {
    musicPath: run.primaryPath,
    metadata: {
      musicService: descriptor.service,
      musicModel: descriptor.model,
      processingTime: run.processingTime,
      musicFileName: run.fileNames[0] as string,
      musicFileSize: run.primaryFileSize,
      ...run.metadata
    }
  }
}
