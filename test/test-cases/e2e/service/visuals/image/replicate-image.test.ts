import { defineImageServiceTest } from '../../../../../test-utils/define-image-service-test'
import { replicateImage } from './cases'

defineImageServiceTest({
  ...replicateImage,
  imageService: 'replicate',
  models: [
    {
      model: 'bytedance/seedream-5-lite',
      prompt: 'A tiny green circle icon centered on a white background',
      extraArgs: ['--size', '2K', '--aspect-ratio', '1:1', '--format', 'png']
    },
    {
      model: 'bytedance/seedream-5-pro',
      prompt: 'A tiny cyan pentagon icon centered on a white background',
      extraArgs: ['--size', '1K', '--aspect-ratio', '1:1', '--format', 'png']
    },
    {
      model: 'alibaba/qwen-image-3',
      prompt: 'A tiny red triangle icon centered on a white background',
      extraArgs: ['--aspect-ratio', '1:1']
    },
    {
      model: 'alibaba/qwen-image-3-pro',
      prompt: 'A tiny yellow star icon centered on a white background',
      extraArgs: ['--aspect-ratio', '1:1']
    },
  ],
})
