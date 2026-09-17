import type { ImageGenOptions, ImageProvider, ImageProviderEntry, ImageTarget } from '~/types'
import { IMAGE_MODEL_ENTRIES } from '~/cli/commands/command-shared/generation-routing/generation-model-registry'
import { collectGeminiImageTargets } from '../image-generation-services/image-gemini/gemini-image-targets'
import { collectOpenAIImageTargets } from '../image-generation-services/image-openai/openai-image-targets'
import { collectGrokImageTargets } from '../image-generation-services/image-grok/grok-image-targets'
import { collectReplicateImageTargets } from '../image-generation-services/replicate/replicate-image-targets'
import { collectLumalabsImageTargets } from '../image-generation-services/lumalabs/lumalabs-image-targets'
import { collectFalImageTargets } from '../image-generation-services/fal-image-service/fal-image-targets'

// Exhaustive by type: a new image provider in the selection registry must land a collector here.
const IMAGE_TARGET_COLLECTORS = {
  gemini: collectGeminiImageTargets,
  openai: collectOpenAIImageTargets,
  grok: collectGrokImageTargets,
  replicate: collectReplicateImageTargets,
  lumalabs: collectLumalabsImageTargets,
  fal: collectFalImageTargets
} as const satisfies Record<ImageProvider, (options: ImageGenOptions) => ImageTarget[]>

export const IMAGE_PROVIDER_REGISTRY: readonly ImageProviderEntry[] = IMAGE_MODEL_ENTRIES.map(entry => ({
  ...entry,
  collectTargets: IMAGE_TARGET_COLLECTORS[entry.service]
}))
