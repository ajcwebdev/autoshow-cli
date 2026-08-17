import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'
import { replicateImage } from './cases'

defineImageServiceTest({
  ...replicateImage,
  imageService: 'replicate',
  models: [
    {
      model: 'bytedance/seedream-4.5',
      prompt: 'A tiny blue square icon centered on a white background',
      extraArgs: ['--size', '2K', '--aspect-ratio', '1:1'],
      expectedExtension: 'jpg'
    },
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
      model: 'qwen/qwen-image-2-pro',
      prompt: 'A tiny red triangle icon centered on a white background',
      extraArgs: ['--aspect-ratio', '1:1']
    },
    {
      model: 'qwen/qwen-image-2',
      prompt: 'A tiny yellow star icon centered on a white background',
      extraArgs: ['--aspect-ratio', '1:1']
    },
    {
      model: 'wan-video/wan-2.7-image-pro',
      prompt: 'A tiny purple diamond icon centered on a white background',
      extraArgs: ['--size', '1K']
    },
    {
      model: 'wan-video/wan-2.7-image',
      prompt: 'A tiny orange hexagon icon centered on a white background',
      extraArgs: ['--size', '1K']
    },
  ],
})
