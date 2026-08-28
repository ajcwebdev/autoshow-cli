import { expect, test } from 'bun:test'
import { runCommand } from '../../test-utils/test-helpers'

test('--price with both providers shows two cost rows and per-provider filenames', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'music', 'an ambient piano song', '--provider', 'elevenlabs=music_v2', '--provider', 'minimax=music-3.0', '--price'],
  )
  const output = `${result.stdout}\n${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('Cost Estimate')
  expect(output).toContain('elevenlabs')
  expect(output).toContain('minimax')
  expect(output).toContain('generated-music-elevenlabs-music_v2.mp3')
  expect(output).toContain('generated-music-minimax-music-3.0.mp3')
})
