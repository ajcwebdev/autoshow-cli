import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { falVideo } from './cases'

defineVideoServiceTest({
  ...falVideo,
  models: [{ model: 'minimax/h3', extraArgs: ['--duration', '5', '--resolution', '768p'] }],
  videoService: 'fal',
})
