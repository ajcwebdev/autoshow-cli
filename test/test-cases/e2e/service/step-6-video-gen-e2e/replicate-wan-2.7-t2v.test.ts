import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { replicateVideo } from './cases'

defineVideoServiceTest({
  ...replicateVideo,
  models: [
    { model: 'wan-video/wan-2.7-t2v', extraArgs: ['--duration', '2', '--resolution', '720p'] },
  ],
  videoService: 'replicate',
})
