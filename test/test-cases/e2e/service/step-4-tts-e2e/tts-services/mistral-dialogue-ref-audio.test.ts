import { expect, test } from 'bun:test'
import {
  runCommand,
} from '../../../../../test-utils/test-helpers'
import {
  mistralRefAudioPath,
  mistralTtsModel,
} from './cases'

test('mistral dialogue rejects remote reference locators before provider setup', async () => {
  const remoteReference = 'https://ajc.pics/autoshow/examples/1-audio.mp3'
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    'input/examples/tts/tts-dialogue.txt',
    '--provider',
    `mistral=${mistralTtsModel}`,
    '--tts-dialogue-format',
    'labeled',
    '--tts-speaker',
    `Host=${mistralRefAudioPath}`,
    '--tts-speaker',
    `Guest=${remoteReference}`
  ], {
    env: { MISTRAL_API_KEY: '' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(1)
  expect(result.outputDir).toBeNull()
  expect(output).toContain('Unable to read the authorized reference audio.')
  expect(output).not.toContain(remoteReference)
  expect(output).not.toContain(mistralRefAudioPath)
  expect(output).not.toContain('MISTRAL_API_KEY')
})
