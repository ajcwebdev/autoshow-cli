import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const minimaxGeminiProMusicCommand = command(
  'music-multi-minimax-music-3.0-gemini-lyria-3-pro-preview',
  'music-multi-minimax-music-3.0-gemini-lyria-3-pro-preview',
  ['src/cli/create-cli.ts', 'music', 'bright acoustic pop with handclaps and a catchy chorus', '--provider', 'minimax=music-3.0', '--provider', 'gemini=lyria-3-pro-preview', '--lyrics-file', 'input/examples/tts/1-tts.md', '--price']
)

export const musicRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/audio/music/elevenlabs-music.test.ts', [
    command('music-elevenlabs-music_v2', 'music-elevenlabs-music_v2', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--provider', 'elevenlabs=music_v2', '--duration', '3', '--instrumental', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/music/minimax-music-3.0.test.ts', [
    command('music-minimax-music-3.0', 'music-minimax-music-3.0', ['src/cli/create-cli.ts', 'music', 'an ambient piano instrumental', '--provider', 'minimax=music-3.0', '--instrumental', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/music/minimax-music-3.0-gemini-lyria-3-pro-preview.test.ts', [
    minimaxGeminiProMusicCommand,
  ]),
  ...exact('test/test-cases/e2e/service/audio/music/gemini-lyria-3-pro-preview.test.ts', [
    command('music-gemini-lyria-3-pro-preview', 'music-gemini-lyria-3-pro-preview', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--provider', 'gemini=lyria-3-pro-preview', '--duration', '30', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/music/gemini-lyria-3.5.test.ts', [
    command('music-gemini-lyria-3.5', 'music-gemini-lyria-3.5', ['src/cli/create-cli.ts', 'music', 'An ambient piano instrumental', '--provider', 'gemini=lyria-3.5', '--duration', '30', '--instrumental', '--price']),
  ]),
]
