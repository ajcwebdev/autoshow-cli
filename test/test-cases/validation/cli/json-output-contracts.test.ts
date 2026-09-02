import { describe, expect, test } from 'bun:test'
import { preScanJsonMode, runCliInProcess } from '~/cli/create-cli'
import { flushStagedResult, runWithResultInvocation, stageResult } from '~/utils/app-logger/result-emitter'
import { captureConsoleText, captureProcessOutput } from '../../../test-utils/console-capture'

const parseLines = (text: string): Array<Record<string, unknown>> => text.trim()
  ? text.trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
  : []

describe('JSON CLI output protocol', () => {
  test('pre-scan uses the last effective JSON value', () => {
    expect(preScanJsonMode(['--json=false', '--json'])).toBe(true)
    expect(preScanJsonMode(['--json', '--no-json'])).toBe(false)
    expect(preScanJsonMode(['--json', '--json=false'])).toBe(false)
  })

  test('help produces exactly one successful result and no diagnostic stdout contamination', async () => {
    const captured = await captureProcessOutput(async () => await runCliInProcess(['--json', '--help']))
    const stdout = parseLines(captured.stdout)

    expect(captured.result).toBe(0)
    expect(stdout).toHaveLength(1)
    expect(stdout[0]).toMatchObject({ schemaVersion: 1, type: 'result', status: 'success', exitCode: 0 })
    expect(stdout[0]?.['data']).toMatchObject({ document: expect.stringContaining('Usage') })
    expect(parseLines(captured.stderr).every(record => record['type'] === 'log')).toBe(true)
  })

  test('usage failure writes one failure result to stdout and logs only to stderr', async () => {
    const captured = await captureProcessOutput(async () => await runCliInProcess(['--json', 'not-a-command']))
    const stdout = parseLines(captured.stdout)
    const stderr = parseLines(captured.stderr)

    expect(captured.result).toBe(2)
    expect(stdout).toHaveLength(1)
    expect(stdout[0]).toMatchObject({ type: 'result', status: 'failure', exitCode: 2 })
    expect(stderr).toHaveLength(1)
    expect(stderr[0]).toMatchObject({ type: 'log', level: 'error', category: 'usage' })
  })

  test('quiet suppresses diagnostics but never suppresses the terminal result', async () => {
    const captured = await captureProcessOutput(async () => await runCliInProcess(['config', '--show', '--quiet', '--json']))

    expect(captured.result).toBe(0)
    expect(parseLines(captured.stdout)).toHaveLength(1)
    expect(captured.stderr).toBe('')
  })

  test('version becomes a successful result envelope with stable invocation fields', async () => {
    const captured = await captureProcessOutput(async () => await runCliInProcess(['--json', '--version']))
    const result = parseLines(captured.stdout)[0]

    expect(captured.result).toBe(0)
    expect(result).toMatchObject({
      schemaVersion: 1,
      type: 'result',
      command: 'version',
      status: 'success',
      exitCode: 0,
      data: { version: expect.stringMatching(/^v\d/) }
    })
    expect(typeof result?.['timestamp']).toBe('string')
    expect(typeof result?.['runId']).toBe('string')
    expect(typeof result?.['durationMs']).toBe('number')
  })

  test('log-level filtering changes diagnostics but never the result envelope', async () => {
    const verbose = await captureProcessOutput(async () => await runCliInProcess(['config', '--show', '--verbose', '--json']))
    const errorsOnly = await captureProcessOutput(async () => await runCliInProcess(['config', '--show', '--log-level=error', '--json']))

    expect(parseLines(verbose.stdout)).toHaveLength(1)
    expect(parseLines(verbose.stderr).every(record => record['type'] === 'log')).toBe(true)
    expect(parseLines(errorsOnly.stdout)).toHaveLength(1)
    expect(errorsOnly.stderr).toBe('')
  })

  test('raw metadata Markdown conflicts with the JSON stdout protocol', async () => {
    const captured = await captureProcessOutput(async () => await runCliInProcess(['metadata', 'fixture', '--markdown', '--json']))
    const result = parseLines(captured.stdout)[0]

    expect(captured.result).toBe(2)
    expect(result).toMatchObject({ type: 'result', status: 'failure', exitCode: 2 })
    expect(result?.['message']).toContain('--markdown')
    expect(result?.['hints']).toEqual([expect.stringContaining('raw Markdown')])
  })

  test('removed --log-format fails with an actionable JSON hint', async () => {
    const captured = await captureProcessOutput(async () => await runCliInProcess(['--json', '--log-format', 'json']))
    const result = parseLines(captured.stdout)[0]

    expect(captured.result).toBe(2)
    expect(result).toMatchObject({ type: 'result', status: 'failure', exitCode: 2 })
    expect(result?.['hints']).toEqual([expect.stringContaining('--json')])
  })

  test('a JSON invocation followed by a text invocation resets output mode', async () => {
    const json = await captureProcessOutput(async () => await runCliInProcess(['--json', '--version']))
    const text = await captureConsoleText(async () => { await runCliInProcess(['--json=false', '--version']) })

    expect(parseLines(json.stdout)).toHaveLength(1)
    expect(text.stdout).toMatch(/^v\d/)
    expect(text.stdout).not.toContain('"type":"result"')
  })

  test('missing and duplicate staged results are internal errors before output', async () => {
    await expect(runWithResultInvocation({ json: false, runId: 'missing' }, () => {
      flushStagedResult()
    })).rejects.toThrow('without staging a terminal result')

    await expect(runWithResultInvocation({ json: false, runId: 'duplicate' }, () => {
      stageResult({ first: true })
      stageResult({ second: true })
    })).rejects.toThrow('more than one terminal result')
  })
})
