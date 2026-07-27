import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { replicateVideo } from './cases'

defineVideoServiceTest({
  ...replicateVideo,
  models: [
    { model: 'bytedance/seedance-2.0-fast', extraArgs: ['--duration', '5', '--resolution', '480p'] },
  ],
  videoService: 'replicate',
})
