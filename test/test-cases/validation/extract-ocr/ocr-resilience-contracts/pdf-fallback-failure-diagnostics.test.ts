import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import {
  classifyOcrProviderFailure,
  createOcrPdfChunkRenderError,
  join,
  shouldFallbackToOcrPdfChunks,
  writeOcrProviderError
} from './shared'
import { withLocalTestDir } from '../../../../test-utils/temp-dirs'

describe('PDF fallback failure diagnostics contracts', () => {
  test('PDF fallback classifier splits transient and limit failures but not auth or policy failures', () => {
    expect(shouldFallbackToOcrPdfChunks(ProviderError('provider timed out', { status: 503 }))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('Gemini OCR supports PDF inputs up to 1000 pages. Got 1200 pages.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OpenAI OCR returned malformed JSON.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OPENAI_API_KEY environment variable is required for OpenAI OCR'))).toBe(false)
    expect(shouldFallbackToOcrPdfChunks(new Error('Output blocked by content filtering policy'))).toBe(false)
    expect(shouldFallbackToOcrPdfChunks(ProviderError('Kimi OCR request failed (429): insufficient balance', { status: 429 }))).toBe(false)
  })

  test('PDF chunk render failures are concise and persist raw stderr diagnostics', async () => {
    const rawStderr = [
      'warning: ICC support is not available',
      'error: cannot render page tree for encrypted object',
      'more raw stderr detail'
    ].join('\n')
    const error = createOcrPdfChunkRenderError(
      { startPage: 6, endPage: 10 },
      {
        exitCode: 1,
        stderr: rawStderr,
        stdout: '',
        command: 'mutool convert -F pdf -o chunk.pdf input.pdf 6-10'
      }
    )
    const failure = classifyOcrProviderFailure(error)

    expect(failure).toMatchObject({ category: 'pdf_chunk_render' })
    expect(failure.message).toContain('PDF chunk creation failed for pages 6-10')
    expect(failure.message).toContain('warning: ICC support is not available')
    expect(failure.message).not.toContain('more raw stderr detail')

    await withLocalTestDir('ocr-error-artifact', async (dir) => {
      await writeOcrProviderError(dir, error, failure)
      const diagnostic = await Bun.file(join(dir, 'error.json')).json() as Record<string, unknown>
      expect(diagnostic['category']).toBe('pdf_chunk_render')
      expect(diagnostic['failureKind']).toBe('pdf_chunk_render')
      expect(diagnostic['retryable']).toBe(true)
      expect((diagnostic['error'] as Record<string, unknown>)['stderr']).toBe(rawStderr)
    })
  })

  test('OCR provider diagnostics redact sensitive identifiers in persisted artifacts', async () => {
    await withLocalTestDir('ocr-redacted-error', async (dir) => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
      const cloudTrace = '105445aa7843bc8bf206b12000100000/123456789;o=1'
      const cfRay = '8f7b3c2d1a0e9f12-DFW'
      const error = ProviderError('Kimi OCR request failed (429): insufficient account balance for account acct_live_secret1234', { status: 429, headers: new Headers({
          'x-request-id': 'req_headersecret123456',
          traceparent,
          traceresponse: traceparent,
          'x-cloud-trace-context': cloudTrace,
          'cf-ray': cfRay,
          'set-cookie': 'session=secret-cookie'
        }), metadata: { rawResponse: {
          error: {
            message: 'insufficient account balance',
            account_id: 'acct_live_secret1234',
            organization_id: 'org_live_secret1234',
            project_id: 'proj_live_secret1234',
            request_id: 'req_live_secret1234',
            trace_id: 'trace_live_secret1234',
            traceparent,
            traceResponse: traceparent,
            credential: 'cred_secret123456789'
          },
          diagnostics: {
            providerTrace: `traceparent=${traceparent}`,
            headers: {
              'cf-ray': cfRay,
              'x-cloud-trace-context': cloudTrace
            }
          }
        } } })
      const failure = classifyOcrProviderFailure(error)

      await writeOcrProviderError(dir, error, failure)
      const errorText = await Bun.file(join(dir, 'error.json')).text()
      const rawText = await Bun.file(join(dir, 'raw-response.json')).text()

      for (const sensitive of [
        'acct_live_secret1234',
        'org_live_secret1234',
        'proj_live_secret1234',
        'req_live_secret1234',
        'trace_live_secret1234',
        'secret-cookie',
        traceparent,
        cloudTrace,
        cfRay
      ]) {
        expect(errorText).not.toContain(sensitive)
      }
      for (const sensitive of [
        'acct_live_secret1234',
        'cred_secret123456789',
        traceparent,
        cloudTrace,
        cfRay
      ]) {
        expect(rawText).not.toContain(sensitive)
      }
      expect(errorText).toContain('REDACTED')
    })
  })
})
