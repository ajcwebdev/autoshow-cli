import type { GrokImageModel, ImageGenOptions, ImageTarget } from '~/types'
import { validateGrokImageModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { ensureGrokImageGenSetup } from './grok-image-gen'
import { runGrokImageGen } from './run-grok-image-gen'
import { assertNoUnsupportedFlags, hasEditInputs } from '../../image-utils/image-target-validation'
import { resolveGrokImageOptions } from './grok-image-options'
export { GROK_IMAGE_ASPECT_RATIO_VALUES, GROK_IMAGE_SIZE_VALUES, GROK_IMAGE_COUNT_RANGE } from './grok-image-options'

export const collectGrokImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const models = options.grokImageModels ?? []
  return models.flatMap((rawModel) => {
    const model: GrokImageModel = validateGrokImageModel(rawModel)
    resolveGrokImageOptions(model, options)
    assertNoUnsupportedFlags(options, [
      'imageFormat',
      'imageBackground',
      'imageResponseMode',
      'imageCompression',
      'imageMask',
      { key: 'geminiSearchGrounding', when: value => value === true }
    ], {
      provider: 'Grok',
      model,
      hint: 'Supported Grok image options: --count, --aspect-ratio, --size 1K|2K, --input; Image 2.0 also supports --quality low|medium|auto and five references.'
    })

    return [{
      service: 'grok',
      model,
      run: async (prompt, outputDir) => {
        await ensureGrokImageGenSetup()
        return await runGrokImageGen(prompt, outputDir, {
          model,
          mode: hasEditInputs(options) ? 'edit' : 'generation',
          inputs: options.imageInputs,
          count: options.imageCount,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          imageQuality: options.imageQuality
        })
      }
    }]
  })
}
