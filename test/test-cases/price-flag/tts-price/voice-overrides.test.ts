import { expect, test } from 'bun:test'
import { STABLE_TTS_MD_PATH } from '../../../test-utils/test-helpers'
import {
  MISTRAL_REF_AUDIO_PATH,
  MISTRAL_TTS_MODEL,
  expectPriceEstimateForModel,
  runTtsPriceCommand
} from './shared'

test('mistral --price works with an existing voice source', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${MISTRAL_TTS_MODEL}`,
    '--tts-voice',
    'voice_abc123',
    '--price'
  ])

  expectPriceEstimateForModel(result, MISTRAL_TTS_MODEL)
  expect(`${result.stdout}\n${result.stderr}`).toContain('speech')
})

test('mistral rejects voice and reference audio together before API request in price mode', async () => {
  const result = await runTtsPriceCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${MISTRAL_TTS_MODEL}`,
    '--tts-voice',
    'voice_abc123',
    '--tts-ref-audio',
    MISTRAL_REF_AUDIO_PATH,
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both')
})
