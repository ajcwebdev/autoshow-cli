import { expect, test } from 'bun:test'
import {
  runCommand,
  STABLE_TTS_MD_PATH,
} from '../../../../../test-utils/test-helpers'
import { mistralRefAudioPath, mistralTtsModels } from './cases'

test('mistral named saved-voice creation flag is rejected as an unknown flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${mistralTtsModels}`,
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
  expect(output).toContain('Unexpected flag: --tts-voice-name')
  expect(output).not.toContain('MISTRAL_API_KEY')
})
