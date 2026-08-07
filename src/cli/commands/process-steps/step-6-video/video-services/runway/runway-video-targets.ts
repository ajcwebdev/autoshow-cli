import type { RunwayVideoModel, VideoGenOptions, VideoMode, VideoTarget } from '~/types'
import { validateRunwayVideoModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { CLIUsageError } from '~/utils/error-handler'
import { runRunwayVideoGen } from './run-runway-video-gen'
import { isSupportedOrSkippedForAllVideo } from '../../video-utils/video-mode-validation'

export const collectRunwayVideoTargets = (options: VideoGenOptions, mode: VideoMode): VideoTarget[] => {
  const models = options.runwayVideoModels ?? []
  return models.flatMap((rawModel) => {
    const model: RunwayVideoModel = validateRunwayVideoModel(rawModel)
    if (!isSupportedOrSkippedForAllVideo(options, 'runway', model, mode, ['text'])) {
      return []
    }

    return [{
      service: 'runway',
      model,
      run: async (prompt, outputDir) => {
        if (prompt === undefined) {
          throw CLIUsageError('Runway video prompt cannot be empty.')
        }
        return await runRunwayVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio
        })
      }
    }]
  })
}
