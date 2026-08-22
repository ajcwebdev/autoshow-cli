import type { ImageGenOptions, ImageTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { collectGeminiImageTargets } from '../image-generation-services/image-gemini/gemini-image-targets'
import { collectOpenAIImageTargets } from '../image-generation-services/image-openai/openai-image-targets'
import { collectGrokImageTargets } from '../image-generation-services/image-grok/grok-image-targets'
import { collectBflImageTargets } from '../image-generation-services/bfl/bfl-image-targets'
import { collectReplicateImageTargets } from '../image-generation-services/replicate/replicate-image-targets'
import { collectLumalabsImageTargets } from '../image-generation-services/lumalabs/lumalabs-image-targets'
import { collectFalImageTargets } from '../image-generation-services/fal-image-service/fal-image-targets'
import { validateImageReferenceCapabilities } from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'

export const collectImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  if (options.imageMask !== undefined && (options.imageInputs?.length ?? 0) === 0) {
    throw UsageError('--mask requires at least one --input reference image.')
  }

  const targets = [
    ...collectGeminiImageTargets(options),
    ...collectOpenAIImageTargets(options),
    ...collectGrokImageTargets(options),
    ...collectBflImageTargets(options),
    ...collectReplicateImageTargets(options),
    ...collectLumalabsImageTargets(options),
    ...collectFalImageTargets(options)
  ]
  const referenceCount = options.imageInputs?.length ?? 0
  for (const target of targets) validateImageReferenceCapabilities(target.model, referenceCount)
  return targets
}
