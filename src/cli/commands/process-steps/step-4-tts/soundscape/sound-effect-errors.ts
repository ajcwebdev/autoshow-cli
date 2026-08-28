import { AppProviderError } from '~/utils/error-handler'

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
