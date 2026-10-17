import { describe, expect, test } from 'bun:test'
import { decodeGeminiJobResults, decodeGeminiJobState } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-jobs'

// Expectations come from Google's documentation, checked 2026-10-17:
// https://ai.google.dev/api/batch-api lists BatchState BATCH_STATE_UNSPECIFIED, _PENDING, _RUNNING,
// _SUCCEEDED, _FAILED, _CANCELLED and _EXPIRED; the GenerateContentBatch `output` holds
// `inlinedResponses` or `responsesFile`; an Operation has `done`, `error`, `metadata` and `response`.
// https://ai.google.dev/gemini-api/docs/batch-mode names the SDK states JOB_STATE_*, reads REST
// results from `response.inlinedResponses` / `response.responsesFile`, and SDK results from
// `dest.inlinedResponses` / `dest.inlined_responses` / `dest.fileName`.
// An operation error with google.rpc.Code 1 (CANCELLED) means the batch was cancelled.

describe('Gemini Batch operation state decoding', () => {
  const documentedStates = [
    ['PENDING', 'pending'],
    ['RUNNING', 'pending'],
    ['SUCCEEDED', 'completed'],
    ['FAILED', 'failed'],
    ['CANCELLED', 'cancelled'],
    ['EXPIRED', 'expired']
  ] as const

  for (const [name, state] of documentedStates) {
    test(`BATCH_STATE_${name} and its JOB_STATE_${name} alias map to ${state}`, () => {
      expect(decodeGeminiJobState({ metadata: { state: `BATCH_STATE_${name}` } })).toEqual({ providerState: `BATCH_STATE_${name}`, state })
      expect(decodeGeminiJobState({ state: `JOB_STATE_${name}` })).toEqual({ providerState: `BATCH_STATE_${name}`, state })
    })
  }

  test('a top-level state takes precedence over the operation metadata state', () => {
    expect(decodeGeminiJobState({ state: 'BATCH_STATE_SUCCEEDED', metadata: { state: 'BATCH_STATE_RUNNING' } }).state).toBe('completed')
  })

  test('a finished operation without a state derives it from the operation error', () => {
    expect(decodeGeminiJobState({ done: true })).toEqual({ providerState: 'BATCH_STATE_SUCCEEDED', state: 'completed' })
    expect(decodeGeminiJobState({ done: true, error: { code: 1, message: 'Cancelled' } })).toEqual({ providerState: 'BATCH_STATE_CANCELLED', state: 'cancelled' })
    expect(decodeGeminiJobState({ done: true, error: { code: 13, message: 'Internal' } })).toEqual({ providerState: 'BATCH_STATE_FAILED', state: 'failed' })
  })

  test('unrecognized, unspecified or missing states are rejected so the job is preserved', () => {
    for (const response of [{ metadata: { state: 'BATCH_STATE_UNSPECIFIED' } }, { state: 'BATCH_STATE_PAUSED' }, { done: false }, { state: 'constructor' }]) {
      expect(() => decodeGeminiJobState(response)).toThrow('unrecognized batch state')
    }
  })

  test('a malformed metadata or error envelope is rejected', () => {
    expect(() => decodeGeminiJobState({ metadata: 'BATCH_STATE_RUNNING' })).toThrow('Invalid Gemini TTS audio')
    expect(() => decodeGeminiJobState({ done: true, error: ['cancelled'] })).toThrow('Invalid Gemini TTS audio')
  })
})

describe('Gemini Batch result envelope decoding', () => {
  const rows = [{ metadata: { key: 'a' }, response: {} }]

  test('REST operations carry inline responses or a responses file under `response`', () => {
    expect(decodeGeminiJobResults({ done: true, response: { inlinedResponses: { inlinedResponses: rows } } })).toEqual({ inlined: rows, responsesFile: undefined })
    expect(decodeGeminiJobResults({ done: true, response: { responsesFile: 'files/results' } })).toEqual({ inlined: undefined, responsesFile: 'files/results' })
  })

  test('the GenerateContentBatch `output` is read from the response or the operation metadata', () => {
    expect(decodeGeminiJobResults({ response: { output: { responsesFile: 'files/from-response' } } }).responsesFile).toBe('files/from-response')
    expect(decodeGeminiJobResults({ metadata: { output: { inlinedResponses: { inlinedResponses: rows } } } }).inlined).toEqual(rows)
  })

  test('SDK-shaped destinations use `dest` with camel or snake case fields', () => {
    expect(decodeGeminiJobResults({ dest: { inlinedResponses: rows } }).inlined).toEqual(rows)
    expect(decodeGeminiJobResults({ dest: { inlined_responses: rows } }).inlined).toEqual(rows)
    expect(decodeGeminiJobResults({ dest: { fileName: 'files/sdk-results' } }).responsesFile).toBe('files/sdk-results')
    expect(decodeGeminiJobResults({ dest: { responses_file: 'files/snake-results' } }).responsesFile).toBe('files/snake-results')
  })

  test('a finished operation without any result envelope reports no results', () => {
    expect(decodeGeminiJobResults({ done: true, metadata: { state: 'BATCH_STATE_FAILED' } })).toEqual({ inlined: undefined, responsesFile: undefined })
  })
})
