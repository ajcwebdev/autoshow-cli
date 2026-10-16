import { expect, test } from 'bun:test'
import { childEnv } from '~/utils/child-env'

const capture = async (source: string) => {
  const child = Bun.spawn([process.execPath, '--no-env-file', '--eval', source], {
    env: childEnv(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(10_000)
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}

test('command payloads preserve exact bytes and separate stdout from stderr without decorations', async () => {
  const stdout = 'Harborlight café\n{"case":"one","status":"reused"}\n{"case":"two","status":"reused"}\nno trailing newline'
  const stderr = '{"status":"failure","error":"invalid image"}\n'
  const result = await capture(`
    import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
    writeCommandPayload(${JSON.stringify(stdout)})
    writeCommandPayload(${JSON.stringify(stderr)}, 'stderr')
  `)
  expect(result).toEqual({ exitCode: 0, stdout, stderr })
})

test('raw progress does not stage, replace, or flush the invocation terminal result', async () => {
  const result = await capture(`
    import { flushStagedResult, runWithResultInvocation, stageResult, writeCommandPayload } from '~/utils/app-logger/result-emitter'
    await runWithResultInvocation({ json: true, runId: 'command-payload-contract', command: 'payload-test' }, () => {
      writeCommandPayload('{"case":"one","status":"reused"}\\n')
      stageResult({ completed: 2 }, 'Offline assessment complete.')
      writeCommandPayload('{"case":"two","status":"reused"}\\n')
      writeCommandPayload('diagnostic only\\n', 'stderr')
      flushStagedResult()
    })
  `)
  expect(result.exitCode).toBe(0)
  expect(result.stderr).toBe('diagnostic only\n')
  const lines = result.stdout.trimEnd().split('\n').map(line => JSON.parse(line))
  expect(lines).toHaveLength(3)
  expect(lines.slice(0, 2)).toEqual([{ case: 'one', status: 'reused' }, { case: 'two', status: 'reused' }])
  expect(lines[2]).toMatchObject({ schemaVersion: 1, type: 'result', runId: 'command-payload-contract', command: 'payload-test', status: 'success', exitCode: 0, message: 'Offline assessment complete.', data: { completed: 2 } })
})
