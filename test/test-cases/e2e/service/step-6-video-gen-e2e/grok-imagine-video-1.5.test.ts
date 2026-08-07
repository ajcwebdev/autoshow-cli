import { defineVideoServiceTest } from '../../../../test-utils/define-video-service-test'
import { grokVideo } from './cases'

defineVideoServiceTest({ ...grokVideo, models: [{ model: 'grok-imagine-video-1.5', extraArgs: ['--duration', '1', '--resolution', '480p'] }], videoService: 'grok' })
