import { expect, test } from 'bun:test'
import { runCommand } from '../../../../test-utils/test-helpers'

test('music lyric-video render mode rejects generation-only price mode', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--audio',
    'https://ajc.pics/autoshow/examples/0-audio-short.mp3',
    '--price'
  ])

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Do not combine hosted music flags')
})
