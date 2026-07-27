import type { MusicTarget, Step7MusicMetadata } from '~/types'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'

export const getMusicArtifactFileName = (
  target: Pick<MusicTarget, 'service' | 'model'>,
  singleTarget: boolean
): string =>
  getSingleFileArtifactName(target, singleTarget, {
    singleFileName: 'generated-music.mp3',
    multiFilePrefix: 'generated-music',
    extension: 'mp3'
  })

export const buildMusicArtifactMap = (metadata: Step7MusicMetadata[]): Record<string, string> =>
  buildSingleArtifactMap(metadata, {
    singleKey: 'music',
    multiKeyPrefix: 'music',
    getService: (entry) => entry.musicService,
    getModel: (entry) => entry.musicModel,
    getFileName: (entry) => entry.musicFileName
  });
