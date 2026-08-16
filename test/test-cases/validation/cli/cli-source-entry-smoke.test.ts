import { expect, test } from 'bun:test'
import { runCommand } from '../../../test-utils/test-helpers'

test('source-mode CLI --help still renders', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', '--help'], {
    forceSourceCli: true,
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain('Extract and write content, manage voices, generate speech, images, video, and music, and build comic workflows')
})

test('source-mode unknown command still exits 2', async () => {
  const result = await runCommand(['src/cli/create-cli.ts', 'definitely-not-a-command'], {
    forceSourceCli: true,
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Unknown command "definitely-not-a-command"')
})
