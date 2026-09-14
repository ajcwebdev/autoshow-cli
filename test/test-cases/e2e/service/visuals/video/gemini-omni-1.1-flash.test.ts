import { defineVideoServiceTest } from '../../../../../test-utils/define-video-service-test'
import { geminiVideo } from './cases'

defineVideoServiceTest({
  ...geminiVideo,
  models: [{ model: 'gemini-omni-1.1-flash', extraArgs: ['--duration', '3', '--resolution', '360p'], expectedDuration: 3 }],
  videoService: 'gemini',
})
