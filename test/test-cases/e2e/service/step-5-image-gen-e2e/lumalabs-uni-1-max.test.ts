import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { lumalabsImage } from './cases'

defineImageServiceTest({
  ...lumalabsImage,
  models: [
    {
      model: 'uni-1-max',
      prompt: 'A neon-lit Tokyo alley in the rain',
      extraArgs: ['--aspect-ratio', '16:9', '--format', 'png']
    },
  ],
  imageService: 'lumalabs',
})
