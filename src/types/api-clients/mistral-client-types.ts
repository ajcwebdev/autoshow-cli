import type { RestClientConfigBase, RestErrorBase, RestFetchOptionsBase } from '~/types'

export type MistralRestError = RestErrorBase

export type MistralFetchOptions = Omit<RestFetchOptionsBase<RestClientConfigBase>, 'config'> & {
  apiKey: string
  baseURL?: string | undefined
  timeoutMs?: number | undefined
}

export type MistralJsonRequestOptions = Omit<MistralFetchOptions, 'body' | 'headers' | 'method'> & {
  body?: unknown
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | undefined
}

export type MistralMultipartRequestOptions = Omit<MistralFetchOptions, 'body' | 'headers' | 'method'> & {
  form: FormData
}
