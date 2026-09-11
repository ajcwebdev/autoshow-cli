import { defineVideoServiceTest } from '../../../../../test-utils/define-video-service-test'
import { ltxVideo } from './cases'

defineVideoServiceTest({
  ...ltxVideo,
  models: [
    { model: 'ltx-2-5-pro', extraArgs: ['--duration', '6', '--resolution', '720p'], expectedDuration: 6 },
  ],
  videoService: 'ltx',
})
