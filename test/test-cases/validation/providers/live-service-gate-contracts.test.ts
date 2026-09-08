import { expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'

test('live service registration requires exported credentials and preserves budget skips', async () => {
  const fixture = resolve('test/test-utils/fixtures/live-service-gate.fixture.ts')
  await withTempDir('autoshow-live-service-gate-', async cwd => {
    await writeFile(`${cwd}/.env`, 'SERVICE_GATE_FIRST_KEY=dotenv-only\nSERVICE_GATE_SECOND_KEY=dotenv-only\n')
    const cases = [
      { first: undefined, second: undefined, skip: [], passes: 0, skips: 2 },
      { first: ' ', second: 'synthetic', skip: [], passes: 0, skips: 2 },
      { first: 'synthetic', second: undefined, skip: [], passes: 1, skips: 1 },
      { first: 'synthetic', second: 'synthetic', skip: [], passes: 2, skips: 0 },
      { first: 'synthetic', second: 'synthetic', skip: ['gate-single', 'gate-multi'], passes: 0, skips: 2 },
    ]
    for (const scenario of cases) {
      const result = Bun.spawnSync([process.execPath, '--no-env-file', 'test', fixture], {
        cwd,
        env: {
          PATH: process.env['PATH'],
          SERVICE_GATE_FIRST_KEY: scenario.first,
          SERVICE_GATE_SECOND_KEY: scenario.second,
          AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS: JSON.stringify(['gate-single', 'gate-multi']),
          AUTOSHOW_TEST_BUDGET_SKIP_KEYS: JSON.stringify(scenario.skip),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const output = `${result.stdout.toString()}${result.stderr.toString()}`
      expect(result.exitCode).toBe(0)
      expect(output).toContain(`${scenario.passes} pass`)
      if (scenario.skips > 0) expect(output).toContain(`${scenario.skips} skip`)
      expect(output).toContain('0 fail')
    }
  })
})
