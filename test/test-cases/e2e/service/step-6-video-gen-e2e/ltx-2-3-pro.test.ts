import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { ltxVideo } from './cases'

defineVideoServiceTest({
  ...ltxVideo,
  models: [
    { model: 'ltx-2-3-pro', extraArgs: ['--duration', '6', '--resolution', '1080p'], expectedDuration: 6 },
  ],
  videoService: 'ltx',
})
