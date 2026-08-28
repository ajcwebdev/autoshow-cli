import type { OpenAIChatCompletionResponse, OpenAIErrorFields, OpenAIFetchOptions, OpenAIImageResponse, OpenAIRequestOptions, OpenAIResponsesResponse, OpenAIRestConfig } from '~/types'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { redactPayloadPreview } from '~/utils/bounded-capture'
import { AppProviderError } from '~/utils/error-handler'
import { createProviderRestClient, isRecord, joinRestUrl, readJsonResponse } from '~/utils/rest-client'

export class OpenAIRestError extends AppProviderError {
  override readonly status: number
  override readonly headers: Headers
  body: string
  rawResponse: unknown
  bodyBytes?: number | undefined
  bodyTruncated?: boolean | undefined
  bodyPreview?: string | undefined
  error?: unknown
  code?: string
  param?: string
  type?: string

  constructor(
    message: string,
    status: number,
    headers: Headers,
    body: string,
    rawResponse: unknown,
    fields: OpenAIErrorFields = {}
  ) {
    super(message, { status, headers, stage: 'openai' })
    this.name = 'OpenAIRestError'
    this.status = status
    this.headers = headers
    this.body = body
    this.rawResponse = rawResponse
    if (typeof rawResponse === 'string') {
      this.bodyPreview = rawResponse
    }

    if (fields.error !== undefined) this.error = fields.error
    if (fields.code !== undefined) this.code = fields.code
    if (fields.param !== undefined) this.param = fields.param
    if (fields.type !== undefined) this.type = fields.type
  }
}

const buildOpenAIUrl = (baseURL: string | undefined, path: string): string =>
  joinRestUrl(baseURL, path, OPENAI_DEFAULT_BASE_URL, { collapseVersionPrefix: 'v1' })

const extractErrorFields = (payload: unknown): OpenAIErrorFields => {
  if (!isRecord(payload)) return {}
  const error = payload['error']
  if (!isRecord(error)) return {}

  const fields: OpenAIErrorFields = { error }
  if (typeof error['code'] === 'string') fields.code = error['code']
  if (typeof error['param'] === 'string') fields.param = error['param']
  if (typeof error['type'] === 'string') fields.type = error['type']
  return fields
}

const openAIFetch = createProviderRestClient<OpenAIFetchOptions, OpenAIRestError>({
  buildRequest: (options) => {
    const headers = new Headers(options.headers)
    headers.set('authorization', `Bearer ${options.config.apiKey}`)
    return {
      url: buildOpenAIUrl(options.config.baseURL, options.path),
      init: {
        method: options.method ?? 'POST',
        headers,
        body: options.body,
        ...(options.signal ? { signal: options.signal } : {})
      }
    }
  },
  errorMessagePrefix: (options) => options.errorMessagePrefix,
  createError: ({ response, rawText, parsedBody, message }) =>
    new OpenAIRestError(
      message,
      response.status,
      response.headers,
      rawText,
      redactPayloadPreview(parsedBody),
      extractErrorFields(parsedBody)
    )
})

export const openAIJsonRequest = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  path: string,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<T> => {
  const response = await openAIFetch({
    config,
    path,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI request failed'
  })
  return await readJsonResponse(response, options.errorMessagePrefix ?? 'OpenAI response') as T
}

const openAIBinaryJsonRequest = async (
  config: OpenAIRestConfig,
  path: string,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<Uint8Array> => {
  const response = await openAIFetch({
    config,
    path,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI request failed'
  })
  return new Uint8Array(await response.arrayBuffer())
}

const openAIMultipartRequest = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  path: string,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<T> => {
  const response = await openAIFetch({
    config,
    path,
    method: 'POST',
    body: form,
    signal: options.signal,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI request failed'
  })
  return await readJsonResponse(response, options.errorMessagePrefix ?? 'OpenAI response') as T
}

export const createOpenAIResponse = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIResponsesResponse> =>
  await openAIJsonRequest<OpenAIResponsesResponse>(config, '/responses', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI Responses request failed'
  })

export const createOpenAIChatCompletion = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIChatCompletionResponse> =>
  await openAIJsonRequest<OpenAIChatCompletionResponse>(config, '/chat/completions', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI Chat Completions request failed'
  })

export const createOpenAISpeech = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<Uint8Array> =>
  await openAIBinaryJsonRequest(config, '/audio/speech', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI speech request failed'
  })

export const createOpenAITranscription = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<T> =>
  await openAIMultipartRequest<T>(config, '/audio/transcriptions', form, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI transcription failed'
  })

export const createOpenAIImage = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIImageResponse> =>
  await openAIJsonRequest<OpenAIImageResponse>(config, '/images/generations', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI image generation failed'
  })

export const createOpenAIImageEdit = async (
  config: OpenAIRestConfig,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIImageResponse> =>
  await openAIMultipartRequest<OpenAIImageResponse>(config, '/images/edits', form, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI image edit failed'
  })

export const extractOpenAIResponseText = (response: OpenAIResponsesResponse): string | undefined => {
  if (typeof response.output_text === 'string') {
    return response.output_text
  }

  let text = ''
  let foundText = false
  for (const item of response.output ?? []) {
    if (!isRecord(item) || !Array.isArray(item['content'])) {
      continue
    }

    for (const part of item['content']) {
      if (!isRecord(part)) {
        continue
      }

      if (part['type'] === 'output_text' && typeof part['text'] === 'string') {
        text += part['text']
        foundText = true
      }
    }
  }

  return foundText ? text : undefined
}

export const extractOpenAIChatCompletionText = (response: OpenAIChatCompletionResponse): string | undefined => {
  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return undefined
  }

  let text = ''
  let foundText = false
  for (const part of content) {
    if (isRecord(part) && typeof part['text'] === 'string') {
      text += part['text']
      foundText = true
    }
  }
  return foundText ? text : undefined
}
