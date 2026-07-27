import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { replicateVideo } from './cases'

defineVideoServiceTest({
  ...replicateVideo,
  models: [
    { model: 'alibaba/happyhorse-1.0', extraArgs: ['--duration', '3', '--resolution', '720p'] },
  ],
  videoService: 'replicate',
})
