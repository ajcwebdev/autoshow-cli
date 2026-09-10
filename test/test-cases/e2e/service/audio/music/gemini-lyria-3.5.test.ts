import { defineMusicServiceTest } from '../../../../../test-utils/define-music-service-test'
import { geminiMusic } from './cases'

defineMusicServiceTest({
  ...geminiMusic,
  models: [
    { model: 'lyria-3.5', prompt: 'An ambient piano instrumental', extraArgs: ['--duration', '30', '--instrumental'] },
  ],
  musicService: 'gemini',
})
