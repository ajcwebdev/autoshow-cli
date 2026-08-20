import { AppProviderError } from '~/utils/error-handler'

/**
 * Soundscape provider failure. Previously a full parallel re-implementation of
 * `AppProviderError` (its own retryable/status/headers fields on a plain Error); it now
 * extends the canonical class and keeps only `admissionDisposition`, the field the
 * soundscape admission ledger needs and the base class does not model.
 */
export class SoundEffectProviderError extends AppProviderError {
  readonly admissionDisposition: 'rejected' | 'ambiguous'

  constructor(
    message: string,
    retryable: boolean,
    admissionDisposition: 'rejected' | 'ambiguous',
    status?: number | undefined,
    headers?: Headers | Record<string, string> | undefined
  ) {
    const normalizedHeaders = headers instanceof Headers
      ? headers
      : headers
        ? new Headers(headers)
        : undefined
    super(message, {
      retryable,
      stage: 'tts:soundscape',
      ...(status !== undefined ? { status } : {}),
      ...(normalizedHeaders ? { headers: normalizedHeaders } : {}),
      metadata: { admissionDisposition }
    })
    this.name = 'SoundEffectProviderError'
    this.admissionDisposition = admissionDisposition
  }
}
