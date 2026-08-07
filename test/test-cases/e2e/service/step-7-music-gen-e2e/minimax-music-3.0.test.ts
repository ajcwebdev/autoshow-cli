import { defineMusicServiceTest } from '../../../../test-utils/define-music-service-test'
import { minimaxMusic } from './cases'

defineMusicServiceTest({
  ...minimaxMusic,
  models: [
    {
      model: 'music-3.0',
      prompt: 'an ambient piano instrumental',
      extraArgs: ['--instrumental'],
      expectedLyricsSource: 'none',
    },
  ],
  musicService: 'minimax',
})

