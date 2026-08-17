import { defineMusicServiceTest } from '../../../../test-utils/define-music-service-test'
import { elevenlabsMusic } from './cases'

defineMusicServiceTest({
  ...elevenlabsMusic,
  models: [
    { model: 'music_v2', prompt: 'cinematic electronic instrumental with pulsing synths', extraArgs: ['--duration', '3', '--instrumental'] },
  ],
  musicService: 'elevenlabs',
})
