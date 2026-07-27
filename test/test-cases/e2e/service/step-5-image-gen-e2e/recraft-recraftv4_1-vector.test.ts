import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { recraftImage } from './cases'

defineImageServiceTest({
  ...recraftImage,
  models: [
    {
      model: 'recraftv4_1_vector',
      prompt: 'A simple blue square vector icon on a white background',
      extraArgs: ['--aspect-ratio', '1:1'],
      expectedExtension: 'svg'
    },
  ],
  imageService: 'recraft',
})
