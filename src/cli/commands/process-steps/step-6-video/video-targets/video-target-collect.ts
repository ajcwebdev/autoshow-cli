import type { VideoGenOptions, VideoTarget } from '~/types'
import { resolveVideoMode, validateModeInputs } from '../video-utils/video-mode-validation'
import { collectGeminiVideoTargets } from '../video-services/video-gemini/gemini-video-targets'
import { collectMinimaxVideoTargets } from '../video-services/video-minimax/minimax-video-targets'
import { collectGlmVideoTargets } from '../video-services/video-glm/glm-video-targets'
import { collectGrokVideoTargets } from '../video-services/video-grok/grok-video-targets'
import { collectRunwayVideoTargets } from '../video-services/runway/runway-video-targets'
import { collectLtxVideoTargets } from '../video-services/ltx/ltx-video-targets'
import { collectReplicateVideoTargets } from '../video-services/replicate-video/replicate-video-targets'
import { collectLumalabsVideoTargets } from '../video-services/video-lumalabs/lumalabs-video-targets'
import { collectFalVideoTargets } from '../video-services/fal-video-service/fal-video-targets'

export const collectVideoTargets = (options: VideoGenOptions): VideoTarget[] => {
  const mode = resolveVideoMode(options.videoMode)
  validateModeInputs(options, mode)

  return [
    ...collectGeminiVideoTargets(options, mode),
    ...collectMinimaxVideoTargets(options, mode),
    ...collectGlmVideoTargets(options, mode),
    ...collectGrokVideoTargets(options, mode),
    ...collectRunwayVideoTargets(options, mode),
    ...collectLtxVideoTargets(options, mode),
    ...collectReplicateVideoTargets(options, mode),
    ...collectLumalabsVideoTargets(options, mode),
    ...collectFalVideoTargets(options, mode)
  ]
}
