import type { RestClientConfigBase, RestErrorBase, RestRequestOptionsBase } from '~/types'

export type AnthropicRestConfig = RestClientConfigBase & {
  defaultBaseURL?: string | undefined
}

export type AnthropicRequestOptions = RestRequestOptionsBase & {
  beta?: string | string[] | undefined
}

export type AnthropicMessageResponse = {
  model?: string | undefined
  content?: Array<{ type: string, text?: string | undefined } & Record<string, unknown>> | undefined
  usage?: {
    input_tokens?: number | undefined
    output_tokens?: number | undefined
  } & Record<string, unknown> | undefined
} & Record<string, unknown>

export type AnthropicFileMetadata = {
  id: string
  type?: string | undefined
  filename?: string | undefined
  mime_type?: string | undefined
  size_bytes?: number | undefined
  created_at?: string | undefined
  downloadable?: boolean | undefined
} & Record<string, unknown>

export type AnthropicDeletedFile = {
  id?: string | undefined
  type?: string | undefined
} & Record<string, unknown>

export type AnthropicRestError = RestErrorBase & {
  errorType?: string | undefined
  responseType?: string | undefined
}

