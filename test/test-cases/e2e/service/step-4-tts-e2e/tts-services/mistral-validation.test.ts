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

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid model "invalid-model" for --provider/--tts mistral[=model]')
})

test('mistral execution rejects a missing voice source before provider setup', async () => {
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

  expect(result.exitCode).toBe(2)
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('requires an existing voice ID or an explicitly authorized unnamed request reference')
  expect(output).not.toContain('MISTRAL_API_KEY')
})
