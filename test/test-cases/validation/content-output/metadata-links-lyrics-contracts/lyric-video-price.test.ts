import { expect, test } from 'bun:test'
import { runCommand } from '../../../../test-utils/test-helpers'

test('music lyric-video render mode supports a zero-cost price dry run', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'music',
    '--audio',
    'input/examples/lyrics/01-example-song.mp3',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  expect(`${result.stdout}\n${result.stderr}`).toContain('Total estimated cost: free')
})
