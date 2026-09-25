import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const ttsRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/audio/tts/gemini-soniox-price.test.ts', [
    command('tts-soniox-tts-rt-v2', 'tts-soniox-tts-rt-v2', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'soniox=tts-rt-v2', '--price'], false),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/gemini-soniox-price.test.ts', [
    ...['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'].flatMap(model => ['unary', 'stream', 'batch'].map(mode =>
      command('tts-' + model + '-' + mode, 'tts-' + model + '-' + mode, ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'gemini=' + model, '--gemini-tts-mode', mode, '--price'], false)
    )),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/openai-gpt-4o-mini-tts-2025-12-15.test.ts', [
    command('tts-openai-gpt-4o-mini-tts-2025-12-15', 'tts-openai-gpt-4o-mini-tts-2025-12-15', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/grok-tts.test.ts', [
    command('tts-grok-grok-tts', 'tts-grok-grok-tts', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'grok=grok-tts', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/mistral-validation.test.ts', [
    command('tts-mistral-voxtral-mini-tts-2603', 'tts-mistral-voxtral-mini-tts-2603', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-voice', 'voice_abc123', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/mistral-voxtral-mini-tts-2603-voice.test.ts', [
    command('tts-mistral-voxtral-mini-tts-2603-voice', 'tts-mistral-voxtral-mini-tts-2603-voice', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-voice', 'voice_saved_fixture', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/mistral-voxtral-mini-tts-2603-ref-audio.test.ts', [
    command('tts-mistral-voxtral-mini-tts-2603-ref-audio', 'tts-mistral-voxtral-mini-tts-2603-ref-audio', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/mistral-dialogue-ref-audio.test.ts', [
    command('tts-mistral-dialogue-ref-audio', 'tts-mistral-dialogue-ref-audio', ['src/cli/create-cli.ts', 'tts', 'test/test-cases/e2e/service/audio/tts/fixtures/two-speaker.txt', '--provider', 'mistral=voxtral-mini-tts-2603', '--tts-dialogue-format', 'labeled', '--tts-speaker', 'Host=input/examples/audio/anthony-voice.mp3', '--tts-speaker', 'Guest=input/examples/audio/0-audio-short.mp3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/speechify-simba-3.2.test.ts', [
    command('tts-speechify-simba-3.2', 'tts-speechify-simba-3.2', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'speechify=simba-3.2', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/elevenlabs-eleven-v3.test.ts', [
    command('tts-elevenlabs-eleven_v3', 'tts-elevenlabs-eleven_v3', ['src/cli/create-cli.ts', 'tts', 'test/test-cases/e2e/service/audio/tts/fixtures/natural-short.txt', '--provider', 'elevenlabs=eleven_v3', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/audio/tts/inworld-realtime-tts-2.test.ts', [
    command('tts-inworld-realtime-tts-2', 'tts-inworld-realtime-tts-2', ['src/cli/create-cli.ts', 'tts', 'input/examples/tts/01-tts-short.md', '--provider', 'inworld=realtime-tts-2', '--price']),
  ]),
]
