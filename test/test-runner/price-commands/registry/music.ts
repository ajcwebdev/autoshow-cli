import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const minimaxGeminiProMusicCommand = command(
  'music-multi-minimax-music-3.0-gemini-lyria-3-pro-preview',
  'music-multi-minimax-music-3.0-gemini-lyria-3-pro-preview',
  ['src/cli/create-cli.ts', 'music', 'bright acoustic pop with handclaps and a catchy chorus', '--provider', 'minimax=music-3.0', '--provider', 'gemini=lyria-3-pro-preview', '--lyrics-file', 'input/examples/tts/1-tts.md', '--price']
)

export const musicRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music.test.ts', [
    command('music-elevenlabs-music_v2', 'music-elevenlabs-music_v2', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--provider', 'elevenlabs=music_v2', '--duration', '3', '--instrumental', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/elevenlabs-music-v2-pipeline.test.ts', [
    command('music-pipeline-elevenlabs-music_v2', 'music-pipeline-elevenlabs-music_v2', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--llm', 'groq=openai/gpt-oss-20b', '--music', 'elevenlabs=music_v2', '--music-duration', '3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0.test.ts', [
    command('music-minimax-music-3.0', 'music-minimax-music-3.0', ['src/cli/create-cli.ts', 'music', 'an ambient piano instrumental', '--provider', 'minimax=music-3.0', '--instrumental', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0-pipeline.test.ts', [
    command('music-pipeline-minimax-music-3.0', 'music-pipeline-minimax-music-3.0', ['src/cli/create-cli.ts', 'write', 'https://ajc.pics/autoshow/examples/1-audio.mp3', '--music', 'minimax=music-3.0', '--music-lyrics-file', 'input/examples/tts/1-tts.md', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/minimax-music-3.0-gemini-lyria-3-pro-preview.test.ts', [
    minimaxGeminiProMusicCommand,
  ]),
  ...exact('test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3-pro-preview.test.ts', [
    command('music-gemini-lyria-3-pro-preview', 'music-gemini-lyria-3-pro-preview', ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--provider', 'gemini=lyria-3-pro-preview', '--duration', '30', '--price']),
  ]),
]
