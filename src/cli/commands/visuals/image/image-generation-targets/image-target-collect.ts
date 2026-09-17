import { assertRequiredImageModel } from '~/utils/required-image-model'
import type { ImageGenOptions, ImageTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { collectGenerationTargets } from '~/cli/commands/command-shared/generation-routing/collect-generation-targets'
import { IMAGE_PROVIDER_REGISTRY } from './image-provider-registry'
import { validateImageReferenceCapabilities } from '~/cli/commands/setup-and-utilities/models/image-reference-capabilities'
import { filterModelCostTargets } from '~/cli/commands/pricing-orchestration/model-cost-filter'

export const collectImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  if (options.imageMask !== undefined && (options.imageInputs?.length ?? 0) === 0) {
    throw UsageError('--mask requires at least one --input reference image.')
  }

  const targets = filterModelCostTargets(
    collectGenerationTargets(IMAGE_PROVIDER_REGISTRY, options, undefined),
    options,
    'image'
  )
  for (const target of targets) assertRequiredImageModel(target.model, target.service)
  const referenceCount = options.imageInputs?.length ?? 0
  for (const target of targets) validateImageReferenceCapabilities(target.model, referenceCount, target.service)
  return targets
}
