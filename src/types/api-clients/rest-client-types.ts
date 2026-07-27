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


export type RestErrorBase = Error & {
  status: number
  headers: Headers
  body: string
  rawResponse?: unknown
  bodyBytes?: number | undefined
  bodyTruncated?: boolean | undefined
  bodyPreview?: string | undefined
}
