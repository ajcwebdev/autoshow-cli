import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { replicateVideo } from './cases'

defineVideoServiceTest({ ...replicateVideo, models: [{ model: 'pixverse/pixverse-v6', extraArgs: ['--duration', '5', '--resolution', '360p'] }], videoService: 'replicate' })
