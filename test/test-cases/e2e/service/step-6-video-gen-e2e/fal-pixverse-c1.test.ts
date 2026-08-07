import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { falVideo } from './cases'

defineVideoServiceTest({
  ...falVideo,
  models: [{ model: 'fal-ai/pixverse/c1', extraArgs: ['--duration', '1', '--resolution', '360p'] }],
  videoService: 'fal',
})
