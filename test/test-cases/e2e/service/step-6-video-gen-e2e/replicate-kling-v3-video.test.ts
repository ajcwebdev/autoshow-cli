import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { replicateVideo } from './cases'

defineVideoServiceTest({ ...replicateVideo, models: [{ model: 'kwaivgi/kling-v3-video', extraArgs: ['--duration', '3', '--resolution', '720p'] }], videoService: 'replicate' })
