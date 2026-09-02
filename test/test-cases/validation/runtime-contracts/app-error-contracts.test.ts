import { describe, expect, test } from 'bun:test'
import {
  AppError,
  AppUsageError,
  InfraError,
  UsageError,
  annotateAppError,
  collectErrorChain,
  extractErrorHints,
  extractErrorMetadata,
  isAppError,
  isUsageError,
  normalizeExitCode,
  serializeDiagnosticError,
  serializeResultError,
  usageMessage
} from '~/utils/error-handler'
import { httpResponseError, httpResponseOptions } from '~/utils/rest-client'
import { attachAsyncSttErrorContext } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-stt-polling'

describe('app error contracts', () => {
  test('AppError stores classification, exit code, hints, metadata, and cause', () => {
    const cause = Object.assign(new Error('provider rejected request'), {
      status: 429,
      stage: 'create',
      retryClass: 'runtime_http_read',
      retryable: true,
      rawResponse: { error: 'rate limit' }
    })
    const error = new AppError('Request failed', {
      kind: 'provider_http',
      stage: 'test:provider',
      hints: ['Lower concurrency'],
      cause,
      metadata: { provider: 'openai' }
    })

    expect(isAppError(error)).toBe(true)
    expect(error.kind).toBe('provider_http')
    expect(error.exitCode).toBe(1)
    expect(error.hints).toEqual(['Lower concurrency'])
    expect(error.cause).toBe(cause)
    expect(extractErrorMetadata(error)).toMatchObject({
      provider: 'openai',
      status: 429,
      stage: 'test:provider',
      retryClass: 'runtime_http_read',
      retryable: true,
      rawResponse: { error: 'rate limit' }
    })
  })

  test('AppUsageError and UsageError preserve legacy usage behavior', () => {
    const usage = new AppUsageError('Bad flags', { hints: ['Run help'] })
    const legacy = UsageError('Missing input', { hints: ['Run: bun autoshow help extract'] })

    expect(usage.name).toBe('AppUsageError')
    expect(usage.exitCode).toBe(2)
    expect(isUsageError(usage)).toBe(true)
    expect(isUsageError(legacy)).toBe(true)
    expect(normalizeExitCode(legacy)).toBe(2)
    expect(usageMessage(legacy)).toBe('Missing input')
    expect(extractErrorHints(legacy)).toEqual(['Run: bun autoshow help extract'])
  })

  test('usage classification requires the AppUsageError class, not a matching error name', () => {
    const impostor = Object.assign(new Error('impostor'), { name: 'UsageError' })

    expect(isUsageError(impostor)).toBe(false)
    expect(normalizeExitCode(impostor)).toBe(1)
    expect(usageMessage(impostor)).toBe('Invalid command usage. Run: bun autoshow --help')
  })

  test('normalizeExitCode honors explicit positive exit codes', () => {
    const error = new AppError('Partial completion', {
      kind: 'validation',
      stage: 'test:validation',
      exitCode: 7
    })

    expect(normalizeExitCode(error)).toBe(7)
    expect(normalizeExitCode(new Error('plain'))).toBe(1)
  })

  test('collectErrorChain walks causes without looping', () => {
    const inner = new Error('inner')
    const outer = new Error('outer', { cause: inner })
    inner.cause = outer

    expect(collectErrorChain(outer).map(error => error.message)).toEqual(['outer', 'inner'])
  })

  test('serializeDiagnosticError redacts secrets and preserves custom fields and causes', () => {
    const secret = 'secret-value-123'
    const cause = Object.assign(new Error('nested'), {
      body: `OPENAI_API_KEY=${secret}`
    })
    const error = Object.assign(new Error('top'), {
      status: 503,
      headers: new Headers({ authorization: `Bearer ${secret}` }),
      rawResponse: { detail: `authorization: bearer ${secret}` },
      cause
    })

    const diagnostic = serializeDiagnosticError(error)
    const serialized = JSON.stringify(diagnostic)

    expect(diagnostic['status']).toBe(503)
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('REDACTED')
    expect(typeof diagnostic['cause']).toBe('object')
  })

  test('result errors serialize Error, object, and primitive causes with cycle protection', () => {
    const primitive = InfraError('primitive failure', { stage: 'test:primitive', cause: 17 })
    expect(serializeResultError(primitive)['causes']).toEqual([{ name: 'PrimitiveCause', value: 17 }])

    const objectCause: { label: string, cause?: unknown } = { label: 'object failure' }
    objectCause.cause = objectCause
    const objectError = InfraError('object failure', { stage: 'test:object', cause: objectCause })
    const serializedObject = serializeResultError(objectError)
    expect(JSON.stringify(serializedObject)).toContain('[Circular]')
    expect((serializedObject['causes'] as unknown[]).length).toBeLessThanOrEqual(2)

    const nested = InfraError('outer failure', {
      stage: 'test:error',
      cause: new Error('inner failure')
    })
    expect(serializeResultError(nested)['causes']).toEqual([
      { name: 'Error', message: 'inner failure' }
    ])
  })

  test('annotating an AppError preserves its identity and original cause', () => {
    const cause = new Error('original cause')
    const error = InfraError('operation failed', { stage: 'test:original', cause })

    const annotated = annotateAppError(error, {
      stage: 'test:annotation',
      metadata: { operation: 'fixture' }
    })

    expect(annotated).toBe(error)
    expect(annotated.cause).toBe(cause)
    expect(annotated.stage).toBe('test:original')
    expect(annotated.metadata).toMatchObject({ operation: 'fixture' })
  })

  test('STT context attachment preserves retry exhaustion and its cause', () => {
    const cause = InfraError('provider unavailable', { stage: 'test:provider', retryable: true })
    const exhausted = new AppError('attempts exhausted', {
      kind: 'retry_exhausted',
      stage: 'test:retry',
      retryClass: 'runtime_http_poll',
      retryable: false,
      cause
    })

    let caught: unknown
    try {
      attachAsyncSttErrorContext(exhausted, 'poll', 'runtime_http_poll')
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(exhausted)
    expect((caught as AppError).cause).toBe(cause)
    expect((caught as AppError).kind).toBe('retry_exhausted')
    expect((caught as AppError).retryable).toBe(false)
  })

  test('HTTP response errors retain structured status, headers, retry fields, and metadata', () => {
    const response = new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '2' }
    })
    const error = httpResponseError('provider rejected the request', httpResponseOptions(response, {
      stage: 'test:http-create',
      retryClass: 'runtime_http_create_conservative',
      retryable: true,
      metadata: { provider: 'fixture' }
    }))

    expect(error).toMatchObject({
      kind: 'provider_http',
      stage: 'test:http-create',
      status: 429,
      retryClass: 'runtime_http_create_conservative',
      retryable: true,
      provider: 'fixture'
    })
    expect(error.headers.get('retry-after')).toBe('2')
    expect(error.metadata).toEqual({ provider: 'fixture' })
  })

  test('structured auth, quota, rate-limit, and exhaustion fields produce actionable hints', () => {
    expect(extractErrorHints(InfraError('credentials rejected', {
      stage: 'test:auth',
      status: 401
    }))).toContain('Check the provider credentials and setup for the selected service.')
    expect(extractErrorHints(InfraError('account blocked', {
      stage: 'test:billing',
      status: 402,
      metadata: { quota: true, blockedReason: 'insufficient_balance' }
    }))).toContain('Check the provider billing balance, quota, and account limits before retrying.')
    expect(extractErrorHints(InfraError('too many requests', {
      stage: 'test:rate-limit',
      status: 429
    }))).toContain('The provider is rate limiting requests. Retry later or lower concurrency.')
    expect(extractErrorHints(new AppError('retry stopped', {
      kind: 'retry_exhausted',
      stage: 'test:retry',
      retryable: false
    }))).toContain('Retry attempts were exhausted. Check the provider diagnostics for the final failure.')
  })
})
