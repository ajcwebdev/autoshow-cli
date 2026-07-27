import type { Step6VideoMetadata, VideoTarget } from '~/types'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'

export const getVideoArtifactFileName = (
  target: Pick<VideoTarget, 'service' | 'model'>,
  singleTarget: boolean
): string =>
  getSingleFileArtifactName(target, singleTarget, {
    singleFileName: 'generated-video.mp4',
    multiFilePrefix: 'generated-video',
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
