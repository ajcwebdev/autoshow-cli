import { expect, test } from 'bun:test'
import {
  runCommand,
  STABLE_TTS_MD_PATH,
} from '../../../../../test-utils/test-helpers'
import { mistralRefAudioPath, mistralTtsModel } from './cases'

test('mistral named saved-voice creation is rejected before provider setup', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${mistralTtsModel}`,
    '--tts-ref-audio',
    mistralRefAudioPath,
    '--tts-voice-name',
    'AutoShowVoice'
  ], {
    env: { MISTRAL_API_KEY: '' }
  })

  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(2)
  expect(result.outputDir).toBeNull()
  expect(output).toContain('cannot perform named saved-reference creation during TTS synthesis')
  expect(output).toContain('The voice command does not create Mistral saved voices')
  expect(output).not.toContain('MISTRAL_API_KEY')
})
