import type { RestClientConfigBase, RestFetchOptionsBase, RestRequestOptionsBase } from '~/types'

export type OpenAIRestConfig = RestClientConfigBase

export type OpenAIRequestOptions = RestRequestOptionsBase & {
  errorMessagePrefix?: string | undefined
}

export type OpenAIResponsesResponse = {
  id?: string | undefined
  model?: string | undefined
  status?: string | undefined
  error?: unknown
  incomplete_details?: unknown
  output_text?: string | undefined
  output?: unknown[] | undefined
  usage?: {
    input_tokens?: number | undefined
    output_tokens?: number | undefined
    [key: string]: unknown
  } | undefined
  [key: string]: unknown
}

export type OpenAIChatCompletionResponse = {
  model?: string | undefined
  choices?: Array<{
    finish_reason?: string | null | undefined
    message?: {
      content?: unknown
      [key: string]: unknown
    } | undefined
    [key: string]: unknown
  }> | undefined
  usage?: {
    prompt_tokens?: number | undefined
    completion_tokens?: number | undefined
    total_tokens?: number | undefined
    [key: string]: unknown
  } | undefined
  [key: string]: unknown
}

export type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string | undefined
    url?: string | undefined
    mime_type?: string | null | undefined
    revised_prompt?: string | undefined
    [key: string]: unknown
  }> | undefined
  usage?: Record<string, unknown> | undefined
  size?: string | undefined
  quality?: string | undefined
  model?: string | undefined
  revised_prompt?: string | undefined
  [key: string]: unknown
}


export type OpenAIErrorFields = {
  error?: unknown
  code?: string
  param?: string
  type?: string
}

export type OpenAIFetchOptions = RestFetchOptionsBase<OpenAIRestConfig>
