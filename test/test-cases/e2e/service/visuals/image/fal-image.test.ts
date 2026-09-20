import { defineImageServiceTest } from '../../../../../test-utils/define-image-service-test'
import { falImage } from './cases'

defineImageServiceTest({
  ...falImage,
  imageService: 'fal',
  models: [
    { model: 'fal-ai/hidream-o1-image', prompt: 'A tiny blue square icon centered on a white background', extraArgs: ['--size', '1024x1024'] },
    { model: 'alibaba/qwen-image-3', prompt: 'The word QWEN centered in a clean typographic poster', extraArgs: ['--size', '1024x1024'] },
  ],
})
