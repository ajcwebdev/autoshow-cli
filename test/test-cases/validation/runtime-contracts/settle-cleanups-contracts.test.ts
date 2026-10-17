import { describe, expect, test } from 'bun:test'
import { AppError } from '~/utils/error-handler'
import { settleCleanups } from '~/utils/settle-cleanups'
import { captureLogEvents } from '../../../test-utils/console-capture'

const options = (primaryFailed: boolean) => ({ label: 'Probe', stage: 'probe:cleanup', primaryFailed })

describe('settleCleanups contracts', () => {
  test('every cleanup runs and nothing is thrown when all succeed', async () => {
    const ran: string[] = []
    await settleCleanups([
      () => { ran.push('sync') },
      async () => { ran.push('async') }
    ], options(false))

    expect(ran).toEqual(['sync', 'async'])
  })

  test('after a primary failure, cleanup failures are logged and not thrown, and later cleanups still run', async () => {
    const ran: string[] = []
    const { events } = await captureLogEvents(async () => {
      await settleCleanups([
        () => { throw new Error('first cleanup broke') },
        async () => { ran.push('second') },
        async () => { throw new Error('third cleanup broke') }
      ], options(true))
    })

    expect(ran).toEqual(['second'])
    const warnings = events.filter((event) => event.level === 'warn')
    expect(warnings.map((event) => event.message)).toEqual([
      'Probe cleanup failed after an earlier error: first cleanup broke',
      'Probe cleanup failed after an earlier error: third cleanup broke'
    ])
    expect(warnings[0]?.metadata).toMatchObject({ stage: 'probe:cleanup' })
  })

  test('after success, cleanup failures surface together as one infrastructure error', async () => {
    const ran: string[] = []
    const failure = await settleCleanups([
      async () => { throw new Error('remove cache failed') },
      async () => { ran.push('source cleanup') },
      () => { throw new Error('remove source failed') }
    ], options(false)).then(() => undefined, (error: unknown) => error)

    expect(ran).toEqual(['source cleanup'])
    expect(failure).toBeInstanceOf(AppError)
    const appError = failure as AppError
    expect(appError.kind).toBe('infrastructure')
    expect(appError.stage).toBe('probe:cleanup')
    expect(appError.message).toBe('Probe cleanup failed.')
    expect(appError.cause).toBeInstanceOf(AggregateError)
    expect((appError.cause as AggregateError).errors.map((error: Error) => error.message)).toEqual([
      'remove cache failed',
      'remove source failed'
    ])
  })
})
