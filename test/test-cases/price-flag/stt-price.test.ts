import { expect, test } from 'bun:test'
import { runCommand, LOCAL_EXAMPLE_AUDIO_PATH } from '../../test-utils/test-helpers'

test('whisper model tiny --price prints estimate', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    LOCAL_EXAMPLE_AUDIO_PATH,
    '--provider',
    'whisper=tiny',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})

test('deepgram nova-3 --price prints estimate', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    LOCAL_EXAMPLE_AUDIO_PATH,
    '--provider',
    'deepgram=nova-3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
})
