import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AppendLogSink } from '../../../test-runner/append-log-sink'
import { appendCommandLog, appendRunnerLog, closeArtifactLogs, createRunArtifacts, writeLatestRunLog } from '../../../test-runner/artifacts'

test('append sinks preserve existing bytes and flush concurrent complete records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-append-sink-'))
  const path = join(root, 'events.log')
  await writeFile(path, 'existing\n')
  const first = new AppendLogSink(path)
  const second = new AppendLogSink(path)
  try {
    await Promise.all(Array.from({ length: 200 }, (_, i) => (i % 2 ? first : second).append(`record-${i}\n`)))
    const lines = (await readFile(path, 'utf8')).trim().split('\n')
    expect(lines[0]).toBe('existing')
    expect(lines.length).toBe(201)
    expect(new Set(lines).size).toBe(201)
    await first.close()
    await first.close()
    await expect(first.append('late')).rejects.toThrow('closed')
  } finally {
    await Promise.all([first.close(), second.close()])
    await rm(root, { recursive: true, force: true })
  }
})

test('artifact lifecycle closes both streams and late appends preserve earlier logs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-owned-logs-'))
  const artifacts = await createRunArtifacts(root)
  try {
    appendRunnerLog(artifacts, 'runner-first\n')
    await Promise.all(Array.from({ length: 50 }, (_, i) => appendCommandLog(artifacts, `command-${i}\n`)))
    await closeArtifactLogs(artifacts)
    appendRunnerLog(artifacts, 'runner-late\n')
    await appendCommandLog(artifacts, 'command-late\n')
    const latest = await readFile(await writeLatestRunLog(artifacts, 0), 'utf8')
    expect(latest).toContain('runner-first\nrunner-late')
    expect(latest).toContain('command-0\n')
    expect(latest).toContain('command-49\ncommand-late')
  } finally {
    await closeArtifactLogs(artifacts)
    await rm(root, { recursive: true, force: true })
  }
})

test('flushed append records survive abrupt child termination', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-crash-log-'))
  try {
    const path = join(root, 'crash.log')
    const module = resolve('test/test-runner/append-log-sink.ts')
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `import { AppendLogSink } from ${JSON.stringify(module)}; const sink = new AppendLogSink(${JSON.stringify(path)}); await sink.append('durable-before-exit\\n'); process.kill(process.pid, 'SIGKILL')`], { env: { PATH: process.env['PATH'] }, stdout: 'pipe', stderr: 'pipe' })
    await child.exited
    expect(await readFile(path, 'utf8')).toBe('durable-before-exit\n')
  } finally { await rm(root, { recursive: true, force: true }) }
})
