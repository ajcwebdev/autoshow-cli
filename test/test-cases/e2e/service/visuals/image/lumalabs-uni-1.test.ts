import { defineImageServiceTest } from '../../../../../test-utils/define-image-service-test'
import { lumalabsImage } from './cases'

defineImageServiceTest({
  ...lumalabsImage,
  models: [
    {
      model: 'uni-1',
      prompt: 'A glass of iced coffee on a marble countertop in morning light',
      extraArgs: ['--aspect-ratio', '16:9', '--format', 'png'],
      // Luma honors the requested ratio on its own pixel grid (2784x1504 for 16:9), not exactly.
      aspectRatioTolerance: 0.05
    },
  ],
  imageService: 'lumalabs',
})
