import { defineImageServiceTest } from '../../../../../test-utils/define-image-service-test'

defineImageServiceTest({
  models: [
    // Gemini returns JPEG bytes for this model, and the artifact is named after what it returned.
    { model: 'gemini-3.1-flash-lite-image', prompt: 'a tiny purple circle on white background', extraArgs: ['--size', '1K', '--aspect-ratio', '1:1'], expectedExtension: 'jpg' },
  ],
  provider: 'gemini',
  imageService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
})
