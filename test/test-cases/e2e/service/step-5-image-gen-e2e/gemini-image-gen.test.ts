import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'

defineImageServiceTest({
  models: [
    { model: 'gemini-3.1-flash-lite-image', prompt: 'a tiny purple circle on white background', extraArgs: ['--size', '1K', '--aspect-ratio', '1:1'] },
    { model: 'gemini-3.1-flash-image', prompt: 'a tiny purple circle on white background', extraArgs: ['--size', '1K', '--aspect-ratio', '1:1'] },
    { model: 'gemini-3-pro-image', prompt: 'a tiny purple circle on white background', extraArgs: ['--size', '1K', '--aspect-ratio', '1:1'] },
  ],
  provider: 'gemini',
  imageService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
})
