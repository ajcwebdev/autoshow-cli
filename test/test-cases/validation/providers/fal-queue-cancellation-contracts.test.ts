import { describe, expect, test } from 'bun:test'
import type { LogSinkEvent } from '~/types'
import { cancelFalQueueRequest, runFalQueue } from '~/utils/fal-client/fal-queue'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { captureLogEvents } from '../../../test-utils/console-capture'

setupContractSuiteLifecycle({ envKeys: ['FAL_API_KEY'], tempPrefix: 'autoshow-fal-cancel-' })

const API_KEY = 'fal-cancel-test-key'
const CANCEL_URL = 'https://mock.fal.local/requests/fal-request/cancel'

// Documented by fal's queue API: PUT .../requests/{request_id}/cancel answers 202 CANCELLATION_REQUESTED,
// 400 ALREADY_COMPLETED, or 404 NOT_FOUND, and an in-progress request may still complete after a 202.
const installFailingQueue = (cancel: (init: RequestInit | undefined) => Response | Promise<Response>) => installMockFetch((call, _input, init) => {
  if (call.method === 'POST') {
    return jsonResponse({
      status: 'IN_QUEUE',
      request_id: 'fal-request',
      status_url: 'https://mock.fal.local/status',
      response_url: 'https://mock.fal.local/result',
      cancel_url: CANCEL_URL
    })
  }
  if (call.url === 'https://mock.fal.local/status') return jsonResponse({ status: 'FAILED', request_id: 'fal-request' })
  if (call.url === CANCEL_URL && call.method === 'PUT') return cancel(init)
  throw new Error(`Unexpected fal.ai fetch: ${call.method} ${call.url}`)
})

const runFailingQueue = async (): Promise<LogSinkEvent[]> => {
  const { events } = await captureLogEvents(async () => {
    await expect(runFalQueue({
      apiKey: API_KEY,
      endpointId: 'fal-ai/fixture-model',
      input: { prompt: 'fixture' },
      pollIntervalMs: 1,
      operationName: 'fal-cancel-fixture'
    })).rejects.toThrow('fal.ai request fal-request ended with status FAILED')
  })
  return events
}

const cancelWarnings = (events: LogSinkEvent[]): LogSinkEvent[] =>
  events.filter((event) => event.level === 'warn' && event.metadata?.['provider'] === 'fal')

describe('fal.ai queue cancellation contracts', () => {
  const documentedOutcomes = [
    { name: 'a 202 acknowledgment is reported as requested, not as stopped work', status: 202, body: { status: 'CANCELLATION_REQUESTED' }, outcome: 'cancellation-requested', message: 'may still complete and be billed' },
    { name: 'a 400 ALREADY_COMPLETED reports a finished, possibly billed request', status: 400, body: { status: 'ALREADY_COMPLETED' }, outcome: 'already-completed', message: 'had already completed before cancellation' },
    { name: 'a 404 NOT_FOUND reports that no request existed', status: 404, body: { status: 'NOT_FOUND' }, outcome: 'not-found', message: 'reported no request to cancel' },
    { name: 'a 5xx is reported as a rejected cancellation', status: 503, body: { detail: 'unavailable' }, outcome: 'rejected', message: 'rejected the cancellation (HTTP 503)' }
  ] as const

  for (const expected of documentedOutcomes) {
    test(`${expected.name}, and the original queue error is still thrown`, async () => {
      let cancelResponse: Response | undefined
      const calls = installFailingQueue(() => {
        cancelResponse = jsonResponse(expected.body, { status: expected.status })
        return cancelResponse
      })

      const events = await runFailingQueue()

      const cancelCalls = calls.filter((call) => call.url === CANCEL_URL)
      expect(cancelCalls).toHaveLength(1)
      expect(cancelCalls[0]?.method).toBe('PUT')
      expect(cancelCalls[0]?.headers.get('authorization')).toBe(`Key ${API_KEY}`)
      expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
      expect(cancelResponse?.bodyUsed).toBe(true)

      const warnings = cancelWarnings(events)
      expect(warnings).toHaveLength(1)
      expect(warnings[0]?.message).toContain(expected.message)
      expect(warnings[0]?.metadata).toMatchObject({ cancelOutcome: expected.outcome, status: expected.status })
      expect(JSON.stringify(events)).not.toContain(API_KEY)
      expect(JSON.stringify(warnings)).not.toContain('fal-request')
    })
  }

  test('a transport failure leaves the cancellation outcome unknown and keeps the original error', async () => {
    installFailingQueue(() => { throw new TypeError('fetch failed: connection reset') })

    const warnings = cancelWarnings(await runFailingQueue())

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.message).toBe('The fal.ai cancellation outcome is unknown; the request may still be running.')
    expect(warnings[0]?.metadata).toMatchObject({ cancelOutcome: 'unknown' })
  })

  test('a hanging cancellation is abandoned at its own deadline instead of delaying the original error', async () => {
    let cancelSignal: AbortSignal | undefined
    installMockFetch((_call, _input, init) => {
      cancelSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    })

    const started = Date.now()
    const { events } = await captureLogEvents(async () => await cancelFalQueueRequest(API_KEY, CANCEL_URL, 50))

    expect(Date.now() - started).toBeLessThan(2_000)
    expect(cancelSignal?.aborted).toBe(true)
    expect(cancelWarnings(events).map((event) => event.metadata?.['cancelOutcome'])).toEqual(['unknown'])
  })
})
