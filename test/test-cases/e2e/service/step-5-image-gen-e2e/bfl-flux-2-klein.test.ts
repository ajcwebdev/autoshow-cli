import { defineImageServiceTest } from '../../../../test-utils/define-image-service-test'

defineImageServiceTest({
  models: [
    { model: 'flux-2-klein-4b', prompt: 'a tiny blue square on a white background', extraArgs: ['--size', '1024x1024', '--format', 'jpeg'], expectedExtension: 'jpg' },
    { model: 'flux-2-klein-9b', prompt: 'a tiny blue square on a white background', extraArgs: ['--size', '1024x1024', '--format', 'jpeg'], expectedExtension: 'jpg' }
  ],
  provider: 'bfl',
  imageService: 'bfl',
  envVarKey: 'BFL_API_KEY'
})
