import { expect, test } from 'bun:test'
import {
  runCommand,
  STABLE_TTS_MD_PATH,
} from '../../../../../test-utils/test-helpers'
import { mistralTtsModel } from './cases'

test('rejects invalid mistral model', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'mistral=invalid-model'
  ])

  expect(result.exitCode).not.toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid model "invalid-model" for --provider/--tts mistral[=model]')
})

test('mistral execution defaults to reference audio and fails on missing API key', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${mistralTtsModel}`
  ], {
    env: {
      MISTRAL_API_KEY: ''
    }
  })

  expect(result.exitCode).not.toBe(0)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).not.toContain('Mistral TTS requires a saved voice ID or reference audio')
  expect(output).toContain('MISTRAL_API_KEY')
})

