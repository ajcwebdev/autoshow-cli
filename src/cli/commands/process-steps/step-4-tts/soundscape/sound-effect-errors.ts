export class SoundEffectProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly admissionDisposition: 'rejected' | 'ambiguous',
    readonly status?: number | undefined,
    readonly headers?: Headers | Record<string, string> | undefined
  ) {
    super(message)
    this.name = 'SoundEffectProviderError'
  }
}
