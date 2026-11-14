import { expect, test } from 'bun:test'
import { withTempDir } from '../../../test-utils/temp-dirs'

const failureHandlers = new URL('../../../../src/cli/failure-handlers.ts', import.meta.url).pathname
const resultEmitter = new URL('../../../../src/utils/app-logger/result-emitter.ts', import.meta.url).pathname
const errorHandler = new URL('../../../../src/utils/error-handler.ts', import.meta.url).pathname

const runFatalProcess = async (body: string, artifact?: string) => {
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `
    import { installProcessFailureHandlers } from ${JSON.stringify(failureHandlers)};
    import { runWithResultInvocation, setResultFile, stageResult, flushStagedResult, isolateCommandResult } from ${JSON.stringify(resultEmitter)};
    import { UsageError } from ${JSON.stringify(errorHandler)};
    installProcessFailureHandlers();
    await runWithResultInvocation({ json: true, runId: 'fatal-contract', command: 'fixture', processFatal: true }, async () => {
      ${artifact ? `setResultFile(${JSON.stringify(artifact)});` : ''}
      ${body}
    });
  `], { env: { PATH: process.env['PATH'] }, stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(stdout + stderr).not.toContain('fatal-secret-value-987')
  return { exitCode, stdout, stderr, result: JSON.parse(stdout) }
}

for (const trigger of [
  `Promise.reject(new Error('fatal-secret-value-987'));`,
  `setTimeout(() => { throw new Error('fatal-secret-value-987') }, 0);`
]) {
  test(`fatal process emits a redacted JSON failure for ${trigger.startsWith('Promise') ? 'unhandled rejections' : 'uncaught exceptions'}`, async () => {
    const result = await runFatalProcess(`${trigger} await new Promise(() => {});`)
    expect(result.exitCode).toBe(1)
    expect(result.result).toMatchObject({ type: 'result', status: 'failure', exitCode: 1, runId: 'fatal-contract', command: 'fixture', error: { kind: 'internal', stage: 'cli:fatal' } })
  })
}

test('fatal application errors preserve exit code and hints in the owning compact result artifact', async () => {
  await withTempDir('fatal-json-result-', async root => {
    const artifact = `${root}/result.json`
    const result = await runFatalProcess(`
      await isolateCommandResult(async () => {
        Promise.reject(UsageError('Public diagnostic', { hints: ['Fix fixture input'] }));
        await new Promise(() => {});
      });
    `, artifact)
    expect(result.exitCode).toBe(2)
    const stored = await Bun.file(artifact).json()
    expect(stored).toMatchObject({ type: 'result', status: 'failure', command: 'fixture', exitCode: 2, hints: ['Fix fixture input'], error: { kind: 'usage' } })
    expect(result.result).toMatchObject({ type: 'result', status: 'failure', exitCode: 2 })
  })
})

test('fatal errors after a completed invocation cannot emit a second terminal result', async () => {
  const result = await runFatalProcess(`
    stageResult({ complete: true }); flushStagedResult();
    setTimeout(() => { throw new Error('fatal-secret-value-987') }, 0);
  `)
  expect(result.exitCode).toBe(1)
  expect(result.result).toMatchObject({ type: 'result', status: 'success', data: { complete: true } })
})

test('the actual CLI preserves a fatal JSON failure in its selected result artifact', async () => {
  await withTempDir('fatal-cli-result-', async root => {
    const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('unused') })
    const port = reservation.port
    reservation.stop(true)
    const cli = new URL('../../../../src/cli/create-cli.ts', import.meta.url).pathname
    const artifact = `${root}/result.json`
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `
      import { installProcessFailureHandlers } from ${JSON.stringify(failureHandlers)};
      import { runCliInProcess } from ${JSON.stringify(cli)};
      installProcessFailureHandlers();
      setTimeout(() => { throw new Error('fatal-secret-value-987') }, 100);
      await runCliInProcess(['setup', '--network-check', 'serve', '--port', ${JSON.stringify(String(port))}, '--json', '--result-file', ${JSON.stringify(artifact)}]);
    `], { env: { PATH: process.env['PATH'], AUTOSHOW_SETUP_NO_ORPHANS_CHILD: '1' }, stdout: 'pipe', stderr: 'pipe' })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exitCode, stderr).toBe(1)
    expect(stdout + stderr).not.toContain('fatal-secret-value-987')
    expect(stderr).toContain('Network fixture ready')
    expect(JSON.parse(stdout)).toMatchObject({ type: 'result', command: 'setup', status: 'failure', exitCode: 1 })
    expect(await Bun.file(artifact).json()).toMatchObject({ type: 'result', command: 'setup', status: 'failure', exitCode: 1, error: { stage: 'cli:fatal' } })
  })
})

test('a completed JSON invocation cannot leak its fatal result scope into a later plain invocation', async () => {
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `
    import { installProcessFailureHandlers } from ${JSON.stringify(failureHandlers)};
    import { runWithResultInvocation } from ${JSON.stringify(resultEmitter)};
    installProcessFailureHandlers();
    await runWithResultInvocation({ json: true, runId: 'finished-json', processFatal: true }, () => {});
    await runWithResultInvocation({ json: false, runId: 'active-text', processFatal: true }, async () => {
      Promise.reject(new Error('fatal-secret-value-987'));
      await new Promise(() => {});
    });
  `], { env: { PATH: process.env['PATH'] }, stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).not.toContain('fatal-secret-value-987')
})
