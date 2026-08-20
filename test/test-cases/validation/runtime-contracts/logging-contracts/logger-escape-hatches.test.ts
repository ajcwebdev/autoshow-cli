import { expect, test } from 'bun:test'
import type { LogSink, LogSinkEvent } from '~/types'
import { clearSuppressedLogCategories, l, suppressLogCategories } from '~/utils/app-logger/app-logger'
import { createLogger } from '~/utils/app-logger/core'
import { createReporter } from '~/utils/app-logger/reporter'
import { withLogSinks } from '../../../../test-utils/console-capture'

const collectEvents = (): { sink: LogSink; events: LogSinkEvent[] } => {
  const events: LogSinkEvent[] = []
  return { sink: (event) => { events.push(event) }, events }
}

test('report.result carries the payload as metadata and a human detail table', () => {
  const { sink, events } = collectEvents()
  const logger = createLogger({ sinks: [sink], minLevel: 'debug' })
  const reporter = createReporter(logger)

  reporter.result({ registrationId: 'vr_hero', state: 'ready' })

  expect(events).toHaveLength(1)
  expect(events[0]!.message).toBe('Result')
  expect(events[0]!.category).toBe('command')
  expect(events[0]!.metadata).toEqual({ registrationId: 'vr_hero', state: 'ready' })
  expect(events[0]!.humanTable?.details).toEqual([
    { label: 'registrationId', value: 'vr_hero' },
    { label: 'state', value: 'ready' }
  ])
})

test('report.result honors an explicit message, category, and human sections', () => {
  const { sink, events } = collectEvents()
  const logger = createLogger({ sinks: [sink], minLevel: 'debug' })
  const reporter = createReporter(logger)

  reporter.result({ provider: 'fish' }, {
    message: 'Voice discovery',
    category: 'pricing',
    humanSections: [{ title: 'Voices', table: { rows: [{ id: 'a' }], columns: ['id'] } }]
  })

  expect(events[0]!.message).toBe('Voice discovery')
  expect(events[0]!.category).toBe('pricing')
  expect(events[0]!.humanSections?.[0]?.title).toBe('Voices')
  expect(events[0]!.humanTable).toBeUndefined()
})

test('suppressed categories are dropped before reaching any sink, including derived loggers', () => {
  const { sink, events } = collectEvents()
  const suppressedCategories: Array<'pipeline'> = []
  const logger = createLogger({ sinks: [sink], minLevel: 'debug', suppressedCategories })
  const derived = logger.withContext({ step: 'tts' })

  suppressedCategories.push('pipeline')

  logger.write('info', 'pipeline event', { category: 'pipeline' })
  derived.write('info', 'derived pipeline event', { category: 'pipeline' })
  logger.write('info', 'command event', { category: 'command' })

  expect(events.map((event) => event.message)).toEqual(['command event'])
})

test('suppressLogCategories filters the global logger and clears back to normal', async () => {
  const { sink, events } = collectEvents()

  await withLogSinks([sink], () => {
    const restore = suppressLogCategories(['pipeline'])
    l.write('info', 'suppressed', { category: 'pipeline' })
    expect(events).toHaveLength(0)

    // The returned handle scopes suppression to one run, so a direct caller cannot leave
    // the process-wide logger muted for everyone after it.
    restore()
    l.write('info', 'restored', { category: 'pipeline' })
    expect(events.map((event) => event.message)).toEqual(['restored'])

    suppressLogCategories(['pipeline'])
    clearSuppressedLogCategories()
    l.write('info', 'cleared', { category: 'pipeline' })
    expect(events.map((event) => event.message)).toEqual(['restored', 'cleared'])
  })
})

test('warn and debug take the same options object write does', () => {
  const { sink, events } = collectEvents()
  const logger = createLogger({ sinks: [sink], minLevel: 'debug' })

  logger.warn('stale slot', { category: 'pipeline', metadata: { slot: 3 } })
  logger.debug('probe', { category: 'artifact' })

  expect(events[0]!.category).toBe('pipeline')
  expect(events[0]!.metadata).toEqual({ slot: 3 })
  expect(events[0]!.args).toEqual([])
  expect(events[1]!.category).toBe('artifact')
})

test('interpolation arguments ride in options.args rather than trailing parameters', () => {
  const { sink, events } = collectEvents()
  const logger = createLogger({ sinks: [sink], minLevel: 'debug' })

  // The shorthands used to guess whether a trailing object was options or an ordinary
  // interpolation argument by checking its keys. Args are now declared, so a payload that
  // happens to share a key name with LogWriteOptions can no longer be mistaken for options.
  logger.warn('count', { category: 'pipeline', args: [3, 'items'] })
  logger.warn('payload', { category: 'pipeline', args: [{ slot: 3 }] })
  logger.warn('error arg', { category: 'pipeline', args: [new Error('boom')] })

  expect(events[0]!.args).toEqual([3, 'items'])
  expect(events[0]!.category).toBe('pipeline')
  expect(events[1]!.args).toHaveLength(1)
  expect(events[1]!.category).toBe('pipeline')
  expect(events[2]!.args).toHaveLength(1)
})
