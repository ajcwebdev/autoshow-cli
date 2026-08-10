import { describe, expect, test } from 'bun:test'
import { createLogger } from '~/utils/app-logger/core'
import { formatCost } from '~/utils/app-logger/formatters'
import { createDetailTable, createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { createHumanSink } from '~/utils/app-logger/sinks/human-sink'
import { createJsonSink } from '~/utils/app-logger/sinks/json-sink'
import { stripAnsi } from '~/utils/terminal-colors'
import type { LogSinkEvent } from '~/types'
import { captureConsole, hasAnsi, withColorEnv } from './shared'

const makeEvent = (level: LogSinkEvent['level']): LogSinkEvent => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  level,
  message: 'message',
  category: 'general',
  runId: 'run-id',
  context: { command: 'write' },
  metadata: { key: 'value' },
  indent: true,
  args: []
})

describe('logging contracts', () => {
  test('formatCost renders exact cents with three fractional digits', () => {
      expect(formatCost(0.07343)).toBe('0.073\u00a2')
      expect(formatCost(0.0736)).toBe('0.074\u00a2')
    })

  test('human sink routes interactive info logs to stdout with table output', () => {
      const sink = createHumanSink({ interactive: true })
      const captured = captureConsole(() => {
        sink({
          ...makeEvent('info'),
          message: 'Locations',
          humanTable: createHumanTable([{ artifact: 'manifest', path: 'output/run/manifest.json' }], ['artifact', 'path'])
        })
      })

      expect(captured.stdout).toHaveLength(1)
      expect(captured.stderr).toHaveLength(0)
      expect(captured.stdout[0]).toContain('Locations')
      expect(stripAnsi(captured.stdout[0] as string)).toContain('output/run/manifest.json')
    })

  test('human sink colors log prefixes when color is enabled', () => {
      const sink = createHumanSink({ interactive: true })
      const captured = withColorEnv({ forceColor: '1' }, () => captureConsole(() => {
        sink({
          ...makeEvent('success'),
          message: 'Complete!',
          category: 'artifact'
        })
      }))

      const output = captured.stdout[0] as string
      expect(hasAnsi(output)).toBe(true)
      expect(stripAnsi(output)).toContain('[00:00:00] \u2713 Complete!')
    })

  test('human sink renders multiple titled sections on one event', () => {
      const sink = createHumanSink({ interactive: true })
      const captured = captureConsole(() => {
        sink({
          ...makeEvent('info'),
          message: 'Complete',
          humanTable: createDetailTable([['total', '12m 40s, 18.81\u00a2']]),
          humanSections: [{
            title: 'Artifacts',
            table: createHumanTable([{ artifact: 'speech', path: 'speech.wav' }], ['artifact', 'path'])
          }]
        })
      })

      const output = stripAnsi(captured.stdout[0] as string)
      expect(output).toContain('[00:00:00] \u2022 Complete')
      expect(output).toContain('total: 12m 40s, 18.81\u00a2')
      expect(output).toContain('Artifacts')
      expect(output).toContain('\u2502 speech \u2502 speech.wav')
    })

  test('json sink routes warnings and errors to stderr and info to stdout', () => {
      const sink = createJsonSink()
      const captured = withColorEnv({ forceColor: '1' }, () => captureConsole(() => {
        sink({
          ...makeEvent('info'),
          humanTable: createHumanTable([{ status: 'failed', cost: '2.00000\u00a2' }], ['status', 'cost'])
        })
        sink(makeEvent('warn'))
        sink(makeEvent('error'))
      }))

      expect(captured.stdout).toHaveLength(1)
      expect(captured.stderr).toHaveLength(2)
      expect(hasAnsi(captured.stdout[0] as string)).toBe(false)
      expect(JSON.parse(captured.stdout[0] as string)).toMatchObject({
        level: 'info',
        runId: 'run-id',
        humanTable: { rows: [{ status: 'failed', cost: '2.00000\u00a2' }] }
      })
      expect(JSON.parse(captured.stderr[0] as string)).toMatchObject({ level: 'warn', runId: 'run-id' })
    })

  test('sanitizeLogText redacts known secret patterns', () => {
      const secret = 'secret-value-123'
      const sanitized = sanitizeLogText([
        `https://example.com/file.mp3?token=${secret}`,
        `authorization: bearer ${secret}`,
        `OPENAI_API_KEY=${secret}`
      ].join('\n'))

      expect(sanitized).not.toContain(secret)
      expect(sanitized).toContain('token=REDACTED')
      expect(sanitized).toContain('authorization: bearer REDACTED')
      expect(sanitized).toContain('OPENAI_API_KEY=REDACTED')
    })

  test('logger error metadata preserves custom fields and redacts nested causes', () => {
      const secret = 'secret-value-123'
      const events: LogSinkEvent[] = []
      const logger = createLogger({
        runId: 'run-id',
        sinks: [event => events.push(event)]
      })
      const cause = Object.assign(new Error('nested failure'), {
        body: `OPENAI_API_KEY=${secret}`
      })
      const error = Object.assign(new Error('provider failed'), {
        status: 503,
        stage: 'poll',
        headers: new Headers({ authorization: `Bearer ${secret}` }),
        cause
      })

      logger.error('Command failed', error)

      const metadataError = events[0]?.metadata?.['error'] as Record<string, unknown> | undefined
      const serialized = JSON.stringify(metadataError)
      expect(metadataError?.['status']).toBe(503)
      expect(metadataError?.['stage']).toBe('poll')
      expect(serialized).not.toContain(secret)
      expect(serialized).toContain('REDACTED')
      expect(metadataError?.['cause']).toBeDefined()
    })
})
