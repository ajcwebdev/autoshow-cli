import { defineImageServiceTest } from '../../../../../test-utils/define-image-service-test'
import { openaiImage } from './cases'

defineImageServiceTest({
  ...openaiImage,
  models: [
    { model: 'gpt-image-2.6-flare', prompt: 'A simple green triangle', extraArgs: ['--size', '1024x1024', '--quality', 'low', '--background', 'transparent', '--format', 'png'] },
    { model: 'gpt-image-2.6-sunburst', prompt: 'A simple blue circle', extraArgs: ['--size', '1024x1024', '--quality', 'low'] },
  ],
  imageService: 'openai',
})
