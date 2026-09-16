import type { Step6VideoMetadata, VideoTarget } from '~/types'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/command-shared/target-runner'
import { GENERATION_ARTIFACT_BASENAMES, generationArtifactFileName } from '~/cli/commands/command-shared/media-generation/media-generation-scaffold'

export const getVideoArtifactFileName = (
  target: Pick<VideoTarget, 'service' | 'model'>,
  singleTarget: boolean
): string =>
  getSingleFileArtifactName(target, singleTarget, {
    singleFileName: generationArtifactFileName('video'),
    multiFilePrefix: GENERATION_ARTIFACT_BASENAMES.video,
    extension: 'mp4'
  })

export const buildVideoArtifactMap = (metadata: Step6VideoMetadata[]): Record<string, string> =>
  buildSingleArtifactMap(metadata, {
    singleKey: 'video',
    multiKeyPrefix: 'video',
    getService: (entry) => entry.videoGenService,
    getModel: (entry) => entry.videoGenModel,
    getFileName: (entry) => entry.videoFileName
  });
