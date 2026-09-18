import { expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'

const FIXTURE_TIMEOUT_MS = 120_000

// Spawned asynchronously with a deadline: a synchronous spawn blocks this worker, and each case
// starts a whole `bun test` child, which stalled under the parallel suite's subprocess churn
// instead of failing.
const runFixture = async (
  env: Record<string, string | undefined>,
  cwd?: string
): Promise<{ exitCode: number, stdout: string, stderr: string }> => {
  const fixture = resolve('test/test-utils/fixtures/live-service-gate.fixture.ts')
  const child = Bun.spawn([process.execPath, '--no-env-file', 'test', fixture], {
    ...(cwd === undefined ? {} : { cwd }),
    env,
    stdout: 'pipe',
    stderr: 'pipe',
    signal: AbortSignal.timeout(FIXTURE_TIMEOUT_MS)
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ])
  return { exitCode, stdout, stderr }
}

test('live service registration requires exported credentials and preserves budget skips', async () => {
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
      const result = await runFixture({
        PATH: process.env['PATH'],
        AUTOSHOW_TEST_CREDENTIAL_MODE: 'live',
        SERVICE_GATE_FIRST_KEY: scenario.first,
        SERVICE_GATE_SECOND_KEY: scenario.second,
        AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS: JSON.stringify(['gate-single', 'gate-multi']),
        AUTOSHOW_TEST_BUDGET_SKIP_KEYS: JSON.stringify(scenario.skip),
      }, cwd)
      const output = `${result.stdout}${result.stderr}`
      expect(result.exitCode).toBe(0)
      expect(output).toContain(`${scenario.passes} pass`)
      if (scenario.skips > 0) expect(output).toContain(`${scenario.skips} skip`)
      expect(output).toContain('0 fail')
    }
  })
})


test('direct live registration cannot admit callbacks without complete valid budget evidence', async () => {
  for (const [evaluated, skip] of [[undefined, undefined], ['{', '[]'], ['["gate-single","gate-multi"]', '{'], ['["gate-single","gate-multi"]', '[7]'], ['["gate-single","gate-multi"]', '["unknown"]']]) {
    const result = await runFixture({ PATH: process.env['PATH'], AUTOSHOW_TEST_CREDENTIAL_MODE: 'live', SERVICE_GATE_FIRST_KEY: 'callback-must-not-execute', SERVICE_GATE_SECOND_KEY: 'callback-must-not-execute', AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS: evaluated, AUTOSHOW_TEST_BUDGET_SKIP_KEYS: skip })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('Budget preflight evidence is missing or invalid')
    expect(result.stderr).not.toContain('Received: "callback-must-not-execute"')
  }
})

test('a runner-marked unbudgeted live run admits every credentialed callback without budget evidence', async () => {
  const live = { PATH: process.env['PATH'], AUTOSHOW_TEST_CREDENTIAL_MODE: 'live', AUTOSHOW_TEST_UNBUDGETED_LIVE_RUN: '1', SERVICE_GATE_FIRST_KEY: 'synthetic', SERVICE_GATE_SECOND_KEY: 'synthetic' }
  const admitted = await runFixture(live)
  const admittedOutput = `${admitted.stdout}${admitted.stderr}`
  expect(admitted.exitCode).toBe(0)
  expect(admittedOutput).toContain('2 pass')
  expect(admittedOutput).toContain('0 fail')

  const missingCredential = await runFixture({ ...live, SERVICE_GATE_SECOND_KEY: undefined })
  const missingOutput = `${missingCredential.stdout}${missingCredential.stderr}`
  expect(missingCredential.exitCode).toBe(0)
  expect(missingOutput).toContain('1 pass')
  expect(missingOutput).toContain('1 skip')
})

test('the unbudgeted marker admits nothing outside live credential mode', async () => {
  const result = await runFixture({ PATH: process.env['PATH'], AUTOSHOW_TEST_CREDENTIAL_MODE: 'fixture', AUTOSHOW_TEST_UNBUDGETED_LIVE_RUN: '1', SERVICE_GATE_FIRST_KEY: 'callback-must-not-execute', SERVICE_GATE_SECOND_KEY: 'callback-must-not-execute' })
  const output = `${result.stdout}${result.stderr}`
  expect(result.exitCode).toBe(0)
  expect(output).toContain('0 pass')
  expect(output).toContain('2 skip')
})
