import type { GrokImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateGrokImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runGrokImageGen } from './run-grok-image-gen'
import { assertNoUnsupportedFlags, hasEditInputs } from '../../image-utils/image-target-validation'
import { resolveGrokImageOptions } from './grok-image-options'
export { GROK_IMAGE_ASPECT_RATIO_VALUES, GROK_IMAGE_SIZE_VALUES, GROK_IMAGE_COUNT_RANGE } from './grok-image-options'

export const collectGrokImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.grokImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: GrokImageModel = validateGrokImageModel(rawModel)
    const resolved = resolveGrokImageOptions(model, options)
    assertNoUnsupportedFlags(options, [
      'imageFormat',
      'imageBackground',
      'imageResponseMode',
      'imageCompression',
      'imageMask'
    ], {
      provider: 'Grok',
      model,
      hint: 'Supported Grok image options: --count, --aspect-ratio, --size 1K|2K, --quality low|medium|auto, and up to five --input references.'
    })

    const request = {
      model,
      mode: hasEditInputs(options) ? 'edit' as const : 'generation' as const,
      inputs: options.imageInputs,
      count: options.imageCount,
      aspectRatio: options.imageAspectRatio,
      imageSize: options.imageSize,
      imageQuality: options.imageQuality
    }
    return [{
      service: 'grok',
      model,
      requestSettings: { ...request, count: resolved.imageCount, resolution: resolved.resolution, quality: resolved.quality },
      run: async (prompt, outputDir) => await runGrokImageGen(prompt, outputDir, request)
    }]
  })
}
