import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const ttsRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/audio/tts/openai-gpt-4o-mini-tts-2025-12-15.test.ts', [
    command('tts-openai-gpt-4o-mini-tts-2025-12-15', 'tts-openai-gpt-4o-mini-tts-2025-12-15', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/grok-tts.test.ts', [
    command('tts-grok-grok-tts', 'tts-grok-grok-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'grok=grok-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/elevenlabs-eleven-v3.test.ts', [
    command('tts-elevenlabs-eleven_v3', 'tts-elevenlabs-eleven_v3', ['src/cli/create-cli.ts', 'tts', 'test/test-cases/e2e/service/audio/tts/fixtures/natural-short.txt', '--provider', 'elevenlabs=eleven_v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/inworld-realtime-tts-2.test.ts', [
    command('tts-inworld-realtime-tts-2', 'tts-inworld-realtime-tts-2', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'inworld=realtime-tts-2', '--price']),
  ]),
]
