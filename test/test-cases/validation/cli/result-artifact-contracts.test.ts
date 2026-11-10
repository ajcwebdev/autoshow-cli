import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { preScanResultFile, runCliInProcess } from '~/cli/create-cli'
import { flushStagedResult, isolateCommandResult, runWithResultInvocation, setResultFile, stageFailureResult, stageResult, writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { resetLoggerForInvocation } from '~/utils/app-logger/app-logger'
import { captureProcessOutput } from '../../../test-utils/console-capture'

const directories: string[] = []
const directory = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-result-artifact-'))
  directories.push(root)
  return root
}
const parseResult = (text: string): Record<string, any> => {
  expect(text.trim().split('\n')).toHaveLength(1)
  return JSON.parse(text)
}

describe('compact terminal result artifacts', () => {
  afterEach(async () => {
    resetLoggerForInvocation(false)
    await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
  })

  test('real help invocation writes full private artifact and one bounded summary', async () => {
    const path = join(await directory(), 'nested', 'help.json')
    const captured = await captureProcessOutput(() => runCliInProcess(['--json', '--result-file', path, '--help']))
    const summary = parseResult(captured.stdout)
    const body = await readFile(path, 'utf8')
    const full = JSON.parse(body)
    expect(captured.result).toBe(0)
    expect(summary).toMatchObject({ type: 'result', resultMode: 'summary', status: 'success', exitCode: 0 })
    expect(summary['data'].keys).toContain('document')
    expect(summary['data'].document).toBeUndefined()
    expect(full.data.document).toContain('Usage')
    expect(full.resultMode).toBeUndefined()
    expect(summary['runId']).toBe(full.runId)
    expect(resolve(summary['artifact'].path)).toBe(path)
    expect(summary['artifact'].bytes).toBe(Buffer.byteLength(body))
    expect(summary['artifact'].sha256).toBe(createHash('sha256').update(body).digest('hex'))
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect((await stat(join(path, '..'))).mode & 0o777).toBe(0o700)
    expect(Buffer.byteLength(captured.stdout)).toBeLessThanOrEqual(8192)
  })

  test('bulk results and deep price data remain in artifact while previews stay bounded and redacted', async () => {
    const path = join(await directory(), 'bulk.json')
    const prices = { amount: 42.75, inputTokens: 4000, nested: { one: { two: { three: { four: { five: { six: 'retained' } } } } } } }
    const captured = await captureProcessOutput(() => runWithResultInvocation({ json: true, runId: 'bulk' }, () => {
      setResultFile(path)
      stageResult({ prices, inputTokens: 4000, count: 20000, items: Array.from({ length: 20000 }, (_, i) => ({ text: `Bulk item ${i}` })), apiKey: 'private-credential-value', password: 123456, errors: ['API_KEY=hidden-provider-key ' + 'x'.repeat(5000)] })
      flushStagedResult()
    }))
    const summary = parseResult(captured.stdout)
    const body = await readFile(path, 'utf8')
    const full = JSON.parse(body)
    expect(full.data.prices).toEqual(prices)
    expect(full.data.items).toHaveLength(20000)
    expect(full.data.inputTokens).toBe(4000)
    expect(full.data.apiKey).toBe('REDACTED')
    expect(full.data.password).toBe('REDACTED')
    expect(body).not.toContain('private-credential-value')
    expect(body).not.toContain('hidden-provider-key')
    expect(summary['data'].counts).toMatchObject({ inputTokens: 4000, count: 20000, itemsLength: 20000 })
    expect(summary['data'].counts.password).toBeUndefined()
    expect(summary['data'].representativeErrors).toHaveLength(1)
    expect(summary['data'].representativeErrors[0].length).toBeLessThanOrEqual(256)
    expect(captured.stdout).not.toContain('Bulk item')
    expect(Buffer.byteLength(captured.stdout)).toBeLessThanOrEqual(8192)
  })

  test('usage failures retain failure exit and error in artifact', async () => {
    const path = join(await directory(), 'failure.json')
    const captured = await captureProcessOutput(() => runCliInProcess(['--json', '--result-file=' + path, 'not-a-command']))
    expect(captured.result).toBe(2)
    expect(parseResult(captured.stdout)).toMatchObject({ resultMode: 'summary', status: 'failure', exitCode: 2 })
    expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ status: 'failure', exitCode: 2, error: expect.any(Object) })
  })

  test('existing files and symlinks are rejected without modifying their contents', async () => {
    const root = await directory()
    const original = join(root, 'original.json')
    const alias = join(root, 'alias.json')
    await writeFile(original, 'canonical retained content')
    await symlink(original, alias)
    for (const path of [original, alias]) {
      const captured = await captureProcessOutput(() => runCliInProcess(['--json', '--result-file', path, '--version']))
      expect(captured.result).toBe(2)
      expect(parseResult(captured.stdout)['status']).toBe('failure')
      expect(await readFile(original, 'utf8')).toBe('canonical retained content')
    }
  })

  test('missing JSON mode or invalid file option fails before command execution', async () => {
    const path = join(await directory(), 'absent.json')
    const text = await captureProcessOutput(() => runCliInProcess(['--result-file', path, '--version']))
    expect(text.result).toBe(2)
    expect(text.stdout).toBe('')
    expect(await Bun.file(path).exists()).toBe(false)
    for (const args of [['--json', '--result-file'], ['--json', '--result-file', '--version'], ['--json', '--result-file=', '--version']]) {
      const captured = await captureProcessOutput(() => runCliInProcess(args))
      expect(captured.result).toBe(2)
      expect(parseResult(captured.stdout)['status']).toBe('failure')
    }
  })

  test('pre-scan honors equals, last path and argument terminator', () => {
    expect(preScanResultFile(['--result-file=first', '--result-file', 'second'])).toBe('second')
    expect(preScanResultFile(['--', '--result-file', 'not-an-option'])).toBeUndefined()
  })

  test('control-character paths reject before dispatch and escaped multibyte previews remain within the cap', async () => {
    const root = await directory()
    const invalid = await captureProcessOutput(() => runCliInProcess(['--json', '--result-file', join(root, 'control\nname.json'), '--version']))
    expect(invalid.result).toBe(2)
    expect(parseResult(invalid.stdout)['status']).toBe('failure')
    const captured = await captureProcessOutput(() => runWithResultInvocation({ json: true, runId: '\u0001'.repeat(128), command: '\u0002'.repeat(128) }, () => {
      setResultFile(join(root, 'escaped.json'))
      stageResult(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`${i}\\"${'界'.repeat(50)}`, Array(10).fill(1)])), '\u0003'.repeat(512))
      flushStagedResult()
    }))
    expect(parseResult(captured.stdout)['resultMode']).toBe('summary')
    expect(Buffer.byteLength(captured.stdout)).toBeLessThanOrEqual(8192)
  })

  test('artifact path replacement fails closed and failure can still be emitted', async () => {
    const root = await directory()
    const path = join(root, 'result.json')
    const protectedPath = join(root, 'protected.txt')
    await writeFile(protectedPath, 'preserve me')
    const captured = await captureProcessOutput(() => runWithResultInvocation({ json: true, runId: 'changed-file' }, async () => {
      setResultFile(path)
      await rm(path)
      await symlink(protectedPath, path)
      stageResult({ complete: true })
      let failure: unknown
      try { flushStagedResult() } catch (error) { failure = error }
      expect(failure).toBeDefined()
      stageFailureResult(failure, 1, 'Could not save the terminal result artifact.')
      flushStagedResult()
    }))
    expect(parseResult(captured.stdout)).toMatchObject({ status: 'failure', exitCode: 1 })
    expect(await readFile(protectedPath, 'utf8')).toBe('preserve me')
  })

  test('raw payload writes are rejected in compact mode including isolated workflows', async () => {
    const path = join(await directory(), 'raw.json')
    const captured = await captureProcessOutput(() => runWithResultInvocation({ json: true, runId: 'raw' }, async () => {
      setResultFile(path)
      expect(() => writeCommandPayload('unbounded raw data')).toThrow('Raw command payloads')
      await expect(isolateCommandResult(async () => writeCommandPayload('unbounded nested data'))).rejects.toThrow('Raw command payloads')
      stageResult({ complete: true })
      flushStagedResult()
    }))
    expect(parseResult(captured.stdout)['status']).toBe('success')
    expect(captured.stdout).not.toContain('unbounded')
  })
})
