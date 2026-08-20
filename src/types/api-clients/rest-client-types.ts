import type { BoundedCaptureResult } from '~/types'
import type { AppProviderError } from '~/utils/error-handler'

export type RestClientConfigBase = {
  apiKey: string
  baseURL?: string | undefined
  provider?: string | undefined
}

export type RestRequestOptionsBase = {
  signal?: AbortSignal | undefined
}

export type RestFetchOptionsBase<TConfig extends RestClientConfigBase> = {
  config: TConfig
  path: string
  method?: string | undefined
  headers?: RequestInit['headers'] | undefined
  body?: RequestInit['body'] | undefined
  signal?: AbortSignal | undefined
  errorMessagePrefix: string
}


// Every provider REST error is an AppProviderError, so `kind: 'provider_http'` and the
// AppError-family process handling apply uniformly instead of only on the replicate path.
export type RestErrorBase = AppProviderError & {
  status: number
  headers: Headers
  body: string
  rawResponse?: unknown
  bodyBytes?: number | undefined
  bodyTruncated?: boolean | undefined
  bodyPreview?: string | undefined
}

export type ProviderRestRequest = {
  url: string
  init: RequestInit
}

export type ProviderRestErrorContext<TOptions> = {
  options: TOptions
  response: Response
  captured: BoundedCaptureResult
  rawText: string
  parsedBody: unknown
}

export type ProviderRestClientProfile<TOptions, TError extends Error> = {
  buildRequest: (options: TOptions) => ProviderRestRequest
  errorMessagePrefix: (options: TOptions) => string
  formatErrorMessage?: ((context: ProviderRestErrorContext<TOptions> & { errorMessagePrefix: string }) => string) | undefined
  createError: (context: ProviderRestErrorContext<TOptions> & { message: string }) => TError
  diagnostics?: 'raw-and-parsed' | 'parsed-body' | 'factory' | undefined
}
