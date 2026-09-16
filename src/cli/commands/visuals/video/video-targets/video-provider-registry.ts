import type { VideoGenOptions, VideoMode, VideoProvider, VideoProviderEntry, VideoTarget } from '~/types'
import { VIDEO_MODEL_ENTRIES } from '~/cli/commands/command-shared/generation-routing/generation-model-registry'
import { collectGeminiVideoTargets } from '../video-services/video-gemini/gemini-video-targets'
import { collectGrokVideoTargets } from '../video-services/video-grok/grok-video-targets'
import { collectLtxVideoTargets } from '../video-services/ltx/ltx-video-targets'
import { collectReplicateVideoTargets } from '../video-services/replicate-video/replicate-video-targets'
import { collectLumalabsVideoTargets } from '../video-services/video-lumalabs/lumalabs-video-targets'
import { collectFalVideoTargets } from '../video-services/fal-video-service/fal-video-targets'

// Exhaustive by type: a new video provider in the selection registry must land a collector here.
const VIDEO_TARGET_COLLECTORS = {
  gemini: collectGeminiVideoTargets,
  grok: collectGrokVideoTargets,
  ltx: collectLtxVideoTargets,
  replicate: collectReplicateVideoTargets,
  lumalabs: collectLumalabsVideoTargets,
  fal: collectFalVideoTargets
} as const satisfies Record<VideoProvider, (options: VideoGenOptions, mode: VideoMode) => VideoTarget[]>

export const VIDEO_PROVIDER_REGISTRY: readonly VideoProviderEntry[] = VIDEO_MODEL_ENTRIES.map(entry => ({
  ...entry,
  collectTargets: VIDEO_TARGET_COLLECTORS[entry.service]
}))
