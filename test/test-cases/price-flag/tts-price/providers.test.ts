import { expect, test } from 'bun:test'
import { LOCAL_EXAMPLE_AUDIO_PATH, STABLE_TTS_MD_PATH } from '../../../test-utils/test-helpers'
import { runTtsPriceCommand } from './shared'

test('multi-provider --price prints both TTS targets and renamed output files', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'elevenlabs=eleven_v3',
    '--provider',
    'openai=gpt-4o-mini-tts-2025-12-15',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('elevenlabs')
  expect(output).toContain('eleven_v3')
  expect(output).toContain('openai')
  expect(output).toContain('gpt-4o-mini-tts-2025-12-15')
  expect(output).toContain('speech-elevenlabs-eleven_v3.wav')
  expect(output).toContain('speech-openai-gpt-4o-mini-tts-2025-12-15.wav')
})

test('write --price omits TTS estimates when multiple LLM providers are selected', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'write',
    LOCAL_EXAMPLE_AUDIO_PATH,
    '--llm',
    'openai=gpt-5.5',
    '--llm',
    'groq=openai/gpt-oss-20b',
    '--tts',
    'elevenlabs=eleven_v3',
    '--tts',
    'openai=gpt-4o-mini-tts-2025-12-15',
    '--price'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(0)
  expect(output).not.toContain('TTS estimate omitted')
  expect(output).not.toContain('speech-elevenlabs-eleven_v3.wav')
  expect(output).not.toContain('speech-openai-gpt-4o-mini-tts-2025-12-15.wav')
})
