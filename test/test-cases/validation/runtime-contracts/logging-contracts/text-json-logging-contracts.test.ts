import { describe, expect, test } from 'bun:test'
import { createLogger } from '~/utils/app-logger/core'
import { runWithSuppressedLogCategories } from '~/utils/app-logger/context-store'
import { createTextSink } from '~/utils/app-logger/sinks/text-sink'
import type { LogSinkEvent } from '~/types'
import { captureConsole } from '../../../../test-utils/console-capture'

describe('table-free text and structured log contracts', () => {
  test('normalizes every event message to one physical line while retaining structured metadata', () => {
    const events: LogSinkEvent[] = []
    const logger = createLogger({ runId: 'run-1', sinks: [(event) => events.push(event)] })
    const values = ['alpha', 'beta', 'gamma', 'delta']

    logger.write('info', 'first line\nsecond line\r\nthird line', {
      category: 'artifact',
      metadata: { values }
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.message).toBe('first line second line third line')
    expect(events[0]?.message).not.toMatch(/[\r\n]/)
    expect(events[0]?.metadata?.['values']).toEqual(values)
  })

  test('text sink preserves timestamp, glyph, and batch prefix on one line', async () => {
    const sink = createTextSink({ interactive: true })
    const captured = await captureConsole(() => sink({
      schemaVersion: 1,
      type: 'log',
      timestamp: '2026-09-01T12:34:56.789Z',
      runId: 'run-1',
      level: 'info',
      category: 'pipeline',
      message: 'one line',
      context: { itemIndex: 2, itemCount: 5 }
    }), { strip: true })

    expect(captured.stdout).toHaveLength(1)
    expect(captured.stdout[0]).toMatch(/^\[\d{2}:34:56\.789\] • \[2\/5\] one line$/)
    expect(captured.stdout[0]).not.toMatch(/[\r\n]/)
  })

  test('category suppression is async-scoped and never suppresses warnings', async () => {
    const events: LogSinkEvent[] = []
    const logger = createLogger({ runId: 'run-1', minLevel: 'debug', sinks: [(event) => events.push(event)] })

    await Promise.all([
      runWithSuppressedLogCategories(['pipeline'], async () => {
        await Promise.resolve()
        logger.write('info', 'hidden phase', { category: 'pipeline' })
        logger.warn('visible degradation', { category: 'pipeline' })
      }),
      Promise.resolve().then(() => logger.write('info', 'visible peer', { category: 'pipeline' }))
    ])

    expect(events.map(event => event.message)).toEqual(['visible degradation', 'visible peer'])
  })

  test('serializes an error once at the top level', () => {
    const events: LogSinkEvent[] = []
    const logger = createLogger({ runId: 'run-1', sinks: [(event) => events.push(event)] })
    const error = new Error('provider failed')

    logger.error('terminal failure', { category: 'runtime', metadata: { provider: 'fixture' }, error })

    expect(events[0]?.metadata).toEqual({ provider: 'fixture' })
    expect(events[0]?.metadata).not.toHaveProperty('error')
    expect(events[0]?.error).toMatchObject({ name: 'Error', message: 'provider failed' })
  })
})
